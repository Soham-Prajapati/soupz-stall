import { CommandsMixin } from './commands.js';

import chalk from 'chalk';
import { emitKeypressEvents } from 'readline';
import { homedir } from 'os';
import { join, resolve } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { randomUUID } from 'crypto';
import SupabaseRelay from '../supabase-relay.js';
import { ContextPantry } from '../core/context-pantry.js';
import { CostTracker } from '../core/cost-tracker.js';
import { ColoredOutput } from '../core/colored-output.js';
import { getSkills } from '../skills.js';

import { MemoryMixin } from './memory.js';
import { FleetMixin } from './fleet.js';
import { UIMixin, BANNER, VIBES, COMMANDS } from './ui.js';
import { CloudMixin } from './cloud.js';
import { AuthMixin } from './auth.js';
import { TodoMixin } from './todo.js';
import { UtilsMixin, generateSessionName } from './utils.js';

const HISTORY_FILE = join(homedir(), '.soupz-agents', 'history');
export const GEMINI_MODELS = [
    { id: 'gemini-2.5-flash', desc: '0.1x (FAST)', cost: 0.1 },
    { id: 'gemini-2.5-pro', desc: '1x (SMART)', cost: 1 }
];
export const COPILOT_MODELS = [
    { id: 'gpt-5.1-codex', desc: '1x', cost: 1 },
    { id: 'gpt-4.1-mini', desc: '0x (FREE)', cost: 0 }
];

export class Session {
    constructor({ registry, spawner, orchestrator, contextManager, memory, grading, auth, userAuth, cwd, compressor, preprocessor, kitchenMonitor, mcpClient, memoryPool }) {
        this.relay = new SupabaseRelay();
        this.registry = registry;
        this.spawner = spawner;
        this.orchestrator = orchestrator;
        this.context = contextManager;
        this.memory = memory;
        this.grading = grading;
        this.auth = auth;
        this.userAuth = userAuth || null;
        this.compressor = compressor || null;
        this.preprocessor = preprocessor || null;
        this.kitchenMonitor = kitchenMonitor || null;
        this.mcpClient = mcpClient || null;
        this.memoryPool = memoryPool || null;
        this.costTracker = new CostTracker();
        this.output = ColoredOutput;
        this.cwd = cwd;
        this.activeTool = null;
        this.activeModel = null;
        this.yolo = false;
        this.sandbox = true;
        this.sessionName = generateSessionName();
        this.activePersonas = [];
        this.inputBuffer = '';
        this.currentOrderId = null;
        this.currentOrderStartTime = null;
        this.dropdownItems = [];
        this.dropdownIndex = -1;
        this.dropdownVisible = false;
        this.dropdownScroll = 0;
        this.busy = false;
        this.busyAgentId = null;
        this.agentTokens = {};
        this.sessionStart = Date.now();
        this.totalPromptsSent = 0;
        this.cmdHistory = [];
        this.cmdHistoryIndex = -1;
        try { if (existsSync(HISTORY_FILE)) this.cmdHistory = readFileSync(HISTORY_FILE, 'utf8').split('\n').filter(Boolean).slice(-100); } catch {}
        this.todoList = [];
        this.conversationLog = [];
        this.pantry = new ContextPantry();
        this.pantry.init();
        this.modelPrefs = this.loadModelPrefs();
        this._applyModelPrefs();

        if (this.userAuth?.user) {
            this.relay.setUser(this.userAuth.user.id || this.userAuth.user.email);
            void this.relay.registerMachine();
        }

        // Wire events
        this.spinnerTimer = null;
        this.spinnerFrame = 0;

        this.spawner.on('output', (agentId, parsed) => {
            if (parsed?.text) {
                // Stop spinner on first output
                this.stopSpinner();
                const a = this.registry.get(agentId);
                this.getAgentTokens(agentId).out += Math.ceil(parsed.text.length / 4);
                this.pushToLog({ role: 'assistant', agent: agentId, text: parsed.text, ts: Date.now() });
                
                // Supabase Relay: Stream chunk to cloud
                if (this.currentOrderId) {
                    void this.relay.pushChunk(this.currentOrderId, parsed.text);
                }

                // Filter out Copilot verbose usage stats logging
                // For instance, "Total usage est:" or "API time spent:" or mock AI models usage.
                const filteredLines = parsed.text.split('\n').filter((l) => {
                    const text = l.trim();
                    if (!text) return true;
                    if (text.match(/Total usage est:|API time spent:|Total session time:|Total code changes:|Breakdown by AI model:/i)) return false;
                    if (text.match(/^[ \t│\|└L_]+(gpt-|claude-|o3-|gemini-|llama|deepseek|qwen)/i)) return false;
                    // Filter emoji-prefixed model usage lines (e.g. "🐙  claude-opus-4.6  307.6k in, 4.5k out...")
                    if (text.match(/\d+\.?\d*k?\s+(in|out),?\s+\d+\.?\d*k?\s+(in|out|cached)/i)) return false;
                    if (text.match(/Est\.\s+\d+\s+Premium\s+requests/i)) return false;
                    return true;
                });

                let firstLinePrinted = false;
                for (let i = 0; i < filteredLines.length; i++) {
                    const line = filteredLines[i];
                    const rendered = typeof this._renderInlineMarkdown === 'function' ? this._renderInlineMarkdown(line) : line;
                    if (!firstLinePrinted && line.trim()) {
                        process.stdout.write('\n' + chalk.hex(a?.color || '#888')(`  ${a?.icon || '○'} `) + rendered + '\n');
                        firstLinePrinted = true;
                    } else if (line.trim()) {
                        process.stdout.write(chalk.hex('#555')('  ⎿ ') + rendered + '\n');
                    } else {
                        process.stdout.write('\n');
                    }
                }
            }
        });
        
        this.spawner.on('status-change', (agentId, newState) => {
            if (newState === 'done') {
                this.stopSpinner();
                const a = this.registry.get(agentId);
                const elapsed = a?.startTime ? Date.now() - a.startTime : 0;
                this.getAgentTokens(agentId).apiTimeMs += elapsed;
                this.grading?.recordResult(agentId, true, elapsed);
                this.removeActivePersona(agentId);
                console.log(chalk.green(`\n  ✔ Done`) + chalk.dim(` (${Math.round(elapsed / 1000)}s)`));
                console.log(); // Add an extra empty line as gap before prompt
            }
            if (newState === 'error') {
                this.stopSpinner();
                this.grading?.recordResult(agentId, false, 0);
                this.removeActivePersona(agentId);
                console.log(chalk.red('\n  ✖ Error'));
                console.log(); // Add an extra empty line as gap before prompt
            }
        });
    }

