import chalk from 'chalk';
import { emitKeypressEvents } from 'readline';
import { homedir } from 'os';
import { join, resolve } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { ContextShards } from './core/context-shards.js';
import { CostTracker } from './core/cost-tracker.js';
import { ColoredOutput } from './core/colored-output.js';
import { getSkills } from './skills.js';

// ─── Fun vibes ──────────────────────────────────────────────────────────────
const VIBES = [
    '🍳 cooking up some magic…', '☕ brewing intelligence…', '🧪 mixing the perfect formula…',
    '🚀 locked in. let\'s build.', '💅 slay mode activated.', '🔥 it\'s giving productivity.',
    '🧠 big brain energy loading…', '⚡ no cap, about to go crazy.',
    '🎯 main character energy.', '✨ vibes: immaculate.',
    '🫡 at your service, boss.', '💻 built different.',
];
const BYES = ['✌️ peace out!', '👋 later!', '🫡 until next time, boss.', '🔥 that was fire. see ya.', '💤 zzz…'];

// ─── Centered, bigger banner ────────────────────────────────────────────────
const BANNER = `
${chalk.hex('#6C63FF')('       ███████╗ ')}${chalk.hex('#A855F7')(' ██████╗ ')}${chalk.hex('#06B6D4')(' ██╗   ██╗')}${chalk.hex('#4ECDC4')(' ██████╗ ')}${chalk.hex('#6BCB77')(' ███████╗')}
${chalk.hex('#6C63FF')('       ██╔════╝ ')}${chalk.hex('#A855F7')('██╔═══██╗')}${chalk.hex('#06B6D4')(' ██║   ██║')}${chalk.hex('#4ECDC4')(' ██╔══██╗')}${chalk.hex('#6BCB77')(' ╚══███╔╝')}
${chalk.hex('#6C63FF')('       ███████╗ ')}${chalk.hex('#A855F7')('██║   ██║')}${chalk.hex('#06B6D4')(' ██║   ██║')}${chalk.hex('#4ECDC4')(' ██████╔╝')}${chalk.hex('#6BCB77')('   ███╔╝ ')}
${chalk.hex('#6C63FF')('       ╚════██║ ')}${chalk.hex('#A855F7')('██║   ██║')}${chalk.hex('#06B6D4')(' ██║   ██║')}${chalk.hex('#4ECDC4')(' ██╔═══╝ ')}${chalk.hex('#6BCB77')('  ███╔╝  ')}
${chalk.hex('#6C63FF')('       ███████║ ')}${chalk.hex('#A855F7')('╚██████╔╝')}${chalk.hex('#06B6D4')(' ╚██████╔╝')}${chalk.hex('#4ECDC4')(' ██║     ')}${chalk.hex('#6BCB77')(' ███████╗')}
${chalk.hex('#6C63FF')('       ╚══════╝ ')}${chalk.hex('#A855F7')(' ╚═════╝ ')}${chalk.hex('#06B6D4')('  ╚═════╝ ')}${chalk.hex('#4ECDC4')(' ╚═╝     ')}${chalk.hex('#6BCB77')(' ╚══════╝')}
                    ${chalk.bold.hex('#4ECDC4')('S  T  A  L  L')}  ${chalk.dim('v2.5.0')}
`;

const HR = chalk.hex('#444')('━'.repeat(65));

const COMMANDS = [
    { cmd: '/help', desc: 'Show all commands', icon: '❓' },
    { cmd: '/agents', desc: 'List kitchen (tool agents)', icon: '🔧' },
    { cmd: '/personas', desc: 'List all chefs', icon: '👨‍🍳' },
    { cmd: '/chefs', desc: 'List all chefs (alias)', icon: '👨‍🍳' },
    { cmd: '/chain', desc: 'Chain agents: /chain designer→researcher "prompt"', icon: '🔗' },
    { cmd: '/delegate', desc: 'Delegate to agent: /delegate designer "prompt"', icon: '📤' },
    { cmd: '/parallel', desc: 'Run agents in parallel: /parallel a b c "prompt"', icon: '⚡' },
    { cmd: '/tool', desc: 'Switch tool agent', icon: '🔀' },
    { cmd: '/model', desc: 'Switch AI model', icon: '🧠' },
    { cmd: '/auto', desc: 'Full auto mode', icon: '🎯' },
    { cmd: '/yolo', desc: 'Toggle YOLO mode', icon: '🔥' },
    { cmd: '/browse', desc: 'Screenshot localhost', icon: '🌐' },
    { cmd: '/todo', desc: 'Show task list', icon: '📋' },
    { cmd: '/do', desc: 'Execute a todo (e.g. /do 1)', icon: '▶️' },
    { cmd: '/tokens', desc: 'Token usage stats', icon: '📊' },
    { cmd: '/costs', desc: 'Cost tracking (NEW)', icon: '💰' },
    { cmd: '/grades', desc: 'Report cards per tool', icon: '🏆' },
    { cmd: '/sandbox', desc: 'Toggle ~/Developer lock', icon: '🔒' },
    { cmd: '/clear', desc: 'Clear context window', icon: '🧹' },
    { cmd: '/rename', desc: 'Name this session', icon: '💾' },
    { cmd: '/sessions', desc: 'List saved sessions', icon: '📂' },
    { cmd: '/load', desc: 'Load a saved session', icon: '📥' },
    { cmd: '/login', desc: 'Login to agent', icon: '🔑' },
    { cmd: '/logout', desc: 'Logout from agent', icon: '🚪' },
    { cmd: '/shards', desc: 'Memory shards status', icon: '🧩' },
    { cmd: '/shard', desc: 'Store/recall from shards', icon: '💾' },
    { cmd: '/memory', desc: 'Memory stats', icon: '🧠' },
    { cmd: '/compress', desc: 'Compress context', icon: '📦' },
    { cmd: '/skills', desc: 'List all available skills', icon: '🧰' },
    { cmd: '/quit', desc: 'Close the stall', icon: '👋' },
];

const GEMINI_MODELS = [
    { id: 'gemini-2.5-pro', desc: 'Most capable' },
    { id: 'gemini-2.5-flash', desc: 'Fast + smart' },
    { id: 'gemini-2.0-flash', desc: 'Previous gen' },
    { id: 'gemini-2.0-flash-lite', desc: 'Lightweight' },
];

const COPILOT_MODELS = [
    { id: 'GPT-5 mini', desc: '0x (FREE - use for redundant tasks)', priority: 'high' },
    { id: 'Claude Sonnet 4.6 (default)', desc: '1x' },
    { id: 'Claude Haiku 4.5', desc: '0.33x' },
    { id: 'GPT-5.1-Codex-Mini (Preview)', desc: '0.33x' },
    { id: 'Claude Opus 4.6', desc: '3x' },
    { id: 'Claude Opus 4.6 (fast mode) (Preview)', desc: '30x' },
    { id: 'Claude Opus 4.5', desc: '3x' },
    { id: 'Claude Sonnet 4', desc: '1x' },
    { id: 'Gemini 3 Pro (Preview)', desc: '1x' },
    { id: 'GPT-5.3-Codex', desc: '1x' },
    { id: 'GPT-5.2-Codex', desc: '1x' },
    { id: 'GPT-5.2', desc: '1x' },
    { id: 'GPT-5.1-Codex-Max', desc: '1x' },
    { id: 'GPT-5.1-Codex', desc: '1x' },
    { id: 'GPT-5.1', desc: '1x' },
    { id: 'GPT-4.1', desc: '0x' }
];

const OLLAMA_MODELS = [
    { id: 'llama3.1:8b', desc: 'Meta 8B model' },
    { id: 'qwen2.5-coder:7b', desc: 'Alibaba coder 7B' },
    { id: 'deepseek-r1:7b', desc: 'DeepSeek distilled' },
];

const SESSIONS_DIR = join(homedir(), '.soupz-agents', 'sessions');

export class Session {
    constructor({ registry, spawner, orchestrator, contextManager, memory, grading, auth, cwd }) {
        this.registry = registry;
        this.spawner = spawner;
        this.orchestrator = orchestrator;
        this.context = contextManager;
        this.memory = memory;
        this.grading = grading;
        this.auth = auth;
        this.costTracker = new CostTracker();
        this.output = ColoredOutput;
        this.cwd = cwd;
        this.activeTool = null;
        this.activeModel = null;
        this.yolo = false;
        this.sandbox = true;
        this.sessionName = null;
        this.activePersonas = [];
        this.inputBuffer = '';
        this.dropdownItems = [];
        this.dropdownIndex = -1;
        this.dropdownVisible = false;
        this.dropdownScroll = 0; // viewport scroll offset for dropdown
        this.busy = false;
        this.busyAgentId = null; // track which agent is running for Escape cancel
        this.agentTokens = {};
        this.sessionStart = Date.now();
        this.totalPromptsSent = 0; // track prompts sent
        this.todoList = [];
        this.conversationLog = [];
        this.shards = new ContextShards();
        this.shards.init();
        this.modelPrefs = this.loadModelPrefs();
    }

