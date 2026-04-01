import chalk from 'chalk';
import { spawn, execSync } from 'child_process';
import { randomUUID } from 'crypto';
import { synthesizeResults } from './synthesis.js';

const COPILOT_FAST_MODEL = process.env.SOUPZ_COPILOT_FAST_MODEL || 'gpt-4.1';
const COPILOT_ROUTING_MODEL = process.env.SOUPZ_COPILOT_ROUTING_MODEL || 'gpt-4.1';

export const FleetMixin = {
    async getSmartRouting(prompt) {
        console.log(chalk.hex('#888')('  🧠 Smart Router (gpt-5-mini) analyzing task...'));
        try {
            const availableAgents = this.registry.headless().filter(a => a.available).map(a => a.id).join(', ');
            const routerPrompt = `Analyze the following user request.
Available Agents: ${availableAgents}

Determine:
1. "strategy": 
   - "direct": A simple, straightforward task.
   - "subagent": A task with independent parts that can be done in parallel.
   - "team": A task requiring collaborative discussion, architectural planning, or complex multi-persona thinking (e.g. "design a system", "act as a team lead", "orchestrate this project").
2. "primaryAgent": Best agent for this (prefer 'gemini' for research/UI, 'codex' for deep code reasoning, 'copilot' for GitHub workflow tasks).

Respond ONLY with a JSON object: {"strategy": "direct|subagent|team", "primaryAgent": "agentId"}

Request: "${prompt.slice(0, 1000)}"`;
            
            const out = execSync(`gh copilot explain --model ${COPILOT_ROUTING_MODEL} -p ${JSON.stringify(routerPrompt)}`, { timeout: 15000, encoding: 'utf8' });
            const result = out.toString() || '';
            const match = result.match(/\{\s*"strategy"\s*:\s*"(direct|subagent|team)"\s*,\s*"primaryAgent"\s*:\s*"(\w+)"\s*\}/i);
            if (match) return { strategy: match[1].toLowerCase(), agent: match[2].toLowerCase() };
        } catch { /* ignore error */ }
        return { strategy: 'direct', agent: null };
    },

    getTaskComplexity(prompt) {
        const words = prompt.split(/\s+/).length;
        if (words < 8) return 0;
        const multiStepSignals = [
            /\band\b.*\band\b/i, /\bthen\b/i, /\bfirst\b.*\bthen\b/i, /\b(also|additionally|plus)\b/i,
            /\b(both|all|every|each)\b/i, /\b(create|build|implement|design|fix|test|review|plan)\b.*\b(create|build|implement|design|fix|test|review|plan)\b/i,
            /\d+\.\s/, /[-*]\s.*\n[-*]\s/, /\b(full|complete|entire|whole|end-to-end)\b/i,
        ];
        const signalCount = multiStepSignals.filter(r => r.test(prompt)).length;
        const fleetSignals = [
            /\b(simultaneously|parallel|concurrently)\b/i,
            /\b(multiple|several|different)\b.*\b(files|pages|components|features|services)\b/i,
            /\b(frontend|backend|database|api|ui|server|client)\b.*\b(frontend|backend|database|api|ui|server|client)\b/i,
        ];
        const fleetCount = fleetSignals.filter(r => r.test(prompt)).length;
        if ((signalCount >= 4 && words > 30) || fleetCount >= 2 || words > 100) return 2;
        if (signalCount >= 2 || words > 50) return 1;
        return 0;
    },

    isComplexTask(prompt) { return this.getTaskComplexity(prompt) >= 1; },

    async orchestrateMultiAgent(prompt, primaryToolId) {
        const available = this.registry.headless().filter(a => a.available);
        const agentNames = available.map(a => `${a.icon} ${a.id}`).join(', ');
        console.log(chalk.hex('#A855F7')(`\n  ⚡ Multi-Agent Orchestration (${available.length} kitchens: ${agentNames})`));

        let tasks;
        try {
            console.log(chalk.dim('  🔍 Analyzing task complexity…'));
            tasks = await this.orchestrator.decompose(prompt);
        } catch { tasks = null; }

        if (!tasks || tasks.length <= 1) {
            console.log(chalk.dim('  → Single-focus task, using smart routing with auto-delegation'));
            this.startSpinner(primaryToolId);
            const result = await this.orchestrator.routeAndRun(prompt, this.cwd);
            if (result) await this.processDelegations(result, primaryToolId);
            return;
        }

        console.log(chalk.hex('#4ECDC4')(`  📋 Decomposed into ${tasks.length} sub-tasks:\n`));
        const assignments = tasks.map((task, i) => {
            const toolId = this.pickAgentForTask(task.prompt || task.title, available) || primaryToolId;
            const toolAgent = this.registry.get(toolId);
            console.log(chalk.hex('#4ECDC4')(`  ${i + 1}. `) + chalk.hex(toolAgent?.color || '#888')(`${toolAgent?.icon || '○'} ${toolId}`) + chalk.dim(` — ${task.title}`));
            return { ...task, toolId };
        });

        console.log(chalk.dim(`\n  ─── Parallel dispatch (${assignments.length} agents) ──────────────────────`));
        const startTime = Date.now();
        const results = await Promise.allSettled(assignments.map(a => {
            this.getAgentTokens(a.toolId).prompts++;
            return this.orchestrator.runOn(a.toolId, a.prompt, this.cwd);
        }));

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
        for (const output of outputs) {
            if (output) await this.processDelegations(output, 'orchestrator');
        }
    },

    pickAgentForTask(taskText, available, forceZeroCost = true) {
        const lower = (taskText || '').toLowerCase();
        const geminiSignals = /\b(ui|design|frontend|front-end|css|html|layout|visual|creative|style|color|animation|svg|image|icon|logo|illustration|landing|page|component|react|tailwind|responsive|research|analysis|compare|summarize)\b/i;
        const codexSignals = /\b(refactor|architecture|module|implementation|typescript|javascript|python|bug|fix|debug|test|code review|codebase)\b/i;
        const copilotSignals = /\b(github|pull request|pr|issue|merge|commit|branch|workflow|actions|terminal|shell|cli|command|docker|ci|cd|pipeline)\b/i;
        const ollamaSignals = /\b(local|offline|privacy|on-device|airgapped|no cloud)\b/i;

        const score = (re) => ((lower.match(re) || []).length);
        const scores = {
            gemini: score(geminiSignals),
            codex: score(codexSignals),
            copilot: score(copilotSignals),
            ollama: score(ollamaSignals),
        };

        const byId = (id) => available.find(a => a.id === id);
        const candidates = Object.entries(scores)
            .map(([id, taskScore]) => ({ id, taskScore, agent: byId(id) }))
            .filter((entry) => entry.agent)
            .sort((a, b) => b.taskScore - a.taskScore);

        let picked = candidates[0]?.agent || byId('gemini') || byId('codex') || byId('copilot') || available[0];

        if ((scores.gemini === 0 && scores.codex === 0 && scores.copilot === 0 && scores.ollama === 0) && byId('gemini')) {
            picked = byId('gemini');
        }

        if (forceZeroCost && picked.id === 'copilot') picked._forceModel = COPILOT_FAST_MODEL;
        return picked;
    },

    async runSubAgents(prompt) {
        const available = this.registry.headless().filter(a => a.available);
        if (available.length === 0) return console.log(chalk.red('  No kitchens available.'));
        console.log(chalk.hex('#A855F7')(`\n  🧬 Sub-Agent Workflow — decomposing task into atomic steps…`));
        let tasks;
        try { tasks = await this.orchestrator.decompose(prompt); } catch { tasks = [{ title: 'Execute task', prompt: prompt }]; }
        console.log(chalk.dim(`  Generated ${tasks.length} sub-tasks.`));
        console.log(chalk.hex('#A855F7')(`  📝 Creating implementation plan…`));
        let plan = '';
        try {
            const planPrompt = `Create a high-level technical implementation plan for these tasks. Be surgical and precise. 
Original request: "${prompt}"
Tasks:
${tasks.map((t, i) => `${i + 1}. ${t.title}: ${t.prompt}`).join('\n')}

Implementation Plan:`;
            const planOut = execSync(`gh copilot explain --model ${COPILOT_FAST_MODEL} -p ${JSON.stringify(planPrompt)}`, { timeout: 20000, encoding: 'utf8' });
            plan = planOut.toString().trim();
            console.log(chalk.dim(plan.slice(0, 500) + '...'));
        } catch { plan = 'Execute tasks in parallel.'; }

        const workerCount = Math.min(tasks.length, 4);
        console.log(chalk.hex('#4ECDC4')(`\n  📡 Spawning ${workerCount} isolated sub-agents based on the plan…\n`));
        const results = await Promise.all(tasks.slice(0, workerCount).map((task, i) => {
            return new Promise((resolve) => {
                const agent = this.pickAgentForTask(task.prompt || task.title, available, true);
                console.log(chalk.hex(agent.color || '#888')(`  ${i + 1}. Sub-agent [${agent.id}]`) + chalk.dim(` — ${task.title}`));
                const taskWithPlan = `Plan Context: ${plan}\n\nYour specific sub-task: ${task.prompt || task.title}`;
                const args = (agent.build_args || []).map(a => a === '{prompt}' ? taskWithPlan : a);
                if (agent._forceModel && !args.includes('--model')) args.push('--model', agent._forceModel);
                else if (agent.id === 'copilot' && !args.includes('--model')) args.push('--model', COPILOT_FAST_MODEL);
                const proc = spawn(agent.binary, args, { cwd: this.cwd || process.cwd() });
                let out = '';
                proc.stdout.on('data', d => out += d.toString());
                proc.stderr.on('data', d => out += d.toString());
                proc.on('close', (code) => resolve({ task: task.title, output: out, code }));
            });
        }));

        console.log(chalk.hex('#A855F7')(`\n  🧠 Synthesis Phase — synthesizing sub-agent reports…\n`));
        await synthesizeResults(this, prompt, plan, results, available, COPILOT_FAST_MODEL);
    },

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
            if (agent.id === 'copilot' && !args.includes('--model')) args.push('--model', COPILOT_FAST_MODEL);
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
    },

    async spawnFleet(prompt) {
        const available = this.registry.headless().filter(a => a.available);
        if (available.length === 0) return console.log(chalk.red('  No kitchens available for fleet deployment.'));
        let tasks;
        try {
            console.log(chalk.hex('#A855F7')(`\n  🚀 Fleet Deployment — analyzing task…`));
            tasks = await this.orchestrator.decompose(prompt);
        } catch { tasks = null; }
        if (!tasks || tasks.length <= 1) tasks = [{ title: 'Execute task', description: prompt }];

        const workerCount = Math.min(tasks.length, available.length, 4);
        if (!this._fleet) this._fleet = [];
        console.log(chalk.hex('#4ECDC4')(`  📡 Deploying ${workerCount} hidden workers…\n`));

        for (let i = 0; i < workerCount; i++) {
            const task = tasks[i];
            const taskPrompt = task.description || task.title || prompt;
            const agent = this.pickAgentForTask(taskPrompt, available);
            console.log(chalk.hex(agent.color || '#888')(`  ${i + 1}. ${agent.icon} ${agent.id}`) + chalk.dim(` — ${task.title}`));
            const args = (agent.build_args || []).map(a => a === '{prompt}' ? taskPrompt : a);
            const savedModel = this.modelPrefs[agent.id] || this.modelPrefs.auto;
            if (savedModel && agent.id === 'copilot' && !args.includes('--model')) args.push('--model', savedModel);

            const workerId = randomUUID().slice(0, 8);
            const proc = spawn(agent.binary, args, { cwd: this.cwd || process.cwd() });
            const worker = { id: workerId, task: task.title, agent: agent.id, startTime: Date.now(), status: 'running', output: '', proc };
            this._fleet.push(worker);
            proc.stdout.on('data', d => worker.output += d.toString());
            proc.stderr.on('data', d => worker.output += d.toString());
            proc.on('close', (code) => {
                worker.status = code === 0 ? 'done' : 'failed';
                worker.duration = Date.now() - worker.startTime;
            });
        }
    },

    showFleetStatus() {
        if (!this._fleet || !this._fleet.length) return console.log(chalk.dim('  No active fleet workers.'));
        console.log(chalk.bold('\n  🚀 Active Fleet Workers\n'));
        this._fleet.forEach((w, i) => {
            const status = w.status === 'running' ? chalk.yellow('● running') : w.status === 'done' ? chalk.green('✔ done') : chalk.red('✖ failed');
            console.log(`  ${i + 1}. ${chalk.bold(w.id)} ${chalk.dim(`(${w.agent})`)} ${status.padEnd(20)} ${chalk.dim(w.task)}`);
        });
        console.log(chalk.dim('\n  /fleet peek <id> to see output\n'));
    },

    peekFleetWorker(id) {
        const worker = this._fleet?.find(w => w.id === id);
        if (!worker) return console.log(chalk.red(`  Worker ${id} not found.`));
        console.log(chalk.bold(`\n  📄 Output from worker ${id} (${worker.task})\n`));
        console.log(chalk.dim('─'.repeat(50)));
        console.log(worker.output || chalk.italic('  (no output yet)'));
        console.log(chalk.dim('─'.repeat(50)) + '\n');
    },

    async refreshAllModels() {
        console.log(chalk.dim('  Probing all kitchens for available utensils…'));
        try {
            const res = await fetch(`http://localhost:${process.env.SOUPZ_REMOTE_PORT || 7533}/api/models/refresh`, { method: 'POST' });
            if (res.ok) console.log(chalk.green('  ✔ All utensils refreshed!'));
            else console.log(chalk.red('  ✖ Refresh failed. Is the daemon running?'));
        } catch { console.log(chalk.red('  ✖ Connectivity error. Ensure daemon is on.')); }
    },

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
            { id: 'api-design', name: 'API Design', chefs: 'architect→dev→tea→qa→devops', desc: 'Complete API from schema to deployment' },
        ];
        console.log(chalk.bold('\n  📖 Recipes — Pre-built Chef Workflows\n'));
        for (const r of recipes) {
            console.log(chalk.cyan(`  ${r.id}`));
            console.log(chalk.white(`    ${r.name} — ${r.desc}`));
            console.log(chalk.dim(`    /recipe ${r.id} "your project description"`));
            console.log(chalk.dim(`    Chefs: ${r.chefs}\n`));
        }
        console.log(chalk.dim('  Run: /recipe <id> "prompt"  — or — /chain to build your own\n'));
    },

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
        if (!chain) return console.log(chalk.red(`  Recipe "${recipeId}" not found.`));
        await this.handleInput(`/chain ${chain} "${prompt}"`);
    }
};