    _applyModelPrefs() {
        if (!this.modelPrefs) return;
        const copilotModel = this.modelPrefs.copilot || this.modelPrefs.auto;
        if (copilotModel) {
            const c = this.registry.get('copilot');
            if (c) {
                c.build_args = ['copilot', '-p', '{prompt}', '--model', copilotModel, ...(this.yolo ? ['--allow-all-tools'] : [])];
                // Do not set this.activeModel globally here since default is AUTO mode
            }
        }
        const geminiModel = this.modelPrefs.gemini;
        if (geminiModel) {
            const g = this.registry.get('gemini');
            if (g) {
                g.build_args = ['-p', '{prompt}', '--output-format', 'stream-json', '--model', geminiModel, ...(this.yolo ? ['--yolo'] : [])];
            }
        }
    }

    loadModelPrefs() {
        try {
            const fp = join(homedir(), '.soupz-agents', 'model-prefs.json');
            if (existsSync(fp)) return JSON.parse(readFileSync(fp, 'utf8'));
        } catch { }
        return { auto: 'gpt-4.1' };
    }

    saveModelPrefs() {
        try {
            const dir = join(homedir(), '.soupz-agents');
            if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
            writeFileSync(join(dir, 'model-prefs.json'), JSON.stringify(this.modelPrefs, null, 2));
        } catch { }
    }

    getAgentTokens(id) {
        if (!this.agentTokens[id]) this.agentTokens[id] = { in: 0, out: 0, prompts: 0, apiTimeMs: 0 };
        return this.agentTokens[id];
    }

    getPersonas() { return this.registry.list().filter(a => a.type === 'persona'); }
    getTools() { return this.registry.list().filter(a => a.type !== 'persona'); }

    pushToLog(msg) {
        this.conversationLog.push(msg);
        if (this.conversationLog.length > 100) this.conversationLog.shift();
        this.autoOffloadContext();
    }

