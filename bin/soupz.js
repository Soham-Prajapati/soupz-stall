#!/usr/bin/env node

// ─── Memory Boost ───────────────────────────────────────────────────────────
// If we haven't boosted the heap memory yet, re-spawn with 4GB.
if (process.env.SOUPZ_BOOSTED !== 'true' && (!process.env.NODE_OPTIONS || !process.env.NODE_OPTIONS.includes('--max-old-space-size'))) {
    const { spawnSync } = await import('child_process');
    const env = { 
        ...process.env, 
        SOUPZ_BOOSTED: 'true',
        NODE_OPTIONS: (process.env.NODE_OPTIONS || '') + ' --max-old-space-size=4096' 
    };
    const res = spawnSync(process.argv[0], process.argv.slice(1), { env, stdio: 'inherit' });
    process.exit(res.status ?? 0);
}

import '../src/env.js';

import chalk from 'chalk';
import { ensureDirectories } from '../src/config.js';
import { autoImport } from '../src/auto-import.js';

const VERSION = '0.2.0-alpha';
const WEBAPP_URL = process.env.SOUPZ_APP_URL || 'https://soupz.vercel.app';


// Auto-import agents on startup (silent)
autoImport();

import meow from 'meow';

const cli = meow(`
    Usage
      $ soupz-stall [command] [options]

    Commands
      agents      List all installed kitchens (agents)
      auth        Authenticate with Supabase
      sync        Synchronize database schemas
      ask         Send a single prompt to the default agent

    Options
      --cloud, -c                   Start a Pinggy tunnel for internet access
      --port, -p <port>             Override the default local daemon port (7533)
      --yolo                        Skip interactive confirmations (dangerously skip permissions)
      --dangerously-skip-permissions Alias for --yolo
      --no-open                     Prevent the browser from opening automatically
      --version, -v                 Print the version
      --help, -h                    Show this help menu
`, {
    importMeta: import.meta,
    flags: {
        cloud: { type: 'boolean', shortFlag: 'c' },
        port: { type: 'string', shortFlag: 'p' },
        yolo: { type: 'boolean' },
        dangerouslySkipPermissions: { type: 'boolean' },
        open: { type: 'boolean', default: true }
    }
});

import fs from 'fs';
import path from 'path';

const commandArgs = [];
for (const arg of cli.input) {
    if (arg.includes('=')) {
        const [key, ...valParts] = arg.split('=');
        const val = valParts.join('=');
        process.env[key] = val;
        
        // Persist to .env
        const envPath = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../.env');
        let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
        const regex = new RegExp(`^${key}=.*$`, 'm');
        if (regex.test(envContent)) {
            envContent = envContent.replace(regex, `${key}=${val}`);
        } else {
            envContent += `\n${key}=${val}\n`;
        }
        fs.writeFileSync(envPath, envContent.replace(/\n{3,}/g, '\n\n').trim() + '\n');
        console.log(chalk.green(`  ✔ Saved config: ${key}=${val}`));
    } else {
        commandArgs.push(arg);
    }
}

const command = commandArgs[0];
const args = commandArgs.slice(1);
const options = cli.flags;

if (command === 'version' || options.version) {
    console.log(`soupz v${VERSION}`);
    process.exit(0);
}

if (options.yolo || options.dangerouslySkipPermissions) {
    process.env.SOUPZ_YOLO = '1';
}

const DAEMON_PORT = parseInt(options.port || process.env.SOUPZ_REMOTE_PORT || '7533', 10);

if (command === 'agents') {
    await listAgents();
    process.exit(0);
}

if (command === 'auth') {
    await handleAuth(args);
    process.exit(0);
}

if (command === 'supabase' || command === 'sync') {
    await handleSupabase(args);
    process.exit(0);
}

if (command === 'ask') {
    await handleAsk(args);
    process.exit(0);
}

// Default: start the local daemon
await startDaemon(options);

