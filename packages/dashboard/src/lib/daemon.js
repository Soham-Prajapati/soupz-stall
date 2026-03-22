/**
 * Daemon client — communicates with the local soupz daemon
 * via direct WebSocket (local browser) or Supabase Realtime (remote/phone)
 */

import { supabase } from './supabase.js';

const LOCAL_DAEMON_URL  = localStorage.getItem('soupz_daemon_url') || import.meta.env.VITE_DAEMON_URL || 'http://localhost:7533';
const LOCAL_DAEMON_WS   = LOCAL_DAEMON_URL.replace(/^http/, 'ws');

let daemonChannel = null;

// ─── WebSocket singleton ──────────────────────────────────────────────────────
let wsInstance = null;
let wsToken    = null;
const wsChunkHandlers = new Map(); // orderId → (chunk, done) => void

function getStoredToken() {
  return localStorage.getItem('soupz_daemon_token');
}

export function connectDaemonWS(token) {
  const t = token || getStoredToken();
  if (!t) return null;
  if (wsInstance && wsInstance.readyState <= 1 && wsToken === t) return wsInstance;

  const ws = new WebSocket(LOCAL_DAEMON_WS);
  wsToken = t;
  wsInstance = ws;

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'auth', token: t, clientType: 'browser' }));
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

  ws.onerror = () => { wsInstance = null; };
  ws.onclose = () => { wsInstance = null; };

  return ws;
}

export function disconnectDaemonWS() {
  wsInstance?.close();
  wsInstance = null;
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
    const res = await fetch(`${LOCAL_DAEMON_URL}/api/dev-server`, {
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
    const url = `${LOCAL_DAEMON_URL}/api/fs/dirs${path ? `?path=${encodeURIComponent(path)}` : ''}`;
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
    const res = await fetch(`${LOCAL_DAEMON_URL}/api/fs/init`, {
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
    const res = await fetch(`${LOCAL_DAEMON_URL}/api/agents`, {
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
    const res = await fetch(`${LOCAL_DAEMON_URL}/health`, { signal: AbortSignal.timeout(2000) });
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
 * @param {string} prompt
 * @param {string} agentId
 * @param {string} mode  quick|planned|chat
 * @param {string} userId
 * @param {(chunk: string, done: boolean) => void} onChunk
 */
export async function sendAgentPrompt(prompt, agentId, mode, userId, onChunk) {
  const token = getStoredToken();
  const isLocal = !!token || isLocalDaemon; // has a paired session token or is running on localhost

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
    try {
      const res = await fetch(`${LOCAL_DAEMON_URL}/api/orders`, {
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
          if (mcpServers.length > 0) payload.mcpServers = mcpServers;
          return payload;
        })()),
      });
      const { order } = await res.json();

      if (onChunk && order?.id) {
        // Register chunk handler for this order
        wsChunkHandlers.set(order.id, onChunk);
        wsChunkHandlers.set('*', onChunk); // fallback for unkeyed messages
        // Safety cleanup after 5 minutes (handlers should be removed on completion/failure)
        setTimeout(() => {
          wsChunkHandlers.delete(order.id);
          if (wsChunkHandlers.get('*') === onChunk) wsChunkHandlers.delete('*');
        }, 300000);
      }

      return order?.id;
    } catch (err) {
      throw new Error(`Daemon error: ${err.message}`);
    }
  }

  // Remote path via Supabase relay
  if (supabase && userId) {
    const commandId = await sendCommand('AGENT_PROMPT', { prompt, agentId, mode }, userId);
    if (onChunk) {
      const unsub = subscribeToChunks(commandId, onChunk);
      // Failsafe cleanup
      setTimeout(unsub, 300000); 
    }
    return commandId;
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

  const res = await fetch(`${LOCAL_DAEMON_URL}/command`, {
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
  if (!t) return [];
  try {
    const res = await fetch(`${LOCAL_DAEMON_URL}/api/orders`, {
      headers: { 'X-Soupz-Token': t },
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
  if (!t) return null;
  try {
    const res = await fetch(`${LOCAL_DAEMON_URL}/api/orders/${orderId}`, {
      headers: { 'X-Soupz-Token': t },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.order || null;
  } catch {
    return null;
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
    const res = await fetch(`${LOCAL_DAEMON_URL}/api/system/check-clis`, {
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
    const res = await fetch(`${LOCAL_DAEMON_URL}/api/system/manage-cli`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Soupz-Token': t,
      },
      body: JSON.stringify({ name, action }),
    });
    return await res.json();
  } catch (err) {
    return { success: false, output: err.message };
  }
}

// ─── FS & Git helpers ─────────────────────────────────────────────────────────

const token = () => getStoredToken();

const isLocalDaemon = LOCAL_DAEMON_URL.includes('localhost') || LOCAL_DAEMON_URL.includes('127.0.0.1');

async function localGet(path) {
  const t = token();
  const res = await fetch(`${LOCAL_DAEMON_URL}${path}`, {
    headers: t ? { 'X-Soupz-Token': t } : {},
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function localPost(path, body) {
  const t = token();
  const res = await fetch(`${LOCAL_DAEMON_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(t ? { 'X-Soupz-Token': t } : {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export async function getFileTree(rootPath, userId) {
  if (token() || isLocalDaemon) {
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

export async function readFile(filePath, userId) {
  if (token() || isLocalDaemon) {
    try {
      const res = await localGet(`/api/fs/file?path=${encodeURIComponent(filePath)}`);
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
      return sendCommand('FILE_READ', { path: filePath }, userId);
    }
  }
  return sendCommand('FILE_READ', { path: filePath }, userId);
}

export async function writeFile(filePath, content, userId) {
  if (token() || isLocalDaemon) return localPost('/api/fs/file', { path: filePath, content });
  return sendCommand('FILE_WRITE', { path: filePath, content }, userId);
}

export async function getGitStatus(repoPath, userId) {
  if (token() || isLocalDaemon) return localGet('/api/changes');
  return sendCommand('GIT_STATUS', { path: repoPath }, userId);
}

export async function getGitDiff(filePath, userId) {
  if (token() || isLocalDaemon) return localGet(`/api/changes/diff?file=${encodeURIComponent(filePath || '')}`);
  return sendCommand('GIT_DIFF', { path: filePath }, userId);
}

export async function gitStage(filePath, userId) {
  if (token() || isLocalDaemon) return localPost('/api/git/stage', { path: filePath });
  return sendCommand('GIT_STAGE', { path: filePath }, userId);
}

export async function gitCommit(message, userId) {
  if (token() || isLocalDaemon) return localPost('/api/git/commit', { message });
  return sendCommand('GIT_COMMIT', { message }, userId);
}

export async function gitPush(userId) {
  if (token() || isLocalDaemon) return localPost('/api/git/push', {});
  return sendCommand('GIT_PUSH', {}, userId);
}

export async function runFile(path, userId) {
  if (token() || isLocalDaemon) return localPost('/api/exec', { path });
  return sendCommand('RUN_FILE', { path }, userId);
}
