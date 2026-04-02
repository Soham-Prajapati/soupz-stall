// index.js — lean entry point: CORS, system routes, WebSocket, server bootstrap

import { execSync, spawn, spawnSync } from 'child_process';
import { dirname, extname, join, resolve } from 'path';
import { mkdtemp, readFile, rm, stat, writeFile } from 'fs/promises';
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
    explainAgentSelection,
    isAgentInstalled,
    resolveAgentBinary,
    getAgentRuntimeReadiness,
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
        gemini: {
            bin: 'gemini',
            versionCmd: 'gemini --version',
            installable: true,
            hint: 'Install via npm install -g @google/gemini-cli.',
        },
        claude: {
            bin: 'claude',
            versionCmd: 'claude --version',
            installable: true,
            hint: 'Install via npm install -g @anthropic-ai/claude-code.',
        },
        copilot: {
            bin: null,
            versionCmd: null,
            installable: true,
            hint: 'Install Copilot CLI or GitHub CLI + gh-copilot extension.',
        },
        codex: {
            bin: null,
            versionCmd: null,
            installable: true,
            hint: 'Install Codex CLI or GitHub CLI + gh-copilot extension.',
        },
        supabase: {
            bin: 'supabase',
            versionCmd: 'supabase --version',
            installable: true,
            hint: 'Install with Homebrew or npm globally.',
        },
        vercel: {
            bin: 'vercel',
            versionCmd: 'vercel --version',
            installable: true,
            hint: 'Install via npm install -g vercel.',
        },
        git: {
            bin: 'git',
            versionCmd: 'git --version',
            installable: false,
            hint: 'Install Git manually using your OS package manager.',
        },
    };

    const results = {};
    for (const [key, meta] of Object.entries(clis)) {
        const resolvedBinary = (key === 'copilot' || key === 'codex')
            ? resolveAgentBinary(key)
            : meta.bin;
        const versionCmd = (key === 'copilot' || key === 'codex')
            ? (resolvedBinary ? `${resolvedBinary} --version` : null)
            : meta.versionCmd;

        try {
            if (!resolvedBinary) throw new Error('not-installed');
            execSync(`command -v "${resolvedBinary}"`, { timeout: 1000, stdio: 'ignore' });
            results[key] = {
                installed: true,
                ready: !['copilot', 'codex'].includes(key),
                installable: meta.installable !== false,
                hint: meta.hint,
            };
            results[key].binary = resolvedBinary;
            try {
                const versionEnv = { ...process.env };
                if (meta.bin === 'supabase') versionEnv.SUPABASE_HIDE_UPDATE_MESSAGE = '1';
                if (versionCmd) {
                    const versionOutput = execSync(versionCmd, { timeout: 1500, env: versionEnv }).toString().trim();
                    results[key].version = versionOutput.split('\n')[0];
                }
            } catch { /* version lookup optional */ }
            if (key === 'copilot' || key === 'codex') {
                const state = getAgentRuntimeReadiness(key);
                results[key].ready = !!state.ready;

                if (!state.ready) {
                    if (state.reason === 'gh_not_logged_in') {
                        results[key].hint = 'GitHub CLI auth missing: run gh auth login.';
                    } else if (state.reason === 'copilot_extension_missing') {
                        results[key].hint = 'Install/auth gh-copilot extension: gh extension install github/gh-copilot then gh auth login.';
                    } else if (state.reason === 'codex_model_unavailable') {
                        results[key].hint = 'Codex lane is separate from Copilot and needs Codex-capable models in gh copilot models output.';
                    } else {
                        results[key].hint = `Runtime not ready (${state.reason || 'unknown'}).`;
                    }
                } else if (key === 'codex' && state.reason === 'codex_models_probe_unavailable') {
                    results[key].hint = 'Codex is treated separately from Copilot. Model probe is unavailable, so runtime checks occur at execution time.';
                }
            }
        } catch {
            results[key] = {
                installed: false,
                ready: false,
                installable: meta.installable !== false,
                hint: meta.hint,
            };
        }
    }
    res.json(results);
});

