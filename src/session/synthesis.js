import chalk from 'chalk';
import { spawn } from 'child_process';

/**
 * Synthesize results from multiple parallel agents into a single response.
 */
export async function synthesizeResults(context, prompt, plan, results, availableAgents, fastModel) {
    const successfulResults = results.filter(r => r.code === 0);
    const failedResults = results.filter(r => r.code !== 0);

    if (successfulResults.length === 0) {
        console.log(chalk.red(`  ✖ All sub-agents failed. Unable to synthesize results.`));
        failedResults.forEach((r, i) => {
            console.log(chalk.dim(`\n  Sub-agent ${i + 1} (${r.task}):`));
            console.log(chalk.dim(r.output.slice(0, 500)));
        });
        return null;
    }

    let synthesisPrompt = `You are synthesizing results from ${successfulResults.length} parallel AI agents.

ORIGINAL TASK: ${prompt}

IMPLEMENTATION PLAN:
${plan || 'Execute tasks in parallel.'}

WORKER RESULTS:
`;
    successfulResults.forEach((r, i) => {
        synthesisPrompt += `\n--- Agent ${i + 1} (${r.task}) ---\n${r.output.trim()}\n`;
    });

    if (failedResults.length > 0) {
        synthesisPrompt += `\n--- Failed Workers (excluded from synthesis) ---\n`;
        failedResults.forEach(r => {
            synthesisPrompt += `- ${r.task}: [failed]\n`;
        });
    }

    synthesisPrompt += `\nMerge the best parts from each agent into a single coherent response. Resolve contradictions. Credit agents briefly where helpful.`;

    const copilotAgent = availableAgents.find(a => a.id === 'copilot') || availableAgents[0];
    if (!copilotAgent) {
        console.log(chalk.red('  No agents available for synthesis.'));
        return null;
    }

    const args = (copilotAgent.build_args || []).map(a => a === '{prompt}' ? synthesisPrompt : a);
    if (!args.includes('--model')) args.push('--model', fastModel);

    console.log(chalk.dim(`  Synthesis process starting with ${copilotAgent.id}…\n`));

    let synthesis = '';
    try {
        await new Promise((resolve, reject) => {
            const proc = spawn(copilotAgent.binary, args, { cwd: context.cwd || process.cwd() });
            proc.stdout.on('data', d => {
                const chunk = d.toString();
                synthesis += chunk;
                process.stdout.write(chunk);
            });
            proc.stderr.on('data', d => {
                synthesis += d.toString();
                process.stderr.write(d.toString());
            });
            proc.on('close', (code) => {
                console.log('');
                if (code === 0) resolve(synthesis);
                else reject(new Error(`Synthesis process exited with code ${code}`));
            });
            proc.on('error', reject);
        });
        return synthesis;
    } catch (err) {
        console.log(chalk.red(`  ✖ Synthesis failed: ${err.message}`));
        return null;
    }
}
