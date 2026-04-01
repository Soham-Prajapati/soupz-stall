#!/usr/bin/env node

import { spawn } from 'child_process';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve } from 'path';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : '1';
    out[key] = value;
    if (value !== '1') i += 1;
  }
  return out;
}

function sanitizeSegment(input) {
  return String(input || '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function runAsk(agent, prompt, timeoutMs) {
  return new Promise((resolveResult) => {
    const startedAt = Date.now();
    const child = spawn(process.execPath, [resolve('bin/soupz.js'), 'ask', agent, prompt], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      resolveResult({
        exitCode: 124,
        timedOut: true,
        durationMs: Date.now() - startedAt,
        stdout,
        stderr,
      });
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      if (stdout.length > 600000) stdout = stdout.slice(-600000);
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 300000) stderr = stderr.slice(-300000);
    });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolveResult({
        exitCode: 1,
        timedOut: false,
        durationMs: Date.now() - startedAt,
        stdout,
        stderr: `${stderr}\n${err.message}`,
      });
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolveResult({
        exitCode: Number.isFinite(code) ? code : 1,
        timedOut: false,
        durationMs: Date.now() - startedAt,
        stdout,
        stderr,
      });
    });
  });
}

function buildSummaryMarkdown(summary) {
  const lines = [];
  lines.push('# Model Benchmark Summary');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('| Agent | Prompt | Exit | Timeout | Duration (ms) |');
  lines.push('|---|---|---:|---:|---:|');

  for (const row of summary.rows) {
    lines.push(`| ${row.agent} | ${row.promptId} | ${row.exitCode} | ${row.timedOut ? 'yes' : 'no'} | ${row.durationMs} |`);
  }

  lines.push('');
  lines.push('## Manual Grading Rubric (1-5 each)');
  lines.push('');
  lines.push('- correctness and factuality');
  lines.push('- implementation feasibility');
  lines.push('- reasoning transparency');
  lines.push('- output structure and completeness');
  lines.push('- production readiness');
  lines.push('');
  lines.push('Use these outputs to choose your preferred default agent/model policy.');
  return `${lines.join('\n')}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const promptsPath = resolve(args.prompts || 'benchmarks/model-eval-prompts.json');
  const timeoutMs = Math.max(10000, Number.parseInt(args.timeout || '120000', 10) || 120000);
  const defaultAgents = ['codex', 'gemini', 'copilot', 'claude-code', 'kiro', 'ollama'];
  const agents = (args.agents ? String(args.agents).split(',') : defaultAgents)
    .map((v) => v.trim())
    .filter(Boolean);

  if (!existsSync(promptsPath)) {
    throw new Error(`Prompts file not found: ${promptsPath}`);
  }

  const prompts = JSON.parse(await readFile(promptsPath, 'utf8'));
  if (!Array.isArray(prompts) || prompts.length === 0) {
    throw new Error('Prompts file must contain a non-empty array.');
  }

  const outDir = resolve(args.out || `.soupz/benchmarks/${nowStamp()}`);
  await mkdir(outDir, { recursive: true });

  const summary = {
    promptsPath,
    agents,
    timeoutMs,
    startedAt: new Date().toISOString(),
    rows: [],
  };

  for (const promptItem of prompts) {
    const promptId = sanitizeSegment(promptItem.id || promptItem.title || 'prompt');
    const promptText = String(promptItem.prompt || '').trim();
    if (!promptText) continue;

    for (const agent of agents) {
      const result = await runAsk(agent, promptText, timeoutMs);
      const fileBase = `${sanitizeSegment(agent)}__${promptId}`;
      const outputMd = [
        `# ${agent} / ${promptId}`,
        '',
        `- exitCode: ${result.exitCode}`,
        `- timedOut: ${result.timedOut}`,
        `- durationMs: ${result.durationMs}`,
        '',
        '## Prompt',
        '',
        promptText,
        '',
        '## Stdout',
        '',
        '```text',
        result.stdout || '',
        '```',
        '',
        '## Stderr',
        '',
        '```text',
        result.stderr || '',
        '```',
        '',
      ].join('\n');

      await writeFile(join(outDir, `${fileBase}.md`), outputMd, 'utf8');

      summary.rows.push({
        agent,
        promptId,
        exitCode: result.exitCode,
        timedOut: result.timedOut,
        durationMs: result.durationMs,
      });
    }
  }

  summary.finishedAt = new Date().toISOString();
  await writeFile(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');
  await writeFile(join(outDir, 'SUMMARY.md'), buildSummaryMarkdown(summary), 'utf8');

  process.stdout.write(`Benchmark completed. Output: ${outDir}\n`);
}

main().catch((err) => {
  process.stderr.write(`Benchmark failed: ${err.message}\n`);
  process.exit(1);
});
