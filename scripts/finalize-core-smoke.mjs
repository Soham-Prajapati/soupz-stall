import fs from 'fs';

const FILE_PATH = '/Users/shubh/Developer/ai-testing/core-smoke-result.json';
const BASE = 'http://localhost:7533';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const data = JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
  const id = data?.created?.id;
  if (!id) throw new Error('Missing created.id in smoke result file');

  let detail = null;
  for (let i = 0; i < 90; i++) {
    await wait(1000);
    const res = await fetch(`${BASE}/api/orders/${id}`);
    detail = await res.json();
    if (detail.status === 'completed' || detail.status === 'failed') break;
  }

  data.finalCheckedAt = new Date().toISOString();
  data.detail = detail
    ? {
        id: detail.id,
        status: detail.status,
        runAgent: detail.runAgent,
        exitCode: detail.exitCode,
        eventCount: detail.eventCount,
        stdoutPreview: (detail.stdout || '').slice(0, 1200),
        stderrPreview: (detail.stderr || '').slice(0, 800),
        events: Array.isArray(detail.events) ? detail.events.slice(-10) : [],
      }
    : null;

  fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2));
  console.log(`updated ${id} status=${data.detail?.status || 'unknown'} agent=${data.detail?.runAgent || 'unknown'}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
