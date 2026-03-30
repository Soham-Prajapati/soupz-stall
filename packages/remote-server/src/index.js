// index.js — lean entry point: CORS, system routes, WebSocket, server bootstrap

import { execSync, spawn } from 'child_process';
import { resolve, extname } from 'path';
import { readFile, writeFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import os from 'os';
import crypto from 'crypto';
import express from 'express';
import { discoverAllModels, categorizeModels, clearModelCache } from './model-discovery.js';

import {
    app,
    server,
    wss,
    ctx,
    supabase,
    REPO_ROOT,
    CLI_ENTRY,
    DEFAULT_PORT,
    MAX_FILE_SIZE,
    orders,
    activeSessions,
    authenticatedClients,
    terminals,
    orderMetrics,
    ORDER_MAX_AGE_MS,
    SESSION_EXPIRY_MS,
    TERMINAL_ORPHAN_TIMEOUT_MS,
    _orderStarters,
    getSystemHealth,
    getLocalIPs,
    getConnections,
    isValidSession,
    requireAuth,
    broadcastOrderUpdate,
    broadcast,
    registerFleet,
    unregisterFleet,
    selectAgent,
    isAgentInstalled,
    getInstalledAgentsInPriorityOrder,
    getReadyAgentsInPriorityOrder,
    resolveAutoRunAgent,
    resolveRunAgent,
    normalizeAllowedAgents,
    wsConnectionsPerIp,
    pty,
    MAX_TERMINALS,
    TERMINAL_BUFFER_MAX_LINES,
    nextTerminalId,
    terminateTerminal,
    revokeSession,
} from './shared.js';

import { startCodeAutoRefresh, getCurrentCode, getCurrentPairingSnapshot, validatePairingCode } from './pairing.js';
import { startSingleAgentOrder } from './orders.js';
import { startDeepOrchestratedOrder } from './deep-mode.js';
import { startFileWatcher, stopFileWatcher, buildFileTree } from './filesystem.js';
import './git-endpoints.js';
import './workspace.js';

// ─── Wire late-bound order starters ──────────────────────────────────────────

_orderStarters.single = startSingleAgentOrder;
_orderStarters.deep = startDeepOrchestratedOrder;

// Middleware (CORS + express.json) applied in shared.js before module imports

// ─── Health endpoints ─────────────────────────────────────────────────────────

// PUBLIC: Health check (no auth needed — useful for discovery)
app.get('/health', (req, res) => {
    res.json({ ...getSystemHealth(), authenticated: false, port: ctx.activePort, lanIPs: getLocalIPs(), hostname: os.hostname() });
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

// ─── Agent / model endpoints ──────────────────────────────────────────────────

// AUTHENTICATED: Check installed CLIs for the onboarding flow
app.get('/api/system/check-clis', requireAuth, (req, res) => {
    const clis = {
        gemini: { bin: 'gemini', versionCmd: 'gemini --version' },
        claude: { bin: 'claude', versionCmd: 'claude --version' },
        copilot: { bin: 'gh', versionCmd: 'gh --version' },
        supabase: { bin: 'supabase', versionCmd: 'supabase --version' },
        vercel: { bin: 'vercel', versionCmd: 'vercel --version' },
        git: { bin: 'git', versionCmd: 'git --version' },
    };

    const results = {};
    for (const [key, meta] of Object.entries(clis)) {
        try {
            execSync(`which ${meta.bin}`, { timeout: 1000 });
            results[key] = { installed: true, ready: key !== 'copilot' };
            try {
                const versionEnv = { ...process.env };
                if (meta.bin === 'supabase') versionEnv.SUPABASE_HIDE_UPDATE_MESSAGE = '1';
                const versionOutput = execSync(meta.versionCmd, { timeout: 1500, env: versionEnv }).toString().trim();
                results[key].version = versionOutput.split('\n')[0];
            } catch { /* version lookup optional */ }
            if (key === 'copilot') {
                try {
                    const exts = execSync('gh extension list 2>/dev/null', { timeout: 3000 }).toString();
                    results[key].ready = exts.includes('copilot');
                } catch {
                    results[key].ready = false;
                }
            }
        } catch {
            results[key] = { installed: false, ready: false };
        }
    }
    res.json(results);
});

// AUTHENTICATED: Manage CLI (Install/Uninstall)
app.post('/api/system/manage-cli', requireAuth, (req, res) => {
    const { action, cli } = req.body;

    const packages = {
        gemini: '@google/gemini-cli',
        claude: '@anthropic-ai/claude-code',
        supabase: 'supabase',
        vercel: 'vercel',
        copilot: '@github/copilot'
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
            execSync(`${bin} --version`, { timeout: 1500, stdio: 'ignore' });
            results[key] = true;
        } catch {
            results[key] = false;
        }
    }

    let ollamaRunning = false;
    if (results.ollama) {
        try {
            execSync('curl -s --max-time 1 http://localhost:11434/api/tags > /dev/null 2>&1', { timeout: 2000 });
            ollamaRunning = true;
        } catch { /* ollama installed but not running */ }
    }

    let copilotReady = false;
    if (results.gh) {
        try {
            const exts = execSync('gh extension list 2>/dev/null', { timeout: 3000 }).toString();
            copilotReady = exts.includes('copilot');
        } catch { /* gh installed but copilot extension missing */ }
    }

    const agentStatus = {
        gemini:        { installed: results.gemini, ready: results.gemini, tier: 'free' },
        'claude-code': { installed: results.claude, ready: results.claude, tier: 'premium' },
        copilot:       { installed: results.gh, ready: copilotReady, tier: 'freemium' },
        kiro:          { installed: results.kiro, ready: results.kiro, tier: 'premium', reliability: 'low' },
        ollama:        { installed: results.ollama, ready: ollamaRunning, tier: 'free' },
    };

    const simple = {
        gemini:        results.gemini,
        'claude-code': results.claude,
        copilot:       copilotReady,
        kiro:          results.kiro,
        ollama:        ollamaRunning,
    };

    if (req.query.detailed === 'true') {
        res.json({ agents: agentStatus, available: Object.entries(simple).filter(([,v]) => v).map(([k]) => k) });
    } else {
        res.json(simple);
    }
});

// List discovered models for all CLI agents (cached 24h)
app.get('/api/models', requireAuth, async (req, res) => {
    try {
        const all = await discoverAllModels();
        const categorized = {};
        for (const [agent, models] of Object.entries(all)) {
            categorized[agent] = { available: models, recommended: categorizeModels(models) };
        }
        res.json({ agents: categorized });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Force re-probe all agent models (clears cache)
app.post('/api/models/refresh', requireAuth, async (req, res) => {
    try {
        clearModelCache();
        const all = await discoverAllModels();
        res.json({ refreshed: true, agents: Object.keys(all) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUBLIC: Classify a prompt to best agent (uses best available free model)
app.post('/api/classify', async (req, res) => {
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

    return res.status(503).json({ error: 'No classifier available', method: 'local' });
});

// ─── File execution ───────────────────────────────────────────────────────────

// POST /api/exec — Run a file with the appropriate runtime (authenticated)
app.post('/api/exec', requireAuth, (req, res) => {
    const { path: filePath, root } = req.body;
    if (!filePath) return res.status(400).json({ error: 'Missing path' });

    const cwd = root || REPO_ROOT || process.cwd();
    const fullPath = resolve(cwd, filePath);

    if (!existsSync(fullPath)) return res.status(404).json({ error: 'File not found' });

    const ext = extname(filePath).toLowerCase();
    let cmd = '';
    if (ext === '.js') cmd = 'node';
    else if (ext === '.py') cmd = 'python3';
    else if (ext === '.sh') cmd = 'bash';
    else if (ext === '.rb') cmd = 'ruby';
    else if (ext === '.go') cmd = 'go run';
    else if (ext === '.rs') cmd = 'cargo run';

    res.json({ ok: true, command: `${cmd} ${filePath}`.trim() });
});

// ─── Local command relay ──────────────────────────────────────────────────────

// POST /command — unified command endpoint for web IDE (no auth for local browser)
app.post('/command', (req, res) => {
    const clientIP = req.ip || req.connection?.remoteAddress;
    const isLocal = clientIP === '127.0.0.1' || clientIP === '::1' || clientIP === '::ffff:127.0.0.1';
    if (!isLocal) return res.status(403).json({ error: 'Remote access requires authentication via /pair' });

    res.json({ ok: true, commandId: req.body.id || crypto.randomUUID() });
    // Commands are handled asynchronously and results pushed via WebSocket
});

// ─── WebSocket handler ────────────────────────────────────────────────────────

wss.on('connection', (ws, req) => {
    let wsAuthenticated = false;
    let wsToken = null;

    const clientIP = req.socket?.remoteAddress;
    const isLocal = clientIP === '127.0.0.1' || clientIP === '::1' || clientIP === '::ffff:127.0.0.1';

    const ipCount = (wsConnectionsPerIp.get(clientIP) || 0) + 1;
    if (ipCount > 20) {
        ws.close(1013, 'Too many connections');
        return;
    }
    wsConnectionsPerIp.set(clientIP, ipCount);

    ws._messageCount = 0;
    ws._messageCountResetTimer = setInterval(() => { ws._messageCount = 0; }, 1000);

    ws.on('close', () => {
        const c = wsConnectionsPerIp.get(clientIP) || 1;
        if (c <= 1) wsConnectionsPerIp.delete(clientIP);
        else wsConnectionsPerIp.set(clientIP, c - 1);
        clearInterval(ws._messageCountResetTimer);
        for (const terminal of terminals.values()) {
            terminal.listeners.delete(ws);
        }
        authenticatedClients.delete(ws);
        console.log('  📱 Client disconnected');
    });

    ws._soupzAlive = true;
    ws.on('pong', () => { ws._soupzAlive = true; });

    const authTimeout = setTimeout(() => {
        if (!wsAuthenticated) {
            ws.send(JSON.stringify({ type: 'error', message: 'Authentication timeout. Send {type:"auth", token:"..."} within 10 seconds.' }));
            ws.close(4001, 'Auth timeout');
        }
    }, 10000);

    ws.on('message', (raw) => {
        if (typeof raw === 'string' && raw.length > 1024 * 1024) {
            ws.send(JSON.stringify({ type: 'error', message: 'Message too large (max 1MB)' }));
            return;
        }
        ws._messageCount++;
        if (ws._messageCount > 100) {
            ws.send(JSON.stringify({ type: 'error', message: 'Rate limited (max 100 msg/sec)' }));
            return;
        }
        try {
            const msg = JSON.parse(raw);

            if (!wsAuthenticated) {
                if (msg.type === 'auth') {
                    if (isLocal) {
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
                    if (terminals.size >= MAX_TERMINALS) {
                        ws.send(JSON.stringify({ type: 'error', message: `Maximum ${MAX_TERMINALS} terminals allowed` }));
                        break;
                    }
                    const id = nextTerminalId();
                    const shell = process.env.SHELL || (os.platform() === 'win32' ? 'powershell.exe' : 'bash');
                    const proc = pty.spawn(shell, [], {
                        name: 'xterm-256color',
                        cols: msg.cols || 80,
                        rows: msg.rows || 24,
                        cwd: msg.cwd || process.cwd(),
                        env: process.env,
                    });
                    const terminal = { id, proc, buffer: [], listeners: new Set([ws]), createdAt: Date.now(), lastActivity: Date.now() };

                    proc.onData((data) => {
                        terminal.buffer.push(data);
                        terminal.lastActivity = Date.now();
                        if (terminal.buffer.length > TERMINAL_BUFFER_MAX_LINES) terminal.buffer = terminal.buffer.slice(-TERMINAL_BUFFER_MAX_LINES);
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
});

// ─── Service intervals ────────────────────────────────────────────────────────

function startCoreIntervals() {
    if (!ctx.healthBroadcastInterval) {
        ctx.healthBroadcastInterval = setInterval(() => {
            const health = getSystemHealth();
            for (const client of wss.clients) {
                if (client.readyState === 1 && authenticatedClients.has(client)) {
                    client.send(JSON.stringify({ type: 'health', data: health }));
                }
            }
        }, 5000);
        ctx.healthBroadcastInterval.unref?.();
    }

    if (!ctx.sessionCleanupInterval) {
        ctx.sessionCleanupInterval = setInterval(() => {
            const now = Date.now();
            for (const [token, session] of activeSessions) {
                if (now - session.createdAt > SESSION_EXPIRY_MS) {
                    activeSessions.delete(token);
                }
            }
        }, 60000);
        ctx.sessionCleanupInterval.unref?.();
    }

    if (!ctx.orderCleanupInterval) {
        ctx.orderCleanupInterval = setInterval(() => {
            const now = Date.now();
            for (const [id, order] of orders) {
                if (order.status !== 'running' && order.status !== 'pending' && order.status !== 'queued') {
                    const refTime = order.finishedAt ? new Date(order.finishedAt).getTime() : (order.createdAt ? new Date(order.createdAt).getTime() : 0);
                    if (now - refTime > ORDER_MAX_AGE_MS) {
                        orders.delete(id);
                    }
                }
            }
        }, 5 * 60 * 1000);
        ctx.orderCleanupInterval.unref?.();
    }

    if (!ctx.terminalOrphanInterval) {
        ctx.terminalOrphanInterval = setInterval(() => {
            const now = Date.now();
            for (const [id, terminal] of terminals) {
                if (terminal.listeners.size === 0 && now - (terminal.lastActivity || terminal.createdAt || 0) > TERMINAL_ORPHAN_TIMEOUT_MS) {
                    terminal.proc?.kill();
                    terminals.delete(id);
                }
            }
        }, 60000);
        ctx.terminalOrphanInterval.unref?.();
    }
}

function stopCoreIntervals() {
    if (ctx.healthBroadcastInterval) clearInterval(ctx.healthBroadcastInterval);
    if (ctx.sessionCleanupInterval) clearInterval(ctx.sessionCleanupInterval);
    if (ctx.heartbeatInterval) clearInterval(ctx.heartbeatInterval);
    if (ctx.orderCleanupInterval) clearInterval(ctx.orderCleanupInterval);
    if (ctx.terminalOrphanInterval) clearInterval(ctx.terminalOrphanInterval);
    ctx.healthBroadcastInterval = null;
    ctx.sessionCleanupInterval = null;
    ctx.heartbeatInterval = null;
    ctx.orderCleanupInterval = null;
    ctx.terminalOrphanInterval = null;
}

// ─── Database maintenance ─────────────────────────────────────────────────────

async function runDatabaseCleanup() {
    if (!supabase) return;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    try {
        console.log(`  🧹 Running 30-day database cleanup (before ${thirtyDaysAgo})...`);

        await supabase
            .from('soupz_commands')
            .delete()
            .lt('created_at', thirtyDaysAgo);

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
    if (!ctx.dbCleanupInterval) {
        ctx.dbCleanupInterval = setInterval(runDatabaseCleanup, 24 * 60 * 60 * 1000);
        ctx.dbCleanupInterval.unref?.();
    }
    runDatabaseCleanup();
}

function stopDatabaseMaintenance() {
    if (ctx.dbCleanupInterval) clearInterval(ctx.dbCleanupInterval);
    ctx.dbCleanupInterval = null;
}

// ─── Machine registration and shadow sync ─────────────────────────────────────

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

        await supabase.from('soupz_shadow_manifest').upsert({
            machine_id: os.hostname(),
            branch_name: branch,
            head_sha: headSha,
            dirty_files: dirtyFiles,
            last_sync: new Date().toISOString()
        }, { onConflict: 'machine_id' });

    } catch {
        // Silently fail sync
    }
}

// ─── Supabase command listener ────────────────────────────────────────────────

async function startCommandListener() {
    if (!supabase || ctx.commandListenerChannel) return;

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
    } catch {
        // Silently fail if DB is not ready
    }

    ctx.commandListenerChannel = supabase
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
    if (!supabase || !ctx.commandListenerChannel) return;
    try {
        supabase.removeChannel(ctx.commandListenerChannel);
    } catch {}
    try {
        ctx.commandListenerChannel.unsubscribe();
    } catch {}
    ctx.commandListenerChannel = null;
}

// ─── Runtime services ─────────────────────────────────────────────────────────

function startRuntimeServices() {
    if (ctx.runtimeServicesStarted) return;
    ctx.runtimeServicesStarted = true;
    startCoreIntervals();
    startDatabaseMaintenance();
    startFileWatcher();
    startCommandListener().catch(() => {});
}

function stopRuntimeServices() {
    if (!ctx.runtimeServicesStarted) return;
    ctx.runtimeServicesStarted = false;
    stopCoreIntervals();
    stopDatabaseMaintenance();
    stopFileWatcher();
    stopCommandListener();
}

// ─── Execute command (Supabase relay) ────────────────────────────────────────

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
                const fileStats = await stat(filePath);
                if (fileStats.size > MAX_FILE_SIZE) throw new Error('File too large for editor');
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
                let cmdStr = '';
                if (ext === '.js') cmdStr = 'node';
                else if (ext === '.py') cmdStr = 'python3';
                else if (ext === '.sh') cmdStr = 'bash';
                result = { ok: true, command: `${cmdStr} ${filePath}`.trim() };
                break;
            }

            case 'AGENT_PROMPT': {
                let resolvedAgentId = payload.agentId;
                if (resolvedAgentId === 'auto') {
                    const available = ['claude-code', 'gemini', 'copilot', 'ollama'].filter(id => {
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

// ─── Server bootstrap ─────────────────────────────────────────────────────────

export function startRemoteServer(port = DEFAULT_PORT, opts = {}) {
    ctx.silentMode = !!opts.silent;
    ctx.activePort = port;
    ctx.webappBaseUrl = opts.webapp || process.env.SOUPZ_APP_URL || ctx.webappBaseUrl;
    return new Promise((resolve, reject) => {
        server.listen(port, async () => {
            const localIPs = getLocalIPs();
            await startCodeAutoRefresh();
            startRuntimeServices();
            discoverAllModels().catch(() => {});

            ctx.heartbeatInterval = setInterval(() => {
                wss.clients.forEach(ws => {
                    if (ws._soupzAlive === false) {
                        ws.terminate();
                        return;
                    }
                    ws._soupzAlive = false;
                    ws.ping();
                });
            }, 30000);

            if (!ctx.silentMode) {
                console.log(`\n  \x1b[32m● Soupz running\x1b[0m  http://localhost:${port}\n`);
            }

            const handle = {
                server, wss, port, localIPs,
                getCode: getCurrentPairingSnapshot,
                getConnections,
                onCodeRefresh: (cb) => { ctx.codeRefreshCallback = cb; },
                stop: () => {
                    clearInterval(ctx.codeRefreshTimer);
                    ctx.codeRefreshTimer = null;
                    stopRuntimeServices();
                    server.close();
                },
            };
            resolve(handle);
        });

        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                resolve(null);
            } else {
                reject(err);
            }
        });
    });
}

// ─── Direct run ───────────────────────────────────────────────────────────────

const isDirectRun = process.argv[1]?.endsWith('index.js') || process.argv[1]?.includes('remote-server');
if (isDirectRun) {
    const port = process.env.SOUPZ_REMOTE_PORT || DEFAULT_PORT;
    startRemoteServer(port);
}