// ─── Daemon ───────────────────────────────────────────────────────────────────

async function startDaemon(options) {
    ensureDirectories();

    const header = chalk.hex('#6C63FF').bold('Soupz Daemon') + chalk.dim(` v${VERSION}`);
    console.log(`\n  ${header}\n`);

    
    let pinggyTunnelProc;
    if (options.cloud) {
        console.log(chalk.dim('  🌍 Starting Pinggy tunnel...'));
        const { spawn } = await import('child_process');
        pinggyTunnelProc = spawn('ssh', [
            '-p', '443',
            `-R0:localhost:${DAEMON_PORT}`,
            '-o', 'StrictHostKeyChecking=no',
            '-o', 'ServerAliveInterval=30',
            'a.pinggy.io'
        ], {
            stdio: ['ignore', 'pipe', 'pipe']
        });
        
        await new Promise((resolve) => {
            const onData = (buf) => {
                const text = buf.toString();
                const match = text.match(/https:\/\/[a-z0-9-.]+\.pinggy-free\.link/i);
                if (match) {
                    process.env.SOUPZ_TUNNEL_URL = match[0];
                    pinggyTunnelProc.stdout.off('data', onData);
                    pinggyTunnelProc.stderr.off('data', onData);
                    resolve();
                }
            };
            pinggyTunnelProc.stdout.on('data', onData);
            pinggyTunnelProc.stderr.on('data', onData);
        });
    }

    let startRemoteServer;
    try {
        ({ startRemoteServer } = await import('../packages/remote-server/src/index.js'));
    } catch (err) {
        console.error(chalk.red(`  ✖ Failed to load daemon: ${err.message}`));
        console.error(chalk.dim('  Run: npm install (in the soupz-agents directory)'));
        process.exit(1);
    }

    const serverInfo = await startRemoteServer(DAEMON_PORT, { silent: true, webapp: WEBAPP_URL });

    if (!serverInfo) {
        // Port already in use — daemon already running
        console.log(chalk.yellow(`  ⚡ Web daemon is already running in the background (port ${DAEMON_PORT})`));
        console.log(chalk.dim(`  Open ${WEBAPP_URL} to connect remotely.\n`));
        // Do NOT exit here! We still want to launch the interactive REPL.
    } else {
        const QRCode = (await import('qrcode')).default;

        async function printPairingBlock(pairing) {
            const connectUrl = pairing.connectUrl || `${WEBAPP_URL}/code?code=${pairing.code}`;
            const tunnelUrl = process.env.SOUPZ_TUNNEL_URL || process.env.SOUPZ_TUNNEL_URLS || '';

            // Generate ASCII QR code for terminal
            let qrAscii = '';
            try {
                qrAscii = await QRCode.toString(connectUrl, { type: 'terminal', small: true, errorCorrectionLevel: 'L' });
            } catch { /* QR generation failed, skip */ }

            console.log(`  ${chalk.bold('Status:')}   ${chalk.green('● Online')}  ${chalk.dim(`localhost:${DAEMON_PORT}`)}`);
            console.log(`  ${chalk.bold('Code:')}     ${chalk.hex('#F59E0B').bold(pairing.code)}  ${chalk.dim(`(expires in ${pairing.expiresIn}s)`)}`);
            console.log(`  ${chalk.bold('Connect:')}  ${chalk.cyan(connectUrl)}\n`);

            if (qrAscii) {
                console.log(chalk.dim('  Scan with your phone camera:\n'));
                // Indent QR code for visual alignment
                const indented = qrAscii.split('\n').map(line => `    ${line}`).join('\n');
                console.log(indented);
                console.log();
            }

            if (tunnelUrl) {
                console.log(`  ${chalk.bold('Tunnel:')}   ${chalk.cyan(tunnelUrl)}`);
                console.log(chalk.dim('  Phone can connect over internet using this tunnel target.\n'));
            }

            const shouldAnimateCountdown =
                process.stdout.isTTY
                && process.env.TERM !== 'dumb'
                && process.env.SOUPZ_SHOW_CODE_TIMER === '1';

            if (!shouldAnimateCountdown) {
                console.log(chalk.dim(`  Code expires in ${pairing.expiresIn}s.`));
                return null;
            }

            // Print the initial code valid state, but do not animate via setInterval 
            // as it overwrites the REPL prompt at the bottom of the terminal.
            const expiresAt = Date.now() + pairing.expiresIn * 1000;
            const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
            const mins = Math.floor(remaining / 60);
            const secs = remaining % 60;
            const timeStr = `${mins}:${String(secs).padStart(2, '0')}`;
            const bar = '█'.repeat(Math.ceil(remaining / 10)) + chalk.dim('░'.repeat(Math.max(0, 30 - Math.ceil(remaining / 10))));
            console.log(`  ${chalk.dim('Code valid:')} ${bar} ${chalk.hex('#F59E0B')(timeStr)}`);
            
            return null;
        }

        const pairing = serverInfo.getCode();
        let activeCountdown = await printPairingBlock(pairing);

        console.log(chalk.dim('\n  Opening browser...'));
        console.log(chalk.dim('  Press Ctrl+C to stop.\n'));

        // Open browser to the connect page
        const connectUrl = pairing.connectUrl || `${WEBAPP_URL}/code?code=${pairing.code}`;
        const autoConnectUrl = connectUrl.includes('?') ? `${connectUrl}&auto=1` : `${connectUrl}?auto=1`;
        const { exec } = await import('child_process');
        if (options.open) {
            if (process.platform === 'darwin') exec(`open "${autoConnectUrl}"`);
            else if (process.platform === 'linux') exec(`xdg-open "${autoConnectUrl}"`);
            else if (process.platform === 'win32') exec(`start "${autoConnectUrl}"`);
        }

        // Handle refresh — show updated code with new QR
        serverInfo.onCodeRefresh?.(async (newPairing) => {
            if (activeCountdown) clearInterval(activeCountdown);
            console.log(chalk.dim('\n\n  --- Code refreshed ---\n'));
            activeCountdown = await printPairingBlock(newPairing);
        });

        // Re-bind SIGINT/SIGTERM to kill the spawner along with the daemon
        process.removeAllListeners('SIGINT');
        process.removeAllListeners('SIGTERM');

        process.on('SIGINT', () => {
            if (activeCountdown) clearInterval(activeCountdown);
            console.log(chalk.dim('\n  Stopping daemon...'));
            serverInfo.stop();
            if (typeof spawner !== 'undefined' && spawner.killAll) spawner.killAll();
            if (typeof contextManager !== 'undefined' && contextManager.save) contextManager.save();
            process.exit(0);
        });

        process.on('SIGTERM', () => {
            if (activeCountdown) clearInterval(activeCountdown);
            serverInfo.stop();
            if (typeof spawner !== 'undefined' && spawner.killAll) spawner.killAll();
            if (typeof contextManager !== 'undefined' && contextManager.save) contextManager.save();
            process.exit(0);
        });
    }

    // ── Interactive Session (Restored) ──────────────────────────────────────
    const { AgentRegistry } = await import('../src/agents/registry.js');
    const { AgentSpawner } = await import('../src/agents/spawner.js');
    const { Orchestrator } = await import('../src/orchestrator/router.js');
    const { ContextManager } = await import('../src/context/manager.js');
    const { MemoryStore } = await import('../src/memory/store.js');
    const { GradingSystem } = await import('../src/grading/scorer.js');
    const { AuthManager } = await import('../src/auth/manager.js');
    const { UserAuth } = await import('../src/auth/user-auth.js');
    const { Session } = await import('../src/session.js');
    const { TokenCompressor } = await import('../src/core/token-compressor.js');
    const { StallMonitor } = await import('../src/core/stall-monitor.js');
    const { MCPClient } = await import('../src/mcp/client.js');
    const { MemoryPool } = await import('../src/memory/pool.js');

    const registry = new AgentRegistry();
    await registry.init();
    const spawner = new AgentSpawner(registry);
    const mcpClient = new MCPClient();
    const compressor = new TokenCompressor();
    const kitchenMonitor = new StallMonitor();
    const memory = new MemoryStore();
    const memoryPool = new MemoryPool();
    const auth = new AuthManager(registry);
    const userAuth = new UserAuth();
    const grading = new GradingSystem();
    const contextManager = new ContextManager();
    const orchestrator = new Orchestrator(registry, spawner, contextManager, memory, mcpClient);
    const cwd = process.cwd();

    const session = new Session({ 
        registry, 
        spawner, 
        orchestrator, 
        contextManager, 
        memory, 
        grading, 
        auth, 
        userAuth, 
        cwd, 
        compressor, 
        kitchenMonitor, 
        mcpClient, 
        memoryPool 
    });
    if (options.yolo || options.dangerouslySkipPermissions) session.yolo = true;
    
    // Give a visual separation before the REPL starts
    console.log(chalk.dim('  ──────────────────────────────────────────'));
    await session.init();
}

