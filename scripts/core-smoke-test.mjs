import fs from 'fs';

const BASE = process.env.SOUPZ_BASE_URL || 'http://localhost:7533';
const OUT_PATH = process.env.SOUPZ_OUT_PATH || '/Users/shubh/Developer/ai-testing/core-smoke-result.json';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const prompt =
    process.env.SOUPZ_SMOKE_PROMPT ||
    'Reply with exactly this token and nothing else: CORE_SMOKE_OK';

  const createRes = await fetch(`${BASE}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, agent: 'auto', modelPolicy: 'quick' }),
  });

  const created = await createRes.json();
  if (!createRes.ok) {
    throw new Error(`order_create_failed ${JSON.stringify(created)}`);
  }

  let detail = null;
  for (let i = 0; i < 40; i++) {
    await wait(1000);
    const detailRes = await fetch(`${BASE}/api/orders/${created.id}`);
    detail = await detailRes.json();
    if (detail.status === 'completed' || detail.status === 'failed') break;
  }

  const result = {
    testedAt: new Date().toISOString(),
    created,
    detail: detail
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
      : null,
  };

  fs.mkdirSync('/Users/shubh/Developer/ai-testing', { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(result, null, 2));

  console.log(`wrote ${OUT_PATH}`);
  console.log(`status=${result.detail?.status || 'unknown'} agent=${result.detail?.runAgent || 'unknown'}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
