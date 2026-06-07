import chalk from 'chalk';
import { existsSync, readFileSync, readdirSync, statSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { GEMINI_MODELS, COPILOT_MODELS } from './index.js';
import { SESSIONS_DIR } from './memory.js';

export const CommandsMixin = {
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
    },

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
    },

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
    },

    async handleDelegateCmd(input) {
        const m = input.match(/^(\w+)\s+"(.+)"$/s) || input.match(/^(\w+)\s+(.+)$/s);
        if (!m) { console.log(chalk.dim('  Usage: /delegate <agent> "prompt"')); return; }
        const [, agentId, prompt] = m;
        await this.runPersona(agentId, prompt);
    },

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
    },

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
    },

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
        if (!chain) {
            console.log(chalk.red(`  Unknown recipe: ${recipeId}`));
            this.showRecipes();
            return;
        }
        console.log(chalk.cyan(`\n  📖 Running recipe: ${recipeId}`));
        console.log(chalk.dim(`  Chain: ${chain}\n`));
        await this.handleChain(`${chain} "${prompt}"`);
    },

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
    },

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
    },


    showPersonas() {
        const personas = this.getPersonas();
        const tl = this.activeTool ? chalk.hex(this.registry.get(this.activeTool)?.color || '#FFF')(`via @${this.activeTool}`) : chalk.hex('#4ECDC4')('via best station (auto)');
        console.log(chalk.bold(`\n  👨‍🍳 ${personas.length} Chefs`) + chalk.dim(` — ${tl}\n`));
        for (const a of personas) console.log(`  ${a.icon} ${chalk.bold(`@${a.id}`.padEnd(18))} ${chalk.dim(a.description || '')}`);
        console.log(`\n  ${chalk.hex('#FFD93D')('@auto')} <prompt>  ${chalk.dim('Auto-pick + chain')}\n`);
    }
};
