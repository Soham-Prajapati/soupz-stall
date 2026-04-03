import { EventEmitter } from 'events';
import { execFile } from 'child_process';
import { callApiProvider, getBestApiProvider } from '../providers/api-runner.js';

const COPILOT_ROUTING_MODEL = process.env.SOUPZ_COPILOT_ROUTING_MODEL || 'gpt-4.1';

export class SemanticRouter extends EventEmitter {
    constructor(registry, contextManager, memory) {
        super();
        this.registry = registry;
        this.context = contextManager;
        this.memory = memory;
        // Auto mode keeps routing provider-neutral: API provider -> Copilot -> rules.
        this.routerMode = process.env.SOUPZ_ROUTER || 'auto'; // auto | copilot
        
        this.semanticPatterns = {
            design: /\b(pretty|beautiful|ui|ux|interface|layout|design|wireframe|mockup|visual|aesthetic|user.?flow|screen|component|svg|icon|logo|brand|color|palette|typography|award|prototype|landing.?page|css|animation|gsap)\b/i,
            architecture: /\b(architect|system|design|structure|pattern|scalab|distributed|microservice|api|database|infra)\b/i,
            coding: /\b(fix|bug|implement|code|refactor|debug|function|class|method|error|crash)\b/i,
            research: /\b(explain|research|what|why|how|find|discover|learn|understand|compare|market|competitor|analysis)\b/i,
            planning: /\b(plan|roadmap|sprint|task|epic|story|timeline|milestone|schedule)\b/i,
            testing: /\b(test|qa|quality|bug|edge.?case|coverage|automation|e2e|unit)\b/i,
            devops: /\b(deploy|docker|kubernetes|ci.?cd|pipeline|infra|terraform|cloud|aws|gcp)\b/i,
            content: /\b(write|content|blog|article|documentation|readme|guide|tutorial|copy|marketing)\b/i,
            strategy: /\b(strategy|business|market|competitor|revenue|growth|investor|pitch|positioning)\b/i,
            orchestration: /\b(coordinate|orchestrate|complex|multiple.steps|end.to.end|full.project|full.stack|everything|breakdown|multi.step)\b/i,
            'file-operations': /\b(file|read|write|create|delete|search|grep|find)\b/i,
            'code-analysis': /\b(analyze|review|inspect|check|lint|format|structure)\b/i,
            finance: /\b(finance|financial|revenue|profit|loss|cash.?flow|valuation|DCF|IRR|NPV|cap.?table|funding|runway|burn|EBITDA|LTV|CAC|payback|raise|Series|seed.?round|unit.?economics)\b/i,
            legal: /\b(legal|contract|terms|privacy|GDPR|compliance|liability|IP|trademark|copyright|NDA|SAFE|incorporation|equity|vesting)\b/i,
            growth: /\b(growth|viral|retention|churn|conversion|funnel|A.?B.?test|DAU|MAU|activation|onboarding|referral|NPS|engagement|product.?led|PLG)\b/i,
            mobile: /\b(mobile|iOS|Android|React.?Native|Expo|app|phone|tablet|native|push.?notification|App.?Store|Play.?Store)\b/i,
            'ai-engineering': /\b(LLM|GPT|Claude|Gemini|embedding|vector|RAG|retrieval|fine.?tune|prompt|MCP|tool.?use|function.?calling|inference|token|context.?window|langchain)\b/i,
            security: /\b(security|OWASP|vulnerability|auth|authentication|authorization|XSS|CSRF|injection|encrypt|token|JWT|session|pentest|threat)\b/i,
        };
    }

    /** Route via API key provider (Anthropic/OpenAI/Groq/OpenRouter) */
    async _aiRouteViaApi(prompt, candidates, provider) {
        const options = candidates.map(c => {
            const desc = (c.description || c.capabilities?.slice(0, 3)?.join(', ') || 'general').slice(0, 80);
            return `${c.id}: ${desc}`;
        }).join('\n');

        const routingPrompt = `Pick the single best id from this list for the given task. Reply with ONLY the id, nothing else.\n\n${options}\n\nTask: ${prompt.slice(0, 400)}\nAnswer:`;

        try {
            const raw = await callApiProvider(routingPrompt, 'You are a routing engine. Reply with only the agent id.', { tier: 'fast' });
            const picked = raw.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
            let match = candidates.find(c => c.id === picked);
            if (!match) match = candidates.find(c => picked.startsWith(c.id) || c.id.startsWith(picked));
            if (match) return { agent: match.id, name: match.name, method: `api-${provider.id}` };
        } catch { /* fall through */ }
        return null;
    }

