import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join, resolve, relative, extname } from 'path';
import { createClient } from '@supabase/supabase-js';
import os from 'os';

// node-pty is optional — terminal feature won't work if not installed
let pty = null;
try {
    const require = createRequire(import.meta.url);
    pty = require('node-pty');
} catch { /* terminal feature unavailable */ }
import { execSync, spawn } from 'child_process';
import crypto from 'crypto';

const DEFAULT_PORT = 7070;
let activePort = DEFAULT_PORT; // Track the actual bound port
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });
wss.on('error', () => {}); // Suppress WSS errors (EADDRINUSE handled on server)

// CORS — allow mobile app (Expo) and browser extension to call REST endpoints
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, X-Soupz-Token');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

// ═══════════════════════════════════════════════════════════
// OTP-BASED AUTHENTICATION (Cloud Kitchen Pairing)
// ═══════════════════════════════════════════════════════════

// Active pairing codes: { code: { token, createdAt, expiresAt } }
const pairingCodes = new Map();
// Active sessions: { token: { createdAt, lastSeen, clientType } }
const activeSessions = new Map();
// Authenticated WebSocket clients
const authenticatedClients = new WeakSet();

const PAIRING_CODE_LENGTH = 8;
const PAIRING_CODE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const runtimeTunnelBaseUrls = new Set();
let webappBaseUrl = process.env.SOUPZ_APP_URL || 'https://soupz.vercel.app';
let healthBroadcastInterval = null;
let sessionCleanupInterval = null;
let dbCleanupInterval = null;
let fileWatcherAbortController = null;
let fileWatcherTask = null;
let commandListenerChannel = null;
let runtimeServicesStarted = false;

// Currently displayed pairing code (auto-refreshes)
let currentPairingCode = null;
let codeRefreshTimer = null;

function generatePairingCode() {
    // Generate a human-readable 8-digit code (digits only, no ambiguous chars)
    const digits = '0123456789';
    let code = '';
    const bytes = crypto.randomBytes(PAIRING_CODE_LENGTH);
    for (let i = 0; i < PAIRING_CODE_LENGTH; i++) {
        code += digits[bytes[i] % digits.length];
    }
    return code;
}

function generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
}

function createPairingCode() {
    // Clean expired codes
    const now = Date.now();
    for (const [code, data] of pairingCodes) {
        if (now > data.expiresAt) pairingCodes.delete(code);
    }

    const code = generatePairingCode();
    const token = generateSessionToken();
    const expiresAt = now + PAIRING_CODE_EXPIRY_MS;

    pairingCodes.set(code, { token, createdAt: now, expiresAt });

    // Register in Supabase for remote pairing if available
    if (supabase) {
        const connectTargets = Array.from(new Set([...getLocalIPs(), ...getTunnelBaseUrls()]));
        // Cleanup expired codes in DB
        supabase.from('soupz_pairing').delete().lt('expires_at', new Date().toISOString()).then(() => {});

        // Register machine as online
        supabase.from('soupz_machines').upsert({
            id: os.hostname(),
            name: os.hostname(),
            last_seen: new Date().toISOString(),
            status: 'online'
        }).then(() => {});

        supabase
            .from('soupz_pairing')
            .upsert({
                code,
                token,
                hostname: os.hostname(),
                lan_ips: connectTargets,
                port: activePort,
                created_at: new Date(now).toISOString(),
                expires_at: new Date(expiresAt).toISOString(),
            })
            .then(({ error }) => {
                if (error) console.error(`[supabase] pairing register failed: ${error.message}`);
            });
    }

    return { code, expiresAt, expiresIn: Math.round(PAIRING_CODE_EXPIRY_MS / 1000) };
}

let silentMode = false;
let codeRefreshCallback = null;

/** Auto-refresh: generate a new code and display it, repeat every 5 minutes */
function startCodeAutoRefresh() {
    if (codeRefreshTimer) clearInterval(codeRefreshTimer);
    currentPairingCode = createPairingCode();

    codeRefreshTimer = setInterval(() => {
        currentPairingCode = createPairingCode();
        if (!silentMode) {
            console.log(`\n  \x1b[38;5;214m🔑  New Code: ${currentPairingCode.code}\x1b[0m  \x1b[2m(auto-refreshed)\x1b[0m`);
        }
        if (codeRefreshCallback) codeRefreshCallback(currentPairingCode);
    }, PAIRING_CODE_EXPIRY_MS);
}

/** Get the current active pairing code (for display) */
function getCurrentCode() {
    return currentPairingCode;
}

function validatePairingCode(code) {
    const data = pairingCodes.get(code);
    if (!data) return null;
    if (Date.now() > data.expiresAt) {
        pairingCodes.delete(code);
        return null;
    }
    // Code is valid — create session, delete code (one-time use)
    const { token } = data;
    pairingCodes.delete(code);
    activeSessions.set(token, { createdAt: Date.now(), lastSeen: Date.now(), clientType: 'unknown' });

    // If the consumed code is currently displayed, rotate immediately so /pair/current and QR stay valid.
    if (currentPairingCode?.code === code) {
        currentPairingCode = createPairingCode();
        if (codeRefreshCallback) codeRefreshCallback(currentPairingCode);
    }

    return token;
}

function isValidSession(token) {
    const session = activeSessions.get(token);
    if (!session) return false;
    if (Date.now() - session.createdAt > SESSION_EXPIRY_MS) {
        activeSessions.delete(token);
        return false;
    }
    session.lastSeen = Date.now();
    return true;
}

function revokeSession(token) {
    activeSessions.delete(token);
}

