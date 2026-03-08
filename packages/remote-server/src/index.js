import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pty = require('node-pty');
import os from 'os';
import { execSync } from 'child_process';
import crypto from 'crypto';

const DEFAULT_PORT = 7533;
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

    return { code, expiresAt, expiresIn: Math.round(PAIRING_CODE_EXPIRY_MS / 1000) };
}

let silentMode = false;

/** Auto-refresh: generate a new code and display it, repeat every 5 minutes */
function startCodeAutoRefresh() {
    if (codeRefreshTimer) clearInterval(codeRefreshTimer);
    currentPairingCode = createPairingCode();

    codeRefreshTimer = setInterval(() => {
        currentPairingCode = createPairingCode();
        if (!silentMode) {
            console.log(`\n  \x1b[38;5;214m🔑  New Order Number: ${currentPairingCode.code}\x1b[0m  \x1b[2m(auto-refreshed, expires in ${currentPairingCode.expiresIn}s)\x1b[0m`);
        }
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
    const token = req.headers['x-soupz-token'] || req.query.token;
    if (!token || !isValidSession(token)) {
        return res.status(401).json({ error: 'Unauthorized. Use /pair to get a pairing code.' });
    }
    next();
}

// Track active terminals
const terminals = new Map();
let terminalCounter = 0;

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

            // FIRST MESSAGE MUST BE AUTH
            if (!wsAuthenticated) {
                if (msg.type === 'auth') {
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

            const banner = `
  \x1b[38;5;197m🫕  ═══════════════════════════════════════════\x1b[0m
  \x1b[38;5;197m    SOUPZ CLOUD KITCHEN — Remote Stove\x1b[0m
  \x1b[38;5;197m  ═══════════════════════════════════════════\x1b[0m

  \x1b[1mSTOVE STATUS:\x1b[0m  \x1b[32m🔥 HOT\x1b[0m
  \x1b[1mREST API:\x1b[0m      \x1b[34mhttp://localhost:${port}\x1b[0m
  \x1b[1mWEBSOCKET:\x1b[0m     \x1b[34mws://localhost:${port}\x1b[0m
${localIPs.map(ip => `  \x1b[1mLAN ACCESS:\x1b[0m    \x1b[34mws://${ip}:${port}\x1b[0m`).join('\n')}

  \x1b[38;5;214m🔑  ORDER NUMBER:  ${currentPairingCode.code}\x1b[0m
      \x1b[2mAuto-refreshes every ${currentPairingCode.expiresIn}s\x1b[0m

  \x1b[1m📱  MOBILE:\x1b[0m  Enter code in Expo app
  \x1b[1m🔌  BROWSER:\x1b[0m Click 🫕 extension → enter code

  \x1b[38;5;197m═══════════════════════════════════════════════\x1b[0m
`;
            if (!opts.silent) console.log(banner);

            resolve({ server, wss, port, localIPs, getCode: getCurrentCode, getConnections, stop: () => {
                clearInterval(codeRefreshTimer);
                server.close();
            }});
        });

        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                if (!opts.silent) console.log(`  ⚠️  Port ${port} in use — Cloud Kitchen already running`);
                resolve(null); // not fatal — server may already be running
            } else {
                reject(err);
            }
        });
    });
}

// Run directly: `node src/index.js`
const isDirectRun = process.argv[1]?.endsWith('index.js') || process.argv[1]?.includes('remote-server');
if (isDirectRun) {
    const port = process.env.SOUPZ_REMOTE_PORT || DEFAULT_PORT;
    startRemoteServer(port);
}