#!/usr/bin/env node

import '/Users/shubh/Developer/soupz-agents/src/env.js';

import meow from 'meow';
import chalk from 'chalk';
import { ensureDirectories } from '../src/config.js';
import { AgentRegistry } from '../src/agents/registry.js';
import { AgentSpawner } from '../src/agents/spawner.js';
import { Orchestrator } from '../src/orchestrator/router.js';
import { ContextManager } from '../src/context/manager.js';
import { MemoryStore } from '../src/memory/store.js';
import { GradingSystem } from '../src/grading/scorer.js';
import { AuthManager } from '../src/auth/manager.js';
import { UserAuth } from '../src/auth/user-auth.js';
import { Session } from '../src/session.js';
import { autoImport } from '../src/auto-import.js';
import { TokenCompressor } from '../src/core/token-compressor.js';
import { OllamaPreprocessor } from '../src/core/ollama-preprocessor.js';
import { StallMonitor } from '../src/core/stall-monitor.js';
import { CostTracker } from '../src/core/cost-tracker.js';
import { MCPClient } from '../src/mcp/client.js';
import { MemoryPool } from '../src/memory/pool.js';

const VERSION = '0.1.0-alpha';

// Auto-import personas on startup (silent if already done)
const importResult = autoImport();
if (importResult && importResult.imported > 0) {
    // Only show message if actually imported new personas
}

const BANNER = `
${chalk.hex('#6C63FF')('       ███████╗')}${chalk.hex('#A855F7')('  ██████╗')}${chalk.hex('#06B6D4')('  ██╗   ██╗')}${chalk.hex('#4ECDC4')(' ██████╗')}${chalk.hex('#6BCB77')('  ███████╗')}
${chalk.hex('#6C63FF')('       ██╔════╝')}${chalk.hex('#A855F7')(' ██╔═══██╗')}${chalk.hex('#06B6D4')(' ██║   ██║')}${chalk.hex('#4ECDC4')(' ██╔══██╗')}${chalk.hex('#6BCB77')(' ╚══███╔╝')}
${chalk.hex('#6C63FF')('       ███████╗')}${chalk.hex('#A855F7')(' ██║   ██║')}${chalk.hex('#06B6D4')(' ██║   ██║')}${chalk.hex('#4ECDC4')(' ██████╔╝')}${chalk.hex('#6BCB77')('   ███╔╝')}
${chalk.hex('#6C63FF')('       ╚════██║')}${chalk.hex('#A855F7')(' ██║   ██║')}${chalk.hex('#06B6D4')(' ██║   ██║')}${chalk.hex('#4ECDC4')(' ██╔═══╝')}${chalk.hex('#6BCB77')('  ███╔╝')}
${chalk.hex('#6C63FF')('       ███████║')}${chalk.hex('#A855F7')(' ╚██████╔╝')}${chalk.hex('#06B6D4')(' ╚██████╔╝')}${chalk.hex('#4ECDC4')(' ██║')}${chalk.hex('#6BCB77')('     ███████╗')}
${chalk.hex('#6C63FF')('       ╚══════╝')}${chalk.hex('#A855F7')('  ╚═════╝')}${chalk.hex('#06B6D4')('  ╚═════╝')}${chalk.hex('#4ECDC4')('  ╚═╝')}${chalk.hex('#6BCB77')('     ╚══════╝')}
                    ${chalk.bold.hex('#4ECDC4')('S  T  A  L  L')}  ${chalk.dim(`v${VERSION}`)}
`;

