// orders.js — order lifecycle management and order API routes

import { execSync, spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import {
    app,
    ctx,
    supabase,
    SUPABASE_TABLE,
    orders,
    orderRuntimes,
    orderMetrics,
    pendingOrderQueue,
    wss,
    authenticatedClients,
    requireAuth,
    CLI_ENTRY,
    REPO_ROOT,
    WEB_AGENT_ALIASES,
    MAX_CONCURRENT_ORDERS,
    MAX_DEEP_WORKERS,
    DEEP_NESTED_ENABLED_DEFAULT,
    DEEP_NESTED_MAX_PARENTS,
    DEEP_NESTED_SUBAGENTS_PER_PARENT,
    nextOrderId,
    createOrderRuntime,
    getOrderRuntime,
    cleanupOrderRuntime,
    registerOrderChild,
    touchOrderChild,
    setChildFinished,
    appendLaneBuffer,
    pushOrderOutputDelta,
    flushOrderOutputDeltas,
    cancelOrderChildren,
    toStreamChunk,
    nowIso,
    toOrderSummary,
    pushOrderEvent,
    persistOrder,
    broadcastOrderUpdate,
    processOrderQueue,
    normalizeAllowedAgents,
    resolveRunAgent,
    resolveAutoRunAgent,
    getInstalledAgentsInPriorityOrder,
    getReadyAgentsInPriorityOrder,
    inferExecutionRole,
    inferSpecialistsFromPrompt,
    estimateDeepWorkerCount,
    getAgentRuntimeReadiness,
} from './shared.js';
import { startDeepOrchestratedOrder } from './deep-mode.js';
import { archiveOrderResult } from './run-archive.js';

// ─── Single-agent order execution ─────────────────────────────────────────────

export function startSingleAgentOrder(order, runAgent, mcpServers) {
    const runtime = createOrderRuntime(order);
    const args = [CLI_ENTRY, 'ask', runAgent, order.prompt];

    // Map agent ID to CLI binary name for availability check
    const AGENT_BINARY_MAP = { 'gemini': 'gemini', 'codex': 'gh', 'copilot': 'gh', 'claude-code': 'claude', 'kiro': 'kiro', 'ollama': 'ollama' };
    const agentBinary = AGENT_BINARY_MAP[runAgent] || runAgent;

    // Before spawning, verify binary is available
    try {
        execSync(`which ${agentBinary}`, { timeout: 2000, stdio: 'ignore' });
    } catch {
        const fallbackOrder = ['gemini', 'codex', 'copilot', 'ollama', 'claude-code'];
        const nextAgent = fallbackOrder.find((a) => a !== runAgent && getAgentRuntimeReadiness(a, order.cwd || REPO_ROOT).ready);
        if (nextAgent) {
            pushOrderEvent(order, 'agent.binary_missing', { agent: runAgent, fallback: nextAgent });
            startSingleAgentOrder(order, nextAgent, mcpServers);
            return;
        }
    }

    const spawnEnv = { ...process.env };
    if (mcpServers.length > 0) {
        spawnEnv.SOUPZ_MCP_SERVERS = JSON.stringify(mcpServers);
    }

    const spawnStartTime = Date.now();
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
        orderMetrics.total++;
        if (order.status === 'completed') orderMetrics.completed++;
        else if (order.status !== 'cancelled') orderMetrics.failed++;
        const duration = Date.now() - (order.createdAt ? new Date(order.createdAt).getTime() : Date.now());
        orderMetrics.totalDurationMs += duration;
        order.durationMs = duration;
        const agent = order.run_agent || order.agent || 'unknown';
        orderMetrics.byAgent[agent] = (orderMetrics.byAgent[agent] || 0) + 1;
        void persistOrder(order);
        void archiveOrderResult(order);
        broadcastOrderUpdate(order);
        processOrderQueue();
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
        const duration = Date.now() - spawnStartTime;
        if (code !== 0 && duration < 2000 && !order._instantCrashRetried) {
            order._instantCrashRetried = true;
            pushOrderEvent(order, 'agent.instant_crash', { agent: runAgent, duration, exitCode: code });
            const fallbackOrder = ['gemini', 'codex', 'copilot', 'ollama'];
            const nextAgent = fallbackOrder.find((a) => a !== runAgent && getAgentRuntimeReadiness(a, order.cwd || REPO_ROOT).ready);
            if (nextAgent) { startSingleAgentOrder(order, nextAgent, mcpServers); return; }
        }
        if (code === 0) {
            finalize('completed', { exitCode: code });
        } else {
            finalize('failed', { exitCode: code });
        }
    });
}

