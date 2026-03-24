const fs = require('fs');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const prompt = [
    'Design an implementation-ready architecture for a multi-tenant realtime collaboration platform.',
    'Deliver: (1) service boundaries, (2) data model, (3) API endpoint map, (4) queue and event flow, (5) observability plan, (6) reliability checklist, (7) rollout phases, (8) concrete milestones.',
    'Be specific and implementation-ready, not generic.'
  ].join(' ');

  const create = await fetch('http://localhost:7533/api/orders', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt,
      agent: 'auto',
      modelPolicy: 'deep',
      orchestrationMode: 'parallel',
      cwd: '/Users/shubh/Developer/ai-testing',
      workerCount: 4,
      primaryCopies: 2,
      sameAgentOnly: false,
      timeoutMs: 45000
    })
  });

  const created = await create.json();
  if (!create.ok) {
    console.error(JSON.stringify({ createFailed: created }, null, 2));
    process.exit(1);
  }

  const id = created.id;
  let detail = null;
  for (let i = 0; i < 360; i++) {
    await wait(1000);
    const r = await fetch(`http://localhost:7533/api/orders/${id}`);
    detail = await r.json();
    if (['completed', 'failed', 'cancelled'].includes(detail.status)) break;
  }

  const events = Array.isArray(detail && detail.events) ? detail.events : [];
  const route = events.find((e) => e.type === 'route.selected') || {};
  const plan = events.find((e) => e.type === 'parallel.plan') || {};

  const summaryRes = await fetch(`http://localhost:7533/api/orders/${id}/summary`);
  const summary = summaryRes.ok ? await summaryRes.json() : null;

  const result = {
    id,
    status: detail && detail.status,
    eventCount: detail && detail.eventCount,
    runAgent: detail && detail.runAgent,
    workersStarted: events.filter((e) => e.type === 'worker.started').length,
    workersFinished: events.filter((e) => e.type === 'worker.finished').length,
    synthesisStarted: events.some((e) => e.type === 'synthesis.started'),
    synthesisFinished: events.some((e) => e.type === 'synthesis.finished'),
    specialistsPlanned: route.specialistsPlanned || [],
    workerIds: plan.workers || [],
    stdoutChars: (detail && detail.stdout ? detail.stdout : '').length,
    stderrChars: (detail && detail.stderr ? detail.stderr : '').length,
    summaryOk: !!summary,
    summarySynthesisState: summary && summary.synthesis ? summary.synthesis.state : null,
    outputPreview: (detail && detail.stdout ? detail.stdout : '').replace(/\s+/g, ' ').slice(0, 1200)
  };

  fs.writeFileSync('/Users/shubh/Developer/ai-testing/complex-eval-latest.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
})();