// ─── Utility Commands ─────────────────────────────────────────────────────────

async function handleAsk([agentId, promptStr, ...restArgs]) {
    const { AgentRegistry } = await import('../src/agents/registry.js');
    const { AgentSpawner } = await import('../src/agents/spawner.js');
    
    const registry = new AgentRegistry();
    await registry.init();

    const spawner = new AgentSpawner(registry);

    let forcedModel = null;
    const promptTokens = [];
    for (let i = 0; i < restArgs.length; i++) {
        const token = restArgs[i];
        if (token === '--model' && restArgs[i + 1]) {
            forcedModel = String(restArgs[i + 1] || '').trim() || null;
            i += 1;
            continue;
        }
        promptTokens.push(token);
    }

    const fullPrompt = [promptStr, ...promptTokens].join(' ');

    // The remote-server reads stdout/stderr directly
    spawner.on('output', (id, data) => {
        if (data.type === 'stderr') process.stderr.write(data.text + '\n');
        else process.stdout.write(data.text + '\n');
    });

    try {
        await spawner.run(agentId, fullPrompt, process.cwd(), { model: forcedModel });
    } catch (e) {
        process.stderr.write(`\n✖ Agent error: ${e.message}\n`);
        process.exit(1);
    }
}

async function listAgents() {
    const { AgentRegistry } = await import('../src/agents/registry.js');
    const registry = new AgentRegistry();
    await registry.init();

    const cliBased = registry.list().filter((a) => a.type !== 'persona' && a.type !== 'agent');
    const specialists = registry.list().filter((a) => a.type === 'persona' || a.type === 'agent');

    console.log(chalk.bold('\n  CLI Agents  ') + chalk.dim('(real executables)\n'));
    for (const a of cliBased) {
        const dot = a.available ? chalk.green('●') : chalk.red('○');
        const via = a.binaryPath ? chalk.dim(a.binaryPath) : chalk.dim('not installed');
        console.log(`  ${dot} ${a.icon}  ${chalk.bold(a.id.padEnd(14))} ${via}`);
    }

    console.log(chalk.bold('\n  Specialist Agents  ') + chalk.dim('(expert modes — run through any available CLI)\n'));
    const cols = Math.floor(specialists.length / 3) + 1;
    for (let i = 0; i < specialists.length; i += 3) {
        const row = specialists.slice(i, i + 3);
        console.log('  ' + row.map((a) => `${a.icon} ${chalk.bold(`@${a.id}`).padEnd(22)}`).join(''));
    }
    console.log(chalk.dim(`\n  Total: ${cliBased.length} CLI + ${specialists.length} specialists\n`));
}

