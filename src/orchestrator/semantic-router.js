import { EventEmitter } from 'events';

export class SemanticRouter extends EventEmitter {
    constructor(registry, contextManager, memory) {
        super();
        this.registry = registry;
        this.context = contextManager;
        this.memory = memory;
        
        // Semantic patterns for better matching
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
        };
    }

    /** Enhanced routing with semantic understanding and context */
    route(prompt, options = {}) {
        const agents = this.registry.headless();
        if (agents.length === 0) return null;

        // Check for explicit agent override
        if (options.forceAgent) {
            const agent = this.registry.get(options.forceAgent);
            if (agent?.available && agent?.headless) {
                return { agent: options.forceAgent, reason: 'User override', confidence: 1.0 };
            }
        }

        // Check memory for learned preferences
        const pref = this.memory?.getPreference(prompt);
        if (pref) {
            const prefAgent = this.registry.get(pref);
            if (prefAgent?.available && prefAgent?.headless) {
                return { agent: pref, reason: `Learned preference: ${pref}`, confidence: 0.9 };
            }
        }

        // Get context-aware scoring
        const scores = this._scoreAgents(prompt, agents);
        
        // Sort by score
        scores.sort((a, b) => b.score - a.score);
        
        const best = scores[0];
        const confidence = this._calculateConfidence(scores);
        
        return {
            agent: best.agent,
            reason: `Best match: ${best.name} (score: ${best.score.toFixed(1)})`,
            confidence,
            alternatives: scores.slice(1, 3).map(s => ({ agent: s.agent, score: s.score })),
            scores
        };
    }

    _scoreAgents(prompt, agents) {
        const lower = prompt.toLowerCase();
        const recentContext = this.context?.getRecentMessages(5) || [];
        
        return agents.map((agent) => {
            let score = agent.grade || 50;
            
            // 1. Keyword matching (basic)
            const keywords = agent.routing_keywords || [];
            for (const kw of keywords) {
                if (lower.includes(kw.toLowerCase())) score += 15;
            }
            
            // 2. Semantic pattern matching (advanced)
            const caps = agent.capabilities || [];
            for (const [category, pattern] of Object.entries(this.semanticPatterns)) {
                if (pattern.test(prompt)) {
                    // Don't auto-route UI/design prompts to Antigravity
                    if (category === 'design' && agent.id === 'antigravity') {
                        score -= 50; // Penalize Antigravity for design prompts
                        continue;
                    }
                    
                    if (caps.includes(category)) score += 25;
                    if (caps.includes(`${category}-expert`)) score += 35;
                    // Extra boost for award-worthy design prompts
                    if (category === 'design' && caps.includes('code')) score += 10;
                }
            }
            
            // 3. Context continuity bonus
            if (recentContext.length > 0) {
                const lastAgent = recentContext[recentContext.length - 1]?.agent;
                if (lastAgent === agent.id) score += 20; // Continuity bonus
                
                // Check if this is a natural handoff
                const handoffPatterns = {
                    'architect': ['designer', 'dev'],
                    'designer': ['dev', 'architect'],
                    'pm': ['architect', 'designer', 'dev'],
                    'dev': ['qa', 'tester'],
                    'qa': ['dev'],
                };
                
                if (handoffPatterns[lastAgent]?.includes(agent.id)) {
                    score += 15; // Natural workflow handoff
                }
            }
            
            // 4. Capability-specific boosts
            if (caps.includes('coding') && /\b(fix|implement|refactor|debug|code)\b/i.test(prompt)) score += 20;
            if (caps.includes('research') && /\b(explain|research|what|why|how)\b/i.test(prompt)) score += 20;
            if (caps.includes('shell') && /\b(command|terminal|git|docker|run)\b/i.test(prompt)) score += 20;
            
            // 5. Usage history boost
            const usageCount = agent.usage_count || 0;
            score += Math.min(usageCount * 0.5, 10); // Cap at +10
            
            return { agent: agent.id, score, name: agent.name };
        });
    }

    _calculateConfidence(scores) {
        if (scores.length < 2) return 1.0;
        const best = scores[0].score;
        const second = scores[1].score;
        const gap = best - second;
        return Math.min(gap / 50, 1.0); // Normalize to 0-1
    }

    /** Suggest agent based on partial input (for autocomplete) */
    suggest(partialPrompt) {
        const agents = this.registry.headless();
        const matches = [];
        
        for (const agent of agents) {
            const keywords = agent.routing_keywords || [];
            for (const kw of keywords) {
                if (kw.toLowerCase().includes(partialPrompt.toLowerCase())) {
                    matches.push({ agent: agent.id, name: agent.name, keyword: kw });
                }
            }
        }
        
        return matches;
    }
}
