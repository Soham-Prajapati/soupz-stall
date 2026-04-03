// shared.js — shared state, infrastructure, and cross-cutting utilities
// All modules import from here. This file does NOT import from any module file.

import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join, resolve, relative } from 'path';
import { createClient } from '@supabase/supabase-js';
import os from 'os';
import { execSync, spawn } from 'child_process';

// node-pty is optional — terminal feature won't work if not installed
let pty = null;
try {
    const require = createRequire(import.meta.url);
    pty = require('node-pty');
} catch { /* terminal feature unavailable */ }
export { pty };

// ─── Paths ───────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export const REPO_ROOT = resolve(__dirname, '../../../');
export const CLI_ENTRY = join(REPO_ROOT, 'bin/soupz.js');

// ─── Supabase ─────────────────────────────────────────────────────────────────

export const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
export const SUPABASE_TABLE = process.env.SOUPZ_SUPABASE_ORDERS_TABLE || 'soupz_orders';
export const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
    : null;

// ─── Infrastructure ───────────────────────────────────────────────────────────

export const DEFAULT_PORT = 7070;
export const app = express();

// Apply middleware BEFORE any module registers routes
app.use(express.json());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, X-Soupz-Token');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

export const server = createServer(app);
export const wss = new WebSocketServer({ server });
wss.on('error', () => {}); // Suppress WSS errors (EADDRINUSE handled on server)

// ─── Mutable runtime state (use ctx.* for cross-module mutable primitives) ───

export const ctx = {
    // Set by startRemoteServer; read by pairing + health
    activePort: DEFAULT_PORT,
    silentMode: false,
    webappBaseUrl: process.env.SOUPZ_APP_URL || 'https://soupz.vercel.app',
    // Managed by pairing.js
    currentPairingCode: null,
    codeRefreshTimer: null,
    codeRefreshCallback: null,
    // Service intervals (managed by index.js)
    healthBroadcastInterval: null,
    sessionCleanupInterval: null,
    dbCleanupInterval: null,
    orderCleanupInterval: null,
    terminalOrphanInterval: null,
    heartbeatInterval: null,
    // File watcher (managed by filesystem.js)
    fileWatcherAbortController: null,
    fileWatcherTask: null,
    // Command listener (managed by index.js)
    commandListenerChannel: null,
    // Runtime services flag (managed by index.js)
    runtimeServicesStarted: false,
};

// ─── Session / pairing state ──────────────────────────────────────────────────

// Active pairing codes: { code: { token, createdAt, expiresAt } }
export const pairingCodes = new Map();
// Active sessions: { token: { createdAt, lastSeen, clientType } }
export const activeSessions = new Map();
// Authenticated WebSocket clients
export const authenticatedClients = new WeakSet();

export const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Tunnel URLs ──────────────────────────────────────────────────────────────

export const runtimeTunnelBaseUrls = new Set();

// ─── Terminal state ───────────────────────────────────────────────────────────

export const MAX_TERMINALS = 5;
export const TERMINAL_BUFFER_MAX_LINES = 10000;
export const TERMINAL_ORPHAN_TIMEOUT_MS = 5 * 60 * 1000;
export const terminals = new Map();
let terminalCounter = 0;
export function nextTerminalId() { return ++terminalCounter; }

// ─── Fleet state ──────────────────────────────────────────────────────────────

// Track active parallel processes (Fleet)
export const activeFleet = new Map(); // commandId -> { agent, prompt, startTime }

// ─── WebSocket connection tracking ───────────────────────────────────────────

export const wsConnectionsPerIp = new Map(); // ip -> count

// ─── Order state ─────────────────────────────────────────────────────────────

export const WEB_AGENT_ALIASES = new Map([
    ['soupz-workflow', 'soupz-soupz'],
    ['codex-cli', 'codex'],
    ['openai-codex', 'codex'],
    ['gqt', 'codex'],
    ['gpt', 'codex'],
    ['code-kito', 'kiro'],
    ['code-kito-cli', 'kiro'],
    ['kito', 'kiro'],
]);

// In-memory order tracking for web dashboard workflow
export const orders = new Map();
let orderCounter = 0;
export function nextOrderId() { return `ord_${++orderCounter}`; }

export const orderRuntimes = new Map(); // orderId -> runtime metadata and child processes
export const ORDER_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour
export const orderMetrics = { total: 0, completed: 0, failed: 0, totalDurationMs: 0, byAgent: {} };

// ─── File cache ───────────────────────────────────────────────────────────────

export const fileCache = new Map(); // path -> { content, size, cachedAt }
export const FILE_CACHE_MAX_SIZE = 5 * 1024 * 1024; // 5MB total
export const FILE_CACHE_MAX_ENTRIES = 50;
export const MAX_FILE_SIZE = 1024 * 1024; // 1MB max for editor
export const IGNORED_DIRS = new Set(['.git', 'node_modules', '.next', 'dist', 'build', '__pycache__', '.DS_Store']);
let fileCacheTotalSize = 0;

// ─── Order concurrency limits ─────────────────────────────────────────────────

export const MAX_CONCURRENT_ORDERS = 5;
export const pendingOrderQueue = [];

// ─── Order processing constants ───────────────────────────────────────────────

export const WORKER_STALL_MS = Math.max(10000, Number.parseInt(process.env.SOUPZ_WORKER_STALL_MS || '45000', 10) || 45000);

export function resolveTimeoutMs(value, fallbackMs = 0) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return Math.max(0, fallbackMs);
    return Math.max(0, parsed);
}

export const DEEP_SYNTHESIS_TIMEOUT_MS = resolveTimeoutMs(process.env.SOUPZ_DEEP_SYNTHESIS_TIMEOUT_MS, 0);
export const DEEP_NESTED_ENABLED_DEFAULT = process.env.SOUPZ_DEEP_NESTED_DEFAULT !== 'false';
export const DEEP_NESTED_MAX_PARENTS = Math.max(1, Number.parseInt(process.env.SOUPZ_DEEP_NESTED_MAX_PARENTS || '3', 10) || 3);
export const DEEP_NESTED_SUBAGENTS_PER_PARENT = Math.max(1, Number.parseInt(process.env.SOUPZ_DEEP_NESTED_SUBAGENTS_PER_PARENT || '2', 10) || 2);
export const DEEP_NESTED_TIMEOUT_MS = Math.max(5000, Number.parseInt(process.env.SOUPZ_DEEP_NESTED_TIMEOUT_MS || '45000', 10) || 45000);
export const DEEP_NESTED_SYNTH_TIMEOUT_MS = Math.max(10000, Number.parseInt(process.env.SOUPZ_DEEP_NESTED_SYNTH_TIMEOUT_MS || '60000', 10) || 60000);
export const ORDER_EVENT_RING_MAX = Math.max(500, Number.parseInt(process.env.SOUPZ_ORDER_EVENT_RING_MAX || '2000', 10) || 2000);
export const AGENT_RUNTIME_PROBE_ENABLED = process.env.SOUPZ_AGENT_RUNTIME_PROBE !== 'false';
export const AGENT_RUNTIME_PROBE_TTL_MS = Math.max(30000, Number.parseInt(process.env.SOUPZ_AGENT_RUNTIME_PROBE_TTL_MS || '180000', 10) || 180000);
export const agentRuntimeProbeCache = new Map();
export const ORDER_LANE_RING_MAX = Math.max(4000, Number.parseInt(process.env.SOUPZ_ORDER_LANE_RING_MAX || '20000', 10) || 20000);
export const OUTPUT_DELTA_EVENT_MIN_MS = Math.max(0, Number.parseInt(process.env.SOUPZ_OUTPUT_DELTA_EVENT_MIN_MS || '250', 10) || 250);
export const ORDER_STREAM_CHUNK_MAX = Math.max(512, Number.parseInt(process.env.SOUPZ_STREAM_CHUNK_MAX || '4096', 10) || 4096);

// ─── Agent constants ──────────────────────────────────────────────────────────

// Agent binary map for checking availability at order time
export const AGENT_BINARY_MAP = {
    'gemini': 'gemini',
    'codex': 'gh',
    'claude-code': 'claude',
    'copilot': 'gh',
    'kiro': 'kiro-cli',
};
const MODEL_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,119}$/;

