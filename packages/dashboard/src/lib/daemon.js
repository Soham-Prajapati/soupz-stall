/**
 * Daemon client — communicates with the local soupz daemon
 * via direct WebSocket (local browser) or Supabase Realtime (remote/phone)
 */

import { supabase } from './supabase.js';

const LOCAL_DAEMON_URL  = import.meta.env.VITE_DAEMON_URL || 'http://localhost:7533';
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
      } else if (msg.type === 'order_update' && msg.data?.status === 'completed') {
        const handler = wsChunkHandlers.get(msg.data.id) || wsChunkHandlers.get('*');
        handler?.('', true); // signal done
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

// ─── Agent availability ───────────────────────────────────────────────────────

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
  const isLocal = !!token; // has a paired session token

  if (isLocal) {
    // Connect/reuse WS
    const ws = connectDaemonWS(token);

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
        // Auto-cleanup after 10 minutes
        setTimeout(() => wsChunkHandlers.delete(order.id), 600000);
      }

      return order?.id;
    } catch (err) {
      throw new Error(`Daemon error: ${err.message}`);
    }
  }

  // Remote path via Supabase relay
  if (supabase && userId) {
    return sendCommand('AGENT_PROMPT', { prompt, agentId, mode }, userId);
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

// ─── FS & Git helpers ─────────────────────────────────────────────────────────

const token = () => getStoredToken();

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
  if (token()) return localGet(`/api/fs/tree${rootPath ? `?root=${encodeURIComponent(rootPath)}` : ''}`);
  return sendCommand('FILE_TREE', { path: rootPath }, userId);
}

export async function readFile(filePath, userId) {
  if (token()) return localGet(`/api/fs/file?path=${encodeURIComponent(filePath)}`);
  return sendCommand('FILE_READ', { path: filePath }, userId);
}

export async function writeFile(filePath, content, userId) {
  if (token()) return localPost('/api/fs/file', { path: filePath, content });
  return sendCommand('FILE_WRITE', { path: filePath, content }, userId);
}

export async function getGitStatus(repoPath, userId) {
  if (token()) return localGet('/api/changes');
  return sendCommand('GIT_STATUS', { path: repoPath }, userId);
}

export async function getGitDiff(filePath, userId) {
  if (token()) return localGet(`/api/changes/diff?file=${encodeURIComponent(filePath || '')}`);
  return sendCommand('GIT_DIFF', { path: filePath }, userId);
}

export async function gitStage(filePath, userId) {
  if (token()) return localPost('/api/git/stage', { path: filePath });
  return sendCommand('GIT_STAGE', { path: filePath }, userId);
}

export async function gitCommit(message, userId) {
  if (token()) return localPost('/api/git/commit', { message });
  return sendCommand('GIT_COMMIT', { message }, userId);
}

export async function gitPush(userId) {
  if (token()) return localPost('/api/git/push', {});
  return sendCommand('GIT_PUSH', {}, userId);
}
