import chalk from 'chalk';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';

const SESSIONS_DIR = join(homedir(), '.soupz-agents', 'sessions');

export const MemoryMixin = {
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
    },

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
    },

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
    },

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
    },

    pantryStore(text) {
        if (!text) { console.log(chalk.dim('  Usage: /stock store <text to remember>')); return; }
        const item = this.pantry.store('manual', text);
        console.log(chalk.green(`  📦 Stocked in pantry #${item.id} (${item.tokens} tokens)`));
    },

    pantryRecall(query) {
        if (!query) { console.log(chalk.dim('  Usage: /stock recall <what to find>')); return; }
        const results = this.pantry.recall(query);
        if (!results.length) { console.log(chalk.dim('  Nothing matching in the pantry.')); return; }
        console.log(chalk.bold(`\n  🔍 Found ${results.length} pantry item(s)\n`));
        for (const r of results.slice(0, 3)) {
            console.log(chalk.hex('#4ECDC4')(`  📦 Item #${r.id}`) + chalk.dim(` (${r.label}, score:${r.score})`));
            console.log(chalk.dim(`  ${r.content.slice(0, 200).replace(/\n/g, ' ')}…\n`));
        }
    },

    setPantryMax(val) {
        const n = parseInt(val, 10);
        if (!n || n < 1) { console.log(chalk.dim('  Usage: /pantry max <number>')); return; }
        this.pantry.setMaxItems(n);
        console.log(chalk.green(`  🥫 Pantry capacity set to ${n} items`));
    },

    autoOffloadContext() {
        if (this.conversationLog.length > 50) {
            const old = this.conversationLog.splice(0, 20);
            const text = old.map((m) => `[${m.role}] ${m.text}`).join('\n');
            this.pantry.offload('auto-context', text);
            console.log(chalk.dim(`  📦 Auto-stocked 20 messages in pantry`));
        }
    },

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
};