export function normalizeModelId(value) {
    const trimmed = String(value || '').trim();
    if (!trimmed) return null;
    if (!MODEL_ID_RE.test(trimmed)) return null;
    return trimmed;
}

export function normalizeAgentModelMap(raw) {
    if (!raw || typeof raw !== 'object') return {};
    const normalized = {};
    for (const [agentId, model] of Object.entries(raw)) {
        if (!agentId || !AGENT_BINARY_MAP[agentId]) continue;
        const safeModel = normalizeModelId(model);
        if (safeModel) normalized[agentId] = safeModel;
    }
    return normalized;
}

export function getSelectedModelForAgent(order, agentId) {
    if (!order || !agentId) return null;
    const mapModel = normalizeModelId(order.agentModels?.[agentId]);
    if (mapModel) return mapModel;

    const directModel = normalizeModelId(order.selectedModel);
    if (!directModel) return null;
    if (order.agent === agentId || order.runAgent === agentId) return directModel;
    return null;
}
export const AGENT_BINARY_CANDIDATES = {
    gemini: ['gemini'],
    codex: ['codex', 'codex-cli', 'openai-codex', 'gh'],
    'claude-code': ['claude'],
    copilot: ['copilot', 'gh'],
    kiro: ['kiro-cli', 'kiro'],
};
const CODEX_MODEL_HINTS = String(
    process.env.SOUPZ_CODEX_MODEL_HINTS ||
    'gpt-5.3-codex,gpt-5.1-codex,gpt-5.1-codex-mini,codex'
)
    .split(',')
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean);
const CODEX_RUNTIME_CACHE = { at: 0, status: null };

export const AUTO_ENABLE_KIRO = process.env.SOUPZ_ENABLE_KIRO_AUTO === 'true';
export const DEFAULT_DEEP_WORKERS = Math.max(1, Number.parseInt(process.env.SOUPZ_DEEP_WORKER_COUNT || '4', 10) || 4);
export const DEFAULT_SPECIALIST_SEQUENCE = ['architect', 'researcher', 'strategist', 'pm', 'developer', 'designer', 'qa', 'devops', 'analyst', 'evaluator', 'finance', 'security'];
export const AGENT_SPECIALIST_ALLOWLIST = {
    'codex': new Set(['architect', 'researcher', 'strategist', 'pm', 'developer', 'designer', 'qa', 'devops', 'analyst', 'evaluator', 'finance', 'security']),
    'copilot': new Set(['architect', 'researcher', 'strategist', 'pm', 'developer', 'designer', 'qa', 'devops', 'analyst', 'evaluator', 'finance', 'security']),
    'gemini': new Set(['researcher', 'strategist', 'pm', 'developer', 'designer', 'qa', 'devops', 'analyst', 'evaluator']),
    'claude-code': new Set(['architect', 'researcher', 'strategist', 'pm', 'developer', 'designer', 'qa', 'devops', 'analyst', 'evaluator', 'finance', 'security']),
    'kiro': new Set(['developer', 'qa', 'devops', 'analyst']),
};
export const DEFAULT_SPECIALIST_BY_AGENT = {
    'codex': 'developer',
    'copilot': 'developer',
    'gemini': 'analyst',
    'claude-code': 'architect',
    'kiro': 'devops',
};

// Ordered fallback chain — try free agents first
export const AGENT_FALLBACK_CHAIN = ['gemini', 'codex', 'copilot', 'claude-code'];
const AGENT_RATE_LIMIT_COOLDOWN_MS = 5 * 60 * 1000;
const agentRateLimitCooldowns = new Map(); // agentId -> { until, reason, at }

const AGENT_DETECT_PATH = (() => {
    const existing = String(process.env.PATH || '')
        .split(':')
        .map((entry) => entry.trim())
        .filter(Boolean);

    const extras = [
        '/opt/homebrew/bin',
        '/usr/local/bin',
        '/usr/bin',
        '/bin',
        join(os.homedir(), 'Library/Application Support/Code/User/globalStorage/github.copilot-chat/copilotCli'),
    ];

    return Array.from(new Set([...existing, ...extras])).join(':');
})();

