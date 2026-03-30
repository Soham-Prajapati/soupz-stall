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

const VERSION = '0.1.0-alpha';
const WEBAPP_URL = process.env.SOUPZ_APP_URL || 'https://soupz.vercel.app';
const DAEMON_PORT = parseInt(process.env.SOUPZ_REMOTE_PORT || '7533', 10);

// Auto-import agents on startup (silent)
autoImport();

const [,, command, ...args] = process.argv;

if (command === '--version' || command === '-v' || command === 'version') {
    console.log(`soupz v${VERSION}`);
    process.exit(0);
}

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
await startDaemon();

// ─── Daemon ───────────────────────────────────────────────────────────────────

async function startDaemon() {
    ensureDirectories();

    const header = chalk.hex('#6C63FF').bold('Soupz Cockpit') + chalk.dim(` v${VERSION}`);
    console.log(`\n  ${header}\n`);

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
        console.log(chalk.yellow(`  ⚡ Daemon already running on port ${DAEMON_PORT}`));
        console.log(chalk.dim(`  Open ${WEBAPP_URL} to continue.\n`));
        process.exit(0);
    }

    const QRCode = (await import('qrcode')).default;

    async function printPairingBlock(pairing) {
        const connectUrl = pairing.connectUrl || `${WEBAPP_URL}/connect?code=${pairing.code}`;
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

        // Live countdown
        const expiresAt = Date.now() + pairing.expiresIn * 1000;
        const countdownInterval = setInterval(() => {
            const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
            if (remaining <= 0) {
                clearInterval(countdownInterval);
                return;
            }
            const mins = Math.floor(remaining / 60);
            const secs = remaining % 60;
            const timeStr = `${mins}:${String(secs).padStart(2, '0')}`;
            const bar = '█'.repeat(Math.ceil(remaining / 10)) + chalk.dim('░'.repeat(Math.max(0, 30 - Math.ceil(remaining / 10))));
            process.stdout.write(`\r  ${chalk.dim('Code valid:')} ${bar} ${chalk.hex('#F59E0B')(timeStr)} `);
        }, 1000);

        return countdownInterval;
    }

    const pairing = serverInfo.getCode();
    let activeCountdown = await printPairingBlock(pairing);

    console.log(chalk.dim('\n  Opening browser...'));
    console.log(chalk.dim('  Press Ctrl+C to stop.\n'));

    // Open browser to the connect page
        const connectUrl = pairing.connectUrl || `${WEBAPP_URL}/connect?code=${pairing.code}`;
    const { exec } = await import('child_process');
    if (process.platform === 'darwin') exec(`open "${connectUrl}"`);
    else if (process.platform === 'linux') exec(`xdg-open "${connectUrl}"`);
    else if (process.platform === 'win32') exec(`start "${connectUrl}"`);

    // Handle refresh — show updated code with new QR
    serverInfo.onCodeRefresh?.(async (newPairing) => {
        if (activeCountdown) clearInterval(activeCountdown);
        console.log(chalk.dim('\n\n  --- Code refreshed ---\n'));
        activeCountdown = await printPairingBlock(newPairing);
    });

    process.on('SIGINT', () => {
        if (activeCountdown) clearInterval(activeCountdown);
        console.log(chalk.dim('\n  Stopping daemon...'));
        serverInfo.stop();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        if (activeCountdown) clearInterval(activeCountdown);
        serverInfo.stop();
        process.exit(0);
    });
}

// ─── Utility Commands ─────────────────────────────────────────────────────────

async function handleAsk([agentId, promptStr, ...restArgs]) {
    const { AgentRegistry } = await import('../src/agents/registry.js');
    const { AgentSpawner } = await import('../src/agents/spawner.js');
    
    const registry = new AgentRegistry();
    await registry.init();

    const spawner = new AgentSpawner(registry);
    const fullPrompt = [promptStr, ...restArgs].join(' ');

    // The remote-server reads stdout/stderr directly
    spawner.on('output', (id, data) => {
        if (data.type === 'stderr') process.stderr.write(data.text + '\n');
        else process.stdout.write(data.text + '\n');
    });

    try {
        await spawner.run(agentId, fullPrompt, process.cwd());
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
