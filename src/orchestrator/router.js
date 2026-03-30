import { EventEmitter } from 'events';
import { execFile } from 'child_process';
import { SemanticRouter } from './semantic-router.js';

const COPILOT_FAST_MODEL = process.env.SOUPZ_COPILOT_FAST_MODEL || 'gpt-4.1';
const COPILOT_REASONING_MODEL = process.env.SOUPZ_COPILOT_REASONING_MODEL || 'claude-sonnet-4.5';

export class Orchestrator extends EventEmitter {
    constructor(registry, spawner, contextManager, memory, options = {}) {
        super();
        this.registry = registry;
        this.spawner = spawner;
        this.context = contextManager;
        this.memory = memory;
        this.compressor = options.compressor || null;
        this.preprocessor = options.preprocessor || null;
        this.costTracker = options.costTracker || null;
        this.userAuth = options.userAuth || null;
        this.memoryPool = options.memoryPool || null;
        this.taskLog = [];
        this.semanticRouter = new SemanticRouter(registry, contextManager, memory);
        this.activeChain = null;
    }

    /** Smart route with semantic understanding */
    route(prompt, options = {}) {
        return this.semanticRouter.route(prompt, options);
    }

    /** Async AI-powered route (uses Ollama when available) */
    async routeAI(prompt, options = {}) {
        return this.semanticRouter.routeAI(prompt, options);
    }

