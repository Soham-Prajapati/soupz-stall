import fs from 'fs';

const FILE = '/Users/shubh/Developer/ai-testing/deep-orchestration-result.json';
const BASE = process.argv[2] || 'http://localhost:7533';
const MAX_POLLS = Number.parseInt(process.env.SOUPZ_MAX_POLLS || '300', 10);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const current = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const id = current.id;
  if (!id) throw new Error('Missing order id');

  let detail = null;
  console.log(`finalizing order ${id} on ${BASE}`);

  for (let i = 0; i < MAX_POLLS; i++) {
    await wait(1000);
    const r = await fetch(`${BASE}/api/orders/${id}`);
    detail = await r.json();
    if (i % 10 === 0) {
      const eventCount = detail?.eventCount ?? 0;
      const status = detail?.status || 'unknown';
      console.log(`poll ${i + 1}/${MAX_POLLS} status=${status} events=${eventCount}`);
    }
    if (detail.status === 'completed' || detail.status === 'failed') break;
  }

  const events = Array.isArray(detail?.events) ? detail.events : [];
  current.finalCheckedAt = new Date().toISOString();
  current.status = detail?.status;
  current.eventCount = detail?.eventCount;
  current.workerStarted = events.filter((e) => e.type === 'worker.started').length;
  current.workerFinished = events.filter((e) => e.type === 'worker.finished').length;
  current.synthesisStarted = events.some((e) => e.type === 'synthesis.started');
  current.synthesisFinished = events.some((e) => e.type === 'synthesis.finished');
  current.completed = events.some((e) => e.type === 'order.completed');
  current.failed = events.some((e) => e.type === 'order.failed');
  current.routeSelected = events.find((e) => e.type === 'route.selected') || null;
  current.parallelPlan = events.find((e) => e.type === 'parallel.plan') || null;
  current.stdoutPreview = (detail?.stdout || '').slice(0, 1500);
  current.stderrPreview = (detail?.stderr || '').slice(0, 1200);
  current.tailEvents = events.slice(-25);

  fs.writeFileSync(FILE, JSON.stringify(current, null, 2));
  console.log(`updated ${id} status=${current.status} workers=${current.workerStarted}/${current.workerFinished} synthesis=${current.synthesisStarted}/${current.synthesisFinished}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