async function handleAuth([subCmd, agentId]) {
    const { AgentRegistry } = await import('../src/agents/registry.js');
    const { AuthManager } = await import('../src/auth/manager.js');
    const registry = new AgentRegistry();
    await registry.init();
    const auth = new AuthManager(registry);

    if (!subCmd || subCmd === 'status') {
        console.log(chalk.bold('\n  Auth Status:\n'));
        for (const a of registry.list()) {
            if (!a.auth_command) continue;
            const ok = await auth.checkAuth(a.id);
            const status = ok ? chalk.green('✔ logged in') : chalk.red('✖ not logged in');
            console.log(`  ${a.icon}  ${chalk.bold(a.name.padEnd(16))} ${status}`);
        }
        console.log();
    } else if (subCmd === 'login' && agentId) {
        try {
            await auth.login(agentId);
            console.log(chalk.green(`  ✔ Logged in to ${agentId}`));
        } catch (e) {
            console.error(chalk.red(`  ✖ ${e.message}`));
            process.exit(1);
        }
    } else if (subCmd === 'logout' && agentId) {
        try {
            await auth.logout(agentId);
            console.log(chalk.green(`  ✔ Logged out of ${agentId}`));
        } catch (e) {
            console.error(chalk.red(`  ✖ ${e.message}`));
            process.exit(1);
        }
    } else {
        console.log('  Usage: soupz auth [status|login|logout] [agent-id]');
        console.log('  Example: soupz auth login gemini\n');
    }
}

