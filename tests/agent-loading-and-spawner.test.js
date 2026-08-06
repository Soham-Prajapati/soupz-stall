import { EventEmitter } from 'node:events';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULTS_DIR, loadAgentDefinition } from '../src/config.js';
import { AgentSpawner } from '../src/agents/spawner.js';
import { RECIPES, RECIPE_CHAINS } from '../src/session/recipes.js';

const AUTHORING_FILES = new Set(['SKILL_ANALYSIS.md', 'SKILL_TEMPLATE.md']);

describe('shipped agent definitions', () => {
    it('loads every runnable markdown definition with a unique id', () => {
        const files = readdirSync(DEFAULTS_DIR)
            .filter((file) => file.endsWith('.md') && !AUTHORING_FILES.has(file) && file !== 'ollama.md');
        const agents = files.map((file) => loadAgentDefinition(join(DEFAULTS_DIR, file)));

        expect(agents.every(Boolean)).toBe(true);
        expect(agents.every((agent) => typeof agent.id === 'string' && agent.id.length > 0)).toBe(true);
        expect(new Set(agents.map((agent) => agent.id)).size).toBe(agents.length);
    });

    it('resolves every agent id in every recipe chain', () => {
        const files = readdirSync(DEFAULTS_DIR)
            .filter((file) => file.endsWith('.md') && !AUTHORING_FILES.has(file) && file !== 'ollama.md');
        const agentIds = new Set(files.map((file) => loadAgentDefinition(join(DEFAULTS_DIR, file))?.id));

        expect(Object.keys(RECIPE_CHAINS)).toEqual(RECIPES.map(({ id }) => id));
        for (const [recipeId, chain] of Object.entries(RECIPE_CHAINS)) {
            for (const agentId of chain.split('→')) {
                expect(agentIds.has(agentId), `${recipeId} references missing agent ${agentId}`).toBe(true);
            }
        }
    });
});

function fakeProcess() {
    const proc = new EventEmitter();
    proc.pid = 1234;
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.kill = vi.fn();
    return proc;
}

describe('agent spawner terminal transitions', () => {
    it('finalizes once when error is followed by close', async () => {
        const proc = fakeProcess();
        const states = [];
        const agent = {
            id: 'codex', name: 'Codex', available: true, headless: true,
            binary: 'codex', build_args: ['exec', '{prompt}'],
        };
        const registry = {
            get: () => agent,
            updateState: (_id, patch) => states.push(patch.state),
        };
        const spawner = new AgentSpawner(registry, { spawnProcess: () => proc });
        const terminalStates = [];
        spawner.on('status-change', (_id, state) => terminalStates.push(state));

        const run = spawner.run('codex', 'check transitions', process.cwd());
        proc.emit('error', new Error('spawn failed'));
        proc.emit('close', 1);

        await expect(run).rejects.toThrow('spawn failed');
        expect(terminalStates).toEqual(['running', 'error']);
        expect(states.filter((state) => state === 'error')).toHaveLength(1);
    });
});
