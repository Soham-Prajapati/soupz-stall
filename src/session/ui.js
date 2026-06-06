import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import os from 'os';
export const VIBES = [
    '🍳 cooking up some magic…', '☕ brewing intelligence…', '🧪 mixing the perfect formula…',
    '🚀 locked in. let\'s build.', '💅 slay mode activated.', '🔥 it\'s giving productivity.',
    '🧠 big brain energy loading…', '⚡ no cap, about to go crazy.',
    '🎯 main character energy.', '✨ vibes: immaculate.',
    '🫡 at your service, boss.', '💻 built different.',
    '🫕 stove is hot. let\'s cook.', '🔪 mise en place. ready to slice.',
    '🍜 serving up fresh code.', '👨‍🍳 chef\'s kiss incoming.',
];

export const BYES = ['✌️ peace out!', '👋 later!', '🫡 until next time, boss.', '🔥 that was fire. see ya.', '💤 zzz…'];

export const BANNER = `
${chalk.hex('#6C63FF')('       ███████╗ ')}${chalk.hex('#A855F7')(' ██████╗ ')}${chalk.hex('#06B6D4')(' ██╗   ██╗')}${chalk.hex('#4ECDC4')(' ██████╗ ')}${chalk.hex('#6BCB77')(' ███████╗')}
${chalk.hex('#6C63FF')('       ██╔════╝ ')}${chalk.hex('#A855F7')('██╔═══██╗')}${chalk.hex('#06B6D4')(' ██║   ██║')}${chalk.hex('#4ECDC4')(' ██╔══██╗')}${chalk.hex('#6BCB77')(' ╚══███╔╝')}
${chalk.hex('#6C63FF')('       ███████╗ ')}${chalk.hex('#A855F7')('██║   ██║')}${chalk.hex('#06B6D4')(' ██║   ██║')}${chalk.hex('#4ECDC4')(' ██████╔╝')}${chalk.hex('#6BCB77')('   ███╔╝ ')}
${chalk.hex('#6C63FF')('       ╚════██║ ')}${chalk.hex('#A855F7')('██║   ██║')}${chalk.hex('#06B6D4')(' ██║   ██║')}${chalk.hex('#4ECDC4')(' ██╔═══╝ ')}${chalk.hex('#6BCB77')('  ███╔╝  ')}
${chalk.hex('#6C63FF')('       ███████║ ')}${chalk.hex('#A855F7')('╚██████╔╝')}${chalk.hex('#06B6D4')(' ╚██████╔╝')}${chalk.hex('#4ECDC4')(' ██║     ')}${chalk.hex('#6BCB77')(' ███████╗')}
${chalk.hex('#6C63FF')('       ╚══════╝ ')}${chalk.hex('#A855F7')(' ╚═════╝ ')}${chalk.hex('#06B6D4')('  ╚═════╝ ')}${chalk.hex('#4ECDC4')(' ╚═╝     ')}${chalk.hex('#6BCB77')(' ╚══════╝')}
                    ${chalk.bold.hex('#4ECDC4')('S  T  A  L  L')}  ${chalk.dim('v0.1-alpha')}
`;

export const HR = chalk.hex('#444')('━'.repeat(65));

