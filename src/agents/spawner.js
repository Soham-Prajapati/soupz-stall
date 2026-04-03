import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { getParser } from './parsers.js';

export class AgentSpawner extends EventEmitter {
    constructor(registry) {
        super();
        this.registry = registry;
        this.processes = new Map();
    }

    run(agentId, prompt, cwd, options = {}) {
        const agent = this.registry.get(agentId);
        if (!agent) throw new Error(`Unknown agent: ${agentId}`);
        if (!agent.available) throw new Error(`Agent "${agent.name}" not installed`);
        if (!agent.headless) throw new Error(`Agent "${agent.name}" is monitor-only`);

        return new Promise((resolve, reject) => {
            // Build args from agent definition, replacing {prompt} placeholder
            const args = (agent.build_args || []).map((a) => a === '{prompt}' ? prompt : a);
            const forcedModel = String(options?.model || '').trim();
            if (forcedModel) {
                // Apply model overrides only for CLIs with known model switch semantics.
                if (agentId === 'gemini' || agentId === 'copilot' || agentId === 'codex') {
                    const idx = args.indexOf('--model');
                    if (idx >= 0) {
                        if (idx === args.length - 1) args.push(forcedModel);
                        else args[idx + 1] = forcedModel;
                    } else {
                        args.push('--model', forcedModel);
                    }
                }
            }
            const parser = getParser(agentId);
            const binary = agent.binaryPath || agent.binary;

            this.registry.updateState(agentId, {
                state: 'running',
                currentTask: prompt.length > 80 ? prompt.slice(0, 77) + '…' : prompt,
                startTime: Date.now(),
                lastOutput: '',
                error: null,
            });
            this.emit('status-change', agentId, 'running');

            const proc = spawn(binary, args, {
                cwd: cwd || process.cwd(),
                env: { ...process.env },
                stdio: ['ignore', 'pipe', 'pipe'],
            });

            this.processes.set(agentId, proc);
            this.registry.updateState(agentId, { pid: proc.pid });

            let fullOutput = '';
            let lineBuffer = '';

            const processLine = (line) => {
                const parsed = parser(line);
                if (parsed) {
                    fullOutput += parsed.text + '\n';
                    const snippet = parsed.text.length > 120 ? parsed.text.slice(0, 117) + '…' : parsed.text;
                    this.registry.updateState(agentId, { state: 'streaming', lastOutput: snippet });
                    this.emit('output', agentId, parsed);
                }
            };

            proc.stdout.on('data', (chunk) => {
                lineBuffer += chunk.toString();
                const lines = lineBuffer.split('\n');
                lineBuffer = lines.pop() || '';
                lines.forEach(processLine);
            });

            proc.stderr.on('data', (chunk) => {
                const t = chunk.toString().trim();
                if (t) this.emit('output', agentId, { type: 'stderr', text: t });
            });

            proc.on('close', (code) => {
                if (lineBuffer.trim()) processLine(lineBuffer);
                this.processes.delete(agentId);
                if (code === 0) {
                    this.registry.updateState(agentId, { state: 'done', pid: null });
                    this.emit('status-change', agentId, 'done');
                    this.emit('done', agentId, fullOutput);
                    resolve(fullOutput);
                } else {
                    const err = `Exited with code ${code}`;
                    this.registry.updateState(agentId, { state: 'error', error: err, pid: null });
                    this.emit('status-change', agentId, 'error');
                    this.emit('error-event', agentId, err);
                    reject(new Error(err));
                }
            });

            proc.on('error', (err) => {
                this.processes.delete(agentId);
                this.registry.updateState(agentId, { state: 'error', error: err.message, pid: null });
                this.emit('status-change', agentId, 'error');
                reject(err);
            });
        });
    }

    kill(agentId) {
        const proc = this.processes.get(agentId);
        if (proc) {
            proc.kill('SIGTERM');
        }
    }

    killAll() {
        for (const [id] of this.processes) this.kill(id);
    }

    isRunning(agentId) {
        return this.processes.has(agentId);
    }
}