    /** Route via Copilot (smarter but slower — 5-10s) */
    async _aiRouteCopilot(prompt, candidates) {
        const options = candidates.map(c => {
            const desc = (c.description || c.capabilities?.slice(0, 3)?.join(', ') || 'general').slice(0, 80);
            return `${c.id}: ${desc}`;
        }).join('\n');

        const routingPrompt = `You are a routing engine. Pick the single best id from this list for the given task. Reply with ONLY the id, nothing else. No explanation.

${options}

Task: ${prompt.slice(0, 400)}
Answer:`;

        return new Promise((resolve) => {
            const proc = execFile('gh', ['copilot', '--model', COPILOT_ROUTING_MODEL, '-p', routingPrompt, '--allow-all-tools'], {
                timeout: 30000,
                maxBuffer: 1024 * 64,
            }, (err, stdout) => {
                if (err) { resolve(null); return; }
                const raw = stdout.trim().toLowerCase().replace(/[^a-z0-9-_ \n]/g, '').trim();
                const picked = raw.split(/[\s,\n]+/)[0];
                let match = candidates.find(c => c.id === picked);
                if (!match) match = candidates.find(c => picked.startsWith(c.id) || c.id.startsWith(picked));
                if (!match) match = candidates.find(c => picked.includes(c.id) || c.id.includes(picked));
                if (!match) match = candidates.find(c => c.name.toLowerCase().includes(picked));
                if (match) { resolve({ agent: match.id, name: match.name, method: 'copilot-ai' }); return; }
                resolve(null);
            });
        });
    }

    /** Try AI routing with neutral priority: API provider first, then Copilot, then rules. */
    async _smartRoute(prompt, candidates) {
        const mode = this.routerMode;

        // In auto mode, use API providers first (often Gemini/OpenAI/Anthropic) before CLI-specific routers.
        if (mode === 'auto') {
            const apiProvider = getBestApiProvider('fast');
            if (apiProvider) {
                const apiResult = await this._aiRouteViaApi(prompt, candidates, apiProvider);
                if (apiResult) return apiResult;
            }
        }

        if (mode === 'copilot' || mode === 'auto') {
            const copilotResult = await this._aiRouteCopilot(prompt, candidates);
            if (copilotResult) return copilotResult;
        }

        // Last resort fallback for non-auto modes.
        const apiProvider = getBestApiProvider('fast');
        if (apiProvider) {
            const apiResult = await this._aiRouteViaApi(prompt, candidates, apiProvider);
            if (apiResult) return apiResult;
        }

        return null;
    }

    /** Synchronous route — rule-based only (backward compat) */
    route(prompt, options = {}) {
        return this._routeRuleBased(prompt, options);
    }

    /** Full AI-powered routing — Copilot primary, rules last */
    async routeAI(prompt, options = {}) {
        const agents = this.registry.headless();
        if (agents.length === 0) return null;

        if (options.forceAgent) {
            const agent = this.registry.get(options.forceAgent);
            if (agent?.available && agent?.headless) {
                return { agent: options.forceAgent, reason: 'User override', confidence: 1.0, method: 'override' };
            }
        }

        const pref = this.memory?.getPreference(prompt);
        if (pref) {
            const prefAgent = this.registry.get(pref);
            if (prefAgent?.available && prefAgent?.headless) {
                return { agent: pref, reason: `Learned preference: ${pref}`, confidence: 0.9, method: 'memory' };
            }
        }

        // Smart engine preference: Gemini for UI/design, Copilot for dev/coding
        const engineHint = await this._getEnginePreference(prompt);

        const aiResult = await this._smartRoute(prompt, agents);
        if (aiResult) {
            // If AI picked a generic engine, apply the UI/dev preference
            const finalAgent = engineHint && agents.find(a => a.id === engineHint)?.available
                ? engineHint : aiResult.agent;
            return {
                agent: finalAgent,
                reason: `${aiResult.method === 'copilot-ai' ? '🐙 Copilot' : '🤖 AI'} picked: ${aiResult.name}${engineHint ? ` (${engineHint} preferred)` : ''}`,
                confidence: aiResult.method === 'copilot-ai' ? 0.95 : 0.85,
                method: aiResult.method,
                alternatives: [],
            };
        }

        // Rule-based fallback with engine preference baked in
        const ruleResult = this._routeRuleBased(prompt, options);
        if (ruleResult && engineHint) {
            const preferred = agents.find(a => a.id === engineHint);
            if (preferred?.available) ruleResult.agent = engineHint;
        }
        return ruleResult;
    }

    /** Determine engine preference: Gemini for UI/design, Copilot for dev/building.
    *  Uses Copilot first, then rules (last resort) */
    async _getEnginePreference(prompt) {
        const enginePrompt = `Classify this task as either "gemini" (UI, design, CSS, visual, styling, layout, frontend aesthetics) or "copilot" (coding, building, debugging, API, backend, testing, deployment, config). Reply with ONLY one word: gemini or copilot.

Task: ${prompt.slice(0, 300)}
Answer:`;

        // Layer 1: Copilot Claude Sonnet
        try {
            const result = await new Promise((resolve, reject) => {
                execFile('gh', ['copilot', '--model', COPILOT_ROUTING_MODEL, '-p', enginePrompt, '--allow-all-tools'], {
                    timeout: 10000, maxBuffer: 1024 * 4,
                }, (err, stdout) => {
                    if (err) { reject(err); return; }
                    const answer = stdout.trim().toLowerCase().replace(/[^a-z]/g, '');
                    if (answer.includes('gemini')) resolve('gemini');
                    else if (answer.includes('copilot')) resolve('copilot');
                    else reject(new Error('unclear'));
                });
            });
            return result;
        } catch { /* fall through */ }

        // Simple keyword rules (last resort)
        const lower = prompt.toLowerCase();
        if (/\b(ui|ux|design|layout|css|style|visual|color|animation|landing.?page|mockup|wireframe|aesthetic|beautiful|pretty|font|typography|responsive|tailwind)\b/i.test(lower)) return 'gemini';
        if (/\b(fix|bug|implement|code|refactor|debug|api|endpoint|database|auth|jwt|test|deploy|docker|ci|build|config|install|npm|git|migration|schema|backend|server|middleware)\b/i.test(lower)) return 'copilot';
        return null;
    }