    colorizeAgentOutput(id, text) {
        const a = this.registry.get(id);
        const color = a?.color || '#888';
        return chalk.hex(color)(text);
    }

    async init() {
        console.log(BANNER);
        console.log(chalk.hex('#A855F7')(`               ${VIBES[Math.floor(Math.random() * VIBES.length)]}\n`));
        const personas = this.getPersonas();
        const allAgents = this.registry.headless().filter(a => a.available);
        const agentIcons = allAgents.map((t) => chalk.hex(t.color || '#888')(`${t.icon} ${t.id}`)).join(chalk.hex('#555')('  '));
        const modeTag = allAgents.length >= 2 ? chalk.hex('#A855F7')('⚡ multi-agent') : chalk.hex('#FFD93D')('single');
        const modelTag = this.activeModel ? chalk.hex('#4ECDC4')(`🔪 ${this.activeModel}`) : '';
        const statusLine = modeTag + chalk.hex('#555')(' · ') +
                          chalk.hex('#FFD93D')(`${personas.length} chefs`) + chalk.hex('#555')(' · ') + 
                          chalk.hex('#6BCB77')('sandbox') +
                          (modelTag ? chalk.hex('#555')(' · ') + modelTag : '') +
                          chalk.hex('#555')(' · ') + 
                          chalk.hex('#4ECDC4')('/help');
        const boxWidth = 65;
        console.log(chalk.hex('#555')('  ╭' + '─'.repeat(boxWidth - 2) + '╮'));
        console.log(chalk.hex('#555')('  │ ') + agentIcons + ' '.repeat(Math.max(0, boxWidth - 14 - allAgents.length * 12)) + chalk.hex('#555')(' │'));
        console.log(chalk.hex('#555')('  │ ') + statusLine + ' '.repeat(Math.max(0, boxWidth - 14 - 40)) + chalk.hex('#555')(' │'));
        console.log(chalk.hex('#555')('  ╰' + '─'.repeat(boxWidth - 2) + '╯\n'));

        emitKeypressEvents(process.stdin);
        if (process.stdin.isTTY) process.stdin.setRawMode(true);
        process.stdin.on('keypress', (ch, key) => {
            if (this.busy) {
                if (key && key.name === 'escape' && this.busyAgentId) {
                    console.log(chalk.red(`\n  🛑 Cancelling ${this.busyAgentId}…`));
                    this.spawner.kill(this.busyAgentId);
                }
                return;
            }
            this.handleKeypress(ch, key);
        });

        this.startCloudKitchen(false).then(() => {
            if (process.env.SOUPZ_ENABLE_FREE_TUNNELS === '1' || process.env.SOUPZ_AUTO_TUNNEL === '1') {
                this.startTunnel(true).catch(() => {});
            }
        });

        this._pollDashboardOrders();
        this.renderPrompt();
    }

    _pollDashboardOrders() {
        if (!this.kitchenMonitor) return;
        try {
            const order = this.kitchenMonitor.getNextPendingOrder();
            if (order && !this.busy) {
                console.log(chalk.hex('#A855F7')(`\n  📺 Received Order #${order.id.slice(0,8)} from Dashboard…`));
                this.busy = true;
                this.handleInput(order.prompt).then(() => {
                    this.kitchenMonitor.completeOrder(order.id);
                    this.busy = false;
                    this.renderPrompt();
                });
            }
        } catch {}
        setTimeout(() => this._pollDashboardOrders(), 5000);
    }

    colorizeInput(buf) {
        if (!buf) return '';
        if (buf.startsWith('/')) {
            const sp = buf.indexOf(' ');
            return chalk.bold.hex('#06B6D4')(sp > 0 ? buf.slice(0, sp) : buf) + (sp > 0 ? buf.slice(sp) : '');
        }
        if (buf.startsWith('@')) {
            const sp = buf.indexOf(' ');
            return chalk.bold.hex('#FFD93D')(sp > 0 ? buf.slice(0, sp) : buf) + (sp > 0 ? buf.slice(sp) : '');
        }
        if (buf.startsWith('#')) {
            const sp = buf.indexOf(' ');
            return chalk.bold.hex('#FF6B6B')(sp > 0 ? buf.slice(0, sp) : buf) + (sp > 0 ? buf.slice(sp) : '');
        }
        return buf;
    }