const cli = meow(`
${BANNER}
  ${chalk.bold('Usage')}
    $ soupz-stall                        Launch interactive session
    $ soupz-stall --yolo                 Launch with YOLO mode (auto-approve)
    $ soupz-stall run <prompt>           Auto-route task to best agent
    $ soupz-stall run --yolo <prompt>    Run with YOLO mode
    $ soupz-stall ask <agent> <prompt>   Send to specific agent/persona
    $ soupz-stall ask designer "brand identity for HealthAI"
    $ soupz-stall ask svgart "create a modern logo SVG"
    $ soupz-stall ask orchestrator "build a full product launch plan"
    $ soupz-stall chain <a→b→c> <prompt> Chain agents sequentially
    $ soupz-stall fan-out <prompt>       Send to ALL agents in parallel
    $ soupz-stall agents                 List all agents + personas
    $ soupz-stall skills                 List all available skills
    $ soupz-stall auth [login|logout] <agent>  Manage authentication
    $ soupz-stall grades                 Show agent report cards
    $ soupz-stall docs                   Open documentation

  ${chalk.bold('Interactive Commands')}
    /help           Full command reference
    /agents         List all agents with descriptions
    /skills         List all globally available skills
    /agent <id>     Switch default agent (e.g. /agent gemini)
    /agent auto     Switch to auto-routing
    /model          Show current agent + mode
    /yolo           Toggle YOLO mode
    /grades         Report cards
    /dashboard      Open the Command Center (Web Dashboard)
    /tunnel         Expose Cloud Kitchen publicly (no same-WiFi needed)
    /compress       Compress context
    /chain          Chain agents: /chain designer→svgart "prompt"
    @agent <text>   Route to specific agent or persona

  ${chalk.bold('Examples')}
    $ soupz-stall
    $ soupz-stall --yolo
    $ soupz-stall run "Fix the auth bug"
    $ soupz-stall ask designer "Create brand identity for HealthAI startup"
    $ soupz-stall ask svgart "Create a modern logo SVG with gradient"
    $ soupz-stall ask orchestrator "Build a full product launch plan"
    $ soupz-stall chain designer→svgart "brand assets for HealthAI"
    $ soupz-stall ask strategist "Evaluate my startup idea"
    $ soupz-stall ask presenter "Create hackathon pitch for AI trip planner"
    $ soupz-stall ask researcher "Find best free maps API"
`, {
    importMeta: import.meta,
    flags: {
        cwd: { type: 'string', default: process.cwd() },
        agent: { type: 'string' },
        yolo: { type: 'boolean', default: false },
    },
});

