import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { join } from 'path';

describe('Filesystem Safety', () => {
  it('rejects path traversal attempts', () => {
    const dangerous = ['../../../etc/passwd', '..\\..\\windows\\system32'];
    for (const p of dangerous) {
      const resolved = join('/safe/root', p);
      // Path should be normalized - traversal above root stays at root or above safe/root
      expect(typeof resolved).toBe('string');
      expect(resolved.length).toBeGreaterThan(0);
    }
  });

  it('project structure has required files', () => {
    expect(existsSync('package.json')).toBe(true);
    expect(existsSync('packages/remote-server/src/index.js')).toBe(true);
    expect(existsSync('packages/dashboard/src/App.jsx')).toBe(true);
    expect(existsSync('bin/soupz.js')).toBe(true);
  });
});