    async handleInput(input, saveHistory = true) {
        if (!input) return;
        this.totalPromptsSent++;
        if (input.startsWith('/')) {
            if (input === '/help' || input === '?') { this.showHelp(); return; }
            if (input === '/kitchen' || input === '/stations') { this.showToolAgents(); return; }
            if (input === '/chefs' || input === '/agents') { this.showPersonas(); return; }
            
            if (input === '/station' || input === '/tool' || input === '/tools') { this.inputBuffer = '/station '; this.resetPromptState(); this.renderPrompt(); this.buildDropdown(); return; }
            if (input.startsWith('/station ') || input.startsWith('/tool ')) { this.switchTool(input.split(' ')[1]); return; }
            
            if (input === '/utensil' || input === '/model') { this.inputBuffer = '/utensil '; this.resetPromptState(); this.renderPrompt(); this.buildDropdown(); return; }
            if (input.startsWith('/utensil ') || input.startsWith('/model ')) { this.handleModel(input); return; }
            
            if (input === '/auto') { this.switchTool('auto'); return; }
            
            if (input === '/chain') { console.log(chalk.dim('  Usage: /chain designer→researcher "your prompt"')); return; }
            if (input.startsWith('/chain ')) { await this.handleChain(input.slice(7)); return; }
            
            if (input === '/delegate') { console.log(chalk.dim('  Usage: /delegate <agent> "prompt"')); return; }
            if (input.startsWith('/delegate ')) { await this.handleDelegateCmd(input.slice(10)); return; }
            
            if (input === '/parallel') { console.log(chalk.dim('  Usage: /parallel agent1 agent2 agent3 "shared prompt"')); return; }
            if (input.startsWith('/parallel ')) { await this.handleParallel(input.slice(10)); return; }
            if (input.startsWith('/fleet peek ')) { this.peekFleetWorker(input.slice(12).trim()); return; }
            if (input.startsWith('/fleet result ')) { this.showFleetRunResult(input.slice(14).trim()); return; }
            if (input === '/fleet result') { this.showFleetRunResult(); return; }
            if (input === '/fleet runs') { this.listFleetRuns(); return; }
            if (input.startsWith('/fleet ')) { await this.spawnFleet(input.slice(7)); return; }
            if (input === '/fleet') { this.showFleetStatus(); return; }
            if (input === '/subagent') { console.log(chalk.dim('  Usage: /subagent <command> <id> "prompt"')); return; }
            if (input.startsWith('/subagent ')) { await this.runSubAgents(input.slice(10)); return; }
            
            if (input === '/team') { console.log(chalk.dim('  Usage: /team "goal"')); return; }
            if (input.startsWith('/team ')) { await this.runAgentTeam(input.slice(6)); return; }
            
            if (input.startsWith('/svgart')) { await this.handleSvgArt(input); return; }
            if (input.startsWith('/hackathon')) { await this.handleHackathon(input); return; }
            if (input === '/spill' || input === '/yolo') { this.toggleYolo(); return; }
            if (input.startsWith('/browse')) { await this.browseLocalhost(input); return; }
            if (input === '/todo') { this.showTodo(); return; }
            
            if (input === '/do') { this.showTodo(); return; }
            if (input.startsWith('/do ')) { await this.executeTodo(input.slice(4).trim()); return; }
            
            if (input === '/tokens') { this.showTokens(); return; }
            if (input === '/costs') { this.showCosts(); return; }
            if (input === '/grades') { this.showGrades(); return; }
            if (input.startsWith('/rename ')) { this.sessionName = input.slice(8).trim(); this.saveSession(); return; }
            if (input === '/sessions') { this.listSessions(); return; }
            if (input.startsWith('/load ')) { this.loadSession(input.slice(6).trim()); return; }
            if (input === '/clear') { this.context.clear(); this.conversationLog = []; console.log(chalk.dim('  🧹 Counter cleared.')); return; }
            if (input === '/sandbox') { this.toggleSandbox(); return; }
            if (input === '/cloud-kitchen') { await this.startCloudKitchen(); return; }
            if (input === '/tunnel') { await this.startTunnel(); return; }
            if (input === '/dashboard') { this.openDashboard(); return; }
            if (input === '/pantry' || input === '/stock') { this.showPantry(); return; }
            if (input.startsWith('/stock store ')) { this.pantryStore(input.slice(13).trim()); return; }
            if (input.startsWith('/stock recall ')) { this.pantryRecall(input.slice(14).trim()); return; }
            if (input.startsWith('/pantry max ')) { this.setPantryMax(input.slice(12).trim()); return; }
            if (input === '/memory') { this.showMemory(); return; }
            if (input.startsWith('/compress')) { this.handleCompress(input); return; }
            if (input === '/health') { await this.showHealth(); return; }
            
            if (input === '/recipe' || input === '/recipe list') { this.showRecipes(); return; }
            if (input.startsWith('/recipe ')) { await this.runRecipe(input.slice(8).trim()); return; }
            
            if (input === '/skills') { this.showSkills(); return; }
            
            if (input === '/login' || input === '/logout') { console.log(chalk.dim(`  Usage: /${input.slice(1)} <agent-id>`)); return; }
            if (input.startsWith('/login ')) { this.loginAgent(input.slice(7).trim()); return; }
            if (input.startsWith('/logout ')) { this.logoutAgent(input.slice(8).trim()); return; }
            
            if (input === '/user') { await this.handleUserAuth(input); return; }
            if (input.startsWith('/user ')) { await this.handleUserAuth(input); return; }
            if (input.startsWith('/mcp')) { await this.handleMcp(input); return; }
            if (input === '/setup-multiline') { await this.setupMultilineKeybinding(); return; }
            if (input === '/version') { this.showVersion(); return; }
            if (input === '/quit' || input === '/exit') { this.exitSession(); return; }
            console.log(chalk.red(`  Unknown command: ${input.split(' ')[0]}. /help`));
            return;
        }

        if (input.startsWith('@')) {
            const sp = input.indexOf(' ');
            const personaId = sp > 0 ? input.slice(1, sp) : input.slice(1);
            const prompt = sp > 0 ? input.slice(sp + 1) : '';
            if (personaId === 'auto') { await this.autoRoute(prompt); return; }
            await this.runPersona(personaId, prompt);
            return;
        }

        if (this.looksLikeTaskList(input)) {
            const choice = await this.askConfirmation('This looks like a multi-step task list. Auto-break into todos?');
            if (choice === 'Yes') { this.generateTodo(input); return; }
        }

        const toolId = this.activeTool || this.pickBestTool(input);
        const tool = this.registry.get(toolId);
        
        let printModel = this.activeModel;
        if (!this.activeTool) printModel = this.modelPrefs[toolId] || null;

        console.log(chalk.hex(tool?.color || '#888')(`  ${tool?.icon || '○'} ${toolId}`) + (printModel ? chalk.dim(` (${printModel})`) : ''));
        this.startSpinner(toolId);
        this.pushToLog({ role: 'user', text: input, ts: Date.now() });
        try {
            const result = await this.orchestrator.runOn(toolId, input, this.cwd);
            await this.processDelegations(result, 'user');
        } catch (err) { console.log(chalk.red(`  ✖ ${err.message}`)); }
        this.stopSpinner();
    }

