#!/usr/bin/env node

import { spawn, spawnSync } from 'child_process';
import { setTimeout as wait } from 'timers/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const REMOTE_PORT = process.env.SOUPZ_REMOTE_PORT || '7533';
const REMOTE_URL = process.env.SOUPZ_REMOTE_URL || `http://localhost:${REMOTE_PORT}`;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, '..');
const DASHBOARD_DIR = join(REPO_ROOT, 'packages/dashboard');
const REMOTE_ENTRY = join(REPO_ROOT, 'packages/remote-server/src/index.js');

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
      const res = await fetch(`${REMOTE_URL}/health`);
      if (res.ok) return true;
    } catch {
      // ignore until server is up
    }
    await wait(400);
  }
  return false;
}

async function createToken() {
  const pairRes = await fetch(`${REMOTE_URL}/pair`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!pairRes.ok) throw new Error(`Failed to create pairing code (${pairRes.status})`);
  const pairJson = await pairRes.json();

  const code = pairJson.code;
  if (!code) throw new Error('Pairing code missing in /pair response');

  const validateRes = await fetch(`${REMOTE_URL}/pair/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  if (!validateRes.ok) throw new Error(`Failed to validate pairing code (${validateRes.status})`);
  const validateJson = await validateRes.json();

  if (!validateJson.token) throw new Error('Token missing in /pair/validate response');
  return validateJson.token;
}

async function startBackend() {
  log('Starting backend...');
  backendProc = spawn(process.execPath, [REMOTE_ENTRY], {
    cwd: REPO_ROOT,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  prefixedPipe(backendProc, '[backend]');

  backendProc.on('exit', (code) => {
    if (!isShuttingDown) {
      log(`[backend] exited (${code ?? 'null'})`);
    }
  });

  const healthy = await waitForHealth();
  if (!healthy) throw new Error(`Backend did not become healthy at ${REMOTE_URL}`);
  log(`Backend is healthy at ${REMOTE_URL}`);
}

function startDashboard(token) {
  return new Promise((resolve, reject) => {
    log(`Starting dashboard with ${PM}...`);

    const devArgs = PM === 'pnpm'
      ? ['run', 'dev', '--host', '127.0.0.1', '--port', '5173']
      : ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173'];

    dashboardProc = spawn(PM, devArgs, {
      cwd: DASHBOARD_DIR,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const onLine = (line) => {
      const localMatch = line.match(/(http:\/\/127\.0\.0\.1:\d+)/i) || line.match(/(http:\/\/localhost:\d+)/i);
      if (localMatch) {
        const base = localMatch[1].replace('127.0.0.1', 'localhost');
        const finalUrl = `${base}/?remote=${encodeURIComponent(REMOTE_URL)}&token=${encodeURIComponent(token)}`;
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

  await wait(250);
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

(async function main() {
  try {
    await startBackend();
    const token = await createToken();
    await startDashboard(token);
    log('Dev stack running. Press Ctrl+C to stop both backend and dashboard.');
  } catch (err) {
    log(`Fatal: ${err.message}`);
    await shutdown();
  }
})();
