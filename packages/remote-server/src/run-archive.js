import { mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import os from 'os';
import { REPO_ROOT } from './shared.js';

const DEFAULT_RELATIVE_DIR = process.env.SOUPZ_ARCHIVE_DIR || '.soupz/output';
const FALLBACK_RELATIVE_DIR = '_soupz_output';

function sanitizeSegment(input) {
  return String(input || '')
    .replace(/[:]/g, '-')
    .replace(/[^a-zA-Z0-9-_]/g, '-');
}

async function ensureArchiveRoot(preferredRoots = []) {
  for (const root of preferredRoots) {
    if (!root) continue;
    try {
      const dir = resolve(root, DEFAULT_RELATIVE_DIR);
      await mkdir(dir, { recursive: true });
      return dir;
    } catch {
      // try next candidate
    }
  }
  const fallback = resolve(REPO_ROOT, FALLBACK_RELATIVE_DIR);
  await mkdir(fallback, { recursive: true });
  return fallback;
}

function buildSummary(order) {
  const durationMs = order.durationMs
    || (order.startedAt && order.finishedAt
      ? new Date(order.finishedAt).getTime() - new Date(order.startedAt).getTime()
      : null);

  return {
    id: order.id,
    status: order.status,
    agent: order.agent,
    runAgent: order.runAgent,
    modelPolicy: order.modelPolicy,
    orchestrationMode: order.orchestrationMode,
    deepPolicy: order.deepPolicy,
    cwd: order.cwd,
    createdAt: order.createdAt,
    startedAt: order.startedAt,
    finishedAt: order.finishedAt,
    durationMs,
    exitCode: order.exitCode,
    cancelRequested: order.cancelRequested,
    allowedAgents: order.allowedAgents,
    createdFiles: order.createdFiles,
    pendingQuestions: order.pendingQuestions,
    laneBuffers: order.laneBuffers,
    events: order.events,
  };
}

export async function archiveOrderResult(order) {
  if (!order || !order.finishedAt) return;
  try {
    const candidateRoots = [
      order.cwd && existsSync(order.cwd) ? order.cwd : null,
      process.cwd(),
      os.homedir?.() || null,
      REPO_ROOT,
    ];
    const archiveRoot = await ensureArchiveRoot(candidateRoots);
    const finishedIso = sanitizeSegment(order.finishedAt || new Date().toISOString());
    const folderName = `${finishedIso}_${sanitizeSegment(order.id || 'order')}`;
    const folderPath = join(archiveRoot, folderName);
    await mkdir(folderPath, { recursive: true });

    const files = [];
    files.push({ name: 'summary.json', content: JSON.stringify(buildSummary(order), null, 2) });
    if (order.prompt) {
      files.push({ name: 'prompt.md', content: `# Prompt\n\n${order.prompt}\n` });
    }
    if (order.stdout) {
      files.push({ name: 'stdout.txt', content: order.stdout });
    }
    if (order.stderr) {
      files.push({ name: 'stderr.txt', content: order.stderr });
    }
    if (Array.isArray(order.events) && order.events.length > 0) {
      const ndjson = order.events.map((evt) => JSON.stringify(evt)).join('\n');
      files.push({ name: 'events.ndjson', content: `${ndjson}\n` });
    }

    await Promise.all(files.map(({ name, content }) =>
      writeFile(join(folderPath, name), content, 'utf8')));
  } catch (err) {
    console.warn(`[archive] Failed to persist run for order ${order?.id || 'unknown'}: ${err.message}`);
  }
}
