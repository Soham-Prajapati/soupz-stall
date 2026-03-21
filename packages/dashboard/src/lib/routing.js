// routing.js — Smart agent & specialist selection

import { CLI_AGENTS, SPECIALISTS } from './agents.js';
import { getLearnedWeight } from './learning.js';

// ---------------------------------------------------------------------------
// Routing keywords per CLI agent
// ---------------------------------------------------------------------------
const AGENT_ROUTING_KEYWORDS = {
  'claude-code': [
    'refactor', 'architect', 'design pattern', 'complex', 'large codebase',
    'explain', 'review', 'security', 'auth', 'algorithm', 'optimize',
    'typescript', 'react', 'component', 'test', 'coverage', 'tdd',
    'api design', 'schema', 'database', 'sql', 'documentation', 'readme',
  ],
  'gemini': [
    'search', 'research', 'multimodal', 'image', 'video', 'analyze',
    'summarize', 'compare', 'market', 'trend', 'google', 'web',
    'data', 'dataset', 'explore', 'insight', 'report',
  ],
  'copilot': [
    'github', 'pull request', 'pr', 'issue', 'commit', 'diff', 'merge',
    'branch', 'workflow', 'actions', 'ci', 'cd', 'pipeline',
    'complete', 'autocomplete', 'snippet', 'boilerplate', 'scaffold',
  ],
  'kiro': [
    'aws', 'cloud', 'lambda', 's3', 'ec2', 'deploy', 'infra',
    'serverless', 'ecs', 'eks', 'terraform', 'cdk', 'cloudformation',
    'devops', 'container', 'docker', 'kubernetes', 'k8s', 'iam', 'policy',
  ],
  'ollama': [
    'local', 'offline', 'private', 'on-device', 'no api', 'free',
    'llama', 'mistral', 'qwen', 'phi', 'model', 'run locally',
  ],
};

// Specialist keyword patterns per category
const SPECIALIST_CATEGORY_KEYWORDS = {
  dev: [
    'code', 'build', 'fix', 'debug', 'bug', 'function', 'class', 'module',
    'implement', 'feature', 'refactor', 'test', 'api', 'endpoint', 'script',
    'program', 'develop', 'error', 'exception', 'compile', 'lint',
  ],
  design: [
    'ui', 'ux', 'design', 'color', 'palette', 'layout', 'component',
    'wireframe', 'mockup', 'prototype', 'visual', 'brand', 'logo',
    'typography', 'figma', 'style', 'theme', 'css', 'tailwind',
  ],
  research: [
    'research', 'analyze', 'analysis', 'compare', 'comparison', 'market',
    'competitor', 'trend', 'data', 'survey', 'insight', 'study', 'report',
    'investigate', 'benchmark', 'review', 'evaluate', 'metric',
  ],
  strategy: [
    'plan', 'roadmap', 'strategy', 'goal', 'milestone', 'sprint', 'backlog',
    'prioritize', 'gtm', 'launch', 'vision', 'mission', 'okr', 'kpi',
    'brainstorm', 'ideate', 'pivot', 'growth', 'seo', 'acquisition',
  ],
  content: [
    'write', 'blog', 'copy', 'post', 'article', 'email', 'newsletter',
    'social', 'tweet', 'linkedin', 'caption', 'headline', 'narrative',
    'story', 'draft', 'edit', 'proofread', 'doc', 'documentation',
  ],
  business: [
    'cost', 'finance', 'legal', 'contract', 'compliance', 'regulation',
    'budget', 'revenue', 'profit', 'unit economics', 'p&l', 'invoice',
    'pricing', 'model', 'forecast', 'fundraise', 'investor', 'tos',
  ],
};

// Specialist id → category mapping
const SPECIALIST_ID_CATEGORY = {};
for (const s of SPECIALISTS) {
  if (s.category && s.category !== 'all') {
    SPECIALIST_ID_CATEGORY[s.id] = s.category;
  }
}

// ---------------------------------------------------------------------------
// 1. scoreAgentForPrompt
// ---------------------------------------------------------------------------

/**
 * Score a CLI agent for a given prompt using routing keywords.
 * @param {string} prompt
 * @param {string} agentId
 * @returns {number} 0-100
 */
