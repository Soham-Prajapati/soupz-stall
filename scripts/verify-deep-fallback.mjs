const base = process.env.SOUPZ_BENCH_BASE || 'http://localhost:7533';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const create = await fetch(`${base}/api/orders`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    prompt: 'Deep fallback test: give architecture + schema + API plan in detailed markdown.',
    agent: 'auto',
    modelPolicy: 'deep',
    orchestrationMode: 'parallel',
    cwd: '/Users/shubh/Developer/ai-testing',
    workerCount: 3,
    primaryCopies: 2,
    sameAgentOnly: false,
    timeoutMs: 90000,
  }),
});

const c = await create.json();
if (!create.ok) {
  console.error(JSON.stringify(c, null, 2));
  process.exit(1);
}

const id = c.id;
let detail = null;

for (let i = 0; i < 180; i += 1) {
  const r = await fetch(`${base}/api/orders/${id}`);
  detail = await r.json();
  if (['completed', 'failed', 'cancelled'].includes(detail.status)) break;
  await wait(1000);
}

const summaryRes = await fetch(`${base}/api/orders/${id}/summary`);
const summary = summaryRes.ok ? await summaryRes.json() : null;
const events = Array.isArray(detail?.events) ? detail.events : [];
const fallbackUsed = events.some((e) => e.type === 'synthesis.fallback.used');

console.log(JSON.stringify({
  id,
  status: detail?.status,
  exitCode: detail?.exitCode,
  eventCount: detail?.eventCount,
  fallbackUsed,
  synthesisState: summary?.synthesis?.state || null,
  stdoutChars: (detail?.stdout || '').length,
  stderrChars: (detail?.stderr || '').length,
}, null, 2));