export const COMMANDS = [
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
    { cmd: '/fleet runs', desc: 'List recent fleet runs', icon: '🧾', cat: 'cooking' },
    { cmd: '/fleet result', desc: 'Show synthesized fleet result: /fleet result <run-id>', icon: '📄', cat: 'cooking' },
    { cmd: '/subagent',   desc: 'Spawn isolated sub-agents & synthesize: /subagent "prompt"', icon: '🧬', cat: 'cooking' },
    { cmd: '/team',       desc: 'Run a collaborative agent team: /team "prompt"', icon: '👥', cat: 'cooking' },
    { cmd: '/svgart',     desc: 'Generate SVG asset: /svgart logo "HealthAI logo, blue, geometric"', icon: '🎨', cat: 'cooking' },
    { cmd: '/hackathon',  desc: 'Hackathon mode — phased plan, todos, chef assignments', icon: '🏁', cat: 'cooking' },
    { cmd: '/spill',      desc: 'Toggle spill mode — no restrictions, full send 🫕', icon: '🌊', cat: 'cooking' },
    { cmd: '/browse',     desc: 'Screenshot localhost', icon: '🌐', cat: 'cooking' },
    { cmd: '/todo',       desc: 'The menu (task list)', icon: '📋', cat: 'tasks' },
    { cmd: '/do',         desc: 'Cook a dish: /do 1 (execute todo)', icon: '▶️', cat: 'tasks' },
    { cmd: '/tokens',     desc: 'Ingredient usage (token stats)', icon: '📊', cat: 'tasks' },
    { cmd: '/costs',      desc: 'Bill tracker (cost tracking)', icon: '💰', cat: 'tasks' },
    { cmd: '/grades',     desc: 'Kitchen ratings per station', icon: '🏆', cat: 'tasks' },
    { cmd: '/rename',     desc: 'Name this order (session)', icon: '💾', cat: 'session' },
    { cmd: '/sessions',   desc: 'Order history (saved sessions)', icon: '📂', cat: 'session' },
    { cmd: '/load',       desc: 'Reopen an order', icon: '📥', cat: 'session' },
    { cmd: '/clear',      desc: 'Clear the counter (reset context)', icon: '🧹', cat: 'session' },
    { cmd: '/sandbox',    desc: 'Toggle pantry lock (~/Developer)', icon: '🔒', cat: 'session' },
    { cmd: '/cloud-kitchen', desc: 'Start/show remote access server', icon: '☁️', cat: 'remote' },
    { cmd: '/tunnel', desc: 'Expose Cloud Kitchen publicly (no same-WiFi needed)', icon: '🌍', cat: 'remote' },
    { cmd: '/dashboard', desc: 'Open live stall monitor', icon: '📺', cat: 'remote' },
    { cmd: '/pantry',    desc: 'Pantry storage status', icon: '🥫', cat: 'storage' },
    { cmd: '/stock',     desc: 'Store/recall from pantry', icon: '📦', cat: 'storage' },
    { cmd: '/memory',     desc: 'Recipe memory stats', icon: '🧠', cat: 'storage' },
    { cmd: '/compress',   desc: 'Token compression settings & stats', icon: '📦', cat: 'storage' },
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

export const UIMixin = {
    async askConfirmation(question, choices = ['Yes', 'No']) {
        return new Promise((resolve) => {
            let selected = 0;
            const render = () => {
                const parts = choices.map((c, i) => i === selected ? chalk.hex('#FFD93D').bold(`▸ ${c}`) : chalk.dim(`  ${c}`));
                process.stdout.write(`\r  ❓ ${chalk.bold(question)}  ${parts.join('  ')}  `);
            };
            render();
            const onKey = (ch, key) => {
                if (key.name === 'left') { selected = Math.max(0, selected - 1); render(); }
                if (key.name === 'right') { selected = Math.min(choices.length - 1, selected + 1); render(); }
                if (key.name === 'return') {
                    process.stdin.removeListener('keypress', onKey);
                    process.stdout.write('\n');
                    resolve(choices[selected]);
                }
            };
            process.stdin.on('keypress', onKey);
        });
    },

    renderPrompt() {
        const displayBuf = this.colorizeInput(this.inputBuffer);
        if (this._prompted) {
            const cols = process.stdout.columns || 80;
            const rows = ('❯ ' + (this._lastPromptBuf || '')).split('\n');
            let lines = 0;
            for (const r of rows) lines += Math.max(1, Math.ceil(r.length / cols));
            const moveUp = lines - 1;
            if (moveUp > 0) process.stdout.write(`\x1b[${moveUp}A`);
            process.stdout.write('\r\x1b[J');
        }
        process.stdout.write('\r\x1b[K' + chalk.bold.hex('#6C63FF')('❯') + ' ' + displayBuf);
        this._prompted = true;
        this._lastPromptBuf = this.inputBuffer;
    },

    startSpinner(agentId) {
        this.busyAgentId = agentId;
        const spinChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        this.spinnerFrame = 0;
        this.spinnerTimer = setInterval(() => {
            const ch = spinChars[this.spinnerFrame % spinChars.length];
            process.stdout.write(`\r\x1b[K  ${chalk.hex('#A855F7')(ch)} ${chalk.hex('#A855F7')('Thinking…')}`);
            this.spinnerFrame++;
        }, 80);
    },

    stopSpinner() {
        if (this.spinnerTimer) { clearInterval(this.spinnerTimer); this.spinnerTimer = null; }
        process.stdout.write('\r\x1b[K');
    },

    eraseDropdownLines() {
        if (!this.dropdownVisible) return;
        process.stdout.write('\n\x1b[J\x1b[A');
        this.dropdownVisible = false;
    },

    paintDropdown() {
        if (!this.dropdownItems.length) return;
        this.dropdownVisible = true;
        const maxVisible = 8;
        const total = this.dropdownItems.length;
        if (this.dropdownIndex < this.dropdownScroll) this.dropdownScroll = this.dropdownIndex;
        else if (this.dropdownIndex >= this.dropdownScroll + maxVisible) this.dropdownScroll = this.dropdownIndex - maxVisible + 1;
        this.dropdownScroll = Math.max(0, Math.min(this.dropdownScroll, total - maxVisible));
        if (total <= maxVisible) this.dropdownScroll = 0;
        const start = this.dropdownScroll;
        const end = Math.min(start + maxVisible, total);
        const linesToDraw = [];
        if (start > 0) linesToDraw.push(`   ${chalk.dim(`↑ ${start} more`)}`);
        for (let i = start; i < end; i++) {
            const item = this.dropdownItems[i];
            const sel = i === this.dropdownIndex;
            const pre = sel ? chalk.hex('#6C63FF')(' ▸ ') : '   ';
            const icon = item.icon ? `${item.icon} ` : '';
            const label = sel ? chalk.bold.hex('#FFD93D')(icon + item.label) : chalk.hex('#CCC')(icon + item.label);
            const desc = item.desc ? (sel ? chalk.hex('#AAA')(` — ${item.desc}`) : chalk.hex('#666')(` — ${item.desc}`)) : '';
            linesToDraw.push(`${pre}${label}${desc}`);
        }
        if (end < total) linesToDraw.push(`   ${chalk.dim(`↓ ${total - end} more`)}`);

        process.stdout.write('\n\x1b[J'); // move down and clear old dropdown space
        for (let i = 0; i < linesToDraw.length; i++) {
            process.stdout.write('\x1b[K' + linesToDraw[i] + (i < linesToDraw.length - 1 ? '\n' : ''));
        }
        // move back up to the prompt line
        if (linesToDraw.length > 0) {
            process.stdout.write(`\x1b[${linesToDraw.length}A`);
        }
        // Ensure cursor is correctly positioned on the prompt
        this.renderPrompt();
    },

    closeDropdown() { this.eraseDropdownLines(); this.dropdownItems = []; this.dropdownIndex = -1; this.dropdownScroll = 0; },
    refreshDropdown() { this.eraseDropdownLines(); this.paintDropdown(); },

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
            for (const c of items) console.log(`  ${c.icon} ${chalk.hex('#06B6D4').bold(c.cmd.padEnd(16))} ${chalk.hex('#888')(c.desc)}`);
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
    },

    resetPromptState() { this._prompted = false; },

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
        if (key.name === 'up' && this.dropdownItems && this.dropdownItems.length > 0) {
            this.dropdownIndex = Math.max(0, this.dropdownIndex - 1);
            this.refreshDropdown(); return;
        }
        if (key.name === 'down' && this.dropdownItems && this.dropdownItems.length > 0) {
            this.dropdownIndex = Math.min(this.dropdownItems.length - 1, this.dropdownIndex + 1);
            this.refreshDropdown(); return;
        }

        // ↑↓ command history when no dropdown
        if (key.name === 'up' && (!this.dropdownItems || this.dropdownItems.length === 0) && this.cmdHistory && this.cmdHistory.length > 0) {
            if (this.cmdHistoryIndex < 0) this.cmdHistoryIndex = this.cmdHistory.length;
            this.cmdHistoryIndex = Math.max(0, this.cmdHistoryIndex - 1);
            this.inputBuffer = this.cmdHistory[this.cmdHistoryIndex] || '';
            this.renderPrompt(); return;
        }
        if (key.name === 'down' && (!this.dropdownItems || this.dropdownItems.length === 0) && this.cmdHistoryIndex >= 0) {
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
        if (key.name === 'tab' && this.dropdownItems && this.dropdownItems.length > 0 && this.dropdownIndex >= 0) {
            const item = this.dropdownItems[this.dropdownIndex];
            this.closeDropdown();
            this.inputBuffer = item.value;
            this.renderPrompt();
            return;
        }

        // Enter on dropdown → auto-submit command
        if (key.name === 'return' && this.dropdownItems && this.dropdownItems.length > 0 && this.dropdownIndex >= 0) {
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
        if (key?.sequence === '\x1b[13;2u' || (key.name === 'return' && (key.shift || key.meta))) {
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

        // If raw data handler caught a shift+enter but readline emitted a plain 'return'
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
            // Save to command history
            if (!this.cmdHistory) this.cmdHistory = [];
            if (this.cmdHistory[this.cmdHistory.length - 1] !== input) {
                this.cmdHistory.push(input);
                if (this.cmdHistory.length > 100) this.cmdHistory.shift();
            }
            this.busy = true;
            this.handleInput(input).then(() => { this.busy = false; this.busyAgentId = null; this.resetPromptState(); this.renderPrompt(); })
                .catch((err) => { console.log(chalk.red(`  ✖ ${err.message}`)); this.busy = false; this.busyAgentId = null; this.resetPromptState(); this.renderPrompt(); });
            return;
        }

        // Backspace
        if (key.name === 'backspace') {
            if (key.meta) {
                this.closeDropdown();
                this.inputBuffer = this.inputBuffer.replace(/\S+\s*$/, '');
                this.renderPrompt();
                const buf = this.inputBuffer;
                if (buf.startsWith('/') || (buf.startsWith('@') && !buf.includes(' ')) || (buf.startsWith('#') && !buf.includes(' '))) this.buildDropdown();
                return;
            }
            if (this.inputBuffer.length > 0) {
                this.closeDropdown();
                this.inputBuffer = this.inputBuffer.slice(0, -1);
                this.renderPrompt();
                const buf = this.inputBuffer;
                if (buf.startsWith('/') || (buf.startsWith('@') && !buf.includes(' ')) || (buf.startsWith('#') && !buf.includes(' '))) {
                    this.buildDropdown();
                }
            }
            return;
        }

        // Delete character at a time when holding ctrl+backspace
        if (key.name === 'backspace' && key.ctrl) {
            this.closeDropdown(); this.inputBuffer = ''; this.renderPrompt(); return;
        }

        if (key.name === 'escape') { if (this.dropdownItems && this.dropdownItems.length > 0) this.closeDropdown(); return; }
        if (ch && !key.ctrl && !key.meta && key.name !== 'up' && key.name !== 'down') this.insertChar(ch);
    },

    insertChar(ch) { this.eraseDropdownLines(); this.inputBuffer += ch; this.renderPrompt(); this.buildDropdown(); },

    buildDropdown() {
        const input = this.inputBuffer;
        const dedup = (items) => { const seen = new Set(); return items.filter((i) => { if (seen.has(i.label)) return false; seen.add(i.label); return true; }); };
        
        if (input.startsWith('/station ') || input.startsWith('/tool ')) {
            const prefix = input.startsWith('/station ') ? input.slice(9).toLowerCase() : input.slice(6).toLowerCase();
            const tools = [
                { label: 'auto', desc: '🎯 Smart routing', icon: '🎯', value: '/station auto' },
                ...this.getTools().map((t) => {
                    const saved = this.modelPrefs ? this.modelPrefs[t.id] : null;
                    const desc = saved ? `${t.description || t.name} (utensil: ${saved})` : (t.description || t.name);
                    return { label: t.id, desc, icon: t.icon, value: `/station ${t.id}` };
                })
            ].filter((i) => i.label.startsWith(prefix) || !prefix);
            this.dropdownItems = dedup(tools);
            this.dropdownIndex = tools.length > 0 ? 0 : -1;
            this.refreshDropdown();
            return;
        }

        if (input.startsWith('/utensil ') || input.startsWith('/model ')) {
            const prefix = input.startsWith('/utensil ') ? input.slice(9).toLowerCase() : input.slice(7).toLowerCase();
            let allModels = [];
            if (!this.activeTool || this.activeTool === 'gemini') {
                allModels.push({ id: 'gemini-2.5-flash', desc: '0.1x (FAST)', tool: 'gemini', icon: '🔮' });
                allModels.push({ id: 'gemini-2.5-pro', desc: '1x (SMART)', tool: 'gemini', icon: '🔮' });
            }
            if (!this.activeTool || this.activeTool === 'copilot') {
                allModels.push({ id: 'gpt-5.1-codex', desc: '1x', tool: 'copilot', icon: '🐙' });
                allModels.push({ id: 'gpt-4.1-mini', desc: '0x (FREE)', tool: 'copilot', icon: '🐙' });
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

        if (input.startsWith('@')) {
            const prefix = input.toLowerCase().slice(1);
            if (prefix.includes(' ')) { this.closeDropdown(); return; }
            this.dropdownItems = dedup(this.getPersonas().filter((a) => a.id.startsWith(prefix))
                .map((a) => ({ label: `@${a.id}`, desc: a.description || a.name, icon: a.icon, value: `@${a.id} `, type: 'persona' })));
            this.dropdownIndex = this.dropdownItems.length > 0 ? 0 : -1;
            this.refreshDropdown();
            return;
        }

        if (input.startsWith('#')) {
            const prefix = input.slice(1);
            if (prefix.includes(' ')) { this.closeDropdown(); return; }
            try {
                const cwd = this.cwd;
                let dir = cwd;
                let filter = prefix;
                if (prefix.includes('/')) {
                    const parts = prefix.split('/');
                    filter = parts.pop();
                    dir = path.join(cwd, parts.join('/'));
                }
                const files = fs.readdirSync(dir).filter(f => !f.startsWith('.') && f !== 'node_modules').map(f => {
                    const isDir = fs.statSync(path.join(dir, f)).isDirectory();
                    return { label: f + (isDir ? '/' : ''), desc: isDir ? 'directory' : 'file', icon: isDir ? '📁' : '📄', value: '#' + (prefix.includes('/') ? prefix.slice(0, prefix.lastIndexOf('/') + 1) : '') + f + (isDir ? '/' : ' '), type: 'file' };
                }).filter(f => f.label.startsWith(filter));
                this.dropdownItems = dedup(files).slice(0, 10);
                this.dropdownIndex = this.dropdownItems.length > 0 ? 0 : -1;
                this.refreshDropdown();
            } catch { this.closeDropdown(); }
            return;
        }
        this.closeDropdown();
    },

    exitSession() {
        this.closeDropdown();
        if (this.sessionName) this.saveSession();
        if (this.context) this.context.save();
        if (this.spawner) this.spawner.killAll();
        try { 
            fs.writeFileSync(path.join(os.homedir(), '.soupz-agents', 'history'), this.cmdHistory.slice(-100).join('\n')); 
        } catch {}
        if (this._modelRefreshTimer) clearInterval(this._modelRefreshTimer);
        if (this._cloudKitchen) { this._cloudKitchen.stop(); this._cloudKitchen = null; }
        if (this._tunnel?.proc) { try { this._tunnel.proc.kill(); } catch {} this._tunnel = null; }
        if (this._fleet) {
            for (const w of this._fleet) {
                if (w.proc && w.status === 'running') try { w.proc.kill(); } catch {}
            }
            this._fleet = [];
        }
        process.stdout.write(`\n${chalk.hex('#A855F7')(`  ${BYES[Math.floor(Math.random() * BYES.length)]}`)}\n\n`);
        process.exit(0);
    },

    showToolAgents() {
        const all = this.registry.list().filter((a) => a.type !== 'persona');
        const cnt = this.getPersonas().length;
        console.log(chalk.bold('\n  🍳 The Kitchen (Cooking Stations)'));
        console.log(chalk.dim(`  ${cnt} chefs ready to cook. /tool <id> to pick station\n`));
        for (const a of all) {
            const s = a.available ? chalk.green('✔') : chalk.red('✖');
            const active = this.activeTool === a.id ? chalk.hex('#FFD93D')(' ← active station') : '';
            console.log(`  ${s} ${a.icon} ${chalk.bold(a.id.padEnd(12))} ${chalk.dim(a.name)}${active}`);
        }
        console.log(chalk.dim('\n  /station <id> to switch  │  /utensil <model> to switch model\n'));
    }
};
