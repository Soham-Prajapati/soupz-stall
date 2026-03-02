import { EventEmitter } from 'events';
import { SemanticRouter } from './semantic-router.js';

export class Orchestrator extends EventEmitter {
    constructor(registry, spawner, contextManager, memory) {
        super();
        this.registry = registry;
        this.spawner = spawner;
        this.context = contextManager;
        this.memory = memory;
        this.taskLog = [];
        this.semanticRouter = new SemanticRouter(registry, contextManager, memory);
        this.activeChain = null; // Track agent chains
    }

    /** Smart route with semantic understanding */
    route(prompt, options = {}) {
        return this.semanticRouter.route(prompt, options);
    }

    async routeAndRun(prompt, cwd) {
        const routing = this.route(prompt);
        if (!routing) throw new Error('No headless agents available');

        this.emit('route', { 
            prompt, 
            agent: routing.agent, 
            reason: routing.reason,
            confidence: routing.confidence,
            alternatives: routing.alternatives 
        });

        // Track in context with metadata
        this.context?.addMessage('user', prompt, { timestamp: Date.now() });
        this.context?.addMessage('system', `Routed to ${routing.agent}: ${routing.reason}`, { 
            confidence: routing.confidence,
            alternatives: routing.alternatives 
        });

        const entry = { 
            id: Date.now(), 
            prompt, 
            agent: routing.agent, 
            reason: routing.reason, 
            confidence: routing.confidence,
            status: 'running', 
            startTime: Date.now(), 
            result: null 
        };
        this.taskLog.push(entry);
        this.emit('task-start', entry);

        try {
            const result = await this.spawner.run(routing.agent, prompt, cwd);
            entry.status = 'done';
            entry.result = result;
            entry.endTime = Date.now();
            entry.duration = entry.endTime - entry.startTime;
            
            // Update agent grade with quality scoring
            const agent = this.registry.get(routing.agent);
            if (agent) {
                agent.usage_count = (agent.usage_count || 0) + 1;
                // Better grading: consider task complexity and result quality
                const qualityBonus = this._assessQuality(result, prompt);
                agent.grade = Math.min(100, (agent.grade || 50) + qualityBonus);
                this.registry.persistAgent(routing.agent);
            }
            
            this.context?.addMessage(routing.agent, result.slice(0, 2000), { 
                duration: entry.duration,
                success: true 
            });
            this.memory?.recordSuccess(routing.agent, prompt, { quality: qualityBonus });
            this.emit('task-done', entry);
            return result;
        } catch (err) {
            entry.status = 'error';
            entry.result = err.message;
            entry.endTime = Date.now();
            
            // Smarter downgrade: don't penalize too much for external errors
            const agent = this.registry.get(routing.agent);
            if (agent) {
                const penalty = this._assessErrorSeverity(err);
                agent.grade = Math.max(0, (agent.grade || 50) - penalty);
                this.registry.persistAgent(routing.agent);
            }
            
            this.memory?.recordError(routing.agent, prompt, { error: err.message });
            this.emit('task-error', entry);
            throw err;
        }
    }

    _assessQuality(result, prompt) {
        // Simple heuristic: longer, structured responses = better quality
        const length = result.length;
        if (length < 100) return 0.5;
        if (length < 500) return 1;
        if (length < 2000) return 2;
        return 3;
    }

    _assessErrorSeverity(err) {
        const msg = err.message.toLowerCase();
        // Network/auth errors = not agent's fault
        if (msg.includes('network') || msg.includes('auth') || msg.includes('timeout')) return 1;
        // Agent logic errors = more severe
        return 3;
    }

    async runOn(agentId, prompt, cwd, options = {}) {
        this.context?.addMessage('user', prompt, { timestamp: Date.now() });
        this.context?.addMessage('system', `Direct → ${agentId}`);

        // Check if this is part of a chain
        if (options.chainFrom) {
            this.activeChain = { from: options.chainFrom, to: agentId, context: options.chainContext };
            this.emit('chain-start', this.activeChain);
        }

        const entry = { 
            id: Date.now(), 
            prompt, 
            agent: agentId, 
            reason: options.chainFrom ? `Chained from ${options.chainFrom}` : 'Direct', 
            status: 'running', 
            startTime: Date.now(), 
            result: null,
            chainFrom: options.chainFrom 
        };
        this.taskLog.push(entry);
        this.emit('task-start', entry);

        try {
            const result = await this.spawner.run(agentId, prompt, cwd);
            entry.status = 'done';
            entry.result = result;
            entry.endTime = Date.now();
            entry.duration = entry.endTime - entry.startTime;
            
            const agent = this.registry.get(agentId);
            if (agent) { 
                agent.usage_count = (agent.usage_count || 0) + 1; 
                this.registry.persistAgent(agentId); 
            }
            
            this.context?.addMessage(agentId, result.slice(0, 2000), { 
                duration: entry.duration,
                chainFrom: options.chainFrom 
            });
            this.emit('task-done', entry);
            
            if (this.activeChain) {
                this.emit('chain-complete', { ...this.activeChain, result });
                this.activeChain = null;
            }
            
            return result;
        } catch (err) {
            entry.status = 'error';
            entry.result = err.message;
            entry.endTime = Date.now();
            this.emit('task-error', entry);
            
            if (this.activeChain) {
                this.emit('chain-error', { ...this.activeChain, error: err.message });
                this.activeChain = null;
            }
            
            throw err;
        }
    }

    /** Chain multiple agents together with context passing */
    async chain(steps, cwd) {
        const results = [];
        let context = {};
        
        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            const agentId = step.agent;
            const prompt = typeof step.prompt === 'function' 
                ? step.prompt(context, results) 
                : step.prompt;
            
            const chainFrom = i > 0 ? steps[i - 1].agent : null;
            const result = await this.runOn(agentId, prompt, cwd, { 
                chainFrom, 
                chainContext: context 
            });
            
            results.push({ agent: agentId, result });
            context[agentId] = result;
        }
        
        return results;
    }

    async fanOut(prompt, cwd) {
        const agents = this.registry.headless();
        this.emit('fan-out', { prompt, agents: agents.map((a) => a.id) });
        const results = await Promise.allSettled(agents.map((a) => this.spawner.run(a.id, prompt, cwd)));
        return agents.map((a, i) => ({
            agent: a.id, name: a.name, status: results[i].status,
            result: results[i].status === 'fulfilled' ? results[i].value : results[i].reason?.message,
        }));
    }
}
