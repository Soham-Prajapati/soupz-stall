#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';

const ROOT = process.cwd();
const CRITICAL_DOC_FILES = [
  'README.md',
  'PROJECT_OVERVIEW.md',
  'CLAUDE.md',
  'docs/README.md',
  'docs/CURRENT_SYSTEM.md',
  'docs/RUNTIME_CHANGELOG.md',
  'docs/SETUP.md',
  'docs/architecture/SYSTEM_ARCHITECTURE.md',
  'docs/guides/FOUR_DAY_STABILIZATION_CHECKLIST.md',
  'docs/guides/OWNER_ACTION_CHECKLIST.md',
  'packages/dashboard/public/docs/architecture.md',
  'packages/dashboard/public/docs/quickstart.md',
];

const MARKDOWN_LINK_RE = /\[[^\]]+\]\(([^)]+)\)/g;

function stripFencedCodeBlocks(markdown) {
  return String(markdown || '').replace(/```[\s\S]*?```/g, '');
}

function isExternalLink(target) {
  const value = String(target || '').trim();
  return (
    !value ||
    value.startsWith('#') ||
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('mailto:') ||
    value.startsWith('tel:') ||
    value.startsWith('javascript:')
  );
}

function stripAnchorAndQuery(target) {
  return String(target || '').split('#')[0].split('?')[0];
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const failures = [];
  const files = [];

  for (const relPath of CRITICAL_DOC_FILES) {
    const absPath = path.join(ROOT, relPath);
    if (await fileExists(absPath)) files.push(absPath);
  }

  for (const file of files) {
    const content = stripFencedCodeBlocks(await fs.readFile(file, 'utf8'));
    MARKDOWN_LINK_RE.lastIndex = 0;
    let match;
    while ((match = MARKDOWN_LINK_RE.exec(content)) !== null) {
      const rawTarget = match[1]?.trim() || '';
      if (isExternalLink(rawTarget)) continue;
      if (rawTarget.startsWith('<') && rawTarget.endsWith('>')) continue;

      const normalized = stripAnchorAndQuery(rawTarget);
      if (!normalized) continue;

      const targetPath = normalized.startsWith('/')
        ? path.join(ROOT, normalized.slice(1))
        : path.resolve(path.dirname(file), normalized);

      if (!(await fileExists(targetPath))) {
        failures.push({
          file: path.relative(ROOT, file),
          target: rawTarget,
          resolved: path.relative(ROOT, targetPath),
        });
      }
    }
  }

  if (failures.length > 0) {
    console.error('Broken markdown links found in critical docs:');
    for (const failure of failures) {
      console.error(`- ${failure.file}: ${failure.target} (resolved: ${failure.resolved})`);
    }
    process.exit(1);
  }

  console.log(`Docs link check passed (${files.length} critical docs scanned).`);
}

main().catch((err) => {
  console.error(`Docs link check failed: ${err.message}`);
  process.exit(1);
});
