/**
 * Daemon client — communicates with the local soupz daemon
 * via direct WebSocket (local browser) or Supabase Realtime (remote/phone)
 */

import { supabase } from './supabase.js';

const DEFAULT_DAEMON_URL = import.meta.env.VITE_DAEMON_URL || 'http://localhost:7533';

function getDaemonUrl() {
  return localStorage.getItem('soupz_daemon_url') || DEFAULT_DAEMON_URL;
}

function getDaemonWsUrl() {
  return getDaemonUrl().replace(/^http/, 'ws');
}

let daemonChannel = null;

// ─── WebSocket singleton ──────────────────────────────────────────────────────
let wsInstance = null;
let wsToken    = null;
let wsUrl      = null;
const wsChunkHandlers = new Map(); // orderId → (chunk, done) => void

function getStoredToken() {
  return localStorage.getItem('soupz_daemon_token')
    || sessionStorage.getItem('soupz_daemon_token');
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
      if (msg.type === 'agent_chunk') {
        const handler = wsChunkHandlers.get(msg.orderId) || wsChunkHandlers.get('*');
        handler?.(msg.chunk, false);
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
export async function getDevServerUrl() {
  const t = getStoredToken();
  if (!t) return null;
  try {
    const res = await fetch(`${getDaemonUrl()}/api/dev-server`, {
      headers: { 'X-Soupz-Token': t },
      signal: AbortSignal.timeout(5000),
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
      signal: AbortSignal.timeout(3000),
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
    const res = await fetch(`${getDaemonUrl()}/api/agents`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

// ─── Health ───────────────────────────────────────────────────────────────────

export async function checkDaemonHealth() {
  try {
    const res = await fetch(`${getDaemonUrl()}/health`, { signal: AbortSignal.timeout(2000) });
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
 * @param {{prompt: string, agentId?: string, specialist?: string, temperature?: number, maxTokens?: number, allowedAgents?: string[], buildMode?: string, cwd?: string, orchestrationMode?: string, workerCount?: number, sameAgentOnly?: boolean, primaryCopies?: number, timeoutMs?: number, images?: Array}} request
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

  // Set default timeouts based on build mode if not provided
  let timeoutMs = request?.timeoutMs;
  if (!Number.isFinite(timeoutMs)) {
    const timeoutDefaults = {
      'quick': 90 * 1000,    // 90 seconds for quick mode
      'planned': 180 * 1000, // 180 seconds for planned mode
      'deep': 300 * 1000,    // 300 seconds for deep mode
    };
    timeoutMs = timeoutDefaults[mode] || 180 * 1000; // default to planned (180s)
  }
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
        setTimeout(resolve, 3000);
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
            if (Number.isFinite(timeoutMs)) payload.timeoutMs = timeoutMs;
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
          
          // Safety cleanup resolving after timeout
          setTimeout(() => {
            wsChunkHandlers.delete(order.id);
            wsChunkHandlers.delete('*');
            settle(order.id);
          }, 300000);
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
        const commandId = await sendCommand('AGENT_PROMPT', { prompt, agentId, mode }, userId);
        if (onChunk) {
          const unsub = subscribeToChunks(commandId, (chunk) => {
            onChunk(chunk);
          });
          // Wait blindly for some time? Remote relay might lack 'done' events. We can just resolve after 300 seconds if it's the only way, but ideally the remote returns a done signal. For now, resolve immediately like it did before, to avoid breaking remote too much, or wait 10s.
          // Wait! The user is local, they connect directly to the daemon.
          setTimeout(() => { unsub(); resolve(commandId); }, 30000);
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
      signal: AbortSignal.timeout(5000),
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
      signal: AbortSignal.timeout(5000),
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
      signal: AbortSignal.timeout(8000),
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
      signal: AbortSignal.timeout(5000),
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
      signal: AbortSignal.timeout(5000),
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
      signal: AbortSignal.timeout(15000),
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
    signal: AbortSignal.timeout(5000),
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
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function localDelete(path) {
  const t = token();
  const res = await fetch(`${getDaemonUrl()}${path}`, {
    method: 'DELETE',
    headers: t ? { 'X-Soupz-Token': t } : {},
    signal: AbortSignal.timeout(8000),
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

export async function checkoutBranch(branch, userId, rootPath) {
  if (token() || isLocalDaemon()) return localPost('/api/git/checkout', { branch, root: rootPath, cwd: rootPath });
  return sendCommand('GIT_CHECKOUT', { branch, root: rootPath }, userId);
}

export async function runFile(path, userId, rootPath) {
  if (token() || isLocalDaemon()) return localPost('/api/exec', { path, root: rootPath });
  return sendCommand('RUN_FILE', { path, root: rootPath }, userId);
}
