/**
 * Daemon client — communicates with the local soupz daemon
 * via direct WebSocket (local browser) or Supabase Realtime (remote/phone)
 */

import { supabase } from './supabase.js';

const DEFAULT_DAEMON_URL = import.meta.env.VITE_DAEMON_URL || 'http://localhost:7533';
const DAEMON_URL_KEY = 'soupz_daemon_url';
const DAEMON_URL_SESSION_KEY = 'soupz_daemon_url_session';
const DAEMON_TOKEN_KEY = 'soupz_daemon_token';
const DAEMON_TOKEN_ISSUED_AT_KEY = 'soupz_daemon_token_issued_at';
const DAEMON_TOKEN_LAST_REFRESH_ATTEMPT_KEY = 'soupz_daemon_token_last_refresh_attempt_at';
const DAEMON_TOKEN_REFRESH_THRESHOLD_MS = 23 * 60 * 60 * 1000;
const DAEMON_TOKEN_REFRESH_COOLDOWN_MS = 5 * 60 * 1000;

export function getDaemonUrl() {
  return localStorage.getItem(DAEMON_URL_KEY)
    || sessionStorage.getItem(DAEMON_URL_SESSION_KEY)
    || DEFAULT_DAEMON_URL;
}

function normalizeDaemonUrl(url) {
  if (!url || typeof url !== 'string') return null;
  let candidate = url.trim();
  if (!candidate) return null;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `http://${candidate}`;
  }
  try {
    const parsed = new URL(candidate);
    return `${parsed.origin}`;
  } catch {
    return null;
  }
}

export function setDaemonUrl(url) {
  const normalized = normalizeDaemonUrl(url);
  if (!normalized) return false;
  localStorage.setItem(DAEMON_URL_KEY, normalized);
  sessionStorage.setItem(DAEMON_URL_SESSION_KEY, normalized);
  return true;
}

export function clearDaemonUrl() {
  localStorage.removeItem(DAEMON_URL_KEY);
  sessionStorage.removeItem(DAEMON_URL_SESSION_KEY);
}

export function getDaemonWsUrl() {
  return getDaemonUrl().replace(/^http/, 'ws');
}

let daemonChannel = null;

// ─── WebSocket singleton ──────────────────────────────────────────────────────
let wsInstance = null;
let wsToken    = null;
let wsUrl      = null;
const wsChunkHandlers = new Map(); // orderId → (chunk, done) => void
const wsMessageSubscribers = new Set();

const INTERNAL_TOOL_TRACE_RE = /^\s*↳\s*[a-z_][\w.-]*\s*\.\.\.\s*$/i;
const BARE_TOOL_TRACE_RE = /^\s*(read_file|write_file|list_directory|list_dir|replace|apply_patch|run_in_terminal|grep_search|file_search|semantic_search|fetch_webpage|get_errors|create_file|create_directory|run_notebook_cell|edit_notebook_file|vscode_[\w.-]+)\s*\.\.\.\s*$/i;
const TOOL_CALL_HEADER_RE = /^\s*(assistant|tool)\s+to=functions\.[\w.-]+/i;

function sanitizeAgentChunk(chunk) {
  const text = String(chunk ?? '');
  if (!text) return '';

  const cleaned = text
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      if (INTERNAL_TOOL_TRACE_RE.test(trimmed)) return false;
      if (BARE_TOOL_TRACE_RE.test(trimmed)) return false;
      if (TOOL_CALL_HEADER_RE.test(trimmed)) return false;
      return true;
    })
    .join('\n');

  return cleaned;
}

function emitWsMessage(msg) {
  for (const handler of wsMessageSubscribers) {
    try {
      handler?.(msg);
    } catch {
      // Ignore subscriber errors so one bad listener does not break streaming.
    }
  }
}

export function subscribeDaemonMessages(handler) {
  if (typeof handler !== 'function') return () => {};
  wsMessageSubscribers.add(handler);
  return () => wsMessageSubscribers.delete(handler);
}

function getStoredToken() {
  return localStorage.getItem(DAEMON_TOKEN_KEY)
    || sessionStorage.getItem(DAEMON_TOKEN_KEY);
}

