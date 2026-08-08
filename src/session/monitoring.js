function asFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function formatDuration(milliseconds) {
    const ms = Math.max(0, asFiniteNumber(milliseconds) ?? 0);
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}

function formatCount(value) {
    return (asFiniteNumber(value) ?? 0).toLocaleString();
}

function formatText(value, fallback = 'unknown') {
    const text = String(value ?? '').replace(/\s+/g, ' ').trim();
    return text || fallback;
}

function truncate(value, length = 96) {
    const text = formatText(value, 'no task description');
    return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

export function indicatesNeedsInput(value) {
    const text = String(value ?? '').slice(-500);
    return /\b(?:needs?|waiting for|requires?)\s+(?:user\s+|human\s+)?input\b/i.test(text)
        || /\b(?:approve|confirm)\b[^\n]{0,80}(?:\by\s*\/\s*n\b|\[y\/n\])/i.test(text)
        || /\bpress\s+enter\s+to\s+continue\b/i.test(text);
}

/**
 * Session meter data intentionally separates observed runtime facts from
 * provider usage. We do not infer token counts or dollar costs from text
 * length: those values are unknown until a provider reports them.
 */
export function createMeter(startedAt = Date.now()) {
    return {
        startedAt,
        prompts: 0,
        commands: 0,
        agentRunsStarted: 0,
        agentRunsCompleted: 0,
        agentRunsFailed: 0,
        agentRunMilliseconds: 0,
        activeAgentRuns: new Map(),
        providerUsage: null,
    };
}

export function recordSessionInput(meter, input) {
    if (!meter || !String(input ?? '').trim()) return;
    if (String(input).trimStart().startsWith('/')) meter.commands += 1;
    else meter.prompts += 1;
}

export function recordAgentRunState(meter, agentId, state, now = Date.now()) {
    if (!meter || !agentId) return false;
    if (!(meter.activeAgentRuns instanceof Map)) meter.activeAgentRuns = new Map();

    if (state === 'running') {
        if (!meter.activeAgentRuns.has(agentId)) {
            meter.activeAgentRuns.set(agentId, now);
            meter.agentRunsStarted += 1;
            return true;
        }
        return false;
    }

    if (state !== 'done' && state !== 'error') return false;
    const startedAt = meter.activeAgentRuns.get(agentId);
    // close/error can both fire for the same child process. A terminal event is
    // only observable usage when this meter saw the matching start, so ignore
    // duplicates and orphaned terminal notifications.
    if (asFiniteNumber(startedAt) === null) return false;
    meter.agentRunMilliseconds += Math.max(0, now - startedAt);
    meter.activeAgentRuns.delete(agentId);
    if (state === 'done') meter.agentRunsCompleted += 1;
    else meter.agentRunsFailed += 1;
    return true;
}

function measuredUsage(meter) {
    const usage = meter?.providerUsage;
    if (!usage || usage.source !== 'provider') return null;

    return {
        inputTokens: asFiniteNumber(usage.inputTokens),
        outputTokens: asFiniteNumber(usage.outputTokens),
        costUsd: asFiniteNumber(usage.costUsd),
    };
}

export function renderMeterView(meter, now = Date.now()) {
    const state = meter || createMeter(now);
    const startedAt = asFiniteNumber(state.startedAt) ?? now;
    const activeRuns = state.activeAgentRuns instanceof Map ? state.activeAgentRuns.size : 0;
    const usage = measuredUsage(state);
    const lines = [
        'Soupz CLI meter',
        `  Session: ${formatDuration(now - startedAt)}`,
        `  Prompts: ${formatCount(state.prompts)}  ·  REPL commands: ${formatCount(state.commands)}`,
        `  Agent runs: ${formatCount(state.agentRunsStarted)} started  ·  ${formatCount(state.agentRunsCompleted)} completed  ·  ${formatCount(state.agentRunsFailed)} failed  ·  ${formatCount(activeRuns)} active`,
        `  Observed agent time: ${formatDuration(state.agentRunMilliseconds)}`,
    ];

    if (usage && usage.inputTokens !== null && usage.outputTokens !== null) {
        lines.push(`  Provider tokens: ${usage.inputTokens.toLocaleString()} input  ·  ${usage.outputTokens.toLocaleString()} output`);
    } else {
        lines.push('  Provider tokens: unavailable (no provider usage telemetry received)');
    }

    if (usage && usage.costUsd !== null) {
        lines.push(`  Provider cost: $${usage.costUsd.toFixed(4)}`);
    } else {
        lines.push('  Provider cost: unavailable (no provider billing telemetry received)');
    }

    return lines.join('\n');
}

function workerStatus(worker) {
    if (!worker || typeof worker !== 'object') return 'unknown';
    const status = String(worker?.status || '').toLowerCase();
    if (!status) return 'unknown';
    if (status === 'done' || status === 'completed' || status === 'synthesized') return 'completed';
    if (status === 'failed' || status === 'error') return 'failed';
    if (status === 'needs-input' || status === 'needs_input' || status === 'waiting-input' || status === 'waiting_input') return 'needs-input';
    if (status === 'running') return 'running';
    return 'unknown';
}

function workerTimestamp(worker) {
    return asFiniteNumber(worker?.finishedAt)
        ?? asFiniteNumber(worker?.updatedAt)
        ?? asFiniteNumber(worker?.startTime);
}

function workerAge(worker, now) {
    const duration = asFiniteNumber(worker?.duration);
    if (duration !== null && workerStatus(worker) !== 'running' && workerStatus(worker) !== 'needs-input') return duration;
    const timestamp = workerTimestamp(worker);
    return timestamp === null ? null : Math.max(0, now - timestamp);
}

function renderRow(columns, ageLabel, width) {
    const prefix = `    ${columns.join('  ')}`;
    const targetWidth = Math.max(64, width);
    const available = Math.max(8, targetWidth - ageLabel.length - 2);
    const fitted = prefix.length > available
        ? `${prefix.slice(0, Math.max(1, available - 1)).trimEnd()}…`
        : prefix;
    return `${fitted}${' '.repeat(Math.max(2, targetWidth - fitted.length - ageLabel.length))}${ageLabel}`;
}

function renderWorker(worker, now, width) {
    const id = formatText(worker?.id, 'unknown-worker');
    const agent = formatText(worker?.agent, 'unknown-agent');
    const status = workerStatus(worker);
    const task = truncate(worker?.task);
    const error = status === 'failed' && worker?.error
        ? `error: ${truncate(worker.error, 48)}`
        : '';
    const age = workerAge(worker, now);
    const ageLabel = age === null ? 'unknown' : formatDuration(age);
    return renderRow([
        status.padEnd(11),
        id.padEnd(12),
        agent.padEnd(13),
        error || task,
    ], ageLabel, width);
}

function runDuration(run, now) {
    const startedAt = asFiniteNumber(run?.startedAt);
    const endedAt = asFiniteNumber(run?.finishedAt) ?? now;
    return startedAt === null ? null : Math.max(0, endedAt - startedAt);
}

function renderRun(run, now, width) {
    const id = formatText(run?.id, 'unknown-run');
    const status = formatText(run?.status, 'unknown');
    const workerCount = Array.isArray(run?.workerIds) ? `${run.workerIds.length} workers` : 'workers unknown';
    const duration = runDuration(run, now);
    const durationLabel = duration === null ? 'unknown' : formatDuration(duration);
    const error = status === 'failed' && run?.error
        ? `  ·  error: ${truncate(run.error, 72)}`
        : '';
    return renderRow([status.padEnd(11), id.padEnd(12), workerCount, error], durationLabel, width);
}

const WORKER_STATUS_ORDER = new Map([
    ['needs-input', 0],
    ['running', 1],
    ['failed', 2],
    ['completed', 3],
    ['unknown', 4],
]);

export function renderFleetView(fleet, fleetRuns, now = Date.now(), width = 100) {
    const workers = Array.isArray(fleet) ? fleet.filter(Boolean) : [];
    const runs = Array.isArray(fleetRuns) ? fleetRuns : [];
    const counts = { 'needs-input': 0, running: 0, completed: 0, failed: 0, unknown: 0 };
    workers.forEach((worker) => { counts[workerStatus(worker)] += 1; });
    const sortedWorkers = [...workers].sort((left, right) => {
        const stateDifference = WORKER_STATUS_ORDER.get(workerStatus(left)) - WORKER_STATUS_ORDER.get(workerStatus(right));
        if (stateDifference !== 0) return stateDifference;
        return (workerTimestamp(right) ?? 0) - (workerTimestamp(left) ?? 0);
    });
    const sortedRuns = [...runs].reverse();
    const lines = [
        'Fleet view',
        `  Agents: ${workers.length} total  ·  ${counts['needs-input']} needs input  ·  ${counts.running} running  ·  ${counts.completed} completed  ·  ${counts.failed} failed  ·  ${counts.unknown} unknown`,
    ];

    lines.push(sortedWorkers.length ? '  Agents:' : '  Agents: none');
    if (sortedWorkers.length) lines.push(renderRow(['STATE'.padEnd(11), 'ID'.padEnd(12), 'AGENT'.padEnd(13), 'TASK / FAILURE'], 'AGE', width));
    sortedWorkers.forEach((worker) => lines.push(renderWorker(worker, now, width)));

    lines.push(sortedRuns.length ? `  Runs (${sortedRuns.length}):` : '  Runs: none');
    sortedRuns.forEach((run) => lines.push(renderRun(run, now, width)));

    return lines.join('\n');
}