function shellEscape(value) {
    return `'${String(value || '').replace(/'/g, `'\\''`)}'`;
}

function commandExists(commandName) {
    if (!commandName) return false;
    try {
        execSync(`command -v ${shellEscape(commandName)} >/dev/null 2>&1`, {
            timeout: 1200,
            stdio: 'ignore',
            env: {
                ...process.env,
                PATH: AGENT_DETECT_PATH,
            },
        });
        return true;
    } catch {
        return false;
    }
}

export function resolveAgentBinary(agentId) {
    const candidates = AGENT_BINARY_CANDIDATES[agentId] || [AGENT_BINARY_MAP[agentId]].filter(Boolean);
    for (const candidate of candidates) {
        if (commandExists(candidate)) return candidate;
    }
    return null;
}
export const MAX_DEEP_WORKERS = Math.max(
    DEFAULT_DEEP_WORKERS,
    Number.parseInt(process.env.SOUPZ_DEEP_WORKER_MAX || '64', 10) || 64,
);

function getAgentRateLimitCooldown(agentId) {
    const entry = agentRateLimitCooldowns.get(agentId);
    if (!entry) return null;
    if (Date.now() >= entry.until) {
        agentRateLimitCooldowns.delete(agentId);
        return null;
    }
    return entry;
}

export function reportAgentRateLimit(agentId, reason = 'rate_limited') {
    if (!agentId) return;
    agentRateLimitCooldowns.set(agentId, {
        at: Date.now(),
        until: Date.now() + AGENT_RATE_LIMIT_COOLDOWN_MS,
        reason,
    });
}

export function isAgentCoolingDown(agentId) {
    return !!getAgentRateLimitCooldown(agentId);
}

// ─── processOrderQueue — late-bound to avoid circular imports ─────────────────

export const _orderStarters = { single: null, deep: null };

export function getActiveOrderCount() {
    return Array.from(orders.values()).filter(o => o.status === 'running' || o.status === 'pending').length;
}

export function processOrderQueue() {
    if (pendingOrderQueue.length > 0 && getActiveOrderCount() < MAX_CONCURRENT_ORDERS) {
        const nextId = pendingOrderQueue.shift();
        const nextOrder = orders.get(nextId);
        if (nextOrder && nextOrder.status === 'queued') {
            nextOrder.status = 'pending';
            broadcastOrderUpdate(nextOrder);
            const orchestrationMode = nextOrder.orchestrationMode || 'single';
            const mcpServers = nextOrder.mcpServers || [];
            if (orchestrationMode === 'parallel') {
                void _orderStarters.deep?.(nextOrder, nextOrder.runAgent, mcpServers);
            } else {
                _orderStarters.single?.(nextOrder, nextOrder.runAgent, mcpServers);
            }
        }
    }
}

// ─── Order runtime utilities ──────────────────────────────────────────────────

export function createOrderRuntime(order) {
    const runtime = {
        orderId: order.id,
        status: 'running',
        cancelRequested: false,
        cancelReason: '',
        startedAt: Date.now(),
        children: new Map(),
        workerWatchdogs: new Map(),
        outputDeltaBuckets: new Map(),
    };
    orderRuntimes.set(order.id, runtime);
    return runtime;
}

export function getOrderRuntime(orderId) {
    return orderRuntimes.get(orderId) || null;
}

export function cleanupOrderRuntime(orderId) {
    const runtime = orderRuntimes.get(orderId);
    if (!runtime) return;
    for (const timer of runtime.workerWatchdogs.values()) {
        clearInterval(timer);
    }
    runtime.workerWatchdogs.clear();
    orderRuntimes.delete(orderId);
}

export function appendLaneBuffer(order, laneId, text) {
    if (!order.laneBuffers) order.laneBuffers = {};
    const prev = order.laneBuffers[laneId] || '';
    const next = `${prev}${text}`;
    order.laneBuffers[laneId] = next.length > ORDER_LANE_RING_MAX ? next.slice(-ORDER_LANE_RING_MAX) : next;
}

export function toStreamChunk(text) {
    if (!text || text.length <= ORDER_STREAM_CHUNK_MAX) return text;
    const omitted = text.length - ORDER_STREAM_CHUNK_MAX;
    return `${text.slice(0, ORDER_STREAM_CHUNK_MAX)}\n[stream chunk truncated: omitted ${omitted} chars]\n`;
}

export function pushOrderOutputDelta(order, runtime, bucketKey, eventType, data = {}) {
    if (!runtime || !bucketKey || OUTPUT_DELTA_EVENT_MIN_MS <= 0) {
        pushOrderEvent(order, eventType, data);
        return;
    }

    const now = Date.now();
    let bucket = runtime.outputDeltaBuckets.get(bucketKey);
    if (!bucket) {
        bucket = {
            eventType,
            lastEmitAt: 0,
            pendingChars: 0,
            pendingData: {},
        };
        runtime.outputDeltaBuckets.set(bucketKey, bucket);
    }

    bucket.eventType = eventType;
    bucket.pendingChars += Number.isFinite(data.chars) ? data.chars : 0;
    bucket.pendingData = {
        ...bucket.pendingData,
        ...data,
    };

    if ((now - bucket.lastEmitAt) < OUTPUT_DELTA_EVENT_MIN_MS) return;
    pushOrderEvent(order, bucket.eventType, {
        ...bucket.pendingData,
        chars: Math.max(1, bucket.pendingChars),
    });
    bucket.lastEmitAt = now;
    bucket.pendingChars = 0;
    bucket.pendingData = {};
}

export function flushOrderOutputDeltas(order, runtime, bucketPrefix = '') {
    if (!runtime?.outputDeltaBuckets) return;
    for (const [key, bucket] of runtime.outputDeltaBuckets.entries()) {
        if (bucketPrefix && !key.startsWith(bucketPrefix)) continue;
        if (bucket.pendingChars > 0) {
            pushOrderEvent(order, bucket.eventType, {
                ...bucket.pendingData,
                chars: Math.max(1, bucket.pendingChars),
            });
        }
        runtime.outputDeltaBuckets.delete(key);
    }
}

export function setChildFinished(runtime, childKey, exitCode = null) {
    const childMeta = runtime?.children?.get(childKey);
    if (!childMeta) return;
    childMeta.finished = true;
    childMeta.exitCode = exitCode;
    childMeta.finishedAt = Date.now();
}

export function registerOrderChild(runtime, childKey, child, meta = {}) {
    if (!runtime || !child || !childKey) return;
    runtime.children.set(childKey, {
        child,
        childKey,
        kind: meta.kind || 'unknown',
        workerId: meta.workerId || null,
        agent: meta.agent || null,
        startedAt: Date.now(),
        lastOutputAt: Date.now(),
        stalledAt: null,
        finished: false,
        exitCode: null,
    });
}

export function touchOrderChild(runtime, childKey) {
    const childMeta = runtime?.children?.get(childKey);
    if (!childMeta || childMeta.finished) return;
    childMeta.lastOutputAt = Date.now();
}

export function startWorkerWatchdog(order, runtime, childKey, workerMeta) {
    if (!runtime) return;
    const workerId = workerMeta?.workerId;
    if (!workerId) return;
    const timer = setInterval(() => {
        const childMeta = runtime.children.get(childKey);
        if (!childMeta || childMeta.finished) {
            clearInterval(timer);
            runtime.workerWatchdogs.delete(childKey);
            return;
        }
        const elapsedSinceOutput = Date.now() - (childMeta.lastOutputAt || childMeta.startedAt || Date.now());
        if (elapsedSinceOutput >= WORKER_STALL_MS && !childMeta.stalledAt) {
            childMeta.stalledAt = Date.now();
            pushOrderEvent(order, 'worker.stalled', {
                workerId,
                workerLabel: workerMeta.workerLabel,
                specialist: workerMeta.specialist,
                focus: workerMeta.focus,
                agent: workerMeta.agent,
                role: workerMeta.role,
                stalledAfterMs: elapsedSinceOutput,
            });
            broadcastOrderUpdate(order);
        }
    }, 5000);
    runtime.workerWatchdogs.set(childKey, timer);
}

export function stopWorkerWatchdog(runtime, childKey) {
    const timer = runtime?.workerWatchdogs?.get(childKey);
    if (!timer) return;
    clearInterval(timer);
    runtime.workerWatchdogs.delete(childKey);
}

export function cancelOrderChildren(order, runtime, reason = 'cancel_requested') {
    if (!runtime) return { killed: 0, alreadyExited: 0 };
    runtime.cancelRequested = true;
    runtime.cancelReason = reason;
    let killed = 0;
    let alreadyExited = 0;

    for (const [, childMeta] of runtime.children) {
        if (!childMeta || childMeta.finished) {
            alreadyExited += 1;
            continue;
        }
        try {
            childMeta.child?.kill('SIGTERM');
            killed += 1;
        } catch {
            // Ignore kill failures and continue.
        }
    }

    pushOrderEvent(order, 'order.cancel.requested', { reason, killed, alreadyExited });
    broadcastOrderUpdate(order);
    return { killed, alreadyExited };
}

// ─── File cache utilities ─────────────────────────────────────────────────────

export function getCachedFile(filePath) {
    const entry = fileCache.get(filePath);
    if (!entry) return null;
    // Move to end (most recently used)
    fileCache.delete(filePath);
    fileCache.set(filePath, entry);
    return entry.content;
}

export function setCachedFile(filePath, content) {
    const size = Buffer.byteLength(content, 'utf8');
    // Evict oldest entries until we have room
    while ((fileCacheTotalSize + size > FILE_CACHE_MAX_SIZE || fileCache.size >= FILE_CACHE_MAX_ENTRIES) && fileCache.size > 0) {
        const [oldestKey, oldestEntry] = fileCache.entries().next().value;
        fileCacheTotalSize -= oldestEntry.size;
        fileCache.delete(oldestKey);
    }
    fileCache.set(filePath, { content, size, cachedAt: Date.now() });
    fileCacheTotalSize += size;
}

export function invalidateCachedFile(filePath) {
    const entry = fileCache.get(filePath);
    if (entry) {
        fileCacheTotalSize -= entry.size;
        fileCache.delete(filePath);
    }
}

// ─── Terminal utilities ───────────────────────────────────────────────────────

export function buildTerminalSummary(id, terminal) {
    const startedAt = terminal?.createdAt || Date.now();
    return {
        id,
        pid: terminal?.proc?.pid,
        alive: !!terminal?.proc,
        lines: Array.isArray(terminal?.buffer) ? terminal.buffer.length : 0,
        startedAt,
        ageSec: Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
    };
}

export function terminateTerminal(terminalId) {
    const id = Number.parseInt(String(terminalId), 10);
    if (!Number.isFinite(id)) return { ok: false, reason: 'invalid_id' };
    const terminal = terminals.get(id);
    if (!terminal) return { ok: false, reason: 'not_found' };

    try {
        terminal.proc?.kill();
    } catch {
        // Ignore kill errors and continue cleanup.
    }

    for (const ws of terminal.listeners || []) {
        if (ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'exit', terminalId: id, code: -1, reason: 'terminated' }));
        }
    }

    terminals.delete(id);
    return { ok: true, id };
}

// ─── Fleet management ─────────────────────────────────────────────────────────

export function registerFleet(id, agent, prompt) {
    activeFleet.set(id, { agent, prompt, startTime: Date.now() });
    broadcast({ type: 'fleet_update', active: Array.from(activeFleet.values()) });
}

export function unregisterFleet(id) {
    activeFleet.delete(id);
    broadcast({ type: 'fleet_update', active: Array.from(activeFleet.values()) });
}

// ─── Auth middleware ──────────────────────────────────────────────────────────

export function isLocalRequest(req) {
    const clientIP = req.ip || req.connection?.remoteAddress;
    return clientIP === '127.0.0.1' || clientIP === '::1' || clientIP === '::ffff:127.0.0.1';
}

export function isValidSession(token) {
    const session = activeSessions.get(token);
    if (!session) return false;
    if (Date.now() - session.createdAt > SESSION_EXPIRY_MS) {
        activeSessions.delete(token);
        return false;
    }
    session.lastSeen = Date.now();
    return true;
}

export function revokeSession(token) {
    activeSessions.delete(token);
}

// Middleware: require auth token for REST endpoints (except pairing)
export function requireAuth(req, res, next) {
    // Bypass auth for requests originating from the local machine
    const isLocal = isLocalRequest(req);
    if (isLocal) {
        return next();
    }

    const token = req.headers['x-soupz-token'] || req.query.token;
    if (!token || !isValidSession(token)) {
        return res.status(401).json({ error: 'Unauthorized. Use /pair to get a pairing code.' });
    }
    next();
}

// ─── Broadcast utilities ──────────────────────────────────────────────────────

export function broadcast(msg) {
    const message = JSON.stringify(msg);
    for (const client of wss.clients) {
        try {
            if (client.readyState === 1 && authenticatedClients.has(client)) {
                client.send(message);
            }
        } catch { /* skip failed client */ }
    }
}

// Broadcast order update to all authenticated clients
export function broadcastOrderUpdate(order) {
    const message = JSON.stringify({ type: 'order_update', data: toOrderSummary(order) });
    for (const client of wss.clients) {
        if (client.readyState === 1 && authenticatedClients.has(client)) {
            client.send(message);
        }
    }
}

// ─── Order event utilities ────────────────────────────────────────────────────

export function nowIso() {
    return new Date().toISOString();
}

export function toOrderSummary(order) {
    return {
        id: order.id,
        prompt: order.prompt,
        agent: order.agent,
        runAgent: order.runAgent,
        modelPolicy: order.modelPolicy,
        status: order.status,
        createdAt: order.createdAt,
        startedAt: order.startedAt,
        finishedAt: order.finishedAt,
        durationMs: order.startedAt && order.finishedAt ? (new Date(order.finishedAt).getTime() - new Date(order.startedAt).getTime()) : null,
        eventCount: order.events.length,
        cancelRequested: !!order.cancelRequested,
        createdFiles: Array.isArray(order.createdFiles) ? order.createdFiles : [],
        pendingQuestionCount: Array.isArray(order.pendingQuestions) ? order.pendingQuestions.length : 0,
    };
}

export function pushOrderEvent(order, type, data = {}) {
    const event = {
        type,
        at: nowIso(),
        ...data,
    };
    order.events.push(event);

    const maxEvents = ORDER_EVENT_RING_MAX;
    if (order.events.length <= maxEvents) return;

    const lifecycleTypes = new Set([
        'order.created',
        'route.selected',
        'parallel.plan',
        'artifacts.initialized',
        'artifacts.init_failed',
        'worker.started',
        'worker.stalled',
        'worker.finished',
        'nested.plan',
        'nested.worker.started',
        'nested.worker.finished',
        'nested.synthesis.started',
        'nested.synthesis.finished',
        'nested.failed',
        'parallel.collected',
        'parallel.timeout',
        'synthesis.started',
        'synthesis.finished',
        'synthesis.fallback.used',
        'input.requested',
        'input.received',
        'order.completed',
        'order.failed',
        'order.cancelled',
    ]);

    // Keep critical lifecycle events for UI visibility/debugging by dropping noisy deltas first.
    while (order.events.length > maxEvents) {
        const dropIdx = order.events.findIndex((e) => /\.output\.delta$/.test(String(e.type || '')));
        if (dropIdx >= 0) {
            order.events.splice(dropIdx, 1);
            continue;
        }

        const nonLifecycleIdx = order.events.findIndex((e) => !lifecycleTypes.has(String(e.type || '')));
        if (nonLifecycleIdx >= 0) {
            order.events.splice(nonLifecycleIdx, 1);
            continue;
        }

        // Last resort if everything remaining is lifecycle events.
        order.events.shift();
    }
}

export function toOrderRecord(order) {
    return {
        id: order.id,
        prompt: order.prompt,
        agent: order.agent,
        run_agent: order.runAgent,
        model_policy: order.modelPolicy,
        status: order.status,
        created_at: order.createdAt,
        started_at: order.startedAt,
        finished_at: order.finishedAt,
        duration_ms: order.startedAt && order.finishedAt
            ? (new Date(order.finishedAt).getTime() - new Date(order.startedAt).getTime())
            : null,
        exit_code: order.exitCode,
        stdout: order.stdout,
        stderr: order.stderr,
        events: order.events,
        lane_buffers: order.laneBuffers || {},
    };
}

export async function persistOrder(order) {
    if (!supabase) return;
    try {
        await supabase
            .from(SUPABASE_TABLE)
            .upsert(toOrderRecord(order), { onConflict: 'id' });
    } catch (err) {
        // Non-blocking persistence path; runtime should continue even if DB write fails.
        console.error(`[supabase] order persist failed (${order.id}): ${err.message}`);
    }
}

// ─── Agent utilities ──────────────────────────────────────────────────────────

export function isAgentInstalled(agentId) {
    return !!resolveAgentBinary(agentId);
}

export function normalizeAllowedAgents(input) {
    if (!Array.isArray(input)) return null;
    const normalized = input
        .map((value) => (WEB_AGENT_ALIASES.get(String(value || '').trim()) || String(value || '').trim()))
        .filter((agentId) => Object.prototype.hasOwnProperty.call(AGENT_BINARY_MAP, agentId));
    return Array.from(new Set(normalized));
}

export function resolveRunAgent(requestedAgent, allowedAgents = null) {
    const allowedSet = Array.isArray(allowedAgents) && allowedAgents.length > 0
        ? new Set(allowedAgents)
        : null;
    const isAllowed = (agentId) => !allowedSet || allowedSet.has(agentId);

    // If requested agent is installed, use it
    if (requestedAgent !== 'auto' && isAllowed(requestedAgent) && isAgentInstalled(requestedAgent) && !isAgentCoolingDown(requestedAgent)) {
        const requestedState = getAgentRuntimeReadiness(requestedAgent);
        if (requestedState.ready) {
            return { agent: requestedAgent, fallback: false };
        }
    }
    // Otherwise, walk the fallback chain
    for (const candidate of AGENT_FALLBACK_CHAIN) {
        if (!isAllowed(candidate) || !isAgentInstalled(candidate) || isAgentCoolingDown(candidate)) continue;
        const state = getAgentRuntimeReadiness(candidate);
        if (state.ready) {
            return { agent: candidate, fallback: requestedAgent !== 'auto', originalRequest: requestedAgent };
        }
    }
    // Last resort — try the configured web agent
    const envAgent = (process.env.SOUPZ_WEB_AGENT || 'gemini').trim();
    if (isAllowed(envAgent) && getAgentRuntimeReadiness(envAgent).ready) {
        return { agent: envAgent, fallback: true, originalRequest: requestedAgent };
    }

    if (allowedSet && allowedSet.size > 0) {
        return { agent: Array.from(allowedSet)[0], fallback: true, originalRequest: requestedAgent, disallowedFallback: true };
    }

    return { agent: envAgent, fallback: true, originalRequest: requestedAgent };
}

export function getInstalledAgentsInPriorityOrder() {
    // Keep stronger coding-capable agents ahead of local tiny models for mixed-worker deep runs.
    const ordered = ['gemini', 'codex', 'copilot', 'claude-code', 'kiro'];
    return ordered.filter((id) => isAgentInstalled(id));
}

export function canAgentHandleSpecialist(agentId, specialist) {
    const allow = AGENT_SPECIALIST_ALLOWLIST[agentId];
    if (!allow) return true;
    return allow.has(specialist);
}

export function fallbackSpecialistForAgent(agentId) {
    return DEFAULT_SPECIALIST_BY_AGENT[agentId] || 'developer';
}

export function assignSpecialistsToWorkers(workers = [], candidateSpecialists = [], prompt = '') {
    const pool = Array.isArray(candidateSpecialists) ? [...candidateSpecialists] : [];
    const assigned = {};

    for (const worker of workers) {
        const agentId = worker.agent;
        const matchIdx = pool.findIndex((specialist) => canAgentHandleSpecialist(agentId, specialist));
        let specialist = matchIdx >= 0 ? pool.splice(matchIdx, 1)[0] : null;

        if (!specialist) {
            const inferred = inferExecutionRole(agentId, prompt);
            if (canAgentHandleSpecialist(agentId, inferred)) {
                specialist = inferred;
            }
        }

        if (!specialist || !canAgentHandleSpecialist(agentId, specialist)) {
            specialist = fallbackSpecialistForAgent(agentId);
        }

        assigned[worker.workerId] = specialist;
    }

    return assigned;
}

export function getProbeCacheKey(agentId, cwd = REPO_ROOT) {
    return `${agentId}::${resolve(cwd || REPO_ROOT)}`;
}

export function getCachedAgentProbe(agentId, cwd = REPO_ROOT) {
    const key = getProbeCacheKey(agentId, cwd);
    const cached = agentRuntimeProbeCache.get(key);
    if (!cached) return null;
    if ((Date.now() - cached.at) > AGENT_RUNTIME_PROBE_TTL_MS) {
        agentRuntimeProbeCache.delete(key);
        return null;
    }
    return cached.value;
}

export function setCachedAgentProbe(agentId, cwd, value) {
    const key = getProbeCacheKey(agentId, cwd);
    agentRuntimeProbeCache.set(key, { at: Date.now(), value });
}

export function probeAgentAsk(agentId, cwd = REPO_ROOT) {
    if (!AGENT_RUNTIME_PROBE_ENABLED) return { ok: true, reason: 'probe_disabled' };

    const cached = getCachedAgentProbe(agentId, cwd);
    if (cached) return cached;

    const probePrompt = 'Reply with exactly: ok';
    try {
        const output = execSync(`${process.execPath} "${CLI_ENTRY}" ask ${agentId} "${probePrompt}"`, {
            cwd,
            timeout: 12000,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        });
        const out = String(output || '').toLowerCase();
        const result = out.includes('ok')
            ? { ok: true, reason: 'probe_ok' }
            : { ok: false, reason: 'probe_unexpected_output' };
        setCachedAgentProbe(agentId, cwd, result);
        return result;
    } catch (err) {
        const msg = String(err?.stderr || err?.message || '').toLowerCase();
        let reason = 'probe_failed';
        if (msg.includes('not logged') || msg.includes('login')) reason = 'probe_not_logged_in';
        else if (msg.includes('subscription') || msg.includes('plan') || msg.includes('quota')) reason = 'probe_subscription_or_quota';
        else if (msg.includes('permission') || msg.includes('forbidden')) reason = 'probe_not_authorized';

        const result = { ok: false, reason };
        setCachedAgentProbe(agentId, cwd, result);
        return result;
    }
}

export function inferExecutionRole(agentId, prompt = '') {
    const text = String(prompt || '').toLowerCase();

    if (/\b(ui|ux|design|visual|layout|css|theme|accessibility)\b/.test(text)) {
        return 'designer';
    }
    if (/\b(product|user journey|experience|workflow|persona|journey|interaction|frontend|web app|mobile app)\b/.test(text)) {
        return 'designer';
    }
    if (/\b(devops|infra|infrastructure|docker|k8s|kubernetes|deploy|ci\/cd|pipeline|aws|gcp|azure)\b/.test(text)) {
        return 'devops';
    }
    if (/\b(test|qa|quality|regression|edge case|risk|checklist)\b/.test(text)) {
        return 'qa';
    }
    if (/\b(architecture|tradeoff|module|boundary|system design)\b/.test(text)) {
        return 'architect';
    }

    const defaults = {
        codex: 'developer',
        copilot: 'developer',
        gemini: 'analyst',
        'claude-code': 'architect',
        kiro: 'devops',
    };
    return defaults[agentId] || 'developer';
}

export function inferSpecialistsFromPrompt(prompt = '', count = DEFAULT_DEEP_WORKERS) {
    const text = String(prompt || '').toLowerCase();
    const picked = [];

    const maybePush = (name, condition) => {
        if (condition && !picked.includes(name)) picked.push(name);
    };

    maybePush('architect', /\b(architecture|module|boundary|tradeoff|system design|component graph|domain model)\b/.test(text));
    maybePush('researcher', /\b(research|competitor|benchmark|survey|market scan|references?)\b/.test(text));
    maybePush('strategist', /\b(strategy|positioning|go-to-market|pitch|judges?|differentiator|moat)\b/.test(text));
    maybePush('pm', /\b(mvp|scope|roadmap|milestone|prioritization|timeline|execution plan)\b/.test(text));
    maybePush('designer', /\b(ui|ux|design|visual|layout|css|accessibility|product|user journey|experience|workflow|persona|interaction|frontend|web app|mobile app)\b/.test(text));
    maybePush('qa', /\b(test|qa|checklist|edge case|risk|validation)\b/.test(text));
    maybePush('devops', /\b(devops|infra|docker|k8s|deploy|pipeline|ci\/cd|aws|gcp|azure)\b/.test(text));
    maybePush('analyst', /\b(analysis|benchmark|metrics|performance|investigate|compare)\b/.test(text));
    maybePush('finance', /\b(cost|budget|pricing|financial|economics)\b/.test(text));
    maybePush('evaluator', /\b(evaluate|review|score|audit|judge)\b/.test(text));
    maybePush('security', /\b(security|auth|privacy|compliance|threat|abuse|attack)\b/.test(text));
    maybePush('developer', true);

    for (const specialist of DEFAULT_SPECIALIST_SEQUENCE) {
        if (picked.length >= count) break;
        if (!picked.includes(specialist)) picked.push(specialist);
    }

    return picked.slice(0, count);
}

export function estimateDeepWorkerCount(prompt = '', requestedWorkerCount = null) {
    if (Number.isFinite(requestedWorkerCount)) {
        return Math.max(1, Math.min(MAX_DEEP_WORKERS, requestedWorkerCount));
    }

    const text = String(prompt || '');
    const lower = text.toLowerCase();
    const tokenBudget = lower.split(/\s+/).filter(Boolean).length;

    const signalPatterns = [
        /\barchitecture\b/g,
        /\bapi\b/g,
        /\bdatabase|schema|sql\b/g,
        /\breal[-\s]?time|stream|websocket\b/g,
        /\bsecurity|auth|privacy|compliance\b/g,
        /\bdeploy|infra|devops|ci\/cd\b/g,
        /\boffline|sync|conflict|merge\b/g,
        /\bml|ai|model|inference|training\b/g,
        /\bperformance|benchmark|latency|scale\b/g,
        /\broadmap|milestone|execution plan\b/g,
    ];

    const matchedSignals = signalPatterns.reduce((acc, pattern) => {
        const matches = lower.match(pattern);
        return acc + (matches ? Math.min(2, matches.length) : 0);
    }, 0);

    const numberedItems = (text.match(/(^|\n)\s*\d+[\).:-]/g) || []).length;
    const sectionHeaders = (text.match(/(^|\n)\s*(key features|objectives|background|brownie points|submission deliverables|advanced considerations)\b/gi) || []).length;

    const sizeScore = Math.min(14, Math.floor(tokenBudget / 180));
    const structureScore = Math.min(10, Math.floor(numberedItems / 4) + sectionHeaders);
    const domainScore = Math.min(12, matchedSignals);
    const base = DEFAULT_DEEP_WORKERS;

    const estimated = base + sizeScore + structureScore + domainScore;
    return Math.max(1, Math.min(MAX_DEEP_WORKERS, estimated));
}

export function specialistFocusSummary(specialist) {
    const map = {
        architect: 'define architecture and module boundaries',
        researcher: 'surface deep research, references, and comparative insights',
        strategist: 'shape winning narrative, differentiation, and judge strategy',
        pm: 'define feasible MVP scope and execution milestones',
        developer: 'implement core functionality and code paths',
        designer: 'own UI/UX behavior and accessibility details',
        qa: 'validate edge cases, regressions, and testability',
        devops: 'handle runtime, infra, and deployment concerns',
        analyst: 'analyze structure, tradeoffs, and performance',
        evaluator: 'review quality and decision robustness',
        finance: 'optimize cost and resource usage decisions',
        security: 'identify trust boundaries, misuse risks, and mitigation controls',
    };
    return map[specialist] || 'deliver concrete implementation guidance';
}

export function nestedFocusSummary(specialist) {
    const map = {
        architect: 'validate architecture boundaries and failure modes against implementation reality',
        researcher: 'validate external assumptions and provide source-backed facts with URLs',
        strategist: 'stress-test positioning and rebuttal logic for likely objections',
        pm: 'validate MVP scope, sequencing, and concrete execution dependencies',
        developer: 'turn requirements into concrete implementation details and file-level steps',
        designer: 'audit usability, accessibility, and interaction consistency',
        qa: 'derive tests, edge cases, regressions, and release confidence checks',
        devops: 'validate deployability, observability, and operational safeguards',
        analyst: 'quantify tradeoffs and check internal consistency of claims',
        evaluator: 'score quality, identify weak spots, and prioritize fixes',
        finance: 'validate cost assumptions, ranges, and budget risk',
        security: 'identify trust boundaries, abuse paths, and mitigation actions',
    };
    return map[specialist] || 'validate and improve this worker lane with concrete, actionable findings';
}

export function getCodexModelCapabilityStatus() {
    const now = Date.now();
    if (CODEX_RUNTIME_CACHE.status && (now - CODEX_RUNTIME_CACHE.at) < 30000) {
        return CODEX_RUNTIME_CACHE.status;
    }

    try {
        const raw = execSync('gh copilot models 2>/dev/null', {
            timeout: 2500,
            encoding: 'utf8',
        }).trim().toLowerCase();

        if (!raw) {
            const state = { ready: true, reason: 'codex_models_probe_empty' };
            CODEX_RUNTIME_CACHE.at = now;
            CODEX_RUNTIME_CACHE.status = state;
            return state;
        }

        const hasCodexModel = CODEX_MODEL_HINTS.some((token) => raw.includes(token));
        const state = hasCodexModel
            ? { ready: true, reason: 'codex_models_available' }
            : { ready: false, reason: 'codex_model_unavailable', requiredHints: CODEX_MODEL_HINTS.slice(0, 6) };

        CODEX_RUNTIME_CACHE.at = now;
        CODEX_RUNTIME_CACHE.status = state;
        return state;
    } catch {
        const state = { ready: true, reason: 'codex_models_probe_unavailable' };
        CODEX_RUNTIME_CACHE.at = now;
        CODEX_RUNTIME_CACHE.status = state;
        return state;
    }
}

export function getAgentRuntimeReadiness(agentId, cwd = REPO_ROOT) {
    const resolvedBinary = resolveAgentBinary(agentId);
    if (!resolvedBinary) {
        return { ready: false, reason: 'not_installed' };
    }

    if (agentId === 'claude-code') {
        try {
            const out = execSync('claude auth status', { timeout: 2000, encoding: 'utf8' }).trim();
            const parsed = JSON.parse(out || '{}');
            if (parsed && parsed.loggedIn === false) {
                return { ready: false, reason: 'not_logged_in' };
            }
        } catch {
            return { ready: false, reason: 'auth_status_unavailable' };
        }

        const probe = probeAgentAsk(agentId, cwd);
        if (!probe.ok) {
            return { ready: false, reason: probe.reason };
        }
    }

    if (agentId === 'copilot' || agentId === 'codex') {
        // New standalone CLIs are considered runtime-ready once installed.
        // Keep gh-copilot checks only for gh-backed flows.
        if (resolvedBinary !== 'gh') {
            return { ready: true, reason: 'ready', binary: resolvedBinary };
        }

        try {
            execSync('gh auth status', {
                timeout: 2000,
                stdio: 'pipe',
                env: {
                    ...process.env,
                    PATH: AGENT_DETECT_PATH,
                },
            });
        } catch {
            return { ready: false, reason: 'gh_not_logged_in' };
        }

        try {
            const exts = execSync('gh extension list 2>/dev/null', {
                timeout: 2000,
                encoding: 'utf8',
                env: {
                    ...process.env,
                    PATH: AGENT_DETECT_PATH,
                },
            }).toString();
            if (!exts.includes('copilot')) {
                return { ready: false, reason: 'copilot_extension_missing' };
            }
        } catch {
            return { ready: false, reason: 'copilot_extension_missing' };
        }

        if (agentId === 'codex') {
            const codexState = getCodexModelCapabilityStatus();
            if (!codexState.ready) {
                return codexState;
            }
            if (codexState.reason && codexState.reason !== 'ready') {
                return codexState;
            }
        }
    }

    if (agentId === 'kiro' && !AUTO_ENABLE_KIRO) {
        return { ready: false, reason: 'disabled_by_default' };
    }

    return { ready: true, reason: 'ready' };
}

export function getReadyAgentsInPriorityOrder(cwd = REPO_ROOT, allowedAgents = null) {
    const allowedSet = Array.isArray(allowedAgents) && allowedAgents.length > 0
        ? new Set(allowedAgents)
        : null;
    const installed = getInstalledAgentsInPriorityOrder().filter((agent) => !allowedSet || allowedSet.has(agent));
    const ready = [];
    const skipped = [];

    for (const agent of installed) {
        const cooldown = getAgentRateLimitCooldown(agent);
        if (cooldown) {
            skipped.push({ agent, reason: 'rate_limit_cooldown', until: cooldown.until });
            continue;
        }
        const state = getAgentRuntimeReadiness(agent, cwd);
        if (state.ready) {
            ready.push(agent);
        } else {
            skipped.push({ agent, reason: state.reason });
        }
    }

    return { installed, ready, skipped };
}

export async function resolveAutoRunAgent(prompt, cwd = REPO_ROOT, allowedAgents = null) {
    const { installed, ready, skipped } = getReadyAgentsInPriorityOrder(cwd, allowedAgents);

    if (installed.length === 0) {
        const fallback = resolveRunAgent('auto');
        return { agent: fallback.agent, method: 'fallback-chain', available: [] };
    }

    if (ready.length === 0) {
        return { agent: installed[0], method: 'installed-not-ready-fallback', available: installed, ready: [], skipped };
    }

    try {
        const explained = await selectAgent(prompt, ready, { withJustification: true });
        const picked = explained?.agent;
        if (picked && ready.includes(picked)) {
            return {
                agent: picked,
                method: explained?.method || 'reasoning-scorecard',
                available: installed,
                ready,
                skipped,
                justification: explained?.justification || null,
                confidence: explained?.confidence ?? null,
            };
        }
    } catch {
        // Fall through to deterministic fallback.
    }

    return {
        agent: ready[0],
        method: 'priority-fallback',
        available: installed,
        ready,
        skipped,
        justification: {
            selected: ready[0],
            reason: 'Classifier unavailable; selected first runtime-ready agent by stable priority order.',
            candidates: ready.map((agentId, idx) => ({ agent: agentId, score: Math.max(0, 100 - (idx * 10)) })),
            signals: [],
        },
    };
}

export function selectParallelWorkers(primaryAgent, maxWorkers = DEFAULT_DEEP_WORKERS, cwd = REPO_ROOT, deepPolicy = {}, allowedAgents = null) {
    const { ready, skipped } = getReadyAgentsInPriorityOrder(cwd, allowedAgents);
    const count = Math.max(1, maxWorkers);
    const readySet = new Set(ready);
    const workerSlots = [];
    const perAgentCounts = {};
    const primaryCopies = Number.isFinite(deepPolicy.primaryCopies)
        ? Math.max(1, Math.min(count, deepPolicy.primaryCopies))
        : Math.max(2, Math.min(count, Math.ceil(count * 0.35)));
    const sameAgentOnly = deepPolicy.sameAgentOnly === true;

    const pushSlot = (agent) => {
        if (!agent) return;
        perAgentCounts[agent] = (perAgentCounts[agent] || 0) + 1;
        workerSlots.push({ workerId: `${agent}-${perAgentCounts[agent]}`, agent });
    };

    const canUsePrimary = primaryAgent && readySet.has(primaryAgent);
    if (canUsePrimary) {
        // Fan out configurable copies for the selected primary model.
        for (let i = 0; i < primaryCopies; i++) pushSlot(primaryAgent);
    }

    if (!sameAgentOnly) {
        const others = ready.filter((agent) => agent !== primaryAgent);
        for (const agent of others) {
            if (workerSlots.length >= count) break;
            pushSlot(agent);
        }
    }

    while (workerSlots.length < count && canUsePrimary) {
        pushSlot(primaryAgent);
    }

    if (workerSlots.length === 0 && ready.length > 0) {
        pushSlot(ready[0]);
    }

    return { workers: workerSlots, skipped };
}

// ─── runChildAgent ────────────────────────────────────────────────────────────

function isTrustDirectoryFailure(text = '') {
    const sample = String(text || '').toLowerCase();
    if (!sample) return false;
    return (
        sample.includes('not inside a trusted directory') ||
        sample.includes('--skip-git-repo-check') ||
        sample.includes('detected dubious ownership') ||
        sample.includes('unsafe repository') ||
        sample.includes('not a git repository')
    );
}

export async function runChildAgent({ agent, prompt, cwd, mcpServers, onStdout, onStderr, runtime, childKey, childMeta, model = null }) {
    const args = [CLI_ENTRY, 'ask', agent, prompt];
    const selectedModel = normalizeModelId(model);
    if (selectedModel) {
        args.push('--model', selectedModel);
    }
    const spawnEnv = { ...process.env };
    if (mcpServers.length > 0) {
        spawnEnv.SOUPZ_MCP_SERVERS = JSON.stringify(mcpServers);
    }

    const runOnce = async (attemptCwd) => await new Promise((resolveAttempt) => {
        const child = spawn(process.execPath, args, {
            cwd: attemptCwd,
            env: spawnEnv,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        if (runtime && childKey) {
            registerOrderChild(runtime, childKey, child, childMeta);
        }

        let stdout = '';
        let stderr = '';
        let settled = false;

        const finish = (payload) => {
            if (settled) return;
            settled = true;
            if (runtime && childKey) {
                setChildFinished(runtime, childKey, payload.code);
            }
            resolveAttempt(payload);
        };

        child.stdout.on('data', (chunk) => {
            const text = chunk.toString();
            stdout += text;
            if (runtime && childKey) touchOrderChild(runtime, childKey);
            onStdout?.(text, child.pid);
        });

        child.stderr.on('data', (chunk) => {
            const text = chunk.toString();
            stderr += text;
            if (runtime && childKey) touchOrderChild(runtime, childKey);
            onStderr?.(text, child.pid);
        });

        child.on('error', (err) => {
            finish({ code: 1, stdout, stderr: `${stderr}\n${err.message}`.trim(), pid: child.pid, errored: true, cwd: attemptCwd });
        });

        child.on('close', (code) => {
            finish({ code: code ?? 1, stdout, stderr, pid: child.pid, cwd: attemptCwd });
        });
    });

    const primaryCwd = resolve(cwd || REPO_ROOT);
    const first = await runOnce(primaryCwd);
    if (first.code === 0) return first;

    const trustFailure = isTrustDirectoryFailure(`${first.stderr || ''}\n${first.stdout || ''}`);
    const fallbackCwd = resolve(REPO_ROOT);
    const canRetryFromRoot = trustFailure && primaryCwd !== fallbackCwd;

    if (!canRetryFromRoot) return first;

    onStderr?.(`[auto-retry] ${agent} failed workspace trust checks in ${primaryCwd}; retrying from ${fallbackCwd}\n`, first.pid);
    const retried = await runOnce(fallbackCwd);
    return retried;
}

// ─── Network utilities ────────────────────────────────────────────────────────

export function getLocalIPs() {
    const tunnelUrls = getTunnelBaseUrls();
    const interfaces = os.networkInterfaces();
    const ips = [...tunnelUrls];
    for (const name of Object.keys(interfaces)) {
        const iface = interfaces[name];
        for (const addr of iface) {
            if (addr.family === 'IPv4' && !addr.internal) {
                ips.push(addr.address);
            }
        }
    }
    const all = Array.from(new Set(ips));
    return all.sort((a, b) => {
        const aIsCf = a.includes('trycloudflare.com');
        const bIsCf = b.includes('trycloudflare.com');
        if (aIsCf && !bIsCf) return -1;
        if (!aIsCf && bIsCf) return 1;
        return 0;
    });
}

export function getTunnelBaseUrls() {
    // Accept comma-separated tunnel URLs, for example:
    // SOUPZ_TUNNEL_URL="https://abc.trycloudflare.com"
    // SOUPZ_TUNNEL_URLS="https://a.ngrok-free.app,https://b.trycloudflare.com"
    const configured = [
        process.env.SOUPZ_TUNNEL_URL || '',
        process.env.SOUPZ_TUNNEL_URLS || '',
    ]
        .flatMap((value) => value.split(','))
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => value.replace(/\/$/, ''));

    const all = Array.from(new Set([...configured, ...Array.from(runtimeTunnelBaseUrls)]));
    // Prioritize Cloudflare tunnels (usually what we want for public access)
    return all.sort((a, b) => {
        const aIsCf = a.includes('trycloudflare.com');
        const bIsCf = b.includes('trycloudflare.com');
        if (aIsCf && !bIsCf) return -1;
        if (!aIsCf && bIsCf) return 1;
        return 0;
    });
}

// ─── Path utilities ───────────────────────────────────────────────────────────

export function isPathInside(parent, candidate) {
    try {
        const rel = relative(resolve(parent), resolve(candidate));
        return rel === '' || (!rel.startsWith('..') && !rel.includes(':'));
    } catch {
        return false;
    }
}

// ─── Workspace utilities ──────────────────────────────────────────────────────

export function summarizePromptForWorkspace(prompt = '', maxChars = 3000) {
    const text = String(prompt || '').trim();
    if (text.length <= maxChars) return text;
    return `${text.slice(0, maxChars)}\n\n[truncated ${text.length - maxChars} chars for workspace brief]`;
}

export function registerCreatedFile(order, filePath) {
    if (!order || !filePath) return;
    if (!Array.isArray(order.createdFiles)) order.createdFiles = [];
    if (!order.createdFiles.includes(filePath)) {
        order.createdFiles.push(filePath);
    }
}

export function toWorkspaceRelativePath(cwd, filePath) {
    try {
        const root = resolve(cwd || REPO_ROOT);
        const rel = relative(root, filePath);
        return rel && !rel.startsWith('..') ? rel : filePath;
    } catch {
        return filePath;
    }
}

// ─── Connections ──────────────────────────────────────────────────────────────

export function getConnections() {
    const conns = [];
    for (const [token, session] of activeSessions) {
        conns.push({
            clientType: session.clientType || 'unknown',
            connectedSince: session.createdAt,
            lastSeen: session.lastSeen,
        });
    }
    return conns;
}

// ─── System health ────────────────────────────────────────────────────────────

export function getSystemHealth() {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const cpuLoad = os.loadavg();

    let cpuTemp = null;
    try {
        const tempOut = execSync('which osx-cpu-temp >/dev/null 2>&1 && osx-cpu-temp 2>/dev/null || echo "N/A"', { timeout: 2000 }).toString().trim();
        if (tempOut !== 'N/A') cpuTemp = parseFloat(tempOut);
    } catch { /* not available */ }

    // macOS swap memory (vm_stat + sysctl)
    let swapUsed = 0, swapTotal = 0;
    try {
        if (os.platform() === 'darwin') {
            const swapOut = execSync('sysctl vm.swapusage 2>/dev/null', { timeout: 2000 }).toString().trim();
            // Format: "vm.swapusage: total = 2048.00M  used = 1234.50M  free = 813.50M  ..."
            const totalMatch = swapOut.match(/total\s*=\s*([\d.]+)M/);
            const usedMatch = swapOut.match(/used\s*=\s*([\d.]+)M/);
            if (totalMatch) swapTotal = parseFloat(totalMatch[1]) * 1024 * 1024;
            if (usedMatch) swapUsed = parseFloat(usedMatch[1]) * 1024 * 1024;
        } else {
            // Linux: read from /proc/meminfo
            const meminfo = execSync('cat /proc/meminfo 2>/dev/null', { timeout: 2000 }).toString();
            const swapTotalMatch = meminfo.match(/SwapTotal:\s+(\d+)\s+kB/);
            const swapFreeMatch = meminfo.match(/SwapFree:\s+(\d+)\s+kB/);
            if (swapTotalMatch) swapTotal = parseInt(swapTotalMatch[1]) * 1024;
            if (swapFreeMatch) swapUsed = swapTotal - parseInt(swapFreeMatch[1]) * 1024;
        }
    } catch { /* swap info not available */ }

    const formatBytes = (bytes) => {
        if (bytes >= 1024 ** 3) return (bytes / (1024 ** 3)).toFixed(1) + ' GB';
        return (bytes / (1024 ** 2)).toFixed(0) + ' MB';
    };

    // Disk space
    let disk = null;
    try {
        if (os.platform() === 'darwin' || os.platform() === 'linux') {
            const dfOut = execSync("df -k / 2>/dev/null | tail -1", { timeout: 2000 }).toString().trim();
            const parts = dfOut.split(/\s+/);
            if (parts.length >= 4) {
                const diskTotal = parseInt(parts[1]) * 1024;
                const diskUsed = parseInt(parts[2]) * 1024;
                const diskFree = parseInt(parts[3]) * 1024;
                disk = {
                    total: diskTotal, used: diskUsed, free: diskFree,
                    usagePercent: diskTotal > 0 ? Math.round((diskUsed / diskTotal) * 100) : 0,
                    totalFormatted: formatBytes(diskTotal),
                    usedFormatted: formatBytes(diskUsed),
                    freeFormatted: formatBytes(diskFree),
                };
            }
        }
    } catch { /* disk info not available */ }

    return {
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
        uptime: os.uptime(),
        cpu: {
            model: cpus[0]?.model,
            cores: cpus.length,
            loadAvg: { '1m': cpuLoad[0], '5m': cpuLoad[1], '15m': cpuLoad[2] },
            temperature: cpuTemp,
        },
        memory: {
            total: totalMem,
            used: usedMem,
            free: freeMem,
            usagePercent: Math.round((usedMem / totalMem) * 100),
            totalFormatted: formatBytes(totalMem),
            usedFormatted: formatBytes(usedMem),
            freeFormatted: formatBytes(freeMem),
        },
        swap: {
            total: swapTotal,
            used: swapUsed,
            free: swapTotal - swapUsed,
            usagePercent: swapTotal > 0 ? Math.round((swapUsed / swapTotal) * 100) : 0,
            totalFormatted: formatBytes(swapTotal),
            usedFormatted: formatBytes(swapUsed),
            freeFormatted: formatBytes(swapTotal - swapUsed),
        },
        disk,
        warnings: [
            ...(usedMem / totalMem > 0.9 ? [`⚠️ RAM usage above 90% (${formatBytes(usedMem)} / ${formatBytes(totalMem)})`] : []),
            ...(swapUsed > 0 ? [`💾 Swap in use: ${formatBytes(swapUsed)} / ${formatBytes(swapTotal)}`] : []),
            ...(swapTotal > 0 && swapUsed / swapTotal > 0.7 ? ['⚠️ Swap usage above 70% — system may be slow'] : []),
            ...(cpuLoad[0] > cpus.length * 0.8 ? ['⚠️ CPU load is high'] : []),
            ...(cpuTemp && cpuTemp > 85 ? ['🔥 CPU temperature is high'] : []),
            ...(disk && disk.usagePercent > 90 ? [`⚠️ Disk almost full: ${disk.freeFormatted} remaining`] : []),
        ],
        activeConnections: wss ? wss.clients.size : 0,
    };
}

// ─── Agent classifier (deterministic + explainable) ─────────────────────────

const ROUTING_SIGNALS = {
    code: ['code', 'function', 'bug', 'fix', 'debug', 'implement', 'typescript', 'javascript', 'python', 'module', 'feature'],
    architecture: ['architecture', 'system design', 'tradeoff', 'boundary', 'scalable', 'design pattern', 'refactor'],
    research: ['research', 'analyze', 'benchmark', 'compare', 'insight', 'study', 'market', 'summarize'],
    github: ['github', 'pull request', 'pr', 'issue', 'workflow', 'action', 'merge', 'branch', 'commit'],
    devops: ['devops', 'infra', 'deploy', 'docker', 'kubernetes', 'k8s', 'terraform', 'pipeline', 'ci', 'cd', 'aws', 'gcp', 'azure'],
    privacy: ['local', 'offline', 'privacy', 'on-device', 'airgapped', 'no cloud'],
    product: ['ux', 'ui', 'design', 'user journey', 'persona', 'prototype', 'content', 'copy'],
    security: ['security', 'auth', 'authorization', 'threat', 'vulnerability', 'compliance', 'privacy policy'],
};

const AGENT_SIGNAL_WEIGHTS = {
    codex:       { code: 1.35, architecture: 1.2, research: 0.8, github: 1.0, devops: 0.85, privacy: 0.5, product: 0.7, security: 1.0 },
    gemini:      { code: 0.95, architecture: 1.0, research: 1.4, github: 0.75, devops: 0.8, privacy: 0.55, product: 1.15, security: 0.95 },
    copilot:     { code: 1.1, architecture: 0.95, research: 0.75, github: 1.4, devops: 1.0, privacy: 0.45, product: 0.7, security: 0.85 },
    'claude-code': { code: 1.25, architecture: 1.35, research: 0.95, github: 0.85, devops: 0.95, privacy: 0.5, product: 1.0, security: 1.35 },
    kiro:        { code: 0.85, architecture: 1.0, research: 0.75, github: 0.65, devops: 1.45, privacy: 0.5, product: 0.6, security: 0.9 },
};

function normalizeText(text = '') {
    return String(text || '').toLowerCase();
}

function scorePromptSignals(prompt = '') {
    const lower = normalizeText(prompt);
    const signals = [];
    for (const [signal, keywords] of Object.entries(ROUTING_SIGNALS)) {
        const matched = keywords.filter((kw) => lower.includes(kw));
        if (matched.length > 0) {
            signals.push({ signal, hits: matched.length, keywords: matched.slice(0, 6) });
        }
    }
    return signals;
}

function buildAgentScorecard(prompt = '', availableAgents = []) {
    const signalScores = scorePromptSignals(prompt);
    const signalMap = new Map(signalScores.map((item) => [item.signal, item.hits]));
    const lowerPrompt = normalizeText(prompt);
    const isComplexPrompt = /\b(complex|end-to-end|full stack|production|architecture|orchestration|multi-service|distributed)\b/.test(lowerPrompt);
    const isBasicAuditPrompt = /\b(test|qa|check|checklist|report|summary|track|monitor|log|lint output|error report)\b/.test(lowerPrompt);
    const candidates = [];

    for (const agent of availableAgents) {
        const weights = AGENT_SIGNAL_WEIGHTS[agent] || {};
        let score = 0;
        const reasons = [];

        for (const [signal, hits] of signalMap.entries()) {
            const weight = Number(weights[signal] || 0.5);
            const contribution = hits * weight;
            score += contribution;
            if (contribution > 0) {
                reasons.push(`${signal} x${hits} @ ${weight.toFixed(2)}`);
            }
        }

        const complexityBoost = isComplexPrompt ? 0.35 : 0;
        if (complexityBoost > 0 && (agent === 'codex' || agent === 'claude-code' || agent === 'gemini')) {
            score += complexityBoost;
            reasons.push(`complexity bonus ${complexityBoost.toFixed(2)}`);
        }

        candidates.push({
            agent,
            score: Number(score.toFixed(3)),
            reasons,
        });
    }

    candidates.sort((a, b) => b.score - a.score);
    return { signalScores, candidates };
}

export function explainAgentSelection(prompt = '', availableAgents = []) {
    const agents = Array.isArray(availableAgents) ? availableAgents.filter(Boolean) : [];
    if (agents.length === 0) {
        return {
            agent: 'gemini',
            confidence: 0,
            method: 'reasoning-scorecard-v2',
            justification: {
                selected: 'gemini',
                reason: 'No available agents supplied; using safe default.',
                candidates: [],
                signals: [],
            },
        };
    }

    const { signalScores, candidates } = buildAgentScorecard(prompt, agents);
    const selected = candidates[0]?.agent || agents[0];
    const top = candidates[0]?.score || 0;
    const second = candidates[1]?.score || 0;
    const margin = Math.max(0, top - second);
    const confidence = Math.max(0.2, Math.min(0.98, 0.5 + (margin * 0.15)));

    return {
        agent: selected,
        confidence: Number(confidence.toFixed(2)),
        method: 'reasoning-scorecard-v2',
        justification: {
            selected,
            reason: candidates.length > 1
                ? `Selected ${selected} with highest score (${top.toFixed(2)}) over ${candidates[1].agent} (${second.toFixed(2)}).`
                : `Selected ${selected} as the only available agent.`,
            candidates: candidates.map((c) => ({ agent: c.agent, score: c.score, reasons: c.reasons.slice(0, 4) })),
            signals: signalScores,
        },
    };
}

export async function selectAgent(prompt, availableAgents, options = {}) {
    const explained = explainAgentSelection(prompt, availableAgents);
    if (options?.withJustification) return explained;
    return explained.agent;
}
