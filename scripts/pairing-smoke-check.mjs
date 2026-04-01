#!/usr/bin/env node

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const PORT = Number.parseInt(process.env.SOUPZ_PAIR_SMOKE_PORT || '17633', 10);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const mod = await import(resolve(ROOT, 'packages/remote-server/src/index.js'));
  const startRemoteServer = mod.startRemoteServer || mod.default;
  const handle = await startRemoteServer(PORT, { silent: true });
  const baseUrl = `http://127.0.0.1:${PORT}`;

  try {
    const pairRes = await fetch(`${baseUrl}/pair`, { method: 'POST' });
    assert(pairRes.ok, `POST /pair failed (${pairRes.status})`);
    const pair = await pairRes.json();

    assert(typeof pair.code === 'string' && pair.code.length === 9, 'Pairing code must be 9 characters.');
    assert(typeof pair.connectUrl === 'string' && pair.connectUrl.includes('/code?code='), 'connectUrl must use hosted /code route.');

    const currentRes = await fetch(`${baseUrl}/pair/current`);
    assert(currentRes.ok, `GET /pair/current failed (${currentRes.status})`);
    const current = await currentRes.json();
    assert(typeof current.connectUrl === 'string' && current.connectUrl.includes('/code?code='), '/pair/current connectUrl must use /code route.');

    const validateRes = await fetch(`${baseUrl}/pair/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: pair.code }),
    });
    assert(validateRes.ok, `POST /pair/validate failed (${validateRes.status})`);
    const validated = await validateRes.json();
    assert(typeof validated.token === 'string' && validated.token.length >= 32, 'validate endpoint must return a session token.');

    const orderRes = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validated.token}`,
      },
      body: JSON.stringify({
        prompt: 'pairing smoke check',
        agent: 'auto',
        orchestrationMode: 'single',
        cwd: ROOT,
      }),
    });
    assert(orderRes.ok, `POST /api/orders failed (${orderRes.status})`);
    const order = await orderRes.json();
    assert(typeof order.id === 'string' && order.id.startsWith('ord_'), 'Order creation must return ord_* id.');

    await fetch(`${baseUrl}/api/orders/${order.id}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validated.token}`,
      },
      body: JSON.stringify({ reason: 'pairing_smoke_cleanup' }),
    }).catch(() => {});

    process.stdout.write('Pairing smoke check passed: /pair -> /pair/current -> /pair/validate -> /api/orders\n');
  } finally {
    if (handle?.stop) await handle.stop();
    else if (handle?.server) await new Promise((resolveClose) => handle.server.close(resolveClose));
  }
}

main().catch((err) => {
  process.stderr.write(`Pairing smoke check failed: ${err.message}\n`);
  process.exit(1);
});
