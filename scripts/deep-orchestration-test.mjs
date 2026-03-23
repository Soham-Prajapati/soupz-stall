import fs from 'fs';

const BASE = process.argv[2] || process.env.SOUPZ_BASE_URL || 'http://localhost:7533';
const OUT = process.env.SOUPZ_OUT_PATH || '/Users/shubh/Developer/ai-testing/deep-orchestration-result.json';
const MAX_POLLS = Number.parseInt(process.env.SOUPZ_MAX_POLLS || '180', 10);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const prompt = [
    'Create a tiny web app in /Users/shubh/Developer/ai-testing/deep-demo with files index.html, style.css, app.js, and README.md.',
    'The app should be a note board with add/delete/filter and localStorage persistence.',
    'Return concrete code and file plan.',
  ].join(' ');

  const createRes = await fetch(`${BASE}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      agent: 'auto',
      modelPolicy: 'deep',
      orchestrationMode: 'parallel',
      cwd: '/Users/shubh/Developer/ai-testing',
    }),
  });

  const created = await createRes.json();
  if (!createRes.ok) throw new Error(`create_failed ${JSON.stringify(created)}`);

  console.log(`created order ${created.id} on ${BASE}`);

  let detail = null;
  for (let i = 0; i < MAX_POLLS; i++) {
    await wait(1000);
    const r = await fetch(`${BASE}/api/orders/${created.id}`);
    detail = await r.json();
    if (i % 10 === 0) {
      const eventCount = detail?.eventCount ?? 0;
      const status = detail?.status || 'unknown';
      console.log(`poll ${i + 1}/${MAX_POLLS} status=${status} events=${eventCount}`);
    }
    if (detail.status === 'completed' || detail.status === 'failed') break;
  }

  const events = Array.isArray(detail?.events) ? detail.events : [];
  const summary = {
    testedAt: new Date().toISOString(),
    id: created.id,
    status: detail?.status,
    runAgent: detail?.runAgent,
    eventCount: detail?.eventCount,
    workerStarted: events.filter((e) => e.type === 'worker.started').length,
    workerFinished: events.filter((e) => e.type === 'worker.finished').length,
    synthesisStarted: events.some((e) => e.type === 'synthesis.started'),
    synthesisFinished: events.some((e) => e.type === 'synthesis.finished'),
    completed: events.some((e) => e.type === 'order.completed'),
    failed: events.some((e) => e.type === 'order.failed'),
    routeSelected: events.find((e) => e.type === 'route.selected') || null,
    parallelPlan: events.find((e) => e.type === 'parallel.plan') || null,
    stdoutPreview: (detail?.stdout || '').slice(0, 1500),
    stderrPreview: (detail?.stderr || '').slice(0, 1200),
    tailEvents: events.slice(-20),
  };

  fs.mkdirSync('/Users/shubh/Developer/ai-testing', { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(summary, null, 2));
  console.log(`wrote ${OUT}`);
  console.log(`status=${summary.status} workers=${summary.workerStarted}/${summary.workerFinished} synthesis=${summary.synthesisStarted}/${summary.synthesisFinished}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
