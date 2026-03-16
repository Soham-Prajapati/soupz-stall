#!/usr/bin/env node

import { existsSync, copyFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, '..');

const PROJECTS = [
  { name: 'root', path: REPO_ROOT },
  { name: 'remote-server', path: join(REPO_ROOT, 'packages/remote-server') },
  { name: 'dashboard', path: join(REPO_ROOT, 'packages/dashboard') },
  { name: 'mobile-ide', path: join(REPO_ROOT, 'packages/mobile-ide') },
];

function hasCmd(cmd) {
  const out = spawnSync('sh', ['-lc', `command -v ${cmd}`], { stdio: 'ignore' });
  return out.status === 0;
}

function detectPackageManager() {
  if (process.env.SOUPZ_PM) return process.env.SOUPZ_PM;

  const ua = process.env.npm_config_user_agent || '';
  if (ua.includes('pnpm/')) return 'pnpm';
  if (ua.includes('npm/')) return 'npm';

  if (hasCmd('pnpm')) return 'pnpm';
  return 'npm';
}

function runInstall(pm, projectPath, label) {
  const cmd = pm;
  const args = ['install'];

  const out = spawnSync(cmd, args, {
    cwd: projectPath,
    stdio: 'inherit',
    env: process.env,
  });

  if (out.status !== 0) {
    throw new Error(`Install failed for ${label} (${pm} install)`);
  }
}

function ensureEnvFile() {
  const examplePath = join(REPO_ROOT, '.env.example');
  const envPath = join(REPO_ROOT, '.env');

  if (!existsSync(examplePath)) {
    console.log('! Skipping env bootstrap: .env.example not found');
    return;
  }

  if (existsSync(envPath)) {
    console.log('= .env already exists, leaving it unchanged');
    return;
  }

  copyFileSync(examplePath, envPath);
  console.log('+ Created .env from .env.example');
}

function main() {
  const pm = detectPackageManager();
  console.log(`Using package manager: ${pm}`);

  ensureEnvFile();

  for (const project of PROJECTS) {
    console.log(`\nInstalling dependencies for ${project.name}...`);
    runInstall(pm, project.path, project.name);
  }

  console.log('\nSetup complete.');
  console.log('Next: fill real values in .env before running remote features.');
}

try {
  main();
} catch (err) {
  console.error(`\nSetup failed: ${err.message}`);
  process.exit(1);
}