    async routeAndRun(prompt, cwd) {
        // Use AI routing (Ollama) when available, fall back to rule-based
        const routing = await this.routeAI(prompt);
        if (!routing) throw new Error('No headless agents available');

        // Pick the best persona (chef) — AI-powered when Ollama is up
        const persona = await this.semanticRouter.routePersonaAI(prompt);

        this.emit('route', { 
            prompt, 
            agent: routing.agent, 
            persona: persona?.agent || null,
            reason: routing.reason,
            confidence: routing.confidence,
            alternatives: routing.alternatives 
        });

        // Track in context with metadata
        this.context?.addMessage('user', prompt, { timestamp: Date.now() });
        this.context?.addMessage('system', 
            `Routed to ${routing.agent}${persona ? ` with chef ${persona.name}` : ''}: ${routing.reason}`, { 
            confidence: routing.confidence,
            alternatives: routing.alternatives 
        });

        const entry = { 
            id: Date.now(), 
            prompt, 
            agent: routing.agent,
            persona: persona?.agent || null,
            reason: routing.reason, 
            confidence: routing.confidence,
            status: 'running', 
            startTime: Date.now(), 
            result: null 
        };
        this.taskLog.push(entry);
        this.emit('task-start', entry);

        // Inject persona system prompt only for non-headless agents.
        // Headless agents (like Copilot CLI) have their own system prompts and tool context —
        // prepending an extra persona prompt wastes tokens without benefit.
        let processed = prompt;
        const targetAgent = this.registry.get(routing.agent);
        if (persona?.systemPrompt && !targetAgent?.headless) {
            processed = `${persona.systemPrompt}\n\nUser: ${processed}`;
        }

        // Auto-recall relevant context from memory pool
        if (this.memoryPool) {
            const recalled = this.memoryPool.recall(prompt, { maxResults: 3 });
            if (recalled.length > 0) {
                const context = recalled.map(r => r.content).join('\n---\n');
                processed = `[Relevant context from previous tasks]\n${context}\n[End context]\n\n${processed}`;
            }
        }

        // Compress prompt before sending
        if (this.preprocessor) {
            processed = await this.preprocessor.compress(processed);
        }
        if (this.compressor) {
            processed = this.compressor.compressPrompt(processed);
            const directive = this.compressor.getOutputDirective(processed);
            if (directive) processed = processed + '\n\n' + directive;
        }

        try {
            let result = await this.spawner.run(routing.agent, processed, cwd);
            if (this.compressor) {
                result = this.compressor.decompressResponse(result);
            }
            entry.status = 'done';
            entry.result = result;
            entry.endTime = Date.now();
            entry.duration = entry.endTime - entry.startTime;
            
            // Update agent grade with AI-powered quality scoring
            const qualityBonus = await this._assessQualityAI(result, prompt);
            const agent = this.registry.get(routing.agent);
            if (agent) {
                agent.usage_count = (agent.usage_count || 0) + 1;
                agent.grade = Math.min(100, (agent.grade || 50) + qualityBonus);
                this.registry.persistAgent(routing.agent);
            }
            
            this.context?.addMessage(routing.agent, result.slice(0, 2000), { 
                duration: entry.duration,
                success: true 
            });
            this.memory?.recordSuccess(routing.agent, prompt, { quality: qualityBonus });
            
            // Auto-store task result in memory pool for future recall
            if (this.memoryPool) {
                const tags = [routing.agent, persona?.agent, ...(prompt.match(/\b\w{4,}\b/g) || []).slice(0, 5)].filter(Boolean);
                this.memoryPool.store(
                    `Task: ${prompt.slice(0, 200)}\nAgent: ${routing.agent}\nResult: ${result.slice(0, 1500)}`,
                    { tags, label: `${routing.agent} task` }
                );
            }
            
            // Track token usage (estimate: ~4 chars per token)
            if (this.costTracker) {
                const inputTokens = Math.ceil(processed.length / 4);
                const outputTokens = Math.ceil((result?.length || 0) / 4);
                this.costTracker.track(routing.agent, routing.model || 'unknown', inputTokens, outputTokens);
            }
            
            this.emit('task-done', entry);
            
            // Record telemetry event
            if (this.userAuth) {
                this.userAuth.recordEvent('task_complete', {
                    agent: routing.agent, persona: persona?.id,
                    duration: entry.duration, tokens: Math.ceil(processed.length / 4) + Math.ceil((result?.length || 0) / 4),
                }).catch(() => {});
            }
            
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
        let score = 0;
        const length = result.length;

        if (length > 50) score += 1;
        if (length > 200) score += 0.5;
        if (/```[\s\S]*```/.test(result) || /function\s|const\s|class\s|import\s/.test(result)) score += 1;

        const promptWords = prompt.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        const resultLower = result.toLowerCase();
        const overlap = promptWords.filter(w => resultLower.includes(w)).length;
        if (promptWords.length > 0 && overlap / promptWords.length > 0.3) score += 1;

        if (/\n[-*]\s/.test(result) || /\n#{1,3}\s/.test(result) || /\n\d+\.\s/.test(result)) score += 0.5;

        return Math.min(score, 4);
    }

    /** AI-powered quality grading — Copilot → Ollama → rules fallback */
    async _assessQualityAI(result, prompt) {
        const ruleScore = this._assessQuality(result, prompt);
        const gradePrompt = `Rate this AI response quality from 1-5. Reply with ONLY a number, nothing else.
Task: ${prompt.slice(0, 150)}
Response preview: ${result.slice(0, 300)}
Rating (1-5):`;

        // Layer 1: Try Copilot (gpt-5-mini, free, smarter)
        try {
            const aiScore = await new Promise((resolve, reject) => {
                execFile('gh', ['copilot', '--model', COPILOT_FAST_MODEL, '-p', gradePrompt, '--allow-all-tools'], {
                    timeout: 15000, maxBuffer: 1024 * 16,
                }, (err, stdout) => {
                    if (err) { reject(err); return; }
                    const score = parseInt(stdout.trim().replace(/[^0-9]/g, '').slice(0, 1)) || 0;
                    if (score >= 1 && score <= 5) resolve(score);
                    else reject(new Error('Invalid score'));
                });
            });
            return Math.min((ruleScore * 0.4 + aiScore * 0.6), 5);
        } catch { /* fall through to Ollama */ }

        // Layer 2: Try Ollama (local, fast)
        try {
            const ollamaUrl = process.env.OLLAMA_HOST || 'http://localhost:11434';
            const res = await fetch(`${ollamaUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: process.env.OLLAMA_ROUTER_MODEL || 'qwen2.5:1.5b',
                    prompt: gradePrompt, stream: false,
                    options: { temperature: 0, num_predict: 5 }
                }),
                signal: AbortSignal.timeout(8000),
            });
            const data = await res.json();
            const aiScore = parseInt(data.response?.trim()) || 3;
            return Math.min((ruleScore * 0.4 + aiScore * 0.6), 5);
        } catch { /* fall through to rules */ }

        // Layer 3: Pure rule-based
        return ruleScore;
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

        // Compress prompt before sending
        let processed = prompt;
        if (this.preprocessor) {
            processed = await this.preprocessor.compress(processed);
        }
        if (this.compressor) {
            processed = this.compressor.compressPrompt(processed);
            const directive = this.compressor.getOutputDirective(processed);
            if (directive) processed = processed + '\n\n' + directive;
        }

        try {
            let result = await this.spawner.run(agentId, processed, cwd);
            if (this.compressor) {
                result = this.compressor.decompressResponse(result);
            }
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

        // Compress prompt once before sending to all agents
        let processed = prompt;
        if (this.preprocessor) {
            processed = await this.preprocessor.compress(processed);
        }
        if (this.compressor) {
            processed = this.compressor.compressPrompt(processed);
            const directive = this.compressor.getOutputDirective(processed);
            if (directive) processed = processed + '\n\n' + directive;
        }

        const results = await Promise.allSettled(agents.map((a) => this.spawner.run(a.id, processed, cwd)));
        return agents.map((a, i) => ({
            agent: a.id, name: a.name, status: results[i].status,
            result: results[i].status === 'fulfilled'
                ? (this.compressor ? this.compressor.decompressResponse(results[i].value) : results[i].value)
                : results[i].reason?.message,
        }));
    }

    /** AI-powered prompt decomposition — breaks freeform text into structured tasks.
     *  3-layer: Copilot GPT-5-mini → Ollama → rule-based splitting */
    async decompose(prompt) {
        const decomposePrompt = `Break this prompt into a JSON array of distinct tasks. Each task: {"title": "short title", "prompt": "detailed task description", "type": "ui|dev|research|planning|testing"}.
Reply with ONLY valid JSON array, nothing else. If it's a single task, return array with one item.

Prompt: ${prompt.slice(0, 1500)}
JSON:`;

        // Layer 1: Copilot GPT-5-mini
        try {
            const result = await new Promise((resolve, reject) => {
                execFile('gh', ['copilot', '--model', COPILOT_FAST_MODEL, '-p', decomposePrompt, '--allow-all-tools'], {
                    timeout: 20000, maxBuffer: 1024 * 32,
                }, (err, stdout) => {
                    if (err) { reject(err); return; }
                    resolve(stdout.trim());
                });
            });
            const jsonMatch = result.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const tasks = JSON.parse(jsonMatch[0]);
                if (Array.isArray(tasks) && tasks.length > 0) return tasks;
            }
        } catch { /* fall through */ }

        // Layer 2: Ollama
        try {
            const ollamaUrl = process.env.OLLAMA_HOST || 'http://localhost:11434';
            const res = await fetch(`${ollamaUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: process.env.OLLAMA_ROUTER_MODEL || 'qwen2.5:1.5b',
                    prompt: decomposePrompt, stream: false,
                    options: { temperature: 0, num_predict: 500 }
                }),
                signal: AbortSignal.timeout(10000),
            });
            const data = await res.json();
            const jsonMatch = (data.response || '').match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const tasks = JSON.parse(jsonMatch[0]);
                if (Array.isArray(tasks) && tasks.length > 0) return tasks;
            }
        } catch { /* fall through */ }

        // Layer 3: Rule-based splitting
        return this._decomposeRuleBased(prompt);
    }

    /** Rule-based prompt splitting — by sentences, numbered items, or bullet points */
    _decomposeRuleBased(prompt) {
        // Try numbered list (1. 2. 3.)
        const numbered = prompt.match(/\d+[.)]\s+[^\n]+/g);
        if (numbered && numbered.length >= 2) {
            return numbered.map(item => ({
                title: item.replace(/^\d+[.)]\s*/, '').slice(0, 60),
                prompt: item.replace(/^\d+[.)]\s*/, ''),
                type: 'dev',
            }));
        }
        // Try bullet points (- or *)
        const bullets = prompt.match(/^[\-\*]\s+.+$/gm);
        if (bullets && bullets.length >= 2) {
            return bullets.map(item => ({
                title: item.replace(/^[\-\*]\s*/, '').slice(0, 60),
                prompt: item.replace(/^[\-\*]\s*/, ''),
                type: 'dev',
            }));
        }
        // Single task
        return [{ title: prompt.slice(0, 60), prompt, type: 'dev' }];
    }
}
