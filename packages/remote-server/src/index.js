import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
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
        supabase
            .from('soupz_pairing')
            .upsert({
                code,
                token,
                hostname: os.hostname(),
                lan_ips: getLocalIPs(),
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
    const clientIP = req.ip || req.connection?.remoteAddress;
    const isLocal = clientIP === '127.0.0.1' || clientIP === '::1' || clientIP === '::ffff:127.0.0.1';
    if (isLocal) {
        return next();
    }

    const token = req.headers['x-soupz-token'] || req.query.token;
    if (!token || !isValidSession(token)) {
        return res.status(401).json({ error: 'Unauthorized. Use /pair to get a pairing code.' });
    }
    next();
}

// Track active terminals
const terminals = new Map();
let terminalCounter = 0;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, '../../../');
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
    };
}

function pushOrderEvent(order, type, data = {}) {
    order.events.push({
        type,
        at: nowIso(),
        ...data,
    });
    if (order.events.length > 500) order.events = order.events.slice(-500);
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
    const pairing = createPairingCode();

    // Build QR code data — contains server URL + pairing code
    const localIPs = getLocalIPs();
    const qrData = JSON.stringify({
        type: 'soupz-pair',
        host: localIPs[0] || 'localhost',
        port: activePort,
        code: pairing.code,
    });

    if (!silentMode) {
        console.log(`\n  🔑 Pairing code generated: ${pairing.code}`);
        console.log(`     Expires in ${pairing.expiresIn}s\n`);
    }

    res.json({
        code: pairing.code,
        expiresIn: pairing.expiresIn,
        qrData,
        connectUrls: localIPs.map(ip => `ws://${ip}:${activePort}`),
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
        list.push({ id, pid: t.proc?.pid, alive: true, lines: t.buffer.length });
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

// Ordered fallback chain — try free agents first
const AGENT_FALLBACK_CHAIN = ['gemini', 'copilot', 'claude-code', 'ollama'];

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

// AUTHENTICATED: Create a new orchestrated order from web dashboard
app.post('/api/orders', requireAuth, (req, res) => {
    const prompt = (req.body?.prompt || '').toString().trim();
    const requestedAgent = (req.body?.agent || 'auto').toString().trim() || 'auto';
    const agent = WEB_AGENT_ALIASES.get(requestedAgent) || requestedAgent;
    const modelPolicy = (req.body?.modelPolicy || 'balanced').toString().trim() || 'balanced';
    const mcpServers = Array.isArray(req.body?.mcpServers) ? req.body.mcpServers : [];
    const resolved = resolveRunAgent(agent);
    const runAgent = resolved.agent;

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
        status: 'queued',
        createdAt,
        startedAt: null,
        finishedAt: null,
        stdout: '',
        stderr: '',
        events: [],
        exitCode: null,
        pid: null,
    };

    pushOrderEvent(order, 'order.created', { prompt, agent, modelPolicy });
    pushOrderEvent(order, 'route.selected', {
        agent: runAgent,
        requested: requestedAgent,
        resolved: agent,
        fallback: resolved.fallback || false,
        originalRequest: resolved.originalRequest || null,
    });
    orders.set(id, order);
    void persistOrder(order);
    broadcastOrderUpdate(order);

    const args = [CLI_ENTRY];
    // Web dashboard path is intentionally single-agent to avoid accidental fan-out.
    args.push('ask', runAgent, prompt);

    const spawnEnv = { ...process.env };
    if (mcpServers.length > 0) {
        spawnEnv.SOUPZ_MCP_SERVERS = JSON.stringify(mcpServers);
    }

    const child = spawn(process.execPath, args, {
        cwd: REPO_ROOT,
        env: spawnEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    order.pid = child.pid;
    order.status = 'running';
    order.startedAt = nowIso();
    pushOrderEvent(order, 'chef.started', { pid: child.pid, mode: 'ask', agent: runAgent });
    void persistOrder(order);
    broadcastOrderUpdate(order);

    child.stdout.on('data', (chunk) => {
        const text = chunk.toString();
        order.stdout += text;
        if (order.stdout.length > 200000) order.stdout = order.stdout.slice(-200000);
        pushOrderEvent(order, 'chef.output.delta', { stream: 'stdout', chars: text.length });
        // Stream chunks to WebSocket clients in real-time
        const streamMsg = JSON.stringify({ type: 'agent_chunk', orderId: id, chunk: text, agentId: runAgent });
        for (const client of wss.clients) {
            if (client.readyState === 1 && authenticatedClients.has(client)) {
                client.send(streamMsg);
            }
        }
    });

    child.stderr.on('data', (chunk) => {
        const text = chunk.toString();
        order.stderr += text;
        if (order.stderr.length > 120000) order.stderr = order.stderr.slice(-120000);
        pushOrderEvent(order, 'chef.output.delta', { stream: 'stderr', chars: text.length });
    });

    child.on('error', (err) => {
        order.status = 'failed';
        order.finishedAt = nowIso();
        pushOrderEvent(order, 'order.failed', { message: err.message });
        void persistOrder(order);
        broadcastOrderUpdate(order);
    });

    child.on('close', (code) => {
        order.exitCode = code;
        order.finishedAt = nowIso();
        if (code === 0) {
            order.status = 'completed';
            pushOrderEvent(order, 'order.completed', { exitCode: code });
        } else {
            order.status = 'failed';
            pushOrderEvent(order, 'order.failed', { exitCode: code });
        }
        void persistOrder(order);
        broadcastOrderUpdate(order);
    });

    return res.status(202).json({ order: toOrderSummary(order) });
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
        return res.json({
            order: {
                ...toOrderSummary(memOrder),
                pid: memOrder.pid, exitCode: memOrder.exitCode,
                events: memOrder.events, stdout: memOrder.stdout, stderr: memOrder.stderr,
            },
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
                    order: {
                        id: data.id, prompt: data.prompt, agent: data.agent, runAgent: data.run_agent,
                        modelPolicy: data.model_policy, status: data.status, createdAt: data.created_at,
                        startedAt: data.started_at, finishedAt: data.finished_at, durationMs: data.duration_ms,
                        exitCode: data.exit_code, events: data.events || [], stdout: data.stdout || '',
                        stderr: data.stderr || '', eventCount: (data.events || []).length,
                    },
                });
            }
        } catch { /* fall through */ }
    }
    return res.status(404).json({ error: 'Order not found' });
});

// AUTHENTICATED: Changed files for dashboard drawer
app.get('/api/changes', requireAuth, (req, res) => {
    try {
        const out = execSync('git -C "$PWD" status --porcelain', { cwd: REPO_ROOT, timeout: 4000 }).toString();
        const lines = out.split('\n').map((l) => l.trimEnd()).filter(Boolean);
        const changes = lines.map((line) => {
            const statusCode = line.slice(0, 2).trim() || '??';
            const path = line.slice(3).trim();
            let status = 'modified';
            if (statusCode === 'M') status = 'modified';
            else if (statusCode === 'A') status = 'added';
            else if (statusCode === 'D') status = 'deleted';
            else if (statusCode.includes('R')) status = 'renamed';
            else if (statusCode.includes('?')) status = 'untracked';
            return { file: path, status };
        });
        // Get current branch name
        let branch = 'main';
        try {
            branch = execSync('git -C "$PWD" branch --show-current', { cwd: REPO_ROOT, timeout: 2000 }).toString().trim() || 'main';
        } catch { /* fallback to main */ }
        res.json({ changes, branch });
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
        const diff = execSync(`git -C "$PWD" --no-pager diff -- "${escaped}"`, { cwd: REPO_ROOT, timeout: 4000 }).toString();
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

    const terminal = { id, proc, buffer: [], listeners: new Set() };

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

// ═══════════════════════════════════════════════════════════
// FILE SYSTEM & GIT API (for web IDE)
// ═══════════════════════════════════════════════════════════

import { readdir, readFile, writeFile, stat, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, relative, extname, join } from 'path';

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
    const children = [];
    for (const entry of entries) {
        if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
        const fullPath = join(dirPath, entry.name);
        const relPath = relative(rootPath, fullPath);
        if (entry.isDirectory()) {
            const subtree = await buildFileTree(fullPath, rootPath, depth + 1);
            if (subtree) children.push({ name: entry.name, path: relPath, type: 'directory', children: subtree.children });
        } else {
            children.push({ name: entry.name, path: relPath, type: 'file' });
        }
    }
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
        // Get changed files from git
        let changedFiles = [];
        try {
            const out = execSync('git status --porcelain', { cwd: rootPath, timeout: 3000 }).toString();
            changedFiles = out.split('\n').filter(Boolean).map(l => l.slice(3).trim());
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

wss.on('connection', (ws) => {
    let wsAuthenticated = false;
    let wsToken = null;

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
            
            // Bypass auth for local browser connections
            const clientIP = req?.socket?.remoteAddress; // We don't have req here easily, we need to get IP from ws object
            // Actually, ws._socket.remoteAddress
            const remoteAddress = ws._socket?.remoteAddress;
            const isLocal = remoteAddress === '127.0.0.1' || remoteAddress === '::1' || remoteAddress === '::ffff:127.0.0.1';

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
                        console.log(`  💻 Local dashboard authenticated automatically`);
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
                    const terminal = { id, proc, buffer: [], listeners: new Set([ws]) };

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
                    const terminal = terminals.get(msg.terminalId);
                    if (terminal?.proc) {
                        terminal.proc.kill();
                        terminals.delete(msg.terminalId);
                    }
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

// Health broadcast every 5 seconds (only to authenticated clients)
setInterval(() => {
    const health = getSystemHealth();
    for (const client of wss.clients) {
        if (client.readyState === 1 && authenticatedClients.has(client)) {
            client.send(JSON.stringify({ type: 'health', data: health }));
        }
    }
}, 5000);

// Clean expired sessions every minute
setInterval(() => {
    const now = Date.now();
    for (const [token, session] of activeSessions) {
        if (now - session.createdAt > SESSION_EXPIRY_MS) {
            activeSessions.delete(token);
        }
    }
}, 60000);

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

// ═══════════════════════════════════════════════════════════
// START SERVER (exported for programmatic use from soupz-stall)
// ═══════════════════════════════════════════════════════════

export function startRemoteServer(port = DEFAULT_PORT, opts = {}) {
    silentMode = !!opts.silent;
    activePort = port;
    return new Promise((resolve, reject) => {
        server.listen(port, () => {
            const localIPs = getLocalIPs();
            startCodeAutoRefresh();

            if (!opts.silent) {
                console.log(`\n  \x1b[32m● Soupz running\x1b[0m  http://localhost:${port}\n`);
            }

            // Start Supabase command listener (wires web IDE → local execution)
            startCommandListener().catch(() => {});

            const handle = {
                server, wss, port, localIPs,
                getCode: getCurrentCode,
                getConnections,
                onCodeRefresh: (cb) => { codeRefreshCallback = cb; },
                stop: () => {
                    clearInterval(codeRefreshTimer);
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

// ═══════════════════════════════════════════════════════════
// SUPABASE COMMAND LISTENER (web IDE → local execution)
// ═══════════════════════════════════════════════════════════

async function startCommandListener() {
    if (!supabase) return;

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

    supabase
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
                const cwd = payload.path || process.cwd();
                const out = execSync('git status --porcelain', { cwd, timeout: 5000 }).toString();
                const files = out.split('\n').filter(Boolean).map(l => ({
                    status: l.slice(0, 2).trim(),
                    path: l.slice(3).trim(),
                }));
                result = { files };
                break;
            }

            case 'GIT_DIFF': {
                const cwd = payload.root || process.cwd();
                const escaped = (payload.path || '').replace(/"/g, '\\"');
                const diff = execSync(`git diff -- "${escaped}"`, { cwd, timeout: 5000 }).toString();
                result = { diff, path: payload.path };
                break;
            }

            case 'GIT_STAGE': {
                const cwd = payload.root || process.cwd();
                execSync(`git add -- "${(payload.path || '').replace(/"/g, '\\"')}"`, { cwd, timeout: 5000 });
                result = { ok: true };
                break;
            }

            case 'GIT_COMMIT': {
                const cwd = payload.root || process.cwd();
                execSync(`git commit -m ${JSON.stringify(payload.message || 'Update')}`, { cwd, timeout: 10000 });
                result = { ok: true };
                break;
            }

            case 'GIT_PUSH': {
                const cwd = payload.root || process.cwd();
                execSync('git push', { cwd, timeout: 30000 });
                result = { ok: true };
                break;
            }

            case 'AGENT_PROMPT': {
                result = await runAgentPrompt(payload);
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

async function runAgentPrompt({ prompt, agentId = 'auto', mode, cwd: workDir }) {
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

        let stdout = '';
        let stderr = '';
        child.stdout?.on('data', (d) => { stdout += d.toString(); });
        child.stderr?.on('data', (d) => { stderr += d.toString(); });
        child.on('close', (code) => {
            resolve({ output: stdout.trim() || stderr.trim(), exitCode: code });
        });
        child.on('error', (err) => {
            resolve({ error: err.message, exitCode: 1 });
        });

        // 5-minute timeout
        setTimeout(() => {
            child.kill();
            resolve({ output: stdout.trim(), timedOut: true });
        }, 300000);
    });
}

// Run directly: `node src/index.js`
const isDirectRun = process.argv[1]?.endsWith('index.js') || process.argv[1]?.includes('remote-server');
if (isDirectRun) {
    const port = process.env.SOUPZ_REMOTE_PORT || DEFAULT_PORT;
    startRemoteServer(port);
}