async function main() {
    const [command, ...rest] = cli.input;
    const cwd = cli.flags.cwd;
    const yoloFlag = cli.flags.yolo;

    ensureDirectories();

    const registry = new AgentRegistry();
    await registry.init();
    const spawner = new AgentSpawner(registry);
    const context = new ContextManager();
    const memory = new MemoryStore();
    const compressor = new TokenCompressor('medium');
    const preprocessor = new OllamaPreprocessor();
    const costTracker = new CostTracker();
    const grading = new GradingSystem(registry);
    grading.init();
    const auth = new AuthManager(registry);
    const userAuth = new UserAuth();
    const mcpClient = new MCPClient();
    const memoryPool = new MemoryPool();
    const orchestrator = new Orchestrator(registry, spawner, context, memory, { compressor, preprocessor, costTracker, userAuth, memoryPool });
    const kitchenMonitor = new StallMonitor(orchestrator, registry, { costTracker });
    kitchenMonitor.start();

    // Apply YOLO flags if set
    if (yoloFlag) applyYolo(registry);

    // ── add <binary> ──────────────────────────────────────────────────────────
    if (command === 'add') {
        const binary = rest[0];
        if (!binary) { console.error(chalk.red('  Usage: soupz-stall add <binary-name>\n  Example: soupz-stall add ollama')); process.exit(1); }
        const { execSync } = await import('child_process');
        const { writeFileSync } = await import('fs');
        const { join } = await import('path');
        const { homedir } = await import('os');
        let binPath;
        try { binPath = execSync(`which ${binary}`, { encoding: 'utf8' }).trim(); }
        catch { console.error(chalk.red(`  ✖ Binary "${binary}" not found in PATH.`)); process.exit(1); }
        const id = binary.replace(/[^a-z0-9]/gi, '').toLowerCase();
        const agentMd = `---
name: ${binary.charAt(0).toUpperCase() + binary.slice(1)}
id: ${id}
icon: "🤖"
color: "#888888"
binary: ${binary}
headless: true
description: "${binary} CLI agent"
output_format: text
capabilities:
  - code
  - general
build_args: ["-p", "{prompt}"]
grade: 50
usage_count: 0
---

# ${binary} Agent

Custom agent added via \`soupz-stall add ${binary}\`.
Binary: ${binPath}
`;
        const agentPath = join(homedir(), '.soupz-agents', 'agents', `${id}.md`);
        writeFileSync(agentPath, agentMd);
        console.log(BANNER);
        console.log(chalk.green(`  ✔ Added: ${binary}`));
        console.log(chalk.dim(`    Binary: ${binPath}`));
        console.log(chalk.dim(`    Config: ${agentPath}`));
        console.log(chalk.dim(`    Edit the .md file to customize icon, color, build_args, etc.`));
        console.log(chalk.dim(`\n    Now all chefs can run through @${id}!`));
        process.exit(0);
    }

    // ── agents ──────────────────────────────────────────────────────────────
    if (command === 'agents') {
        console.log(BANNER);
        const tools = registry.list().filter((a) => a.type !== 'persona');
        const personas = registry.list().filter((a) => a.type === 'persona');

        console.log(chalk.bold('  🔧 Tool Agents\n'));
        for (const a of tools) {
            const status = a.available ? chalk.green('✔') : chalk.red('✖');
            const type = a.headless ? chalk.cyan('CLI') : chalk.yellow('MON');
            console.log(`  ${status} ${a.icon}  ${chalk.bold(a.name.padEnd(18))} ${type}  G:${a.grade}  ${chalk.dim(a.description || '')}`);
            if (a.binaryPath) console.log(`      ${chalk.dim(`→ ${a.binaryPath}`)}`);
        }

        if (personas.length > 0) {
            console.log(chalk.bold('\n  🎭 Persona Agents\n'));
            for (const a of personas) {
                const via = chalk.dim(`→ @${a.uses_tool}`);
                console.log(`  ${a.icon}  ${chalk.bold(`@${a.id}`.padEnd(18))} ${via}  ${chalk.dim(a.description || '')}`);
            }
            console.log(chalk.dim('\n  Use: soupz-stall ask <persona> "<prompt>" or @<persona> in interactive mode'));
        }
        process.exit(0);
    }

    // ── auth ────────────────────────────────────────────────────────────────
    if (command === 'auth') {
        console.log(BANNER);
        const subCmd = rest[0];
        const agentId = rest[1];
        if (!subCmd || subCmd === 'status') {
            console.log(chalk.bold('  Auth Status\n'));
            for (const a of registry.list()) {
                if (!a.auth_command) continue;
                const ok = await auth.checkAuth(a.id);
                console.log(`  ${a.icon}  ${a.name.padEnd(18)} ${ok ? chalk.green('✔ logged in') : chalk.red('✖ not logged in')}`);
            }
        } else if (subCmd === 'login' && agentId) {
            try { await auth.login(agentId); console.log(chalk.green('  ✔ Logged in!')); }
            catch (e) { console.error(chalk.red(`  ✖ ${e.message}`)); }
        } else if (subCmd === 'logout' && agentId) {
            try { await auth.logout(agentId); console.log(chalk.green('  ✔ Logged out.')); }
            catch (e) { console.error(chalk.red(`  ✖ ${e.message}`)); }
        }
        process.exit(0);
    }

    // ── grades ──────────────────────────────────────────────────────────────
    if (command === 'grades') {
        console.log(BANNER);
        console.log(chalk.bold('  📊 Report Cards\n'));
        const cards = grading.getReportCard();
        for (const c of cards) {
            const bar = '█'.repeat(Math.round(c.grade / 5)) + '░'.repeat(20 - Math.round(c.grade / 5));
            const color = c.grade >= 80 ? '#6BCB77' : c.grade >= 60 ? '#FFD93D' : '#FF6B6B';
            console.log(`  ${c.icon} ${chalk.bold(c.name.padEnd(18))} ${chalk.hex(color)(c.letterGrade.padEnd(3))} ${chalk.hex(color)(bar)} ${c.grade}/100 ${c.trendIcon}`);
        }
        process.exit(0);
    }

    // ── skills ──────────────────────────────────────────────────────────────
    if (command === 'skills') {
        const { getSkills } = await import('../src/skills.js');
        const skills = getSkills();
        console.log(BANNER);
        console.log(chalk.bold('  🧰 Available Skills\n'));
        const byCategory = {};
        for (const s of skills) {
            const cat = s.category || 'general';
            if (!byCategory[cat]) byCategory[cat] = [];
            byCategory[cat].push(s);
        }
        const catColors = { design: '#FF2D55', engineering: '#4ECDC4', orchestration: '#A855F7', research: '#06B6D4', planning: '#FFD93D', strategy: '#6BCB77', communication: '#FF6B35', content: '#F59E0B', documentation: '#8B5CF6', data: '#3B82F6', ideation: '#EC4899', general: '#888' };
        for (const [cat, catSkills] of Object.entries(byCategory)) {
            console.log(chalk.hex(catColors[cat] || '#888').bold(`\n  ${cat.toUpperCase()}`));
            for (const s of catSkills) console.log(`    ${s.icon}  ${chalk.bold(s.invoke.padEnd(18))} ${chalk.dim(s.description.slice(0, 65))}`);
        }
        console.log(chalk.dim('\n  Usage: soupz-stall ask <skill-name> "your prompt"\n'));
        process.exit(0);
    }

    // ── chain ───────────────────────────────────────────────────────────────
    if (command === 'chain') {
        const chainStr = rest[0];
        const prompt = rest.slice(1).join(' ');
        if (!chainStr || !prompt) { console.error(chalk.red('  Usage: soupz-stall chain designer→svgart "your prompt"')); process.exit(1); }
        const agentIds = chainStr.split(/→|->/).map(s => s.trim());
        console.log(BANNER);
        console.log(chalk.hex('#A855F7')(`  🔗 Chain: ${agentIds.join(' → ')}\n`));
        spawner.on('output', (id, p) => { if (p?.text) process.stdout.write(p.text + '\n'); });
        let ctx = prompt;
        for (let i = 0; i < agentIds.length; i++) {
            const agentId = agentIds[i];
            const persona = registry.get(agentId);
            if (!persona) { console.error(chalk.red(`  ✖ Unknown: ${agentId}`)); continue; }
            const toolId = registry.headless()[0]?.id;
            if (!toolId) { console.error(chalk.red('  No tool agents available')); process.exit(1); }
            const stepPrompt = i === 0 ? ctx : `[Previous result]\n${ctx}\n\nContinue: ${prompt}`;
            const fullPrompt = persona.system_prompt ? `${persona.system_prompt}\n\nUser: ${stepPrompt}` : stepPrompt;
            console.log(chalk.hex(persona.color || '#888')(`  ${persona.icon || '○'} Step ${i+1}: @${agentId}`));
            try { ctx = await orchestrator.runOn(toolId, fullPrompt, cwd); }
            catch (e) { console.error(chalk.red(`  ✖ ${e.message}`)); break; }
        }
        process.exit(0);
    }

    // ── docs ────────────────────────────────────────────────────────────────
    if (command === 'docs') {
        const { readFileSync } = await import('fs');
        const { join, dirname } = await import('path');
        const { fileURLToPath } = await import('url');
        const __dirname = dirname(fileURLToPath(import.meta.url));
        try {
            const docs = readFileSync(join(__dirname, '..', 'docs.md'), 'utf8');
            console.log(docs);
        } catch { console.log('  Docs not found. Run from the soupz-stall directory.'); }
        process.exit(0);
    }

    // ── run ─────────────────────────────────────────────────────────────────
    if (command === 'run') {
        const prompt = rest.join(' ');
        if (!prompt) { console.error(chalk.red('  Provide a prompt')); process.exit(1); }
        console.log(BANNER);
        spawner.on('output', (id, p) => { if (p?.text) process.stdout.write(p.text + '\n'); });
        orchestrator.on('route', (info) => console.log(chalk.hex('#FFD93D')(`  🎯 ${info.reason}\n`)));
        try {
            if (cli.flags.agent) await orchestrator.runOn(cli.flags.agent, prompt, cwd);
            else await orchestrator.routeAndRun(prompt, cwd);
            context.save();
        } catch (e) { console.error(chalk.red(`  ✖ ${e.message}`)); }
        process.exit(0);
    }

    // ── ask ─────────────────────────────────────────────────────────────────
    if (command === 'ask') {
        const agentId = rest[0];
        const prompt = rest.slice(1).join(' ');
        if (!agentId || !prompt) { console.error(chalk.red('  Usage: soupz-stall ask <agent> <prompt>')); process.exit(1); }
        const agent = registry.get(agentId);
        if (!agent) { console.error(chalk.red(`  Unknown: ${agentId}. Run: soupz-stall agents`)); process.exit(1); }
        console.log(BANNER);
        spawner.on('output', (_, p) => { if (p?.text) process.stdout.write(p.text + '\n'); });
        try {
            if (agent.type === 'persona') {
                // Resolve tool agent: 'auto' picks the best available
                let toolId = agent.uses_tool;
                if (toolId === 'auto') {
                    const tools = registry.list().filter((a) => a.type !== 'persona' && a.headless && a.available);
                    toolId = tools.length > 0 ? tools[0].id : 'gemini';
                }
                console.log(chalk.hex(agent.color)(`  ${agent.icon} ${agent.name}`) + chalk.dim(` → @${toolId}\n`));
                await spawner.run(toolId, `${agent.system_prompt}\n\nUser: ${prompt}`, cwd);
            } else {
                console.log(chalk.hex(agent.color)(`  ${agent.icon} ${agent.name}\n`));
                await spawner.run(agentId, prompt, cwd);
            }
            context.save();
        } catch (e) { console.error(chalk.red(`  ✖ ${e.message}`)); }
        process.exit(0);
    }

    // ── fan-out ─────────────────────────────────────────────────────────────
    if (command === 'fan-out') {
        const prompt = rest.join(' ');
        if (!prompt) { console.error(chalk.red('  Provide a prompt')); process.exit(1); }
        console.log(BANNER);
        spawner.on('output', (id, p) => {
            if (p?.text) { const a = registry.get(id); process.stdout.write(chalk.hex(a?.color || '#888')(`[${id}] `) + p.text + '\n'); }
        });
        try {
            const results = await orchestrator.fanOut(prompt, cwd);
            for (const r of results) {
                const icon = r.status === 'fulfilled' ? chalk.green('✔') : chalk.red('✖');
                console.log(`${icon} ${r.name}: ${r.status}`);
            }
        } catch (e) { console.error(chalk.red(`  ✖ ${e.message}`)); }
        process.exit(0);
    }

    // ── Interactive Session (default) ───────────────────────────────────────
    const session = new Session({ registry, spawner, orchestrator, contextManager: context, memory, grading, auth, userAuth, cwd, compressor, preprocessor, kitchenMonitor, mcpClient, memoryPool });
    if (yoloFlag) session.yolo = true;
    session.start();

    process.on('SIGINT', () => { spawner.killAll(); context.save(); process.exit(0); });
}

function applyYolo(registry) {
    const gemini = registry.get('gemini');
    if (gemini) gemini.build_args = ['-p', '{prompt}', '--output-format', 'stream-json', '--yolo'];
    const copilot = registry.get('copilot');
    if (copilot) copilot.build_args = ['copilot', '-p', '{prompt}', '--allow-all-tools'];
}

main().catch((e) => { console.error(chalk.red(`Fatal: ${e.message}`)); process.exit(1); });
