import chalk from 'chalk';

export class CostTracker {
    constructor() {
        this.costs = {
            gemini: { calls: 0, tokens: 0, cost: 0 },
            copilot: { calls: 0, tokens: 0, cost: 0, byModel: {} },
            total: 0
        };
        
        // Pricing per 1M tokens (input/output)
        this.pricing = {
            'GPT-5 mini': { input: 0, output: 0 },
            'GPT-4.1': { input: 0, output: 0 },
            'Claude Sonnet 4.6': { input: 3, output: 15 },
            'Claude Haiku 4.5': { input: 1, output: 5 },
            'Claude Opus 4.6': { input: 15, output: 75 },
            'Gemini 2.5 Pro': { input: 1.25, output: 5 },
            'Gemini 2.5 Flash': { input: 0.075, output: 0.3 }
        };
    }

    track(agent, model, inputTokens, outputTokens) {
        const pricing = this.pricing[model] || { input: 0, output: 0 };
        const cost = (inputTokens * pricing.input + outputTokens * pricing.output) / 1000000;
        
        this.costs[agent].calls++;
        this.costs[agent].tokens += inputTokens + outputTokens;
        this.costs[agent].cost += cost;
        this.costs.total += cost;
        
        if (agent === 'copilot') {
            if (!this.costs.copilot.byModel[model]) {
                this.costs.copilot.byModel[model] = { calls: 0, tokens: 0, cost: 0 };
            }
            this.costs.copilot.byModel[model].calls++;
            this.costs.copilot.byModel[model].tokens += inputTokens + outputTokens;
            this.costs.copilot.byModel[model].cost += cost;
        }
    }

    display() {
        console.log(chalk.bold.cyan('\n💰 Cost Tracking\n'));
        console.log(chalk.gray('─'.repeat(60)));
        
        // Gemini
        const g = this.costs.gemini;
        console.log(chalk.blue('🔮 Gemini'));
        console.log(`   Calls: ${g.calls} | Tokens: ${g.tokens.toLocaleString()} | Cost: $${g.cost.toFixed(4)}`);
        
        // Copilot
        const c = this.costs.copilot;
        console.log(chalk.magenta('\n🐙 Copilot'));
        console.log(`   Calls: ${c.calls} | Tokens: ${c.tokens.toLocaleString()} | Cost: $${c.cost.toFixed(4)}`);
        
        // By model
        if (Object.keys(c.byModel).length > 0) {
            console.log(chalk.gray('   Models:'));
            for (const [model, stats] of Object.entries(c.byModel)) {
                const isFree = model.includes('mini') || model.includes('4.1');
                const color = isFree ? chalk.green : chalk.yellow;
                console.log(color(`     ${model}: ${stats.calls} calls, $${stats.cost.toFixed(4)}`));
            }
        }
        
        // Total
        console.log(chalk.gray('\n─'.repeat(60)));
        console.log(chalk.bold.green(`💵 Total Cost: $${this.costs.total.toFixed(4)}`));
        
        // Savings
        const freeTokens = (c.byModel['GPT-5 mini']?.tokens || 0) + (c.byModel['GPT-4.1']?.tokens || 0);
        if (freeTokens > 0) {
            const savedCost = (freeTokens * 3) / 1000000; // Assume $3/1M if paid
            console.log(chalk.green(`💚 Saved: $${savedCost.toFixed(4)} (using free models)`));
        }
        
        console.log(chalk.gray('─'.repeat(60)) + '\n');
    }

    getSummary() {
        return {
            total: this.costs.total,
            gemini: this.costs.gemini,
            copilot: this.costs.copilot
        };
    }
}
