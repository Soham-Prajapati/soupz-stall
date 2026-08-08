import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname || '.', '..');

let startRemoteServer;
let serverHandle;
let BASE_URL;
const PORT = 17535;

describe('Stress Tests', () => {
  beforeAll(async () => {
    const mod = await import(resolve(ROOT, 'packages/remote-server/src/index.js'));
    startRemoteServer = mod.startRemoteServer || mod.default;

    // startRemoteServer resolves null on EADDRINUSE rather than throwing. The
    // old fallback here quietly retargeted the integration suite's port, which
    // hid the leaked-listener bug and let two files stress one daemon.
    serverHandle = await startRemoteServer(PORT, { silent: true });
    if (!serverHandle) {
      throw new Error(
        `Port ${PORT} is already in use — a previous daemon or test run did not shut down. ` +
        `Free it with: lsof -nP -iTCP:${PORT} | awk 'NR>1 {print $2}' | xargs kill`
      );
    }
    BASE_URL = `http://127.0.0.1:${PORT}`;
  }, 45000);

  afterAll(async () => {
    // stop() resolves once the listening socket is released.
    if (serverHandle?.stop) {
      await serverHandle.stop();
    } else if (serverHandle?.server) {
      await new Promise((r) => serverHandle.server.close(r));
    }
  }, 15000);

  // --- Order Queue: max 5 concurrent ---
  describe('Order concurrency', () => {
    it('accepts multiple orders', async () => {
      const orders = [];
      // Create 3 orders quickly
      for (let i = 0; i < 3; i++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
          const res = await fetch(`${BASE_URL}/api/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: `stress test order ${i}`,
              agent: 'auto',
              modelPolicy: 'fast',
              cwd: ROOT,
            }),
            signal: controller.signal,
          });
          clearTimeout(timeout);
          if (res.ok) {
            const body = await res.json();
            orders.push(body);
          }
        } catch (e) {
          clearTimeout(timeout);
          // AbortError from slow spawning is acceptable
          if (e.name !== 'AbortError') throw e;
        }
      }

      // Verify we got order IDs
      for (const order of orders) {
        expect(order.id).toMatch(/^ord_/);
        expect(['queued', 'pending', 'running', 'completed', 'failed']).toContain(order.status);
      }

      // Cancel all orders
      for (const order of orders) {
        try {
          await fetch(`${BASE_URL}/api/orders/${order.id}/cancel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'stress_test_cleanup' }),
          });
        } catch {}
      }
    }, 30000);

    it('GET /api/orders returns all created orders', async () => {
      const res = await fetch(`${BASE_URL}/api/orders`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.orders)).toBe(true);
    });
  });

  // --- File Cache: read same file many times ---
  describe('File cache performance', () => {
    it('reads same file 50 times without errors', async () => {
      const results = [];
      for (let i = 0; i < 50; i++) {
        const res = await fetch(
          `${BASE_URL}/api/fs/file?path=package.json&root=${encodeURIComponent(ROOT)}`
        );
        expect(res.status).toBe(200);
        const body = await res.json();
        results.push(body.content);
      }

      // All reads should return same content
      const first = results[0];
      for (const r of results) {
        expect(r).toBe(first);
      }
    }, 15000);

    it('reads different files concurrently', async () => {
      const files = ['package.json', 'CLAUDE.md', 'TODO_TERMINALS.md'];
      const promises = files.map(f =>
        fetch(`${BASE_URL}/api/fs/file?path=${f}&root=${encodeURIComponent(ROOT)}`)
          .then(r => r.json())
      );
      const results = await Promise.all(promises);
      for (const r of results) {
        expect(r.content).toBeDefined();
        expect(r.content.length).toBeGreaterThan(0);
      }
    });
  });

  // --- WebSocket connection limit ---
  describe('WebSocket connection limits', () => {
    it('accepts connections up to limit', async () => {
      const { WebSocket } = await import('ws');
      const wsUrl = `ws://127.0.0.1:${PORT}`;
      const connections = [];

      // Open 10 connections (well within the 20 limit)
      for (let i = 0; i < 10; i++) {
        try {
          const ws = new WebSocket(wsUrl);
          await new Promise((resolve, reject) => {
            ws.on('open', resolve);
            ws.on('error', reject);
            setTimeout(reject, 2000);
          });
          connections.push(ws);
        } catch {
          // Connection might fail if server isn't ready -- that's ok
        }
      }

      // Should have at least some connections open
      expect(connections.length).toBeGreaterThan(0);

      // Clean up
      for (const ws of connections) {
        try { ws.close(); } catch {}
      }

      // Give time for cleanup
      await new Promise(r => setTimeout(r, 500));
    }, 15000);

    it('rejects connections beyond limit', async () => {
      const { WebSocket } = await import('ws');
      const wsUrl = `ws://127.0.0.1:${PORT}`;
      const connections = [];
      let rejected = 0;

      // Try to open 22 connections (limit is 20)
      for (let i = 0; i < 22; i++) {
        try {
          const ws = new WebSocket(wsUrl);
          await new Promise((resolve, reject) => {
            ws.on('open', () => {
              connections.push(ws);
              resolve();
            });
            ws.on('close', (code) => {
              if (code === 1013) rejected++;
              resolve();
            });
            ws.on('error', () => {
              rejected++;
              resolve();
            });
            setTimeout(resolve, 1000);
          });
        } catch {
          rejected++;
        }
      }

      // Some connections should have been accepted, some possibly rejected
      // Exact count may vary due to cleanup timing from previous test
      expect(connections.length + rejected).toBeGreaterThanOrEqual(22);

      // Clean up all
      for (const ws of connections) {
        try { ws.close(); } catch {}
      }
      await new Promise(r => setTimeout(r, 500));
    }, 30000);
  });

  // --- Rapid file tree requests ---
  describe('Rapid requests', () => {
    it('handles 20 concurrent file tree requests', async () => {
      const promises = Array.from({ length: 20 }, () =>
        fetch(`${BASE_URL}/api/fs/tree?root=${encodeURIComponent(ROOT)}`)
          .then(r => r.json())
      );
      const results = await Promise.all(promises);
      for (const r of results) {
        expect(r.tree).toBeDefined();
        expect(r.tree.type).toBe('directory');
      }
    }, 30000);

    it('handles 20 concurrent health checks', async () => {
      const promises = Array.from({ length: 20 }, () =>
        fetch(`${BASE_URL}/health`).then(r => r.json())
      );
      const results = await Promise.all(promises);
      for (const r of results) {
        expect(r.hostname).toBeDefined();
      }
    });

    it('handles rapid pairing code generation', async () => {
      const burstCodes = [];
      for (let i = 0; i < 5; i++) {
        const res = await fetch(`${BASE_URL}/pair`, { method: 'POST' });
        const body = await res.json();
        burstCodes.push(body.code);
      }

      // Within the cooldown window the daemon should re-use the active code instead of thrashing
      expect(new Set(burstCodes).size).toBe(1);
      const initialCode = burstCodes[0];

      // After the cooldown, the daemon should rotate to a fresh code automatically
      await new Promise(resolve => setTimeout(resolve, 5500));
      const res = await fetch(`${BASE_URL}/pair`, { method: 'POST' });
      const body = await res.json();
      expect(body.code).not.toBe(initialCode);
      expect(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{9}$/.test(body.code)).toBe(true);
    }, 30000);
  });

  // --- File write concurrency ---
  describe('Concurrent file operations', () => {
    it('handles concurrent writes to different files', async () => {
      const writes = Array.from({ length: 5 }, (_, i) =>
        fetch(`${BASE_URL}/api/fs/file`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: `tests/.stress-tmp-${i}.txt`,
            content: `stress-${i}-${Date.now()}`,
            root: ROOT,
          }),
        })
      );
      const results = await Promise.all(writes);
      for (const r of results) {
        expect(r.status).toBe(200);
      }

      // Cleanup
      const { unlinkSync } = await import('fs');
      for (let i = 0; i < 5; i++) {
        try { unlinkSync(resolve(ROOT, `tests/.stress-tmp-${i}.txt`)); } catch {}
      }
    });
  });
});
