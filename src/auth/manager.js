import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import { AUTH_DIR } from '../config.js';

const STATE_FILE = join(AUTH_DIR, 'state.json');

function loadState() {
    if (existsSync(STATE_FILE)) {
        try { return JSON.parse(readFileSync(STATE_FILE, 'utf8')); } catch { return {}; }
    }
    return {};
}

function saveState(state) {
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

export class AuthManager {
    constructor(registry) {
        this.registry = registry;
        this.state = loadState();
    }

    getStatus(agentId) {
        return this.state[agentId] || { loggedIn: false, account: null, lastLogin: null };
    }

    allStatus() {
        const result = {};
        for (const agent of this.registry.list()) {
            result[agent.id] = this.getStatus(agent.id);
        }
        return result;
    }

    /** Run the agent's auth command interactively */
    login(agentId) {
        const agent = this.registry.get(agentId);
        if (!agent) throw new Error(`Unknown agent: ${agentId}`);
        if (!agent.auth_command) throw new Error(`Agent "${agent.name}" has no auth command`);

        return new Promise((resolve, reject) => {
            const [cmd, ...args] = agent.auth_command.split(' ');
            const proc = spawn(cmd, args, {
                stdio: 'inherit', // Interactive — user sees prompts
                env: { ...process.env },
            });
            proc.on('close', (code) => {
                if (code === 0) {
                    this.state[agentId] = { loggedIn: true, account: 'default', lastLogin: new Date().toISOString() };
                    saveState(this.state);
                    resolve(true);
                } else {
                    reject(new Error(`Auth failed for ${agent.name} (exit code ${code})`));
                }
            });
            proc.on('error', reject);
        });
    }

    /** Run the agent's logout command */
    logout(agentId) {
        const agent = this.registry.get(agentId);
        if (!agent) throw new Error(`Unknown agent: ${agentId}`);
        if (!agent.logout_command) throw new Error(`Agent "${agent.name}" has no logout command`);

        return new Promise((resolve, reject) => {
            const [cmd, ...args] = agent.logout_command.split(' ');
            const proc = spawn(cmd, args, { stdio: 'inherit', env: { ...process.env } });
            proc.on('close', (code) => {
                this.state[agentId] = { loggedIn: false, account: null, lastLogin: null };
                saveState(this.state);
                resolve(code === 0);
            });
            proc.on('error', reject);
        });
    }

    /** Check auth via the agent's status command */
    async checkAuth(agentId) {
        const agent = this.registry.get(agentId);
        if (!agent || !agent.status_command) return false;
        try {
            const { execSync } = await import('child_process');
            execSync(agent.status_command, { stdio: 'pipe' });
            this.state[agentId] = { ...this.state[agentId], loggedIn: true };
            saveState(this.state);
            return true;
        } catch {
            this.state[agentId] = { ...this.state[agentId], loggedIn: false };
            saveState(this.state);
            return false;
        }
    }
}