export function scoreAgentForPrompt(prompt, agentId) {
  const keywords = AGENT_ROUTING_KEYWORDS[agentId];
  if (!keywords || !keywords.length) return 0;

  const lower = prompt.toLowerCase();
  let hits = 0;

  for (const kw of keywords) {
    if (lower.includes(kw)) hits++;
  }

  // Normalise: cap at 10 hits → 100, scale linearly
  const raw = Math.min(hits / Math.max(keywords.length * 0.3, 1), 1);
  return Math.round(raw * 100);
}

// ---------------------------------------------------------------------------
// 2. scoreSpecialistForPrompt
// ---------------------------------------------------------------------------

/**
 * Score a specialist for a given prompt.
 * @param {string} prompt
 * @param {string} specialistId
 * @returns {number} 0-100
 */
export function scoreSpecialistForPrompt(prompt, specialistId) {
  const specialist = SPECIALISTS.find(s => s.id === specialistId);
  if (!specialist) return 0;

  const category = specialist.category;
  const lower = prompt.toLowerCase();
  let hits = 0;

  // Score against category keywords
  const catKeywords = SPECIALIST_CATEGORY_KEYWORDS[category] || [];
  for (const kw of catKeywords) {
    if (lower.includes(kw)) hits++;
  }

  // Also score against the specialist's own desc words
  const descWords = (specialist.desc || '').toLowerCase().split(/[\s,/]+/).filter(w => w.length > 2);
  for (const w of descWords) {
    if (lower.includes(w)) hits++;
  }

  const totalKeywords = catKeywords.length + descWords.length;
  if (totalKeywords === 0) return 0;

  const raw = Math.min(hits / Math.max(totalKeywords * 0.2, 1), 1);
  return Math.round(raw * 100);
}

// ---------------------------------------------------------------------------
// 3. detectIntent
// ---------------------------------------------------------------------------

const CATEGORY_KEYWORDS_FLAT = {
  code:     SPECIALIST_CATEGORY_KEYWORDS.dev,
  design:   SPECIALIST_CATEGORY_KEYWORDS.design,
  research: SPECIALIST_CATEGORY_KEYWORDS.research,
  strategy: SPECIALIST_CATEGORY_KEYWORDS.strategy,
  content:  SPECIALIST_CATEGORY_KEYWORDS.content,
  business: SPECIALIST_CATEGORY_KEYWORDS.business,
};

const ACTION_WORD_RE = /\b(build|create|make|fix|debug|write|design|plan|research|analyze|analyze|compare|review|deploy|test|optimize|refactor|generate|draft|implement|explore|explain|summarize|improve|migrate|convert|add|remove|update|delete)\b/gi;

/**
 * Analyze a prompt and return intent metadata.
 * @param {string} prompt
 * @returns {{ category: string, complexity: string, keywords: string[] }}
 */
