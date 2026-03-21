#!/usr/bin/env node

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

// Default: start the local daemon
await startDaemon();

// ─── Daemon ───────────────────────────────────────────────────────────────────

async function startDaemon() {
    ensureDirectories();

    const header = chalk.hex('#6C63FF').bold('🫕  Soupz') + chalk.dim(` v${VERSION}`);
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

    const pairing = serverInfo.getCode();
    const connectUrl = `${WEBAPP_URL}/connect?code=${pairing.code}`;

    console.log(`  ${chalk.bold('Status:')}   ${chalk.green('● Online')}  ${chalk.dim(`localhost:${DAEMON_PORT}`)}`);
    console.log(`  ${chalk.bold('Code:')}     ${chalk.hex('#F59E0B').bold(pairing.code)}  ${chalk.dim(`(expires in ${pairing.expiresIn}s)`)}`);
    console.log(`  ${chalk.bold('Connect:')}  ${chalk.cyan(connectUrl)}\n`);
    console.log(chalk.dim('  Opening browser...'));
    console.log(chalk.dim('  Press Ctrl+C to stop.\n'));

    // Open browser to the connect page
    const { exec } = await import('child_process');
    if (process.platform === 'darwin') exec(`open "${connectUrl}"`);
    else if (process.platform === 'linux') exec(`xdg-open "${connectUrl}"`);
    else if (process.platform === 'win32') exec(`start "${connectUrl}"`);

    // Handle refresh — show updated code
    serverInfo.onCodeRefresh?.((newPairing) => {
        const newUrl = `${WEBAPP_URL}/connect?code=${newPairing.code}`;
        console.log(chalk.dim(`\n  🔑 New code: `) + chalk.hex('#F59E0B').bold(newPairing.code) + chalk.dim(`  ${newUrl}`));
    });

    process.on('SIGINT', () => {
        console.log(chalk.dim('\n  Stopping daemon...'));
        serverInfo.stop();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        serverInfo.stop();
        process.exit(0);
    });
}

// ─── Utility Commands ─────────────────────────────────────────────────────────

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
