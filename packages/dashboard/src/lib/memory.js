// memory.js — RAG-based memory system for Soupz
// Stores conversation "memory shards" in localStorage for cross-session context retrieval.
// All storage is localStorage only. No server, no Supabase.

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SHARDS_KEY  = 'soupz_memory_shards';
const MAX_SHARDS  = 200;

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

/** Normalise a string into lowercase alpha-numeric tokens for matching. */
function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2); // ignore very short words (a, to, is, ...)
}

// ---------------------------------------------------------------------------
// saveMemoryShard
// ---------------------------------------------------------------------------

/**
 * Create and persist a memory shard.
 *
 * @param {string}   summary      — short description of the conversation
 * @param {string[]} keywords     — relevant keywords for retrieval
 * @param {string}   agentId      — which CLI agent was used
 * @param {string}   category     — topic category (code, design, etc.)
 * @param {number}   messageCount — how many messages the shard covers
 * @returns {object} the new shard
 */
export function saveMemoryShard(summary, keywords, agentId, category, messageCount) {
  const shards = readJSON(SHARDS_KEY, []);

  const shard = {
    id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    summary: (summary || '').trim().slice(0, 500),
    keywords: Array.isArray(keywords)
      ? keywords.map(k => k.toLowerCase().trim()).filter(Boolean)
      : [],
    timestamp: Date.now(),
    agentId: agentId || 'unknown',
    category: category || 'general',
    messageCount: messageCount || 0,
  };

  shards.push(shard);

  // Auto-prune: remove oldest shards when over the limit
  if (shards.length > MAX_SHARDS) {
    shards.sort((a, b) => a.timestamp - b.timestamp);
    shards.splice(0, shards.length - MAX_SHARDS);
  }

  writeJSON(SHARDS_KEY, shards);
  return shard;
}

// ---------------------------------------------------------------------------
// getRelevantMemory
// ---------------------------------------------------------------------------

/**
 * Return the top N shards whose keywords overlap with the prompt.
 * Scoring: number of keyword matches + partial token overlap bonus.
 *
 * @param {string} prompt
 * @param {number} limit
 * @returns {object[]} matched shards, highest score first
 */
export function getRelevantMemory(prompt, limit = 3) {
  const shards = readJSON(SHARDS_KEY, []);
  if (shards.length === 0) return [];

  const promptTokens = tokenize(prompt);
  if (promptTokens.length === 0) return [];

  const scored = shards.map(shard => {
    let score = 0;

    // Exact keyword match (strongest signal)
    for (const kw of shard.keywords) {
      for (const pt of promptTokens) {
        if (kw === pt) {
          score += 3;
        } else if (kw.includes(pt) || pt.includes(kw)) {
          score += 1;
        }
      }
    }

    // Summary token overlap (weaker signal)
    const summaryTokens = tokenize(shard.summary);
    for (const st of summaryTokens) {
      for (const pt of promptTokens) {
        if (st === pt) score += 0.5;
      }
    }

    // Recency boost: shards from the last hour get a small bump
    const ageHours = (Date.now() - shard.timestamp) / 3600000;
    if (ageHours < 1) score += 1;
    else if (ageHours < 24) score += 0.3;

    return { shard, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.shard);
}

// ---------------------------------------------------------------------------
// getAllShards
// ---------------------------------------------------------------------------

/**
 * Return all shards sorted by timestamp descending (newest first).
 * @returns {object[]}
 */
export function getAllShards() {
  return readJSON(SHARDS_KEY, []).sort((a, b) => b.timestamp - a.timestamp);
}

// ---------------------------------------------------------------------------
// deleteMemoryShard
// ---------------------------------------------------------------------------

/**
 * Remove a shard by id.
 * @param {string} id
 */
export function deleteMemoryShard(id) {
  const shards = readJSON(SHARDS_KEY, []).filter(s => s.id !== id);
  writeJSON(SHARDS_KEY, shards);
}

// ---------------------------------------------------------------------------
// clearAllMemory
// ---------------------------------------------------------------------------

/**
 * Wipe all memory shards. Callable from UI for privacy.
 */
export function clearAllMemory() {
  localStorage.removeItem(SHARDS_KEY);
}

// ---------------------------------------------------------------------------
// generateSummaryPrompt
// ---------------------------------------------------------------------------

/**
 * Takes recent messages and returns a prompt string asking the AI to
 * summarise them into a compact memory shard.
 *
 * @param {object[]} messages — array of { role, content } objects
 * @returns {string} the summary prompt
 */
export function generateSummaryPrompt(messages) {
  if (!messages || messages.length === 0) return '';

  const transcript = messages
    .slice(-10) // last 10 messages max
    .map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${(m.content || '').slice(0, 300)}`)
    .join('\n');

  return [
    'Summarise the following conversation in 1-2 sentences.',
    'Also list 3-6 keywords that capture the main topics.',
    'Respond in this exact JSON format: {"summary": "...", "keywords": ["...", "..."]}',
    '',
    transcript,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// getMemoryContext
// ---------------------------------------------------------------------------

/**
 * Returns a formatted string of relevant memories to prepend to the
 * user's prompt, giving the AI cross-session context.
 *
 * Returns empty string when no relevant memories exist.
 *
 * @param {string} prompt
 * @returns {string}
 */
export function getMemoryContext(prompt) {
  const relevant = getRelevantMemory(prompt, 3);
  if (relevant.length === 0) return '';

  const lines = relevant.map((s, i) => {
    const age = formatAge(s.timestamp);
    return `${i + 1}. [${age}] ${s.summary} (keywords: ${s.keywords.join(', ')})`;
  });

  return [
    '[Memory context from previous sessions]',
    ...lines,
    '[End memory context]',
    '',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Internal: formatAge
// ---------------------------------------------------------------------------

function formatAge(timestamp) {
  const diff = Date.now() - timestamp;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);

  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30)  return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}