    /** Full AI-powered persona routing — Copilot primary, rules fallback */
    async routePersonaAI(prompt) {
        const personas = this.registry.personas();
        if (personas.length === 0) return null;

        const aiResult = await this._smartRoute(prompt, personas);
        if (aiResult) {
            const persona = personas.find(p => p.id === aiResult.agent);
            return {
                agent: aiResult.agent, score: 100, name: aiResult.name,
                method: aiResult.method,
                systemPrompt: persona?.system_prompt || persona?.body || '',
            };
        }

        // Fallback to rule-based only when all AI unavailable
        return this._routePersonaRuleBased(prompt);
    }

    /** Rule-based persona routing (fallback) */
    routePersona(prompt) {
        return this._routePersonaRuleBased(prompt);
    }

    /** Rule-based agent/tool routing (fallback when all AI unavailable) */
    _routeRuleBased(prompt, options = {}) {
        const agents = this.registry.headless();
        if (agents.length === 0) return null;

        if (options.forceAgent) {
            const agent = this.registry.get(options.forceAgent);
            if (agent?.available && agent?.headless) {
                return { agent: options.forceAgent, reason: 'User override', confidence: 1.0, method: 'rules' };
            }
        }

        const pref = this.memory?.getPreference(prompt);
        if (pref) {
            const prefAgent = this.registry.get(pref);
            if (prefAgent?.available && prefAgent?.headless) {
                return { agent: pref, reason: `Learned preference: ${pref}`, confidence: 0.9, method: 'memory' };
            }
        }

        const lower = prompt.toLowerCase();
        const recentContext = this.context?.getRecentMessages(5) || [];
        const scores = agents.map((agent) => {
            let score = agent.grade || 50;
            const keywords = agent.routing_keywords || [];
            for (const kw of keywords) {
                if (lower.includes(kw.toLowerCase())) score += 15;
            }
            const caps = agent.capabilities || [];
            for (const [category, pattern] of Object.entries(this.semanticPatterns)) {
                if (pattern.test(prompt)) {
                    if (caps.includes(category)) score += 25;
                    if (caps.includes(`${category}-expert`)) score += 35;
                    if (category === 'design' && caps.includes('code')) score += 10;
                }
            }
            if (recentContext.length > 0) {
                const lastAgent = recentContext[recentContext.length - 1]?.agent;
                if (lastAgent === agent.id) score += 20;
            }
            if (caps.includes('coding') && /\b(fix|implement|refactor|debug|code)\b/i.test(prompt)) score += 20;
            if (caps.includes('research') && /\b(explain|research|what|why|how)\b/i.test(prompt)) score += 20;
            if (caps.includes('shell') && /\b(command|terminal|git|docker|run)\b/i.test(prompt)) score += 20;
            score += Math.min((agent.usage_count || 0) * 0.5, 10);
            return { agent: agent.id, score, name: agent.name };
        });
        scores.sort((a, b) => b.score - a.score);
        const best = scores[0];
        const confidence = scores.length >= 2 ? Math.min((best.score - scores[1].score) / 50, 1.0) : 1.0;
        return {
            agent: best.agent,
            reason: `Best match: ${best.name} (score: ${best.score.toFixed(1)})`,
            confidence,
            method: 'rules',
            alternatives: scores.slice(1, 3).map(s => ({ agent: s.agent, score: s.score })),
        };
    }

    _routePersonaRuleBased(prompt) {
        const personas = this.registry.personas();
        if (personas.length === 0) return null;

        const lower = prompt.toLowerCase();
        const scores = personas.map((p) => {
            let score = p.grade || 50;
            const keywords = p.routing_keywords || [];
            for (const kw of keywords) {
                if (lower.includes(kw.toLowerCase())) score += 15;
            }
            const caps = p.capabilities || [];
            for (const [category, pattern] of Object.entries(this.semanticPatterns)) {
                if (pattern.test(prompt)) {
                    if (caps.includes(category)) score += 25;
                    if (caps.includes(`${category}-expert`)) score += 35;
                }
            }
            const usageCount = p.usage_count || 0;
            score += Math.min(usageCount * 0.5, 10);
            return { agent: p.id, score, name: p.name, method: 'rules', systemPrompt: p.system_prompt || p.body || '' };
        });

        scores.sort((a, b) => b.score - a.score);
        const best = scores[0];
        if (best.score <= 55) return null;
        return best;
    }
}
