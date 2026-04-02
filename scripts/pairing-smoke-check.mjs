#!/usr/bin/env node

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const PORT = Number.parseInt(process.env.SOUPZ_PAIR_SMOKE_PORT || '17633', 10);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function stopHandleWithTimeout(handle, timeoutMs = 5000) {
  const stopPromise = (async () => {
    if (handle?.stop) {
      await handle.stop();
      return;
    }
    if (handle?.server) {
      await new Promise((resolveClose) => handle.server.close(resolveClose));
    }
  })();

  await Promise.race([
    stopPromise,
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

async function assertWsAuth(baseUrl, token) {
  const wsUrl = baseUrl.replace(/^http/i, 'ws');
  await new Promise((resolveWs, rejectWs) => {
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      try { ws.close(); } catch {}
      rejectWs(new Error('WebSocket auth timed out'));
    }, 5000);

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'auth', token, clientType: 'smoke-test' }));
    });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'auth_success') {
          clearTimeout(timeout);
          ws.close();
          resolveWs();
        }
        if (msg.type === 'auth_failed') {
          clearTimeout(timeout);
          ws.close();
          rejectWs(new Error(msg.message || 'WebSocket auth failed'));
        }
      } catch {
        // Ignore parse errors from non-JSON frames.
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      rejectWs(new Error(err?.message || 'WebSocket error'));
    });
  });
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

    await assertWsAuth(baseUrl, validated.token);

    const orderRes = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Soupz-Token': validated.token,
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
        'X-Soupz-Token': validated.token,
      },
      body: JSON.stringify({ reason: 'pairing_smoke_cleanup' }),
    }).catch(() => {});

    process.stdout.write('Pairing smoke check passed: /pair -> /pair/current -> /pair/validate -> WS auth -> /api/orders\n');
  } finally {
    await stopHandleWithTimeout(handle);
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    process.stderr.write(`Pairing smoke check failed: ${err.message}\n`);
    process.exit(1);
  });