function getStoredTokenIssuedAt() {
  const raw = localStorage.getItem(DAEMON_TOKEN_ISSUED_AT_KEY)
    || sessionStorage.getItem(DAEMON_TOKEN_ISSUED_AT_KEY);
  const parsed = Number.parseInt(raw || '', 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function setDaemonToken(token, issuedAt = Date.now()) {
  if (!token) return;
  const issued = Number.isFinite(issuedAt) ? issuedAt : Date.now();
  localStorage.setItem(DAEMON_TOKEN_KEY, token);
  sessionStorage.setItem(DAEMON_TOKEN_KEY, token);
  localStorage.setItem(DAEMON_TOKEN_ISSUED_AT_KEY, String(issued));
  sessionStorage.setItem(DAEMON_TOKEN_ISSUED_AT_KEY, String(issued));
}

export function clearDaemonToken() {
  localStorage.removeItem(DAEMON_TOKEN_KEY);
  sessionStorage.removeItem(DAEMON_TOKEN_KEY);
  localStorage.removeItem(DAEMON_TOKEN_ISSUED_AT_KEY);
  sessionStorage.removeItem(DAEMON_TOKEN_ISSUED_AT_KEY);
  localStorage.removeItem(DAEMON_TOKEN_LAST_REFRESH_ATTEMPT_KEY);
  sessionStorage.removeItem(DAEMON_TOKEN_LAST_REFRESH_ATTEMPT_KEY);
}

function setLastRefreshAttempt(at = Date.now()) {
  localStorage.setItem(DAEMON_TOKEN_LAST_REFRESH_ATTEMPT_KEY, String(at));
  sessionStorage.setItem(DAEMON_TOKEN_LAST_REFRESH_ATTEMPT_KEY, String(at));
}

function getLastRefreshAttempt() {
  const raw = localStorage.getItem(DAEMON_TOKEN_LAST_REFRESH_ATTEMPT_KEY)
    || sessionStorage.getItem(DAEMON_TOKEN_LAST_REFRESH_ATTEMPT_KEY);
  const parsed = Number.parseInt(raw || '', 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function refreshDaemonToken({ force = false } = {}) {
  const currentToken = getStoredToken();
  if (!currentToken) return { ok: false, skipped: true, reason: 'missing-token' };

  const now = Date.now();
  if (!force) {
    const ageMs = now - getStoredTokenIssuedAt();
    const sinceLastAttempt = now - getLastRefreshAttempt();
    if (ageMs > 0 && ageMs < DAEMON_TOKEN_REFRESH_THRESHOLD_MS) {
      return { ok: false, skipped: true, reason: 'fresh-token' };
    }
    if (sinceLastAttempt > 0 && sinceLastAttempt < DAEMON_TOKEN_REFRESH_COOLDOWN_MS) {
      return { ok: false, skipped: true, reason: 'cooldown' };
    }
  }

  setLastRefreshAttempt(now);

  try {
    const res = await fetch(`${getDaemonUrl()}/api/session/refresh-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Soupz-Token': currentToken,
      },
      body: JSON.stringify({ force }),
    });

    if (res.status === 401) {
      clearDaemonToken();
      disconnectDaemonWS();
      return { ok: false, skipped: false, reason: 'unauthorized' };
    }

    if (!res.ok) {
      return { ok: false, skipped: false, reason: `http-${res.status}` };
    }

    const body = await res.json().catch(() => null);
    const nextToken = body?.token || currentToken;
    const issuedAt = Number.parseInt(body?.createdAt, 10);
    setDaemonToken(nextToken, Number.isFinite(issuedAt) ? issuedAt : Date.now());
    return {
      ok: true,
      refreshed: !!body?.refreshed,
      token: nextToken,
      expiresIn: body?.expiresIn,
    };
  } catch {
    return { ok: false, skipped: false, reason: 'network' };
  }
}

export function connectDaemonWS(token) {
  const t = token || getStoredToken();
  const daemonUrl = getDaemonUrl();
  const isLocalDaemon = daemonUrl.includes('localhost') || daemonUrl.includes('127.0.0.1');
  if (!t && !isLocalDaemon) return null;

  const nextWsUrl = getDaemonWsUrl();
  if (wsInstance && wsInstance.readyState <= 1 && wsToken === (t || null) && wsUrl === nextWsUrl) return wsInstance;

  const ws = new WebSocket(nextWsUrl);
  wsToken = t || null;
  wsUrl = nextWsUrl;
  wsInstance = ws;

  ws.onopen = () => {
    wsReconnectAttempts = 0;
    wsDisconnectedIntentionally = false;
    ws.send(JSON.stringify({ type: 'auth', token: t || undefined, clientType: 'browser' }));
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      emitWsMessage(msg);

      if (typeof window !== 'undefined' && msg.type === 'order_update') {
        window.dispatchEvent(new CustomEvent('soupz_order_update', { detail: msg.data || null }));
      }

      if (msg.type === 'agent_chunk') {
        const handler = wsChunkHandlers.get(msg.orderId) || wsChunkHandlers.get('*');
        const safeChunk = sanitizeAgentChunk(msg.chunk);
        if (safeChunk) handler?.(safeChunk, false);
      } else if (msg.type === 'order_update' && (msg.data?.status === 'completed' || msg.data?.status === 'failed')) {
        const handler = wsChunkHandlers.get(msg.data.id) || wsChunkHandlers.get('*');
        handler?.('', true); // signal done
        // Clean up handlers for this order
        wsChunkHandlers.delete(msg.data.id);
        wsChunkHandlers.delete('*');
      }
    } catch { /* ignore parse errors */ }
  };

  ws.onerror = () => { wsInstance = null; wsToken = null; wsUrl = null; };
  ws.onclose = () => {
    wsInstance = null; wsToken = null; wsUrl = null;
    scheduleWsReconnect();
  };

  return ws;
}

// ─── WebSocket auto-reconnect ────────────────────────────────────────────────
let wsReconnectTimer = null;
let wsReconnectAttempts = 0;
const WS_RECONNECT_BASE_MS = 3000;
const WS_RECONNECT_MAX_MS = 30000;

function scheduleWsReconnect() {
  if (wsReconnectTimer || wsDisconnectedIntentionally) return;
  const delay = Math.min(WS_RECONNECT_BASE_MS * Math.pow(1.5, wsReconnectAttempts), WS_RECONNECT_MAX_MS);
  wsReconnectTimer = setTimeout(() => {
    wsReconnectTimer = null;
    wsReconnectAttempts++;
    connectDaemonWS();
  }, delay);
}

let wsDisconnectedIntentionally = false;

export function disconnectDaemonWS() {
  wsDisconnectedIntentionally = true;
  if (wsReconnectTimer) { clearTimeout(wsReconnectTimer); wsReconnectTimer = null; }
  wsInstance?.close();
  wsInstance = null;
  wsToken = null;
  wsUrl = null;
}

if (typeof window !== 'undefined') {
  const refreshOnActive = () => { void refreshDaemonToken(); };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshOnActive();
  });
  window.addEventListener('focus', refreshOnActive);
  setInterval(() => { void refreshDaemonToken(); }, 15 * 60 * 1000);
}

export function getWSState() {
  if (!wsInstance) return 'disconnected';
  const state = wsInstance.readyState;
  if (state === 0) return 'connecting';
  if (state === 1) return 'connected';
  if (state === 2) return 'closing';
  return 'disconnected';
}

// ─── Dev server detection ────────────────────────────────────────────────────

/**
 * Detect a running dev server on the connected machine for live preview.
 * @returns {Promise<{ url: string, detected: boolean } | null>}
 */
export async function getDevServerUrl(cwd = '') {
  const t = getStoredToken();
  if (!t && !isLocalDaemon()) return null;
  try {
    const suffix = cwd ? `?cwd=${encodeURIComponent(cwd)}` : '';
    const res = await fetch(`${getDaemonUrl()}/api/dev-server${suffix}`, {
      headers: t ? { 'X-Soupz-Token': t } : {},
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.detected ? data : null;
  } catch {
    return null;
  }
}

// ─── Agent availability ───────────────────────────────────────────────────────

/**
 * List directories on the connected machine for folder picker (Cmd+O).
 * @param {string} [path] - directory to list (defaults to home dir)
 * @returns {Promise<{ current: string, parent: string, dirs: Array, isGitRepo: boolean }>}
 */
export async function listDirectories(path) {
  const t = getStoredToken();
  if (!t) return null;
  try {
    const url = `${getDaemonUrl()}/api/fs/dirs${path ? `?path=${encodeURIComponent(path)}` : ''}`;
    const res = await fetch(url, {
      headers: { 'X-Soupz-Token': t },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Initialize a new project directory.
 */
export async function initProject({ name, path, supabase, github }) {
  const t = getStoredToken();
  if (!t) return null;
  try {
    const res = await fetch(`${getDaemonUrl()}/api/fs/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Soupz-Token': t,
      },
      body: JSON.stringify({ name, path, supabase, github }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Initialization failed');
    }
    return await res.json();
  } catch (err) {
    throw err;
  }
}

/**
 * Check which CLI agents are installed on the host machine.
 * @returns {Promise<Record<string, boolean>>}
 */
export async function checkAgentAvailability() {
  try {
    const res = await fetch(`${getDaemonUrl()}/api/agents?detailed=true`, {
    });
    if (!res.ok) {
      return {
        ok: false,
        error: `http-${res.status}`,
        simple: {},
        detailed: null,
        available: [],
      };
    }
    const data = await res.json();
    if (data?.agents) {
      const simple = {};
      for (const [id, details] of Object.entries(data.agents)) {
        simple[id] = !!details.ready;
      }
      return {
        ok: true,
        simple,
        detailed: data.agents,
        available: data.available || Object.keys(simple).filter(key => simple[key]),
      };
    }
    const fallback = data || {};
    return {
      ok: true,
      simple: fallback,
      detailed: null,
      available: Object.keys(fallback).filter(key => fallback[key]),
    };
  } catch {
    return {
      ok: false,
      error: 'network',
      simple: {},
      detailed: null,
      available: [],
    };
  }
}

export async function getAgentModels({ refresh = false } = {}) {
  const t = getStoredToken();
  if (!t && !isLocalDaemon()) return {};
  try {
    if (refresh) {
      await fetch(`${getDaemonUrl()}/api/models/refresh`, {
        method: 'POST',
        headers: t ? { 'X-Soupz-Token': t } : {},
      });
    }
    const res = await fetch(`${getDaemonUrl()}/api/models`, {
      headers: t ? { 'X-Soupz-Token': t } : {},
    });
    if (!res.ok) return {};
    const body = await res.json();
    return body?.agents || {};
  } catch {
    return {};
  }
}

// ─── Health ───────────────────────────────────────────────────────────────────

export async function checkDaemonHealth() {
  try {
    const res = await fetch(`${getDaemonUrl()}/health`);
    const data = await res.json();
    return { online: true, version: data.version, machine: data.hostname || data.machine };
  } catch {
    return { online: false };
  }
}

// ─── Agent prompt with streaming ─────────────────────────────────────────────

/**
 * Send an AI prompt. Streams chunks via WebSocket if connected locally,
 * falls back to Supabase relay for remote access.
 * @param {{prompt: string, agentId?: string, specialist?: string, temperature?: number, maxTokens?: number, allowedAgents?: string[], buildMode?: string, cwd?: string, orchestrationMode?: string, workerCount?: number, sameAgentOnly?: boolean, primaryCopies?: number, selectedModel?: string, agentModels?: Record<string,string>, images?: Array}} request
 * @param {string} userId
 * @param {(chunk: string, done: boolean) => void} onChunk
 */
export async function sendAgentPrompt(request, userId, onChunk) {
  const prompt = request?.prompt || '';
  const agentId = request?.agentId || 'auto';
  const specialist = request?.specialist || undefined;
  const temperature = typeof request?.temperature === 'number' ? request.temperature : undefined;
  const maxTokens = typeof request?.maxTokens === 'number' ? request.maxTokens : undefined;
  const allowedAgents = Array.isArray(request?.allowedAgents) ? request.allowedAgents : undefined;
  const mode = request?.buildMode || 'balanced';
  const cwd = request?.cwd;
  const orchestrationMode = request?.orchestrationMode;
  const workerCount = request?.workerCount;
  const sameAgentOnly = request?.sameAgentOnly;
  const primaryCopies = request?.primaryCopies;
  const selectedModel = typeof request?.selectedModel === 'string' ? request.selectedModel.trim() : '';
  const agentModels = request?.agentModels && typeof request.agentModels === 'object'
    ? Object.fromEntries(Object.entries(request.agentModels)
      .map(([id, model]) => [String(id || '').trim(), String(model || '').trim()])
      .filter(([id, model]) => id && model))
    : undefined;
  const useAiPlanner = typeof request?.useAiPlanner === 'boolean' ? request.useAiPlanner : undefined;
  const plannerStyle = request?.plannerStyle;
  const plannerNotes = request?.plannerNotes;
  const images = Array.isArray(request?.images) ? request.images : undefined;
  const returnOrderImmediately = request?.returnOrderImmediately === true;
  const token = getStoredToken();
  const daemonUrl = getDaemonUrl();
  const localDaemon = daemonUrl.includes('localhost') || daemonUrl.includes('127.0.0.1');
  const isLocal = !!token || localDaemon; // has a paired session token or is running on localhost

  if (isLocal) {
    // Connect/reuse WS
    const ws = connectDaemonWS(token); // For local access without token, daemon will accept it if IP is localhost

    if (ws && ws.readyState <= 1) {
      // Wait for WS to be ready
      await new Promise((resolve) => {
        if (ws.readyState === 1) return resolve();
        ws.addEventListener('open', resolve, { once: true });
        ws.addEventListener('error', resolve, { once: true });
      });
    }

    // Submit order via REST (uses authenticated endpoint)
    return new Promise(async (resolve, reject) => {
      try {
        const res = await fetch(`${daemonUrl}/api/orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Soupz-Token': token,
          },
          body: JSON.stringify((() => {
            const mcpServers = (() => {
              try { return JSON.parse(localStorage.getItem('soupz_mcp_servers') || '[]'); } catch { return []; }
            })();
            const payload = { prompt, agent: agentId, modelPolicy: mode || 'balanced' };
            if (Array.isArray(allowedAgents)) payload.allowedAgents = allowedAgents;
            if (specialist) payload.specialist = specialist;
            if (typeof temperature === 'number') payload.temperature = temperature;
            if (typeof maxTokens === 'number') payload.maxTokens = maxTokens;
            if (cwd) payload.cwd = cwd;
            if (orchestrationMode) payload.orchestrationMode = orchestrationMode;
            if (Number.isFinite(workerCount)) payload.workerCount = workerCount;
            if (typeof sameAgentOnly === 'boolean') payload.sameAgentOnly = sameAgentOnly;
            if (Number.isFinite(primaryCopies)) payload.primaryCopies = primaryCopies;
            if (selectedModel) payload.selectedModel = selectedModel;
            if (agentModels && Object.keys(agentModels).length > 0) payload.agentModels = agentModels;
            if (typeof useAiPlanner === 'boolean') payload.useAiPlanner = useAiPlanner;
            if (typeof plannerStyle === 'string' && plannerStyle.trim()) payload.plannerStyle = plannerStyle.trim();
            if (typeof plannerNotes === 'string' && plannerNotes.trim()) payload.plannerNotes = plannerNotes.trim().slice(0, 4000);
            if (mcpServers.length > 0) payload.mcpServers = mcpServers;
            if (Array.isArray(images) && images.length > 0) payload.images = images;
            return payload;
          })()),
        });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Order creation failed (${res.status}): ${body}`);
        }

        const payload = await res.json();
        const order = payload?.order || payload;
        let settled = false;
        const settle = (value) => {
          if (settled) return;
          settled = true;
          resolve(value);
        };

        if (onChunk && order?.id) {
          // Register chunk handler for this order
          wsChunkHandlers.set(order.id, (chunk, done) => {
            if (done) {
              try { onChunk('', true); } catch { /* ignore callback errors */ }
              settle(order.id);
            } else {
              onChunk(chunk, false);
            }
          });
          wsChunkHandlers.set('*', (chunk, done) => {
            if (done) {
              try { onChunk('', true); } catch { /* ignore callback errors */ }
              settle(order.id);
            } else {
              onChunk(chunk, false);
            }
          }); // fallback for unkeyed messages

          if (returnOrderImmediately) {
            settle(order.id);
          }
        } else {
          settle(order?.id);
        }
      } catch (err) {
        reject(new Error(`Daemon error: ${err.message}`));
      }
    });
  }

  // Remote path via Supabase relay
  if (supabase && userId) {
    return new Promise(async (resolve, reject) => {
      try {
        const commandPayload = { prompt, agentId, mode };
        if (selectedModel) commandPayload.selectedModel = selectedModel;
        if (agentModels && Object.keys(agentModels).length > 0) commandPayload.agentModels = agentModels;
        const commandId = await sendCommand('AGENT_PROMPT', commandPayload, userId);
        if (onChunk) {
          const unsub = subscribeToChunks(commandId, (chunk) => {
            const safeChunk = sanitizeAgentChunk(chunk);
            if (safeChunk) onChunk(safeChunk);
          });
          // Relay path has no guaranteed done signal yet; resolve immediately and keep streaming.
          void unsub;
          resolve(commandId);
        } else {
          resolve(commandId);
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  throw new Error('Not connected — run npx soupz on your machine first');
}

// ─── Generic command (Supabase relay) ────────────────────────────────────────

export async function sendCommand(type, payload, userId) {
  const commandId = crypto.randomUUID();

  if (supabase && userId) {
    const { error } = await supabase.from('soupz_commands').insert({
      id: commandId,
      user_id: userId,
      type,
      payload,
      status: 'pending',
      created_at: new Date().toISOString(),
    });
    if (error) throw new Error(`Relay error: ${error.message}`);
    return commandId;
  }

  const token = getStoredToken();
  if (!token) throw new Error('Not authenticated with daemon');

  const res = await fetch(`${getDaemonUrl()}/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Soupz-Token': token },
    body: JSON.stringify({ id: commandId, type, payload }),
  });
  if (!res.ok) throw new Error(`Daemon error: ${res.status}`);
  return commandId;
}

// ─── Real-time streaming ─────────────────────────────────────────────────────

export function subscribeToChunks(commandId, onChunk) {
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`chunks:${commandId}`)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'soupz_output_chunks',
      filter: `order_id=eq.${commandId}`,
    }, (payload) => {
      onChunk(payload.new.chunk);
    })
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// ─── Supabase relay subscription ─────────────────────────────────────────────

export function subscribeToDaemon(userId, onMessage) {
  if (!supabase || !userId) return () => {};

  daemonChannel = supabase
    .channel(`soupz:${userId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'soupz_responses',
      filter: `user_id=eq.${userId}`,
    }, (payload) => {
      onMessage(payload.new);
    })
    .subscribe();

  return () => {
    if (daemonChannel) supabase.removeChannel(daemonChannel);
  };
}

// ─── Order history (for Agent Dashboard) ─────────────────────────────────────

export async function getOrders() {
  const t = getStoredToken();
  if (!t && !isLocalDaemon()) return [];
  try {
    const res = await fetch(`${getDaemonUrl()}/api/orders`, {
      headers: t ? { 'X-Soupz-Token': t } : {},
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.orders || [];
  } catch {
    return [];
  }
}

export async function getOrderDetail(orderId) {
  const t = getStoredToken();
  if (!t && !isLocalDaemon()) return null;
  try {
    const res = await fetch(`${getDaemonUrl()}/api/orders/${orderId}`, {
      headers: t ? { 'X-Soupz-Token': t } : {},
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data || null;
  } catch {
    return null;
  }
}

export async function submitOrderInput(orderId, answers) {
  const t = getStoredToken();
  if (!t && !isLocalDaemon()) return null;
  try {
    const res = await fetch(`${getDaemonUrl()}/api/orders/${orderId}/input`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(t ? { 'X-Soupz-Token': t } : {}),
      },
      body: JSON.stringify({ answers: answers || {} }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Failed to submit input (${res.status}): ${body}`);
    }
    return await res.json();
  } catch (err) {
    throw err;
  }
}

/**
 * Cancel a running order
 * @param {string} orderId - The order ID to cancel
 * @returns {Promise<{ success: boolean, message?: string }>}
 */
export async function cancelOrder(orderId) {
  const t = getStoredToken();
  if (!t && !isLocalDaemon()) throw new Error('Not authenticated');
  try {
    const res = await fetch(`${getDaemonUrl()}/api/orders/${orderId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(t ? { 'X-Soupz-Token': t } : {}),
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Failed to cancel order (${res.status}): ${body}`);
    }
    return await res.json();
  } catch (err) {
    throw err;
  }
}

/**
 * Check which system CLIs are installed (git, docker, etc)
 * @returns {Promise<Array<{ name: string, installed: boolean, version?: string }>>}
 */
export async function checkSystemCLIs() {
  const t = getStoredToken();
  if (!t) return [];
  try {
    const res = await fetch(`${getDaemonUrl()}/api/system/check-clis`, {
      headers: { 'X-Soupz-Token': t },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Object.entries(data).map(([name, info]) => ({ name, ...info }));
  } catch {
    return [];
  }
}

/**
 * Install or update a system CLI via the daemon.
 * @param {string} name - cli name (e.g. 'git')
 * @param {'install'|'update'} action
 * @returns {Promise<{ success: boolean, output?: string }>}
 */
export async function manageSystemCLI(name, action = 'install') {
  const t = getStoredToken();
  if (!t) throw new Error('Not authenticated');
  try {
    const res = await fetch(`${getDaemonUrl()}/api/system/manage-cli`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Soupz-Token': t,
      },
      body: JSON.stringify({ cli: name, action }),
    });
    const data = await res.json().catch(() => ({ success: false }));
    if (!res.ok || data?.success === false) {
      const message = data?.error || data?.output || `Failed to ${action} ${name}`;
      return { success: false, error: message };
    }
    return { success: true, output: data?.output || '' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ─── FS & Git helpers ─────────────────────────────────────────────────────────

const token = () => getStoredToken();

const isLocalDaemon = () => {
  const url = getDaemonUrl();
  return url.includes('localhost') || url.includes('127.0.0.1');
};

async function localGet(path) {
  const t = token();
  const res = await fetch(`${getDaemonUrl()}${path}`, {
    headers: t ? { 'X-Soupz-Token': t } : {},
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function localPost(path, body) {
  const t = token();
  const res = await fetch(`${getDaemonUrl()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(t ? { 'X-Soupz-Token': t } : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function localDelete(path) {
  const t = token();
  const res = await fetch(`${getDaemonUrl()}${path}`, {
    method: 'DELETE',
    headers: t ? { 'X-Soupz-Token': t } : {},
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export async function listTerminals() {
  if (token() || isLocalDaemon()) {
    return localGet('/terminals');
  }
  throw new Error('Terminal monitoring is only available via direct daemon connection');
}

export async function killTerminalById(terminalId) {
  if (token() || isLocalDaemon()) {
    return localDelete(`/terminals/${encodeURIComponent(String(terminalId))}`);
  }
  throw new Error('Terminal kill is only available via direct daemon connection');
}

export async function getFileTree(rootPath, userId) {
  if (token() || isLocalDaemon()) {
    try {
      return await localGet(`/api/fs/tree${rootPath ? `?root=${encodeURIComponent(rootPath)}` : ''}`);
    } catch (e) {
      if (!userId) throw e;
      // Fall through to GitHub if local fails and we have a user
    }
  }
  
  // GitHub Fallback: Use the mirror API if daemon is offline
  if (userId) {
    try {
      return await localGet('/api/git/mirror/manifest');
    } catch {
      return sendCommand('FILE_TREE', { path: rootPath }, userId);
    }
  }
  return sendCommand('FILE_TREE', { path: rootPath }, userId);
}

export async function readFile(filePath, userId, rootPath) {
  const rootQuery = rootPath ? `&root=${encodeURIComponent(rootPath)}` : '';
  if (token() || isLocalDaemon()) {
    try {
      const res = await localGet(`/api/fs/file?path=${encodeURIComponent(filePath)}${rootQuery}`);
      return res?.content || '';
    } catch (e) {
      if (!userId) throw e;
    }
  }

  // GitHub Fallback
  if (userId) {
    try {
      const res = await localGet(`/api/git/mirror/file?path=${encodeURIComponent(filePath)}`);
      return res?.content || '';
    } catch {
      return sendCommand('FILE_READ', { path: filePath, root: rootPath }, userId);
    }
  }
  return sendCommand('FILE_READ', { path: filePath, root: rootPath }, userId);
}

export async function writeFile(filePath, content, userId, rootPath) {
  if (token() || isLocalDaemon()) return localPost('/api/fs/file', { path: filePath, content, root: rootPath });
  return sendCommand('FILE_WRITE', { path: filePath, content, root: rootPath }, userId);
}

export async function getGitStatus(repoPath, userId, rootPath) {
  const rootQuery = rootPath ? `?root=${encodeURIComponent(rootPath)}` : '';
  if (token() || isLocalDaemon()) return localGet(`/api/changes${rootQuery}`);
  return sendCommand('GIT_STATUS', { path: repoPath, root: rootPath }, userId);
}

export async function getGitDiff(filePath, userId, rootPath) {
  const params = new URLSearchParams();
  if (filePath) params.set('file', filePath);
  if (rootPath) params.set('root', rootPath);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  if (token() || isLocalDaemon()) return localGet(`/api/changes/diff${suffix}`);
  return sendCommand('GIT_DIFF', { path: filePath, root: rootPath }, userId);
}

export async function getGitFileVersion(filePath, ref = 'HEAD', userId, rootPath) {
  const params = new URLSearchParams();
  if (filePath) params.set('file', filePath);
  if (ref) params.set('ref', ref);
  if (rootPath) params.set('root', rootPath);
  const suffix = params.toString() ? `?${params.toString()}` : '';

  if (token() || isLocalDaemon()) {
    const res = await localGet(`/api/git/file-version${suffix}`);
    return res?.content || '';
  }

  return '';
}

export async function gitStage(filePath, userId, rootPath) {
  if (token() || isLocalDaemon()) return localPost('/api/git/stage', { path: filePath, root: rootPath });
  return sendCommand('GIT_STAGE', { path: filePath, root: rootPath }, userId);
}

export async function gitCommit(message, userId, rootPath) {
  if (token() || isLocalDaemon()) return localPost('/api/git/commit', { message, root: rootPath });
  return sendCommand('GIT_COMMIT', { message, root: rootPath }, userId);
}

export async function gitPush(userId, rootPath) {
  if (token() || isLocalDaemon()) return localPost('/api/git/push', { root: rootPath });
  return sendCommand('GIT_PUSH', { root: rootPath }, userId);
}

export async function fetchBranches(rootPath, userId) {
  const suffix = rootPath ? `?cwd=${encodeURIComponent(rootPath)}` : '';
  if (token() || isLocalDaemon()) return localGet(`/api/git/branch${suffix}`);
  return sendCommand('GIT_BRANCHES', { root: rootPath }, userId);
}

export async function getGitLog(rootPath, userId, limit = 8) {
  const params = new URLSearchParams();
  if (rootPath) params.set('root', rootPath);
  if (Number.isFinite(limit)) params.set('limit', String(limit));
  const suffix = params.toString() ? `?${params.toString()}` : '';

  if (token() || isLocalDaemon()) return localGet(`/api/git/log${suffix}`);
  return { commits: [] };
}

export async function checkoutBranch(branch, userId, rootPath) {
  if (token() || isLocalDaemon()) return localPost('/api/git/checkout', { branch, root: rootPath, cwd: rootPath });
  return sendCommand('GIT_CHECKOUT', { branch, root: rootPath }, userId);
}

export async function runFile(path, userId, rootPath) {
  if (token() || isLocalDaemon()) return localPost('/api/exec', { path, root: rootPath });
  return sendCommand('RUN_FILE', { path, root: rootPath }, userId);
}
