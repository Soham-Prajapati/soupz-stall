#!/usr/bin/env node

import { spawn, spawnSync } from 'child_process';
import { setTimeout as wait } from 'timers/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env so SOUPZ_REMOTE_PORT and other vars are available
config({ path: join(__dirname, '..', '.env') });

const REMOTE_PORT = process.env.SOUPZ_REMOTE_PORT || '7533';
const BACKEND_URL = `http://localhost:${REMOTE_PORT}`;
const DASHBOARD_REMOTE_URL = (process.env.SOUPZ_REMOTE_URL || BACKEND_URL).trim();
const DASHBOARD_PORT = process.env.SOUPZ_DASHBOARD_PORT || '5173';
const REPO_ROOT = join(__dirname, '..');
const DASHBOARD_DIR = join(REPO_ROOT, 'packages/dashboard');
const REMOTE_ENTRY = join(REPO_ROOT, 'packages/remote-server/src/index.js');
const ENABLE_FREE_TUNNELS = (process.env.SOUPZ_ENABLE_FREE_TUNNELS || '').trim() === '1';
const TUNNEL_TIMEOUT_MS = 30000;

function hasCmd(cmd) {
  const out = spawnSync('sh', ['-lc', `command -v ${cmd}`], { stdio: 'ignore' });
  return out.status === 0;
}

function preferredPm() {
  if (process.env.SOUPZ_PM) return process.env.SOUPZ_PM;
  return hasCmd('pnpm') ? 'pnpm' : 'npm';
}

const PM = preferredPm();

let backendProc = null;
let dashboardProc = null;
let daemonTunnelProc = null;
let webTunnelProc = null;
let isShuttingDown = false;

function log(msg) {
  process.stdout.write(`${msg}\n`);
}

function prefixedPipe(proc, prefix) {
  proc.stdout.on('data', (buf) => {
    const text = buf.toString();
    for (const line of text.split('\n')) {
      if (line.trim()) log(`${prefix} ${line}`);
    }
  });
  proc.stderr.on('data', (buf) => {
    const text = buf.toString();
    for (const line of text.split('\n')) {
      if (line.trim()) log(`${prefix} ${line}`);
    }
  });
}

async function waitForHealth(timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BACKEND_URL}/health`);
      if (res.ok) return true;
    } catch {
      // ignore until server is up
    }
    await wait(400);
  }
  return false;
}

async function createToken() {
  const attempts = 4;
  let lastError = null;

  for (let i = 0; i < attempts; i += 1) {
    try {
      const pairRes = await fetch(`${BACKEND_URL}/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!pairRes.ok) throw new Error(`Failed to create pairing code (${pairRes.status})`);
      const pairJson = await pairRes.json();
      const code = pairJson.code;
      if (!code) throw new Error('Pairing code missing in /pair response');

      const endpoints = ['/pair/validate', '/api/pair'];
      for (const endpoint of endpoints) {
        const validateRes = await fetch(`${BACKEND_URL}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        if (!validateRes.ok) {
          lastError = new Error(`Failed to validate pairing code (${validateRes.status}) via ${endpoint}`);
          continue;
        }
        const validateJson = await validateRes.json();
        if (validateJson?.token) return validateJson.token;
        lastError = new Error(`Token missing in ${endpoint} response`);
      }
    } catch (err) {
      lastError = err;
    }

    await wait(120 + (i * 80));
  }

  throw lastError || new Error('Failed to obtain pairing token');
}

function extractTryCloudflareUrl(line) {
  const match = line.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
  return match ? match[0] : null;
}

function waitForTryCloudflareUrl(proc, prefix, timeoutMs = TUNNEL_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`${prefix} tunnel URL not received within ${timeoutMs}ms`));
    }, timeoutMs);

    const onData = (buf) => {
      const text = buf.toString();
      for (const line of text.split('\n')) {
        if (line.trim()) log(`${prefix} ${line}`);
        const url = extractTryCloudflareUrl(line);
        if (url) {
          cleanup();
          resolve(url);
          return;
        }
      }
    };

    const onExit = (code) => {
      cleanup();
      reject(new Error(`${prefix} exited before URL was available (${code ?? 'null'})`));
    };

    function cleanup() {
      clearTimeout(timer);
      proc.stdout.off('data', onData);
      proc.stderr.off('data', onData);
      proc.off('exit', onExit);
    }

    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
    proc.on('exit', onExit);
  });
}

async function updatePairingRuntimeConfig({ webappUrl, tunnelUrls }) {
  const res = await fetch(`${BACKEND_URL}/api/system/pairing-config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ webappUrl, tunnelUrls }),
  });
  if (!res.ok) throw new Error(`Failed to update pairing runtime config (${res.status})`);
  return res.json();
}

