const base = process.env.SOUPZ_BENCH_BASE || 'http://localhost:7533';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const prompt = [
  'Build an implementation-ready system blueprint for a multi-tenant real-time AI coding cloud IDE platform with local daemon + remote dashboard.',
  'Deliverables (must be concrete and deeply technical):',
  '1) Architecture: component boundaries, trust boundaries, scaling bottlenecks, failure domains.',
  '2) Data model: SQL tables with keys/indexes/constraints for users, devices, pairing, sessions, orders, events, billing usage, audit logs.',
  '3) API contract map: REST + WebSocket events with sample payloads, status/error codes, idempotency strategy.',
  '4) Pairing and auth hardening: OTP lifecycle, replay prevention, token rotation, tunnel-aware pairing fallback, abuse/rate-limit controls.',
  '5) Orchestration engine design: worker fan-out policy, cancellation semantics, watchdog/stall detection, synthesis strategy, deterministic summaries.',
  '6) Reliability: retries/backoff/circuit-breakers, degraded modes, SLOs, observability dashboards, alert rules, incident playbook.',
  '7) Security and compliance: threat model (STRIDE), secrets handling, encryption at rest/in transit, SOC2 controls, auditability.',
  '8) CI/CD + release: test matrix, canary strategy, rollback, migration safety, reproducible environments.',
  '9) Performance plan: load model, benchmark methodology, target p95/p99, profiling hotspots, optimization roadmap.',
  '10) Execution plan: 3 phased roadmap (48h, 2 weeks, 6 weeks) with acceptance criteria and risks.',
  'Output format: sections + tables + pseudo-code + explicit implementation checklist; no generic fluff.',
].join('\n');

const createRes = await fetch(`${base}/api/orders`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    prompt,
    agent: 'auto',
    modelPolicy: 'deep',
    orchestrationMode: 'parallel',
    cwd: '/Users/shubh/Developer/ai-testing',
    workerCount: 8,
    sameAgentOnly: false,
    primaryCopies: 3,
    timeoutMs: 180000,
  }),
});

const created = await createRes.json();
if (!createRes.ok) {
  console.error(JSON.stringify({ createFailed: created }, null, 2));
  process.exit(1);
}

const id = created.id;
const start = Date.now();
let detail = null;

for (let i = 0; i < 360; i += 1) {
  const r = await fetch(`${base}/api/orders/${id}`);
  detail = await r.json();
  if (['completed', 'failed', 'cancelled'].includes(detail.status)) break;
  await wait(1000);
}

const elapsedMs = Date.now() - start;
const summaryRes = await fetch(`${base}/api/orders/${id}/summary`);
const summary = summaryRes.ok ? await summaryRes.json() : null;
const events = Array.isArray(detail?.events) ? detail.events : [];

const workersStarted = events.filter((e) => e.type === 'worker.started').length;
const workersFinished = events.filter((e) => e.type === 'worker.finished').length;
const stalled = events.filter((e) => e.type === 'worker.stalled').length;
const route = events.find((e) => e.type === 'route.selected') || {};
const plan = events.find((e) => e.type === 'parallel.plan') || {};
const synthesisFinished = events.find((e) => e.type === 'synthesis.finished') || null;

const result = {
  id,
  status: detail?.status,
  elapsedMs,
  orderDurationMs: detail?.durationMs ?? null,
  workerCountPlanned: plan.workerCount || null,
  workersPlanned: Array.isArray(plan.workers) ? plan.workers.length : 0,
  workersStarted,
  workersFinished,
  stalledEvents: stalled,
  runAgent: detail?.runAgent,
  modelPolicy: detail?.modelPolicy,
  deepPolicy: route.deepPolicy || null,
  specialistsPlanned: route.specialistsPlanned || [],
  synthesis: {
    state: summary?.synthesis?.state || null,
    agent: summary?.synthesis?.agent || null,
    exitCode: summary?.synthesis?.exitCode ?? (synthesisFinished?.exitCode ?? null),
    durationMs: summary?.synthesis?.durationMs ?? null,
  },
  outputChars: {
    stdout: (detail?.stdout || '').length,
    stderr: (detail?.stderr || '').length,
  },
  preview: (detail?.stdout || '').replace(/\s+/g, ' ').slice(0, 1400),
};

console.log(JSON.stringify(result, null, 2));