// Middleware: require auth token for REST endpoints (except pairing)
function requireAuth(req, res, next) {
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

function isLocalRequest(req) {
    const clientIP = req.ip || req.connection?.remoteAddress;
    return clientIP === '127.0.0.1' || clientIP === '::1' || clientIP === '::ffff:127.0.0.1';
}

function getCurrentPairingSnapshot() {
    const pairing = getCurrentCode();
    if (!pairing) return null;
    const localIPs = getLocalIPs();
    const tunnelUrls = getTunnelBaseUrls();
    const connectTargets = Array.from(new Set([...localIPs, ...tunnelUrls]));
    const connectUrl = `${webappBaseUrl.replace(/\/$/, '')}/connect?code=${pairing.code}`;
    const expiresIn = Math.max(0, Math.round((pairing.expiresAt - Date.now()) / 1000));

    return {
        code: pairing.code,
        expiresIn,
        connectUrl,
        connectTargets,
        lanIps: localIPs,
        tunnelUrls,
        qrData: JSON.stringify({
            type: 'soupz-pair',
            host: localIPs[0] || 'localhost',
            port: activePort,
            code: pairing.code,
        }),
    };
}

// Track active terminals
const terminals = new Map();
let terminalCounter = 0;

function buildTerminalSummary(id, terminal) {
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

function terminateTerminal(terminalId) {
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

// Track active parallel processes (Fleet)
const activeFleet = new Map(); // commandId -> { agent, prompt, startTime }

function registerFleet(id, agent, prompt) {
    activeFleet.set(id, { agent, prompt, startTime: Date.now() });
    broadcast({ type: 'fleet_update', active: Array.from(activeFleet.values()) });
}

function unregisterFleet(id) {
    activeFleet.delete(id);
    broadcast({ type: 'fleet_update', active: Array.from(activeFleet.values()) });
}

function broadcast(msg) {
    const message = JSON.stringify(msg);
    for (const client of wss.clients) {
        if (client.readyState === 1 && authenticatedClients.has(client)) {
            client.send(message);
        }
    }
}
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '../../../');
const CLI_ENTRY = join(REPO_ROOT, 'bin/soupz.js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_TABLE = process.env.SOUPZ_SUPABASE_ORDERS_TABLE || 'soupz_orders';
const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
    : null;

// User-facing agent aliases.
const WEB_AGENT_ALIASES = new Map([
    ['soupz-workflow', 'soupz-soupz'],
]);

// In-memory order tracking for web dashboard workflow
const orders = new Map();
let orderCounter = 0;
const orderRuntimes = new Map(); // orderId -> runtime metadata and child processes

const WORKER_STALL_MS = Math.max(10000, Number.parseInt(process.env.SOUPZ_WORKER_STALL_MS || '45000', 10) || 45000);
const DEEP_SYNTHESIS_TIMEOUT_MS = Math.max(15000, Number.parseInt(process.env.SOUPZ_DEEP_SYNTHESIS_TIMEOUT_MS || '120000', 10) || 120000);
const ORDER_LANE_RING_MAX = Math.max(4000, Number.parseInt(process.env.SOUPZ_ORDER_LANE_RING_MAX || '20000', 10) || 20000);
const OUTPUT_DELTA_EVENT_MIN_MS = Math.max(0, Number.parseInt(process.env.SOUPZ_OUTPUT_DELTA_EVENT_MIN_MS || '250', 10) || 250);
const ORDER_STREAM_CHUNK_MAX = Math.max(512, Number.parseInt(process.env.SOUPZ_STREAM_CHUNK_MAX || '4096', 10) || 4096);

function createOrderRuntime(order) {
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

function getOrderRuntime(orderId) {
    return orderRuntimes.get(orderId) || null;
}

function cleanupOrderRuntime(orderId) {
    const runtime = orderRuntimes.get(orderId);
    if (!runtime) return;
    for (const timer of runtime.workerWatchdogs.values()) {
        clearInterval(timer);
    }
    runtime.workerWatchdogs.clear();
    orderRuntimes.delete(orderId);
}

function appendLaneBuffer(order, laneId, text) {
    if (!order.laneBuffers) order.laneBuffers = {};
    const prev = order.laneBuffers[laneId] || '';
    const next = `${prev}${text}`;
    order.laneBuffers[laneId] = next.length > ORDER_LANE_RING_MAX ? next.slice(-ORDER_LANE_RING_MAX) : next;
}

function toStreamChunk(text) {
    if (!text || text.length <= ORDER_STREAM_CHUNK_MAX) return text;
    const omitted = text.length - ORDER_STREAM_CHUNK_MAX;
    return `${text.slice(0, ORDER_STREAM_CHUNK_MAX)}\n[stream chunk truncated: omitted ${omitted} chars]\n`;
}

function pushOrderOutputDelta(order, runtime, bucketKey, eventType, data = {}) {
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

function flushOrderOutputDeltas(order, runtime, bucketPrefix = '') {
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

function setChildFinished(runtime, childKey, exitCode = null) {
    const childMeta = runtime?.children?.get(childKey);
    if (!childMeta) return;
    childMeta.finished = true;
    childMeta.exitCode = exitCode;
    childMeta.finishedAt = Date.now();
}

function registerOrderChild(runtime, childKey, child, meta = {}) {
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

function touchOrderChild(runtime, childKey) {
    const childMeta = runtime?.children?.get(childKey);
    if (!childMeta || childMeta.finished) return;
    childMeta.lastOutputAt = Date.now();
}

function startWorkerWatchdog(order, runtime, childKey, workerMeta) {
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

function stopWorkerWatchdog(runtime, childKey) {
    const timer = runtime?.workerWatchdogs?.get(childKey);
    if (!timer) return;
    clearInterval(timer);
    runtime.workerWatchdogs.delete(childKey);
}

function cancelOrderChildren(order, runtime, reason = 'cancel_requested') {
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

// Broadcast order update to all authenticated clients
function broadcastOrderUpdate(order) {
    const message = JSON.stringify({ type: 'order_update', data: toOrderSummary(order) });
    for (const client of wss.clients) {
        if (client.readyState === 1 && authenticatedClients.has(client)) {
            client.send(message);
        }
    }
}

function nowIso() {
    return new Date().toISOString();
}

function toOrderSummary(order) {
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

function pushOrderEvent(order, type, data = {}) {
    const event = {
        type,
        at: nowIso(),
        ...data,
    };
    order.events.push(event);

    const maxEvents = 500;
    if (order.events.length <= maxEvents) return;

    // Keep critical lifecycle events for UI visibility/debugging by dropping noisy deltas first.
    while (order.events.length > maxEvents) {
        const dropIdx = order.events.findIndex((e) => /\.output\.delta$/.test(String(e.type || '')));
        if (dropIdx >= 0) {
            order.events.splice(dropIdx, 1);
            continue;
        }
        order.events.shift();
    }
}

function toOrderRecord(order) {
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

async function persistOrder(order) {
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

// System health monitoring
function getSystemHealth() {
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
    };
}

// ═══════════════════════════════════════════════════════════
// REST API
// ═══════════════════════════════════════════════════════════

app.use(express.json());

// PUBLIC: Generate a pairing code (called from laptop CLI)
app.post('/pair', (req, res) => {
    currentPairingCode = createPairingCode();
    if (codeRefreshCallback) codeRefreshCallback(currentPairingCode);
    const snapshot = getCurrentPairingSnapshot();

    if (!silentMode) {
        console.log(`\n  🔑 Pairing code generated: ${snapshot?.code || 'N/A'}`);
        console.log(`     Expires in ${snapshot?.expiresIn ?? 0}s\n`);
    }

    if (!snapshot) return res.status(500).json({ error: 'Failed to generate pairing code' });

    res.json({
        code: snapshot.code,
        expiresIn: snapshot.expiresIn,
        qrData: snapshot.qrData,
        connectUrls: snapshot.connectTargets,
        connectUrl: snapshot.connectUrl,
    });
});

// PUBLIC: Get the currently active pairing code snapshot (for diagnostics / QR location)
app.get('/pair/current', (req, res) => {
    const snapshot = getCurrentPairingSnapshot();
    if (!snapshot) {
        return res.status(404).json({ error: 'No active pairing code' });
    }
    res.json(snapshot);
});

// LOCAL ONLY: Register runtime tunnel targets without restarting daemon
app.post('/api/system/tunnel-targets', (req, res) => {
    if (!isLocalRequest(req)) {
        return res.status(403).json({ error: 'Tunnel target registration is local-only' });
    }

    const rawUrls = Array.isArray(req.body?.urls) ? req.body.urls : [];
    const normalized = rawUrls
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean)
        .map((value) => value.replace(/\/$/, ''));

    runtimeTunnelBaseUrls.clear();
    for (const url of normalized) runtimeTunnelBaseUrls.add(url);

    res.json({ success: true, tunnelUrls: Array.from(runtimeTunnelBaseUrls) });
});

app.get('/api/system/tunnel-targets', (req, res) => {
    if (!isLocalRequest(req)) {
        return res.status(403).json({ error: 'Tunnel target query is local-only' });
    }
    res.json({ tunnelUrls: Array.from(runtimeTunnelBaseUrls) });
});

// LOCAL ONLY: Update pairing runtime config (web app URL + tunnel URLs)
app.post('/api/system/pairing-config', (req, res) => {
    if (!isLocalRequest(req)) {
        return res.status(403).json({ error: 'Pairing config update is local-only' });
    }

    const nextWebapp = typeof req.body?.webappUrl === 'string' ? req.body.webappUrl.trim() : '';
    if (nextWebapp) {
        webappBaseUrl = nextWebapp.replace(/\/$/, '');
    }

    if (Array.isArray(req.body?.tunnelUrls)) {
        runtimeTunnelBaseUrls.clear();
        for (const value of req.body.tunnelUrls) {
            if (typeof value !== 'string') continue;
            const cleaned = value.trim().replace(/\/$/, '');
            if (cleaned) runtimeTunnelBaseUrls.add(cleaned);
        }
    }

    res.json({
        success: true,
        webappUrl: webappBaseUrl,
        tunnelUrls: Array.from(runtimeTunnelBaseUrls),
    });
});

app.get('/api/system/pairing-config', (req, res) => {
    if (!isLocalRequest(req)) {
        return res.status(403).json({ error: 'Pairing config query is local-only' });
    }
    res.json({
        webappUrl: webappBaseUrl,
        tunnelUrls: Array.from(runtimeTunnelBaseUrls),
    });
});

// PUBLIC: Validate a pairing code and get a session token
app.post('/pair/validate', (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Missing pairing code' });

    const token = validatePairingCode(code.toString().trim());
    if (!token) {
        return res.status(401).json({ error: 'Invalid or expired pairing code' });
    }

    if (!silentMode) console.log(`  ✅ Device paired successfully (code: ${code})`);
    res.json({ token, expiresIn: Math.round(SESSION_EXPIRY_MS / 1000), hostname: os.hostname() });
});

// PUBLIC: /api/pair — ConnectPage calls this with { code }
app.post('/api/pair', (req, res) => {
    const { code } = req.body || {};
    if (!code) return res.status(400).json({ error: 'Missing code' });
    const token = validatePairingCode(code.toString().trim());
    if (!token) return res.status(401).json({ error: 'Invalid or expired pairing code', success: false });
    if (!silentMode) console.log(`  Paired via /api/pair (code: ${code})`);
    res.json({ success: true, token, hostname: os.hostname(), expiresIn: Math.round(SESSION_EXPIRY_MS / 1000) });
});

// AUTHENTICATED: Check installed CLIs for the onboarding flow
app.get('/api/system/check-clis', requireAuth, (req, res) => {
    const clis = {
        gemini: 'gemini',
        claude: 'claude',
        copilot: 'gh',
        supabase: 'supabase',
        vercel: 'vercel',
        git: 'git'
    };

    const results = {};
    for (const [key, bin] of Object.entries(clis)) {
        try {
            execSync(`which ${bin}`, { timeout: 1000 });
            results[key] = { installed: true };
            if (key === 'copilot') {
                try {
                    const exts = execSync('gh extension list 2>/dev/null', { timeout: 3000 }).toString();
                    results[key].ready = exts.includes('copilot');
                } catch {
                    results[key].ready = false;
                }
            } else if (key === 'supabase' || key === 'vercel' || key === 'git' || key === 'gemini' || key === 'claude') {
                results[key].ready = true; // Assume ready if installed for now
            }
        } catch {
            results[key] = { installed: false, ready: false };
        }
    }
    res.json(results);
});

// AUTHENTICATED: Manage CLI (Install/Uninstall)
app.post('/api/system/manage-cli', express.json(), requireAuth, (req, res) => {
    const { action, cli } = req.body;
    
    const packages = {
        gemini: '@google/gemini-cli',
        claude: '@anthropic-ai/claude-code',
        supabase: 'supabase',
        vercel: 'vercel',
        copilot: '@github/copilot' // GitHub copilot extension handled separately if needed
    };

    if (!packages[cli] && cli !== 'copilot') {
        return res.status(400).json({ error: 'Unsupported CLI' });
    }

    try {
        if (action === 'install') {
            if (cli === 'copilot') {
                execSync('gh extension install github/gh-copilot', { stdio: 'inherit' });
            } else if (cli === 'supabase') {
                execSync('brew install supabase/tap/supabase || npm install -g supabase', { stdio: 'inherit' });
            } else {
                execSync(`npm install -g ${packages[cli]}`, { stdio: 'inherit' });
            }
        } else if (action === 'uninstall') {
            if (cli === 'copilot') {
                execSync('gh extension remove github/gh-copilot', { stdio: 'inherit' });
            } else if (cli === 'supabase') {
                execSync('brew uninstall supabase || npm uninstall -g supabase', { stdio: 'inherit' });
            } else {
                execSync(`npm uninstall -g ${packages[cli]}`, { stdio: 'inherit' });
            }
        } else {
            return res.status(400).json({ error: 'Invalid action' });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUBLIC: List available CLI agents with detailed status
app.get('/api/agents', (req, res) => {
    const binaries = {
        gemini: 'gemini',
        claude: 'claude',
        gh: 'gh',
        kiro: 'kiro-cli',
        ollama: 'ollama',
    };

    const results = {};
    for (const [key, bin] of Object.entries(binaries)) {
        try {
            // Use --version to ensure the binary is actually executable, not just a broken symlink
            execSync(`${bin} --version`, { timeout: 1500, stdio: 'ignore' });
            results[key] = true;
        } catch {
            results[key] = false;
        }
    }

    // Check if Ollama is actually running (not just installed)
    let ollamaRunning = false;
    if (results.ollama) {
        try {
            execSync('curl -s --max-time 1 http://localhost:11434/api/tags > /dev/null 2>&1', { timeout: 2000 });
            ollamaRunning = true;
        } catch { /* ollama installed but not running */ }
    }

    // Check if gh copilot extension is available (gh alone isn't enough)
    let copilotReady = false;
    if (results.gh) {
        try {
            const exts = execSync('gh extension list 2>/dev/null', { timeout: 3000 }).toString();
            copilotReady = exts.includes('copilot');
        } catch { /* gh installed but copilot extension missing */ }
    }

    // Map binary → agent id with detailed availability
    const agentStatus = {
        gemini:        { installed: results.gemini, ready: results.gemini, tier: 'free' },
        'claude-code': { installed: results.claude, ready: results.claude, tier: 'premium' },
        copilot:       { installed: results.gh, ready: copilotReady, tier: 'freemium' },
        kiro:          { installed: results.kiro, ready: results.kiro, tier: 'premium', reliability: 'low' },
        ollama:        { installed: results.ollama, ready: ollamaRunning, tier: 'free' },
    };

    // Also return simple boolean map for backwards compat
    const simple = {
        gemini:        results.gemini,
        'claude-code': results.claude,
        copilot:       copilotReady,
        kiro:          results.kiro,
        ollama:        ollamaRunning,
    };

    // Return detailed if requested, simple otherwise
    if (req.query.detailed === 'true') {
        res.json({ agents: agentStatus, available: Object.entries(simple).filter(([,v]) => v).map(([k]) => k) });
    } else {
        res.json(simple);
    }
});

// PUBLIC: Classify a prompt to best agent (uses best available free model)
app.post('/api/classify', express.json(), async (req, res) => {
  const { prompt, availableAgents = [] } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

  const agentList = availableAgents.length ? availableAgents : ['claude-code', 'gemini', 'copilot', 'kiro', 'ollama'];
  const specialistList = ['dev', 'architect', 'ai-engineer', 'devops', 'security', 'designer', 'ux-designer', 'researcher', 'analyst', 'strategist', 'pm', 'contentwriter', 'techwriter'];

  const classifyPrompt = `Task classifier. Reply with ONLY JSON, no explanation.
Given this task: "${prompt.slice(0, 300)}"
Pick the best: cliAgent (one of: ${agentList.join(', ')}) and specialist (one of: ${specialistList.join(', ')})
Reply ONLY with: {"cliAgent":"...","specialist":"..."}`;

  // Try gh copilot first (free model, most capable)
  try {
    const out = execSync(
      `gh copilot suggest ${JSON.stringify(classifyPrompt)} --target shell 2>/dev/null`,
      { timeout: 5000, encoding: 'utf8' }
    ).trim();
    const match = out.match(/\{[\s\S]*?\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (agentList.includes(parsed.cliAgent) && specialistList.includes(parsed.specialist)) {
        return res.json({ ...parsed, method: 'copilot' });
      }
    }
  } catch { /* fall through */ }

  // Try Gemini CLI
  try {
    const out = execSync(
      `gemini -p ${JSON.stringify(classifyPrompt)} 2>/dev/null`,
      { timeout: 5000, encoding: 'utf8' }
    ).trim();
    const match = out.match(/\{[\s\S]*?\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (agentList.includes(parsed.cliAgent) && specialistList.includes(parsed.specialist)) {
        return res.json({ ...parsed, method: 'gemini' });
      }
    }
  } catch { /* fall through */ }

  // Try Ollama
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 2000);
    const r = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'qwen2.5:0.5b', prompt: classifyPrompt, stream: false, options: { temperature: 0, num_predict: 64 } }),
      signal: controller.signal,
    });
    if (r.ok) {
      const data = await r.json();
      const match = (data.response || '').match(/\{[\s\S]*?\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (agentList.includes(parsed.cliAgent)) {
          return res.json({ ...parsed, method: 'ollama' });
        }
      }
    }
  } catch { /* fall through */ }

  // Keyword fallback (done in frontend, but return 503 to signal use local)
  return res.status(503).json({ error: 'No classifier available', method: 'local' });
});

// PUBLIC: Health check (no auth needed — useful for discovery)
app.get('/health', (req, res) => {
    res.json({ ...getSystemHealth(), authenticated: false, port: activePort, lanIPs: getLocalIPs(), hostname: os.hostname() });
});

// AUTHENTICATED: Full health with session info
app.get('/health/full', requireAuth, (req, res) => {
    const token = req.headers['x-soupz-token'] || req.query.token;
    const session = activeSessions.get(token);
    res.json({
        ...getSystemHealth(),
        authenticated: true,
        session: {
            connectedSince: session?.createdAt,
            lastSeen: session?.lastSeen,
            activeSessions: activeSessions.size,
            activeTerminals: terminals.size,
        },
    });
});

// AUTHENTICATED: List terminals
app.get('/terminals', requireAuth, (req, res) => {
    const list = [];
    for (const [id, t] of terminals) {
        list.push(buildTerminalSummary(id, t));
    }
    res.json(list);
});

// Agent binary map for checking availability at order time
const AGENT_BINARY_MAP = {
    'gemini': 'gemini',
    'claude-code': 'claude',
    'copilot': 'gh',
    'kiro': 'kiro-cli',
    'ollama': 'ollama',
};

const AUTO_ENABLE_KIRO = process.env.SOUPZ_ENABLE_KIRO_AUTO === 'true';
const DEFAULT_DEEP_WORKERS = Math.max(1, Number.parseInt(process.env.SOUPZ_DEEP_WORKER_COUNT || '4', 10) || 4);
const DEFAULT_SPECIALIST_SEQUENCE = ['architect', 'researcher', 'strategist', 'pm', 'developer', 'designer', 'qa', 'devops', 'analyst', 'evaluator', 'finance', 'security'];

// Ordered fallback chain — try free agents first
const AGENT_FALLBACK_CHAIN = ['gemini', 'copilot', 'ollama', 'claude-code'];
const MAX_DEEP_WORKERS = Math.max(
    DEFAULT_DEEP_WORKERS,
    Number.parseInt(process.env.SOUPZ_DEEP_WORKER_MAX || '64', 10) || 64,
);

function isAgentInstalled(agentId) {
    const bin = AGENT_BINARY_MAP[agentId];
    if (!bin) return false;
    try { execSync(`which ${bin}`, { timeout: 1000 }); return true; } catch { return false; }
}

function resolveRunAgent(requestedAgent) {
    // If requested agent is installed, use it
    if (requestedAgent !== 'auto' && isAgentInstalled(requestedAgent)) {
        return { agent: requestedAgent, fallback: false };
    }
    // Otherwise, walk the fallback chain
    for (const candidate of AGENT_FALLBACK_CHAIN) {
        if (isAgentInstalled(candidate)) {
            return { agent: candidate, fallback: requestedAgent !== 'auto', originalRequest: requestedAgent };
        }
    }
    // Last resort — try the configured web agent
    const envAgent = (process.env.SOUPZ_WEB_AGENT || 'gemini').trim();
    return { agent: envAgent, fallback: true, originalRequest: requestedAgent };
}

function getInstalledAgentsInPriorityOrder() {
    const ordered = ['gemini', 'copilot', 'ollama', 'claude-code', 'kiro'];
    return ordered.filter((id) => isAgentInstalled(id));
}

function isPathInside(parent, candidate) {
    try {
        const rel = relative(resolve(parent), resolve(candidate));
        return rel === '' || (!rel.startsWith('..') && !rel.includes(':'));
    } catch {
        return false;
    }
}

function inferExecutionRole(agentId, prompt = '') {
    const text = String(prompt || '').toLowerCase();

    if (/\b(ui|ux|design|visual|layout|css|theme|accessibility)\b/.test(text)) {
        return agentId === 'ollama' ? 'researcher' : 'designer';
    }
    if (/\b(product|user journey|experience|workflow|persona|journey|interaction|frontend|web app|mobile app)\b/.test(text)) {
        return agentId === 'ollama' ? 'researcher' : 'designer';
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
        copilot: 'developer',
        gemini: 'analyst',
        ollama: 'researcher',
        'claude-code': 'architect',
        kiro: 'devops',
    };
    return defaults[agentId] || 'developer';
}

function inferSpecialistsFromPrompt(prompt = '', count = DEFAULT_DEEP_WORKERS) {
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

function estimateDeepWorkerCount(prompt = '', requestedWorkerCount = null) {
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

function specialistFocusSummary(specialist) {
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

function analyzePromptIntent(prompt = '') {
    const text = String(prompt || '');
    const lower = text.toLowerCase();
    const lines = text.split(/\r?\n/).length;

    return {
        isHackathon: /\b(hackathon|finalist|judg(e|ing)|demo day|cross[-\s]?question|pitch)\b/.test(lower),
        needsResearch: /\b(research|competitor|benchmark|references?|market|survey)\b/.test(lower),
        needsFeasibility: /\b(feasible|feasibility|constraints?|trade-?offs?|realistic|timeline)\b/.test(lower),
        needsExecutionPlan: /\b(execution plan|roadmap|milestone|sprint|timeline|how to build)\b/.test(lower),
        needsCrossQuestionPrep: /\b(cross[-\s]?question|objection|defend|judge q&a|grill)\b/.test(lower),
        isBroadScope: lines >= 80 || /\b(end[-\s]?to[-\s]?end|full stack|complete system|production grade)\b/.test(lower),
    };
}

function buildDeepExecutionPolicy(prompt = '') {
    const intent = analyzePromptIntent(prompt);

    const policyLines = [
        'Execution policy (auto-injected by orchestrator):',
        '- Optimize for correctness, feasibility, and implementation realism over cosmetic language.',
        '- Every major claim must include at least one concrete justification, assumption, or tradeoff.',
        '- Produce output that can be converted directly into engineering tasks and review checklists.',
    ];

    if (intent.isHackathon) {
        policyLines.push('- Treat this as a competitive hackathon scenario: include judge-facing differentiation and demo defense points.');
    }
    if (intent.needsResearch || intent.isHackathon) {
        policyLines.push('- Include compact research synthesis: alternatives considered, why chosen approach wins, and known limitations.');
    }
    if (intent.needsFeasibility || intent.isBroadScope) {
        policyLines.push('- Add feasibility pass: risk table, dependency assumptions, and fallback path if critical components fail.');
    }
    if (intent.needsExecutionPlan || intent.isBroadScope) {
        policyLines.push('- Include phased execution plan: immediate MVP, stretch goals, and explicit time/cost constraints.');
    }
    if (intent.needsCrossQuestionPrep || intent.isHackathon) {
        policyLines.push('- Add cross-question prep: likely judge objections and concise, evidence-driven rebuttals.');
    }

    const outputContract = [
        'Output contract:',
        '1) Problem framing + assumptions',
        '2) Feasibility and tradeoffs',
        '3) Technical plan with implementation steps',
        '4) Risks, mitigations, and validation checklist',
        '5) Judge/defense notes (when relevant)',
    ];

    return {
        intent,
        policyText: [...policyLines, '', ...outputContract].join('\n'),
    };
}

function extractJsonObject(text = '') {
    const raw = String(text || '').trim();
    if (!raw) return null;

    try {
        return JSON.parse(raw);
    } catch {
        // Continue with object-fragment extraction.
    }

    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
        const fragment = raw.slice(start, end + 1);
        try {
            return JSON.parse(fragment);
        } catch {
            return null;
        }
    }
    return null;
}

function normalizePlannerSpecialists(items = [], targetCount = DEFAULT_DEEP_WORKERS) {
    const allowed = new Set([...DEFAULT_SPECIALIST_SEQUENCE, 'developer']);
    const normalized = [];

    for (const item of Array.isArray(items) ? items : []) {
        const name = String(item?.name || item?.specialist || '').trim().toLowerCase();
        if (!allowed.has(name)) continue;
        if (normalized.some((s) => s.name === name)) continue;
        normalized.push({
            name,
            focus: String(item?.focus || specialistFocusSummary(name)).trim() || specialistFocusSummary(name),
        });
    }

    for (const fallback of DEFAULT_SPECIALIST_SEQUENCE) {
        if (normalized.length >= targetCount) break;
        if (normalized.some((s) => s.name === fallback)) continue;
        normalized.push({ name: fallback, focus: specialistFocusSummary(fallback) });
    }

    return normalized.slice(0, targetCount);
}

function normalizePlannerIntent(input = {}) {
    const base = analyzePromptIntent('');
    return {
        isHackathon: input?.isHackathon === true || base.isHackathon,
        needsResearch: input?.needsResearch === true || base.needsResearch,
        needsFeasibility: input?.needsFeasibility === true || base.needsFeasibility,
        needsExecutionPlan: input?.needsExecutionPlan === true || base.needsExecutionPlan,
        needsCrossQuestionPrep: input?.needsCrossQuestionPrep === true || base.needsCrossQuestionPrep,
        isBroadScope: input?.isBroadScope === true || base.isBroadScope,
    };
}

function normalizePlannerQuestions(items = []) {
    const questions = [];
    for (const [idx, raw] of (Array.isArray(items) ? items : []).entries()) {
        const question = String(raw?.question || raw?.prompt || '').trim();
        const options = Array.isArray(raw?.options) ? raw.options : [];
        const normalizedOptions = options
            .map((opt, oIdx) => {
                const id = String(opt?.id || `opt_${oIdx + 1}`).trim();
                const label = String(opt?.label || opt?.text || '').trim();
                const description = String(opt?.description || '').trim();
                if (!id || !label) return null;
                return { id, label, description, recommended: opt?.recommended === true };
            })
            .filter(Boolean)
            .slice(0, 8);

        if (!question || normalizedOptions.length < 2) continue;
        questions.push({
            id: String(raw?.id || `q_${idx + 1}`).trim() || `q_${idx + 1}`,
            question,
            multiSelect: raw?.multiSelect === true,
            required: raw?.required !== false,
            options: normalizedOptions,
        });
    }
    return questions.slice(0, 8);
}

function buildFallbackClarifyingQuestions(intent = {}) {
    const base = [
        {
            id: 'priority_axis',
            question: 'What should the orchestrator optimize for first?',
            multiSelect: false,
            required: true,
            options: [
                { id: 'ship_fast', label: 'Speed to MVP', description: 'Prefer fastest demo-ready delivery path.', recommended: true },
                { id: 'technical_depth', label: 'Technical depth', description: 'Prefer robust architecture and deeper implementation detail.', recommended: false },
                { id: 'judge_defense', label: 'Judge defense', description: 'Prefer tradeoffs, rationale, and objection handling.', recommended: false },
            ],
        },
        {
            id: 'output_shape',
            question: 'Which output shape should be emphasized?',
            multiSelect: false,
            required: true,
            options: [
                { id: 'implementation_first', label: 'Implementation-first', description: 'Concrete APIs, schema, and execution steps.', recommended: true },
                { id: 'strategy_first', label: 'Strategy-first', description: 'Problem framing, positioning, and evaluation criteria.', recommended: false },
                { id: 'balanced_output', label: 'Balanced', description: 'Equal focus on implementation and strategy.', recommended: false },
            ],
        },
    ];

    if (intent?.isHackathon || intent?.needsCrossQuestionPrep) {
        base.push({
            id: 'demo_mode',
            question: 'How aggressive should demo framing be?',
            multiSelect: false,
            required: false,
            options: [
                { id: 'safe_demo', label: 'Safe and reliable', description: 'Minimize risk and keep flow stable.', recommended: true },
                { id: 'showcase_demo', label: 'High-impact showcase', description: 'Highlight bold differentiators for judges.', recommended: false },
            ],
        });
    }

    return normalizePlannerQuestions(base);
}

async function planDeepExecutionWithAI({ prompt, plannerAgent, cwd, mcpServers, timeoutMs = 25000, plannerStyle = 'balanced', plannerNotes = '' }) {
    const style = String(plannerStyle || 'balanced').trim().toLowerCase();
    const notes = String(plannerNotes || '').trim();
    const planningPrompt = [
        'System role: You are an orchestration planner for a multi-agent coding daemon.',
        'Task: Produce an execution plan for deep parallel work. Reply with ONLY valid JSON and no surrounding markdown.',
        `Planning style requested by user: ${style}.`,
        notes ? `User planner notes: ${notes}` : 'User planner notes: none.',
        'Constraints:',
        `- workerCount must be an integer between 1 and ${MAX_DEEP_WORKERS}.`,
        `- specialist names must be chosen from: ${DEFAULT_SPECIALIST_SEQUENCE.join(', ')}.`,
        '- Provide 1 focus sentence per specialist.',
        '- Prefer feasibility and concrete implementation over generic advice.',
        '- If hackathon-like, include defense-oriented preparation cues in policy lines.',
        'JSON schema:',
        '{',
        '  "workerCount": number,',
        '  "intent": {',
        '    "isHackathon": boolean,',
        '    "needsResearch": boolean,',
        '    "needsFeasibility": boolean,',
        '    "needsExecutionPlan": boolean,',
        '    "needsCrossQuestionPrep": boolean,',
        '    "isBroadScope": boolean',
        '  },',
        '  "policyLines": [string, string, ...],',
        '  "specialists": [',
        '    { "name": string, "focus": string }',
        '  ],',
        '  "clarifyingQuestions": [',
        '    {',
        '      "id": string,',
        '      "question": string,',
        '      "multiSelect": boolean,',
        '      "required": boolean,',
        '      "options": [',
        '        { "id": string, "label": string, "description": string, "recommended": boolean }',
        '      ]',
        '    }',
        '  ]',
        '}',
        'User task to plan:',
        prompt,
    ].join('\n');

    const planResult = await runChildAgent({
        agent: plannerAgent,
        prompt: planningPrompt,
        cwd,
        mcpServers,
        timeoutMs,
    });

    if ((planResult?.code ?? 1) !== 0) {
        return { ok: false, reason: 'planner_non_zero_exit', stderr: planResult?.stderr || '' };
    }

    const parsed = extractJsonObject(planResult?.stdout || '');
    if (!parsed || typeof parsed !== 'object') {
        return { ok: false, reason: 'planner_invalid_json' };
    }

    const requestedCount = Number.parseInt(parsed.workerCount, 10);
    const workerCount = Number.isFinite(requestedCount)
        ? Math.max(1, Math.min(MAX_DEEP_WORKERS, requestedCount))
        : null;
    const specialists = normalizePlannerSpecialists(parsed.specialists, workerCount || DEFAULT_DEEP_WORKERS);
    const intent = normalizePlannerIntent(parsed.intent || {});
    const policyLines = Array.isArray(parsed.policyLines)
        ? parsed.policyLines.map((line) => String(line || '').trim()).filter(Boolean).slice(0, 14)
        : [];
    const clarifyingQuestions = normalizePlannerQuestions(parsed.clarifyingQuestions);

    if (specialists.length === 0) {
        return { ok: false, reason: 'planner_empty_specialists' };
    }

    return {
        ok: true,
        workerCount,
        specialists,
        intent,
        policyLines,
        plannerAgent,
        clarifyingQuestions,
    };
}

function createInputAnswerSummary(questions = [], answers = {}) {
    const lines = [];
    for (const q of questions) {
        const selected = Array.isArray(answers?.[q.id]) ? answers[q.id] : [];
        if (selected.length === 0) continue;
        const optionLabels = selected
            .map((id) => q.options.find((opt) => opt.id === id)?.label || id)
            .join(', ');
        lines.push(`- ${q.question}: ${optionLabels}`);
    }
    return lines;
}

async function waitForOrderInput(order, runtime, questions = [], timeoutMs = 10 * 60 * 1000) {
    if (!runtime || !Array.isArray(questions) || questions.length === 0) {
        return { answers: {}, timedOut: false, skipped: true };
    }

    return await new Promise((resolve) => {
        const request = {
            questions,
            createdAt: Date.now(),
            resolve,
            timeoutHandle: null,
        };
        runtime.inputRequest = request;

        order.status = 'waiting_input';
        order.pendingQuestions = questions;
        order.pendingAnswers = {};
        pushOrderEvent(order, 'input.requested', { questionCount: questions.length, timeoutMs });
        void persistOrder(order);
        broadcastOrderUpdate(order);

        request.timeoutHandle = setTimeout(() => {
            if (runtime.inputRequest !== request) return;
            runtime.inputRequest = null;
            order.status = 'running';
            order.pendingQuestions = [];
            order.pendingAnswers = {};
            pushOrderEvent(order, 'input.timed_out', { questionCount: questions.length });
            void persistOrder(order);
            broadcastOrderUpdate(order);
            resolve({ answers: {}, timedOut: true, skipped: false });
        }, Math.max(15000, timeoutMs));
    });
}

function submitOrderInput(order, runtime, answers = {}) {
    const request = runtime?.inputRequest;
    if (!request) {
        return { ok: false, status: 409, error: 'No pending input request for this order' };
    }

    const normalized = {};
    for (const q of request.questions) {
        const raw = answers?.[q.id];
        const selected = Array.isArray(raw) ? raw : (raw ? [raw] : []);
        const valid = selected
            .map((v) => String(v || '').trim())
            .filter((id) => q.options.some((opt) => opt.id === id));
        const unique = [...new Set(valid)];
        if (unique.length === 0 && q.required) {
            return { ok: false, status: 400, error: `Missing selection for required question: ${q.id}` };
        }
        normalized[q.id] = q.multiSelect ? unique : unique.slice(0, 1);
    }

    if (request.timeoutHandle) clearTimeout(request.timeoutHandle);
    runtime.inputRequest = null;

    order.status = 'running';
    order.pendingQuestions = [];
    order.pendingAnswers = normalized;
    pushOrderEvent(order, 'input.received', { answers: normalized });
    void persistOrder(order);
    broadcastOrderUpdate(order);

    request.resolve({ answers: normalized, timedOut: false, skipped: false });
    return { ok: true };
}

function summarizePromptForWorkspace(prompt = '', maxChars = 3000) {
    const text = String(prompt || '').trim();
    if (text.length <= maxChars) return text;
    return `${text.slice(0, maxChars)}\n\n[truncated ${text.length - maxChars} chars for workspace brief]`;
}

function registerCreatedFile(order, filePath) {
    if (!order || !filePath) return;
    if (!Array.isArray(order.createdFiles)) order.createdFiles = [];
    if (!order.createdFiles.includes(filePath)) {
        order.createdFiles.push(filePath);
    }
}

function toWorkspaceRelativePath(cwd, filePath) {
    try {
        const root = resolve(cwd || REPO_ROOT);
        const rel = relative(root, filePath);
        return rel && !rel.startsWith('..') ? rel : filePath;
    } catch {
        return filePath;
    }
}

async function initializeDeepWorkspaceArtifacts(order, workers, workerMeta, executionPolicy) {
    const cwd = resolve(order.cwd || REPO_ROOT);
    const runRoot = join(cwd, '.soupz-runs', order.id);
    if (!isPathInside(cwd, runRoot)) {
        throw new Error('artifact_root_outside_workspace');
    }

    await mkdir(runRoot, { recursive: true });
    const briefPath = join(runRoot, 'RUN_BRIEF.md');
    const sharedPath = join(runRoot, 'SHARED_MEMORY.md');

    const workerPlan = workers.map((w, idx) => {
        const meta = workerMeta[w.workerId] || {};
        return `${idx + 1}. ${w.workerId} (${w.agent}) - specialist: ${meta.specialist || 'developer'} - focus: ${meta.focus || 'implementation guidance'}`;
    }).join('\n');

    const brief = [
        `# Soupz Deep Run ${order.id}`,
        '',
        '## Task',
        summarizePromptForWorkspace(order.prompt),
        '',
        '## Execution Policy',
        executionPolicy,
        '',
        '## Worker Plan',
        workerPlan,
        '',
        '## Notes',
        '- Worker outputs are persisted as markdown files in this folder.',
        '- SHARED_MEMORY.md aggregates distilled learnings from all workers + synthesis.',
    ].join('\n');

    await writeFile(briefPath, brief, 'utf8');
    await writeFile(sharedPath, '# Shared Memory\n\n', 'utf8');

    registerCreatedFile(order, toWorkspaceRelativePath(cwd, briefPath));
    registerCreatedFile(order, toWorkspaceRelativePath(cwd, sharedPath));

    return { cwd, runRoot, briefPath, sharedPath };
}

async function persistWorkerArtifact(order, artifactContext, workerId, agent, workerMetaInfo, result) {
    if (!artifactContext) return;
    const safeWorkerId = String(workerId || 'worker').replace(/[^a-zA-Z0-9-_]/g, '_');
    const workerFile = join(artifactContext.runRoot, `${safeWorkerId}.md`);
    const body = [
        `# ${safeWorkerId}`,
        '',
        `- Agent: ${agent}`,
        `- Specialist: ${workerMetaInfo?.specialist || 'developer'}`,
        `- Focus: ${workerMetaInfo?.focus || 'implementation guidance'}`,
        `- Exit code: ${result?.code ?? 1}`,
        `- Timed out: ${result?.timedOut ? 'yes' : 'no'}`,
        '',
        '## Output',
        '```text',
        String(result?.stdout || result?.stderr || '').slice(0, 70000),
        '```',
    ].join('\n');

    await writeFile(workerFile, body, 'utf8');
    registerCreatedFile(order, toWorkspaceRelativePath(artifactContext.cwd, workerFile));

    const sharedSnippet = [
        `## ${safeWorkerId}`,
        `Agent: ${agent} | Specialist: ${workerMetaInfo?.specialist || 'developer'} | Exit: ${result?.code ?? 1}`,
        '',
        String(result?.stdout || result?.stderr || '').slice(0, 3000),
        '',
    ].join('\n');
    await writeFile(artifactContext.sharedPath, sharedSnippet, { encoding: 'utf8', flag: 'a' });
}

async function persistSynthesisArtifact(order, artifactContext, synthesisText, synthesisMeta = {}) {
    if (!artifactContext) return;
    const synthesisPath = join(artifactContext.runRoot, 'FINAL_SYNTHESIS.md');
    const body = [
        '# Final Synthesis',
        '',
        `- Agent: ${synthesisMeta.agent || 'unknown'}`,
        `- Exit code: ${synthesisMeta.exitCode ?? 1}`,
        `- Fallback used: ${synthesisMeta.fallbackUsed ? 'yes' : 'no'}`,
        '',
        String(synthesisText || '').trim() || '_No synthesis output produced._',
    ].join('\n');

    await writeFile(synthesisPath, body, 'utf8');
    registerCreatedFile(order, toWorkspaceRelativePath(artifactContext.cwd, synthesisPath));

    const sharedSnippet = [
        '## Synthesis',
        String(synthesisText || '').slice(0, 5000),
        '',
    ].join('\n');
    await writeFile(artifactContext.sharedPath, sharedSnippet, { encoding: 'utf8', flag: 'a' });
}

function toTitleToken(text = '') {
    return String(text)
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function getAgentRuntimeReadiness(agentId, cwd = REPO_ROOT) {
    if (!isAgentInstalled(agentId)) {
        return { ready: false, reason: 'not_installed' };
    }

    if (agentId === 'gemini' && !isPathInside(REPO_ROOT, cwd)) {
        return { ready: false, reason: 'workspace_mismatch' };
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
    }

    if (agentId === 'kiro' && !AUTO_ENABLE_KIRO) {
        return { ready: false, reason: 'disabled_by_default' };
    }

    return { ready: true, reason: 'ready' };
}

function getReadyAgentsInPriorityOrder(cwd = REPO_ROOT) {
    const installed = getInstalledAgentsInPriorityOrder();
    const ready = [];
    const skipped = [];

    for (const agent of installed) {
        const state = getAgentRuntimeReadiness(agent, cwd);
        if (state.ready) {
            ready.push(agent);
        } else {
            skipped.push({ agent, reason: state.reason });
        }
    }

    return { installed, ready, skipped };
}

async function resolveAutoRunAgent(prompt, cwd = REPO_ROOT) {
    const { installed, ready, skipped } = getReadyAgentsInPriorityOrder(cwd);

    if (installed.length === 0) {
        const fallback = resolveRunAgent('auto');
        return { agent: fallback.agent, method: 'fallback-chain', available: [] };
    }

    if (ready.length === 0) {
        return { agent: installed[0], method: 'installed-not-ready-fallback', available: installed, ready: [], skipped };
    }

    try {
        const picked = await selectAgent(prompt, ready);
        if (picked && ready.includes(picked)) {
            return { agent: picked, method: 'classifier', available: installed, ready, skipped };
        }
    } catch {
        // Fall through to deterministic fallback.
    }

    return { agent: ready[0], method: 'priority-fallback', available: installed, ready, skipped };
}

function selectParallelWorkers(primaryAgent, maxWorkers = DEFAULT_DEEP_WORKERS, cwd = REPO_ROOT, deepPolicy = {}) {
    const { ready, skipped } = getReadyAgentsInPriorityOrder(cwd);
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

function startSingleAgentOrder(order, runAgent, mcpServers) {
    const runtime = createOrderRuntime(order);
    const args = [CLI_ENTRY, 'ask', runAgent, order.prompt];

    const spawnEnv = { ...process.env };
    if (mcpServers.length > 0) {
        spawnEnv.SOUPZ_MCP_SERVERS = JSON.stringify(mcpServers);
    }

    const child = spawn(process.execPath, args, {
        cwd: order.cwd,
        env: spawnEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    registerOrderChild(runtime, 'single', child, { kind: 'single', agent: runAgent });

    let settled = false;

    const finalize = (status, payload = {}) => {
        if (settled) return;
        settled = true;
        flushOrderOutputDeltas(order, runtime, 'single:');
        order.finishedAt = nowIso();
        if (payload.exitCode !== undefined) order.exitCode = payload.exitCode;
        if (runtime.cancelRequested) {
            order.status = 'cancelled';
            order.cancelRequested = true;
            pushOrderEvent(order, 'order.cancelled', { mode: 'single', reason: runtime.cancelReason || 'cancel_requested', ...payload });
        } else {
            order.status = status;
            pushOrderEvent(order, status === 'completed' ? 'order.completed' : 'order.failed', {
                mode: 'single',
                ...payload,
            });
        }
        void persistOrder(order);
        broadcastOrderUpdate(order);
        cleanupOrderRuntime(order.id);
    };

    order.pid = child.pid;
    order.status = 'running';
    order.startedAt = nowIso();
    pushOrderEvent(order, 'chef.started', { pid: child.pid, mode: 'ask', agent: runAgent });
    void persistOrder(order);
    broadcastOrderUpdate(order);

    child.stdout.on('data', (chunk) => {
        const text = chunk.toString();
        touchOrderChild(runtime, 'single');
        order.stdout += text;
        if (order.stdout.length > 200000) order.stdout = order.stdout.slice(-200000);
        appendLaneBuffer(order, runAgent, text);
        pushOrderOutputDelta(order, runtime, 'single:stdout', 'chef.output.delta', { stream: 'stdout', chars: text.length, agent: runAgent });
        const streamMsg = JSON.stringify({ type: 'agent_chunk', orderId: order.id, chunk: toStreamChunk(text), agentId: runAgent });
        for (const client of wss.clients) {
            if (client.readyState === 1 && authenticatedClients.has(client)) {
                client.send(streamMsg);
            }
        }
    });

    child.stderr.on('data', (chunk) => {
        const text = chunk.toString();
        touchOrderChild(runtime, 'single');
        order.stderr += text;
        if (order.stderr.length > 120000) order.stderr = order.stderr.slice(-120000);
        appendLaneBuffer(order, runAgent, `[stderr] ${text}`);
        pushOrderOutputDelta(order, runtime, 'single:stderr', 'chef.output.delta', { stream: 'stderr', chars: text.length, agent: runAgent });
    });

    child.on('error', (err) => {
        finalize('failed', { message: err.message, exitCode: 1 });
    });

    child.on('close', (code) => {
        if (code === 0) {
            finalize('completed', { exitCode: code });
        } else {
            finalize('failed', { exitCode: code });
        }
    });
}

async function runChildAgent({ agent, prompt, cwd, mcpServers, onStdout, onStderr, runtime, childKey, childMeta, timeoutMs = 0 }) {
    const args = [CLI_ENTRY, 'ask', agent, prompt];
    const spawnEnv = { ...process.env };
    if (mcpServers.length > 0) {
        spawnEnv.SOUPZ_MCP_SERVERS = JSON.stringify(mcpServers);
    }

    return await new Promise((resolve) => {
        const child = spawn(process.execPath, args, {
            cwd,
            env: spawnEnv,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        if (runtime && childKey) {
            registerOrderChild(runtime, childKey, child, childMeta);
        }

        let stdout = '';
        let stderr = '';
        let settled = false;
        let timeoutHandle = null;

        const finish = (payload) => {
            if (settled) return;
            settled = true;
            if (timeoutHandle) clearTimeout(timeoutHandle);
            if (runtime && childKey) {
                setChildFinished(runtime, childKey, payload.code);
            }
            resolve(payload);
        };

        if (timeoutMs > 0) {
            timeoutHandle = setTimeout(() => {
                if (settled) return;
                const timeoutText = `[timeout] worker exceeded ${timeoutMs}ms`;
                stderr = `${stderr}\n${timeoutText}`.trim();
                onStderr?.(`${timeoutText}\n`, child.pid);
                try {
                    child.kill('SIGTERM');
                } catch {
                    // Ignore kill errors.
                }
                finish({ code: 124, stdout, stderr, pid: child.pid, timedOut: true });
            }, timeoutMs);
        }

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
            finish({ code: 1, stdout, stderr: `${stderr}\n${err.message}`.trim(), pid: child.pid, errored: true });
        });

        child.on('close', (code) => {
            finish({ code: code ?? 1, stdout, stderr, pid: child.pid });
        });
    });
}

async function startDeepOrchestratedOrder(order, runAgent, mcpServers) {
    const runtime = createOrderRuntime(order);
    const deepPolicy = order.deepPolicy || {};
    const plannerStyle = String(deepPolicy.plannerStyle || 'balanced');
    const plannerNotes = String(deepPolicy.plannerNotes || '');
    const useAiPlanner = deepPolicy.useAiPlanner !== false;
    let planner = null;
    if (useAiPlanner) {
        try {
            planner = await planDeepExecutionWithAI({
                prompt: order.prompt,
                plannerAgent: runAgent,
                cwd: order.cwd,
                mcpServers,
                timeoutMs: 25000,
                plannerStyle,
                plannerNotes,
            });
        } catch (err) {
            planner = { ok: false, reason: err?.message || 'planner_exception' };
        }
    }

    const heuristicPolicy = buildDeepExecutionPolicy(order.prompt);
    const promptIntent = planner?.ok ? planner.intent : heuristicPolicy.intent;
    const workerCount = Number.isFinite(deepPolicy.workerCount)
        ? Math.max(1, Math.min(MAX_DEEP_WORKERS, deepPolicy.workerCount))
        : (planner?.ok && Number.isFinite(planner.workerCount)
            ? planner.workerCount
            : estimateDeepWorkerCount(order.prompt, null));
    let executionPolicy = planner?.ok
        ? [
            'Execution policy (AI-planned by orchestrator):',
            ...planner.policyLines,
            '',
            'Output contract:',
            '1) Problem framing + assumptions',
            '2) Feasibility and tradeoffs',
            '3) Technical plan with implementation steps',
            '4) Risks, mitigations, and validation checklist',
            '5) Judge/defense notes (when relevant)',
        ].join('\n')
        : heuristicPolicy.policyText;

    let userClarifications = {};
    const plannerQuestions = (planner?.ok && Array.isArray(planner.clarifyingQuestions) && planner.clarifyingQuestions.length > 0)
        ? planner.clarifyingQuestions
        : [];
    if (plannerQuestions.length > 0) {
        const inputResult = await waitForOrderInput(order, runtime, plannerQuestions, 8 * 60 * 1000);
        if (!inputResult?.timedOut && inputResult?.answers) {
            const answerLines = createInputAnswerSummary(plannerQuestions, inputResult.answers);
            if (answerLines.length > 0) {
                executionPolicy = [
                    executionPolicy,
                    '',
                    'User Clarifications (selected interactively):',
                    ...answerLines,
                ].join('\n');
            }
            userClarifications = inputResult.answers;
        }
    }

    order.deepPolicy = {
        ...deepPolicy,
        useAiPlanner,
        plannerStyle,
        plannerUsed: !!planner?.ok,
        plannerReason: planner?.ok ? 'ok' : (planner?.reason || 'disabled'),
        workerCountResolved: workerCount,
        workerCountMax: MAX_DEEP_WORKERS,
        promptIntent,
        pendingQuestionCount: plannerQuestions.length,
        userClarifications,
    };
    const { workers, skipped } = selectParallelWorkers(runAgent, workerCount, order.cwd, deepPolicy);
    const workerAgents = Object.fromEntries(workers.map((w) => [w.workerId, w.agent]));
    const specialistPlan = planner?.ok
        ? planner.specialists.map((item) => item.name).slice(0, workers.length)
        : inferSpecialistsFromPrompt(order.prompt, workers.length);
    const specialistFocusPlan = planner?.ok
        ? planner.specialists.reduce((acc, item) => {
            acc[item.name] = item.focus || specialistFocusSummary(item.name);
            return acc;
        }, {})
        : {};
    const labelCounts = {};
    const workerMeta = Object.fromEntries(workers.map((w, idx) => {
        const specialist = specialistPlan[idx] || 'developer';
        const focus = specialistFocusSummary(specialist);
        const base = `${toTitleToken(w.agent)} · ${toTitleToken(specialist)}`;
        labelCounts[base] = (labelCounts[base] || 0) + 1;
        const workerLabel = labelCounts[base] > 1 ? `${base} #${labelCounts[base]}` : base;
        return [w.workerId, { workerLabel, specialist, focus }];
    }));
    const workerRoles = Object.fromEntries(workers.map((w) => [
        w.workerId,
        workerMeta[w.workerId]?.specialist || inferExecutionRole(w.agent, order.prompt),
    ]));
    order.status = 'running';
    order.startedAt = nowIso();
    pushOrderEvent(order, 'parallel.plan', {
        workers: workers.map((w) => w.workerId),
        workerAgents,
        workerRoles,
        workerMeta,
        workerCount: workers.length,
        mode: 'deep',
        deepPolicy: order.deepPolicy,
                planner: planner?.ok
                        ? {
                                agent: planner.plannerAgent,
                                workerCount: planner.workerCount,
                                specialists: planner.specialists,
                            }
                        : { enabled: useAiPlanner, used: false, reason: planner?.reason || 'disabled' },
        skippedWorkers: skipped,
    });
    void persistOrder(order);
    broadcastOrderUpdate(order);

    let artifactContext = null;
    try {
        artifactContext = await initializeDeepWorkspaceArtifacts(order, workers, workerMeta, executionPolicy);
        pushOrderEvent(order, 'artifacts.initialized', {
            runRoot: toWorkspaceRelativePath(artifactContext.cwd, artifactContext.runRoot),
            brief: toWorkspaceRelativePath(artifactContext.cwd, artifactContext.briefPath),
            sharedMemory: toWorkspaceRelativePath(artifactContext.cwd, artifactContext.sharedPath),
        });
    } catch (err) {
        pushOrderEvent(order, 'artifacts.init_failed', { message: err?.message || 'artifact_init_failed' });
    }

    if (workers.length === 0) {
        order.status = 'failed';
        order.finishedAt = nowIso();
        pushOrderEvent(order, 'order.failed', { mode: 'deep', reason: 'no_ready_workers' });
        void persistOrder(order);
        broadcastOrderUpdate(order);
        return;
    }

    const workerTimeoutMs = Math.max(15000, Number.parseInt(deepPolicy.timeoutMs || `${DEEP_SYNTHESIS_TIMEOUT_MS}`, 10) || DEEP_SYNTHESIS_TIMEOUT_MS);
    const finishedWorkerIds = new Set();
    const workerRuns = workers.map(async (worker, idx) => {
        const { workerId, agent } = worker;
        const childKey = `worker:${workerId}`;
        const perWorkerTimeoutMs = agent === 'ollama'
            ? Math.max(workerTimeoutMs, 180000)
            : workerTimeoutMs;
        const meta = workerMeta[workerId] || { workerLabel: workerId, specialist: 'developer', focus: 'deliver concrete implementation guidance' };
        if (specialistFocusPlan[meta.specialist]) {
            meta.focus = specialistFocusPlan[meta.specialist];
        }
        const workerPrompt = [
            `You are worker ${idx + 1}/${workers.length} (${meta.workerLabel}; id=${workerId}; agent=${agent}).`,
            `Assigned specialist persona: ${meta.specialist}.`,
            `Assigned focus: ${meta.focus}.`,
            executionPolicy,
            'Focus on a distinct implementation strategy and return concrete, actionable output.',
            'If coding is needed, provide exact file paths and code blocks.',
            'Return the answer directly. Do not invoke tools, shell commands, file writes, skills, or external actions.',
            'No preamble. No meta commentary. Output only the requested technical content.',
            `Original task:\n${order.prompt}`,
        ].join('\n\n');

        pushOrderEvent(order, 'worker.started', {
            workerId,
            workerLabel: meta.workerLabel,
            specialist: meta.specialist,
            focus: meta.focus,
            agent,
            role: workerRoles[workerId],
            index: idx + 1,
        });
        startWorkerWatchdog(order, runtime, childKey, {
            workerId,
            workerLabel: meta.workerLabel,
            specialist: meta.specialist,
            focus: meta.focus,
            agent,
            role: workerRoles[workerId],
        });

        let result;
        try {
            result = await runChildAgent({
                agent,
                prompt: workerPrompt,
                cwd: order.cwd,
                mcpServers,
                runtime,
                childKey,
                childMeta: { kind: 'worker', workerId, agent },
                timeoutMs: perWorkerTimeoutMs,
                onStdout: (text, pid) => {
                    const tagged = `[worker:${workerId}|agent:${agent}] ${text}`;
                    order.stdout += tagged;
                    if (order.stdout.length > 180000) order.stdout = order.stdout.slice(-180000);
                    appendLaneBuffer(order, workerId, `${text}`);
                    pushOrderOutputDelta(order, runtime, `${childKey}:stdout`, 'worker.output.delta', { workerId, agent, stream: 'stdout', chars: text.length, pid });
                    const streamMsg = JSON.stringify({ type: 'agent_chunk', orderId: order.id, chunk: toStreamChunk(tagged), agentId: workerId });
                    for (const client of wss.clients) {
                        if (client.readyState === 1 && authenticatedClients.has(client)) {
                            client.send(streamMsg);
                        }
                    }
                },
                onStderr: (text, pid) => {
                    const tagged = `[worker:${workerId}|agent:${agent}:stderr] ${text}`;
                    order.stderr += tagged;
                    if (order.stderr.length > 120000) order.stderr = order.stderr.slice(-120000);
                    appendLaneBuffer(order, workerId, `[stderr] ${text}`);
                    pushOrderOutputDelta(order, runtime, `${childKey}:stderr`, 'worker.output.delta', { workerId, agent, stream: 'stderr', chars: text.length, pid });
                },
            });
        } catch (err) {
            result = { code: 1, stdout: '', stderr: err.message || 'worker_failed', pid: null, errored: true };
        } finally {
            flushOrderOutputDeltas(order, runtime, `${childKey}:`);
            stopWorkerWatchdog(runtime, childKey);
        }

        const exitCode = result?.code ?? 1;
        pushOrderEvent(order, 'worker.finished', {
            workerId,
            workerLabel: meta.workerLabel,
            specialist: meta.specialist,
            focus: meta.focus,
            agent,
            role: workerRoles[workerId],
            exitCode,
            reason: runtime.cancelRequested ? 'cancelled' : (result?.timedOut ? 'timeout' : (result?.errored ? 'error' : 'exit')),
        });
        try {
            await persistWorkerArtifact(order, artifactContext, workerId, agent, meta, result);
        } catch (err) {
            pushOrderEvent(order, 'artifacts.worker_write_failed', {
                workerId,
                message: err?.message || 'worker_artifact_write_failed',
            });
        }
        finishedWorkerIds.add(workerId);
        return { workerId, agent, ...result };
    });

    const workerResults = [];
    const resultsByWorker = new Map();
    const syncResult = (result) => {
        if (!result || !result.workerId) return;
        if (resultsByWorker.has(result.workerId)) return;
        resultsByWorker.set(result.workerId, result);
        workerResults.push(result);
    };

    await Promise.race([
        Promise.all(workerRuns).then((all) => {
            for (const result of all) syncResult(result);
        }),
        new Promise((resolve) => {
            setTimeout(() => {
                pushOrderEvent(order, 'parallel.timeout', { timeoutMs: workerTimeoutMs, partialWorkers: workerResults.length });
                resolve();
            }, workerTimeoutMs);
        }),
    ]);

    if (workerResults.length < workers.length) {
        cancelOrderChildren(order, runtime, 'parallel_timeout');
        const settled = await Promise.allSettled(workerRuns);
        for (const item of settled) {
            if (item.status === 'fulfilled') syncResult(item.value);
        }
    }

    for (const worker of workers) {
        if (finishedWorkerIds.has(worker.workerId)) continue;
        const existing = resultsByWorker.get(worker.workerId);
        const meta = workerMeta[worker.workerId] || { workerLabel: worker.workerId, specialist: 'developer', focus: 'deliver concrete implementation guidance' };
        pushOrderEvent(order, 'worker.finished', {
            workerId: worker.workerId,
            workerLabel: meta.workerLabel,
            specialist: meta.specialist,
            focus: meta.focus,
            agent: worker.agent,
            role: workerRoles[worker.workerId],
            exitCode: existing?.code ?? 1,
            reason: 'reconciled_missing_finish',
        });
    }

    const successfulWorkers = workerResults.filter((r) => r.code === 0);
    const primaryWorker = workerResults.find((r) => r.agent === runAgent && r.code === 0);

    pushOrderEvent(order, 'parallel.collected', {
        workerCount: workerResults.length,
        successfulWorkers: successfulWorkers.length,
    });

    if (runtime.cancelRequested && successfulWorkers.length === 0) {
        order.exitCode = 130;
        order.finishedAt = nowIso();
        order.status = 'cancelled';
        order.cancelRequested = true;
        pushOrderEvent(order, 'order.cancelled', { mode: 'deep', reason: runtime.cancelReason || 'cancel_requested' });
        void persistOrder(order);
        broadcastOrderUpdate(order);
        cleanupOrderRuntime(order.id);
        return;
    }

    const synthesisAgent = (primaryWorker && primaryWorker.code === 0)
        ? runAgent
        : (successfulWorkers[0]?.agent || workers[0]?.agent || runAgent);
    const synthesisTimeoutMs = Math.max(workerTimeoutMs, Math.min(300000, DEEP_SYNTHESIS_TIMEOUT_MS * 2));
    const synthesisPrompt = [
        'You are the lead synthesizer. Merge worker outputs into a single final answer.',
        executionPolicy,
        'Prioritize correctness, concrete file paths, and executable steps.',
        'Do not invoke tools, shell commands, file writes, skills, or external actions. Synthesize directly from provided worker outputs.',
        `Original task:\n${order.prompt}`,
        'Worker outputs:',
        ...workerResults.map((r) => `\n--- ${r.workerId} via ${r.agent} (exit ${r.code}) ---\n${(r.stdout || r.stderr || '').slice(0, 40000)}`),
    ].join('\n');

    pushOrderEvent(order, 'synthesis.started', { agent: synthesisAgent, role: 'lead-synthesizer' });
    const synth = await runChildAgent({
        agent: synthesisAgent,
        prompt: synthesisPrompt,
        cwd: order.cwd,
        mcpServers,
        runtime,
        childKey: 'synthesis',
        childMeta: { kind: 'synthesis', agent: synthesisAgent },
        timeoutMs: synthesisTimeoutMs,
        onStdout: (text, pid) => {
            const tagged = `[synthesis:${synthesisAgent}] ${text}`;
            order.stdout += tagged;
            if (order.stdout.length > 200000) order.stdout = order.stdout.slice(-200000);
            appendLaneBuffer(order, 'synthesis', `${text}`);
            pushOrderOutputDelta(order, runtime, 'synthesis:stdout', 'synthesis.output.delta', { stream: 'stdout', chars: text.length, pid });
            const streamMsg = JSON.stringify({ type: 'agent_chunk', orderId: order.id, chunk: toStreamChunk(tagged), agentId: synthesisAgent });
            for (const client of wss.clients) {
                if (client.readyState === 1 && authenticatedClients.has(client)) {
                    client.send(streamMsg);
                }
            }
        },
        onStderr: (text, pid) => {
            order.stderr += text;
            if (order.stderr.length > 120000) order.stderr = order.stderr.slice(-120000);
            appendLaneBuffer(order, 'synthesis', `[stderr] ${text}`);
            pushOrderOutputDelta(order, runtime, 'synthesis:stderr', 'synthesis.output.delta', { stream: 'stderr', chars: text.length, pid });
        },
    });
    flushOrderOutputDeltas(order, runtime, 'synthesis:');

    const canFallbackComplete = deepPolicy.allowSynthesisFallback !== false
        && synth.code !== 0
        && successfulWorkers.length > 0;

    if (canFallbackComplete) {
        const ranked = [...successfulWorkers]
            .sort((a, b) => (b.stdout || '').length - (a.stdout || '').length)
            .slice(0, Math.min(3, successfulWorkers.length));
        const fallbackBody = ranked
            .map((r) => `## ${r.workerId} (${r.agent})\n${(r.stdout || r.stderr || '').slice(0, 12000)}`)
            .join('\n\n');
        const fallbackText = [
            '[synthesis:fallback] Primary synthesis timed out/failed; returning deterministic merge of successful worker outputs.',
            fallbackBody,
        ].join('\n\n');

        order.stdout += `\n${fallbackText}`;
        if (order.stdout.length > 200000) order.stdout = order.stdout.slice(-200000);
        appendLaneBuffer(order, 'synthesis', fallbackText);
        pushOrderEvent(order, 'synthesis.fallback.used', {
            synthesisExitCode: synth.code,
            selectedWorkers: ranked.map((r) => r.workerId),
        });
    }

    const synthesisText = canFallbackComplete
        ? [
            '[synthesis:fallback] Primary synthesis timed out/failed; deterministic merge below.',
            ...successfulWorkers.slice(0, 3).map((r) => `\n## ${r.workerId} (${r.agent})\n${(r.stdout || r.stderr || '').slice(0, 12000)}`),
        ].join('\n')
        : (synth.stdout || synth.stderr || '');
    try {
        await persistSynthesisArtifact(order, artifactContext, synthesisText, {
            agent: synthesisAgent,
            exitCode: canFallbackComplete ? 0 : synth.code,
            fallbackUsed: canFallbackComplete,
        });
    } catch (err) {
        pushOrderEvent(order, 'artifacts.synthesis_write_failed', {
            message: err?.message || 'synthesis_artifact_write_failed',
        });
    }

    const finalSynthesisExitCode = canFallbackComplete ? 0 : synth.code;
    pushOrderEvent(order, 'synthesis.finished', { agent: synthesisAgent, role: 'lead-synthesizer', exitCode: finalSynthesisExitCode });

    order.exitCode = finalSynthesisExitCode;
    order.finishedAt = nowIso();
    if (finalSynthesisExitCode === 0) {
        order.status = 'completed';
        pushOrderEvent(order, 'order.completed', {
            exitCode: finalSynthesisExitCode,
            mode: 'deep',
            workers: workers.map((w) => w.workerId),
            fallbackUsed: canFallbackComplete,
            synthesisExitCode: synth.code,
            successfulWorkers: successfulWorkers.length,
            createdFiles: order.createdFiles || [],
        });
    } else if (runtime.cancelRequested) {
        order.status = 'cancelled';
        order.cancelRequested = true;
        pushOrderEvent(order, 'order.cancelled', { exitCode: finalSynthesisExitCode, mode: 'deep', reason: runtime.cancelReason || 'cancel_requested' });
    } else {
        order.status = 'failed';
        pushOrderEvent(order, 'order.failed', { exitCode: finalSynthesisExitCode, mode: 'deep', workers: workers.map((w) => w.workerId) });
    }

    void persistOrder(order);
    broadcastOrderUpdate(order);
    cleanupOrderRuntime(order.id);
}

// AUTHENTICATED: Create a new orchestrated order from web dashboard
app.post('/api/orders', requireAuth, async (req, res) => {
    const prompt = (req.body?.prompt || '').toString().trim();
    const requestedAgent = (req.body?.agent || 'auto').toString().trim() || 'auto';
    const agent = WEB_AGENT_ALIASES.get(requestedAgent) || requestedAgent;
    const modelPolicy = (req.body?.modelPolicy || 'balanced').toString().trim() || 'balanced';
    const orchestrationMode = (req.body?.orchestrationMode || '').toString().trim() || (modelPolicy === 'deep' ? 'parallel' : 'single');
    const mcpServers = Array.isArray(req.body?.mcpServers) ? req.body.mcpServers : [];
    const payloadWorkerCount = Number.parseInt(req.body?.workerCount, 10);
    const payloadPrimaryCopies = Number.parseInt(req.body?.primaryCopies, 10);
    const sameAgentOnly = req.body?.sameAgentOnly === true;
    const useAiPlanner = req.body?.useAiPlanner !== false;
    const plannerStyle = (req.body?.plannerStyle || 'balanced').toString().trim().toLowerCase();
    const plannerNotes = (req.body?.plannerNotes || '').toString().trim().slice(0, 4000);
    const previewWorkerCount = estimateDeepWorkerCount(prompt, Number.isFinite(payloadWorkerCount) ? payloadWorkerCount : null);
    const deepPolicy = {
        workerCount: Number.isFinite(payloadWorkerCount) ? Math.max(1, Math.min(MAX_DEEP_WORKERS, payloadWorkerCount)) : null,
        primaryCopies: Number.isFinite(payloadPrimaryCopies) ? Math.max(1, Math.min(MAX_DEEP_WORKERS, payloadPrimaryCopies)) : null,
        sameAgentOnly,
        useAiPlanner,
        plannerStyle,
        plannerNotes,
        timeoutMs: Number.parseInt(req.body?.timeoutMs, 10) || DEEP_SYNTHESIS_TIMEOUT_MS,
        allowSynthesisFallback: req.body?.allowSynthesisFallback !== false,
        workerCountResolved: previewWorkerCount,
        workerCountMax: MAX_DEEP_WORKERS,
    };
    const orderCwd = (req.body?.cwd || '').toString().trim() || REPO_ROOT;
    let runAgent = null;
    let routeMeta = { method: 'fallback-chain', available: [] };

    if (agent === 'auto') {
        const auto = await resolveAutoRunAgent(prompt, orderCwd);
        runAgent = auto.agent;
        routeMeta = {
            method: auto.method,
            available: auto.available || [],
            ready: auto.ready || [],
            skipped: auto.skipped || [],
        };
    } else {
        const resolved = resolveRunAgent(agent);
        runAgent = resolved.agent;
        routeMeta = {
            method: resolved.fallback ? 'explicit-fallback' : 'explicit',
            fallback: resolved.fallback || false,
            originalRequest: resolved.originalRequest || null,
            available: getInstalledAgentsInPriorityOrder(),
            ready: getReadyAgentsInPriorityOrder(orderCwd).ready,
        };
    }

    if (!prompt) {
        return res.status(400).json({ error: 'Missing prompt' });
    }

    const id = `ord_${++orderCounter}`;
    const createdAt = nowIso();

    const order = {
        id,
        prompt,
        agent,
        runAgent,
        modelPolicy,
        orchestrationMode,
        deepPolicy,
        cwd: orderCwd,
        status: 'queued',
        createdAt,
        startedAt: null,
        finishedAt: null,
        stdout: '',
        stderr: '',
        events: [],
        exitCode: null,
        pid: null,
        cancelRequested: false,
        laneBuffers: {},
        createdFiles: [],
        pendingQuestions: [],
        pendingAnswers: {},
    };

    pushOrderEvent(order, 'order.created', { prompt, agent, modelPolicy, orchestrationMode, cwd: orderCwd });
    pushOrderEvent(order, 'route.selected', {
        agent: runAgent,
        primaryRole: inferExecutionRole(runAgent, prompt),
        specialistsPlanned: inferSpecialistsFromPrompt(prompt, previewWorkerCount),
        deepPolicy,
        requested: requestedAgent,
        resolved: agent,
        routeMethod: routeMeta.method,
        fallback: routeMeta.fallback || false,
        originalRequest: routeMeta.originalRequest || null,
        available: routeMeta.available || [],
        ready: routeMeta.ready || [],
        skipped: routeMeta.skipped || [],
    });
    orders.set(id, order);
    void persistOrder(order);
    broadcastOrderUpdate(order);

    if (orchestrationMode === 'parallel') {
        void startDeepOrchestratedOrder(order, runAgent, mcpServers);
    } else {
        startSingleAgentOrder(order, runAgent, mcpServers);
    }

    return res.status(202).json({ id: order.id, ...toOrderSummary(order) });
});

// AUTHENTICATED: List latest orders for queue/history (DB-first, memory fallback)
app.get('/api/orders', requireAuth, async (req, res) => {
    if (supabase) {
        try {
            const { data, error } = await supabase
                .from(SUPABASE_TABLE)
                .select('id,prompt,agent,run_agent,model_policy,status,created_at,started_at,finished_at,duration_ms,exit_code')
                .order('created_at', { ascending: false })
                .limit(100);
            if (!error && data) {
                const list = data.map(r => ({
                    id: r.id, prompt: r.prompt, agent: r.agent, runAgent: r.run_agent,
                    modelPolicy: r.model_policy, status: r.status, createdAt: r.created_at,
                    startedAt: r.started_at, finishedAt: r.finished_at, durationMs: r.duration_ms,
                    exitCode: r.exit_code, eventCount: 0,
                }));
                return res.json({ orders: list, source: 'db' });
            }
        } catch { /* fall through to memory */ }
    }
    const list = [...orders.values()]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 100)
        .map(toOrderSummary);
    res.json({ orders: list, source: 'memory' });
});

// AUTHENTICATED: Order detail with timeline and output (DB-first, memory fallback)
app.get('/api/orders/:id', requireAuth, async (req, res) => {
    const memOrder = orders.get(req.params.id);
    // Memory is canonical for live/recent orders (has events, stdout, stderr)
    if (memOrder) {
        const summary = toOrderSummary(memOrder);
        return res.json({
            ...summary,
            pid: memOrder.pid, exitCode: memOrder.exitCode,
            events: memOrder.events, stdout: memOrder.stdout, stderr: memOrder.stderr,
            laneBuffers: memOrder.laneBuffers || {},
            createdFiles: Array.isArray(memOrder.createdFiles) ? memOrder.createdFiles : [],
            pendingQuestions: Array.isArray(memOrder.pendingQuestions) ? memOrder.pendingQuestions : [],
            pendingAnswers: memOrder.pendingAnswers || {},
        });
    }
    // Fall back to DB for historical orders not in current memory
    if (supabase) {
        try {
            const { data, error } = await supabase
                .from(SUPABASE_TABLE)
                .select('*')
                .eq('id', req.params.id)
                .single();
            if (!error && data) {
                return res.json({
                    id: data.id, prompt: data.prompt, agent: data.agent, runAgent: data.run_agent,
                    modelPolicy: data.model_policy, status: data.status, createdAt: data.created_at,
                    startedAt: data.started_at, finishedAt: data.finished_at, durationMs: data.duration_ms,
                    exitCode: data.exit_code, events: data.events || [], stdout: data.stdout || '',
                    stderr: data.stderr || '', laneBuffers: data.lane_buffers || {}, eventCount: (data.events || []).length,
                    createdFiles: [],
                    pendingQuestions: [],
                    pendingAnswers: {},
                });
            }
        } catch { /* fall through */ }
    }
    return res.status(404).json({ error: 'Order not found' });
});

// AUTHENTICATED: cancel active order and terminate associated children only
app.post('/api/orders/:id/cancel', requireAuth, async (req, res) => {
    const order = orders.get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!(order.status === 'queued' || order.status === 'running' || order.status === 'waiting_input')) {
        return res.status(409).json({ error: `Order not cancellable in status ${order.status}` });
    }
    const runtime = getOrderRuntime(order.id);
    const cancelReason = (req.body?.reason || 'user_cancelled').toString();
    const result = cancelOrderChildren(order, runtime, cancelReason);

    const wasQueued = order.status === 'queued';
    if (wasQueued || !runtime) {
        order.status = 'cancelled';
        order.cancelRequested = true;
        order.finishedAt = nowIso();
        order.exitCode = 130;
        pushOrderEvent(order, 'order.cancelled', { mode: wasQueued ? 'queued' : 'runtime-missing', reason: cancelReason });
        void persistOrder(order);
        broadcastOrderUpdate(order);
        cleanupOrderRuntime(order.id);
    }

    return res.json({ ok: true, id: order.id, status: order.status, ...result });
});

// AUTHENTICATED: submit interactive clarification input and resume waiting order
app.post('/api/orders/:id/input', requireAuth, async (req, res) => {
    const order = orders.get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const runtime = getOrderRuntime(order.id);
    const answers = req.body?.answers && typeof req.body.answers === 'object' ? req.body.answers : {};
    const submitted = submitOrderInput(order, runtime, answers);
    if (!submitted.ok) {
        return res.status(submitted.status || 400).json({ error: submitted.error || 'Input submission failed' });
    }
    return res.json({ ok: true, id: order.id, status: order.status });
});

function buildWorkerSummaryFromEvents(events = []) {
    const workers = {};
    for (const ev of events) {
        if (!ev.workerId) continue;
        if (!workers[ev.workerId]) {
            workers[ev.workerId] = {
                workerId: ev.workerId,
                workerLabel: ev.workerLabel || ev.workerId,
                agent: ev.agent || '',
                specialist: ev.specialist || '',
                role: ev.role || '',
                startedAt: null,
                finishedAt: null,
                durationMs: null,
                exitCode: null,
                state: 'unknown',
                stalled: false,
                stalledAt: null,
                finishReason: '',
            };
        }
        const w = workers[ev.workerId];
        if (ev.type === 'worker.started') {
            w.startedAt = ev.at;
            w.state = 'running';
        }
        if (ev.type === 'worker.stalled') {
            w.stalled = true;
            w.stalledAt = ev.at;
        }
        if (ev.type === 'worker.finished') {
            w.finishedAt = ev.at;
            w.exitCode = ev.exitCode ?? 1;
            w.state = (ev.exitCode ?? 1) === 0 ? 'completed' : 'failed';
            w.finishReason = ev.reason || 'exit';
        }
    }

    for (const worker of Object.values(workers)) {
        if (worker.startedAt && worker.finishedAt) {
            worker.durationMs = new Date(worker.finishedAt).getTime() - new Date(worker.startedAt).getTime();
        }
    }
    return workers;
}

// AUTHENTICATED: structured order summary with per-worker timings and exit reasons
app.get('/api/orders/:id/summary', requireAuth, (req, res) => {
    const order = orders.get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const workers = buildWorkerSummaryFromEvents(order.events || []);
    const synthesisStart = (order.events || []).find((e) => e.type === 'synthesis.started');
    const synthesisEnd = (order.events || []).find((e) => e.type === 'synthesis.finished');
    const synthesis = {
        agent: synthesisStart?.agent || synthesisEnd?.agent || null,
        startedAt: synthesisStart?.at || null,
        finishedAt: synthesisEnd?.at || null,
        exitCode: synthesisEnd?.exitCode ?? null,
        durationMs: synthesisStart?.at && synthesisEnd?.at
            ? (new Date(synthesisEnd.at).getTime() - new Date(synthesisStart.at).getTime())
            : null,
        state: synthesisEnd
            ? ((synthesisEnd.exitCode ?? 1) === 0 ? 'completed' : 'failed')
            : (synthesisStart ? 'running' : 'not_started'),
    };

    res.json({
        id: order.id,
        status: order.status,
        runAgent: order.runAgent,
        modelPolicy: order.modelPolicy,
        deepPolicy: order.deepPolicy || null,
        createdAt: order.createdAt,
        startedAt: order.startedAt,
        finishedAt: order.finishedAt,
        durationMs: order.startedAt && order.finishedAt
            ? (new Date(order.finishedAt).getTime() - new Date(order.startedAt).getTime())
            : null,
        workers,
        synthesis,
        createdFiles: Array.isArray(order.createdFiles) ? order.createdFiles : [],
    });
});

// AUTHENTICATED: Changed files for dashboard drawer
app.get('/api/changes', requireAuth, (req, res) => {
    try {
        const out = execSync('git status --porcelain', { cwd: REPO_ROOT, timeout: 4000 }).toString();
        const lines = out.split('\n').map((l) => l.trimEnd()).filter(Boolean);
        const staged = [];
        const unstaged = [];
        
        lines.forEach((line) => {
            const statusCode = line.slice(0, 2);
            const path = line.slice(3).trim();
            const indexStatus = statusCode[0];
            const workTreeStatus = statusCode[1];

            if (indexStatus !== ' ' && indexStatus !== '?') {
                staged.push({ path, type: indexStatus });
            }
            if (workTreeStatus !== ' ' && workTreeStatus !== '?') {
                unstaged.push({ path, type: workTreeStatus });
            }
            if (statusCode === '??') {
                unstaged.push({ path, type: 'U' });
            }
        });

        // Get current branch name
        let branch = 'main';
        try {
            branch = execSync('git branch --show-current', { cwd: REPO_ROOT, timeout: 2000 }).toString().trim() || 'main';
        } catch { /* fallback to main */ }
        
        const porcelain = lines; // Original porcelain lines for file tree coloring
        res.json({ staged, unstaged, branch, porcelain });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// AUTHENTICATED: Unified diff for one file
app.get('/api/changes/diff', requireAuth, (req, res) => {
    const file = (req.query.file || '').toString().trim();
    if (!file) return res.status(400).json({ error: 'Missing file query param' });
    try {
        const escaped = file.replace(/"/g, '\\"');
        const diff = execSync(`git --no-pager diff -- "${escaped}"`, { cwd: REPO_ROOT, timeout: 4000 }).toString();
        res.json({ file, diff: diff || 'No unstaged diff available.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get connected clients
function getConnections() {
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

// AUTHENTICATED: Create terminal
app.post('/terminal', requireAuth, (req, res) => {
    if (!pty) return res.status(503).json({ error: 'Terminal unavailable (node-pty not installed)' });
    const id = ++terminalCounter;
    const shell = process.env.SHELL || (os.platform() === 'win32' ? 'powershell.exe' : 'bash');
    const proc = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: process.cwd(),
        env: process.env,
    });

    const terminal = { id, proc, buffer: [], listeners: new Set(), createdAt: Date.now() };

    proc.onData((data) => {
        terminal.buffer.push(data);
        if (terminal.buffer.length > 1000) terminal.buffer.shift();
        for (const ws of terminal.listeners) {
            ws.send(JSON.stringify({ type: 'output', terminalId: id, data }));
        }
    });

    proc.onExit(({ exitCode }) => {
        for (const ws of terminal.listeners) {
            ws.send(JSON.stringify({ type: 'exit', terminalId: id, code: exitCode }));
        }
        terminals.delete(id);
    });

    terminals.set(id, terminal);
    res.json({ id, pid: proc.pid });
});

// AUTHENTICATED: Kill terminal by id
app.delete('/terminals/:id', requireAuth, (req, res) => {
    const result = terminateTerminal(req.params.id);
    if (!result.ok && result.reason === 'not_found') {
        return res.status(404).json({ error: 'Terminal not found' });
    }
    if (!result.ok) {
        return res.status(400).json({ error: 'Invalid terminal id' });
    }
    return res.json({ ok: true, id: result.id });
});

// ═══════════════════════════════════════════════════════════
// FILE SYSTEM & GIT API (for web IDE)
// ═══════════════════════════════════════════════════════════

import { readdir, readFile, writeFile, stat, mkdir, watch } from 'fs/promises';
import { existsSync } from 'fs';

// File Watcher for Real-time IDE updates
async function startFileWatcher() {
    if (fileWatcherTask) return;
    fileWatcherAbortController = new AbortController();
    const signal = fileWatcherAbortController.signal;

    fileWatcherTask = (async () => {
        try {
            const watcher = watch(REPO_ROOT, { recursive: true, signal });
            console.log(`  👁  Watcher active on: ${REPO_ROOT}`);
            for await (const event of watcher) {
                if (event.filename && !event.filename.includes('node_modules') && !event.filename.includes('.git')) {
                    broadcast({ type: 'FILE_CHANGED', path: event.filename });
                }
            }
        } catch (err) {
            if (err?.name === 'AbortError') return;
            console.error('  ✖ File watcher failed:', err.message);
        }
    })();
}

function stopFileWatcher() {
    if (fileWatcherAbortController) {
        try { fileWatcherAbortController.abort(); } catch {}
    }
    fileWatcherAbortController = null;
    fileWatcherTask = null;
}

const IGNORED_DIRS = new Set(['.git', 'node_modules', '.next', 'dist', 'build', '__pycache__', '.DS_Store']);
const MAX_FILE_SIZE = 1024 * 1024; // 1MB max for editor

// POST /api/fs/init — initialize a new project directory (authenticated)
app.post('/api/fs/init', express.json(), requireAuth, async (req, res) => {
    const { name, path: parentPath, supabase: useSupabase, github: useGithub } = req.body;
    const parent = resolve(parentPath || os.homedir());
    const projectPath = join(parent, name);

    if (existsSync(projectPath)) {
        return res.status(400).json({ error: 'Directory already exists' });
    }

    try {
        await mkdir(projectPath, { recursive: true });

        if (useGithub) {
            try {
                execSync('git init', { cwd: projectPath, timeout: 5000 });
            } catch (e) {
                console.error('Git init failed:', e.message);
            }
        }

        if (useSupabase) {
            try {
                // Initialize supabase project via CLI
                execSync('supabase init', { cwd: projectPath, timeout: 10000 });
            } catch (e) {
                console.error('Supabase init failed:', e.message);
                // Fallback basic structure if CLI fails
                await mkdir(join(projectPath, 'supabase'), { recursive: true });
                await writeFile(join(projectPath, 'supabase/config.toml'), '# Supabase configuration\\n', 'utf8');
            }
        }

        // Create a basic README.md
        await writeFile(join(projectPath, 'README.md'), `# ${name}\n\nProject initialized by Soupz.\n`, 'utf8');

        res.json({ ok: true, path: projectPath });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

async function buildFileTree(dirPath, rootPath, depth = 0) {
    if (depth > 6) return null;
    const entries = await readdir(dirPath, { withFileTypes: true });
    
    const childrenPromises = entries.map(async (entry) => {
        if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith('.')) return null;
        const fullPath = join(dirPath, entry.name);
        const relPath = relative(rootPath, fullPath);
        if (entry.isDirectory()) {
            const subtree = await buildFileTree(fullPath, rootPath, depth + 1);
            if (subtree) return { name: entry.name, path: relPath, type: 'directory', children: subtree.children };
        } else {
            return { name: entry.name, path: relPath, type: 'file' };
        }
        return null;
    });

    const children = (await Promise.all(childrenPromises)).filter(Boolean);

    children.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
    });
    return { name: dirPath, path: relative(rootPath, dirPath) || '.', type: 'directory', children };
}

// GET /api/dev-server — detect running dev server for live preview (authenticated)
app.get('/api/dev-server', requireAuth, async (req, res) => {
    const ports = [3000, 3001, 4200, 5173, 5174, 7534, 8000, 8080, 8888];
    const checks = ports.map(async (port) => {
        try {
            const controller = new AbortController();
            setTimeout(() => controller.abort(), 800);
            const r = await fetch(`http://localhost:${port}`, { signal: controller.signal });
            if (r.ok || r.status === 304) return { port, url: `http://localhost:${port}`, detected: true };
        } catch { /* not running */ }
        return null;
    });
    const results = (await Promise.all(checks)).filter(Boolean);
    if (results.length > 0) {
        res.json(results[0]); // Return the first detected server
    } else {
        res.json({ detected: false, url: null });
    }
});

// GET /api/fs/roots — returns homedir and root drives (authenticated)
app.get('/api/fs/roots', requireAuth, (req, res) => {
    res.json({
        homedir: os.homedir(),
        cwd: process.cwd(),
        platform: os.platform()
    });
});

// GET /api/fs/dirs?path=/home — list directories for folder picker (authenticated)
app.get('/api/fs/dirs', requireAuth, async (req, res) => {
    const dirPath = resolve(req.query.path || os.homedir());
    if (!existsSync(dirPath)) return res.status(404).json({ error: 'Path not found' });
    try {
        const entries = await readdir(dirPath, { withFileTypes: true });
        const dirs = entries
            .filter(e => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules')
            .map(e => ({
                name: e.name,
                path: join(dirPath, e.name),
                isGitRepo: existsSync(join(dirPath, e.name, '.git')),
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
        // Check if the current path itself is a git repo
        const isGitRepo = existsSync(join(dirPath, '.git'));
        res.json({ current: dirPath, parent: dirname(dirPath), dirs, isGitRepo });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/usage — Fetch real-time usage metrics from CLI agents (authenticated)
app.get('/api/usage', requireAuth, (req, res) => {
    const agents = ['gemini', 'copilot', 'claude', 'kiro'];
    const usage = {};

    for (const agent of agents) {
        try {
            let cmd = '';
            if (agent === 'gemini') cmd = 'gemini --version'; // No native usage command yet
            else if (agent === 'copilot') cmd = 'gh copilot --version';
            else if (agent === 'claude') cmd = 'claude --version';
            
            if (cmd) {
                const out = execSync(cmd, { timeout: 2000 }).toString().trim();
                usage[agent] = { raw: out, timestamp: new Date().toISOString() };
            }
        } catch {
            usage[agent] = { error: 'Unavailable' };
        }
    }
    res.json(usage);
});

// GET /api/fs/tree?root=/path (authenticated)
app.get('/api/fs/tree', requireAuth, async (req, res) => {
    const rootPath = resolve(req.query.root || REPO_ROOT || process.cwd());
    if (!existsSync(rootPath)) {
        console.error(`  ✖ File tree requested for non-existent path: ${rootPath}`);
        return res.status(404).json({ error: 'Path not found' });
    }
    try {
        console.log(`  📂 Loading file tree for: ${rootPath}`);
        const tree = await buildFileTree(rootPath, rootPath);
        // Get changed files from git (raw porcelain lines for the frontend)
        let changedFiles = [];
        try {
            const out = execSync('git status --porcelain', { cwd: rootPath, timeout: 3000 }).toString();
            changedFiles = out.split('\n').filter(Boolean); // Send full porcelain lines
        } catch { /* not a git repo */ }
        res.json({ tree, changedFiles });
    } catch (err) {
        console.error(`  ✖ Failed to build file tree: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/fs/file?path=/relative/path&root=/root (authenticated)
app.get('/api/fs/file', requireAuth, async (req, res) => {
    const rootPath = resolve(req.query.root || REPO_ROOT || process.cwd());
    const filePath = resolve(rootPath, req.query.path || '');
    // Security: ensure path is within root
    if (!filePath.startsWith(rootPath)) return res.status(403).json({ error: 'Access denied' });
    try {
        const stats = await stat(filePath);
        if (stats.size > MAX_FILE_SIZE) return res.status(413).json({ error: 'File too large for editor' });
        const content = await readFile(filePath, 'utf8');
        res.json({ content, path: req.query.path });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/fs/file — write file (authenticated)
app.post('/api/fs/file', express.json(), requireAuth, async (req, res) => {
    const { path: relPath, content, root } = req.body;
    const rootPath = resolve(root || REPO_ROOT || process.cwd());
    const filePath = resolve(rootPath, relPath);
    if (!filePath.startsWith(rootPath)) return res.status(403).json({ error: 'Access denied' });
    try {
        await writeFile(filePath, content, 'utf8');
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/git/stage — stage a file (authenticated)
app.post('/api/git/stage', express.json(), requireAuth, (req, res) => {
    const { path: filePath, root } = req.body;
    const cwd = root || REPO_ROOT || process.cwd();
    try {
        execSync(`git add -- "${filePath}"`, { cwd, timeout: 5000 });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/git/commit (authenticated)
app.post('/api/git/commit', express.json(), requireAuth, (req, res) => {
    const { message, root } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Commit message required' });
    const cwd = root || REPO_ROOT || process.cwd();
    try {
        execSync(`git commit -m ${JSON.stringify(message)}`, { cwd, timeout: 10000 });
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/git/push (authenticated)
app.post('/api/git/push', express.json(), requireAuth, (req, res) => {
    const { root } = req.body || {};
    const cwd = root || REPO_ROOT || process.cwd();
    try {
        const result = execSync('git push', { cwd, timeout: 30000 }).toString();
        res.json({ ok: true, output: result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/exec — Run a file with the appropriate runtime (authenticated)
app.post('/api/exec', express.json(), requireAuth, (req, res) => {
    const { path: filePath, root } = req.body;
    if (!filePath) return res.status(400).json({ error: 'Missing path' });

    const cwd = root || REPO_ROOT || process.cwd();
    const fullPath = resolve(cwd, filePath);

    if (!existsSync(fullPath)) return res.status(404).json({ error: 'File not found' });

    // Determine runtime
    const ext = extname(filePath).toLowerCase();
    let cmd = '';
    if (ext === '.js') cmd = 'node';
    else if (ext === '.py') cmd = 'python3';
    else if (ext === '.sh') cmd = 'bash';
    else if (ext === '.rb') cmd = 'ruby';
    else if (ext === '.go') cmd = 'go run';
    else if (ext === '.rs') cmd = 'cargo run';
    else {
        // Try to make it executable and run directly
        cmd = '';
    }

    // We don't use spawn here because we want to push to the PTY if possible
    // or just return ok and let the user see it in the terminal
    // For now, let's just return what would be run
    res.json({ ok: true, command: `${cmd} ${filePath}`.trim() });
});

/** Parse GitHub owner/repo from remote URL */
function parseGithubUrl(url) {
    if (!url) return null;
    let u = url.trim();
    if (u.endsWith('.git')) u = u.slice(0, -4);
    
    // https://github.com/owner/repo
    if (u.includes('github.com/')) {
        const parts = u.split('github.com/')[1].split('/');
        return { owner: parts[0], repo: parts[1] };
    }
    
    // git@github.com:owner/repo
    if (u.includes('github.com:')) {
        const parts = u.split('github.com:')[1].split('/');
        return { owner: parts[0], repo: parts[1] };
    }
    
    return null;
}

// GET /api/git/mirror/manifest — Fetch repository tree from GitHub (Fallback Mode)
app.get('/api/git/mirror/manifest', requireAuth, async (req, res) => {
    const root = resolve(req.query.root || REPO_ROOT || process.cwd());
    try {
        const remoteUrl = execSync('git remote get-url origin', { cwd: root, timeout: 3000 }).toString().trim();
        const info = parseGithubUrl(remoteUrl);
        if (!info) return res.status(400).json({ error: 'Not a GitHub repository' });

        let branch = 'main';
        try {
            branch = execSync('git branch --show-current', { cwd: root, timeout: 2000 }).toString().trim() || 'main';
        } catch (e) { /* fallback to main */ }

        // Use gh api to fetch the recursive tree
        const cmd = `gh api repos/${info.owner}/${info.repo}/git/trees/${branch}?recursive=1`;
        const tree = JSON.parse(execSync(cmd, { timeout: 10000 }).toString());
        res.json({ ...tree, owner: info.owner, repo: info.repo, branch });
    } catch (err) {
        res.status(500).json({ error: `GitHub Mirror Manifest failed: ${err.message}` });
    }
});

// GET /api/git/mirror/file — Fetch raw file content from GitHub (Fallback Mode)
app.get('/api/git/mirror/file', requireAuth, async (req, res) => {
    const root = resolve(req.query.root || REPO_ROOT || process.cwd());
    const filePath = (req.query.path || '').toString().trim();
    if (!filePath) return res.status(400).json({ error: 'Missing path' });

    try {
        const remoteUrl = execSync('git remote get-url origin', { cwd: root, timeout: 3000 }).toString().trim();
        const info = parseGithubUrl(remoteUrl);
        if (!info) return res.status(400).json({ error: 'Not a GitHub repository' });

        // Use gh api to fetch file contents (handles auth automatically)
        const cmd = `gh api repos/${info.owner}/${info.repo}/contents/${filePath}`;
        const data = JSON.parse(execSync(cmd, { timeout: 10000 }).toString());
        
        if (data.encoding === 'base64') {
            const content = Buffer.from(data.content, 'base64').toString('utf8');
            res.json({ content, path: filePath, sha: data.sha });
        } else {
            // Might be a directory or large file with a different response
            res.json(data);
        }
    } catch (err) {
        res.status(500).json({ error: `GitHub Mirror File fetch failed: ${err.message}` });
    }
});

// POST /command — unified command endpoint for web IDE (no auth for local browser)
app.post('/command', express.json(), (req, res) => {
    const { type, payload } = req.body;
    // Only allow if request comes from localhost
    const clientIP = req.ip || req.connection?.remoteAddress;
    const isLocal = clientIP === '127.0.0.1' || clientIP === '::1' || clientIP === '::ffff:127.0.0.1';
    if (!isLocal) return res.status(403).json({ error: 'Remote access requires authentication via /pair' });

    res.json({ ok: true, commandId: req.body.id || crypto.randomUUID() });
    // Commands are handled asynchronously and results pushed via WebSocket
});

// AUTHENTICATED: Revoke session (logout)
app.post('/logout', requireAuth, (req, res) => {
    const token = req.headers['x-soupz-token'] || req.query.token;
    revokeSession(token);
    console.log('  🚪 Device disconnected (session revoked)');
    res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════
// WEBSOCKET (with OTP auth handshake)
// ═══════════════════════════════════════════════════════════

wss.on('connection', (ws, req) => {
    let wsAuthenticated = false;
    let wsToken = null;
    
    const clientIP = req.socket?.remoteAddress;
    const isLocal = clientIP === '127.0.0.1' || clientIP === '::1' || clientIP === '::ffff:127.0.0.1';

    // Client MUST authenticate within 10 seconds or get disconnected
    const authTimeout = setTimeout(() => {
        if (!wsAuthenticated) {
            ws.send(JSON.stringify({ type: 'error', message: 'Authentication timeout. Send {type:"auth", token:"..."} within 10 seconds.' }));
            ws.close(4001, 'Auth timeout');
        }
    }, 10000);

    ws.on('message', (raw) => {
        try {
            const msg = JSON.parse(raw);

            // FIRST MESSAGE MUST BE AUTH
            if (!wsAuthenticated) {
                if (msg.type === 'auth') {
                    if (isLocal) {
                        // Auto-authenticate localhost
                        wsAuthenticated = true;
                        wsToken = 'local-dev-token';
                        authenticatedClients.add(ws);
                        clearTimeout(authTimeout);
                        ws.send(JSON.stringify({
                            type: 'auth_success',
                            hostname: os.hostname(),
                            health: getSystemHealth(),
                        }));
                        console.log(`  💻 Local dashboard terminal authenticated automatically`);
                        return;
                    }

                    if (msg.token && isValidSession(msg.token)) {
                        wsAuthenticated = true;
                        wsToken = msg.token;
                        authenticatedClients.add(ws);
                        clearTimeout(authTimeout);

                        const session = activeSessions.get(msg.token);
                        if (session && msg.clientType) session.clientType = msg.clientType;

                        ws.send(JSON.stringify({
                            type: 'auth_success',
                            hostname: os.hostname(),
                            health: getSystemHealth(),
                        }));
                        console.log(`  📱 ${msg.clientType || 'Client'} authenticated`);
                        return;
                    }

                    // Allow pairing code directly over WebSocket too
                    if (msg.code) {
                        const token = validatePairingCode(msg.code.toString().trim());
                        if (token) {
                            wsAuthenticated = true;
                            wsToken = token;
                            authenticatedClients.add(ws);
                            clearTimeout(authTimeout);

                            const session = activeSessions.get(token);
                            if (session && msg.clientType) session.clientType = msg.clientType;

                            ws.send(JSON.stringify({
                                type: 'auth_success',
                                token,
                                hostname: os.hostname(),
                                health: getSystemHealth(),
                            }));
                            console.log(`  📱 ${msg.clientType || 'Client'} paired and authenticated (code: ${msg.code})`);
                            return;
                        }
                    }

                    ws.send(JSON.stringify({ type: 'auth_failed', message: 'Invalid token or pairing code' }));
                    return;
                }
                ws.send(JSON.stringify({ type: 'error', message: 'Must authenticate first. Send {type:"auth", token:"..."} or {type:"auth", code:"12345678"}' }));
                return;
            }

            // AUTHENTICATED — handle normal messages
            switch (msg.type) {
                case 'subscribe': {
                    const terminal = terminals.get(msg.terminalId);
                    if (terminal) {
                        terminal.listeners.add(ws);
                        ws.send(JSON.stringify({
                            type: 'history',
                            terminalId: msg.terminalId,
                            data: terminal.buffer.join(''),
                        }));
                    }
                    break;
                }

                case 'input': {
                    const terminal = terminals.get(msg.terminalId);
                    if (terminal?.proc) {
                        terminal.proc.write(msg.data);
                    }
                    break;
                }

                case 'resize': {
                    const terminal = terminals.get(msg.terminalId);
                    if (terminal?.proc && msg.cols && msg.rows) {
                        terminal.proc.resize(msg.cols, msg.rows);
                    }
                    break;
                }

                case 'health': {
                    ws.send(JSON.stringify({ type: 'health', data: getSystemHealth() }));
                    break;
                }

                case 'create_terminal': {
                    if (!pty) {
                        ws.send(JSON.stringify({ type: 'error', message: 'Terminal unavailable (node-pty not installed)' }));
                        break;
                    }
                    const id = ++terminalCounter;
                    const shell = process.env.SHELL || (os.platform() === 'win32' ? 'powershell.exe' : 'bash');
                    const proc = pty.spawn(shell, [], {
                        name: 'xterm-256color',
                        cols: msg.cols || 80,
                        rows: msg.rows || 24,
                        cwd: msg.cwd || process.cwd(),
                        env: process.env,
                    });
                    const terminal = { id, proc, buffer: [], listeners: new Set([ws]), createdAt: Date.now() };

                    proc.onData((data) => {
                        terminal.buffer.push(data);
                        if (terminal.buffer.length > 1000) terminal.buffer.shift();
                        for (const listener of terminal.listeners) {
                            listener.send(JSON.stringify({ type: 'output', terminalId: id, data }));
                        }
                    });

                    proc.onExit(({ exitCode }) => {
                        for (const listener of terminal.listeners) {
                            listener.send(JSON.stringify({ type: 'exit', terminalId: id, code: exitCode }));
                        }
                        terminals.delete(id);
                    });

                    terminals.set(id, terminal);
                    ws.send(JSON.stringify({ type: 'terminal_created', terminalId: id, pid: proc.pid }));
                    break;
                }

                case 'kill_terminal': {
                    terminateTerminal(msg.terminalId);
                    break;
                }

                case 'screenshot_captured': {
                    const size = msg.dataUrl ? Math.round(msg.dataUrl.length / 1024) : 0;
                    console.log(`  📸 Screenshot received from browser (${size}KB)`);
                    // Broadcast directly to other authenticated clients (CLI agents)
                    for (const client of wss.clients) {
                        if (client !== ws && client.readyState === 1 && authenticatedClients.has(client)) {
                            client.send(JSON.stringify({
                                type: 'browser_vision',
                                dataUrl: msg.dataUrl,
                                url: msg.url,
                                title: msg.title,
                                requestId: msg.requestId,
                            }));
                        }
                    }
                    break;
                }

                case 'dom_data':
                case 'page_summary':
                case 'visible_text':
                case 'element_info': {
                    // Relay browser data to all other authenticated clients (CLI agents)
                    for (const client of wss.clients) {
                        if (client !== ws && client.readyState === 1 && authenticatedClients.has(client)) {
                            client.send(JSON.stringify(msg));
                        }
                    }
                    break;
                }

                case 'logout': {
                    if (wsToken) revokeSession(wsToken);
                    ws.send(JSON.stringify({ type: 'logged_out' }));
                    ws.close(1000, 'Logged out');
                    break;
                }
                case 'ping': {
                    ws.send(JSON.stringify({ type: 'pong' }));
                    break;
                }
            }
        } catch (err) {
            ws.send(JSON.stringify({ type: 'error', message: err.message }));
        }
    });

    ws.on('close', () => {
        clearTimeout(authTimeout);
        for (const terminal of terminals.values()) {
            terminal.listeners.delete(ws);
        }
        authenticatedClients.delete(ws);
        console.log('  📱 Client disconnected');
    });
});

function startCoreIntervals() {
    if (!healthBroadcastInterval) {
        healthBroadcastInterval = setInterval(() => {
            const health = getSystemHealth();
            for (const client of wss.clients) {
                if (client.readyState === 1 && authenticatedClients.has(client)) {
                    client.send(JSON.stringify({ type: 'health', data: health }));
                }
            }
        }, 5000);
        healthBroadcastInterval.unref?.();
    }

    if (!sessionCleanupInterval) {
        sessionCleanupInterval = setInterval(() => {
            const now = Date.now();
            for (const [token, session] of activeSessions) {
                if (now - session.createdAt > SESSION_EXPIRY_MS) {
                    activeSessions.delete(token);
                }
            }
        }, 60000);
        sessionCleanupInterval.unref?.();
    }
}

function stopCoreIntervals() {
    if (healthBroadcastInterval) clearInterval(healthBroadcastInterval);
    if (sessionCleanupInterval) clearInterval(sessionCleanupInterval);
    healthBroadcastInterval = null;
    sessionCleanupInterval = null;
}

// ═══════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════

function getLocalIPs() {
    const interfaces = os.networkInterfaces();
    const ips = [];
    for (const iface of Object.values(interfaces)) {
        for (const addr of iface) {
            if (addr.family === 'IPv4' && !addr.internal) {
                ips.push(addr.address);
            }
        }
    }
    return ips;
}

function getTunnelBaseUrls() {
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

    return Array.from(new Set([...configured, ...Array.from(runtimeTunnelBaseUrls)]));
}

// ═══════════════════════════════════════════════════════════
// START SERVER (exported for programmatic use from soupz-stall)
// ═══════════════════════════════════════════════════════════

export function startRemoteServer(port = DEFAULT_PORT, opts = {}) {
    silentMode = !!opts.silent;
    activePort = port;
    webappBaseUrl = opts.webapp || process.env.SOUPZ_APP_URL || webappBaseUrl;
    return new Promise((resolve, reject) => {
        server.listen(port, () => {
            const localIPs = getLocalIPs();
            startCodeAutoRefresh();
            startRuntimeServices();

            if (!opts.silent) {
                console.log(`\n  \x1b[32m● Soupz running\x1b[0m  http://localhost:${port}\n`);
            }

            const handle = {
                server, wss, port, localIPs,
                getCode: getCurrentCode,
                getConnections,
                onCodeRefresh: (cb) => { codeRefreshCallback = cb; },
                stop: () => {
                    clearInterval(codeRefreshTimer);
                    codeRefreshTimer = null;
                    stopRuntimeServices();
                    server.close();
                },
            };
            resolve(handle);
        });

        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                resolve(null); // not fatal — server already running on this port
            } else {
                reject(err);
            }
        });
    });
}

// ─── Database Maintenance ──────────────────────────────────────────────────
async function runDatabaseCleanup() {
    if (!supabase) return;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    try {
        console.log(`  🧹 Running 30-day database cleanup (before ${thirtyDaysAgo})...`);
        
        // Delete old commands (cascades to responses)
        await supabase
            .from('soupz_commands')
            .delete()
            .lt('created_at', thirtyDaysAgo);
            
        // Delete old pairing codes
        await supabase
            .from('soupz_pairing')
            .delete()
            .lt('expires_at', new Date().toISOString());
            
        console.log(`  ✔ Cleanup complete. Removed old records.`);
    } catch (err) {
        console.error('  ✖ Database cleanup failed:', err.message);
    }
}

function startDatabaseMaintenance() {
    if (!dbCleanupInterval) {
        dbCleanupInterval = setInterval(runDatabaseCleanup, 24 * 60 * 60 * 1000);
        dbCleanupInterval.unref?.();
    }
    runDatabaseCleanup();
}

function stopDatabaseMaintenance() {
    if (dbCleanupInterval) clearInterval(dbCleanupInterval);
    dbCleanupInterval = null;
}

// ─── Maintenance & Sync ──────────────────────────────────────────────────────

async function registerMachine() {
    if (!supabase) return;
    const machineId = os.hostname();
    try {
        await supabase.from('soupz_machines').upsert({
            id: machineId,
            name: machineId,
            last_seen: new Date().toISOString(),
            status: 'online',
            version: '0.1.0-alpha'
        });
    } catch (err) {
        console.error('  ✖ Machine registration failed:', err.message);
    }
}

async function runShadowSync() {
    if (!supabase) return;
    const root = REPO_ROOT;
    try {
        let branch = 'main';
        let headSha = '';
        try {
            branch = execSync('git branch --show-current', { cwd: root, timeout: 2000 }).toString().trim() || 'main';
            headSha = execSync('git rev-parse HEAD', { cwd: root, timeout: 2000 }).toString().trim();
        } catch {}

        const out = execSync('git status --porcelain', { cwd: root, timeout: 3000 }).toString();
        const dirtyFiles = out.split('\n').filter(Boolean).map(l => ({
            status: l.slice(0, 2).trim(),
            path: l.slice(3).trim(),
        }));

        // Push manifest (associated with the machine)
        await supabase.from('soupz_shadow_manifest').upsert({
            machine_id: os.hostname(),
            branch_name: branch,
            head_sha: headSha,
            dirty_files: dirtyFiles,
            last_sync: new Date().toISOString()
        }, { onConflict: 'machine_id' });

    } catch (err) {
        // Silently fail sync
    }
}

// ═══════════════════════════════════════════════════════════
// SUPABASE COMMAND LISTENER (web IDE → local execution)
// ═══════════════════════════════════════════════════════════

async function startCommandListener() {
    if (!supabase || commandListenerChannel) return;

    try {
        const { data: pending, error } = await supabase
            .from('soupz_commands')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: true })
            .limit(20);

        if (error && error.code === '42P01') {
            console.error('\n  ✖ Supabase tables not found.');
            console.log('  Run: soupz sync to setup your database.\n');
            return;
        }

        for (const cmd of pending || []) {
            executeCommand(cmd).catch(() => {});
        }
    } catch (err) {
        // Silently fail if DB is not ready
    }

    commandListenerChannel = supabase
        .channel('soupz_cmd_listener')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'soupz_commands',
        }, (payload) => {
            executeCommand(payload.new).catch(() => {});
        })
        .subscribe();
}

function stopCommandListener() {
    if (!supabase || !commandListenerChannel) return;
    try {
        supabase.removeChannel(commandListenerChannel);
    } catch {}
    try {
        commandListenerChannel.unsubscribe();
    } catch {}
    commandListenerChannel = null;
}

function startRuntimeServices() {
    if (runtimeServicesStarted) return;
    runtimeServicesStarted = true;
    startCoreIntervals();
    startDatabaseMaintenance();
    startFileWatcher();
    startCommandListener().catch(() => {});
}

function stopRuntimeServices() {
    if (!runtimeServicesStarted) return;
    runtimeServicesStarted = false;
    stopCoreIntervals();
    stopDatabaseMaintenance();
    stopFileWatcher();
    stopCommandListener();
}

// Routing priority:
// 1. Try GitHub Copilot locally for classification
// 2. Try Ollama locally for classification
// 3. Keyword matching
// 4. Default to 'gemini'

async function selectAgent(prompt, availableAgents) {
  // 1. Try GitHub Copilot (most capable classification)
  try {
    const classifyPrompt = `Task classifier. Reply with ONLY the agent id from the list, no explanation.
Given this task: "${prompt.slice(0, 300)}"
Pick the best agent from this list: ${availableAgents.join(', ')}
Reply with ONLY the agent id.`;

    const out = execSync(
      `gh copilot suggest -t shell ${JSON.stringify(classifyPrompt)} 2>/dev/null`,
      { timeout: 5000, encoding: 'utf8' }
    ).trim();

    // Look for any of the available agent IDs in the output
    const lowerOut = out.toLowerCase();
    for (const agent of availableAgents) {
      const lowerAgent = agent.toLowerCase();
      if (lowerOut.includes(lowerAgent)) {
        return agent;
      }
      // Special case: if it says "claude" but the ID is "claude-code"
      if (agent === 'claude-code' && lowerOut.includes('claude')) {
        return 'claude-code';
      }
    }
  } catch { /* Copilot unavailable or failed */ }

  // 2. Try Ollama locally
  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen2.5:0.5b',
        prompt: `Given this task: "${prompt}", which agent should handle it? Options: ${availableAgents.join(', ')}. Reply with ONLY the agent id, nothing else.`,
        stream: false,
      }),
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    const picked = data.response?.trim().toLowerCase();
    if (availableAgents.includes(picked)) return picked;
  } catch { /* Ollama not running */ }

  // 3. Keyword matching (fastest fallback)
  const keywords = {
    'claude-code': ['code', 'function', 'bug', 'refactor', 'implement', 'fix', 'typescript', 'javascript'],
    'gemini': ['analyze', 'research', 'explain', 'document', 'summarize'],
    'copilot': ['github', 'pull request', 'issue', 'workflow', 'action'],
    'ollama': [], // local-only tasks
  };
  for (const [agent, words] of Object.entries(keywords)) {
    if (words.some(w => prompt.toLowerCase().includes(w))) {
      if (availableAgents.includes(agent)) return agent;
    }
  }

  // 4. Default
  return availableAgents.includes('gemini') ? 'gemini' : availableAgents[0];
}

async function executeCommand(cmd) {
    const { id, type, payload = {}, user_id } = cmd;

    await supabase.from('soupz_commands').update({ status: 'running' }).eq('id', id);

    let result;
    try {
        switch (type) {
            case 'FILE_TREE': {
                const root = resolve(payload.path || process.cwd());
                const tree = await buildFileTree(root, root);
                let changedFiles = [];
                try {
                    const out = execSync('git status --porcelain', { cwd: root, timeout: 3000 }).toString();
                    changedFiles = out.split('\n').filter(Boolean).map(l => l.slice(3).trim());
                } catch { /* not a git repo */ }
                result = { tree, changedFiles };
                break;
            }

            case 'FILE_READ': {
                const root = resolve(payload.root || process.cwd());
                const filePath = resolve(root, payload.path || '');
                if (!filePath.startsWith(root)) throw new Error('Access denied');
                const stats = await stat(filePath);
                if (stats.size > MAX_FILE_SIZE) throw new Error('File too large for editor');
                const content = await readFile(filePath, 'utf8');
                result = { content, path: payload.path };
                break;
            }

            case 'FILE_WRITE': {
                const root = resolve(payload.root || process.cwd());
                const filePath = resolve(root, payload.path || '');
                if (!filePath.startsWith(root)) throw new Error('Access denied');
                await writeFile(filePath, payload.content || '', 'utf8');
                result = { ok: true };
                break;
            }

            case 'GIT_STATUS': {
                const cwd = payload.path || REPO_ROOT;
                const out = execSync('git status --porcelain', { cwd, timeout: 5000 }).toString();
                const lines = out.split('\n').map((l) => l.trimEnd()).filter(Boolean);
                const staged = [];
                const unstaged = [];
                lines.forEach((line) => {
                    const statusCode = line.slice(0, 2);
                    const path = line.slice(3).trim();
                    const indexStatus = statusCode[0];
                    const workTreeStatus = statusCode[1];
                    if (indexStatus !== ' ' && indexStatus !== '?') staged.push({ path, type: indexStatus });
                    if (workTreeStatus !== ' ' && workTreeStatus !== '?') unstaged.push({ path, type: workTreeStatus });
                    if (statusCode === '??') unstaged.push({ path, type: 'U' });
                });
                let branch = 'main';
                try { branch = execSync('git branch --show-current', { cwd, timeout: 2000 }).toString().trim() || 'main'; } catch {}
                result = { staged, unstaged, branch, porcelain: lines };
                break;
            }

            case 'GIT_DIFF': {
                const cwd = payload.root || REPO_ROOT;
                const escaped = (payload.path || '').replace(/"/g, '\\"');
                const diff = execSync(`git diff -- "${escaped}"`, { cwd, timeout: 5000 }).toString();
                result = { diff, path: payload.path };
                break;
            }

            case 'GIT_STAGE': {
                const cwd = payload.root || REPO_ROOT;
                execSync(`git add -- "${(payload.path || '').replace(/"/g, '\\"')}"`, { cwd, timeout: 5000 });
                result = { ok: true };
                break;
            }

            case 'GIT_COMMIT': {
                const cwd = payload.root || REPO_ROOT;
                execSync(`git commit -m ${JSON.stringify(payload.message || 'Update')}`, { cwd, timeout: 10000 });
                result = { ok: true };
                break;
            }

            case 'GIT_PUSH': {
                const cwd = payload.root || REPO_ROOT;
                execSync('git push', { cwd, timeout: 30000 });
                result = { ok: true };
                break;
            }

            case 'RUN_FILE': {
                const { path: filePath, root } = payload;
                const cwd = root || REPO_ROOT || process.cwd();
                const ext = extname(filePath).toLowerCase();
                let cmd = '';
                if (ext === '.js') cmd = 'node';
                else if (ext === '.py') cmd = 'python3';
                else if (ext === '.sh') cmd = 'bash';
                result = { ok: true, command: `${cmd} ${filePath}`.trim() };
                break;
            }

            case 'AGENT_PROMPT': {
                let resolvedAgentId = payload.agentId;
                if (resolvedAgentId === 'auto') {
                    const available = ['claude-code', 'gemini', 'copilot', 'ollama'].filter(id => {
                        // check if binary exists
                        try { execSync(`which ${id === 'claude-code' ? 'claude' : id}`, { timeout: 1000 }); return true; }
                        catch { return false; }
                    });
                    resolvedAgentId = await selectAgent(payload.prompt, available);
                }
                result = await runAgentPrompt({ ...payload, agentId: resolvedAgentId }, id, user_id);
                break;
            }

            default:
                throw new Error(`Unknown command: ${type}`);
        }

        await supabase.from('soupz_responses').insert({
            command_id: id,
            user_id,
            type,
            result,
            status: 'success',
            created_at: new Date().toISOString(),
        });
        await supabase.from('soupz_commands').update({ status: 'done' }).eq('id', id);
    } catch (err) {
        await supabase.from('soupz_responses').insert({
            command_id: id,
            user_id,
            type,
            result: { error: err.message },
            status: 'error',
            created_at: new Date().toISOString(),
        });
        await supabase.from('soupz_commands').update({ status: 'error' }).eq('id', id);
    }
}

async function runAgentPrompt({ prompt, agentId = 'auto', mode, cwd: workDir }, commandId, userId) {
    if (commandId) registerFleet(commandId, agentId, prompt);

    return new Promise((resolve) => {
        const args = [CLI_ENTRY];
        if (agentId && agentId !== 'auto') {
            args.push('ask', agentId, prompt);
        } else {
            args.push('run', prompt);
        }

        const child = spawn(process.execPath, args, {
            cwd: workDir || REPO_ROOT,
            env: process.env,
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        let fullOutput = '';
        let stderr = '';
        
        child.stdout?.on('data', async (d) => {
            const chunk = d.toString();
            fullOutput += chunk;
            if (supabase && commandId) {
                try {
                    await supabase.from('soupz_output_chunks').insert({
                        order_id: commandId,
                        chunk,
                        created_at: new Date().toISOString(),
                    });
                } catch { /* ignore chunk insert errors */ }
            }
        });
        
        child.stderr?.on('data', (d) => { stderr += d.toString(); });
        
        child.on('close', (code) => {
            if (commandId) unregisterFleet(commandId);
            resolve({ output: fullOutput.trim() || stderr.trim(), exitCode: code });
        });
        child.on('error', (err) => {
            if (commandId) unregisterFleet(commandId);
            resolve({ error: err.message, exitCode: 1 });
        });

    });
}

// Run directly: `node src/index.js`
const isDirectRun = process.argv[1]?.endsWith('index.js') || process.argv[1]?.includes('remote-server');
if (isDirectRun) {
    const port = process.env.SOUPZ_REMOTE_PORT || DEFAULT_PORT;
    startRemoteServer(port);
}