export function detectIntent(prompt) {
  const lower = prompt.toLowerCase();
  const words = lower.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // Extract action keywords
  const keywordMatches = prompt.match(ACTION_WORD_RE) || [];
  const keywords = [...new Set(keywordMatches.map(k => k.toLowerCase()))];

  // Determine category by highest hit count
  let bestCategory = 'general';
  let bestScore = 0;
  for (const [cat, catKws] of Object.entries(CATEGORY_KEYWORDS_FLAT)) {
    let score = 0;
    for (const kw of catKws) {
      if (lower.includes(kw)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = cat;
    }
  }

  // Complexity heuristics
  const questionMarks = (prompt.match(/\?/g) || []).length;
  const andOrCount = (prompt.match(/\b(and|then|also|additionally|as well|furthermore|plus)\b/gi) || []).length;
  const nestingIndicators = (prompt.match(/\b(if|when|while|before|after|unless|so that)\b/gi) || []).length;
  const complexityScore = wordCount + questionMarks * 5 + andOrCount * 3 + nestingIndicators * 4;

  let complexity;
  if (complexityScore < 20) {
    complexity = 'simple';
  } else if (complexityScore < 60) {
    complexity = 'medium';
  } else {
    complexity = 'complex';
  }

  return { category: bestCategory, complexity, keywords };
}

// ---------------------------------------------------------------------------
// 4. selectAgentLocally
// ---------------------------------------------------------------------------

// Default fallback agent ordering (by general capability breadth)
const DEFAULT_AGENT_ORDER = ['gemini', 'copilot', 'ollama', 'claude-code', 'kiro'];

// Category → preferred CLI agents (ordered by preference, first available wins)
const CATEGORY_PREFERRED_AGENTS = {
  code:     ['gemini', 'copilot', 'ollama', 'claude-code'],
  design:   ['gemini', 'copilot', 'ollama', 'claude-code'],
  research: ['gemini', 'copilot', 'ollama', 'claude-code'],
  strategy: ['gemini', 'copilot', 'ollama', 'claude-code'],
  content:  ['gemini', 'copilot', 'ollama', 'claude-code'],
  business: ['gemini', 'copilot', 'ollama', 'claude-code'],
  general:  ['gemini', 'copilot', 'ollama', 'claude-code'],
};

// Legacy single-agent mapping (for backwards compat)
const CATEGORY_PREFERRED_AGENT = Object.fromEntries(
  Object.entries(CATEGORY_PREFERRED_AGENTS).map(([k, v]) => [k, v[0]])
);

// Agent capability tiers — what each agent is good/bad at
const AGENT_CAPABILITIES = {
  'claude-code': { strengths: ['code', 'design', 'architecture', 'refactoring', 'security'], weaknesses: [], tier: 'premium', reliable: true },
  'gemini':      { strengths: ['research', 'multimodal', 'content', 'analysis', 'search'], weaknesses: [], tier: 'free', reliable: true },
  'copilot':     { strengths: ['github', 'code-completion', 'pr-reviews', 'scaffolding'], weaknesses: ['architecture'], tier: 'freemium', reliable: true },
  'kiro':        { strengths: ['aws', 'cloud', 'serverless', 'devops'], weaknesses: ['general-code', 'non-aws'], tier: 'premium', reliable: false },
  'ollama':      { strengths: ['privacy', 'offline', 'local'], weaknesses: ['complex-reasoning', 'large-context'], tier: 'free', reliable: true },
};

// Category → preferred specialist id
const CATEGORY_PREFERRED_SPECIALIST = {
  code:     'dev',
  design:   'designer',
  research: 'researcher',
  strategy: 'strategist',
  content:  'contentwriter',
  business: 'finance',
  general:  'dev',
};

/**
 * Pick the first available agent from a preference list.
 * @param {string[]} preferenceList - ordered agent ids
 * @param {Set<string>} availSet - available agent ids (empty = all available)
 * @returns {string|null}
 */
function pickFirstAvailable(preferenceList, availSet) {
  if (availSet.size === 0) return preferenceList[0] || null;
  for (const id of preferenceList) {
    if (availSet.has(id)) return id;
  }
  return null;
}

/**
 * Check if an agent should be deprioritized (e.g., Kiro for non-AWS tasks).
 * @param {string} agentId
 * @param {string} category
 * @param {string} prompt
 * @returns {boolean}
 */
function shouldDeprioritize(agentId, category, prompt) {
  const caps = AGENT_CAPABILITIES[agentId];
  if (!caps) return false;
  // Kiro is unreliable for non-AWS tasks — deprioritize unless prompt is AWS-related
  if (agentId === 'kiro' && !caps.reliable) {
    const awsKeywords = AGENT_ROUTING_KEYWORDS['kiro'] || [];
    const lower = prompt.toLowerCase();
    const hasAwsKeyword = awsKeywords.some(kw => lower.includes(kw));
    if (!hasAwsKeyword) return true;
  }
  return false;
}

/**
 * Pure JS keyword-based agent selection — no API needed.
 * Handles edge cases where users only have access to certain agents.
 * @param {string} prompt
 * @param {string[] | Record<string,boolean>} availableAgents - agent ids that are installed/available
 * @returns {{ cliAgent: string, specialist: string, fallbackReason?: string }}
 */
export function selectAgentLocally(prompt, availableAgents) {
  const { category } = detectIntent(prompt);

  // Normalise availableAgents to a Set of ids
  const availSet = resolveAvailableSet(availableAgents);

  // Score all CLI agents — multiply keyword score by learned weight boost
  // Filter out agents that should be deprioritized
  const agentScores = CLI_AGENTS
    .filter(a => availSet.size === 0 || availSet.has(a.id))
    .filter(a => !shouldDeprioritize(a.id, category, prompt))
    .map(a => ({
      id: a.id,
      score: scoreAgentForPrompt(prompt, a.id) * (1 + getLearnedWeight(a.id, category)),
    }))
    .sort((a, b) => b.score - a.score);

  let cliAgent;
  let fallbackReason = null;

  if (agentScores.length === 0) {
    // No agents available after filtering — try without deprioritization
    const anyAvailable = CLI_AGENTS.filter(a => availSet.size === 0 || availSet.has(a.id));
    if (anyAvailable.length > 0) {
      cliAgent = anyAvailable[0].id;
      fallbackReason = `Only ${anyAvailable[0].name} available`;
    } else {
      // Truly nothing — pick from category preference list
      cliAgent = pickFirstAvailable(
        CATEGORY_PREFERRED_AGENTS[category] || DEFAULT_AGENT_ORDER,
        availSet
      ) || 'gemini'; // gemini is free, most accessible fallback
      fallbackReason = 'No agents detected — defaulting to Gemini (free)';
    }
  } else if (agentScores[0].score > 0) {
    cliAgent = agentScores[0].id;
  } else {
    // No keyword match — use category preference list, respecting availability
    cliAgent = pickFirstAvailable(
      CATEGORY_PREFERRED_AGENTS[category] || DEFAULT_AGENT_ORDER,
      availSet
    ) || agentScores[0]?.id || 'gemini';
  }

  // Score all non-auto specialists
  const specialistScores = SPECIALISTS
    .filter(s => s.id !== 'auto' && s.id !== 'orchestrator')
    .map(s => ({ id: s.id, score: scoreSpecialistForPrompt(prompt, s.id) }))
    .sort((a, b) => b.score - a.score);

  let specialist;
  if (specialistScores.length === 0 || specialistScores[0].score === 0) {
    specialist = CATEGORY_PREFERRED_SPECIALIST[category] || 'dev';
  } else {
    specialist = specialistScores[0].id;
  }

  const result = { cliAgent, specialist };
  if (fallbackReason) result.fallbackReason = fallbackReason;
  return result;
}

// ---------------------------------------------------------------------------
// 5. selectAgentWithOllama
// ---------------------------------------------------------------------------

const OLLAMA_URL = 'http://localhost:11434';
const OLLAMA_MODEL = 'qwen2.5:0.5b';
const OLLAMA_TIMEOUT_MS = 2000;

/**
 * Try Ollama for classification, fall back to local selection on error/timeout.
 * @param {string} prompt
 * @param {string[] | Record<string,boolean>} availableAgents
 * @returns {Promise<{ cliAgent: string, specialist: string }>}
 */
export async function selectAgentWithOllama(prompt, availableAgents) {
  const availSet = resolveAvailableSet(availableAgents);

  const cliList = CLI_AGENTS
    .filter(a => availSet.size === 0 || availSet.has(a.id))
    .map(a => a.id);

  const specialistList = SPECIALISTS
    .filter(s => s.id !== 'auto' && s.id !== 'orchestrator')
    .map(s => s.id);

  const systemPrompt =
    `You are a task classifier for an AI coding IDE. ` +
    `Given a user task, output ONLY valid JSON with keys "cliAgent" and "specialist". ` +
    `"cliAgent" must be one of: [${cliList.join(', ')}]. ` +
    `"specialist" must be one of: [${specialistList.join(', ')}]. ` +
    `Pick the most relevant option for each. ` +
    `Output ONLY the JSON object, nothing else.`;

  const fullPrompt = `${systemPrompt}\n\nTask: ${prompt}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: fullPrompt,
        stream: false,
        options: { temperature: 0, num_predict: 64 },
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) throw new Error(`Ollama ${res.status}`);

    const data = await res.json();
    const text = (data.response || '').trim();

    // Extract JSON from the response (handle markdown fences, extra text)
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) throw new Error('No JSON in Ollama response');

    const parsed = JSON.parse(jsonMatch[0]);

    const cliAgent = cliList.includes(parsed.cliAgent) ? parsed.cliAgent : null;
    const specialist = specialistList.includes(parsed.specialist) ? parsed.specialist : null;

    if (!cliAgent || !specialist) throw new Error('Invalid agent ids from Ollama');

    return { cliAgent, specialist };
  } catch {
    return selectAgentLocally(prompt, availableAgents);
  }
}

// ---------------------------------------------------------------------------
// 6. selectAgentWithDaemon + getAutoSelection
// ---------------------------------------------------------------------------

const DAEMON_URL = 'http://localhost:7533';

/**
 * Use daemon's /api/classify endpoint (tries Copilot -> Gemini -> Ollama -> local).
 * @param {string} prompt
 * @param {string[] | Record<string,boolean>} availableAgents
 * @returns {Promise<{ cliAgent: string, specialist: string, method: string } | null>}
 */
export async function selectAgentWithDaemon(prompt, availableAgents) {
  const availSet = resolveAvailableSet(availableAgents);
  const agentList = [...availSet].filter(Boolean);

  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${DAEMON_URL}/api/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, availableAgents: agentList }),
      signal: controller.signal,
    });
    if (res.ok) {
      const data = await res.json();
      return { cliAgent: data.cliAgent, specialist: data.specialist, method: data.method };
    }
  } catch { /* fall through */ }

  return null; // signal: use local fallback
}

/**
 * Main entry point for auto agent selection.
 * @param {string} prompt
 * @param {string[] | Record<string,boolean>} availableAgents
 * @param {boolean} useOllama
 * @returns {Promise<{ cliAgent: string, specialist: string, method: string }>}
 */
export async function getAutoSelection(prompt, availableAgents, useOllama) {
  // 1. Try daemon classify (Copilot -> Gemini -> Ollama cascade)
  const daemonResult = await selectAgentWithDaemon(prompt, availableAgents);
  if (daemonResult) return daemonResult;

  // 2. Try Ollama directly if daemon is down but Ollama is up
  if (useOllama) {
    const ollamaUp = await isOllamaReachable();
    if (ollamaUp) {
      try {
        const result = await selectAgentWithOllama(prompt, availableAgents);
        return { ...result, method: 'ollama' };
      } catch { /* fall through */ }
    }
  }

  // 3. Local keyword matching (includes fallback logic for limited agents)
  const result = selectAgentLocally(prompt, availableAgents);
  return { ...result, method: 'local' };
}

/**
 * Get a human-readable summary of available agents for display.
 * @param {Record<string,boolean>} availability
 * @returns {{ available: string[], missing: string[], suggestion: string }}
 */
export function getAgentSummary(availability) {
  const available = [];
  const missing = [];
  for (const agent of CLI_AGENTS) {
    if (availability[agent.id]) {
      available.push(agent.name);
    } else {
      missing.push(agent.name);
    }
  }

  let suggestion = '';
  if (available.length === 0) {
    suggestion = 'No agents detected. Install Gemini CLI (free) with: npm install -g @google/gemini-cli';
  } else if (available.length === 1) {
    suggestion = `Only ${available[0]} is available. Install more agents for smarter routing.`;
  }

  return { available, missing, suggestion };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalise availableAgents (array or object) to a Set of agent id strings.
 * An empty Set means "treat all agents as available".
 * @param {string[] | Record<string,boolean> | undefined} availableAgents
 * @returns {Set<string>}
 */
function resolveAvailableSet(availableAgents) {
  if (!availableAgents) return new Set();

  if (Array.isArray(availableAgents)) {
    return new Set(availableAgents.filter(Boolean));
  }

  // Object: { 'claude-code': true, gemini: false, ... }
  return new Set(
    Object.entries(availableAgents)
      .filter(([, v]) => v === true)
      .map(([k]) => k),
  );
}

/**
 * Quick reachability check for Ollama.
 * @returns {Promise<boolean>}
 */
export async function isOllamaReachable() {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(1500),
    });
    return res.ok;
  } catch {
    return false;
  }
}
