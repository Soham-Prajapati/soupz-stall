import { loadAllAgents, AGENTS_DIR } from '../config.js';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

export class AgentRegistry {
    constructor() {
        this.agents = new Map();
    }

    async init() {
        const defs = loadAllAgents();
        for (const agent of defs) {
            this.agents.set(agent.id, agent);
        }
        return this;
    }

    get(id) { return this.agents.get(id); }
    list() { return Array.from(this.agents.values()); }
    available() { return this.list().filter((a) => a.available); }
    headless() { return this.available().filter((a) => a.headless); }
    // Support both 'agent' (new term) and 'persona' (legacy) — same thing: wrapper agents
    personas() { return this.list().filter((a) => a.type === 'persona' || a.type === 'agent'); }
    agents() { return this.personas(); } // alias with the correct industry term

    updateState(id, patch) {
        const agent = this.agents.get(id);
        if (agent) Object.assign(agent, patch);
    }

    /** Persist grade/usage changes back to the .md file */
    persistAgent(id) {
        const agent = this.agents.get(id);
        if (!agent || !agent.filePath) return;
        const raw = readFileSync(agent.filePath, 'utf8');
        const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
        if (!fmMatch) return;
        const meta = parseYaml(fmMatch[1]);
        meta.grade = agent.grade;
        meta.usage_count = agent.usage_count;
        const newContent = `---\n${stringifyYaml(meta).trim()}\n---\n${fmMatch[2]}`;
        writeFileSync(agent.filePath, newContent, 'utf8');
    }

    summary() {
        const all = this.list();
        const active = all.filter((a) => a.state === 'running' || a.state === 'streaming');
        return { total: all.length, available: this.available().length, active: active.length };
    }
}