// AUTHENTICATED: Manage CLI (Install/Uninstall)
app.post('/api/system/manage-cli', requireAuth, (req, res) => {
    const requestedAction = String(req.body?.action || '').trim();
    const action = requestedAction === 'update' ? 'install' : requestedAction;
    const cli = String(req.body?.cli || '').trim();

    const commands = {
        install: {
            gemini: [
                { cmd: 'npm', args: ['install', '-g', '@google/gemini-cli'] },
            ],
            codex: [
                { cmd: 'gh', args: ['extension', 'install', 'github/gh-copilot'] },
            ],
            claude: [
                { cmd: 'npm', args: ['install', '-g', '@anthropic-ai/claude-code'] },
            ],
            vercel: [
                { cmd: 'npm', args: ['install', '-g', 'vercel'] },
            ],
            supabase: [
                { cmd: 'brew', args: ['install', 'supabase/tap/supabase'] },
                { cmd: 'npm', args: ['install', '-g', 'supabase'] },
            ],
            copilot: [
                { cmd: 'gh', args: ['extension', 'install', 'github/gh-copilot'] },
            ],
        },
        uninstall: {
            gemini: [
                { cmd: 'npm', args: ['uninstall', '-g', '@google/gemini-cli'] },
            ],
            codex: [
                { cmd: 'gh', args: ['extension', 'remove', 'github/gh-copilot'] },
            ],
            claude: [
                { cmd: 'npm', args: ['uninstall', '-g', '@anthropic-ai/claude-code'] },
            ],
            vercel: [
                { cmd: 'npm', args: ['uninstall', '-g', 'vercel'] },
            ],
            supabase: [
                { cmd: 'brew', args: ['uninstall', 'supabase'] },
                { cmd: 'npm', args: ['uninstall', '-g', 'supabase'] },
            ],
            copilot: [
                { cmd: 'gh', args: ['extension', 'remove', 'github/gh-copilot'] },
            ],
        },
    };

    if (!commands[action]) {
        return res.status(400).json({ error: 'Invalid action. Use install, uninstall, or update.' });
    }

    if (cli === 'git') {
        return res.status(400).json({
            error: 'Git install is not managed by Soupz. Install Git manually with your OS package manager.',
            manual: true,
        });
    }

    const attempts = commands[action][cli];
    if (!attempts || attempts.length === 0) {
        return res.status(400).json({ error: `Unsupported CLI: ${cli}` });
    }

    const failures = [];
    for (const attempt of attempts) {
        const run = spawnSync(attempt.cmd, attempt.args, {
            encoding: 'utf8',
            timeout: 120000,
            env: process.env,
        });

        const stdout = String(run.stdout || '').trim();
        const stderr = String(run.stderr || '').trim();

        if (run.status === 0) {
            return res.json({
                success: true,
                output: stdout || `${cli} ${action} completed.`,
            });
        }

        failures.push({
            command: `${attempt.cmd} ${attempt.args.join(' ')}`,
            code: run.status,
            error: run.error?.message || stderr || stdout || 'Unknown failure',
        });
    }

    const primaryError = failures[0]?.error || `${action} failed`;
    return res.status(500).json({
        error: `Failed to ${action} ${cli}: ${primaryError}`,
        attempts: failures,
    });
});

