// learning.js — Usage tracking and dynamic agent learning system
// All storage is localStorage only. No server, no Supabase.

import { CLI_AGENTS } from './agents.js';

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

const USAGE_KEY        = 'soupz_agent_usage';    // { agentId: count }
const PATTERN_KEY      = 'soupz_patterns';        // tracked prompt→agent pairs (last 200)
const CUSTOM_AGENTS_KEY = 'soupz_custom_agents';  // user-created / auto-promoted agents

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded or private-browsing restriction — fail silently
  }
}

// Derive a rough category from a prompt string (mirrors routing.js heuristics)
function categorizePrompt(prompt) {
  const lower = (prompt || '').toLowerCase();

  const categories = {
    code:     ['code', 'build', 'fix', 'debug', 'function', 'api', 'refactor', 'implement', 'test', 'bug'],
    design:   ['ui', 'ux', 'design', 'color', 'layout', 'component', 'css', 'tailwind', 'figma', 'style'],
    research: ['research', 'analyze', 'analysis', 'compare', 'market', 'data', 'trend', 'report', 'investigate'],
    strategy: ['plan', 'roadmap', 'strategy', 'goal', 'sprint', 'gtm', 'brainstorm', 'growth'],
    content:  ['write', 'blog', 'copy', 'post', 'article', 'email', 'social', 'draft', 'doc'],
    business: ['cost', 'finance', 'legal', 'contract', 'budget', 'revenue', 'pricing', 'model'],
  };

  let best = 'general';
  let bestScore = 0;

  for (const [cat, keywords] of Object.entries(categories)) {
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      best = cat;
    }
  }

  return best;
}

// Build a combo key from agentId + specialistId for pattern grouping
function comboKey(agentId, specialistId) {
  return `${agentId}::${specialistId}`;
}

// ---------------------------------------------------------------------------
// trackUsage
// ---------------------------------------------------------------------------

/**
 * Track a prompt and which agent / specialist handled it.
 * - Appends to patterns ring-buffer (last 200)
 * - Increments usage count for the CLI agent
 * - After 10+ uses of the same agent+specialist combo, auto-promotes to a
 *   custom agent (unless one already exists for that combo)
 *
 * @param {string} prompt
 * @param {string} agentId       — CLI agent id (e.g. 'claude-code')
 * @param {string} specialistId  — specialist id or 'auto'
 * @param {string} buildMode     — 'quick' | 'planned' | 'chat'
 * @param {string} outcome       — 'sent' | 'error' | 'unknown'
 */
export function trackUsage(prompt, agentId, specialistId = 'auto', buildMode = 'quick', outcome = 'unknown') {
  if (!agentId || agentId === 'auto') return; // nothing concrete to track

  const category = categorizePrompt(prompt);

  // --- Patterns ring-buffer ---
  const patterns = readJSON(PATTERN_KEY, []);
  patterns.push({
    ts: Date.now(),
    prompt: prompt.slice(0, 120), // truncate for storage
    agentId,
    specialistId,
    buildMode,
    category,
    outcome,
  });
  // Keep only last 200
  if (patterns.length > 200) patterns.splice(0, patterns.length - 200);
  writeJSON(PATTERN_KEY, patterns);

  // --- Usage counts ---
  const usage = readJSON(USAGE_KEY, {});
  usage[agentId] = (usage[agentId] || 0) + 1;
  writeJSON(USAGE_KEY, usage);

  // --- Auto-promote combos with 10+ uses ---
  const key = comboKey(agentId, specialistId);
  const comboCount = patterns.filter(p => comboKey(p.agentId, p.specialistId) === key).length;

  if (comboCount >= 10) {
    const existingCustom = getCustomAgents();
    const alreadyExists = existingCustom.some(
      a => a.preferredCli === agentId && a.preferredSpecialist === specialistId && a.autoCreated,
    );

    if (!alreadyExists) {
      // Derive a sensible name from the combo
      const agentEntry = CLI_AGENTS.find(a => a.id === agentId);
      const agentName = agentEntry?.name || agentId;
      const specLabel = specialistId === 'auto' ? '' : ` + ${specialistId}`;

      // Collect the most common keywords used with this combo
      const comboPatterns = patterns.filter(p => comboKey(p.agentId, p.specialistId) === key);
      const catCounts = {};
      for (const p of comboPatterns) {
        catCounts[p.category] = (catCounts[p.category] || 0) + 1;
      }
      const topCategory = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || category;

      createCustomAgent(
        `${agentName}${specLabel}`,
        `Auto-learned: ${agentName} for ${topCategory} tasks`,
        agentId,
        specialistId,
        [topCategory],
        true, // autoCreated
      );
    }
  }
}