async function handleSupabase([subCmd]) {
    const { execSync } = await import('child_process');
    const fs = await import('fs');
    const path = await import('path');

    console.log(chalk.bold('\n  Supabase Integration  ') + chalk.dim('(automated setup)\n'));

    // 1. Check if supabase CLI is installed
    try {
        execSync('supabase --version', { stdio: 'ignore' });
    } catch {
        console.error(chalk.red('  ✖ Supabase CLI not found.'));
        console.log(chalk.dim('  Run: brew install supabase/tap/supabase or npm install -g supabase\n'));
        process.exit(1);
    }

    // 2. Initialize project if needed
    if (!fs.existsSync('supabase/config.toml')) {
        console.log(chalk.dim('  Initializing Supabase project...'));
        try {
            execSync('supabase init', { stdio: 'inherit' });
        } catch (err) {
            console.error(chalk.red(`  ✖ Failed to init Supabase: ${err.message}`));
            process.exit(1);
        }
    }

    // 3. Link project if needed
    const url = process.env.SUPABASE_URL || process.env.SOUPZ_SUPABASE_URL;
    if (url) {
        const projectRef = url.split('//')[1]?.split('.')[0];
        if (projectRef && projectRef !== 'localhost') {
            console.log(chalk.dim(`  Project detected: ${chalk.bold(projectRef)}`));
            
            // Try to link (will prompt for password if not linked)
            try {
                console.log(chalk.dim('  Linking to Supabase cloud...'));
                execSync(`supabase link --project-ref ${projectRef}`, { stdio: 'inherit' });
            } catch {
                console.log(chalk.yellow('\n  ⚠️  Link failed or was cancelled.'));
                console.log(chalk.dim('  If you haven\'t linked your project, run: ') + chalk.bold(`supabase link --project-ref ${projectRef}`));
                console.log(chalk.dim('  Then run: ') + chalk.bold('soupz sync\n'));
                process.exit(1);
            }
        }
    }

    // 4. Push migrations
    console.log(chalk.dim('  Pushing migrations to Supabase...'));
    try {
        execSync('supabase db push', { stdio: 'inherit' });
        console.log(chalk.green('\n  ✔ Database schema is in sync with Supabase!\n'));
    } catch (err) {
        console.error(chalk.red(`\n  ✖ Failed to push migrations: ${err.message}`));
        process.exit(1);
    }
}