// PUBLIC: List available CLI agents with detailed status
app.get('/api/agents', (req, res) => {
    const installs = {
        gemini: isAgentInstalled('gemini'),
        codex: isAgentInstalled('codex'),
        'claude-code': isAgentInstalled('claude-code'),
        copilot: isAgentInstalled('copilot'),
        kiro: isAgentInstalled('kiro'),
        ollama: isAgentInstalled('ollama'),
    };

    const runtime = {
        gemini: getAgentRuntimeReadiness('gemini'),
        codex: getAgentRuntimeReadiness('codex'),
        'claude-code': getAgentRuntimeReadiness('claude-code'),
        copilot: getAgentRuntimeReadiness('copilot'),
        kiro: getAgentRuntimeReadiness('kiro'),
        ollama: getAgentRuntimeReadiness('ollama'),
    };

    const agentStatus = {
        gemini: {
            installed: installs.gemini,
            ready: runtime.gemini.ready,
            tier: 'free',
            usagePolicy: 'free-tier-quota',
            reason: runtime.gemini.reason,
        },
        codex: {
            installed: installs.codex,
            ready: runtime.codex.ready,
            tier: 'freemium',
            usagePolicy: 'plan-quota',
            lane: 'codex-reasoning',
            reason: runtime.codex.reason,
        },
        'claude-code': {
            installed: installs['claude-code'],
            ready: runtime['claude-code'].ready,
            tier: 'premium',
            usagePolicy: 'subscription',
            reason: runtime['claude-code'].reason,
        },
        copilot: {
            installed: installs.copilot,
            ready: runtime.copilot.ready,
            tier: 'freemium',
            usagePolicy: 'plan-quota',
            lane: 'copilot-workflow',
            reason: runtime.copilot.reason,
        },
        kiro: {
            installed: installs.kiro,
            ready: runtime.kiro.ready,
            tier: 'premium',
            usagePolicy: 'subscription',
            reliability: 'low',
            reason: runtime.kiro.reason,
        },
        ollama: {
            installed: installs.ollama,
            ready: runtime.ollama.ready,
            tier: 'free',
            usagePolicy: 'local-unlimited',
            reason: runtime.ollama.reason,
        },
    };

    const simple = {
        gemini: runtime.gemini.ready,
        codex: runtime.codex.ready,
        'claude-code': runtime['claude-code'].ready,
        copilot: runtime.copilot.ready,
        kiro: runtime.kiro.ready,
        ollama: runtime.ollama.ready,
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

// PUBLIC: Classify a prompt using deterministic transparent routing logic.
app.post('/api/classify', async (req, res) => {
    const { prompt, availableAgents = [] } = req.body || {};
    if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

    const agentList = availableAgents.length ? availableAgents : ['claude-code', 'gemini', 'codex', 'copilot', 'kiro', 'ollama'];
    const specialistList = ['dev', 'architect', 'ai-engineer', 'devops', 'security', 'designer', 'ux-designer', 'researcher', 'analyst', 'strategist', 'pm', 'contentwriter', 'techwriter'];

    const lower = String(prompt || '').toLowerCase();
    let specialist = 'dev';
    if (/\b(architecture|module|boundary|tradeoff|system design)\b/.test(lower)) specialist = 'architect';
    else if (/\b(devops|infra|docker|k8s|deploy|pipeline|aws|gcp|azure|terraform)\b/.test(lower)) specialist = 'devops';
    else if (/\b(security|auth|privacy|threat|compliance|abuse)\b/.test(lower)) specialist = 'security';
    else if (/\b(ui|ux|design|layout|visual|prototype|accessibility)\b/.test(lower)) specialist = 'designer';
    else if (/\b(research|benchmark|compare|analysis|market|insight)\b/.test(lower)) specialist = 'researcher';
    else if (/\b(strategy|positioning|roadmap|go-to-market|pitch|plan)\b/.test(lower)) specialist = 'strategist';
    else if (/\b(product|mvp|scope|milestone|timeline|prioritization)\b/.test(lower)) specialist = 'pm';
    else if (/\b(write|copy|blog|documentation|doc|content)\b/.test(lower)) specialist = 'contentwriter';

    if (!specialistList.includes(specialist)) specialist = specialistList[0] || 'dev';

    const explained = explainAgentSelection(prompt, agentList);

    return res.json({
        cliAgent: explained.agent,
        specialist,
        method: explained.method,
        confidence: explained.confidence,
        justification: explained.justification,
    });
});

// AUTHENTICATED: Explain routing decision for transparency/debugging
app.post('/api/routing/explain', requireAuth, async (req, res) => {
    const prompt = (req.body?.prompt || '').toString().trim();
    if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

    const cwd = (req.body?.cwd || REPO_ROOT).toString();
    const allowed = normalizeAllowedAgents(req.body?.allowedAgents);
    const readyState = getReadyAgentsInPriorityOrder(cwd, allowed);
    const pool = readyState.ready.length > 0
        ? readyState.ready
        : (readyState.installed.length > 0 ? readyState.installed : ['gemini']);

    const explained = explainAgentSelection(prompt, pool);
    return res.json({
        selected: explained.agent,
        method: explained.method,
        confidence: explained.confidence,
        justification: explained.justification,
        installed: readyState.installed,
        ready: readyState.ready,
        skipped: readyState.skipped,
    });
});

// ─── File execution ───────────────────────────────────────────────────────────

function runProcess(command, args, { cwd, timeoutMs = 120000, maxOutputBytes = 512000 } = {}) {
    return new Promise((resolvePromise) => {
        const startedAt = Date.now();
        let stdout = '';
        let stderr = '';
        let settled = false;
        let timedOut = false;

        const child = spawn(command, args, {
            cwd,
            env: process.env,
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        const timer = setTimeout(() => {
            timedOut = true;
            try { child.kill('SIGTERM'); } catch {}
            setTimeout(() => {
                try { child.kill('SIGKILL'); } catch {}
            }, 1500).unref?.();
        }, timeoutMs);

        const append = (target, chunk) => {
            const text = chunk.toString();
            if (target.length >= maxOutputBytes) return target;
            return (target + text).slice(0, maxOutputBytes);
        };

        child.stdout.on('data', (chunk) => {
            stdout = append(stdout, chunk);
        });

        child.stderr.on('data', (chunk) => {
            stderr = append(stderr, chunk);
        });

        child.on('error', (err) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolvePromise({
                exitCode: 1,
                stdout,
                stderr: `${stderr}\n${err.message}`.trim(),
                timedOut,
                durationMs: Date.now() - startedAt,
            });
        });

        child.on('close', (code) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolvePromise({
                exitCode: code ?? 1,
                stdout,
                stderr,
                timedOut,
                durationMs: Date.now() - startedAt,
            });
        });
    });
}

// POST /api/exec — Run a file with the appropriate runtime (authenticated)
app.post('/api/exec', requireAuth, async (req, res) => {
    const { path: filePath, root } = req.body;
    if (!filePath) return res.status(400).json({ error: 'Missing path' });

    const cwd = resolve(root || REPO_ROOT || process.cwd());
    const fullPath = resolve(cwd, filePath);

    if (!fullPath.startsWith(cwd)) {
        return res.status(403).json({ error: 'Access denied' });
    }

    if (!existsSync(fullPath)) return res.status(404).json({ error: 'File not found' });

    const ext = extname(filePath).toLowerCase();

    const runResultPayload = (commandString, result, extras = {}) => {
        const exitCode = Number.isFinite(result?.exitCode) ? result.exitCode : 1;
        return {
            ok: exitCode === 0 && !result?.timedOut,
            command: commandString,
            exitCode,
            timedOut: !!result?.timedOut,
            durationMs: Number.isFinite(result?.durationMs) ? result.durationMs : 0,
            stdout: result?.stdout || '',
            stderr: result?.stderr || '',
            ...extras,
        };
    };

    try {
        if (ext === '.js' || ext === '.mjs' || ext === '.cjs') {
            const result = await runProcess('node', [fullPath], { cwd: dirname(fullPath) });
            return res.json(runResultPayload(`node ${filePath}`, result));
        }

        if (ext === '.py') {
            const result = await runProcess('python3', [fullPath], { cwd: dirname(fullPath) });
            return res.json(runResultPayload(`python3 ${filePath}`, result));
        }

        if (ext === '.sh') {
            const result = await runProcess('bash', [fullPath], { cwd: dirname(fullPath) });
            return res.json(runResultPayload(`bash ${filePath}`, result));
        }

        if (ext === '.rb') {
            const result = await runProcess('ruby', [fullPath], { cwd: dirname(fullPath) });
            return res.json(runResultPayload(`ruby ${filePath}`, result));
        }

        if (ext === '.go') {
            const result = await runProcess('go', ['run', fullPath], { cwd: dirname(fullPath) });
            return res.json(runResultPayload(`go run ${filePath}`, result));
        }

        if (ext === '.c' || ext === '.cpp' || ext === '.cc' || ext === '.cxx') {
            const tempDir = await mkdtemp(join(os.tmpdir(), 'soupz-run-'));
            const binName = os.platform() === 'win32' ? 'run.exe' : 'run.out';
            const binaryPath = join(tempDir, binName);
            const compiler = ext === '.c' ? 'gcc' : 'g++';

            const compile = await runProcess(compiler, [fullPath, '-o', binaryPath], {
                cwd: dirname(fullPath),
                timeoutMs: 180000,
            });

            if (compile.exitCode !== 0 || compile.timedOut) {
                await rm(tempDir, { recursive: true, force: true }).catch(() => {});
                return res.json(runResultPayload(`${compiler} ${filePath} -o ${binName}`, compile, {
                    phase: 'compile',
                }));
            }

            const execute = await runProcess(binaryPath, [], {
                cwd: dirname(fullPath),
                timeoutMs: 180000,
            });
            await rm(tempDir, { recursive: true, force: true }).catch(() => {});

            return res.json(runResultPayload(`${compiler} ${filePath} -o ${binName} && ${binName}`, execute, {
                phase: 'execute',
                compileStdout: compile.stdout,
                compileStderr: compile.stderr,
            }));
        }

        return res.status(400).json({
            error: `Unsupported file type: ${ext || 'unknown'}`,
            supported: ['.js', '.mjs', '.cjs', '.py', '.sh', '.rb', '.go', '.c', '.cpp', '.cc', '.cxx'],
        });
    } catch (err) {
        return res.status(500).json({ error: err?.message || 'Failed to execute file' });
    }
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
                    changedFiles = out.split('\n').map((line) => line.trimEnd()).filter(Boolean);
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
                const staged = new Map();
                const unstaged = new Map();
                const files = new Map();

                const normalizePorcelainPath = (path = '') => {
                    const cleaned = String(path || '').trim();
                    if (!cleaned) return '';
                    if (cleaned.includes('->')) {
                        const parts = cleaned.split('->');
                        return parts[parts.length - 1].trim();
                    }
                    return cleaned;
                };

                const upsert = (map, path, type) => {
                    if (!path) return;
                    map.set(path, { path, type: type || 'M' });
                };

                lines.forEach((line) => {
                    const statusCode = line.slice(0, 2);
                    const path = normalizePorcelainPath(line.slice(3).trim());
                    const indexStatus = statusCode[0];
                    const workTreeStatus = statusCode[1];
                    if (indexStatus !== ' ' && indexStatus !== '?') upsert(staged, path, indexStatus);
                    if (workTreeStatus !== ' ' && workTreeStatus !== '?') upsert(unstaged, path, workTreeStatus);
                    if (statusCode === '??') upsert(unstaged, path, 'U');

                    const unifiedType = statusCode === '??'
                        ? 'U'
                        : (workTreeStatus !== ' ' && workTreeStatus !== '?')
                            ? workTreeStatus
                            : (indexStatus !== ' ' && indexStatus !== '?')
                                ? indexStatus
                                : 'M';
                    upsert(files, path, unifiedType);
                });
                let branch = 'main';
                try { branch = execSync('git branch --show-current', { cwd, timeout: 2000 }).toString().trim() || 'main'; } catch {}
                result = {
                    staged: Array.from(staged.values()),
                    unstaged: Array.from(unstaged.values()),
                    files: Array.from(files.values()),
                    branch,
                    porcelain: lines,
                };
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
                    const agentBinaryMap = {
                        'claude-code': 'claude',
                        gemini: 'gemini',
                        codex: 'gh',
                        copilot: 'gh',
                        ollama: 'ollama',
                    };
                    const available = ['claude-code', 'gemini', 'codex', 'copilot', 'ollama'].filter(id => {
                        try {
                            execSync(`which ${agentBinaryMap[id] || id}`, { timeout: 1000 });
                            return true;
                        }
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
            // Model probing can be slow on machines with many CLIs; skip it in silent/test runs.
            if (!opts.silent && process.env.SOUPZ_DISABLE_MODEL_BOOT_DISCOVERY !== '1') {
                setTimeout(() => {
                    discoverAllModels().catch(() => {});
                }, 15000);
            }

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
