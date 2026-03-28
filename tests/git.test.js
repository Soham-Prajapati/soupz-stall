import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';

describe('Git Operations', () => {
  it('can read current branch', () => {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    expect(branch).toBeTruthy();
    expect(typeof branch).toBe('string');
  });

  it('can list branches', () => {
    const raw = execSync('git branch --list', { encoding: 'utf8' }).trim();
    const branches = raw.split('\n').map(b => b.replace(/^\*?\s*/, '').trim()).filter(Boolean);
    expect(branches.length).toBeGreaterThan(0);
    expect(branches).toContain('main');
  });

  it('can get git status', () => {
    const status = execSync('git status --porcelain', { encoding: 'utf8' });
    expect(typeof status).toBe('string');
  });
});
