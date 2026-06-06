import chalk from 'chalk';

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
        process.stdout.write('\x1b[s');
        const visCount = Math.min(this.dropdownItems.length, 8);
        const hasTopMore = this.dropdownScroll > 0;
        const hasBottomMore = this.dropdownScroll + 8 < this.dropdownItems.length;
        const totalLines = visCount + (hasTopMore ? 1 : 0) + (hasBottomMore ? 1 : 0);
        for (let i = 0; i < totalLines + 2; i++) process.stdout.write('\x1b[B\x1b[2K');
        process.stdout.write('\x1b[u\x1b[J');
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
        process.stdout.write('\x1b[s');
        if (start > 0) process.stdout.write(`\n\x1b[K   ${chalk.dim(`↑ ${start} more`)}`);
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
        if (end < total) process.stdout.write(`\n\x1b[K   ${chalk.dim(`↓ ${total - end} more`)}`);
        process.stdout.write('\x1b[u');
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
