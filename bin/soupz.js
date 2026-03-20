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