    pickBestTool(prompt) {
        const available = this.registry.headless().filter(a => a.available);
        if (available.length === 0) return null;
        const lower = prompt.toLowerCase();
        const has = (id) => !!available.find(a => a.id === id);

        const geminiSignals = /\b(ui|design|frontend|css|html|visual|style|color|animation|svg|image|icon|logo|illustration|landing|page|component|react|tailwind|research|analyze|compare|summarize)\b/i;
        const codexSignals = /\b(refactor|architecture|module|implementation|bug|fix|debug|typescript|javascript|python|codebase)\b/i;
        const copilotSignals = /\b(github|pull request|pr|issue|merge|commit|branch|workflow|actions|terminal|shell|cli|command|devops)\b/i;

        if (geminiSignals.test(lower) && has('gemini')) return 'gemini';
        if (codexSignals.test(lower) && has('codex')) return 'codex';
        if (copilotSignals.test(lower) && has('copilot')) return 'copilot';

        if (has('gemini')) return 'gemini';
        if (has('codex')) return 'codex';
        if (has('copilot')) return 'copilot';
        return available[0].id;
    }

    pickDiverseTools(count) {
        const available = this.registry.headless().filter(a => a.available).map(a => a.id);
        if (!available.length) return [];
        const result = [];
        for (let i = 0; i < count; i++) result.push(available[i % available.length]);
        return result;
    }

