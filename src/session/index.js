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
const GEMINI_MODELS = [
    { id: 'gemini-2.5-flash', desc: '0.1x (FAST)', cost: 0.1 },
    { id: 'gemini-2.5-pro', desc: '1x (SMART)', cost: 1 }
];
const COPILOT_MODELS = [
    { id: 'gpt-5.1-codex', desc: '1x', cost: 1 },
    { id: 'gpt-4.1-mini', desc: '0x (FREE)', cost: 0 }
];
const OLLAMA_MODELS = [
    { id: 'llama3.1:8b', desc: 'Meta 8B model' },
    { id: 'qwen2.5-coder:7b', desc: 'Alibaba coder 7B' },
    { id: 'phi3:3.8b', desc: 'Microsoft 3.8B model' }
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
    }

    _applyModelPrefs() {
        if (!this.modelPrefs) return;
        const copilotModel = this.modelPrefs.copilot || this.modelPrefs.auto;
        if (copilotModel) {
            const c = this.registry.get('copilot');
            if (c) {
                c.build_args = ['copilot', '-p', '{prompt}', '--model', copilotModel, ...(this.yolo ? ['--allow-all-tools'] : [])];
                this.activeModel = copilotModel;
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
            if (input.startsWith('/station ') || input.startsWith('/tool ')) { this.switchTool(input.split(' ')[1]); return; }
            if (input.startsWith('/utensil ') || input.startsWith('/model ')) { this.handleModel(input); return; }
            if (input === '/auto') { this.switchTool('auto'); return; }
            if (input.startsWith('/chain ')) { await this.handleChain(input.slice(7)); return; }
            if (input.startsWith('/delegate ')) { await this.handleDelegateCmd(input.slice(10)); return; }
            if (input.startsWith('/parallel ')) { await this.handleParallel(input.slice(10)); return; }
            if (input.startsWith('/fleet ')) { await this.spawnFleet(input.slice(7)); return; }
            if (input === '/fleet') { this.showFleetStatus(); return; }
            if (input.startsWith('/fleet peek ')) { this.peekFleetWorker(input.slice(12).trim()); return; }
            if (input.startsWith('/subagent ')) { await this.runSubAgents(input.slice(10)); return; }
            if (input.startsWith('/team ')) { await this.runAgentTeam(input.slice(6)); return; }
            if (input.startsWith('/svgart')) { await this.handleSvgArt(input); return; }
            if (input.startsWith('/hackathon')) { await this.handleHackathon(input); return; }
            if (input === '/spill' || input === '/yolo') { this.toggleYolo(); return; }
            if (input.startsWith('/browse')) { await this.browseLocalhost(input); return; }
            if (input === '/todo') { this.showTodo(); return; }
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
            if (input.startsWith('/recipe ')) { await this.runRecipe(input.slice(8).trim()); return; }
            if (input === '/skills') { this.showSkills(); return; }
            if (input.startsWith('/login ')) { this.loginAgent(input.slice(7).trim()); return; }
            if (input.startsWith('/logout ')) { this.logoutAgent(input.slice(8).trim()); return; }
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
        console.log(chalk.hex(tool?.color || '#888')(`  ${tool?.icon || '○'} ${toolId}`) + (this.activeModel ? chalk.dim(` (${this.activeModel})`) : ''));
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
        const geminiSignals = /\b(ui|design|frontend|css|html|visual|style|color|animation|svg|image|icon|logo|illustration|landing|page|component|react|tailwind)\b/i;
        if (geminiSignals.test(lower) && available.find(a => a.id === 'gemini')) return 'gemini';
        return available.find(a => a.id === 'copilot') ? 'copilot' : available[0].id;
    }

    pickDiverseTools(count) {
        const available = this.registry.headless().filter(a => a.available).map(a => a.id);
        if (!available.length) return [];
        const result = [];
        for (let i = 0; i < count; i++) result.push(available[i % available.length]);
        return result;
    }
}

Object.assign(Session.prototype, MemoryMixin, FleetMixin, UIMixin, CloudMixin, AuthMixin, TodoMixin, UtilsMixin);