async function startFreeTunnels(webPort) {
  if (!hasCmd('cloudflared')) {
    log('cloudflared not found; skipping free tunnel setup. Install via: brew install cloudflared');
    return null;
  }

  log('Starting free cloudflared tunnels (daemon + web)...');

  daemonTunnelProc = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${REMOTE_PORT}`], {
    cwd: REPO_ROOT,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  webTunnelProc = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${webPort}`], {
    cwd: REPO_ROOT,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const [daemonTunnelUrl, webTunnelUrl] = await Promise.all([
    waitForTryCloudflareUrl(daemonTunnelProc, '[tunnel:daemon]'),
    waitForTryCloudflareUrl(webTunnelProc, '[tunnel:web]'),
  ]);

  await updatePairingRuntimeConfig({
    webappUrl: webTunnelUrl,
    tunnelUrls: [daemonTunnelUrl],
  });

  log('');
  log('Free tunnel endpoints:');
  log(`Daemon tunnel: ${daemonTunnelUrl}`);
  log(`Web tunnel:    ${webTunnelUrl}`);
  log('');
  log('Phone testing URL (fresh local build):');
  log(`${webTunnelUrl}/connect`);
  log('');

  return { daemonTunnelUrl, webTunnelUrl };
}

async function startBackend() {
  log('Starting backend...');
  backendProc = spawn(process.execPath, [REMOTE_ENTRY], {
    cwd: REPO_ROOT,
    env: { ...process.env, SOUPZ_REMOTE_PORT: REMOTE_PORT },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  prefixedPipe(backendProc, '[backend]');

  backendProc.on('exit', (code) => {
    if (!isShuttingDown) {
      log(`[backend] exited (${code ?? 'null'})`);
    }
  });

  const healthy = await waitForHealth();
  if (!healthy) throw new Error(`Backend did not become healthy at ${BACKEND_URL}`);
  log(`Backend is healthy at ${BACKEND_URL}`);
}

function startDashboard(token) {
  return new Promise((resolve, reject) => {
    log(`Starting dashboard with ${PM}...`);

    const devArgs = PM === 'pnpm'
      ? ['run', 'dev', '--host', '0.0.0.0', '--port', `${DASHBOARD_PORT}`]
      : ['run', 'dev', '--', '--host', '0.0.0.0', '--port', `${DASHBOARD_PORT}`];

    dashboardProc = spawn(PM, devArgs, {
      cwd: DASHBOARD_DIR,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const onLine = (line) => {
      const localMatch = line.match(/(http:\/\/127\.0\.0\.1:\d+)/i) || line.match(/(http:\/\/localhost:\d+)/i);
      if (localMatch) {
        const base = localMatch[1].replace('127.0.0.1', 'localhost');
        const params = new URLSearchParams({ remote: DASHBOARD_REMOTE_URL });
        if (token) params.set('token', token);
        const finalUrl = `${base}/?${params.toString()}`;
        log('');
        log('Ready. Open this URL:');
        log(finalUrl);
        log('');
        log('Tip: Save as bookmark named "Soupz Web".');

        if (process.platform === 'darwin') {
          const opener = spawn('open', [finalUrl], { stdio: 'ignore' });
          opener.on('error', () => {});
        }
        resolve(finalUrl);
      }
    };

    dashboardProc.stdout.on('data', (buf) => {
      const text = buf.toString();
      for (const line of text.split('\n')) {
        if (line.trim()) {
          log(`[dashboard] ${line}`);
          onLine(line);
        }
      }
    });

    dashboardProc.stderr.on('data', (buf) => {
      const text = buf.toString();
      for (const line of text.split('\n')) {
        if (line.trim()) log(`[dashboard] ${line}`);
      }
    });

    dashboardProc.on('exit', (code) => {
      if (!isShuttingDown) {
        reject(new Error(`Dashboard exited (${code ?? 'null'})`));
      }
    });
  });
}

async function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  log('\nShutting down...');

  if (dashboardProc && dashboardProc.exitCode === null) {
    dashboardProc.kill('SIGTERM');
  }
  if (backendProc && backendProc.exitCode === null) {
    backendProc.kill('SIGTERM');
  }
  if (daemonTunnelProc && daemonTunnelProc.exitCode === null) {
    daemonTunnelProc.kill('SIGTERM');
  }
  if (webTunnelProc && webTunnelProc.exitCode === null) {
    webTunnelProc.kill('SIGTERM');
  }

  await wait(250);
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

(async function main() {
  try {
    await startBackend();
    let token = null;
    try {
      token = await createToken();
    } catch (err) {
      log(`Warning: pairing bootstrap failed (${err.message}). Continuing in local no-token mode.`);
    }
    const localDashboardUrl = await startDashboard(token);
    if (ENABLE_FREE_TUNNELS) {
      let webPort = DASHBOARD_PORT;
      try {
        webPort = String(new URL(localDashboardUrl).port || DASHBOARD_PORT);
      } catch {
        // Keep configured fallback port.
      }
      await startFreeTunnels(webPort);
    } else {
      log('Free tunnel setup disabled. Set SOUPZ_ENABLE_FREE_TUNNELS=1 to auto-start cloudflared.');
    }
    log('Dev stack running. Press Ctrl+C to stop both backend and dashboard.');
  } catch (err) {
    log(`Fatal: ${err.message}`);
    await shutdown();
  }
})();
