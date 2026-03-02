import chalk from 'chalk';

export class ColoredOutput {
    static agent(name, message) {
        console.log(chalk.blue.bold(`\n🤖 ${name}:`));
        console.log(chalk.white(message));
    }

    static user(message) {
        console.log(chalk.cyan.bold('\n👤 You:'));
        console.log(chalk.white(message));
    }

    static system(message) {
        console.log(chalk.gray(`\n⚙️  ${message}`));
    }

    static success(message) {
        console.log(chalk.green(`\n✅ ${message}`));
    }

    static error(message) {
        console.log(chalk.red(`\n❌ ${message}`));
    }

    static warning(message) {
        console.log(chalk.yellow(`\n⚠️  ${message}`));
    }

    static info(message) {
        console.log(chalk.blue(`\nℹ️  ${message}`));
    }

    static code(code, language = '') {
        console.log(chalk.gray('\n```' + language));
        console.log(chalk.white(code));
        console.log(chalk.gray('```\n'));
    }

    static file(filename) {
        return chalk.cyan.underline(filename);
    }

    static command(cmd) {
        return chalk.yellow.bold(cmd);
    }

    static url(url) {
        return chalk.blue.underline(url);
    }

    static highlight(text) {
        return chalk.bgYellow.black(` ${text} `);
    }

    static dim(text) {
        return chalk.gray(text);
    }

    static bold(text) {
        return chalk.bold(text);
    }

    static route(agent, reason, confidence) {
        const confColor = confidence > 0.8 ? chalk.green : confidence > 0.5 ? chalk.yellow : chalk.red;
        console.log(chalk.gray('\n─'.repeat(60)));
        console.log(chalk.blue('🎯 Routing:'), chalk.bold(agent));
        console.log(chalk.gray('   Reason:'), reason);
        console.log(chalk.gray('   Confidence:'), confColor(`${(confidence * 100).toFixed(0)}%`));
        console.log(chalk.gray('─'.repeat(60)));
    }

    static task(status, message) {
        const icons = {
            pending: '🔵',
            running: '🟡',
            done: '✅',
            error: '❌'
        };
        const colors = {
            pending: chalk.blue,
            running: chalk.yellow,
            done: chalk.green,
            error: chalk.red
        };
        console.log(colors[status](`${icons[status]} ${message}`));
    }

    static progress(current, total, label = '') {
        const percent = Math.round((current / total) * 100);
        const filled = Math.round(percent / 5);
        const empty = 20 - filled;
        const bar = '█'.repeat(filled) + '░'.repeat(empty);
        
        console.log(chalk.cyan(`\n${label}`));
        console.log(chalk.gray(`${bar} ${percent}% (${current}/${total})`));
    }

    static table(headers, rows) {
        const colWidths = headers.map((h, i) => 
            Math.max(h.length, ...rows.map(r => String(r[i]).length))
        );
        
        // Header
        console.log('\n' + chalk.bold(
            headers.map((h, i) => h.padEnd(colWidths[i])).join(' | ')
        ));
        console.log(chalk.gray(colWidths.map(w => '─'.repeat(w)).join('─┼─')));
        
        // Rows
        rows.forEach(row => {
            console.log(
                row.map((cell, i) => String(cell).padEnd(colWidths[i])).join(' | ')
            );
        });
        console.log('');
    }
}