// ─── Interactive input handling ───────────────────────────────────────────────

export function submitOrderInput(order, runtime, answers = {}) {
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

// ─── Worker summary helper ────────────────────────────────────────────────────

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

// ─── Routes ───────────────────────────────────────────────────────────────────

// AUTHENTICATED: Create a new orchestrated order from web dashboard
app.post('/api/orders', requireAuth, async (req, res) => {
    const prompt = (req.body?.prompt || '').toString().trim();
    const requestedAgent = (req.body?.agent || 'auto').toString().trim() || 'auto';
    const agent = WEB_AGENT_ALIASES.get(requestedAgent) || requestedAgent;
    const modelPolicy = (req.body?.modelPolicy || 'balanced').toString().trim() || 'balanced';
    const orchestrationMode = (req.body?.orchestrationMode || '').toString().trim() || (modelPolicy === 'deep' ? 'parallel' : 'single');
    const mcpServers = Array.isArray(req.body?.mcpServers) ? req.body.mcpServers : [];
    const rawAllowedAgents = req.body?.allowedAgents;
    const allowedAgents = normalizeAllowedAgents(rawAllowedAgents);
    const payloadWorkerCount = Number.parseInt(req.body?.workerCount, 10);
    const payloadPrimaryCopies = Number.parseInt(req.body?.primaryCopies, 10);
    const sameAgentOnly = typeof req.body?.sameAgentOnly === 'boolean'
        ? req.body.sameAgentOnly
        : agent !== 'auto';
    const useAiPlanner = req.body?.useAiPlanner !== false;
    const plannerStyle = (req.body?.plannerStyle || 'balanced').toString().trim().toLowerCase();
    const plannerNotes = (req.body?.plannerNotes || '').toString().trim().slice(0, 4000);
    const previewWorkerCount = estimateDeepWorkerCount(prompt, Number.isFinite(payloadWorkerCount) ? payloadWorkerCount : null);
    const nestedMaxParents = Number.parseInt(req.body?.nestedMaxParents, 10);
    const nestedSubAgentsPerWorker = Number.parseInt(req.body?.nestedSubAgentsPerWorker, 10);

    if (Array.isArray(rawAllowedAgents) && allowedAgents && allowedAgents.length === 0) {
        return res.status(400).json({ error: 'No valid allowedAgents were provided' });
    }
    const deepPolicy = {
        workerCount: Number.isFinite(payloadWorkerCount) ? Math.max(1, Math.min(MAX_DEEP_WORKERS, payloadWorkerCount)) : null,
        primaryCopies: Number.isFinite(payloadPrimaryCopies) ? Math.max(1, Math.min(MAX_DEEP_WORKERS, payloadPrimaryCopies)) : null,
        sameAgentOnly,
        useAiPlanner,
        plannerStyle,
        plannerNotes,
        timeoutMs: 0,
        allowSynthesisFallback: req.body?.allowSynthesisFallback !== false,
        workerCountResolved: previewWorkerCount,
        workerCountMax: MAX_DEEP_WORKERS,
        enableNestedDelegation: typeof req.body?.enableNestedDelegation === 'boolean'
            ? req.body.enableNestedDelegation
            : DEEP_NESTED_ENABLED_DEFAULT,
        nestedMaxParents: Number.isFinite(nestedMaxParents)
            ? Math.max(1, Math.min(MAX_DEEP_WORKERS, nestedMaxParents))
            : DEEP_NESTED_MAX_PARENTS,
        nestedSubAgentsPerWorker: Number.isFinite(nestedSubAgentsPerWorker)
            ? Math.max(1, Math.min(4, nestedSubAgentsPerWorker))
            : DEEP_NESTED_SUBAGENTS_PER_PARENT,
        nestedTimeoutMs: 0,
        nestedSynthesisTimeoutMs: 0,
        enableNestedTeamSynthesis: req.body?.enableNestedTeamSynthesis !== false,
    };
    const orderCwd = (req.body?.cwd || '').toString().trim() || REPO_ROOT;
    let runAgent = null;
    let routeMeta = { method: 'fallback-chain', available: [] };

    if (agent === 'auto') {
        const auto = await resolveAutoRunAgent(prompt, orderCwd, allowedAgents);
        runAgent = auto.agent;
        routeMeta = {
            method: auto.method,
            confidence: auto.confidence ?? null,
            justification: auto.justification || null,
            available: auto.available || [],
            ready: auto.ready || [],
            skipped: auto.skipped || [],
        };
    } else {
        const resolved = resolveRunAgent(agent, allowedAgents);
        runAgent = resolved.agent;
        routeMeta = {
            method: resolved.fallback ? 'explicit-fallback' : 'explicit',
            fallback: resolved.fallback || false,
            originalRequest: resolved.originalRequest || null,
            confidence: 1,
            justification: {
                selected: runAgent,
                reason: resolved.fallback
                    ? `Requested agent ${requestedAgent} unavailable; using ${runAgent} via fallback chain.`
                    : `Requested agent ${requestedAgent} explicitly selected by user.`,
                candidates: [],
                signals: [],
            },
            available: getInstalledAgentsInPriorityOrder(),
            ready: getReadyAgentsInPriorityOrder(orderCwd, allowedAgents).ready,
        };
    }

    if (!prompt) {
        return res.status(400).json({ error: 'Missing prompt' });
    }

    const id = nextOrderId();
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
        allowedAgents,
    };

    // Read workspace config for agent context
    let workspaceConfig = {};
    try {
        const wsConfigPath = join(orderCwd, '.soupz', 'config.json');
        if (existsSync(wsConfigPath)) {
            workspaceConfig = JSON.parse(readFileSync(wsConfigPath, 'utf8'));
        }
    } catch { /* no workspace config */ }

    // Inject workspace context into prompt
    if (workspaceConfig.supabaseUrl) {
        order.prompt = `[Project Context: This project uses Supabase at ${workspaceConfig.supabaseUrl}. Use @supabase/supabase-js for database operations.]\n\n${order.prompt}`;
    }
    if (workspaceConfig.customInstructions) {
        order.prompt = `[Custom Instructions: ${workspaceConfig.customInstructions}]\n\n${order.prompt}`;
    }

    pushOrderEvent(order, 'order.created', { prompt: order.prompt, agent, modelPolicy, orchestrationMode, cwd: orderCwd });
    pushOrderEvent(order, 'route.selected', {
        agent: runAgent,
        primaryRole: inferExecutionRole(runAgent, prompt),
        specialistsPlanned: inferSpecialistsFromPrompt(prompt, previewWorkerCount),
        deepPolicy,
        requested: requestedAgent,
        resolved: agent,
        routeMethod: routeMeta.method,
        routeConfidence: routeMeta.confidence,
        routeJustification: routeMeta.justification,
        fallback: routeMeta.fallback || false,
        originalRequest: routeMeta.originalRequest || null,
        available: routeMeta.available || [],
        ready: routeMeta.ready || [],
        skipped: routeMeta.skipped || [],
        allowedAgents,
    });
    orders.set(id, order);
    void persistOrder(order);
    broadcastOrderUpdate(order);

    // Check concurrency limit
    if (getActiveOrderCount() >= MAX_CONCURRENT_ORDERS) {
        order.status = 'queued';
        pendingOrderQueue.push(order.id);
        broadcastOrderUpdate(order);
        return res.status(202).json({ id: order.id, status: 'queued', position: pendingOrderQueue.length, ...toOrderSummary(order) });
    }

    // Start the order immediately if under limit
    if (orchestrationMode === 'parallel') {
        void startDeepOrchestratedOrder(order, runAgent, mcpServers);
    } else {
        startSingleAgentOrder(order, runAgent, mcpServers);
    }

    return res.status(202).json({ id: order.id, ...toOrderSummary(order) });
});

// Helper for checking active order count (imported from shared)
function getActiveOrderCount() {
    return Array.from(orders.values()).filter(o => o.status === 'running' || o.status === 'pending').length;
}

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

// AUTHENTICATED: Order metrics aggregate
app.get('/api/orders/metrics', requireAuth, (req, res) => {
    const avgDuration = orderMetrics.total > 0 ? Math.round(orderMetrics.totalDurationMs / orderMetrics.total) : 0;
    const successRate = orderMetrics.total > 0 ? Math.round((orderMetrics.completed / orderMetrics.total) * 100) : 0;
    res.json({
        total: orderMetrics.total,
        completed: orderMetrics.completed,
        failed: orderMetrics.failed,
        avgDurationMs: avgDuration,
        successRate,
        byAgent: orderMetrics.byAgent,
    });
});