// ---------------------------------------------------------------------------
// getAgentsByUsage
// ---------------------------------------------------------------------------

/**
 * Returns CLI_AGENTS sorted by usage frequency (descending).
 * Agents with no recorded usage appear at the end in their original order.
 *
 * @returns {Array} sorted CLI_AGENTS
 */
export function getAgentsByUsage() {
  const usage = readJSON(USAGE_KEY, {});
  return [...CLI_AGENTS].sort((a, b) => {
    const ca = usage[a.id] || 0;
    const cb = usage[b.id] || 0;
    return cb - ca;
  });
}

// ---------------------------------------------------------------------------
// getLearnedWeight
// ---------------------------------------------------------------------------

/**
 * Returns a 0–1 multiplier based on how often the user has chosen a given
 * CLI agent for a given prompt category.
 *
 * Used in routing.js to boost the local keyword score for well-established
 * user patterns without replacing the keyword logic entirely.
 *
 * @param {string} agentId
 * @param {string} promptCategory — output of detectIntent().category
 * @returns {number} multiplier in [0, 1]
 */
export function getLearnedWeight(agentId, promptCategory) {
  const patterns = readJSON(PATTERN_KEY, []);
  if (patterns.length === 0) return 0;

  // Only look at the last 100 patterns for recency
  const recent = patterns.slice(-100);

  const categoryPatterns = recent.filter(p => p.category === promptCategory || p.category === 'general');
  if (categoryPatterns.length === 0) return 0;

  const agentHits = categoryPatterns.filter(p => p.agentId === agentId).length;

  // Normalise to [0, 1] — capped at 20 uses giving a weight of 1.0
  const weight = Math.min(agentHits / 20, 1);
  return weight;
}

// ---------------------------------------------------------------------------
// createCustomAgent
// ---------------------------------------------------------------------------

/**
 * Create and persist a custom agent.
 *
 * @param {string}   name
 * @param {string}   description
 * @param {string}   preferredCli       — CLI agent id
 * @param {string}   preferredSpecialist — specialist id
 * @param {string[]} triggerKeywords
 * @param {boolean}  autoCreated        — true when promoted automatically
 * @returns {object} the new agent object
 */
export function createCustomAgent(name, description, preferredCli, preferredSpecialist, triggerKeywords = [], autoCreated = false) {
  const agents = readJSON(CUSTOM_AGENTS_KEY, []);

  const agent = {
    id: 'custom_' + Date.now(),
    name: (name || 'Custom Agent').trim(),
    description: (description || '').trim(),
    category: 'custom',
    color: '#6366F1',
    icon: 'Sparkles',       // string name — serializable
    preferredCli,
    preferredSpecialist,
    triggerKeywords: Array.isArray(triggerKeywords) ? triggerKeywords : [],
    usageCount: 0,
    createdAt: new Date().toISOString(),
    autoCreated: Boolean(autoCreated),
  };

  agents.push(agent);
  writeJSON(CUSTOM_AGENTS_KEY, agents);
  return agent;
}

// ---------------------------------------------------------------------------
// getCustomAgents
// ---------------------------------------------------------------------------

