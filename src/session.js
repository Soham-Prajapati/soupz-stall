import chalk from 'chalk';
import { emitKeypressEvents } from 'readline';
import { homedir } from 'os';
import { join, resolve } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, copyFileSync } from 'fs';
import { randomUUID } from 'crypto';
import SupabaseRelay from './supabase-relay.js';
import { ContextPantry } from './core/context-pantry.js';
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
    '🫕 stove is hot. let\'s cook.', '🔪 mise en place. ready to slice.',
    '🍜 serving up fresh code.', '👨‍🍳 chef\'s kiss incoming.',
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
                    ${chalk.bold.hex('#4ECDC4')('S  T  A  L  L')}  ${chalk.dim('v0.1-alpha')}
`;

const HR = chalk.hex('#444')('━'.repeat(65));

const COMMANDS = [
    // 🍳 Cooking (core actions)
    { cmd: '/help',       desc: 'Show all commands', icon: '❓', cat: 'cooking' },
    { cmd: '/kitchen',    desc: 'List kitchens (AI cooking stations)', icon: '🍳', cat: 'cooking' },
    { cmd: '/chefs',      desc: 'List all chefs (personas)', icon: '👨‍🍳', cat: 'cooking' },
    { cmd: '/station',    desc: 'Switch station: /station copilot', icon: '🍳', cat: 'cooking' },
    { cmd: '/utensil',    desc: 'Switch utensil (AI model): /utensil <model>', icon: '🔪', cat: 'cooking' },
    { cmd: '/auto',       desc: 'Full auto — best station + chef decides', icon: '🎯', cat: 'cooking' },
    { cmd: '/chain',      desc: 'Chain chefs: /chain designer→researcher "prompt"', icon: '🔗', cat: 'cooking' },
    { cmd: '/delegate',   desc: 'Delegate to chef: /delegate designer "prompt"', icon: '📤', cat: 'cooking' },
    { cmd: '/parallel',   desc: 'Run chefs in parallel: /parallel a b c "prompt"', icon: '⚡', cat: 'cooking' },
    { cmd: '/fleet',      desc: 'Spawn hidden parallel workers: /fleet "prompt"', icon: '🚀', cat: 'cooking' },
    { cmd: '/subagent',   desc: 'Spawn isolated sub-agents & synthesize: /subagent "prompt"', icon: '🧬', cat: 'cooking' },
    { cmd: '/team',       desc: 'Run a collaborative agent team: /team "prompt"', icon: '👥', cat: 'cooking' },
    { cmd: '/svgart',     desc: 'Generate SVG asset: /svgart logo "HealthAI logo, blue, geometric"', icon: '🎨', cat: 'cooking' },
    { cmd: '/hackathon',  desc: 'Hackathon mode — phased plan, todos, chef assignments', icon: '🏁', cat: 'cooking' },
    { cmd: '/spill',      desc: 'Toggle spill mode — no restrictions, full send 🫕', icon: '🌊', cat: 'cooking' },
    { cmd: '/browse',     desc: 'Screenshot localhost', icon: '🌐', cat: 'cooking' },
    // 📋 Tasks & tracking
    { cmd: '/todo',       desc: 'The menu (task list)', icon: '📋', cat: 'tasks' },
    { cmd: '/do',         desc: 'Cook a dish: /do 1 (execute todo)', icon: '▶️', cat: 'tasks' },
    { cmd: '/tokens',     desc: 'Ingredient usage (token stats)', icon: '📊', cat: 'tasks' },
    { cmd: '/costs',      desc: 'Bill tracker (cost tracking)', icon: '💰', cat: 'tasks' },
    { cmd: '/grades',     desc: 'Kitchen ratings per station', icon: '🏆', cat: 'tasks' },
    // 💾 Session
    { cmd: '/rename',     desc: 'Name this order (session)', icon: '💾', cat: 'session' },
    { cmd: '/sessions',   desc: 'Order history (saved sessions)', icon: '📂', cat: 'session' },
    { cmd: '/load',       desc: 'Reopen an order', icon: '📥', cat: 'session' },
    { cmd: '/clear',      desc: 'Clear the counter (reset context)', icon: '🧹', cat: 'session' },
    { cmd: '/sandbox',    desc: 'Toggle pantry lock (~/Developer)', icon: '🔒', cat: 'session' },
    // ☁️ Remote & monitoring
    { cmd: '/cloud-kitchen', desc: 'Start/show remote access server', icon: '☁️', cat: 'remote' },
    { cmd: '/tunnel', desc: 'Expose Cloud Kitchen publicly (no same-WiFi needed)', icon: '🌍', cat: 'remote' },
    { cmd: '/dashboard', desc: 'Open live stall monitor', icon: '📺', cat: 'remote' },
    // 🧠 Storage & memory
    { cmd: '/pantry',    desc: 'Pantry storage status', icon: '🥫', cat: 'storage' },
    { cmd: '/stock',     desc: 'Store/recall from pantry', icon: '📦', cat: 'storage' },
    { cmd: '/memory',     desc: 'Recipe memory stats', icon: '🧠', cat: 'storage' },
    { cmd: '/compress',   desc: 'Token compression settings & stats', icon: '📦', cat: 'storage' },
    // 🔧 System
    { cmd: '/health',     desc: 'System diagnostics — RAM, swap, CPU, disk, tools', icon: '🩺', cat: 'system' },
    { cmd: '/recipe',     desc: 'Pre-built chef workflows: /recipe list', icon: '📖', cat: 'system' },
    { cmd: '/skills',     desc: 'Spice rack (available skills)', icon: '🫙', cat: 'system' },
    { cmd: '/login',      desc: 'Unlock a kitchen', icon: '🔑', cat: 'system' },
    { cmd: '/logout',     desc: 'Lock a kitchen', icon: '🚪', cat: 'system' },
    { cmd: '/user',       desc: 'User account (signup/login/logout/status)', icon: '👤', cat: 'system' },
    { cmd: '/mcp',        desc: 'MCP servers (list/register/connect/tools)', icon: '🔌', cat: 'system' },
    { cmd: '/setup-multiline', desc: 'Setup Shift+Enter for multiline input', icon: '⌨️', cat: 'system' },
    { cmd: '/version',    desc: 'Show version, Node, OS info', icon: '🏷️', cat: 'system' },
    { cmd: '/quit',       desc: 'Close the stall', icon: '👋', cat: 'system' },
];

const GEMINI_MODELS = [
    { id: 'gemini-2.5-pro', desc: 'Most capable' },
    { id: 'gemini-2.5-flash', desc: 'Fast + smart' },
    { id: 'gemini-2.0-flash', desc: 'Previous gen' },
    { id: 'gemini-2.0-flash-lite', desc: 'Lightweight' },
];

const COPILOT_MODELS = [
    { id: 'gpt-5-mini', desc: '0x (FREE)', cost: 0 },
    { id: 'gpt-4.1', desc: '1x (default)', cost: 1 },
    { id: 'gemini-2.5-pro', desc: '1x', cost: 1 },
    { id: 'gpt-5.1-codex', desc: '1x', cost: 1 },
    { id: 'gpt-4.1-mini', desc: '0x (FREE)', cost: 0 }
];

const OLLAMA_MODELS = [
    { id: 'llama3.1:8b', desc: 'Meta 8B model' },
    { id: 'qwen2.5-coder:7b', desc: 'Alibaba coder 7B' },
    { id: 'deepseek-r1:7b', desc: 'DeepSeek distilled' },
];

const SESSIONS_DIR = join(homedir(), '.soupz-agents', 'sessions');
const HISTORY_FILE = join(homedir(), '.soupz-agents', 'cmd-history.txt');

// Kitchen-themed auto-name generator
const NAME_ADJECTIVES = ['spicy', 'smoky', 'crispy', 'tangy', 'zesty', 'golden', 'sizzling', 'savory', 'fiery', 'mellow', 'rustic', 'bold', 'fresh', 'hearty', 'silky'];
const NAME_DISHES = ['ramen', 'curry', 'broth', 'stew', 'risotto', 'gumbo', 'chowder', 'bisque', 'pho', 'laksa', 'minestrone', 'gazpacho', 'dashi', 'congee', 'tom-yum'];
function generateSessionName() {
    const adj = NAME_ADJECTIVES[Math.floor(Math.random() * NAME_ADJECTIVES.length)];
    const dish = NAME_DISHES[Math.floor(Math.random() * NAME_DISHES.length)];
    const num = Math.floor(Math.random() * 100);
    return `${adj}-${dish}-${num}`;
}

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
        this.dropdownScroll = 0; // viewport scroll offset for dropdown
        this.busy = false;
        this.busyAgentId = null; // track which agent is running for Escape cancel
        this.agentTokens = {};
        this.sessionStart = Date.now();
        this.totalPromptsSent = 0; // track prompts sent
        this.cmdHistory = [];
        this.cmdHistoryIndex = -1;
        // Load persistent command history
        try { if (existsSync(HISTORY_FILE)) this.cmdHistory = readFileSync(HISTORY_FILE, 'utf8').split('\n').filter(Boolean).slice(-100); } catch {}
        this.todoList = [];
        this.conversationLog = [];
        this.pantry = new ContextPantry();
        this.pantry.init();
        this.modelPrefs = this.loadModelPrefs();

        // Apply saved model preferences to agents on startup
        this._applyModelPrefs();

        // Initialize relay with user if logged in
        if (this.userAuth?.user) {
            this.relay.setUser(this.userAuth.user.id || this.userAuth.user.email);
            void this.relay.registerMachine();
        }
    }

    /** Apply saved model preferences to agent build_args */
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
        const p = join(homedir(), '.soupz-agents', 'model-prefs.json');
        try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return {}; }
    }
    saveModelPrefs() {
        const p = join(homedir(), '.soupz-agents', 'model-prefs.json');
        writeFileSync(p, JSON.stringify(this.modelPrefs, null, 2));
    }

    /** Add a message to the persistent conversation log with a size safety limit */
    pushToLog(entry) {
        // Limit individual entry text size to 50KB to prevent OOM during JSON.stringify (session saving)
        const MAX_LOG_SIZE = 50000;
        if (entry.text && entry.text.length > MAX_LOG_SIZE) {
            entry.text = entry.text.slice(0, MAX_LOG_SIZE) + `\n\n... [Log truncated for session saving, original size: ${entry.text.length} chars]`;
        }
        this.conversationLog.push(entry);
    }

    /** Get cost multiplier for a model ID (0 = free, 30 = expensive) */
    getModelCost(modelId) {
        const m = COPILOT_MODELS.find(m => m.id === modelId);
        return m?.cost ?? 1;
    }

    /** Get the user's max allowed cost (based on their saved model pref) */
    getMaxCostBudget() {
        const savedModel = this.modelPrefs.copilot || this.modelPrefs.auto;
        if (!savedModel) return 1; // Default: 1x models OK
        return this.getModelCost(savedModel);
    }

    /** Interactive yes/no/choice prompt (blocks until answered) */
    askConfirmation(question, choices = ['Yes', 'No']) {
        return new Promise((resolve) => {
            let selected = 0;
            const render = () => {
                process.stdout.write('\x1b[2K\r');
                const parts = choices.map((c, i) => i === selected ? chalk.hex('#FFD93D').bold(`▸ ${c}`) : chalk.dim(`  ${c}`));
                process.stdout.write(`  ${question}  ${parts.join('  ')}`);
            };
            render();
            const onKey = (ch, key) => {
                if (key?.name === 'left' || key?.name === 'up') { selected = (selected - 1 + choices.length) % choices.length; render(); }
                else if (key?.name === 'right' || key?.name === 'down') { selected = (selected + 1) % choices.length; render(); }
                else if (key?.name === 'return') {
                    process.stdin.removeListener('keypress', onKey);
                    process.stdout.write('\n');
                    resolve(choices[selected]);
                }
                else if (key?.name === 'escape' || (key?.ctrl && key?.name === 'c')) {
                    process.stdin.removeListener('keypress', onKey);
                    process.stdout.write('\n');
                    resolve('No');
                }
            };
            process.stdin.on('keypress', onKey);
        });
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

    /** Distribute N tasks across available tools — cycles through available engines
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
        const allAgents = this.getAllAgents().filter(a => !['ollama'].includes(a.id)); // Hide local engine (Ollama is router, not user-facing)
        const personas = this.getPersonas();
        
        // Build agent line
        const agentIcons = allAgents.map((t) => chalk.hex(t.color || '#888')(`${t.icon} ${t.id}`)).join(chalk.hex('#555')('  '));
        const availableHeadless = this.registry.headless().filter(a => a.available);
        const modeTag = availableHeadless.length >= 2 ? chalk.hex('#A855F7')('⚡ multi-agent') : chalk.hex('#FFD93D')('single');
        const modelTag = this.activeModel ? chalk.hex('#4ECDC4')(`🔪 ${this.activeModel}`) : '';
        const statusLine = modeTag + chalk.hex('#555')(' · ') +
                          chalk.hex('#FFD93D')(`${personas.length} chefs`) + chalk.hex('#555')(' · ') + 
                          chalk.hex('#6BCB77')('sandbox') +
                          (modelTag ? chalk.hex('#555')(' · ') + modelTag : '') +
                          chalk.hex('#555')(' · ') + 
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
        console.log(chalk.hex('#555')('  │ ') + agentIcons + agentPad + chalk.hex('#555')(' │'));
        
        // Status line
        const statusPad = ' '.repeat(boxWidth - 4 - statusLineLen);
        console.log(chalk.hex('#555')('  │ ') + statusLine + statusPad + chalk.hex('#555')(' │'));
        
        // Bottom border
        console.log(chalk.hex('#555')('  ╰' + '─'.repeat(boxWidth - 2) + '╯'));
        console.log();
        // Random startup tip
        const tips = [
            '@auto <prompt> — auto-picks the best chef and cooks',
            '/chain designer→svgart "prompt" — chain agents sequentially',
            '/parallel a b c "prompt" — run chefs simultaneously',
            '/fleet "build a landing page" — spawn hidden parallel workers',
            'Tab to autocomplete commands and @chef names',
            '/cloud-kitchen — see OTP for mobile/browser pairing',
            '/health — RAM, swap, disk, CPU diagnostics',
            '/hackathon — phased plan with chef assignments',
            '#file.js — attach file content inline',
            '↑↓ keys — navigate command history',
            '/utensil gpt-4.1 — switch AI model (fuzzy match)',
        ];
        console.log(chalk.dim(`  💡 ${tips[Math.floor(Math.random() * tips.length)]}`));
        console.log(); // bottom padding

        // Silently boot Cloud Kitchen + tunnel in background (no output)
        this.startCloudKitchen(false).then(() => {
            // Auto-start tunnel after Cloud Kitchen is up
            if (this._cloudKitchen && !this._tunnel) {
                this.startTunnel(true).catch(() => {});
            }
        }).catch(() => {});

        // Silently check for new models across all tools on startup (then daily)
        this.refreshAllModels().catch(() => {});
        this._modelRefreshTimer = setInterval(() => {
            this.refreshAllModels().catch(() => {});
        }, 24 * 60 * 60 * 1000); // once per day

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
                    const rendered = this._renderInlineMarkdown(line);
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

        // Intercept raw stdin data to detect special sequences before readline processes them:
        // - \x1b\r (ESC+CR): Copilot CLI configures VS Code to send this for Shift+Enter
        // - \x1b[13;2u (CSI u): Shift+Enter in terminals with kitty keyboard protocol
        this._shiftEnterHandled = false;
        process.stdin.on('data', (data) => {
            const str = data.toString();
            if (str === '\x1b\r' || str.includes('\x1b[13;2u')) {
                if (!this.busy) {
                    this._shiftEnterHandled = true;
                    this.inputBuffer += '\n';
                    process.stdout.write('\n' + chalk.dim('  … '));
                }
            }
        });

        emitKeypressEvents(process.stdin);
        this.renderPrompt();
        
        // Start polling for dashboard orders
        this._pollDashboardOrders();

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

    /** Polling loop to check for orders submitted from the dashboard */
    async _pollDashboardOrders() {
        if (!this.relay?.enabled) return;
        try {
            const orders = await this.relay.pollPendingOrders();
            for (const order of orders) {
                if (order.source === 'dashboard' && order.status === 'pending') {
                    console.log(`\n📱 Dashboard order received: ${order.prompt}`);
                    await this.relay.supabase
                        .from('soupz_orders')
                        .update({ status: 'running' })
                        .eq('id', order.id);
                    await this.handleInput(order.prompt);
                }
            }
        } catch (err) {
            // Silently fail to not interrupt the CLI
        }
        setTimeout(() => this._pollDashboardOrders(), 5000);
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
        // Line ❯ input (with colorized commands)
        const displayBuf = this.colorizeInput(this.inputBuffer);

        // Calculate how many physical lines the prompt is currently taking on screen
        if (this._prompted) {
            const cols = process.stdout.columns || 80;
            const rows = ('❯ ' + (this._lastPromptBuf || '')).split('\n');
            let lines = 0; // Only prompt lines now
            for (const r of rows) {
                // Determine how many lines this row wraps to (if it's long)
                lines += Math.max(1, Math.ceil(r.length / cols));
            }
            const moveUp = lines - 1; // Cursor is on the last line, so move up height-1
            if (moveUp > 0) process.stdout.write(`\x1b[${moveUp}A`);

            // Clear from cursor position down to end of screen (includes leftover wrapped text / dropdowns)
            process.stdout.write('\r\x1b[J');
        }

        process.stdout.write('\r\x1b[K' + chalk.bold.hex('#6C63FF')('❯') + ' ' + displayBuf);
        this._prompted = true;
        this._lastPromptBuf = this.inputBuffer;
    }

    resetPromptState() { this._prompted = false; }

    // Inline markdown → terminal ANSI rendering
    _renderInlineMarkdown(line) {
        if (!line || !line.trim()) return line;
        let s = line;
        // Headings: ### → bold colored
        const headingMatch = s.match(/^(\s*)(#{1,4})\s+(.*)/);
        if (headingMatch) {
            const depth = headingMatch[2].length;
            const text = headingMatch[3];
            const colors = ['#FF6B6B', '#FFD93D', '#4ECDC4', '#A855F7'];
            return headingMatch[1] + chalk.hex(colors[depth - 1] || '#4ECDC4').bold(text);
        }
        // Code block fences (``` language) — render as dim separator
        if (s.trim().match(/^```\s*\w*$/)) {
            return chalk.dim(s.replace(/```\s*\w*/, '───'));
        }
        // Bold: **text** → chalk.bold
        s = s.replace(/\*\*([^*]+)\*\*/g, (_, t) => chalk.bold(t));
        // Italic: *text* or _text_ (but not inside words with underscores)
        s = s.replace(/(?<!\w)\*([^*]+)\*(?!\w)/g, (_, t) => chalk.italic(t));
        s = s.replace(/(?<!\w)_([^_]+)_(?!\w)/g, (_, t) => chalk.italic(t));
        // Inline code: `text` → cyan
        s = s.replace(/`([^`]+)`/g, (_, t) => chalk.cyan(t));
        return s;
    }

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
        // /station <tab> and /tool <tab> — show available kitchens
        if (input.startsWith('/station ') || input.startsWith('/tool ')) {
            const prefix = input.startsWith('/station ') ? input.slice(9).toLowerCase() : input.slice(6).toLowerCase();
            const tools = [
                { label: 'auto', desc: '🎯 Smart routing — head chef picks best station', icon: '🎯', value: '/station auto' },
                ...this.getTools().map((t) => {
                    const saved = this.modelPrefs[t.id];
                    const desc = saved ? `${t.description || t.name} (utensil: ${saved})` : (t.description || t.name);
                    return { label: t.id, desc, icon: t.icon, value: `/station ${t.id}` };
                })
            ].filter((i) => i.label.startsWith(prefix) || !prefix);
            this.dropdownItems = dedup(tools);
            this.dropdownIndex = tools.length > 0 ? 0 : -1;
            this.refreshDropdown();
            return;
        }
        // /utensil <tab> and /model <tab> — show available models (utensils)
        if (input.startsWith('/utensil ') || input.startsWith('/model ')) {
            const prefix = input.startsWith('/utensil ') ? input.slice(9).toLowerCase() : input.slice(7).toLowerCase();
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
                .filter((m) => !prefix || m.id.toLowerCase().startsWith(prefix) || m.id.toLowerCase().includes(prefix))
                .map((m) => ({
                    label: m.id, desc: `🔪 ${m.desc} [${m.tool} kitchen]` + (this.activeModel === m.id ? ' ← active utensil' : ''),
                    icon: m.icon, value: `/utensil ${m.id}`
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

        // ↑↓ command history when no dropdown
        if (key.name === 'up' && this.dropdownItems.length === 0 && this.cmdHistory.length > 0) {
            if (this.cmdHistoryIndex < 0) this.cmdHistoryIndex = this.cmdHistory.length;
            this.cmdHistoryIndex = Math.max(0, this.cmdHistoryIndex - 1);
            this.inputBuffer = this.cmdHistory[this.cmdHistoryIndex] || '';
            this.renderPrompt(); return;
        }
        if (key.name === 'down' && this.dropdownItems.length === 0 && this.cmdHistoryIndex >= 0) {
            this.cmdHistoryIndex++;
            if (this.cmdHistoryIndex >= this.cmdHistory.length) {
                this.cmdHistoryIndex = -1;
                this.inputBuffer = '';
            } else {
                this.inputBuffer = this.cmdHistory[this.cmdHistoryIndex] || '';
            }
            this.renderPrompt(); return;
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
            // Echo the full selected command so user sees what's executing
            this.inputBuffer = item.value;
            this.renderPrompt();
            this.inputBuffer = '';
            process.stdout.write('\n');
            this.resetPromptState();
            this.busy = true;
            this.handleInput(item.value).then(() => { this.busy = false; this.busyAgentId = null; this.resetPromptState(); this.renderPrompt(); })
                .catch((err) => { console.log(chalk.red(`  ✖ ${err.message}`)); this.busy = false; this.busyAgentId = null; this.resetPromptState(); this.renderPrompt(); });
            return;
        }

        // Shift+Enter → multiline (add newline to buffer)
        // Copilot CLI configures VS Code to send \x1b\r for Shift+Enter, which readline
        // parses as meta+return. Also support CSI u encoding and native shift detection.
        if (key?.sequence === '\x1b[13;2u' || (key.name === 'return' && (key.shift || key.meta))) {
            // Prevent double-handling if raw data listener already caught it
            if (!this._shiftEnterHandled) {
                this.inputBuffer += '\n';
                process.stdout.write('\n' + chalk.dim('  … '));
            }
            this._shiftEnterHandled = false;
            return;
        }
        // Ctrl+J as alternative for multiline (Shift+Enter fallback)
        if (key.ctrl && key.name === 'j') {
            this.inputBuffer += '\n';
            process.stdout.write('\n' + chalk.dim('  … '));
            return;
        }

        // If raw data handler caught a shift+enter but readline emitted a plain 'return',
        // consume it silently instead of submitting.
        if (this._shiftEnterHandled && key.name === 'return') {
            this._shiftEnterHandled = false;
            return;
        }

        // Enter → submit
        if (key.name === 'return') {
            this.closeDropdown();
            const input = this.inputBuffer.trim();
            this.inputBuffer = '';
            this.resetPromptState();
            this.cmdHistoryIndex = -1;
            process.stdout.write('\n');
            if (!input) { this.renderPrompt(); return; }
            // Save to command history (avoid duplicates)
            if (this.cmdHistory[this.cmdHistory.length - 1] !== input) {
                this.cmdHistory.push(input);
                if (this.cmdHistory.length > 100) this.cmdHistory.shift();
            }
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
        // Save command history to disk
        try { writeFileSync(HISTORY_FILE, this.cmdHistory.slice(-100).join('\n')); } catch {}
        if (this._modelRefreshTimer) clearInterval(this._modelRefreshTimer);
        if (this._cloudKitchen) {
            this._cloudKitchen.stop();
            this._cloudKitchen = null;
        }
        if (this._tunnel?.proc) {
            try { this._tunnel.proc.kill(); } catch {}
            this._tunnel = null;
        }
        // Kill any fleet workers still running
        if (this._fleet) {
            for (const w of this._fleet) {
                if (w.proc && w.status === 'running') {
                    try { w.proc.kill(); } catch {}
                }
            }
            this._fleet = [];
        }
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
        const hrs = Math.floor(elapsed / 3600);
        const mins = Math.floor((elapsed % 3600) / 60);
        const secs = elapsed % 60;
        const timeStr = hrs > 0 ? `${hrs}h ${mins}m ${secs}s` : `${mins}m ${secs}s`;
        let totalIn = 0, totalOut = 0, totalApi = 0;
        for (const t of Object.values(this.agentTokens)) { totalIn += t.in; totalOut += t.out; totalApi += t.apiTimeMs; }
        const totalTok = totalIn + totalOut;
        console.log();
        console.log(chalk.hex('#555')('  ───────────────────────────────────────────────────'));
        if (this.sessionName) console.log(chalk.hex('#A855F7')(`  🫕 ${this.sessionName}`));
        console.log(
            chalk.dim('  📊 ') +
            chalk.hex('#4ECDC4')(`${totalTok.toLocaleString()} tok`) +
            chalk.hex('#555')(' · ') +
            chalk.hex('#6BCB77')(`${this.conversationLog.length} msgs`) +
            chalk.hex('#555')(' · ') +
            chalk.hex('#FFD93D')(timeStr) +
            chalk.hex('#555')(' · ') +
            chalk.dim(`${this.totalPromptsSent} prompts`) +
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
        // Kitchen commands — new names + legacy aliases
        if (input === '/kitchen' || input === '/agents') { this.showToolAgents(); return; }
        if (input === '/chefs' || input === '/personas') { this.showPersonas(); return; }
        // /station (new) and /tool (legacy alias) — switch AI cooking station
        if (input === '/station' || input === '/tool' || input === '/tools') {
            this.inputBuffer = '/station ';
            this.resetPromptState();
            this.renderPrompt();
            this.buildDropdown();
            return;
        }
        if (input.startsWith('/station ')) { this.switchTool(input.slice(9).trim()); return; }
        if (input.startsWith('/tool ')) { this.switchTool(input.slice(6).trim()); return; }
        if (input === '/auto') { this.activeTool = null; this.activeModel = null; console.log(chalk.hex('#4ECDC4')('  🎯 AUTO — head chef picks best station')); return; }
        // /utensil (new) and /model (legacy alias) — switch AI model
        if (input === '/utensil' || input === '/model') {
            this.inputBuffer = '/utensil ';
            this.resetPromptState();
            this.renderPrompt();
            this.buildDropdown();
            return;
        }
        if (input.startsWith('/utensil ')) { this.handleModel('/model ' + input.slice(9).trim()); return; }
        if (input.startsWith('/model ')) { this.handleModel(input); return; }
        // /spill mode (new) and /yolo (legacy alias)
        if (input === '/spill' || input === '/yolo') { this.toggleYolo(); return; }
        // /hackathon mode
        if (input === '/hackathon' || input.startsWith('/hackathon ')) { await this.handleHackathon(input); return; }
        // /svgart — SVG asset generation
        if (input === '/svgart' || input.startsWith('/svgart ')) { await this.handleSvgArt(input); return; }
        if (input === '/tokens') { this.showTokens(); return; }
        if (input === '/costs') { this.showCosts(); return; }
        if (input === '/grades') { this.showGrades(); return; }
        if (input === '/dashboard') { this.openDashboard(); return; }
        if (input === '/cloud-kitchen') { await this.startCloudKitchen(); return; }
        if (input === '/tunnel') { await this.startTunnel(); return; }
        if (input === '/memory') { this.showMemory(); return; }
        if (input === '/compress' || input.startsWith('/compress ')) { this.handleCompress(input); return; }
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
        // /fleet — spawn hidden parallel worker processes
        if (input.startsWith('/fleet peek')) { this.peekFleetWorker(input.slice(11).trim()); return; }
        if (input.startsWith('/fleet ')) { await this.spawnFleet(input.slice(7).trim()); return; }
        if (input === '/fleet') { this.showFleetStatus(); return; }
        // /subagent — sub-agent synthesis workflow
        if (input.startsWith('/subagent ')) { await this.runSubAgents(input.slice(10).trim()); return; }
        if (input === '/subagent') { console.log(chalk.dim('  Usage: /subagent "prompt"')); return; }
        // /team — collaborative agent teams
        if (input.startsWith('/team ')) { await this.runAgentTeam(input.slice(6).trim()); return; }
        if (input === '/team') { console.log(chalk.dim('  Usage: /team "prompt"')); return; }
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
        // /pantry, /stock
        if (input === '/pantry') { this.showPantry(); return; }
        if (input.startsWith('/pantry max ')) { this.setPantryMax(input.slice(12).trim()); return; }
        if (input.startsWith('/stock store ')) { this.pantryStore(input.slice(13).trim()); return; }
        if (input.startsWith('/stock recall ')) { this.pantryRecall(input.slice(14).trim()); return; }
        if (input === '/stock') { this.showPantry(); return; }
        // /skills — show all available skills
        if (input === '/skills') { this.showSkills(); return; }
        // /user — user auth commands
        if (input === '/user' || input.startsWith('/user ')) { await this.handleUserAuth(input); return; }
        if (input === '/mcp' || input.startsWith('/mcp ')) { await this.handleMcp(input); return; }
        if (input === '/setup-multiline') { await this.setupMultilineKeybinding(); return; }
        // /recipe — pre-built chef workflows
        if (input === '/recipe' || input === '/recipe list') { this.showRecipes(); return; }
        if (input.startsWith('/recipe ')) { await this.runRecipe(input.slice(8).trim()); return; }
        // /health — system diagnostics
        if (input === '/health') { await this.showHealth(); return; }

        // /version — show version info
        if (input === '/version') { this.showVersion(); return; }

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

        // ── SMART: Auto-route localhost screenshot tasks via built-in browser ──
        const lower = resolved.toLowerCase();
        const mentionsLocalhost = /localhost:\d+/i.test(resolved) || /127\.0\.0\.1:\d+/i.test(resolved);
        const mentionsBrowse = lower.includes('check') || lower.includes('browse') || lower.includes('look') || lower.includes('open') || lower.includes('see') || lower.includes('verify');
        if (mentionsLocalhost && mentionsBrowse) {
            const portMatch = resolved.match(/localhost:(\d+)/i) || resolved.match(/127\.0\.0\.1:(\d+)/i);
            await this.browseLocalhost(`/browse http://localhost:${portMatch[1]}`);
            return;
        }

        // Track
        const toolId = this.activeTool || this.pickBestTool(resolved);
        const inToks = Math.ceil(resolved.length / 4);
        if (toolId) { this.getAgentTokens(toolId).in += inToks; this.getAgentTokens(toolId).prompts++; }
        this.totalPromptsSent++;
        this.pushToLog({ role: 'user', text: input, ts: Date.now() });

        if (resolved.startsWith('@auto ')) { await this.autoRoute(resolved.slice(6).trim()); return; }
        const mm = resolved.match(/^@(\w+)\s+([\s\S]+)/);
        if (mm) { await this.runPersona(mm[1], mm[2]); return; }

        this.context.addMessage('user', resolved);

        // Auto-offload old context to pantry if conversation is large
        this.autoOffloadContext();

        // Pre-query pantry for relevant context
        const pantryContext = this.pantry.recall(resolved.slice(0, 200));
        if (pantryContext.length > 0) {
            const extra = pantryContext.slice(0, 2).map((s) => s.content.slice(0, 500)).join('\n');
            resolved = `[Recalled context]\n${extra}\n[End recalled context]\n\n${resolved}`;
            console.log(chalk.dim(`  🥫 Recalled ${pantryContext.length} pantry item(s) for context`));
        }

        if (toolId) {
            const availableAgents = this.registry.headless().filter(a => a.available);
            
            let strategy = 'direct';
            let assignedAgent = toolId;

            if (availableAgents.length >= 2 && input.split(/\s+/).length > 8) {
                const routing = await this.getSmartRouting(input);
                strategy = routing.strategy;
                if (routing.agent && availableAgents.some(a => a.id === routing.agent)) {
                    assignedAgent = routing.agent;
                }
            }

            if (strategy === 'subagent') {
                await this.runSubAgents(resolved);
            } else if (strategy === 'team') {
                await this.runAgentTeam(resolved);
            } else {
                // Simple/focused task → single agent (still with auto-delegation parsing)
                this.startSpinner(assignedAgent);
                
                // Supabase Relay: Create order
                this.currentOrderId = randomUUID();
                this.currentOrderStartTime = Date.now();
                const selectedAgent = this.registry.get(assignedAgent);
                await this.relay.createOrder({
                    id: this.currentOrderId,
                    prompt: input,
                    agent: selectedAgent?.id || 'auto',
                    runAgent: assignedAgent,
                    modelPolicy: this.modelPolicy || 'auto'
                });

                const result = await this.orchestrator.runOn(assignedAgent, resolved, this.cwd);

                // Supabase Relay: Complete order
                if (this.currentOrderId) {
                    await this.relay.completeOrder({
                        id: this.currentOrderId,
                        stdout: result?.output || '',
                        stderr: result?.error || '',
                        exitCode: result?.exitCode || 0,
                        durationMs: Date.now() - this.currentOrderStartTime,
                        gradeScore: result?.grade || 0,
                        linesGenerated: (result?.output || '').split('\n').length,
                        tokensUsed: result?.tokensUsed || 0,
                        tokensSaved: result?.tokensSaved || 0
                    });
                    this.currentOrderId = null;
                }

                // Parse response for auto-delegations
                if (result) await this.processDelegations(result, toolId);
            }
        }
        else { console.log(chalk.red('  No kitchens open (install gh (Copilot) or gemini).')); }
    }

    async getSmartRouting(prompt) {
        // Use free Copilot gpt-5-mini model to decide the execution strategy and agent assignment
        console.log(chalk.hex('#888')('  🧠 Smart Router (gpt-5-mini) analyzing task...'));
        try {
            const { spawnSync } = await import('child_process');
            const availableAgents = this.registry.headless().filter(a => a.available).map(a => a.id).join(', ');
            
            // Enhanced prompt to guide the router towards 'team' for complex/architectural requests
            const routerPrompt = `Analyze the following user request.
Available Agents: ${availableAgents}

Determine:
1. "strategy": 
   - "direct": A simple, straightforward task.
   - "subagent": A task with independent parts that can be done in parallel.
   - "team": A task requiring collaborative discussion, architectural planning, or complex multi-persona thinking (e.g. "design a system", "act as a team lead", "orchestrate this project").
2. "primaryAgent": Best agent for this (prefer 'copilot' for logic, 'gemini' for frontend).

Respond ONLY with a JSON object: {"strategy": "direct|subagent|team", "primaryAgent": "agentId"}

Request: "${prompt.slice(0, 1000)}"`;
            
            const out = spawnSync('gh', ['copilot', 'explain', '--model', 'gpt-5-mini', '-p', routerPrompt], { timeout: 15000, encoding: 'utf8' });
            const result = out.stdout || out.stderr || '';
            const match = result.match(/\{\s*"strategy"\s*:\s*"(direct|subagent|team)"\s*,\s*"primaryAgent"\s*:\s*"(\w+)"\s*\}/i);
            if (match) return { strategy: match[1].toLowerCase(), agent: match[2].toLowerCase() };
        } catch { /* ignore error */ }
        return { strategy: 'direct', agent: null };
    }

    /** Detect task complexity level: 0=simple, 1=complex (orchestrate), 2=highly complex (fleet) */
    getTaskComplexity(prompt) {
        const words = prompt.split(/\s+/).length;
        if (words < 8) return 0;
        const multiStepSignals = [
            /\band\b.*\band\b/i,                    // "do X and Y and Z"
            /\bthen\b/i,                             // "first X, then Y"
            /\bfirst\b.*\bthen\b/i,                  // sequential
            /\b(also|additionally|plus)\b/i,          // additive
            /\b(both|all|every|each)\b/i,             // plural scope
            /\b(create|build|implement|design|fix|test|review|plan)\b.*\b(create|build|implement|design|fix|test|review|plan)\b/i,
            /\d+\.\s/,                                // numbered list
            /[-*]\s.*\n[-*]\s/,                       // bullet list
            /\b(full|complete|entire|whole|end-to-end)\b/i,
        ];
        const signalCount = multiStepSignals.filter(r => r.test(prompt)).length;

        // Highly complex: lots of signals, or very long, or explicit parallel/fleet keywords
        const fleetSignals = [
            /\b(simultaneously|parallel|concurrently)\b/i,
            /\b(multiple|several|different)\b.*\b(files|pages|components|features|services)\b/i,
            /\b(frontend|backend|database|api|ui|server|client)\b.*\b(frontend|backend|database|api|ui|server|client)\b/i,
        ];
        const fleetCount = fleetSignals.filter(r => r.test(prompt)).length;

        if ((signalCount >= 4 && words > 30) || fleetCount >= 2 || words > 100) return 2; // fleet
        if (signalCount >= 2 || words > 50) return 1; // orchestrate
        return 0; // simple
    }

    /** Legacy compat wrapper */
    isComplexTask(prompt) { return this.getTaskComplexity(prompt) >= 1; }

    /** Orchestrate multi-agent execution: decompose → assign → parallel run → merge */
    async orchestrateMultiAgent(prompt, primaryToolId) {
        const available = this.registry.headless().filter(a => a.available);
        const agentNames = available.map(a => `${a.icon} ${a.id}`).join(', ');
        console.log(chalk.hex('#A855F7')(`\n  ⚡ Multi-Agent Orchestration (${available.length} kitchens: ${agentNames})`));

        // Step 1: Try to decompose the task into sub-tasks
        let tasks;
        try {
            console.log(chalk.dim('  🔍 Analyzing task complexity…'));
            tasks = await this.orchestrator.decompose(prompt);
        } catch {
            tasks = null;
        }

        if (!tasks || tasks.length <= 1) {
            // Can't decompose → use best persona matching + auto-delegation
            console.log(chalk.dim('  → Single-focus task, using smart routing with auto-delegation'));
            this.startSpinner(primaryToolId);
            const result = await this.orchestrator.routeAndRun(prompt, this.cwd);
            if (result) await this.processDelegations(result, primaryToolId);
            return;
        }

        // Step 2: Assign each sub-task to the best-matching agent
        console.log(chalk.hex('#4ECDC4')(`  📋 Decomposed into ${tasks.length} sub-tasks:\n`));
        const assignments = tasks.map((task, i) => {
            const toolId = this.pickAgentForTask(task.prompt || task.title, available) || primaryToolId;
            const toolAgent = this.registry.get(toolId);
            console.log(chalk.hex('#4ECDC4')(`  ${i + 1}. `) + chalk.hex(toolAgent?.color || '#888')(`${toolAgent?.icon || '○'} ${toolId}`) + chalk.dim(` — ${task.title}`));
            return { ...task, toolId };
        });

        // Step 3: Run all sub-tasks in parallel
        console.log(chalk.dim(`\n  ─── Parallel dispatch (${assignments.length} agents) ──────────────────────`));
        const startTime = Date.now();

        const results = await Promise.allSettled(
            assignments.map(a => {
                this.getAgentTokens(a.toolId).prompts++;
                return this.orchestrator.runOn(a.toolId, a.prompt, this.cwd);
            })
        );

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        let successCount = 0;
        const outputs = [];

        for (let i = 0; i < results.length; i++) {
            const r = results[i];
            const a = assignments[i];
            if (r.status === 'fulfilled') {
                successCount++;
                outputs.push(r.value);
                console.log(chalk.green(`  ✔ ${a.title}`) + chalk.dim(` (${a.toolId})`));
            } else {
                console.log(chalk.red(`  ✖ ${a.title}: ${r.reason?.message}`) + chalk.dim(` (${a.toolId})`));
            }
        }

        console.log(chalk.hex('#4ECDC4')(`\n  ⚡ ${successCount}/${assignments.length} completed in ${elapsed}s`));

        // Step 4: Process auto-delegations from ALL outputs
        for (const output of outputs) {
            if (output) await this.processDelegations(output, 'orchestrator');
        }
    }

    // ── Fleet: Hidden Parallel Workers ───────────────────────────────────────

    /** Spawn a fleet of hidden background CLI workers for parallel execution */
    /** Pick the best agent for a specific sub-task based on its content and credit tier logic */
    pickAgentForTask(taskText, available, forceZeroCost = true) {
        const lower = (taskText || '').toLowerCase();

        // Gemini excels at: UI, design, frontend, creative, visual, CSS, HTML, images
        const geminiSignals = /\b(ui|design|frontend|front-end|css|html|layout|visual|creative|style|color|animation|svg|image|icon|logo|illustration|landing|page|component|react|tailwind|responsive)\b/i;

        // Copilot excels at: backend, API, database, logic, server, auth, testing, debugging, infrastructure
        const copilotSignals = /\b(backend|back-end|api|database|db|server|auth|login|security|test|debug|fix|bug|deploy|docker|ci|cd|node|express|route|endpoint|middleware|schema|migration|infrastructure|devops|config)\b/i;

        const geminiScore = (lower.match(geminiSignals) || []).length;
        const copilotScore = (lower.match(copilotSignals) || []).length;

        const gemini = available.find(a => a.id === 'gemini');
        const copilot = available.find(a => a.id === 'copilot');
        const ollama = available.find(a => a.id === 'ollama');

        let picked = copilot || available[0];
        if (geminiScore > copilotScore && gemini) picked = gemini;
        if (copilotScore > geminiScore && copilot) picked = copilot;

        // Force zero-cost local fallback if credits are meant to be saved or explicitly zero-cost
        if (forceZeroCost && picked.id === 'copilot') {
             // We inject a flag that we should use a 0x model
             picked._forceModel = 'gpt-5-mini';
        }

        return picked;
    }

    async runSubAgents(prompt) {
        const { spawn } = await import('child_process');
        const available = this.registry.headless().filter(a => a.available);
        if (available.length === 0) return console.log(chalk.red('  No kitchens available.'));

        // Step 1: Decompose (using orchestrator which already uses gpt-5-mini)
        console.log(chalk.hex('#A855F7')(`\n  🧬 Sub-Agent Workflow — decomposing task into atomic steps…`));
        let tasks;
        try { 
            tasks = await this.orchestrator.decompose(prompt); 
        } catch { 
            tasks = [{ title: 'Execute task', prompt: prompt }]; 
        }
        
        console.log(chalk.dim(`  Generated ${tasks.length} sub-tasks.`));

        // Step 2: Plan
        console.log(chalk.hex('#A855F7')(`  📝 Creating implementation plan…`));
        let plan = '';
        try {
            const planPrompt = `Create a high-level technical implementation plan for these tasks. Be surgical and precise. 
Original request: "${prompt}"
Tasks:
${tasks.map((t, i) => `${i + 1}. ${t.title}: ${t.prompt}`).join('\n')}

Implementation Plan:`;
            
            // Call gpt-5-mini for planning
            const { execSync } = await import('child_process');
            const planOut = execSync(`gh copilot explain --model gpt-5-mini -p ${JSON.stringify(planPrompt)}`, { timeout: 20000, encoding: 'utf8' });
            plan = planOut.toString().trim();
            console.log(chalk.dim(plan.slice(0, 500) + '...'));
        } catch {
            plan = 'Execute tasks in parallel.';
        }

        // Step 3: Execute via Sub-Agents
        const workerCount = Math.min(tasks.length, 4);
        console.log(chalk.hex('#4ECDC4')(`\n  📡 Spawning ${workerCount} isolated sub-agents based on the plan…\n`));

        const promises = tasks.slice(0, workerCount).map((task, i) => {
            return new Promise((resolve) => {
                const agent = this.pickAgentForTask(task.prompt || task.title, available, true);
                console.log(chalk.hex(agent.color || '#888')(`  ${i + 1}. Sub-agent [${agent.id}]`) + chalk.dim(` — ${task.title}`));
                
                const taskWithPlan = `Plan Context: ${plan}\n\nYour specific sub-task: ${task.prompt || task.title}`;
                const args = (agent.build_args || []).map(a => a === '{prompt}' ? taskWithPlan : a);
                
                // Smart model routing: Force fast 0x model for sub-agents
                if (agent._forceModel && !args.includes('--model')) args.push('--model', agent._forceModel);
                else if (agent.id === 'copilot' && !args.includes('--model')) args.push('--model', 'gpt-5-mini');

                const proc = spawn(agent.binary, args, { cwd: this.cwd || process.cwd() });
                let out = '';
                proc.stdout.on('data', d => out += d.toString());
                proc.stderr.on('data', d => out += d.toString());
                proc.on('close', (code) => {
                    resolve({ task: task.title, output: out, code });
                });
            });
        });

        const results = await Promise.all(promises);
        
        console.log(chalk.hex('#A855F7')(`\n  🧠 Synthesis Phase — synthesizing sub-agent reports…\n`));
        let synthesisPrompt = `I delegated a complex task into sub-tasks. Here is the implementation plan and the results from each sub-agent:\n\n`;
        synthesisPrompt += `Implementation Plan: ${plan}\n\n`;
        results.forEach((r, i) => {
            synthesisPrompt += `--- Sub-Task [${i + 1}]: ${r.task} ---\n${r.output.trim()}\n\n`;
        });
        synthesisPrompt += `Based on these reports, provide a final, cohesive synthesis and completion of the original task: "${prompt}"`;
        
        await this.handleInput(synthesisPrompt, false); 
    }

    async runAgentTeam(prompt) {
        console.log(chalk.hex('#4ECDC4')(`\n  👥 Agent Team Workflow — starting collaborative discussion…\n`));
        
        const teamMembers = [
            { role: 'Architect', goal: 'Design the technical structure and choose patterns.' },
            { role: 'Developer', goal: 'Detail the implementation logic and write code snippets.' },
            { role: 'QA', goal: 'Identify potential edge cases, security risks, and bugs.' }
        ];
        
        let discussionHistory = `Problem to solve: "${prompt}"\n\n`;
        const available = this.registry.headless().filter(a => a.available);
        if (available.length === 0) return console.log(chalk.red('  No kitchens available.'));
        
        const { spawn } = await import('child_process');

        // Linear discussion loop (3 turns)
        for (const member of teamMembers) {
            console.log(chalk.hex('#A855F7')(`  🗣️  ${member.role} is contributing to the plan…`));
            
            const turnPrompt = `We are a collaborative agent team.
Context so far:
${discussionHistory}

Your Role: ${member.role}
Your specific goal: ${member.goal}

Provide your expert input. Build upon what others have said. If you disagree, explain why. Keep it surgical.`;
            
            const agent = this.pickAgentForTask(turnPrompt, available, true);
            const args = (agent.build_args || []).map(a => a === '{prompt}' ? turnPrompt : a);
            if (agent.id === 'copilot' && !args.includes('--model')) args.push('--model', 'gpt-5-mini');
            
            const out = await new Promise(resolve => {
                const proc = spawn(agent.binary, args, { cwd: this.cwd || process.cwd() });
                let text = '';
                proc.stdout.on('data', d => { text += d.toString(); });
                proc.stderr.on('data', d => { text += d.toString(); });
                proc.on('close', () => resolve(text));
            });
            
            discussionHistory += `\n[${member.role} Input]:\n${out.trim()}\n`;
        }
        
        console.log(chalk.hex('#4ECDC4')(`\n  🧠 Final Synthesis — merging team intelligence…\n`));
        
        const finalSynthesisPrompt = `Review the following team discussion and produce the absolute best final implementation plan and result.
        
Team Discussion:
${discussionHistory}

Original Request: "${prompt}"`;

        await this.handleInput(finalSynthesisPrompt, false);
    }

    async spawnFleet(prompt) {
        const { spawn } = await import('child_process');
        const available = this.registry.headless().filter(a => a.available);
        if (available.length === 0) {
            console.log(chalk.red('  No kitchens available for fleet deployment.'));
            return;
        }

        // Decompose the task first
        let tasks;
        try {
            console.log(chalk.hex('#A855F7')(`\n  🚀 Fleet Deployment — analyzing task…`));
            tasks = await this.orchestrator.decompose(prompt);
        } catch { tasks = null; }

        if (!tasks || tasks.length <= 1) {
            tasks = [{ title: 'Execute task', description: prompt }];
        }

        const workerCount = Math.min(tasks.length, available.length, 4);
        const workers = [];
        if (!this._fleet) this._fleet = [];

        console.log(chalk.hex('#4ECDC4')(`  📡 Deploying ${workerCount} hidden workers…\n`));

        for (let i = 0; i < workerCount; i++) {
            const task = tasks[i];
            const taskPrompt = task.description || task.title || prompt;
            // Smart assignment: match task content to best agent
            const agent = this.pickAgentForTask(taskPrompt, available);

            console.log(chalk.hex(agent.color || '#888')(`  ${i + 1}. ${agent.icon} ${agent.id}`) + chalk.dim(` — ${task.title}`));

            // Build CLI args for the agent
            const args = (agent.build_args || []).map(a => a === '{prompt}' ? taskPrompt : a);

            // Apply saved model pref
            const savedModel = this.modelPrefs[agent.id] || this.modelPrefs.auto;
            if (savedModel && agent.id === 'copilot' && !args.includes('--model')) {
                args.push('--model', savedModel);
            }

            const worker = {
                id: `fleet-${Date.now()}-${i}`,
                agentId: agent.id,
                task: task.title,
                startTime: Date.now(),
                status: 'running',
                output: '',
                proc: null,
            };

            // Notify dashboard via orchestrator
            this.orchestrator.emit('fleet-worker-start', {
                id: worker.id,
                agentId: worker.agentId,
                task: worker.task,
                startTime: worker.startTime
            });

            const proc = spawn(agent.binary, args, {
                cwd: this.cwd || process.cwd(),
                env: { ...process.env },
                stdio: ['pipe', 'pipe', 'pipe'],
            });

            worker.proc = proc;

            proc.stdout.on('data', (data) => { worker.output += data.toString(); });
            proc.stderr.on('data', (data) => { worker.output += data.toString(); });
            proc.on('close', (code) => {
                worker.status = code === 0 ? 'done' : 'failed';
                worker.endTime = Date.now();
                worker.duration = worker.endTime - worker.startTime;

                // Notify dashboard via orchestrator
                this.orchestrator.emit('fleet-worker-done', {
                    id: worker.id,
                    agentId: worker.agentId,
                    task: worker.task,
                    status: worker.status,
                    startTime: worker.startTime,
                    endTime: worker.endTime,
                    duration: worker.duration
                });

                // Auto-report when done
                const completed = this._fleet.filter(w => w.status !== 'running').length;
                const total = this._fleet.length;
                if (completed === total) {
                    console.log(chalk.hex('#A855F7')(`\n  🚀 Fleet Complete — all ${total} workers finished`));
                    this._fleet.forEach((w, j) => {
                        const icon = w.status === 'done' ? chalk.green('✔') : chalk.red('✖');
                        const dur = w.duration ? `${(w.duration / 1000).toFixed(1)}s` : '?';
                        console.log(`  ${icon} ${w.task}` + chalk.dim(` (${w.agentId}, ${dur})`));
                    });
                    console.log(chalk.dim(`\n  /fleet to see full output from each worker\n`));
                    this.renderPrompt();
                }
            });
            proc.on('error', (err) => { worker.status = 'failed'; worker.output += err.message; });

            workers.push(worker);
            this._fleet.push(worker);
        }

        console.log(chalk.dim(`\n  Workers are running in the background. You can keep working.`));
        console.log(chalk.dim(`  Type /fleet to check status or see results.\n`));
    }

    /** Show fleet status and results */
    showFleetStatus() {
        if (!this._fleet || this._fleet.length === 0) {
            console.log(chalk.dim('\n  🚀 No fleet workers deployed. Use /fleet "prompt" to launch.\n'));
            return;
        }

        console.log(chalk.hex('#A855F7').bold(`\n  🚀 Fleet Status — ${this._fleet.length} workers\n`));

        for (const w of this._fleet) {
            const dur = w.duration ? `${(w.duration / 1000).toFixed(1)}s` : `${((Date.now() - w.startTime) / 1000).toFixed(0)}s…`;
            if (w.status === 'running') {
                console.log(chalk.yellow(`  ⏳ ${w.task}`) + chalk.dim(` (${w.agentId}, ${dur})`));
            } else if (w.status === 'done') {
                console.log(chalk.green(`  ✔ ${w.task}`) + chalk.dim(` (${w.agentId}, ${dur})`));
                // Show truncated output
                const lines = w.output.trim().split('\n').filter(Boolean);
                if (lines.length > 0) {
                    const preview = lines.slice(-3).map(l => chalk.dim(`    ${l.slice(0, 100)}`)).join('\n');
                    console.log(preview);
                }
            } else {
                console.log(chalk.red(`  ✖ ${w.task}`) + chalk.dim(` (${w.agentId}, ${dur})`));
                if (w.output) console.log(chalk.dim(`    ${w.output.trim().slice(0, 200)}`));
            }
        }

        const running = this._fleet.filter(w => w.status === 'running').length;
        const done = this._fleet.filter(w => w.status === 'done').length;
        const failed = this._fleet.filter(w => w.status === 'failed').length;
        console.log(chalk.dim(`\n  ${running} running · ${done} done · ${failed} failed`));
        console.log(chalk.dim(`  /fleet peek <number> — view full output from a worker\n`));
    }

    /** View full output from a specific fleet worker */
    peekFleetWorker(arg) {
        if (!this._fleet || this._fleet.length === 0) {
            console.log(chalk.dim('\n  No fleet workers. Use /fleet "prompt" or just type a complex task.\n'));
            return;
        }
        const idx = parseInt(arg) - 1;
        if (isNaN(idx) || idx < 0 || idx >= this._fleet.length) {
            console.log(chalk.dim(`  Usage: /fleet peek <1-${this._fleet.length}>`));
            return;
        }
        const w = this._fleet[idx];
        const dur = w.duration ? `${(w.duration / 1000).toFixed(1)}s` : `${((Date.now() - w.startTime) / 1000).toFixed(0)}s…`;
        const statusIcon = w.status === 'done' ? chalk.green('✔') : w.status === 'running' ? chalk.yellow('⏳') : chalk.red('✖');

        console.log(chalk.hex('#A855F7').bold(`\n  🔍 Fleet Worker #${idx + 1} — ${w.task}`));
        console.log(chalk.dim(`  Agent: ${w.agentId} · Status: ${w.status} · Duration: ${dur}\n`));
        console.log(chalk.hex('#555')('  ┄'.repeat(25)));

        if (w.output) {
            // Show full output, line by line
            const lines = w.output.split('\n');
            for (const line of lines) {
                console.log(`  ${line}`);
            }
        } else {
            console.log(chalk.dim('  (no output yet)'));
        }

        console.log(chalk.hex('#555')('  ┄'.repeat(25)));
        console.log();
    }

    /** Refresh available models across ALL tools (Copilot + Gemini + Ollama) — runs daily */
    async refreshAllModels() {
        const { execSync } = await import('child_process');

        // 1. Copilot models
        try {
            const errStr = (() => {
                try { return execSync('gh copilot -- -p "test" --model INVALID 2>&1', { timeout: 10000, encoding: 'utf8' }); }
                catch (e) { return e.stderr?.toString() || e.stdout?.toString() || e.message || ''; }
            })();
            const match = errStr.match(/Allowed choices are (.+)/);
            if (match) {
                const models = match[1].split(', ').map(s => s.trim().replace(/\.$/, '')).filter(Boolean);
                const currentIds = COPILOT_MODELS.map(m => m.id);
                const newModels = models.filter(m => !currentIds.includes(m));
                if (newModels.length > 0) {
                    console.log(chalk.hex('#4ECDC4')(`  🔪 Model: gpt-4.1`));
                }
            }
        } catch {}

        // 2. Gemini models
        try {
            const out = execSync('gemini --list-models 2>&1', { timeout: 10000, encoding: 'utf8' });
            const geminiIds = out.split('\n').map(l => l.trim()).filter(l => l.startsWith('gemini-'));
            const currentGemini = GEMINI_MODELS.map(m => m.id);
            const newGemini = geminiIds.filter(m => !currentGemini.includes(m));
            if (newGemini.length > 0) {
                for (const nm of newGemini) GEMINI_MODELS.push({ id: nm, desc: 'New' });
                console.log(chalk.hex('#FFD93D')(`  🆕 New Gemini models: ${newGemini.join(', ')}`));
            }
        } catch {}

        // 3. Ollama models (if running)
        try {
            const resp = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(3000) });
            if (resp.ok) {
                const data = await resp.json();
                const ollamaIds = (data.models || []).map(m => m.name);
                const currentOllama = OLLAMA_MODELS.map(m => m.id);
                const newOllama = ollamaIds.filter(m => !currentOllama.includes(m));
                if (newOllama.length > 0) {
                    for (const nm of newOllama) OLLAMA_MODELS.push({ id: nm, desc: 'Local' });
                    console.log(chalk.hex('#FFD93D')(`  🆕 New Ollama models: ${newOllama.join(', ')}`));
                }
            }
        } catch {}
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

    // ── Pantry (Context Storage) ────────────────────────────────────────────
    showPantry() {
        const status = this.pantry.getStatus();
        const W = 56;
        const line = '─'.repeat(W);
        console.log();
        console.log(chalk.hex('#555')(`  ╭${line}╮`));
        console.log(chalk.hex('#555')('  │') + chalk.bold('  🥫 Pantry') + ' '.repeat(W - 27 - String(status.count).length - String(status.maxItems).length) + chalk.hex('#4ECDC4')(`${status.count}/${status.maxItems} stocked`) + chalk.hex('#555')('  │'));
        console.log(chalk.hex('#555')(`  │${line}│`));
        if (status.items.length === 0) {
            console.log(chalk.hex('#555')('  │') + chalk.dim('  Pantry empty. Context auto-stocks when full.') + ' '.repeat(8) + chalk.hex('#555')('│'));
        } else {
            for (const s of status.items) {
                const label = s.label.length > 35 ? s.label.slice(0, 34) + '…' : s.label;
                const right = chalk.dim(`${s.tokens} tok`);
                const spacer = Math.max(1, W - 6 - label.length - String(s.tokens).length - 4);
                console.log(chalk.hex('#555')('  │') + `  📦 ${chalk.hex('#CCC')(label)}` + ' '.repeat(spacer) + right + chalk.hex('#555')('│'));
            }
        }
        console.log(chalk.hex('#555')(`  │${line}│`));
        console.log(chalk.hex('#555')('  │') + chalk.dim(`  Total: ${status.totalTokens.toLocaleString()} tokens across ${status.count} items`) + ' '.repeat(Math.max(0, W - 47 - String(status.totalTokens).length)) + chalk.hex('#555')('│'));
        console.log(chalk.hex('#555')(`  ╰${line}╯`));
        console.log(chalk.dim(`\n  /stock store <text>  │  /stock recall <query>  │  /pantry max <N>\n`));
    }

    pantryStore(text) {
        if (!text) { console.log(chalk.dim('  Usage: /stock store <text to remember>')); return; }
        const item = this.pantry.store('manual', text);
        console.log(chalk.green(`  📦 Stocked in pantry #${item.id} (${item.tokens} tokens)`));
    }

    pantryRecall(query) {
        if (!query) { console.log(chalk.dim('  Usage: /stock recall <what to find>')); return; }
        const results = this.pantry.recall(query);
        if (!results.length) { console.log(chalk.dim('  Nothing matching in the pantry.')); return; }
        console.log(chalk.bold(`\n  🔍 Found ${results.length} pantry item(s)\n`));
        for (const r of results.slice(0, 3)) {
            console.log(chalk.hex('#4ECDC4')(`  📦 Item #${r.id}`) + chalk.dim(` (${r.label}, score:${r.score})`));
            console.log(chalk.dim(`  ${r.content.slice(0, 200).replace(/\n/g, ' ')}…\n`));
        }
    }

    setPantryMax(val) {
        const n = parseInt(val, 10);
        if (!n || n < 1) { console.log(chalk.dim('  Usage: /pantry max <number>')); return; }
        this.pantry.setMaxItems(n);
        console.log(chalk.green(`  🥫 Pantry capacity set to ${n} items`));
    }

    /** Start Cloud Kitchen remote server (auto-starts, OTP auto-refreshes) */
    async startCloudKitchen(showBanner = true) {
        if (this._cloudKitchen) {
            if (showBanner) {
                const code = this._cloudKitchen.getCode();
                const remaining = code?.expiresAt ? Math.max(0, Math.round((code.expiresAt - Date.now()) / 1000)) : '?';
                console.log(chalk.hex('#e94560')(`\n  ☁️  Cloud Kitchen — Remote Stove`));
                console.log(chalk.hex('#FFD93D')(`  🔑  Order Number: ${code?.code || 'generating...'}`));
                console.log(chalk.dim(`      Expires in ${remaining}s — auto-refreshes every 5 minutes`));
                console.log(chalk.dim(`      Port: ${this._cloudKitchen.port}`));
                const ips = this._cloudKitchen.localIPs || [];
                if (ips.length > 0) console.log(chalk.hex('#4ECDC4')(`      LAN IP: ${ips[0]}:${this._cloudKitchen.port}`));
                // Show connected clients
                const conns = this._cloudKitchen.getConnections?.() || [];
                if (conns.length > 0) {
                    const icons = { 'mobile-ide': '📱', 'browser-extension': '🔌' };
                    const parts = conns.map(c => `${icons[c.clientType] || '○'} ${c.clientType}`);
                    console.log(chalk.hex('#4ECDC4')(`      Connected: ${parts.join(', ')}`));
                } else {
                    console.log(chalk.dim(`      No clients connected`));
                }
                console.log(chalk.dim(`      📱 Enter code in mobile app | 🔌 Enter code in browser extension`));
                if (this._tunnel) {
                    console.log(chalk.hex('#4ECDC4')(`      🌍 Tunnel: ${this._tunnel.url}`));
                } else {
                    console.log(chalk.dim(`      🌍 /tunnel to access from any network`));
                }
                console.log();
            }
            return;
        }

        try {
            const serverPath = new URL('../packages/remote-server/src/index.js', import.meta.url).href;
            const { startRemoteServer } = await import(serverPath);
            const result = await startRemoteServer(7070, { silent: true });
            if (result) {
                this._cloudKitchen = result;
                if (showBanner) {
                    const code = result.getCode();
                    const ips = result.localIPs || [];
                    console.log(chalk.hex('#e94560')(`\n  ☁️  Cloud Kitchen — Remote Stove`));
                    console.log(chalk.hex('#FFD93D')(`  🔑  Order Number: ${code?.code || 'generating...'}`));
                    console.log(chalk.dim(`      Auto-refreshes every 5 minutes`));
                    console.log(chalk.dim(`      Port: ${result.port}`));
                    if (ips.length > 0) console.log(chalk.hex('#4ECDC4')(`      LAN IP: ${ips[0]}:${result.port}`));
                    if (this._tunnel) {
                        console.log(chalk.hex('#4ECDC4')(`      🌍 Tunnel: ${this._tunnel.url}`));
                    } else {
                        console.log(chalk.dim(`      🌍 Tunnel auto-starting…`));
                    }
                    console.log(chalk.dim(`      📱 Enter IP + code in mobile app | 🔌 Enter code in browser extension\n`));
                }
            }
        } catch (err) {
            if (showBanner) {
                console.log(chalk.red(`  ✖ Cloud Kitchen failed to start: ${err.message}`));
                console.log(chalk.dim(`    Try: cd packages/remote-server && npm install`));
            }
        }
    }

    /** Expose Cloud Kitchen publicly via tunnel (silent=true for auto-start, no spam) */
    async startTunnel(silent = false) {
        if (!this._cloudKitchen) {
            if (!silent) console.log(chalk.dim('\n  Starting Cloud Kitchen first…'));
            await this.startCloudKitchen(false);
        }
        if (!this._cloudKitchen) {
            if (!silent) console.log(chalk.red('  ✖ Cloud Kitchen must be running. Try /cloud-kitchen first.'));
            return;
        }
        if (this._tunnel) {
            if (!silent) {
                console.log(chalk.hex('#e94560')(`\n  🌍 Tunnel Active`));
                console.log(chalk.hex('#4ECDC4')(`      Public URL: ${this._tunnel.url}`));
                console.log(chalk.dim(`      Local: localhost:${this._cloudKitchen.port}`));
                console.log(chalk.dim(`      📱 Use this URL in the mobile app instead of LAN IP\n`));
            }
            return;
        }
        const port = this._cloudKitchen.port;
        const { execSync, spawn } = await import('child_process');
        const log = silent ? () => {} : (...a) => console.log(...a);

        // Try cloudflared first (Cloudflare Tunnel — best option, free)
        try {
            execSync('which cloudflared', { stdio: 'ignore' });
            log(chalk.dim('\n  🌍 Starting Cloudflare Tunnel…'));
            const proc = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${port}`], { stdio: ['ignore', 'pipe', 'pipe'] });
            const extractUrl = (data) => {
                const match = data.toString().match(/https?:\/\/[^\s]+\.trycloudflare\.com/);
                if (match) {
                    this._tunnel = { url: match[0], proc, type: 'cloudflared' };
                    // Always show tunnel URL — this is important info even on auto-start
                    process.stdout.write('\r' + chalk.hex('#4ECDC4')(`  🌍 Tunnel: ${match[0]}`) + '\n');
                    this.renderPrompt();
                    proc.stderr.removeListener('data', extractUrl);
                    proc.stdout.removeListener('data', extractUrl);
                }
            };
            proc.stdout.on('data', extractUrl);
            proc.stderr.on('data', extractUrl);
            proc.on('error', () => {});
            await new Promise(r => setTimeout(r, 5000));
            if (!this._tunnel && !silent) console.log(chalk.dim('  ⏳ Tunnel is starting… URL will appear shortly.\n'));
            return;
        } catch {}

        // Try ngrok
        try {
            execSync('which ngrok', { stdio: 'ignore' });
            log(chalk.dim('\n  🌍 Starting ngrok tunnel…'));
            const proc = spawn('ngrok', ['http', String(port), '--log=stdout'], { stdio: ['ignore', 'pipe', 'pipe'] });
            proc.stdout.on('data', (data) => {
                const match = data.toString().match(/url=(https?:\/\/[^\s]+)/);
                if (match && !this._tunnel) {
                    this._tunnel = { url: match[1], proc, type: 'ngrok' };
                    process.stdout.write('\r' + chalk.hex('#4ECDC4')(`  🌍 Tunnel: ${match[1]}`) + '\n');
                    this.renderPrompt();
                }
            });
            proc.on('error', () => {});
            await new Promise(r => setTimeout(r, 5000));
            if (!this._tunnel && !silent) console.log(chalk.dim('  ⏳ Tunnel is starting… URL will appear shortly.\n'));
            return;
        } catch {}

        // Fallback: SSH tunnel via localhost.run (free, no install)
        if (!silent) {
            console.log(chalk.dim('\n  🌍 Starting SSH tunnel via localhost.run…'));
            console.log(chalk.dim('      (No cloudflared or ngrok found — using free SSH tunnel)'));
        }
        try {
            const proc = spawn('ssh', ['-R', `80:localhost:${port}`, '-o', 'StrictHostKeyChecking=no', 'nokey@localhost.run'], { stdio: ['ignore', 'pipe', 'pipe'] });
            proc.stdout.on('data', (data) => {
                const match = data.toString().match(/(https?:\/\/[^\s]+\.localhost\.run)/);
                if (match && !this._tunnel) {
                    this._tunnel = { url: match[1], proc, type: 'localhost.run' };
                    process.stdout.write('\r' + chalk.hex('#4ECDC4')(`  🌍 Tunnel: ${match[1]}`) + '\n');
                    this.renderPrompt();
                }
            });
            proc.on('error', () => {
                if (!silent) {
                    console.log(chalk.yellow('\n  ⚠ No tunnel tools found. Install one:'));
                    console.log(chalk.dim('      brew install cloudflared   (recommended, free)'));
                    console.log(chalk.dim('      brew install ngrok\n'));
                }
            });
            await new Promise(r => setTimeout(r, 6000));
            if (!this._tunnel && !silent) {
                console.log(chalk.yellow('\n  ⚠ SSH tunnel timed out. Install a dedicated tool:'));
                console.log(chalk.dim('      brew install cloudflared   (recommended, free)'));
                console.log(chalk.dim('      brew install ngrok\n'));
            }
        } catch {
            if (!silent) {
                console.log(chalk.yellow('\n  ⚠ No tunnel tools available. Install one:'));
                console.log(chalk.dim('      brew install cloudflared   (recommended, free)'));
                console.log(chalk.dim('      brew install ngrok\n'));
            }
        }
    }

    /** Open the stall monitor dashboard in the browser */
    openDashboard() {
        if (!this.kitchenMonitor) {
            console.log(chalk.red('  Kitchen monitor not initialized'));
            return;
        }
        const dashDir = this.kitchenMonitor.getDashboardDir();
        const htmlSrc = new URL('../src/dashboard/index.html', import.meta.url).pathname;
        try { copyFileSync(htmlSrc, join(dashDir, 'index.html')); } catch { }
        
        // Start a tiny HTTP server to serve the dashboard
        import('http').then(http => {
            const server = http.createServer((req, res) => {
                const url = req.url.split('?')[0]; // strip query params
                
                // API: list all stall session files
                if (url === '/api/stalls') {
                    try {
                        const files = readdirSync(dashDir).filter(f => f.startsWith('stall-') && f.endsWith('.json'));
                        const stalls = files.map(f => {
                            try {
                                const data = JSON.parse(readFileSync(join(dashDir, f), 'utf8'));
                                return { file: f, sessionId: data.sessionId, name: data.stall?.name, status: data.stall?.status };
                            } catch { return { file: f, sessionId: f, name: f, status: 'unknown' }; }
                        });
                        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                        res.end(JSON.stringify(stalls));
                    } catch {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end('[]');
                    }
                    return;
                }
                
                // Map stall-state.json → current session's state file
                const resolvedFile = (url === '/stall-state.json')
                    ? `stall-${this.kitchenMonitor.sessionId}.json`
                    : (url === '/' || url === '/index.html' ? 'index.html' : url.slice(1));
                const file = resolvedFile;
                const filePath = join(dashDir, file);
                try {
                    const content = readFileSync(filePath);
                    const ct = file.endsWith('.json') ? 'application/json' : 'text/html';
                    res.writeHead(200, { 'Content-Type': ct, 'Access-Control-Allow-Origin': '*' });
                    res.end(content);
                } catch {
                    res.writeHead(404);
                    res.end('Not found');
                }
            });
            server.listen(0, () => {
                const port = server.address().port;
                const dashUrl = `http://localhost:${port}`;
                console.log(chalk.hex('#4ECDC4')(`  📺 Stall Monitor live at ${dashUrl}`));
                console.log(chalk.dim(`  Session: ${this.kitchenMonitor.sessionId}`));
                console.log(chalk.dim(`  State: ${this.kitchenMonitor.getStatePath()}`));
                if (this.kitchenMonitor.dashboardHtml) {
                    console.log(chalk.dim(`  Dashboard: ${this.kitchenMonitor.dashboardHtml}`));
                }
                import('child_process').then(cp => {
                    const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
                    cp.exec(`${cmd} "${dashUrl}"`);
                });
            });
            this._dashboardServer = server;
        });
    }

    /** Auto-offload old context to pantry when conversation gets large */
    autoOffloadContext() {
        if (this.conversationLog.length > 50) {
            const old = this.conversationLog.splice(0, 20);
            const text = old.map((m) => `[${m.role}] ${m.text}`).join('\n');
            this.pantry.offload('auto-context', text);
            console.log(chalk.dim(`  📦 Auto-stocked 20 messages in pantry`));
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

    // ── /user — user auth (Supabase) ─────────────────────────────────────────
    async handleUserAuth(input) {
        const parts = input.trim().split(/\s+/);
        const sub = parts[1];
        const rest = parts.slice(2);
        if (sub === 'signup' || sub === 'login') {
            const [email, password] = rest;
            if (!email || !password) { console.log(chalk.dim(`  Usage: /user ${sub} <email> <password>`)); return; }
            const result = sub === 'signup' ? await this.userAuth.signup(email, password) : await this.userAuth.login(email, password);
            console.log(result.success ? chalk.green(`  ✅ ${sub} successful (${result.mode})`) : chalk.red(`  ❌ ${result.error}`));
            if (result.success && this.userAuth.user) {
                this.relay.setUser(this.userAuth.user.id || this.userAuth.user.email);
                await this.relay.registerMachine();
            }
        } else if (sub === 'logout') {
            await this.userAuth.logout();
            console.log(chalk.green('  ✅ Logged out'));
        } else {
            const user = this.userAuth?.getUser();
            console.log(user ? chalk.hex('#4ECDC4')(`  👤 ${user.email} (${user.mode}) — since ${user.createdAt}`) : chalk.red('  ❌ Not logged in'));
        }
    }

    // ── /mcp — MCP server management ─────────────────────────────────────────
    async handleMcp(input) {
        if (!this.mcpClient) { console.log(chalk.red('  ❌ MCP client not available')); return; }
        const parts = input.replace('/mcp', '').trim().split(/\s+/);
        const sub = parts[0] || 'list';

        if (sub === 'list') {
            const servers = this.mcpClient.list();
            if (!servers.length) { console.log(chalk.dim('  No MCP servers registered. Use /mcp register <name> <command> [args...]')); return; }
            console.log(chalk.hex('#FFD93D')('  🔌 MCP Servers:'));
            for (const s of servers) {
                const status = s.connected ? chalk.green('● connected') : chalk.dim('○ disconnected');
                console.log(`    ${status} ${chalk.bold(s.name)} — ${s.command} ${(s.args || []).join(' ')}`);
            }
        } else if (sub === 'register') {
            const name = parts[1];
            const command = parts[2];
            const args = parts.slice(3);
            if (!name || !command) { console.log(chalk.dim('  Usage: /mcp register <name> <command> [args...]')); return; }
            this.mcpClient.register(name, { command, args });
            console.log(chalk.green(`  ✅ Registered MCP server "${name}": ${command} ${args.join(' ')}`));
        } else if (sub === 'connect') {
            const name = parts[1];
            if (!name) { console.log(chalk.dim('  Usage: /mcp connect <name>')); return; }
            try {
                console.log(chalk.dim(`  Connecting to ${name}...`));
                const conn = await this.mcpClient.connect(name);
                console.log(chalk.green(`  ✅ Connected to "${name}" — ${conn.tools.length} tools available`));
                for (const t of conn.tools) {
                    console.log(chalk.dim(`    🔧 ${t.name}: ${t.description || ''}`));
                }
            } catch (err) { console.log(chalk.red(`  ❌ ${err.message}`)); }
        } else if (sub === 'tools') {
            const tools = this.mcpClient.allTools();
            if (!tools.length) { console.log(chalk.dim('  No tools available. Connect to a server first: /mcp connect <name>')); return; }
            console.log(chalk.hex('#FFD93D')('  🔧 Available MCP Tools:'));
            for (const t of tools) {
                console.log(`    ${chalk.bold(t.name)} ${chalk.dim(`[${t.server}]`)} — ${t.description || ''}`);
            }
        } else if (sub === 'call') {
            const serverName = parts[1];
            const toolName = parts[2];
            const argsJson = parts.slice(3).join(' ');
            if (!serverName || !toolName) { console.log(chalk.dim('  Usage: /mcp call <server> <tool> [json_args]')); return; }
            try {
                const args = argsJson ? JSON.parse(argsJson) : {};
                const result = await this.mcpClient.callTool(serverName, toolName, args);
                console.log(chalk.green('  ✅ Result:'));
                console.log(typeof result === 'string' ? result : JSON.stringify(result, null, 2));
            } catch (err) { console.log(chalk.red(`  ❌ ${err.message}`)); }
        } else if (sub === 'disconnect') {
            const name = parts[1];
            if (!name) { console.log(chalk.dim('  Usage: /mcp disconnect <name>')); return; }
            this.mcpClient.disconnect(name);
            console.log(chalk.green(`  ✅ Disconnected from "${name}"`));
        } else if (sub === 'remove') {
            const name = parts[1];
            if (!name) { console.log(chalk.dim('  Usage: /mcp remove <name>')); return; }
            this.mcpClient.unregister(name);
            console.log(chalk.green(`  ✅ Removed MCP server "${name}"`));
        } else {
            console.log(chalk.dim('  Usage: /mcp [list|register|connect|disconnect|tools|call|remove]'));
        }
    }
    async browseLocalhost(input) {
        const url = input.replace('/browse', '').trim() || 'http://localhost:3000';
        console.log(chalk.hex('#4ECDC4')('  🌐 ') + chalk.dim(`browsing ${url}…`));
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
        const allModels = [
            ...GEMINI_MODELS.map(m => ({ ...m, tool: 'gemini', icon: '🔷' })),
            ...COPILOT_MODELS.map(m => ({ ...m, tool: 'copilot', icon: '🐙' })),
        ];

        if (!arg) {
            console.log(chalk.bold('\n  🔪 Utensils (AI Models)\n'));
            console.log(chalk.bold('  🐙 Copilot Models:'));
            for (const m of COPILOT_MODELS) {
                const a = this.activeModel === m.id ? chalk.hex('#FFD93D')(' ← active') : '';
                console.log(`    ${chalk.hex('#4ECDC4')(m.id.padEnd(40))} ${chalk.dim(m.desc)}${a}`);
            }
            console.log(chalk.bold('\n  🔷 Gemini Models:'));
            for (const m of GEMINI_MODELS) {
                const a = this.activeModel === m.id ? chalk.hex('#FFD93D')(' ← active') : '';
                console.log(`    ${chalk.hex('#4ECDC4')(m.id.padEnd(40))} ${chalk.dim(m.desc)}${a}`);
            }
            console.log(chalk.dim(`\n  Usage: /utensil <model name>  (case-insensitive, partial match OK)`));
            console.log(chalk.dim(`  Example: /utensil gpt-5 mini   or   /utensil gpt-4.1\n`));
            return;
        }

        // Case-insensitive, fuzzy search across ALL models
        const argLower = arg.toLowerCase().replace(/[\s-]+/g, '');
        let found = allModels.find(m => m.id.toLowerCase() === arg.toLowerCase());
        if (!found) found = allModels.find(m => m.id.toLowerCase().replace(/[\s-]+/g, '') === argLower);
        if (!found) found = allModels.find(m => m.id.toLowerCase().includes(arg.toLowerCase()));
        if (!found) found = allModels.find(m => m.id.toLowerCase().replace(/[\s-]+/g, '').includes(argLower));
        if (!found) found = allModels.find(m => argLower.includes(m.id.toLowerCase().replace(/[\s-]+/g, '')));

        if (found) {
            this.activeModel = found.id;
            const toolKey = this.activeTool || 'auto';
            this.modelPrefs[toolKey] = found.id;
            this.saveModelPrefs();

            // Apply model to the appropriate agent
            if (found.tool === 'gemini') {
                const g = this.registry.get('gemini');
                if (g) g.build_args = ['-p', '{prompt}', '--output-format', 'stream-json', '--model', found.id, ...(this.yolo ? ['--yolo'] : [])];
            } else if (found.tool === 'copilot') {
                const c = this.registry.get('copilot');
                if (c) c.build_args = ['copilot', '-p', '{prompt}', '--model', found.id, ...(this.yolo ? ['--allow-all-tools'] : [])];
            }
            console.log(chalk.hex('#4ECDC4')(`  🔪 Utensil: ${found.id}`) + chalk.dim(` (${found.tool} kitchen, saved for ${toolKey})`));
        } else {
            console.log(chalk.red(`  Unknown utensil: ${arg}`));
            // Show closest matches
            const matches = allModels.filter(m => m.id.toLowerCase().includes(argLower.split(' ')[0].toLowerCase()));
            if (matches.length > 0) {
                console.log(chalk.dim(`  Did you mean:`));
                for (const m of matches.slice(0, 5)) console.log(chalk.dim(`    ${m.icon} ${m.id}`));
            }
        }
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
            console.log(chalk.red(`  @${personaId} is unavailable — open a kitchen first (install gh (Copilot) or gemini)`));
            return;
        }
        this.addActivePersona(personaId);
        this.context.addMessage('user', prompt);
        const toolId = this.activeTool || this.pickBestTool(prompt);
        if (!toolId) { console.log(chalk.red('  No kitchen open. Install gh (Copilot) or gemini first.')); this.removeActivePersona(personaId); return; }
        const toolAgent = this.registry.get(toolId);
        this.getAgentTokens(toolId).in += Math.ceil(prompt.length / 4);
        this.getAgentTokens(toolId).prompts++;
        this.pushToLog({ role: 'user', persona: personaId, text: prompt, ts: Date.now() });
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
        if (!tools.length) { console.log(chalk.red('  No kitchen open for delegation — install gh (Copilot) or gemini')); return; }
        
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
            if (!toolId) { console.log(chalk.red('  No kitchens open (install gh (Copilot) or gemini)')); break; }
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
        if (!tools.length) { console.log(chalk.red('  No kitchens open (install gh (Copilot) or gemini)')); return; }
        
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
        console.log(chalk.hex('#e94560').bold(`\n  🫕 Soupz Stall — ${COMMANDS.length} commands\n`));
        const catNames = {
            cooking: '🍳 Cooking',
            tasks: '📋 Tasks & Tracking',
            session: '💾 Session',
            remote: '☁️ Remote & Monitoring',
            storage: '🧠 Storage & Memory',
            system: '🔧 System',
        };
        const cats = ['cooking', 'tasks', 'session', 'remote', 'storage', 'system'];
        for (const cat of cats) {
            const items = COMMANDS.filter(c => c.cat === cat);
            if (items.length === 0) continue;
            console.log(chalk.bold(`\n  ━━━ ${catNames[cat]} ${'━'.repeat(Math.max(1, 52 - catNames[cat].length))}`));
            for (const c of items) {
                console.log(`  ${c.icon} ${chalk.hex('#06B6D4').bold(c.cmd.padEnd(16))} ${chalk.hex('#888')(c.desc)}`);
            }
        }
        console.log(chalk.bold('\n  ━━━ Mentions ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
        console.log(`  🎯 ${chalk.hex('#FFD93D').bold('@auto')}                ${chalk.hex('#888')('Auto-pick best persona + run')}`);
        console.log(`  🎭 ${chalk.hex('#FFD93D').bold('@<persona>')}           ${chalk.hex('#888')('Run a specific persona (Tab to browse)')}`);
        console.log(`  🔗 ${chalk.hex('#4ECDC4').bold('@designer')}            ${chalk.hex('#888')('Award-worthy design agency AI')}`);
        console.log(`  🖼️  ${chalk.hex('#FF6B35').bold('@svgart')}              ${chalk.hex('#888')('SVG/CSS art generator')}`);
        console.log(`  🎯 ${chalk.hex('#A855F7').bold('@orchestrator')}        ${chalk.hex('#888')('SOUPZ-style multi-agent coordinator')}`);
        console.log(`  📄 ${chalk.hex('#FF6B6B').bold('#<file>')}              ${chalk.hex('#888')('Attach file content')}`);
        console.log(chalk.bold('\n  ━━━ Multi-Agent ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
        console.log(`  ${chalk.hex('#A855F7')('/chain designer→svgart "prompt"')}   ${chalk.hex('#888')('Chain agents sequentially')}`);
        console.log(`  ${chalk.hex('#FF6B35').bold('/parallel')} ${chalk.hex('#FF6B35')('a b c "prompt"')}        ${chalk.hex('#888')('⚡ Run agents simultaneously')}`);
        console.log(`  ${chalk.hex('#A855F7')('/delegate designer "prompt"')}        ${chalk.hex('#888')('Delegate to specific agent')}`);
        console.log(`  ${chalk.hex('#888')('@orchestrator auto-delegates in parallel via @DELEGATE[id]: prompt')}`);
        console.log(`  ${chalk.hex('#888')('Unknown @agents are auto-created dynamically')}`);
        console.log(chalk.bold('\n  ━━━ Keys ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
        console.log(`  ${chalk.hex('#4ECDC4')('↑↓')} Navigate   ${chalk.hex('#4ECDC4')('Tab')} Fill   ${chalk.hex('#4ECDC4')('Enter')} Submit`);
        console.log(`  ${chalk.hex('#4ECDC4')('Ctrl+J')} ${chalk.hex('#888')('(recommended)')} / ${chalk.hex('#4ECDC4')('Opt+Enter')} / ${chalk.hex('#4ECDC4')('Shift+Enter')} Newline`);
        console.log(`  ${chalk.hex('#4ECDC4')('Opt+⌫')} Delete word   ${chalk.hex('#4ECDC4')('Ctrl+U')} Clear line`);
        console.log(`  ${chalk.hex('#4ECDC4')('Esc')} Close / Cancel   ${chalk.hex('#4ECDC4')('Ctrl+C')} Quit   ${chalk.hex('#4ECDC4')('Ctrl+L')} Clear screen`);
        console.log();
    }

    showToolAgents() {
        const all = this.registry.list().filter((a) => a.type !== 'persona');
        const cnt = this.getPersonas().length;
        console.log(chalk.bold('\n  🍳 The Kitchen (Cooking Stations)'));
        console.log(chalk.dim(`  ${cnt} chefs ready to cook. /tool <id> to pick station\n`));
        for (const a of all) {
            const s = a.available ? chalk.green('✔') : chalk.red('✖');
            const active = this.activeTool === a.id ? chalk.hex('#FFD93D')(' ← active station') : '';
            const auth = this.auth?.isLoggedIn?.(a.id) ? chalk.green(' [logged in]') : '';
            console.log(`  ${s} ${a.icon} ${chalk.bold(a.id.padEnd(14))} ${chalk.dim(a.description || '')}${active}${auth}`);
            if (a.headless && a.available) console.log(chalk.dim(`      └─ ${cnt} chefs available in this kitchen`));
        }
        console.log(`\n  ${chalk.hex('#4ECDC4')('/auto')}  ${chalk.dim('let the head chef pick the best station')}\n`);
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
        const hrs = Math.floor(elapsed / 3600);
        const mins = Math.floor((elapsed % 3600) / 60);
        const secs = elapsed % 60;
        const uptimeStr = hrs > 0 ? `${hrs}h ${mins}m ${secs}s` : `${mins}m ${secs}s`;
        let totalIn = 0, totalOut = 0, totalApi = 0;
        for (const t of Object.values(this.agentTokens)) { totalIn += t.in; totalOut += t.out; totalApi += t.apiTimeMs; }
        console.log(HR);
        console.log(chalk.bold('  📊 Token Usage'));
        console.log(HR);
        console.log(`  ${chalk.dim('Total:')}       ${chalk.hex('#4ECDC4')((totalIn + totalOut).toLocaleString())} tokens`);
        console.log(`  ${chalk.dim('In / Out:')}    ${totalIn.toLocaleString()} / ${totalOut.toLocaleString()}`);
        console.log(`  ${chalk.dim('API time:')}    ${(totalApi / 1000).toFixed(1)}s`);
        console.log(`  ${chalk.dim('Session:')}     ${uptimeStr}  •  ${this.sessionName || 'unnamed'}  •  ${this.totalPromptsSent} prompts sent`);
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
        if (this.memoryPool) {
            const pool = this.memoryPool.stats();
            console.log(chalk.hex('#FFD93D')(`\n  🏦 Memory Pool: ${pool.bankCount}/${pool.maxBanks} banks │ ${pool.totalChunks} chunks │ ~${pool.totalTokens} tokens`));
            for (const b of pool.banks) {
                console.log(chalk.dim(`    📦 ${b.label} (${b.id}): ${b.chunks} chunks, ~${b.tokens} tokens`));
            }
        }
        console.log();
    }

    /** /recipe — pre-built chef workflow templates */
    showRecipes() {
        const recipes = [
            { id: 'product-launch', name: 'Full Product Launch', chefs: 'researcher→strategist→pm→designer→dev→tester→devops', desc: 'End-to-end product from research to deployment' },
            { id: 'brand-identity', name: 'Brand Identity', chefs: 'domain-scout→researcher→brand-chef→designer→svgart→contentwriter', desc: 'Complete brand from market research to visual identity' },
            { id: 'mvp-sprint', name: 'MVP Sprint', chefs: 'quick-flow→dev→tester→devops', desc: 'Rapid prototype to deployed MVP' },
            { id: 'ux-audit', name: 'UX Audit', chefs: 'ux-designer→analyst→qa→presenter', desc: 'Evaluate and present UX improvements' },
            { id: 'pitch-deck', name: 'Pitch Deck', chefs: 'strategist→storyteller→presenter→svgart', desc: 'Investor-ready pitch with narrative and visuals' },
            { id: 'code-quality', name: 'Code Quality', chefs: 'architect→dev→tea→qa', desc: 'Architecture review, refactoring, test coverage' },
            { id: 'content-campaign', name: 'Content Campaign', chefs: 'researcher→contentwriter→storyteller→designer', desc: 'Research-backed content with visual assets' },
            { id: 'security-review', name: 'Security Review', chefs: 'security→tea→devops', desc: 'Security audit, test coverage, deployment hardening' },
            { id: 'landing-page', name: 'Landing Page', chefs: 'researcher→ux-designer→designer→dev', desc: 'Research → wireframe → design → code a landing page' },
            { id: 'api-design', name: 'API Design', chefs: 'architect→dev→tea→qa→devops', desc: 'Design, implement, test, and document an API' },
        ];

        console.log(chalk.bold('\n  📖 Recipes — Pre-built Chef Workflows\n'));
        for (const r of recipes) {
            console.log(chalk.cyan(`  ${r.id}`));
            console.log(chalk.white(`    ${r.name} — ${r.desc}`));
            console.log(chalk.dim(`    /recipe ${r.id} "your project description"`));
            console.log(chalk.dim(`    Chefs: ${r.chefs}\n`));
        }
        console.log(chalk.dim('  Run: /recipe <id> "prompt"  — or — /chain to build your own\n'));
    }

    async runRecipe(input) {
        const recipes = {
            'product-launch': 'researcher→strategist→pm→designer→dev→tester→devops',
            'brand-identity': 'domain-scout→researcher→brand-chef→designer→svgart→contentwriter',
            'mvp-sprint': 'quick-flow→dev→tester→devops',
            'ux-audit': 'ux-designer→analyst→qa→presenter',
            'pitch-deck': 'strategist→storyteller→presenter→svgart',
            'code-quality': 'architect→dev→tea→qa',
            'content-campaign': 'researcher→contentwriter→storyteller→designer',
            'security-review': 'security→tea→devops',
            'landing-page': 'researcher→ux-designer→designer→dev',
            'api-design': 'architect→dev→tea→qa→devops',
        };

        const match = input.match(/^([\w-]+)\s+"(.+)"$/s) || input.match(/^([\w-]+)\s+(.+)$/s);
        if (!match) {
            console.log(chalk.dim('  Usage: /recipe <recipe-id> "your prompt"'));
            console.log(chalk.dim('  Run /recipe list to see available recipes'));
            return;
        }
        const [, recipeId, prompt] = match;
        const chain = recipes[recipeId];
        if (!chain) {
            console.log(chalk.red(`  Unknown recipe: ${recipeId}`));
            this.showRecipes();
            return;
        }
        console.log(chalk.cyan(`\n  📖 Running recipe: ${recipeId}`));
        console.log(chalk.dim(`  Chain: ${chain}\n`));
        await this.handleChain(`${chain} "${prompt}"`);
    }

    /** /version — show version info */
    showVersion() {
        const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
        console.log(chalk.bold(`\n  🏷️  Soupz Stall v${pkg.version}`));
        console.log(chalk.dim(`  Node: ${process.version}  |  OS: ${process.platform} ${process.arch}`));
        const chefCount = this.registry ? this.registry.size : '?';
        console.log(chalk.dim(`  Chefs: ${chefCount}  |  Kitchens: copilot, gemini, ollama`));
        console.log(chalk.dim(`  Session: ${this.sessionName || '—'}  |  PID: ${process.pid}`));
        console.log();
    }

    /** /health — system diagnostics */
    async showHealth() {
        console.log(chalk.bold('\n  🩺 System Health Check\n'));
        const checks = [];

        // Check Copilot CLI
        try {
            const { execFileSync } = await import('child_process');
            execFileSync('gh', ['copilot', '--version'], { timeout: 5000 });
            checks.push({ name: 'GitHub Copilot CLI', status: '✅', detail: 'Installed and authenticated' });
        } catch {
            checks.push({ name: 'GitHub Copilot CLI', status: '❌', detail: 'Not found or not authenticated — run: gh auth login' });
        }

        // Check Gemini CLI
        try {
            const { execFileSync } = await import('child_process');
            execFileSync('which', ['gemini'], { timeout: 3000 });
            // Check if Gemini is authenticated by running a quick test
            try {
                execFileSync('gemini', ['--version'], { timeout: 5000, stdio: 'pipe' });
                checks.push({ name: 'Gemini CLI', status: '✅', detail: 'Installed and authenticated' });
            } catch {
                checks.push({ name: 'Gemini CLI', status: '⚠️', detail: 'Installed but not authenticated — run: gemini' });
            }
        } catch {
            checks.push({ name: 'Gemini CLI', status: '⚠️', detail: 'Not found — optional but recommended' });
        }

        // Check Ollama
        try {
            const resp = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(3000) });
            if (resp.ok) {
                const data = await resp.json();
                const models = data.models?.map(m => m.name).join(', ') || 'none';
                checks.push({ name: 'Ollama', status: '✅', detail: `Running — models: ${models}` });
            } else {
                checks.push({ name: 'Ollama', status: '⚠️', detail: 'Responding but error — restart Ollama' });
            }
        } catch {
            checks.push({ name: 'Ollama', status: '⚠️', detail: 'Not running — optional, rule-based fallback active' });
        }

        // Memory usage (with swap)
        const os = await import('os');
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const usedPercent = Math.round((usedMem / totalMem) * 100);
        const memIcon = usedPercent > 90 ? '🔴' : usedPercent > 70 ? '🟡' : '🟢';
        const fmtB = (b) => b >= 1024**3 ? (b / 1024**3).toFixed(1) + ' GB' : Math.round(b / 1024**2) + ' MB';
        const bar = (pct, len = 20) => {
            const filled = Math.round(pct / 100 * len);
            return chalk.green('█'.repeat(filled)) + chalk.dim('░'.repeat(len - filled));
        };
        checks.push({ name: 'RAM', status: memIcon, detail: `${bar(usedPercent)} ${usedPercent}%  ${fmtB(usedMem)} / ${fmtB(totalMem)}  (${fmtB(freeMem)} free)` });

        // Swap memory
        try {
            const { execSync } = await import('child_process');
            if (os.platform() === 'darwin') {
                const swapOut = execSync('sysctl vm.swapusage 2>/dev/null', { timeout: 2000 }).toString();
                const tM = swapOut.match(/total\s*=\s*([\d.]+)M/);
                const uM = swapOut.match(/used\s*=\s*([\d.]+)M/);
                if (tM && uM) {
                    const swapTotal = parseFloat(tM[1]) * 1024 * 1024;
                    const swapUsed = parseFloat(uM[1]) * 1024 * 1024;
                    const swapPct = swapTotal > 0 ? Math.round((swapUsed / swapTotal) * 100) : 0;
                    const swapIcon = swapPct > 70 ? '🔴' : swapUsed > 0 ? '🟡' : '🟢';
                    checks.push({ name: 'Swap (SSD)', status: swapIcon, detail: `${bar(swapPct)} ${swapPct}%  ${fmtB(swapUsed)} / ${fmtB(swapTotal)}` });
                    // Show combined total (what Mac actually has available)
                    const combinedUsed = usedMem + swapUsed;
                    const combinedTotal = totalMem + swapTotal;
                    const combinedPct = Math.round((combinedUsed / combinedTotal) * 100);
                    checks.push({ name: 'Total (RAM+Swap)', status: combinedPct > 85 ? '🔴' : '🟡', detail: `${bar(combinedPct)} ${combinedPct}%  ${fmtB(combinedUsed)} / ${fmtB(combinedTotal)} usable` });
                }
            }
        } catch { /* swap info not available */ }

        // Disk space (APFS-aware: use total - available, not "used" column)
        try {
            const { execSync } = await import('child_process');
            const dfOut = execSync("df -k / 2>/dev/null | tail -1", { timeout: 2000 }).toString().trim();
            const parts = dfOut.split(/\s+/);
            if (parts.length >= 4) {
                const diskTotal = parseInt(parts[1]) * 1024;
                const diskAvail = parseInt(parts[3]) * 1024;
                // On macOS APFS, "Used" only shows this volume; true used = total - available
                const diskUsed = diskTotal - diskAvail;
                const diskPct = diskTotal > 0 ? Math.round((diskUsed / diskTotal) * 100) : 0;
                const diskIcon = diskPct > 90 ? '🔴' : diskPct > 70 ? '🟡' : '🟢';
                checks.push({ name: 'Disk', status: diskIcon, detail: `${bar(diskPct)} ${diskPct}%  ${fmtB(diskUsed)} / ${fmtB(diskTotal)}  (${fmtB(diskAvail)} free)` });
            }
        } catch { /* disk not available */ }

        // CPU load
        const load = os.loadavg();
        const cores = os.cpus().length;
        const loadIcon = load[0] > cores * 0.8 ? '🔴' : load[0] > cores * 0.5 ? '🟡' : '🟢';
        checks.push({ name: 'CPU Load', status: loadIcon, detail: `${load[0].toFixed(1)} (1m) / ${cores} cores` });

        // Chef count
        const fs = await import('fs');
        const path = await import('path');
        const agentsDir = path.join(process.cwd(), 'defaults', 'agents');
        try {
            const files = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'));
            const toolEngines = ['copilot.md', 'gemini.md', 'ollama.md'];
            const chefs = files.filter(f => !toolEngines.includes(f));
            checks.push({ name: 'Chefs Available', status: '👨‍🍳', detail: `${chefs.length} persona chefs + ${toolEngines.filter(t => files.includes(t)).length} tool engines` });
        } catch {
            checks.push({ name: 'Chefs', status: '⚠️', detail: 'Could not read agents directory' });
        }

        // Memory pool
        const memDir = path.join(os.homedir(), '.soupz-agents', 'memory-pool');
        try {
            const banks = fs.readdirSync(memDir).filter(f => f.endsWith('.json'));
            const totalSize = banks.reduce((sum, f) => sum + fs.statSync(path.join(memDir, f)).size, 0);
            checks.push({ name: 'Memory Pool', status: '🧠', detail: `${banks.length} banks, ${Math.round(totalSize / 1024)}KB total` });
        } catch {
            checks.push({ name: 'Memory Pool', status: '🧠', detail: 'Empty — auto-populates after first task' });
        }

        // Active session + saved sessions storage
        const sessionsDir = path.join(os.homedir(), '.soupz-agents', 'sessions');
        let sessDetail = `${this.context?.history?.length || 0} messages, station: ${this.activeStation || 'auto'}`;
        try {
            const sessFiles = fs.readdirSync(sessionsDir);
            const sessSize = sessFiles.reduce((sum, f) => { try { return sum + fs.statSync(path.join(sessionsDir, f)).size; } catch { return sum; } }, 0);
            sessDetail += ` — ${sessFiles.length} saved (${fmtB(sessSize)})`;
        } catch {}
        checks.push({ name: 'Session', status: '📋', detail: sessDetail });

        // Cloud Kitchen
        if (this._cloudKitchen) {
            const code = this._cloudKitchen.getCode();
            const ips = this._cloudKitchen.localIPs || [];
            let detail = `Port ${this._cloudKitchen.port} — OTP: ${code?.code || '...'}`;
            if (ips.length > 0) detail += ` — LAN: ${ips[0]}:${this._cloudKitchen.port}`;
            if (this._tunnel) detail += ` — 🌍 ${this._tunnel.url}`;
            checks.push({ name: 'Cloud Kitchen', status: '☁️', detail });
        } else {
            checks.push({ name: 'Cloud Kitchen', status: '💤', detail: 'Not started — type /cloud-kitchen to start' });
        }

        for (const c of checks) {
            console.log(`  ${c.status}  ${chalk.bold(c.name)}`);
            console.log(chalk.dim(`     ${c.detail}`));
        }
        console.log();
    }

    handleCompress(input) {
        const sub = input.slice(9).trim();

        if (!sub || sub === 'stats') {
            // Show compression stats
            console.log(chalk.bold('\n  📦 Token Compression\n'));

            if (this.compressor) {
                const savings = this.compressor.getSavings();
                const level = this.compressor.level;
                console.log(`  Level: ${chalk.cyan(level)}`);
                console.log(`  Input saved:  ${chalk.green(savings.inputSaved.toFixed(1) + '%')}`);
                console.log(`  Output saved: ${chalk.green(savings.outputSaved.toFixed(1) + '%')}`);
                console.log(`  Total saved:  ${chalk.bold.green(savings.totalSaved.toFixed(1) + '%')} (${savings.totalTokensSaved} tokens)`);
            } else {
                console.log(chalk.dim('  Compressor not initialized'));
            }

            if (this.preprocessor) {
                const pStats = this.preprocessor.getStats();
                console.log(chalk.bold('\n  🤖 Ollama Preprocessor'));
                console.log(`  Status: ${pStats.available ? chalk.green('available') : chalk.red('unavailable')}`);
                console.log(`  Model:  ${chalk.cyan(pStats.model)}`);
                console.log(`  Calls:  ${pStats.callCount}`);
                if (pStats.callCount > 0) {
                    console.log(`  Avg compression: ${chalk.green((pStats.avgCompressionRatio * 100).toFixed(1) + '%')}`);
                    console.log(`  Avg latency:     ${pStats.avgLatencyMs}ms`);
                    console.log(`  Total saved:     ${chalk.green(pStats.totalSaved + ' chars')}`);
                }
            }
            console.log();
            return;
        }

        if (sub === 'on' || sub === 'off') {
            if (this.compressor) this.compressor.level = sub === 'on' ? 'medium' : 'light';
            if (this.preprocessor) this.preprocessor.enabled = sub === 'on';
            console.log(chalk.green(`  📦 Compression ${sub === 'on' ? 'enabled' : 'disabled'}`));
            return;
        }

        if (['light', 'medium', 'aggressive'].includes(sub)) {
            if (this.compressor) this.compressor.level = sub;
            console.log(chalk.green(`  📦 Compression level: ${sub}`));
            return;
        }

        if (sub === 'reset') {
            if (this.compressor) this.compressor.resetStats();
            console.log(chalk.green('  📦 Stats reset'));
            return;
        }

        if (sub === 'context') {
            this.context.compress();
            console.log(chalk.green('  📦 Context compressed!'));
            return;
        }

        if (sub === 'test') {
            const sample = 'I would like you to please create a beautiful function that implements authentication for my application using the database configuration from the environment';
            console.log(chalk.dim(`  Original (${sample.length} chars):`));
            console.log(chalk.dim(`  ${sample}\n`));
            if (this.compressor) {
                const compressed = this.compressor.compressPrompt(sample);
                console.log(chalk.cyan(`  Compressed (${compressed.length} chars):`));
                console.log(chalk.cyan(`  ${compressed}\n`));
                const savings = Math.round((1 - compressed.length / sample.length) * 100);
                console.log(chalk.green(`  Savings: ${savings}%`));
            }
            return;
        }

        console.log(chalk.dim('  Usage: /compress [stats|on|off|light|medium|aggressive|reset|context|test]'));
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

    async setupMultilineKeybinding() {
        const keybindingsPath = join(homedir(), 'Library', 'Application Support', 'Code', 'User', 'keybindings.json');
        const binding = {
            key: 'shift+enter',
            command: 'workbench.action.terminal.sendSequence',
            when: 'terminalFocus',
            args: { text: '\u001b\r' }
        };

        try {
            let bindings = [];
            if (existsSync(keybindingsPath)) {
                const raw = readFileSync(keybindingsPath, 'utf8');
                // Strip comments (JSONC → JSON)
                const cleaned = raw.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
                try { bindings = JSON.parse(cleaned); } catch { bindings = []; }

                // Check if already configured
                const exists = bindings.some(b =>
                    b.key === 'shift+enter' &&
                    b.command === 'workbench.action.terminal.sendSequence' &&
                    b.args?.text === '\u001b\r'
                );
                if (exists) {
                    console.log(chalk.green('  ✅ Shift+Enter is already set up for multiline input.'));
                    return;
                }
            }

            bindings.unshift(binding);
            writeFileSync(keybindingsPath, JSON.stringify(bindings, null, 4) + '\n');
            console.log(chalk.green('  ✅ Added Shift+Enter → multiline keybinding to VS Code.'));
            console.log(chalk.dim(`  Path: ${keybindingsPath}`));
            console.log(chalk.dim('  Restart VS Code terminal for it to take effect.'));
        } catch (err) {
            console.log(chalk.red(`  ✖ Failed to setup: ${err.message}`));
            console.log(chalk.dim('  You can manually add to VS Code keybindings.json:'));
            console.log(chalk.cyan(`  ${JSON.stringify(binding, null, 2)}`));
        }
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

    /**
     * /svgart <type> "<description>"
     * Types: logo | icon | hero | illustration | pattern | badge
     * Prompts the active LLM with a strict SVG-only system prompt,
     * extracts all <svg>…</svg> blocks from the response, and saves
     * each one to <cwd>/assets/<type>-<timestamp>.svg
     */
    async handleSvgArt(input) {
        const HR = chalk.hex('#FF6B35')('━'.repeat(55));
        const args = input.replace('/svgart', '').trim();

        // Parse: /svgart logo "description"  or  /svgart "description"
        const typeMatch = args.match(/^(logo|icon|hero|illustration|pattern|badge|banner)\s+/i);
        const svgType = typeMatch ? typeMatch[1].toLowerCase() : 'asset';
        const desc = args.replace(typeMatch?.[0] || '', '').replace(/^["']|["']$/g, '').trim();

        if (!desc) {
            console.log('\n' + HR);
            console.log(chalk.hex('#FF6B35').bold('  🎨 /svgart — SVG Asset Generator'));
            console.log(HR);
            console.log(chalk.dim('\n  Usage: /svgart <type> "description"\n'));
            console.log(chalk.dim('  Types: logo | icon | hero | illustration | pattern | badge | banner\n'));
            console.log(chalk.dim('  Examples:'));
            console.log(chalk.dim('    /svgart logo "HealthAI, geometric, blue gradient, clean wordmark"'));
            console.log(chalk.dim('    /svgart icon "settings gear, outline, 24x24, dark mode"'));
            console.log(chalk.dim('    /svgart hero "abstract waves, purple and teal gradient, 1440x600"'));
            console.log(chalk.dim('    /svgart pattern "subtle dot grid, light gray, tileable"\n'));
            console.log(HR + '\n');
            return;
        }

        const toolId = this.activeTool || this.pickBestTool(desc);
        if (!toolId) {
            console.log(chalk.red('  No kitchen open. Install gh (Copilot) or gemini first.'));
            return;
        }

        // ── Hard block: geographic maps require real coordinate data ──────────
        const geoPatterns = /\b(map|country|nation|state|province|border|coastline|geography|geo|india|usa|china|europe|africa|continent|region|territory)\b/i;
        if (geoPatterns.test(desc)) {
            console.log(chalk.hex('#FF6B6B').bold('\n  ⛔ Geographic shapes not supported by /svgart\n'));
            console.log(chalk.dim('  Country outlines (like India\'s map) require real coordinate data.'));
            console.log(chalk.dim('  LLMs guess at shapes and always get them wrong — that\'s a blob, not a country.\n'));
            console.log(chalk.hex('#FFD93D')('  Use pre-made SVG map data instead:\n'));
            console.log(chalk.dim('  🗺  India:      https://simplemaps.com/resources/svg-in'));
            console.log(chalk.dim('  🌍 Any country: https://www.naturalearthdata.com/'));
            console.log(chalk.dim('  🌐 MapSVG:     https://github.com/mapbox/mapbox-gl-js'));
            console.log(chalk.dim('  📦 npm:        npm install react-simple-maps\n'));
            console.log(chalk.dim('  /svgart works great for: logos, icons, abstract heroes, patterns, badges\n'));
            return;
        }

        // Viewport defaults per type
        const viewports = {
            logo: '0 0 360 100',
            icon: '0 0 24 24',
            hero: '0 0 1440 600',
            illustration: '0 0 800 600',
            pattern: '0 0 40 40',
            badge: '0 0 120 40',
            banner: '0 0 1200 300',
            asset: '0 0 400 400',
        };
        const viewBox = viewports[svgType] || '0 0 400 400';
        const [,, w, h] = viewBox.split(' ');

        console.log('\n' + HR);
        console.log(chalk.hex('#FF6B35').bold(`  🎨 Generating SVG ${svgType}: "${desc}"`));
        console.log(chalk.dim(`  Kitchen: ${toolId}  ·  viewBox: ${viewBox}`));
        console.log(HR + '\n');

        const systemPrompt = `You are an expert SVG designer. Output ONLY valid SVG markup — no markdown, no explanation, no code fences.

Rules:
1. Output a single, complete, self-contained <svg> element
2. Must include: xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${w}" height="${h}"
3. No external hrefs, no raster images embedded, no scripts
4. Use <defs> for gradients, patterns, filters — reference them with id
5. Clean, production-ready SVG that works when saved as a .svg file
6. NEVER attempt geographic shapes (country/state/map outlines) — you don't have real coordinate data and will produce garbage blobs
7. For ${svgType}: ${svgType === 'logo' ? 'include text/wordmark + icon mark, scalable at any size' :
    svgType === 'icon' ? 'pixel-crisp at 24px, 2px stroke width, rounded caps, outline style' :
    svgType === 'hero' ? 'full-bleed background, bold visual, good as website hero section' :
    svgType === 'pattern' ? 'tileable pattern — must seamlessly repeat, use <pattern> element' :
    svgType === 'badge' ? 'compact label, rounded corners, clear text' :
    svgType === 'illustration' ? 'detailed scene illustration, multiple layers, rich visual' :
    'visually striking, appropriate for web use'}
8. Color palette: extract from the description — if not specified, use bold, award-winning colors
9. DO NOT output anything except the SVG. No "Here is…", no "\`\`\`svg", just <svg>...</svg>

Design brief: ${desc}`;

        this.startSpinner(toolId);

        let rawOutput = '';
        try {
            rawOutput = await this.spawner.run(toolId, systemPrompt, this.cwd);
        } catch (err) {
            this.stopSpinner();
            console.log(chalk.red(`  ✖ Generation failed: ${err.message}`));
            return;
        }
        this.stopSpinner();

        // Extract all <svg>...</svg> blocks (including multiline)
        const svgBlocks = [];
        const svgRegex = /<svg[\s\S]*?<\/svg>/gi;
        let match;
        while ((match = svgRegex.exec(rawOutput)) !== null) {
            svgBlocks.push(match[0]);
        }

        if (!svgBlocks.length) {
            // Try to salvage: if output contains SVG-like content without proper tags
            console.log(chalk.yellow('  ⚠ No complete <svg> block found in output.'));
            console.log(chalk.dim('  Raw output (first 500 chars):'));
            console.log(chalk.dim('  ' + rawOutput.slice(0, 500)));
            console.log(chalk.dim('\n  Tip: Try with a more specific description or switch stations.'));
            return;
        }

        // Save to assets/
        const assetsDir = join(this.cwd, 'assets');
        mkdirSync(assetsDir, { recursive: true });

        const saved = [];
        for (let i = 0; i < svgBlocks.length; i++) {
            const suffix = svgBlocks.length > 1 ? `-${i + 1}` : '';
            const slug = desc.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);
            const filename = `${svgType}-${slug}${suffix}.svg`;
            const filepath = join(assetsDir, filename);
            writeFileSync(filepath, svgBlocks[i], 'utf8');
            saved.push({ filename, filepath, size: svgBlocks[i].length });
        }

        console.log(chalk.hex('#6BCB77').bold(`  ✅ ${saved.length} SVG asset${saved.length > 1 ? 's' : ''} saved:\n`));
        for (const { filename, filepath, size } of saved) {
            console.log(chalk.hex('#4ECDC4')(`  📄 ${filename}`) + chalk.dim(` (${(size / 1024).toFixed(1)} KB)`));
            console.log(chalk.dim(`     ${filepath}`));
            // Preview first 3 lines
            const preview = saved[0] === saved.find(s => s.filename === filename)
                ? svgBlocks[saved.indexOf({ filename, filepath, size })].split('\n').slice(0, 3).join('\n')
                : '';
        }

        console.log(chalk.dim(`\n  Import in HTML: <img src="assets/${saved[0].filename}">`));
        console.log(chalk.dim(`  Import in React: import { ReactComponent as Logo } from './assets/${saved[0].filename}'`));
        console.log(chalk.dim(`  Inline: copy SVG content directly into your HTML\n`));
    }

    toggleYolo() {
        this.yolo = !this.yolo;
        if (this.yolo) {
            console.log(chalk.hex('#FF6B6B').bold('  🫕 SPILL MODE ON — soup is overflowing, no restrictions, full send.'));
        } else {
            console.log(chalk.hex('#4ECDC4')('  🧊 Spill mode OFF — back to clean kitchen.'));
        }
        const g = this.registry.get('gemini');
        if (g) g.build_args = ['-p', '{prompt}', '--output-format', 'stream-json', ...(this.activeModel ? ['--model', this.activeModel] : []), ...(this.yolo ? ['--yolo'] : [])];
        const c = this.registry.get('copilot');
        if (c) {
            const modelFlag = this.modelPrefs?.copilot ? ['--model', this.modelPrefs.copilot] : [];
            c.build_args = this.yolo ? ['copilot', '-p', '{prompt}', '--allow-all-tools', ...modelFlag] : ['copilot', '-p', '{prompt}', ...modelFlag];
        }
    }

    async handleHackathon(input) {
        const HR2 = chalk.hex('#FF2D55')('━'.repeat(55));
        console.log('\n' + HR2);
        console.log(chalk.hex('#FF2D55').bold('  🏁 HACKATHON MODE — Soupz Stall War Room'));
        console.log(HR2);

        // Parse inline args: /hackathon 24h 3ppl "build a fintech app"
        const args = input.replace('/hackathon', '').trim();
        let hours = 24, teamSize = 2, brief = '';

        const hourMatch = args.match(/(\d+)\s*h/i);
        const teamMatch = args.match(/(\d+)\s*p(?:pl|eople|ersons?)?/i);
        const briefMatch = args.match(/"([^"]+)"/);

        if (hourMatch) hours = parseInt(hourMatch[1]);
        if (teamMatch) teamSize = parseInt(teamMatch[1]);
        if (briefMatch) brief = briefMatch[1];

        // Prompt for missing info
        if (!hours || !args) {
            console.log(chalk.dim('\n  Tip: /hackathon 24h 3ppl "build a fintech app for students"\n'));
            console.log(chalk.hex('#FFD93D')('  Duration:'), chalk.dim('12h / 24h / 36h / 48h? (default: 24h)'));
            console.log(chalk.hex('#FFD93D')('  Team size:'), chalk.dim('How many people? (default: 2)'));
            console.log(chalk.hex('#FFD93D')('  Brief:'), chalk.dim('What are you building?'));
        }

        if (!brief) brief = 'hackathon project (add your brief: /hackathon 24h 2ppl "your idea")';

        // Generate phases based on duration
        const phases = this._generateHackathonPhases(hours, teamSize, brief);

        // Print timeline
        console.log(chalk.bold(`\n  🫕 ${hours}h Hackathon  ·  ${teamSize} person${teamSize > 1 ? 's' : ''}  ·  ${brief}\n`));

        let cumulative = 0;
        for (const phase of phases) {
            const start = this._fmtHours(cumulative);
            cumulative += phase.duration;
            const end = this._fmtHours(cumulative);
            console.log(
                chalk.hex(phase.color).bold(`  ${phase.icon} Phase ${phase.num}: ${phase.name}`) +
                chalk.dim(` [${start} → ${end}]`)
            );
            console.log(chalk.dim(`      ${phase.goal}`));
            for (const chef of phase.chefs) {
                console.log(chalk.hex('#4ECDC4')(`      @${chef.id}`) + chalk.dim(` — ${chef.task}`));
            }
            for (const todo of phase.todos) {
                console.log(chalk.dim(`      ☐  ${todo}`));
            }
            console.log();
        }

        // Print critical path
        console.log(chalk.hex('#FF6B6B').bold('  🎯 CRITICAL PATH (must have for MVP):'));
        const critical = this._getCriticalPath(hours, brief);
        for (const item of critical) {
            console.log(chalk.hex('#FF6B6B')(`    → ${item}`));
        }

        // ── Create actual todos in the task list ──────────────────────────────
        const allTodos = [];
        let cumId = 1;
        for (const phase of phases) {
            allTodos.push({ id: cumId++, task: `[Phase ${phase.num}] ${phase.name}`, done: false, status: 'pending', elapsed: 0, startedAt: null });
            for (const t of phase.todos) {
                allTodos.push({ id: cumId++, task: t, done: false, status: 'pending', elapsed: 0, startedAt: null });
            }
        }
        this.todoList = allTodos;
        console.log(chalk.hex('#4ECDC4').bold(`\n  ✅ ${allTodos.length} todos created — run /todo to see them\n`));
        this.renderTodoCard();

        console.log(chalk.dim(`  Start design: @designer "Phase 1 quick mode: ${brief}"`));
        console.log(chalk.dim(`  Full parallel launch: /parallel designer researcher strategist "${brief}"\n`));
        console.log(HR2 + '\n');
    }

    _fmtHours(h) {
        const hh = Math.floor(h) % 24;
        const label = h >= 24 ? `Day ${Math.floor(h/24)+1} ` : '';
        return `${label}${String(hh).padStart(2,'0')}:00`;
    }

    _generateHackathonPhases(hours, teamSize, brief) {
        // Scale phase durations to fit hackathon length
        const scale = hours / 24;
        const phases = [
            {
                num: 1, name: 'Kickoff & Intelligence Gathering', color: '#FF2D55', icon: '🗺️',
                duration: Math.round(scale * 1.5),
                goal: 'Understand problem space, define MVP scope, assign roles',
                chefs: [
                    { id: 'domain-scout', task: 'map competitive landscape + identify differentiators' },
                    { id: 'review-miner', task: 'find pain points in competitor reviews' },
                    { id: 'strategist', task: 'validate idea + define positioning' },
                ],
                todos: [
                    'Define the problem statement in one sentence',
                    'List 3 competitors and identify your differentiator',
                    'Decide MVP feature set (max 3 core features)',
                    'Assign: who codes, who designs, who pitches',
                ],
            },
            {
                num: 2, name: 'Brand & Design Sprint', color: '#FF6B6B', icon: '🎨',
                duration: Math.round(scale * 2),
                goal: 'Design system, landing page prototype, DESIGN_RULES.md',
                chefs: [
                    { id: 'brand-chef', task: 'brand core + tagline + messaging' },
                    { id: 'ui-builder', task: 'prototype/index.html — 3-second test MUST pass' },
                ],
                todos: [
                    'Headline: max 8 words, passes 3-second clarity test',
                    'Color palette + typography (define CSS variables)',
                    'Hero section: above fold shows what/who/why',
                    'Create DESIGN_RULES.md for consistency',
                ],
            },
            {
                num: 3, name: 'Architecture & Setup', color: '#FF8E53', icon: '🏗️',
                duration: Math.round(scale * 1.5),
                goal: 'Tech stack up, repo initialized, CI/CD if needed',
                chefs: [
                    { id: 'architect', task: 'tech stack decision + system design' },
                ],
                todos: [
                    'Initialize repo, install deps',
                    'Set up project structure and routing',
                    'Database schema (if needed)',
                    'Deploy skeleton to staging URL (needed for demo!)',
                ],
            },
            {
                num: 4, name: 'Core Build', color: '#FFA500', icon: '⚙️',
                duration: Math.round(scale * (hours <= 24 ? 8 : 12)),
                goal: 'Build the 3 MVP features. Nothing else.',
                chefs: [
                    { id: 'architect', task: 'implement core features' },
                    { id: 'qa', task: 'test as features land, catch blockers early' },
                ],
                todos: [
                    'Feature 1: [your core feature] — working end-to-end',
                    'Feature 2: [second feature] — working end-to-end',
                    'Feature 3: [third feature] — working end-to-end',
                    'Integrate landing page with live app',
                    'Mobile responsive check',
                ],
            },
            {
                num: 5, name: 'Polish & Pitch Prep', color: '#FFD93D', icon: '✨',
                duration: Math.round(scale * (hours <= 24 ? 3 : 5)),
                goal: 'Make it demo-able, prep the pitch, choreograph the 5 minutes',
                chefs: [
                    { id: 'presenter', task: '5-min pitch structure + demo script + Q&A prep' },
                    { id: 'ui-builder', task: 'UI polish, animations, remove rough edges' },
                ],
                todos: [
                    'Demo path: pre-fill all forms, use test account',
                    'Pitch deck: Problem → Demo → Market → Ask (5 slides)',
                    'One-liner: practice until it sounds natural',
                    'Top 5 judge questions + killer answers',
                    'Backup: screenshots + screen recording if demo breaks',
                ],
            },
            ...(hours >= 36 ? [{
                num: 6, name: 'Final Buffer & Submission', color: '#4ECDC4', icon: '🏁',
                duration: Math.round(scale * 1),
                goal: 'Deploy, submit, dry run presentation',
                chefs: [{ id: 'devops', task: 'final deploy, check all env vars, smoke test' }],
                todos: [
                    'Production deploy — test it, not just localhost!',
                    'Submit project with correct repo + demo URL',
                    'Full dry run of 5-min pitch (time it!)',
                    'Sleep at least 4 hours',
                ],
            }] : []),
        ];
        return phases;
    }

    _getCriticalPath(hours, brief) {
        const items = [
            'Landing page hero that passes the 3-second test (deploy before judging)',
            'At least 1 working end-to-end user flow (not just mockups)',
            'Demo URL that works from any laptop without local setup',
            'A one-liner that makes judges lean forward',
            'Backup recording of the demo in case it breaks live',
        ];
        if (hours <= 12) items.unshift('SCOPE CUT: pick ONE feature and nail it. Not three.');
        if (hours >= 48) items.push('Market validation: at least 3 user interviews before submission');
        return items;
    }
}
