import fs from 'fs';
import path from 'path';

const BASE = process.argv[2] || 'http://localhost:7070';
const OUT = process.env.SOUPZ_VALIDATE_OUT || '/Users/shubh/Developer/ai-testing/logic-todo-validation.json';
const ROOT = process.cwd();

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function jsonFetch(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  return { ok: res.ok, status: res.status, body };
}

async function createOrder(payload) {
  const { ok, status, body } = await jsonFetch(`${BASE}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!ok) {
    throw new Error(`create_order_failed status=${status} body=${JSON.stringify(body)}`);
  }
  return body;
}

async function pollOrder(id, timeoutMs = 600000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { ok, body } = await jsonFetch(`${BASE}/api/orders/${id}`);
    if (!ok) throw new Error(`poll_failed id=${id}`);
    if (['completed', 'failed', 'cancelled'].includes(body.status)) return body;
    await wait(1000);
  }
  throw new Error(`poll_timeout id=${id}`);
}

function getEvents(detail, type) {
  return (detail.events || []).filter((e) => e.type === type);
}

function includesCopilotStyleWorkerId(detail) {
  const workers = getEvents(detail, 'worker.started').map((w) => w.workerId || '');
  return workers.some((id) => /-[0-9]+$/.test(id));
}

async function runOneDeep({ prompt, agent = 'auto', workerCount = 4, sameAgentOnly = false, primaryCopies = 2, timeoutMs = 90000 }) {
  const created = await createOrder({
    prompt,
    agent,
    modelPolicy: 'deep',
    orchestrationMode: 'parallel',
    cwd: '/Users/shubh/Developer/ai-testing',
    workerCount,
    sameAgentOnly,
    primaryCopies,
    timeoutMs,
  });
  const detail = await pollOrder(created.id, Math.max(timeoutMs + 300000, 600000));
  return detail;
}

async function runValidation() {
  const report = {
    testedAt: new Date().toISOString(),
    base: BASE,
    checks: [],
    passCount: 0,
    failCount: 0,
    skipCount: 0,
    ids: [],
  };

  const push = (name, pass, info = {}, skipped = false) => {
    report.checks.push({ name, pass, skipped, ...info });
    if (skipped) report.skipCount += 1;
    else if (pass) report.passCount += 1;
    else report.failCount += 1;
  };

  const standardPrompt = [
    'Build a tiny but complete web deliverable with concrete file-level implementation detail.',
    'Return architecture, implementation, and QA notes in actionable detail.',
  ].join(' ');

  const deep1 = await runOneDeep({
    prompt: standardPrompt,
    agent: 'copilot',
    workerCount: 4,
    sameAgentOnly: true,
    primaryCopies: 4,
    timeoutMs: 90000,
  });
  report.ids.push(deep1.id);

  const workerStarted = getEvents(deep1, 'worker.started');
  const routeSelected = (deep1.events || []).find((e) => e.type === 'route.selected');

  push('deep_auto_worker_lanes', workerStarted.length >= 1 && includesCopilotStyleWorkerId(deep1), {
    workerStarted: workerStarted.length,
    workers: workerStarted.map((w) => w.workerId),
  });

  push('human_labels_renderable', workerStarted.every((w) => typeof w.workerLabel === 'string' && w.workerLabel.includes('·')), {
    labels: workerStarted.map((w) => w.workerLabel),
  });

  push('specialist_chips_route_selected', Array.isArray(routeSelected?.specialistsPlanned) && routeSelected.specialistsPlanned.length > 0, {
    specialistsPlanned: routeSelected?.specialistsPlanned || [],
  });

  const detailSummary = await jsonFetch(`${BASE}/api/orders/${deep1.id}/summary`);
  push('order_summary_endpoint', detailSummary.ok && detailSummary.body?.workers && detailSummary.body?.synthesis, {
    summaryStatus: detailSummary.status,
    workers: Object.keys(detailSummary.body?.workers || {}).length,
    synthesisState: detailSummary.body?.synthesis?.state,
  });

  const forcedFail = await runOneDeep({
    prompt: 'Produce a full implementation answer with detailed sections.',
    agent: 'copilot',
    workerCount: 2,
    sameAgentOnly: true,
    primaryCopies: 2,
    timeoutMs: 1000,
  });
  report.ids.push(forcedFail.id);

  const failedWorkers = getEvents(forcedFail, 'worker.finished').filter((e) => (e.exitCode ?? 1) !== 0);
  push('forced_worker_failure_state', failedWorkers.length >= 1, {
    failedWorkers: failedWorkers.map((w) => ({ workerId: w.workerId, exitCode: w.exitCode, reason: w.reason })),
  });

  const stderrContainsTagged = /\[worker:[^\]|]+\|agent:[^:\]]+:stderr\]/.test(forcedFail.stderr || '');
  push('stderr_lane_prefix_present', stderrContainsTagged, {
    stderrPreview: String(forcedFail.stderr || '').slice(0, 500),
  });

  const agents = await jsonFetch(`${BASE}/api/agents?detailed=true`);
  const ollamaReady = !!agents.body?.agents?.ollama?.ready;
  if (ollamaReady) {
    const ollamaFail = await runOneDeep({
      prompt: 'Generate a detailed implementation plan and code snippets.',
      agent: 'ollama',
      workerCount: 1,
      sameAgentOnly: true,
      primaryCopies: 1,
      timeoutMs: 1000,
    });
    report.ids.push(ollamaFail.id);
    const ollamaStderrTagged = /\[worker:[^\]|]+\|agent:ollama:stderr\]/.test(ollamaFail.stderr || '');
    push('ollama_stderr_lane_prefix_present', ollamaStderrTagged, {
      stderrPreview: String(ollamaFail.stderr || '').slice(0, 500),
    });
  } else {
    push('ollama_stderr_lane_prefix_present', false, { reason: 'ollama_not_ready' }, true);
  }

  const overlapA = await createOrder({
    prompt: 'Long-running deep task A with full architecture and implementation output.',
    agent: 'copilot',
    modelPolicy: 'deep',
    orchestrationMode: 'parallel',
    cwd: '/Users/shubh/Developer/ai-testing',
    workerCount: 2,
    sameAgentOnly: true,
    primaryCopies: 2,
    timeoutMs: 90000,
  });
  report.ids.push(overlapA.id);

  const overlapB = await createOrder({
    prompt: 'Overlap test task B with concrete implementation detail.',
    agent: 'copilot',
    modelPolicy: 'deep',
    orchestrationMode: 'parallel',
    cwd: '/Users/shubh/Developer/ai-testing',
    workerCount: 1,
    sameAgentOnly: true,
    primaryCopies: 1,
    timeoutMs: 120000,
  });
  report.ids.push(overlapB.id);

  const aCancel = await jsonFetch(`${BASE}/api/orders/${overlapA.id}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'validation_overlap_cancel' }),
  });
  const bDone = await pollOrder(overlapB.id, 600000);

  push('overlap_attempts_handled', aCancel.ok && ['running', 'cancelled'].includes(aCancel.body?.status) && ['completed', 'failed', 'cancelled'].includes(bDone.status), {
    cancelStatus: aCancel.body?.status,
    secondStatus: bDone.status,
  });

  // 10 consecutive runs for stability
  let consecutivePass = true;
  const consecutiveStatuses = [];
  for (let i = 0; i < 10; i++) {
    const d = await runOneDeep({
      prompt: `Consecutive run ${i + 1}: deliver architecture + implementation + QA checklist.`,
      agent: 'copilot',
      workerCount: 2,
      sameAgentOnly: true,
      primaryCopies: 2,
      timeoutMs: 90000,
    });
    report.ids.push(d.id);
    consecutiveStatuses.push({ id: d.id, status: d.status });
    if (!['completed', 'failed', 'cancelled'].includes(d.status)) {
      consecutivePass = false;
      break;
    }
  }

  push('ten_consecutive_deep_runs_terminal_state', consecutivePass && consecutiveStatuses.length === 10, {
    runs: consecutiveStatuses,
  });

  // Lightweight mixed-prompt soak (shorter than overnight, but validates state transitions and synthesis terminal events)
  const mixedPrompts = [
    'UI-heavy: provide concrete frontend architecture and implementation details.',
    'Infra-heavy: provide deployment pipeline and runtime hardening decisions.',
    'Analysis-heavy: provide benchmark and tradeoff analysis with concrete plan.',
    'UI-heavy again with accessibility edge cases.',
    'Infra-heavy with failure recovery and rollback strategy.',
    'Analysis-heavy with risk matrix and validation steps.',
  ];
  const soakResults = [];
  for (const p of mixedPrompts) {
    const d = await runOneDeep({
      prompt: p,
      agent: 'auto',
      workerCount: 3,
      sameAgentOnly: false,
      primaryCopies: 2,
      timeoutMs: 90000,
    });
    report.ids.push(d.id);
    const events = d.events || [];
    const started = getEvents(d, 'worker.started').length;
    const finished = getEvents(d, 'worker.finished').length;
    const synthDone = events.some((e) => e.type === 'synthesis.finished');
    soakResults.push({ id: d.id, status: d.status, started, finished, synthDone });
  }

  const soakPass = soakResults.every((r) => ['completed', 'failed', 'cancelled'].includes(r.status) && r.finished >= 1 && r.synthDone);
  push('mixed_prompt_soak_state_consistency', soakPass, { soakResults });

  // Static check for Core run button lock policy
  const corePath = path.join(ROOT, 'packages/dashboard/src/components/core/CoreConsole.jsx');
  const coreText = fs.readFileSync(corePath, 'utf8');
  const hasOrderActiveGate = coreText.includes("orderStatus === 'queued' || orderStatus === 'running'") && coreText.includes('!orderActive');
  push('run_button_block_logic_present', hasOrderActiveGate, {});

  // Repo root artifact check
  const files = fs.readdirSync(ROOT);
  const noOrderJsonAtRoot = files.every((f) => !/^ord_.*\.json$/i.test(f));
  push('no_temp_order_artifacts_in_repo_root', noOrderJsonAtRoot, {
    suspicious: files.filter((f) => /^ord_.*\.json$/i.test(f)),
  });

  report.ok = report.failCount === 0;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(`wrote ${OUT}`);
  console.log(`pass=${report.passCount} fail=${report.failCount} skip=${report.skipCount}`);
  if (!report.ok) process.exitCode = 1;
}

runValidation().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