    loadModelPrefs() {
        const p = join(homedir(), '.soupz-agents', 'model-prefs.json');
        try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return {}; }
    }
    saveModelPrefs() {
        const p = join(homedir(), '.soupz-agents', 'model-prefs.json');
        writeFileSync(p, JSON.stringify(this.modelPrefs, null, 2));
    }

    getTools() { return this.registry.list().filter((a) => a.type !== 'persona' && a.headless && a.available); }
    getAllAgents() { return this.registry.list().filter((a) => a.type !== 'persona' && a.available); }
    getPersonas() { return this.registry.list().filter((a) => a.type === 'persona'); }
    getAgentTokens(id) {
        if (!this.agentTokens[id]) this.agentTokens[id] = { in: 0, out: 0, prompts: 0, apiTimeMs: 0 };
        return this.agentTokens[id];
    }
    pickBestTool(hint) {
        const tools = this.getTools();
        if (!tools.length) return null;
        if (tools.length === 1) return tools[0].id;
        let best = tools[0], bestScore = 0;
        for (const t of tools) {
            let score = t.grade || 50;
            const kw = (t.routing_keywords || []).join(' ').toLowerCase();
            for (const w of (hint || '').toLowerCase().split(/\s+/)) { if (kw.includes(w)) score += 15; }
            if (score > bestScore) { bestScore = score; best = t; }
        }
        return best.id;
    }

    /** Distribute N tasks across available tools — cycles through copilot/gemini/kiro
     *  so parallel tasks run on different engines simultaneously */
    pickDiverseTools(count) {
        const tools = this.getTools();
        if (!tools.length) return [];
        // If locked to one tool, repeat it (parallel on same tool — still works via separate spawns)
        if (this.activeTool) return Array(count).fill(this.activeTool);
        // Round-robin across available tools
        return Array.from({ length: count }, (_, i) => tools[i % tools.length].id);
    }

    start() {
        console.log(BANNER);
        console.log(chalk.hex('#A855F7')(`               ${VIBES[Math.floor(Math.random() * VIBES.length)]}\n`));

        // ── Dynamic status bar based on terminal width ──
        const termWidth = process.stdout.columns || 80;
        const allAgents = this.getAllAgents().filter(a => !['ollama', 'antigravity'].includes(a.id)); // Hide ollama & antigravity
        const personas = this.getPersonas();
        
        // Build agent line
        const agentIcons = allAgents.map((t) => chalk.hex(t.color || '#888')(`${t.icon} ${t.id}`)).join(chalk.hex('#555')('  '));
        const statusLine = chalk.hex('#FFD93D')(`${personas.length} chefs`) + chalk.hex('#555')(' · ') + 
                          chalk.hex('#6BCB77')('sandbox') + chalk.hex('#555')(' · ') + 
                          chalk.hex('#4ECDC4')('Tab') + chalk.dim(' complete') + chalk.hex('#555')(' · ') + 
                          chalk.hex('#FFD93D')('↑↓') + chalk.dim(' nav') + chalk.hex('#555')(' · ') + 
                          chalk.hex('#4ECDC4')('/help');
        
        // Calculate visible width (strip ANSI codes)
        const stripAnsi = (str) => str.replace(/\x1b\[[0-9;]*m/g, '');
        const agentLineLen = stripAnsi(agentIcons).length;
        const statusLineLen = stripAnsi(statusLine).length;
        const maxLen = Math.max(agentLineLen, statusLineLen);
        
        // Box width with padding
        const boxWidth = maxLen + 6; // 6 = "│  " (3) + "  │" (3)
        
        // Top border
        console.log(chalk.hex('#555')('  ╭' + '─'.repeat(boxWidth - 2) + '╮'));
        
        // Agent line
        const agentPad = ' '.repeat(boxWidth - 4 - agentLineLen);
        console.log(chalk.hex('#555')('  │  ') + agentIcons + agentPad + chalk.hex('#555')('  │'));
        
        // Status line
        const statusPad = ' '.repeat(boxWidth - 4 - statusLineLen);
        console.log(chalk.hex('#555')('  │  ') + statusLine + statusPad + chalk.hex('#555')('  │'));
        
        // Bottom border
        console.log(chalk.hex('#555')('  ╰' + '─'.repeat(boxWidth - 2) + '╯'));
        console.log();
        console.log(); // bottom padding

        // Wire events
        this.spinnerTimer = null;
        this.spinnerFrame = 0;
        const spinChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

        this.spawner.on('output', (agentId, parsed) => {
            if (parsed?.text) {
                // Stop spinner on first output
                this.stopSpinner();
                const a = this.registry.get(agentId);
                this.getAgentTokens(agentId).out += Math.ceil(parsed.text.length / 4);
                this.conversationLog.push({ role: 'assistant', agent: agentId, text: parsed.text, ts: Date.now() });
                // Filter out Copilot verbose usage stats logging
                // For instance, "Total usage est:" or "API time spent:" or mock AI models usage.
                const filteredLines = parsed.text.split('\n').filter((l) => {
                    const text = l.trim();
                    if (!text) return true;
                    if (text.match(/Total usage est:|API time spent:|Total session time:|Total code changes:|Breakdown by AI model:/i)) return false;
                    if (text.match(/^[ \t│\|└L_]+(gpt-|claude-|o3-|gemini-|llama|deepseek|qwen)/i)) return false;
                    return true;
                });

                let firstLinePrinted = false;
                for (let i = 0; i < filteredLines.length; i++) {
                    const line = filteredLines[i];
                    if (!firstLinePrinted && line.trim()) {
                        process.stdout.write('\n' + chalk.hex(a?.color || '#888')(`  ${a?.icon || '○'} `) + line + '\n');
                        firstLinePrinted = true;
                    } else if (line.trim()) {
                        process.stdout.write(chalk.hex('#555')('  ⎿ ') + line + '\n');
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
                // Don't call renderPrompt() here - it's called by the keypress handler's .then()
            }
            if (newState === 'error') {
                this.stopSpinner();
                this.grading?.recordResult(agentId, false, 0);
                this.removeActivePersona(agentId);
                console.log(chalk.red('\n  ✖ Error'));
                console.log(); // Add an extra empty line as gap before prompt
                // Don't call renderPrompt() here - it's called by the keypress handler's .catch()
            }
        });
        this.orchestrator.on('route', (info) => console.log(chalk.hex('#FFD93D')(`  🎯 ${info.reason}`)));

        // Raw mode
        if (process.stdin.isTTY) process.stdin.setRawMode(true);
        process.stdin.resume();
        emitKeypressEvents(process.stdin);
        this.renderPrompt();
        process.stdin.on('keypress', (ch, key) => {
            // Allow Escape even when busy (to cancel)
            if (this.busy) {
                if (key && key.name === 'escape') {
                    // Cancel running request
                    this.stopSpinner();
                    if (this.busyAgentId) this.spawner.kill?.(this.busyAgentId);
                    console.log(chalk.hex('#FF6B6B')('\n  ⎋ Cancelled'));
                    this.busy = false;
                    this.busyAgentId = null;
                    this.resetPromptState();
                    this.renderPrompt();
                }
                return;
            }
            this.handleKeypress(ch, key);
        });
    }

    // ── Prompt (clean 2-line: status + input) ──────────────────────────────────
    getPromptPrefix() {
        // No longer used directly — see renderPrompt()
        return chalk.bold.hex('#6C63FF')('❯') + ' ';
    }

    /** Colorize the input buffer for display (slash cmds in cyan, @mentions in gold, #files in coral) */
    colorizeInput(buf) {
        if (!buf) return '';
        if (buf.startsWith('/')) {
            const sp = buf.indexOf(' ');
            const cmd = sp > 0 ? buf.slice(0, sp) : buf;
            const rest = sp > 0 ? buf.slice(sp) : '';
            return chalk.bold.hex('#06B6D4')(cmd) + rest;
        }
        if (buf.startsWith('@')) {
            const sp = buf.indexOf(' ');
            const cmd = sp > 0 ? buf.slice(0, sp) : buf;
            const rest = sp > 0 ? buf.slice(sp) : '';
            return chalk.bold.hex('#FFD93D')(cmd) + rest;
        }
        if (buf.startsWith('#')) {
            const sp = buf.indexOf(' ');
            const cmd = sp > 0 ? buf.slice(0, sp) : buf;
            const rest = sp > 0 ? buf.slice(sp) : '';
            return chalk.bold.hex('#FF6B6B')(cmd) + rest;
        }
        return buf;
    }

    renderPrompt() {
        const cwdShort = this.cwd.replace(homedir(), '~');
        const toolColor = this.activeTool
            ? this.registry.get(this.activeTool)?.color || '#FFF'
            : '#4ECDC4';
        const toolPart = chalk.hex(toolColor)(this.activeTool || 'auto');
        const modelPart = this.activeModel ? chalk.dim(` · ${this.activeModel}`) : '';
        const yoloPart = this.yolo ? chalk.hex('#FF6B6B')(' 🔥') : '';
        const sessPart = this.sessionName ? chalk.dim(` [${this.sessionName}]`) : '';
        const promptCount = this.totalPromptsSent;
        const msgCount = this.conversationLog.length;

        // Line 1: status — cwd  tool·model  msgs  /help
        const statusLine = chalk.hex('#666')(cwdShort) + '  ' + toolPart + modelPart + yoloPart + sessPart
            + chalk.hex('#555')('  ·  ')
            + chalk.dim(`${msgCount} msgs · ${promptCount} sent`);

        // Line 2: ❯ input (with colorized commands)
        const displayBuf = this.colorizeInput(this.inputBuffer);

        // Calculate how many physical lines the prompt is currently taking on screen
        if (this._prompted) {
            const cols = process.stdout.columns || 80;
            const rows = ('❯ ' + (this._lastPromptBuf || '')).split('\n');
            let lines = 1; // 1 line for the status line above
            for (const r of rows) {
                // Determine how many lines this row wraps to (if it's long)
                lines += Math.max(1, Math.ceil(r.length / cols));
            }
            const moveUp = lines - 1; // Cursor is on the last line, so move up height-1
            if (moveUp > 0) process.stdout.write(`\x1b[${moveUp}A`);

            // Clear from cursor position down to end of screen (includes leftover wrapped text / dropdowns)
            process.stdout.write('\r\x1b[J');
        }

        process.stdout.write('\r\x1b[K' + statusLine + '\n' + chalk.bold.hex('#6C63FF')('❯') + ' ' + displayBuf);
        this._prompted = true;
        this._lastPromptBuf = this.inputBuffer;
    }

    resetPromptState() { this._prompted = false; }

    startSpinner(agentId) {
        this.busyAgentId = agentId;
        const a = this.registry.get(agentId);
        const spinChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        this.spinnerFrame = 0;
        this.spinnerTimer = setInterval(() => {
            const ch = spinChars[this.spinnerFrame % spinChars.length];
            process.stdout.write(`\r\x1b[K  ${chalk.hex('#A855F7')(ch)} ${chalk.hex('#A855F7')('Thinking…')}`);
            this.spinnerFrame++;
        }, 80);
    }
    stopSpinner() {
        if (this.spinnerTimer) { clearInterval(this.spinnerTimer); this.spinnerTimer = null; }
        process.stdout.write('\r\x1b[K');
    }

    // ── Dropdown (sliding viewport — scrolls with selection) ──────────────────
    eraseDropdownLines() {
        if (!this.dropdownVisible) return;
        process.stdout.write('\x1b[s');
        const visCount = Math.min(this.dropdownItems.length, 8);
        const hasTopMore = this.dropdownScroll > 0;
        const hasBottomMore = this.dropdownScroll + 8 < this.dropdownItems.length;
        const totalLines = visCount + (hasTopMore ? 1 : 0) + (hasBottomMore ? 1 : 0);
        for (let i = 0; i < totalLines + 2; i++) process.stdout.write('\x1b[B\x1b[2K');
        process.stdout.write('\x1b[u\x1b[J');
        this.dropdownVisible = false;
    }

    paintDropdown() {
        if (!this.dropdownItems.length) return;
        this.dropdownVisible = true;
        const maxVisible = 8;
        const total = this.dropdownItems.length;

        // Calculate viewport scroll based on selection
        if (this.dropdownIndex < this.dropdownScroll) {
            this.dropdownScroll = this.dropdownIndex;
        } else if (this.dropdownIndex >= this.dropdownScroll + maxVisible) {
            this.dropdownScroll = this.dropdownIndex - maxVisible + 1;
        }
        this.dropdownScroll = Math.max(0, Math.min(this.dropdownScroll, total - maxVisible));
        if (total <= maxVisible) this.dropdownScroll = 0;

        const start = this.dropdownScroll;
        const end = Math.min(start + maxVisible, total);

        // Cursor is on the input line — dropdown goes below it
        process.stdout.write('\x1b[s');

        // Show "↑ N more" if scrolled down
        if (start > 0) {
            process.stdout.write(`\n\x1b[K   ${chalk.dim(`↑ ${start} more`)}`);
        }

        for (let i = start; i < end; i++) {
            const item = this.dropdownItems[i];
            const sel = i === this.dropdownIndex;
            process.stdout.write('\n\x1b[K');
            const pre = sel ? chalk.hex('#6C63FF')(' ▸ ') : '   ';
            const icon = item.icon ? `${item.icon} ` : '';
            const label = sel ? chalk.bold.hex('#FFD93D')(icon + item.label) : chalk.hex('#CCC')(icon + item.label);
            const desc = item.desc ? (sel ? chalk.hex('#AAA')(` — ${item.desc}`) : chalk.hex('#666')(` — ${item.desc}`)) : '';
            process.stdout.write(`${pre}${label}${desc}`);
        }

        // Show "↓ N more" if more below
        if (end < total) {
            process.stdout.write(`\n\x1b[K   ${chalk.dim(`↓ ${total - end} more`)}`);
        }

        process.stdout.write('\x1b[u');
    }

    closeDropdown() { this.eraseDropdownLines(); this.dropdownItems = []; this.dropdownIndex = -1; this.dropdownScroll = 0; }
    refreshDropdown() { this.eraseDropdownLines(); this.paintDropdown(); }

    buildDropdown() {
        const input = this.inputBuffer;
        /** Dedup items by label */
        const dedup = (items) => { const seen = new Set(); return items.filter((i) => { if (seen.has(i.label)) return false; seen.add(i.label); return true; }); };
        // /tool <tab> — show available tools
        if (input.startsWith('/tool ')) {
            const prefix = input.slice(6).toLowerCase();
            const tools = [
                { label: 'auto', desc: 'Smart routing', icon: '🎯', value: '/tool auto' },
                ...this.getTools().map((t) => {
                    const saved = this.modelPrefs[t.id];
                    const desc = saved ? `${t.description || t.name} (model: ${saved})` : (t.description || t.name);
                    return { label: t.id, desc, icon: t.icon, value: `/tool ${t.id}` };
                })
            ].filter((i) => i.label.startsWith(prefix) || !prefix);
            this.dropdownItems = dedup(tools);
            this.dropdownIndex = tools.length > 0 ? 0 : -1;
            this.refreshDropdown();
            return;
        }
        // /model <tab> — show available models
        if (input.startsWith('/model ')) {
            const prefix = input.slice(7).toLowerCase();
            let allModels = [];

            // Gather models based on active tool or show all
            if (!this.activeTool || this.activeTool === 'gemini') {
                allModels.push(...GEMINI_MODELS.map(m => ({ ...m, tool: 'gemini', icon: '🔮' })));
            }
            if (!this.activeTool || this.activeTool === 'copilot') {
                allModels.push(...COPILOT_MODELS.map(m => ({ ...m, tool: 'copilot', icon: '🐙' })));
            }
            if (!this.activeTool || this.activeTool === 'ollama') {
                allModels.push(...OLLAMA_MODELS.map(m => ({ ...m, tool: 'ollama', icon: '🤖' })));
            }

            const models = allModels
                .filter((m) => m.id.startsWith(prefix) || !prefix)
                .map((m) => ({
                    label: m.id, desc: `${m.desc} [${m.tool}]` + (this.activeModel === m.id ? ' ← active' : ''),
                    icon: m.icon, value: `/model ${m.id}`
                }));
            this.dropdownItems = dedup(models);
            this.dropdownIndex = models.length > 0 ? 0 : -1;
            this.refreshDropdown();
            return;
        }
        if (input.startsWith('/')) {
            const prefix = input.toLowerCase();
            this.dropdownItems = dedup(COMMANDS.filter((c) => c.cmd.startsWith(prefix))
                .map((c) => ({ label: c.cmd, desc: c.desc, icon: c.icon, value: c.cmd, type: 'command' })));
            this.dropdownIndex = this.dropdownItems.length > 0 ? 0 : -1;
            this.refreshDropdown();
            return;
        }
        if (input.startsWith('@') && !input.includes(' ')) {
            const prefix = input.toLowerCase();
            const items = [
                { label: '@auto', desc: 'Auto-pick best persona(s)', icon: '🎯', value: '@auto ', type: 'persona' },
                ...this.getPersonas().map((p) => ({
                    label: `@${p.id}`, desc: p.description || p.name, icon: p.icon, value: `@${p.id} `, type: 'persona'
                }))
            ].filter((i) => i.label.startsWith(prefix));
            this.dropdownItems = dedup(items);
            this.dropdownIndex = items.length > 0 ? 0 : -1;
            this.refreshDropdown();
            return;
        }
        // # file references — list files in cwd
        if (input.startsWith('#') && !input.includes(' ')) {
            const prefix = input.slice(1).toLowerCase();
            try {
                const files = readdirSync(this.cwd).filter((f) => !f.startsWith('.')).slice(0, 30);
                const items = files
                    .filter((f) => f.toLowerCase().startsWith(prefix) || !prefix)
                    .map((f) => {
                        let icon = '📄';
                        try { if (statSync(join(this.cwd, f)).isDirectory()) icon = '📁'; } catch { }
                        return { label: `#${f}`, desc: '', icon, value: `#${f} `, type: 'file' };
                    });
                this.dropdownItems = items;
                this.dropdownIndex = items.length > 0 ? 0 : -1;
                this.refreshDropdown();
            } catch { }
            return;
        }
        this.closeDropdown();
    }

    // ── Keypress ──────────────────────────────────────────────────────────────
    handleKeypress(ch, key) {
        if (!key) { if (ch) this.insertChar(ch); return; }
        if (key.ctrl && key.name === 'c') { this.exitSession(); return; }
        if (key.ctrl && key.name === 'l') { this.closeDropdown(); process.stdout.write('\x1b[2J\x1b[H'); this.resetPromptState(); this.renderPrompt(); return; }

        // Ctrl+U: delete entire line (standard unix)
        if (key.ctrl && key.name === 'u') {
            this.closeDropdown(); this.inputBuffer = ''; this.renderPrompt(); return;
        }
        // Ctrl+W: delete previous word (standard unix)
        if (key.ctrl && key.name === 'w') {
            this.closeDropdown();
            this.inputBuffer = this.inputBuffer.replace(/\S+\s*$/, '');
            this.renderPrompt();
            const buf = this.inputBuffer;
            if (buf.startsWith('/') || (buf.startsWith('@') && !buf.includes(' ')) || (buf.startsWith('#') && !buf.includes(' '))) this.buildDropdown();
            return;
        }

        // ↑↓ navigate dropdown
        if (key.name === 'up' && this.dropdownItems.length > 0) {
            this.dropdownIndex = Math.max(0, this.dropdownIndex - 1);
            this.refreshDropdown(); return;
        }
        if (key.name === 'down' && this.dropdownItems.length > 0) {
            this.dropdownIndex = Math.min(this.dropdownItems.length - 1, this.dropdownIndex + 1);
            this.refreshDropdown(); return;
        }

        // Tab on dropdown → fill buffer (for continued typing)
        if (key.name === 'tab' && this.dropdownItems.length > 0 && this.dropdownIndex >= 0) {
            const item = this.dropdownItems[this.dropdownIndex];
            this.closeDropdown();
            this.inputBuffer = item.value;
            this.renderPrompt();
            return;
        }

        // Enter on dropdown → auto-submit command
        if (key.name === 'return' && this.dropdownItems.length > 0 && this.dropdownIndex >= 0) {
            const item = this.dropdownItems[this.dropdownIndex];
            this.closeDropdown();
            this.inputBuffer = '';
            this.resetPromptState();
            process.stdout.write('\n');
            // Don't echo the input again - it's already in the dropdown
            this.busy = true;
            this.handleInput(item.value).then(() => { this.busy = false; this.busyAgentId = null; this.resetPromptState(); this.renderPrompt(); })
                .catch((err) => { console.log(chalk.red(`  ✖ ${err.message}`)); this.busy = false; this.busyAgentId = null; this.resetPromptState(); this.renderPrompt(); });
            return;
        }

        // Shift+Enter → multiline (add newline to buffer)
        // macOS terminals may send Shift+Enter as just 'return', so also support Ctrl+J and Option+Enter
        if (key.name === 'return' && (key.shift || key.meta)) {
            this.inputBuffer += '\n';
            process.stdout.write('\n' + chalk.dim('  … '));
            return;
        }
        // Ctrl+J as alternative for multiline (Shift+Enter fallback)
        if (key.ctrl && key.name === 'j') {
            this.inputBuffer += '\n';
            process.stdout.write('\n' + chalk.dim('  … '));
            return;
        }

        // Enter → submit
        if (key.name === 'return') {
            this.closeDropdown();
            const input = this.inputBuffer.trim();
            this.inputBuffer = '';
            this.resetPromptState();
            process.stdout.write('\n');
            if (!input) { this.renderPrompt(); return; }
            // Don't echo - the prompt already shows what was typed
            this.busy = true;
            this.handleInput(input).then(() => { this.busy = false; this.busyAgentId = null; this.resetPromptState(); this.renderPrompt(); })
                .catch((err) => { console.log(chalk.red(`  ✖ ${err.message}`)); this.busy = false; this.busyAgentId = null; this.resetPromptState(); this.renderPrompt(); });
            return;
        }

        // Backspace — with Option+Backspace (delete word) and Cmd fallback
        if (key.name === 'backspace') {
            if (key.meta) {
                // Option+Backspace: delete previous word
                this.closeDropdown();
                this.inputBuffer = this.inputBuffer.replace(/\S+\s*$/, '');
                this.renderPrompt();
                const buf = this.inputBuffer;
                if (buf.startsWith('/') || (buf.startsWith('@') && !buf.includes(' ')) || (buf.startsWith('#') && !buf.includes(' '))) this.buildDropdown();
                return;
            }
            if (this.inputBuffer.length > 0) {
                this.closeDropdown(); // always fully close first
                this.inputBuffer = this.inputBuffer.slice(0, -1);
                this.renderPrompt();
                // Only rebuild if we still have a trigger char
                const buf = this.inputBuffer;
                if (buf.startsWith('/') || (buf.startsWith('@') && !buf.includes(' ')) || (buf.startsWith('#') && !buf.includes(' '))) {
                    this.buildDropdown();
                }
            }
            return;
        }

        // Delete character at a time when holding ctrl+backspace in some terminals → treat as clear line
        if (key.name === 'backspace' && key.ctrl) {
            this.closeDropdown(); this.inputBuffer = ''; this.renderPrompt(); return;
        }

        if (key.name === 'escape') { if (this.dropdownItems.length > 0) this.closeDropdown(); return; }
        if (ch && !key.ctrl && !key.meta && key.name !== 'up' && key.name !== 'down') this.insertChar(ch);
    }

    insertChar(ch) { this.eraseDropdownLines(); this.inputBuffer += ch; this.renderPrompt(); this.buildDropdown(); }

    exitSession() {
        this.closeDropdown();
        if (this.sessionName) this.saveSession();
        this.context.save(); this.spawner.killAll();
        this.showSessionSummary();
        process.stdout.write(`\n${chalk.hex('#A855F7')(`  ${BYES[Math.floor(Math.random() * BYES.length)]}`)}\n\n`);
        process.exit(0);
    }

    addActivePersona(id) { if (!this.activePersonas.includes(id)) this.activePersonas.push(id); }
    removeActivePersona(id) { this.activePersonas = this.activePersonas.filter((p) => p !== id); }

    // ── Session save/load ─────────────────────────────────────────────────────
    saveSession() {
        if (!existsSync(SESSIONS_DIR)) mkdirSync(SESSIONS_DIR, { recursive: true });
        const data = {
            name: this.sessionName,
            savedAt: new Date().toISOString(),
            activeTool: this.activeTool,
            activeModel: this.activeModel,
            yolo: this.yolo,
            sandbox: this.sandbox,
            agentTokens: this.agentTokens,
            conversationLog: this.conversationLog,
            todoList: this.todoList,
        };
        writeFileSync(join(SESSIONS_DIR, `${this.sessionName}.json`), JSON.stringify(data, null, 2));
        console.log(chalk.green(`  💾 Session "${this.sessionName}" saved.`));
    }

    loadSession(name) {
        const fp = join(SESSIONS_DIR, `${name}.json`);
        if (!existsSync(fp)) { console.log(chalk.red(`  Session "${name}" not found.`)); return; }
        const data = JSON.parse(readFileSync(fp, 'utf8'));
        this.sessionName = data.name;
        this.activeTool = data.activeTool;
        this.activeModel = data.activeModel;
        this.yolo = data.yolo ?? false;
        this.sandbox = data.sandbox ?? true;
        this.agentTokens = data.agentTokens || {};
        this.conversationLog = data.conversationLog || [];
        this.todoList = data.todoList || [];
        console.log(chalk.green(`  📥 Loaded "${name}"`));
        console.log(chalk.dim(`    ${this.conversationLog.length} messages │ saved ${data.savedAt}`));
        if (this.activeTool) {
            const t = this.registry.get(this.activeTool);
            console.log(chalk.dim(`    Tool: ${t?.icon} ${this.activeTool}${this.activeModel ? ` (${this.activeModel})` : ''}`));
        }
    }

    listSessions() {
        if (!existsSync(SESSIONS_DIR)) { console.log(chalk.dim('  No saved sessions.')); return; }
        const files = readdirSync(SESSIONS_DIR).filter((f) => f.endsWith('.json'));
        if (!files.length) { console.log(chalk.dim('  No saved sessions.')); return; }
        console.log(chalk.bold('\n  📂 Saved Sessions\n'));
        for (const f of files) {
            try {
                const data = JSON.parse(readFileSync(join(SESSIONS_DIR, f), 'utf8'));
                const msgs = (data.conversationLog || []).length;
                console.log(`  💾 ${chalk.hex('#FFD93D')(data.name.padEnd(20))} ${chalk.dim(`${msgs} msgs │ ${data.savedAt?.slice(0, 10) || '?'}`)}`);
            } catch { console.log(`  💾 ${chalk.dim(f)}`); }
        }
        console.log(chalk.dim(`\n  /load <name> to restore\n`));
    }

    showSessionSummary() {
        const elapsed = Math.round((Date.now() - this.sessionStart) / 1000);
        const mins = Math.floor(elapsed / 60), secs = elapsed % 60;
        let totalIn = 0, totalOut = 0, totalApi = 0;
        for (const t of Object.values(this.agentTokens)) { totalIn += t.in; totalOut += t.out; totalApi += t.apiTimeMs; }
        const totalTok = totalIn + totalOut;
        // Compact single-line summary
        console.log();
        console.log(chalk.hex('#555')('  ───────────────────────────────────────────────────'));
        console.log(
            chalk.dim('  📊 ') +
            chalk.hex('#4ECDC4')(`${totalTok.toLocaleString()} tok`) +
            chalk.hex('#555')(' · ') +
            chalk.hex('#6BCB77')(`${this.conversationLog.length} msgs`) +
            chalk.hex('#555')(' · ') +
            chalk.hex('#FFD93D')(`${mins}m ${secs}s`) +
            chalk.hex('#555')(' · ') +
            chalk.dim(`api ${(totalApi / 1000).toFixed(1)}s`)
        );
        // Per-agent compact
        const ids = Object.keys(this.agentTokens).filter((id) => {
            const t = this.agentTokens[id]; return t.in > 0 || t.out > 0;
        });
        if (ids.length > 0) {
            const parts = ids.map((id) => {
                const t = this.agentTokens[id]; const a = this.registry.get(id);
                return `${a?.icon || '○'} ${id} ${t.prompts}x`;
            });
            console.log(chalk.dim(`  ${parts.join('  ·  ')}`));
        }
        console.log(chalk.hex('#555')('  ───────────────────────────────────────────────────'));
        if (this.sessionName) console.log(chalk.dim(`  💾 "${this.sessionName}" saved`));
    }

    // ── Commands ──────────────────────────────────────────────────────────────
    async handleInput(input) {
        // Handle `/` alone or unknown `/xxx` commands
        if (input === '/') { this.showHelp(); return; }
        if (input.startsWith('/') && !input.includes(' ')) {
            const known = COMMANDS.some((c) => c.cmd === input);
            if (!known) { console.log(chalk.red(`  Unknown command: ${input}`)); console.log(chalk.dim('  /help for all commands')); return; }
        }
        if (input === '/help' || input === '?') { this.showHelp(); return; }
        if (input === '/quit' || input === '/exit') { this.exitSession(); return; }
        if (input === '/agents') { this.showToolAgents(); return; }
        if (input === '/personas' || input === '/chefs') { this.showPersonas(); return; }
        if (input === '/tool' || input === '/tools') {
            // Interactive: fill buffer with `/tool ` and trigger dropdown
            this.inputBuffer = '/tool ';
            this.resetPromptState();
            this.renderPrompt();
            this.buildDropdown();
            return;
        }
        if (input.startsWith('/tool ')) { this.switchTool(input.slice(6).trim()); return; }
        if (input === '/auto') { this.activeTool = null; this.activeModel = null; console.log(chalk.hex('#4ECDC4')('  🎯 FULL AUTO')); return; }
        if (input === '/model') {
            // Interactive: fill buffer with `/model ` and trigger dropdown
            this.inputBuffer = '/model ';
            this.resetPromptState();
            this.renderPrompt();
            this.buildDropdown();
            return;
        }
        if (input.startsWith('/model ')) { this.handleModel(input); return; }
        if (input === '/yolo') { this.toggleYolo(); return; }
        if (input === '/tokens') { this.showTokens(); return; }
        if (input === '/costs') { this.showCosts(); return; }
        if (input === '/grades') { this.showGrades(); return; }
        if (input === '/memory') { this.showMemory(); return; }
        if (input === '/compress') { this.context.compress(); console.log(chalk.green('  📦 Compressed!')); return; }
        if (input === '/sandbox') { this.toggleSandbox(); return; }
        if (input === '/browse' || input.startsWith('/browse ')) { await this.browseLocalhost(input); return; }
        if (input.startsWith('/todo ')) { this.generateTodo(input.slice(6).trim()); return; }
        if (input === '/todo') { this.showTodo(); return; }
        // /do <number> — execute a todo item
        if (input.startsWith('/do ')) { await this.executeTodo(input.slice(4).trim()); return; }
        if (input === '/do') { this.showTodo(); return; }
        // /chain — chain agents together
        if (input.startsWith('/chain ')) { await this.handleChain(input.slice(7).trim()); return; }
        if (input === '/chain') { console.log(chalk.dim('  Usage: /chain designer→researcher "your prompt"')); return; }
        // /delegate — explicitly delegate to an agent
        if (input.startsWith('/delegate ')) { await this.handleDelegateCmd(input.slice(10).trim()); return; }
        if (input === '/delegate') { console.log(chalk.dim('  Usage: /delegate <agent> "prompt"')); return; }
        // /parallel — run multiple agents simultaneously
        if (input.startsWith('/parallel ')) { await this.handleParallel(input.slice(10).trim()); return; }
        if (input === '/parallel') { console.log(chalk.dim('  Usage: /parallel agent1 agent2 agent3 "shared prompt"')); return; }
        // NEW: /clear — clear context
        if (input === '/clear') { this.clearContext(); return; }
        // NEW: /rename
        if (input.startsWith('/rename ')) { this.renameSession(input.slice(8).trim()); return; }
        if (input === '/rename') { console.log(chalk.dim('  Usage: /rename <session-name>')); return; }
        // NEW: /sessions
        if (input === '/sessions') { this.listSessions(); return; }
        // NEW: /load
        if (input.startsWith('/load ')) { this.loadSession(input.slice(6).trim()); return; }
        if (input === '/load') { this.listSessions(); return; }
        // /login /logout
        if (input.startsWith('/login ')) { this.loginAgent(input.slice(7).trim()); return; }
        if (input.startsWith('/logout ')) { this.logoutAgent(input.slice(8).trim()); return; }
        if (input === '/login' || input === '/logout') { console.log(chalk.dim(`  Usage: /${input.slice(1)} <agent-id>`)); return; }
        // /shards, /shard
        if (input === '/shards') { this.showShards(); return; }
        if (input.startsWith('/shard store ')) { this.shardStore(input.slice(13).trim()); return; }
        if (input.startsWith('/shard recall ')) { this.shardRecall(input.slice(14).trim()); return; }
        if (input === '/shard') { this.showShards(); return; }
        // /skills — show all available skills
        if (input === '/skills') { this.showSkills(); return; }

        // Resolve #file refs
        let resolved = input;
        const fileRefs = input.match(/#([\w/.\\-]+)/g);
        if (fileRefs) {
            for (const ref of fileRefs) {
                const fp = ref.slice(1);
                const full = resolve(this.cwd, fp);
                if (this.sandbox && !full.startsWith(homedir() + '/Developer')) { console.log(chalk.red(`  🔒 ${fp} outside sandbox`)); continue; }
                if (existsSync(full)) {
                    try {
                        const content = readFileSync(full, 'utf8').slice(0, 5000);
                        resolved = resolved.replace(ref, `\n<file path="${fp}">\n${content}\n</file>\n`);
                        console.log(chalk.dim(`  📄 ${fp}`));
                    } catch { }
                }
            }
        }

        // ── SMART: detect multi-task prompts (not just word count) ──
        if (!resolved.startsWith('@') && !resolved.startsWith('/')) {
            const isTodoCandidate = this.looksLikeTaskList(resolved);
            if (isTodoCandidate) {
                console.log(chalk.hex('#A855F7')('  🧠 Multi-step prompt detected — auto-breaking into tasks…'));
                this.generateTodo(resolved);
                console.log(chalk.dim('  Use /do 1 to start first task, or /do all to run them all.'));
                return;
            }
        }

        // ── SMART: Auto-route UI/browse/localhost tasks → Antigravity ──
        const lower = resolved.toLowerCase();
        const mentionsUI = lower.includes('ui') || lower.includes('interface') || lower.includes('design') || lower.includes('wireframe') || lower.includes('layout') || lower.includes('page looks') || lower.includes('screenshot') || lower.includes('visual');
        const mentionsLocalhost = /localhost:\d+/i.test(resolved) || /127\.0\.0\.1:\d+/i.test(resolved);
        const mentionsBrowse = lower.includes('check') || lower.includes('browse') || lower.includes('look') || lower.includes('open') || lower.includes('see') || lower.includes('verify');
        if (mentionsLocalhost && mentionsBrowse) {
            const portMatch = resolved.match(/localhost:(\d+)/i) || resolved.match(/127\.0\.0\.1:(\d+)/i);
            await this.browseLocalhost(`/browse http://localhost:${portMatch[1]}`);
            return;
        }
        if ((mentionsUI || mentionsLocalhost) && !this.activeTool) {
            const antigravity = this.registry.get('antigravity');
            if (antigravity?.available) {
                console.log(chalk.hex('#6C63FF')(`  🚀 UI task → routing to Antigravity`));
                this.getAgentTokens('antigravity').in += Math.ceil(resolved.length / 4);
                this.getAgentTokens('antigravity').prompts++;
                this.conversationLog.push({ role: 'user', text: input, ts: Date.now() });
                this.context.addMessage('user', resolved);
                this.startSpinner('antigravity');
                await this.orchestrator.runOn('antigravity', resolved, this.cwd);
                return;
            }
        }

        // Track
        const toolId = this.activeTool || this.pickBestTool(resolved);
        const inToks = Math.ceil(resolved.length / 4);
        if (toolId) { this.getAgentTokens(toolId).in += inToks; this.getAgentTokens(toolId).prompts++; }
        this.totalPromptsSent++;
        this.conversationLog.push({ role: 'user', text: input, ts: Date.now() });

        if (resolved.startsWith('@auto ')) { await this.autoRoute(resolved.slice(6).trim()); return; }
        const mm = resolved.match(/^@(\w+)\s+([\s\S]+)/);
        if (mm) { await this.runPersona(mm[1], mm[2]); return; }

        this.context.addMessage('user', resolved);

        // Auto-offload old context to shards if conversation is large
        this.autoOffloadContext();

        // Pre-query shards for relevant context
        const shardContext = this.shards.recall(resolved.slice(0, 200));
        if (shardContext.length > 0) {
            const extra = shardContext.slice(0, 2).map((s) => s.content.slice(0, 500)).join('\n');
            resolved = `[Recalled context]\n${extra}\n[End recalled context]\n\n${resolved}`;
            console.log(chalk.dim(`  🧩 Recalled ${shardContext.length} shard(s) for context`));
        }

        if (toolId) {
            this.startSpinner(toolId);
            await this.orchestrator.runOn(toolId, resolved, this.cwd);
        }
        else { console.log(chalk.red('  No tool agents available.')); }
    }

    // ── /clear — clear context window (like Claude Code's /clear) ─────────
    clearContext() {
        this.context.clear?.() || this.context.messages?.splice?.(0);
        this.conversationLog = [];
        console.log(chalk.hex('#4ECDC4')('  🧹 Context cleared. Fresh start!'));
    }

    // ── /rename — name session for recall ─────────────────────────────────────
    renameSession(name) {
        this.sessionName = name.replace(/[^a-zA-Z0-9_-]/g, '-');
        this.saveSession();
        console.log(chalk.green(`  💾 Session named "${this.sessionName}". Auto-saves on exit.`));
    }

    // ── Context Shards ───────────────────────────────────────────────────────
    showShards() {
        const status = this.shards.getStatus();
        const W = 56;
        const line = '─'.repeat(W);
        console.log();
        console.log(chalk.hex('#555')(`  ╭${line}╮`));
        console.log(chalk.hex('#555')('  │') + chalk.bold('  🧩 Memory Shards') + ' '.repeat(W - 34 - String(status.count).length - String(status.maxShards).length) + chalk.hex('#4ECDC4')(`${status.count}/${status.maxShards} active`) + chalk.hex('#555')('  │'));
        console.log(chalk.hex('#555')(`  │${line}│`));
        if (status.shards.length === 0) {
            console.log(chalk.hex('#555')('  │') + chalk.dim('  No shards yet. Context auto-offloads when full.') + ' '.repeat(5) + chalk.hex('#555')('│'));
        } else {
            for (const s of status.shards) {
                const label = s.label.length > 35 ? s.label.slice(0, 34) + '…' : s.label;
                const right = chalk.dim(`${s.tokens} tok`);
                const spacer = Math.max(1, W - 6 - label.length - String(s.tokens).length - 4);
                console.log(chalk.hex('#555')('  │') + `  📦 ${chalk.hex('#CCC')(label)}` + ' '.repeat(spacer) + right + chalk.hex('#555')('│'));
            }
        }
        console.log(chalk.hex('#555')(`  │${line}│`));
        console.log(chalk.hex('#555')('  │') + chalk.dim(`  Total: ${status.totalTokens.toLocaleString()} tokens across ${status.count} shards`) + ' '.repeat(Math.max(0, W - 48 - String(status.totalTokens).length)) + chalk.hex('#555')('│'));
        console.log(chalk.hex('#555')(`  ╰${line}╯`));
        console.log(chalk.dim(`\n  /shard store <text>  │  /shard recall <query>\n`));
    }

    shardStore(text) {
        if (!text) { console.log(chalk.dim('  Usage: /shard store <text to remember>')); return; }
        const shard = this.shards.store('manual', text);
        console.log(chalk.green(`  📦 Stored in shard #${shard.id} (${shard.tokens} tokens)`));
    }

    shardRecall(query) {
        if (!query) { console.log(chalk.dim('  Usage: /shard recall <what to find>')); return; }
        const results = this.shards.recall(query);
        if (!results.length) { console.log(chalk.dim('  No matching shards.')); return; }
        console.log(chalk.bold(`\n  🔍 Found ${results.length} shard(s)\n`));
        for (const r of results.slice(0, 3)) {
            console.log(chalk.hex('#4ECDC4')(`  📦 Shard #${r.id}`) + chalk.dim(` (${r.label}, score:${r.score})`));
            console.log(chalk.dim(`  ${r.content.slice(0, 200).replace(/\n/g, ' ')}…\n`));
        }
    }

    /** Auto-offload old context to shards when conversation gets large */
    autoOffloadContext() {
        if (this.conversationLog.length > 50) {
            const old = this.conversationLog.splice(0, 20);
            const text = old.map((m) => `[${m.role}] ${m.text}`).join('\n');
            this.shards.offload('auto-context', text);
            console.log(chalk.dim(`  📦 Auto-offloaded 20 messages to memory shards`));
        }
    }

    // ── /login /logout ────────────────────────────────────────────────────────
    loginAgent(agentId) {
        const a = this.registry.get(agentId);
        if (!a) { console.log(chalk.red(`  Unknown: ${agentId}. /agents`)); return; }
        console.log(chalk.hex('#4ECDC4')(`  🔑 Logging into ${a.icon} ${a.name}…`));
        try {
            this.auth.login(agentId);
            console.log(chalk.green(`  ✔ Logged in to ${a.name}`));
        } catch (err) { console.log(chalk.yellow(`  ℹ  Run: ${a.binary || agentId} auth login`)); }
    }

    logoutAgent(agentId) {
        const a = this.registry.get(agentId);
        if (!a) { console.log(chalk.red(`  Unknown: ${agentId}`)); return; }
        try {
            this.auth.logout(agentId);
            console.log(chalk.hex('#FF6B6B')(`  🚪 Logged out of ${a.name}`));
        } catch { console.log(chalk.yellow(`  ℹ  Run: ${a.binary || agentId} auth logout`)); }
    }

    // ── /browse ── always via Antigravity ────────────────────────────────────
    async browseLocalhost(input) {
        const url = input.replace('/browse', '').trim() || 'http://localhost:3000';
        const ag = this.registry.get('antigravity');
        const agLabel = ag ? chalk.hex(ag.color)(`${ag.icon} Antigravity`) : '🌐';
        console.log(agLabel + chalk.dim(` → browsing ${url}…`));
        try {
            const puppeteer = await import('puppeteer-core');
            const paths = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'];
            const execPath = paths.find((p) => existsSync(p));
            if (!execPath) { console.log(chalk.red('  No Chrome found.')); return; }
            const browser = await puppeteer.default.launch({ executablePath: execPath, headless: 'new' });
            const page = await browser.newPage();
            await page.setViewport({ width: 1280, height: 800 });
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 10000 });
            const title = await page.title();
            const ssPath = join(homedir(), '.soupz-agents', `screenshot-${Date.now()}.png`);
            await page.screenshot({ path: ssPath, fullPage: false });
            const text = await page.evaluate(() => document.body?.innerText?.slice(0, 300) || '');
            await browser.close();
            console.log(chalk.green(`  ✔ ${title || url}`));
            console.log(chalk.dim(`  📸 ${ssPath}`));
            if (text) console.log(chalk.dim(`  ${text.slice(0, 150).replace(/\n/g, ' ')}…`));
        } catch (err) {
            console.log(chalk.red(`  ✖ ${err.message}`));
        }
    }

    // ── Smart detection: does this input look like a multi-step task list? ────
    looksLikeTaskList(text) {
        // Pattern 1: Comma-separated action items (≥3 items with verb-like starts)
        const commaItems = text.split(/,\s*/).filter((s) => s.trim().length > 5);
        if (commaItems.length >= 3) {
            const actionVerbs = /^(create|build|add|set up|implement|write|design|deploy|fix|update|make|install|configure|test|run|push|integrate|refactor|migrate|enable|generate)/i;
            const verbCount = commaItems.filter((s) => actionVerbs.test(s.trim())).length;
            if (verbCount >= 2) return true;
        }
        // Pattern 2: Numbered items (1. ... 2. ... or 1) ... 2) ...)
        if (/(\d+[\.\)]\s+\S+.*){2,}/s.test(text)) return true;
        // Pattern 3: Sequential markers (then, after that, next, also, finally)
        const seqMarkers = (text.match(/\b(then|after that|next|also|finally|first|second|third|lastly|additionally|afterwards)\b/gi) || []).length;
        if (seqMarkers >= 3) return true;
        // Pattern 4: Semicolons splitting tasks
        const semiItems = text.split(/;\s*/).filter((s) => s.trim().length > 5);
        if (semiItems.length >= 3) return true;
        // Pattern 5: Bullet-like markers (-, *, •)
        const bulletLines = text.split('\n').filter((l) => /^\s*[-*•]\s+/.test(l));
        if (bulletLines.length >= 3) return true;
        return false;
    }

    // ── /todo ─── Visual task card rendering ────────────────────────────────
    generateTodo(prompt) {
        const parts = prompt.split(/(?<=[.!?;])\s+|(?:\n)|(?:,\s*)/g).filter(Boolean).map((s) => s.trim()).filter((s) => s.length > 3);
        this.todoList = parts.map((task, i) => ({ id: i + 1, task, done: false, status: 'pending', elapsed: 0, startedAt: null }));
        if (this.todoList.length < 2) {
            const w = prompt.split(/\s+/), sz = Math.ceil(w.length / 3);
            this.todoList = [];
            for (let i = 0; i < w.length; i += sz) {
                this.todoList.push({ id: this.todoList.length + 1, task: w.slice(i, i + sz).join(' '), done: false, status: 'pending', elapsed: 0, startedAt: null });
            }
        }
        this.renderTodoCard();
    }

    renderTodoCard() {
        const total = this.todoList.length;
        const doneCount = this.todoList.filter((t) => t.done).length;
        const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
        const barLen = 24;
        const filled = Math.round((pct / 100) * barLen);
        const bar = chalk.hex('#6BCB77')('█'.repeat(filled)) + chalk.hex('#333')('░'.repeat(barLen - filled));

        const W = 56;
        const line = '─'.repeat(W);
        console.log();
        console.log(chalk.hex('#555')(`  ╭${line}╮`));
        console.log(chalk.hex('#555')('  │') + chalk.bold('  📋 Tasks') + ' '.repeat(W - 25 - String(doneCount).length - String(total).length) + chalk.hex('#4ECDC4')(`${doneCount}/${total} done`) + chalk.hex('#555')('  │'));
        console.log(chalk.hex('#555')(`  │${line}│`));

        for (const t of this.todoList) {
            let icon, label;
            if (t.status === 'done' || t.done) {
                icon = '  ✅';
                label = chalk.strikethrough.dim(t.task);
            } else if (t.status === 'running') {
                icon = '  🟡';
                label = chalk.hex('#FFD93D')(t.task);
            } else if (t.status === 'failed') {
                icon = '  ❌';
                label = chalk.red(t.task);
            } else {
                icon = '  🔵';
                label = chalk.hex('#CCC')(t.task);
            }
            const taskText = `${icon}  ${t.id}. ${t.task}`;
            const maxTask = W - 12;
            const truncated = t.task.length > maxTask ? t.task.slice(0, maxTask - 1) + '…' : t.task;

            // Right side: timing or status
            let right = '';
            if (t.status === 'done' || t.done) {
                right = t.elapsed > 0 ? chalk.dim(`${t.elapsed}s`) : chalk.dim('✔');
            } else if (t.status === 'running') {
                right = chalk.hex('#FFD93D')('running…');
            }

            const leftRaw = `${icon}  ${t.id}. ${truncated}`;
            const rightRaw = t.status === 'running' ? 'running…' : (t.done && t.elapsed > 0 ? `${t.elapsed}s` : (t.done ? '✔' : ''));
            const pad = W - leftRaw.length - rightRaw.length - 1;

            // Simple formatted line
            if (t.status === 'done' || t.done) {
                process.stdout.write(chalk.hex('#555')('  │') + `  ✅  ${chalk.dim(`${t.id}.`)} ${chalk.strikethrough.dim(truncated)}`);
            } else if (t.status === 'running') {
                process.stdout.write(chalk.hex('#555')('  │') + `  🟡  ${chalk.hex('#FFD93D')(`${t.id}.`)} ${chalk.hex('#FFD93D')(truncated)}`);
            } else if (t.status === 'failed') {
                process.stdout.write(chalk.hex('#555')('  │') + `  ❌  ${chalk.red(`${t.id}.`)} ${chalk.red(truncated)}`);
            } else {
                process.stdout.write(chalk.hex('#555')('  │') + `  🔵  ${chalk.dim(`${t.id}.`)} ${chalk.hex('#CCC')(truncated)}`);
            }
            // Pad to right border
            const spacer = Math.max(1, W - 8 - truncated.length - rightRaw.length);
            process.stdout.write(' '.repeat(spacer) + (right || '') + chalk.hex('#555')('│') + '\n');
        }

        console.log(chalk.hex('#555')(`  │${line}│`));
        console.log(chalk.hex('#555')('  │') + `  ${bar}  ${chalk.hex('#4ECDC4')(`${pct}%`)}` + ' '.repeat(Math.max(0, W - barLen - 9 - String(pct).length)) + chalk.hex('#555')('│'));
        console.log(chalk.hex('#555')(`  ╰${line}╯`));
        console.log(chalk.dim(`\n  /do <n> execute  │  /do all run all  │  /todo refresh\n`));
    }

    showTodo() {
        if (!this.todoList.length) { console.log(chalk.dim('  No tasks. Send a multi-step prompt and I\'ll auto-break it.')); return; }
        this.renderTodoCard();
    }

    // ── /do — execute a todo with visual status ─────────────────────────────
    async executeTodo(arg) {
        if (!this.todoList.length) { console.log(chalk.dim('  No tasks.')); return; }
        if (arg === 'all') {
            const pending = this.todoList.filter((t) => !t.done);
            console.log(chalk.hex('#A855F7')(`  ▶️  Running ${pending.length} pending tasks…`));
            for (const t of this.todoList) {
                if (t.done) continue;
                t.status = 'running';
                t.startedAt = Date.now();
                this.renderTodoCard();
                try {
                    await this.handleInput(t.task);
                    t.done = true;
                    t.status = 'done';
                    t.elapsed = Math.round((Date.now() - t.startedAt) / 1000);
                } catch {
                    t.status = 'failed';
                    t.elapsed = Math.round((Date.now() - t.startedAt) / 1000);
                }
            }
            this.renderTodoCard();
            console.log(chalk.green(`  ✔ All tasks complete!`));
            return;
        }
        const num = parseInt(arg, 10);
        const todo = this.todoList.find((t) => t.id === num);
        if (!todo) { console.log(chalk.red(`  Task #${arg} not found. /todo`)); return; }
        if (todo.done) { console.log(chalk.dim(`  Task #${num} already done.`)); return; }
        todo.status = 'running';
        todo.startedAt = Date.now();
        this.renderTodoCard();
        try {
            await this.handleInput(todo.task);
            todo.done = true;
            todo.status = 'done';
            todo.elapsed = Math.round((Date.now() - todo.startedAt) / 1000);
        } catch {
            todo.status = 'failed';
            todo.elapsed = Math.round((Date.now() - todo.startedAt) / 1000);
        }
        this.renderTodoCard();
    }

    toggleSandbox() {
        this.sandbox = !this.sandbox;
        console.log(this.sandbox ? chalk.hex('#6BCB77')('  🔒 Sandbox ON — ~/Developer only') : chalk.hex('#FF6B6B')('  🔓 Sandbox OFF'));
    }

    handleModel(input) {
        const arg = input.replace('/model', '').trim();
        if (!arg) {
            console.log(chalk.bold('\n  🧠 Models'));
            if (this.activeTool === 'gemini' || !this.activeTool) {
                for (const m of GEMINI_MODELS) {
                    const a = this.activeModel === m.id ? chalk.hex('#FFD93D')(' ← active') : '';
                    console.log(`    ${chalk.hex('#4ECDC4')(m.id.padEnd(24))} ${chalk.dim(m.desc)}${a}`);
                }
            } else console.log(chalk.dim(`  Coming soon for ${this.activeTool}.`));
            console.log();
            return;
        }
        const found = GEMINI_MODELS.find((m) => m.id === arg);
        if (found) {
            this.activeModel = found.id;
            // Persist model preference for current tool
            const toolKey = this.activeTool || 'auto';
            this.modelPrefs[toolKey] = found.id;
            this.saveModelPrefs();
            const g = this.registry.get('gemini');
            if (g) g.build_args = ['-p', '{prompt}', '--output-format', 'stream-json', '--model', found.id, ...(this.yolo ? ['--yolo'] : [])];
            console.log(chalk.hex('#4ECDC4')(`  🧠 ${found.id}`) + chalk.dim(` (saved for ${toolKey})`));
        } else console.log(chalk.red(`  Unknown: ${arg}. /model`));
    }

    async runPersona(personaId, prompt) {
        const persona = this.registry.get(personaId);
        if (!persona || persona.type !== 'persona') {
            const a = this.registry.get(personaId);
            if (a?.headless && a?.available) { await this.orchestrator.runOn(personaId, prompt, this.cwd); return; }
            console.log(chalk.red(`  Unknown: @${personaId}. /chefs`));
            return;
        }
        if (!persona.available) {
            console.log(chalk.red(`  @${personaId} is unavailable (no tool agent installed)`));
            return;
        }
        this.addActivePersona(personaId);
        this.context.addMessage('user', prompt);
        const toolId = this.activeTool || this.pickBestTool(prompt);
        if (!toolId) { console.log(chalk.red('  No tool agents available. Install gh, gemini, or kiro.')); this.removeActivePersona(personaId); return; }
        const toolAgent = this.registry.get(toolId);
        this.getAgentTokens(toolId).in += Math.ceil(prompt.length / 4);
        this.getAgentTokens(toolId).prompts++;
        this.conversationLog.push({ role: 'user', persona: personaId, text: prompt, ts: Date.now() });
        console.log(chalk.hex(persona.color)(`  ${persona.icon} ${persona.name}`) +
            chalk.dim(` → `) + chalk.hex(toolAgent?.color || '#888')(`${toolAgent?.icon} ${toolId}`) +
            (this.activeModel ? chalk.dim(` (${this.activeModel})`) : ''));
        // Use system_prompt from frontmatter, fall back to body (markdown body as system prompt)
        const sysPrompt = persona.system_prompt || persona.body || '';
        try {
            const result = await this.orchestrator.runOn(toolId, `${sysPrompt}\n\nUser: ${prompt}`, this.cwd);
            // Multi-agent delegation: detect @DELEGATE[agentId]: prompt patterns
            await this.processDelegations(result, personaId);
        }
        catch (err) { console.log(chalk.red(`  ✖ ${err.message}`)); }
        this.removeActivePersona(personaId);
    }

    /** Parse and process @DELEGATE[agentId]: prompt — runs ALL delegations in PARALLEL */
    async processDelegations(output, sourcePersonaId) {
        if (!output) return;
        const delegatePattern = /@DELEGATE\[([^\]]+)\]:\s*(.+?)(?=\n@DELEGATE|\n\n|$)/gms;
        const matches = [...output.matchAll(delegatePattern)];
        if (!matches.length) return;
        
        const tools = this.pickDiverseTools(matches.length);
        if (!tools.length) { console.log(chalk.red('  No tool agents for delegation')); return; }
        
        console.log(chalk.hex('#A855F7')(`\n  ⚡ ${matches.length} delegation(s) from @${sourcePersonaId} — running in PARALLEL`));
        
        // Resolve agents (create dynamic personas for unknowns)
        const tasks = await Promise.all(matches.map(async ([, agentId, delegatePrompt], i) => {
            let targetPersona = this.registry.get(agentId.trim());
            if (!targetPersona) {
                // Dynamically create a persona for unknown agents
                targetPersona = await this.createDynamicPersona(agentId.trim());
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
        for (let i = 0; i < results.length; i++) {
            if (results[i].status === 'fulfilled') successCount++;
            else console.log(chalk.red(`  ✖ @${valid[i].agentId} failed: ${results[i].reason?.message}`));
        }
        console.log(chalk.green(`\n  ✔ Parallel complete — ${successCount}/${valid.length} succeeded`));
    }

    /** Dynamically create a persona for an unknown agent ID */
    async createDynamicPersona(agentId) {
        const { writeFileSync, existsSync } = await import('fs');
        const { join } = await import('path');
        const { homedir } = await import('os');
        
        // Derive role from the agent ID name
        const roleName = agentId.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const systemPrompt = `You are an expert ${roleName}. Apply your specialized knowledge to solve the task given to you. Be thorough, practical, and actionable. Deliver complete, ready-to-use outputs.`;
        
        const agentDef = {
            id: agentId,
            name: roleName,
            icon: '🤖',
            color: '#888888',
            type: 'persona',
            uses_tool: 'auto',
            headless: false,
            description: `Dynamic persona — ${roleName}`,
            capabilities: [agentId, 'general'],
            routing_keywords: [agentId],
            grade: 50,
            system_prompt: systemPrompt,
            body: '',
            available: true,
            filePath: null,
        };
        
        // Register in memory
        this.registry.agents.set(agentId, agentDef);
        
        // Optionally persist to disk
        const agentsDir = join(homedir(), '.soupz-agents', 'agents');
        const filePath = join(agentsDir, `${agentId}.md`);
        if (!existsSync(filePath)) {
            const mdContent = `---\nname: ${roleName}\nid: ${agentId}\nicon: "🤖"\ncolor: "#888888"\ntype: persona\nuses_tool: auto\nheadless: false\ndescription: "Dynamic persona — ${roleName}"\ncapabilities:\n  - general\nrouting_keywords:\n  - ${agentId}\ngrade: 50\nsystem_prompt: |\n  ${systemPrompt}\n---\n\n# ${roleName}\n\nDynamically created persona.\n`;
            try {
                writeFileSync(filePath, mdContent);
                agentDef.filePath = filePath;
                console.log(chalk.hex('#A855F7')(`  ✨ Created new chef: @${agentId} (saved to ~/.soupz-agents/agents/${agentId}.md)`));
            } catch { /* non-critical */ }
        }
        
        return agentDef;
    }

    /** /chain designer→researcher "prompt" — explicit agent chain */
    async handleChain(input) {
        const chainMatch = input.match(/^([\w→\-]+)\s+"(.+)"$/s) || input.match(/^([\w→\-]+)\s+(.+)$/s);
        if (!chainMatch) {
            console.log(chalk.dim('  Usage: /chain agent1→agent2→agent3 "your prompt"'));
            console.log(chalk.dim('  Example: /chain designer→svgart "create branding for HealthAI"'));
            return;
        }
        const [, chainStr, prompt] = chainMatch;
        const agentIds = chainStr.split(/→|->/).map(s => s.trim());
        console.log(chalk.hex('#A855F7')(`  🔗 Chain: ${agentIds.join(' → ')}`));
        
        let context = prompt;
        for (let i = 0; i < agentIds.length; i++) {
            const agentId = agentIds[i];
            let persona = this.registry.get(agentId);
            if (!persona) {
                persona = await this.createDynamicPersona(agentId);
                if (!persona) { console.log(chalk.red(`  ✖ Could not resolve agent: @${agentId}`)); continue; }
            }
            
            const stepPrompt = i === 0 ? context : `[Previous agent result]\n${context}\n[End previous result]\n\nContinue based on the above. Original task: ${prompt}`;
            console.log(chalk.hex(persona.color || '#888')(`\n  ${persona.icon || '○'} Step ${i+1}/${agentIds.length}: @${agentId}`));
            
            const toolId = this.activeTool || this.pickBestTool(stepPrompt);
            if (!toolId) { console.log(chalk.red('  No tool agents available')); break; }
            const sysPrompt = persona.type === 'persona' ? (persona.system_prompt || persona.body || '') : '';
            const fullPrompt = sysPrompt ? `${sysPrompt}\n\nUser: ${stepPrompt}` : stepPrompt;
            
            try {
                context = await this.orchestrator.runOn(toolId, fullPrompt, this.cwd);
            } catch (err) {
                console.log(chalk.red(`  ✖ @${agentId} failed: ${err.message}`));
                break;
            }
        }
        console.log(chalk.green(`\n  ✔ Chain complete (${agentIds.length} agents)`));
    }

    /** /parallel agent1 agent2 agent3 "prompt" — explicit parallel dispatch */
    async handleParallel(input) {
        // Parse: last quoted string is the prompt, everything before is agent IDs
        const promptMatch = input.match(/^(.*?)\s+"(.+)"$/s) || input.match(/^([\w\s]+?)\s+([^"]+)$/s);
        if (!promptMatch) {
            console.log(chalk.dim('  Usage: /parallel designer architect planner "your shared prompt"'));
            return;
        }
        const [, agentStr, prompt] = promptMatch;
        const agentIds = agentStr.trim().split(/\s+/).filter(Boolean);
        if (!agentIds.length) {
            console.log(chalk.dim('  Usage: /parallel designer architect planner "prompt"'));
            return;
        }
        
        const tools = this.pickDiverseTools(agentIds.length);
        if (!tools.length) { console.log(chalk.red('  No tool agents available')); return; }
        
        console.log(chalk.hex('#A855F7')(`  ⚡ Parallel dispatch: ${agentIds.join(' + ')} (${agentIds.length} simultaneous)`));
        
        // Resolve all personas (create dynamic ones if needed)
        const tasks = await Promise.all(agentIds.map(async (agentId, i) => {
            let persona = this.registry.get(agentId);
            if (!persona) persona = await this.createDynamicPersona(agentId);
            if (!persona) { console.log(chalk.red(`  ✖ Unknown: @${agentId}`)); return null; }
            
            const toolId = tools[i];
            const tAgent = this.registry.get(toolId);
            console.log(chalk.hex(persona.color || '#888')(`  ${persona.icon || '○'} @${agentId} → ${tAgent?.icon || '○'} ${toolId}`));
            
            const sysPrompt = persona.type === 'persona' ? (persona.system_prompt || persona.body || '') : '';
            const fullPrompt = sysPrompt ? `${sysPrompt}\n\nUser: ${prompt}` : prompt;
            return { agentId, toolId, fullPrompt };
        }));
        
        const valid = tasks.filter(Boolean);
        console.log(chalk.dim('\n  ─── Go! ──────────────────────────────────────────────────'));
        
        const startTime = Date.now();
        const results = await Promise.allSettled(
            valid.map(t => this.orchestrator.runOn(t.toolId, t.fullPrompt, this.cwd))
        );
        
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        let ok = results.filter(r => r.status === 'fulfilled').length;
        results.forEach((r, i) => {
            if (r.status === 'rejected') console.log(chalk.red(`  ✖ @${valid[i].agentId}: ${r.reason?.message}`));
        });
        console.log(chalk.green(`\n  ⚡ Parallel done — ${ok}/${valid.length} succeeded in ${elapsed}s`));
    }

    /** /delegate agentId "prompt" — explicit single delegation */
    async handleDelegateCmd(input) {
        const m = input.match(/^(\w+)\s+"(.+)"$/s) || input.match(/^(\w+)\s+(.+)$/s);
        if (!m) { console.log(chalk.dim('  Usage: /delegate <agent> "prompt"')); return; }
        const [, agentId, prompt] = m;
        await this.runPersona(agentId, prompt);
    }

    /** Show cost tracking summary */
    showCosts() {
        const elapsed = Math.round((Date.now() - this.sessionStart) / 1000);
        let totalIn = 0, totalOut = 0;
        for (const t of Object.values(this.agentTokens)) { totalIn += t.in; totalOut += t.out; }
        const totalTok = totalIn + totalOut;
        // Approximate costs (these are estimates based on public pricing)
        const costs = {
            copilot: { in: 0, out: 0, label: 'GitHub Copilot (subscription)' },
            gemini: { in: 0.00025, out: 0.0005, label: 'Gemini 2.5 Flash (per 1k tok)' },
            kiro: { in: 0, out: 0, label: 'Kiro (subscription)' },
        };
        console.log(chalk.bold('\n  💰 Cost Tracker\n'));
        for (const [id, toks] of Object.entries(this.agentTokens)) {
            if (!toks.in && !toks.out) continue;
            const pricing = costs[id] || { in: 0, out: 0, label: id };
            const cost = (toks.in / 1000 * pricing.in) + (toks.out / 1000 * pricing.out);
            const costStr = cost > 0 ? chalk.hex('#FFD93D')(`$${cost.toFixed(4)}`) : chalk.green('free (subscription)');
            const a = this.registry.get(id);
            console.log(`  ${a?.icon || '○'} ${chalk.bold(id.padEnd(14))} ${toks.prompts}x  ${(toks.in + toks.out).toLocaleString()} tok  ${costStr}`);
        }
        console.log(chalk.dim(`\n  Total: ${totalTok.toLocaleString()} tokens (${Math.floor(elapsed/60)}m session)\n`));
    }

    async autoRoute(prompt) {
        console.log(chalk.hex('#A855F7')('  🤖 @auto analyzing…'));
        const personas = this.getPersonas();
        const scored = personas.map((p) => {
            let score = (p.grade || 50) / 10;
            const kw = (p.routing_keywords || []).map((k) => k.toLowerCase());
            for (const w of prompt.toLowerCase().split(/\s+/)) { for (const k of kw) { if (k.includes(w) || w.includes(k)) score += 10; } }
            return { ...p, score };
        }).filter((p) => p.score > 5).sort((a, b) => b.score - a.score).slice(0, 5);
        const toolId = this.pickBestTool(prompt);
        const toolAgent = this.registry.get(toolId);
        if (!scored.length) {
            console.log(chalk.dim(`  → `) + chalk.hex(toolAgent?.color || '#888')(`${toolAgent?.icon} ${toolId}`));
            await this.orchestrator.runOn(toolId, prompt, this.cwd);
            return;
        }
        console.log(chalk.hex('#4ECDC4')(`  📋 ${scored.length} personas via ${toolAgent?.icon} ${toolId}`));
        for (const s of scored) {
            this.addActivePersona(s.id);
            console.log(chalk.hex(s.color)(`\n  ${s.icon} ${s.name}`) + chalk.dim(` → ${toolAgent?.icon} ${toolId}`));
            const sysPrompt = s.system_prompt || s.body || '';
            try { await this.orchestrator.runOn(toolId, `${sysPrompt}\n\nUser: ${prompt}`, this.cwd); }
            catch (err) { console.log(chalk.red(`  ✖ ${s.name}: ${err.message}`)); }
            this.removeActivePersona(s.id);
        }
        console.log(chalk.green(`\n  ✔ @auto → ${scored.length} personas`));
    }

    // ── Display ───────────────────────────────────────────────────────────────
    showHelp() {
        console.log(chalk.bold('\n  ━━━ Commands ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
        for (const c of COMMANDS) console.log(`  ${c.icon} ${chalk.hex('#06B6D4').bold(c.cmd.padEnd(14))} ${chalk.hex('#888')(c.desc)}`);
        console.log(chalk.bold('\n  ━━━ Mentions ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
        console.log(`  🎯 ${chalk.hex('#FFD93D').bold('@auto')}                ${chalk.hex('#888')('Auto-pick best persona + run')}`);
        console.log(`  🎭 ${chalk.hex('#FFD93D').bold('@<persona>')}           ${chalk.hex('#888')('Run a specific persona (Tab to browse)')}`);
        console.log(`  🔗 ${chalk.hex('#4ECDC4').bold('@designer')}            ${chalk.hex('#888')('Award-worthy design agency AI')}`);
        console.log(`  🖼️  ${chalk.hex('#FF6B35').bold('@svgart')}              ${chalk.hex('#888')('SVG/CSS art generator')}`);
        console.log(`  🎯 ${chalk.hex('#A855F7').bold('@orchestrator')}        ${chalk.hex('#888')('BMAD-style multi-agent coordinator')}`);
        console.log(`  📄 ${chalk.hex('#FF6B6B').bold('#<file>')}              ${chalk.hex('#888')('Attach file content')}`);
        console.log(chalk.bold('\n  ━━━ Multi-Agent ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
        console.log(`  ${chalk.hex('#A855F7')('/chain designer→svgart "prompt"')}   ${chalk.hex('#888')('Chain agents sequentially')}`);
        console.log(`  ${chalk.hex('#FF6B35').bold('/parallel')} ${chalk.hex('#FF6B35')('a b c "prompt"')}        ${chalk.hex('#888')('⚡ Run agents simultaneously')}`);
        console.log(`  ${chalk.hex('#A855F7')('/delegate designer "prompt"')}        ${chalk.hex('#888')('Delegate to specific agent')}`);
        console.log(`  ${chalk.hex('#888')('@orchestrator auto-delegates in parallel via @DELEGATE[id]: prompt')}`);
        console.log(`  ${chalk.hex('#888')('Unknown @agents are auto-created dynamically')}`);
        console.log(chalk.bold('\n  ━━━ Keys ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
        console.log(`  ${chalk.hex('#4ECDC4')('↑↓')} Navigate   ${chalk.hex('#4ECDC4')('Tab')} Fill   ${chalk.hex('#4ECDC4')('Enter')} Submit`);
        console.log(`  ${chalk.hex('#4ECDC4')('Shift+Enter')} / ${chalk.hex('#4ECDC4')('Opt+Enter')} / ${chalk.hex('#4ECDC4')('Ctrl+J')} Newline`);
        console.log(`  ${chalk.hex('#4ECDC4')('Opt+⌫')} Delete word   ${chalk.hex('#4ECDC4')('Ctrl+U')} Clear line`);
        console.log(`  ${chalk.hex('#4ECDC4')('Esc')} Close / Cancel   ${chalk.hex('#4ECDC4')('Ctrl+C')} Quit   ${chalk.hex('#4ECDC4')('Ctrl+L')} Clear screen`);
        console.log();
    }

    showToolAgents() {
        const all = this.registry.list().filter((a) => a.type !== 'persona');
        const cnt = this.getPersonas().length;
        console.log(chalk.bold('\n  🔧 The Kitchen (Tool Agents)'));
        console.log(chalk.dim(`  Each has ${cnt} chefs. /tool <id> to select\n`));
        for (const a of all) {
            const s = a.available ? chalk.green('✔') : chalk.red('✖');
            const active = this.activeTool === a.id ? chalk.hex('#FFD93D')(' ← active') : '';
            const auth = this.auth?.isLoggedIn?.(a.id) ? chalk.green(' [logged in]') : '';
            console.log(`  ${s} ${a.icon} ${chalk.bold(a.id.padEnd(14))} ${chalk.dim(a.description || '')}${active}${auth}`);
            if (a.headless && a.available) console.log(chalk.dim(`      └─ ${cnt} chefs available`));
        }
        console.log(`\n  ${chalk.hex('#4ECDC4')('/auto')}  ${chalk.dim('best kitchen station + chef')}\n`);
    }

    showPersonas() {
        const personas = this.getPersonas();
        const tl = this.activeTool ? chalk.hex(this.registry.get(this.activeTool)?.color || '#FFF')(`via @${this.activeTool}`) : chalk.hex('#4ECDC4')('via best station (auto)');
        console.log(chalk.bold(`\n  👨‍🍳 ${personas.length} Chefs`) + chalk.dim(` — ${tl}\n`));
        for (const a of personas) console.log(`  ${a.icon} ${chalk.bold(`@${a.id}`.padEnd(18))} ${chalk.dim(a.description || '')}`);
        console.log(`\n  ${chalk.hex('#FFD93D')('@auto')} <prompt>  ${chalk.dim('Auto-pick + chain')}\n`);
    }

    showTokens() {
        const elapsed = Math.round((Date.now() - this.sessionStart) / 1000);
        let totalIn = 0, totalOut = 0, totalApi = 0;
        for (const t of Object.values(this.agentTokens)) { totalIn += t.in; totalOut += t.out; totalApi += t.apiTimeMs; }
        console.log(HR);
        console.log(chalk.bold('  📊 Token Usage'));
        console.log(HR);
        console.log(`  ${chalk.dim('Total:')}       ${chalk.hex('#4ECDC4')((totalIn + totalOut).toLocaleString())} tokens`);
        console.log(`  ${chalk.dim('In / Out:')}    ${totalIn.toLocaleString()} / ${totalOut.toLocaleString()}`);
        console.log(`  ${chalk.dim('API time:')}    ${(totalApi / 1000).toFixed(1)}s`);
        console.log(`  ${chalk.dim('Session:')}     ${Math.floor(elapsed / 60)}m ${elapsed % 60}s`);
        const ids = Object.keys(this.agentTokens).filter((id) => { const t = this.agentTokens[id]; return t.in > 0 || t.out > 0; });
        if (ids.length) {
            console.log(chalk.bold('\n  Per Agent'));
            for (const id of ids) {
                const t = this.agentTokens[id]; const a = this.registry.get(id);
                console.log(`  ${chalk.hex(a?.color || '#888')(`${a?.icon || '○'} ${id}`.padEnd(18))} ${chalk.dim('in:')} ${t.in} ${chalk.dim('out:')} ${t.out} ${chalk.dim('#:')} ${t.prompts} ${chalk.dim('api:')} ${(t.apiTimeMs / 1000).toFixed(1)}s`);
            }
        }
        console.log(HR + '\n');
    }

    showGrades() {
        const tools = this.getTools();
        const personas = this.getPersonas();
        console.log(chalk.bold('\n  📊 Report Cards\n'));
        console.log('  ' + ''.padEnd(18) + tools.map((t) => chalk.hex(t.color)(`${t.icon} ${t.id}`.padEnd(14))).join(''));
        console.log('  ' + '─'.repeat(18 + tools.length * 14));
        for (const p of personas) {
            const cells = tools.map(() => {
                const g = p.grade || 50;
                const l = g >= 90 ? 'A+' : g >= 80 ? 'A' : g >= 70 ? 'B' : g >= 60 ? 'C' : g >= 50 ? 'D' : 'F';
                return chalk.hex(g >= 80 ? '#6BCB77' : g >= 60 ? '#FFD93D' : '#FF6B6B')((l + ' ' + g).padEnd(14));
            }).join('');
            console.log(`  ${p.icon} ${'@' + p.id}${' '.repeat(Math.max(0, 16 - p.id.length - 1))} ${cells}`);
        }
        console.log();
    }
    showMemory() {
        const stats = this.memory.getStats();
        console.log(`\n  🧠 ${stats.totalTasks} tasks │ ${stats.routingPatterns} patterns`);
        const freq = this.memory.getFrequentPatterns();
        for (const p of freq.slice(0, 5)) console.log(chalk.dim(`    "${p.pattern}" → ${p.count}x`));
        console.log();
    }

    showSkills() {
        const skills = getSkills();
        const byCategory = {};
        for (const s of skills) {
            const cat = s.category || 'general';
            if (!byCategory[cat]) byCategory[cat] = [];
            byCategory[cat].push(s);
        }
        console.log(chalk.bold(`\n  🧰 ${skills.length} Available Skills\n`));
        const catColors = { design: '#FF2D55', engineering: '#4ECDC4', orchestration: '#A855F7', research: '#06B6D4', planning: '#FFD93D', strategy: '#6BCB77', communication: '#FF6B35', content: '#F59E0B', documentation: '#8B5CF6', data: '#3B82F6', ideation: '#EC4899', general: '#888' };
        for (const [cat, catSkills] of Object.entries(byCategory)) {
            const color = catColors[cat] || '#888';
            console.log(chalk.hex(color).bold(`  ▸ ${cat.toUpperCase()}`));
            for (const s of catSkills) {
                const registered = this.registry.get(s.name);
                const available = registered ? chalk.green(' ✓') : chalk.dim(' (not loaded)');
                console.log(`    ${s.icon}  ${chalk.bold(s.invoke.padEnd(16))}${available}  ${chalk.dim(s.description.slice(0, 60))}${s.description.length > 60 ? '…' : ''}`);
            }
            console.log();
        }
        console.log(chalk.dim('  Use @<skill-name> to invoke any skill\n'));
    }

    switchTool(id) {
        if (id === 'auto') { this.activeTool = null; this.activeModel = null; console.log(chalk.hex('#4ECDC4')('  🎯 FULL AUTO')); return; }
        const a = this.registry.get(id);
        if (!a || a.type === 'persona') { console.log(chalk.red(`  Unknown: ${id}. /agents (kitchen)`)); return; }
        this.activeTool = id;
        // Restore saved model preference for this tool
        const savedModel = this.modelPrefs[id];
        if (savedModel) {
            this.activeModel = savedModel;
            console.log(chalk.hex(a.color)(`  ${a.icon} Locked to ${a.name}`) + chalk.dim(` (model: ${savedModel})`));
        } else {
            this.activeModel = null;
            console.log(chalk.hex(a.color)(`  ${a.icon} Locked to ${a.name}`));
        }
        console.log(chalk.dim(`    ${this.getPersonas().length} chefs available. /model to switch. /auto to go back.`));
    }

    toggleYolo() {
        this.yolo = !this.yolo;
        console.log(this.yolo ? chalk.hex('#FF6B6B').bold('  🔥 YOLO ON — full send.') : chalk.hex('#4ECDC4')('  🛡️ YOLO OFF.'));
        const g = this.registry.get('gemini');
        if (g) g.build_args = ['-p', '{prompt}', '--output-format', 'stream-json', ...(this.activeModel ? ['--model', this.activeModel] : []), ...(this.yolo ? ['--yolo'] : [])];
        const c = this.registry.get('copilot');
        if (c) c.build_args = this.yolo ? ['copilot', '-p', '{prompt}', '--allow-all-tools'] : ['copilot', '-p', '{prompt}'];
    }
}
