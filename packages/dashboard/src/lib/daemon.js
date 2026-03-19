/**
 * Daemon client — communicates with the local soupz daemon
 * via Supabase Realtime relay (for remote/phone access) or
 * direct WebSocket (for local browser access)
 */

import { supabase } from './supabase.js';

const LOCAL_DAEMON_URL = import.meta.env.VITE_DAEMON_URL || 'http://localhost:7533';
let daemonChannel = null;
let responseHandlers = new Map();

/**
 * Send a command to the local daemon.
 * Uses Supabase relay when available (for remote/phone access),
 * falls back to direct HTTP for local browser.
 */
export async function sendCommand(type, payload, userId) {
  const commandId = crypto.randomUUID();

  if (supabase && userId) {
    // Remote access via Supabase relay
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
  } else {
    // Direct local access
    const res = await fetch(`${LOCAL_DAEMON_URL}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: commandId, type, payload }),
    });
    if (!res.ok) throw new Error(`Daemon error: ${res.status}`);
    return commandId;
  }
}

/** Subscribe to daemon responses via Supabase Realtime */
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

/** Check if daemon is reachable locally */
export async function checkDaemonHealth() {
  try {
    const res = await fetch(`${LOCAL_DAEMON_URL}/health`, { signal: AbortSignal.timeout(2000) });
    const data = await res.json();
    return { online: true, version: data.version, machine: data.machine };
  } catch {
    return { online: false };
  }
}

/** Request file tree from daemon */
export async function getFileTree(rootPath, userId) {
  return sendCommand('FILE_TREE', { path: rootPath }, userId);
}

/** Read a file from daemon */
export async function readFile(filePath, userId) {
  return sendCommand('FILE_READ', { path: filePath }, userId);
}

/** Write a file via daemon */
export async function writeFile(filePath, content, userId) {
  return sendCommand('FILE_WRITE', { path: filePath, content }, userId);
}

/** Get git status from daemon */
export async function getGitStatus(repoPath, userId) {
  return sendCommand('GIT_STATUS', { path: repoPath }, userId);
}

/** Git diff for a file */
export async function getGitDiff(filePath, userId) {
  return sendCommand('GIT_DIFF', { path: filePath }, userId);
}

/** Stage a file */
export async function gitStage(filePath, userId) {
  return sendCommand('GIT_STAGE', { path: filePath }, userId);
}

/** Git commit */
export async function gitCommit(message, userId) {
  return sendCommand('GIT_COMMIT', { message }, userId);
}

/** Git push */
export async function gitPush(userId) {
  return sendCommand('GIT_PUSH', {}, userId);
}

/** Send an AI prompt to a specific agent */
export async function sendAgentPrompt(prompt, agentId, mode, userId) {
  return sendCommand('AGENT_PROMPT', { prompt, agentId, mode }, userId);
}
