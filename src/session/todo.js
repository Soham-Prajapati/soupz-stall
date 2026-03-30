import chalk from 'chalk';

export const TodoMixin = {
    looksLikeTaskList(text) {
        const commaItems = text.split(/,\s*/).filter((s) => s.trim().length > 5);
        if (commaItems.length >= 3) {
            const actionVerbs = /^(create|build|add|set up|implement|write|design|deploy|fix|update|make|install|configure|test|run|push|integrate|refactor|migrate|enable|generate)/i;
            const verbCount = commaItems.filter((s) => actionVerbs.test(s.trim())).length;
            if (verbCount >= 2) return true;
        }
        if (/(\d+[\.\)]\s+\S+.*){2,}/s.test(text)) return true;
        const seqMarkers = (text.match(/\b(then|after that|next|also|finally|first|second|third|lastly|additionally|afterwards)\b/gi) || []).length;
        if (seqMarkers >= 3) return true;
        const semiItems = text.split(/;\s*/).filter((s) => s.trim().length > 5);
        if (semiItems.length >= 3) return true;
        const bulletLines = text.split('\n').filter((l) => /^\s*[-*•]\s+/.test(l));
        if (bulletLines.length >= 3) return true;
        return false;
    },

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
    },

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
            const truncated = t.task.length > W - 12 ? t.task.slice(0, W - 13) + '…' : t.task;
            let right = '';
            if (t.status === 'done' || t.done) right = t.elapsed > 0 ? chalk.dim(`${t.elapsed}s`) : chalk.dim('✔');
            else if (t.status === 'running') right = chalk.hex('#FFD93D')('running…');

            const rightRaw = t.status === 'running' ? 'running…' : (t.done && t.elapsed > 0 ? `${t.elapsed}s` : (t.done ? '✔' : ''));
            const spacer = Math.max(1, W - 8 - truncated.length - rightRaw.length);
            
            process.stdout.write(chalk.hex('#555')('  │') + `${icon}  ${chalk.dim(`${t.id}.`)} ${t.status === 'done' || t.done ? chalk.strikethrough.dim(truncated) : (t.status === 'running' ? chalk.hex('#FFD93D')(truncated) : (t.status === 'failed' ? chalk.red(truncated) : chalk.hex('#CCC')(truncated)))}`);
            process.stdout.write(' '.repeat(spacer) + (right || '') + chalk.hex('#555')('│') + '\n');
        }

        console.log(chalk.hex('#555')(`  │${line}│`));
        console.log(chalk.hex('#555')('  │') + `  ${bar}  ${chalk.hex('#4ECDC4')(`${pct}%`)}` + ' '.repeat(Math.max(0, W - barLen - 9 - String(pct).length)) + chalk.hex('#555')('│'));
        console.log(chalk.hex('#555')(`  ╰${line}╯`));
        console.log(chalk.dim(`\n  /do <n> execute  │  /do all run all  │  /todo refresh\n`));
    },

    showTodo() {
        if (!this.todoList.length) { console.log(chalk.dim('  No tasks. Send a multi-step prompt and I\'ll auto-break it.')); return; }
        this.renderTodoCard();
    },

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
};