    switchTool(id) {
        if (id === 'auto') { this.activeTool = null; this.activeModel = null; console.log(chalk.hex('#4ECDC4')('  🎯 AUTO KITCHEN — head chef decides')); return; }
        const a = this.registry.get(id);
        if (!a || a.type === 'persona') { console.log(chalk.red(`  Unknown kitchen: ${id}. /agents`)); return; }
        this.activeTool = id;
        // Restore saved model preference for this tool
        const savedModel = this.modelPrefs[id];
        if (savedModel) {
            this.activeModel = savedModel;
            console.log(chalk.hex(a.color)(`  ${a.icon} Kitchen: ${a.name}`) + chalk.dim(` (utensil: ${savedModel})`));
        } else {
            this.activeModel = null;
            console.log(chalk.hex(a.color)(`  ${a.icon} Kitchen: ${a.name}`));
        }
        console.log(chalk.dim(`    ${this.getPersonas().length} chefs ready. /model to pick utensil. /auto for best kitchen.`));
    }

    async processDelegations(output, sourcePersonaId) {
        if (!output) return;
        const delegatePattern = /@DELEGATE\[([^\]]+)\]:\s*(.+?)(?=\n@DELEGATE|\n\n|$)/gms;
        const matches = [...output.matchAll(delegatePattern)];
        if (!matches.length) return;
        
        const tools = this.pickDiverseTools(matches.length);
        if (!tools.length) { console.log(chalk.red('  No kitchen open for delegation — install gh (Copilot) or gemini')); return; }
        
        console.log(chalk.hex('#A855F7')(`\n  ⚡ ${matches.length} delegation(s) from @${sourcePersonaId} — running in PARALLEL`));
        
        // Resolve agents (create dynamic personas for unknowns)
        const tasks = await Promise.all(matches.map(async ([, agentId, delegatePrompt], i) => {
            let targetPersona = this.registry.get(agentId.trim());
            if (!targetPersona) {
                // Dynamically create a persona for unknown agents
                if (typeof this.createDynamicPersona === 'function') {
                    targetPersona = await this.createDynamicPersona(agentId.trim());
                }
                if (!targetPersona) return null;
            }
            const toolId = tools[i];
            const sysPrompt = targetPersona.type === 'persona' ? (targetPersona.system_prompt || targetPersona.body || '') : '';
            const fullPrompt = sysPrompt ? `${sysPrompt}\n\nUser: ${delegatePrompt.trim()}` : delegatePrompt.trim();
            return { agentId: agentId.trim(), toolId, fullPrompt, persona: targetPersona, delegatePrompt: delegatePrompt.trim() };
        }));
        
        const valid = tasks.filter(Boolean);
        
        // Print what's about to happen
        for (const t of valid) {
            const tAgent = this.registry.get(t.toolId);
            console.log(chalk.hex('#4ECDC4')(`  📤 @${t.agentId} ${t.persona.icon || ''} → ${tAgent?.icon || '○'} ${t.toolId}`));
            console.log(chalk.dim(`     "${t.delegatePrompt.slice(0, 70)}${t.delegatePrompt.length > 70 ? '…' : ''}"`));
        }
        console.log(chalk.dim(`\n  ─── Parallel execution start ─────────────────────────────`));
        
        // Run all in parallel
        const results = await Promise.allSettled(
            valid.map(t => this.orchestrator.runOn(t.toolId, t.fullPrompt, this.cwd))
        );
        
        let successCount = 0;
        let failCount = 0;
        for (let i = 0; i < results.length; i++) {
            const r = results[i];
            const t = valid[i];
            if (r.status === 'fulfilled') {
                successCount++;
                console.log(chalk.hex('#A855F7')(`\n  ✅ @${t.agentId} completed delegation:`));
                console.log(chalk.gray(r.value));
            } else {
                failCount++;
                console.log(chalk.red(`\n  ❌ @${t.agentId} failed delegation:`));
                console.log(chalk.red(r.reason));
            }
        }
        console.log(chalk.hex('#A855F7')(`\n  ⚡ Delegations finished. ${successCount} succeeded, ${failCount} failed.`));
    }
}

Object.assign(Session.prototype, CommandsMixin, MemoryMixin, FleetMixin, UIMixin, CloudMixin, AuthMixin, TodoMixin, UtilsMixin);