/**
 * Returns all user-created and auto-learned custom agents.
 * @returns {object[]}
 */
export function getCustomAgents() {
  return readJSON(CUSTOM_AGENTS_KEY, []);
}

// ---------------------------------------------------------------------------
// deleteCustomAgent
// ---------------------------------------------------------------------------

/**
 * Remove a custom agent by id.
 * @param {string} id
 */
export function deleteCustomAgent(id) {
  const agents = readJSON(CUSTOM_AGENTS_KEY, []).filter(a => a.id !== id);
  writeJSON(CUSTOM_AGENTS_KEY, agents);
}

// ---------------------------------------------------------------------------
// getAgentSuggestions
// ---------------------------------------------------------------------------

/**
 * Analyse usage patterns and return suggestions for custom agents that the
 * user hasn't created yet.
 *
 * A suggestion is returned only when the same (agentId, specialistId) combo
 * appears 5+ times AND the implied confidence is > 0.7 (i.e. that combo
 * accounts for ≥ 70 % of the user's activity for the detected category).
 *
 * @returns {Array<{ name, description, cliAgent, specialist, confidence }>}
 */
export function getAgentSuggestions() {
  const patterns = readJSON(PATTERN_KEY, []);
  if (patterns.length < 5) return [];

  // Count combos
  const comboCounts = {};
  for (const p of patterns) {
    const k = comboKey(p.agentId, p.specialistId);
    if (!comboCounts[k]) {
      comboCounts[k] = { agentId: p.agentId, specialistId: p.specialistId, count: 0, categories: {} };
    }
    comboCounts[k].count++;
    const cat = p.category || 'general';
    comboCounts[k].categories[cat] = (comboCounts[k].categories[cat] || 0) + 1;
  }

  const totalPatterns = patterns.length;
  const existingCustom = getCustomAgents();

  const suggestions = [];

  for (const entry of Object.values(comboCounts)) {
    if (entry.count < 5) continue;

    const confidence = entry.count / totalPatterns;
    if (confidence < 0.7) continue;

    // Skip if user already has a custom agent covering this combo
    const alreadyCovered = existingCustom.some(
      a => a.preferredCli === entry.agentId && a.preferredSpecialist === entry.specialistId,
    );
    if (alreadyCovered) continue;

    const agentEntry = CLI_AGENTS.find(a => a.id === entry.agentId);
    const agentName = agentEntry?.name || entry.agentId;
    const topCategory = Object.entries(entry.categories).sort((a, b) => b[1] - a[1])[0]?.[0] || 'general';

    suggestions.push({
      name: `${agentName} for ${topCategory}`,
      description: `You've used ${agentName} with ${entry.specialistId} specialist ${entry.count} times for ${topCategory} tasks`,
      cliAgent: entry.agentId,
      specialist: entry.specialistId,
      confidence,
    });
  }

  // Sort by confidence descending
  return suggestions.sort((a, b) => b.confidence - a.confidence);
}

// ---------------------------------------------------------------------------
// getTopAgents
// ---------------------------------------------------------------------------

/**
 * Returns the top N most-used CLI agent ids based on recorded usage.
 * Used by LearnedAgents to show the "Frequently used" section.
 *
 * @param {number} n
 * @returns {string[]} array of agent ids
 */
export function getTopAgents(n = 3) {
  const usage = readJSON(USAGE_KEY, {});
  return Object.entries(usage)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, n)
    .map(([id]) => id);
}

// ---------------------------------------------------------------------------
// clearAllLearning
// ---------------------------------------------------------------------------

/**
 * Wipe all learned data. Callable from UI for transparency/privacy.
 */
export function clearAllLearning() {
  localStorage.removeItem(USAGE_KEY);
  localStorage.removeItem(PATTERN_KEY);
  localStorage.removeItem(CUSTOM_AGENTS_KEY);
}
