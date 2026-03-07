import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pty = require('node-pty');
import os from 'os';
import { execSync } from 'child_process';
import crypto from 'crypto';

const PORT = process.env.SOUPZ_REMOTE_PORT || 7533;
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

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
        },
        warnings: [
            ...(usedMem / totalMem > 0.9 ? ['⚠️ RAM usage above 90%'] : []),
            ...(cpuLoad[0] > cpus.length * 0.8 ? ['⚠️ CPU load is high'] : []),
            ...(cpuTemp && cpuTemp > 85 ? ['🔥 CPU temperature is high'] : []),
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
        port: PORT,
        code: pairing.code,
    });

    console.log(`\n  🔑 Pairing code generated: ${pairing.code}`);
    console.log(`     Expires in ${pairing.expiresIn}s\n`);

    res.json({
        code: pairing.code,
        expiresIn: pairing.expiresIn,
        qrData,
        connectUrls: localIPs.map(ip => `ws://${ip}:${PORT}`),
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

    console.log(`  ✅ Device paired successfully (code: ${code})`);
    res.json({ token, expiresIn: Math.round(SESSION_EXPIRY_MS / 1000) });
});

// PUBLIC: Health check (no auth needed — useful for discovery)
app.get('/health', (req, res) => {
    res.json({ ...getSystemHealth(), authenticated: false });
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

                case 'logout': {
                    if (wsToken) revokeSession(wsToken);
                    ws.send(JSON.stringify({ type: 'logged_out' }));
                    ws.close(1000, 'Logged out');
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
// START SERVER
// ═══════════════════════════════════════════════════════════

server.listen(PORT, () => {
    const localIPs = getLocalIPs();
    const pairing = createPairingCode();

    console.log(`
  \x1b[38;5;197m🫕  ═══════════════════════════════════════════\x1b[0m
  \x1b[38;5;197m    SOUPZ CLOUD KITCHEN — Remote Stove\x1b[0m
  \x1b[38;5;197m  ═══════════════════════════════════════════\x1b[0m

  \x1b[1mSTOVE STATUS:\x1b[0m  \x1b[32m🔥 HOT\x1b[0m
  \x1b[1mREST API:\x1b[0m      \x1b[34mhttp://localhost:${PORT}\x1b[0m
  \x1b[1mWEBSOCKET:\x1b[0m     \x1b[34mws://localhost:${PORT}\x1b[0m
${localIPs.map(ip => `  \x1b[1mLAN ACCESS:\x1b[0m    \x1b[34mws://${ip}:${PORT}\x1b[0m`).join('\n')}

  \x1b[38;5;214m🔑  ORDER NUMBER (Pairing Code):  ${pairing.code}\x1b[0m
      \x1b[2mExpires in ${pairing.expiresIn}s\x1b[0m

  \x1b[1m📱  MOBILE IDE:\x1b[0m
      1. Open Expo Go on your phone
      2. Connect to LAN URL
      3. Enter order number: \x1b[1m${pairing.code}\x1b[0m

  \x1b[1m🔌  BROWSER BRIDGE:\x1b[0m
      1. Click 🫕 extension icon
      2. Enter order number: \x1b[1m${pairing.code}\x1b[0m

  \x1b[1m💻  COMMAND CENTER:\x1b[0m
      1. Open \x1b[34msrc/dashboard/index.html\x1b[0m
      2. Real-time glassmorphism analytics

  \x1b[38;5;197m═══════════════════════════════════════════════\x1b[0m
`);
});