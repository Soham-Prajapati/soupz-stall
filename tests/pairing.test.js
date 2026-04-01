import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

function readSource(relativePath) {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

describe('Pairing Flow Contract', () => {
  it('uses 9-character pairing codes in connect UI flow', () => {
    const connectPage = readSource('packages/dashboard/src/components/connect/ConnectPage.jsx');
    expect(connectPage).toContain('code.length === 9');
  });

  it('builds hosted pairing URL on /code route in daemon', () => {
    const pairing = readSource('packages/remote-server/src/pairing.js');
    expect(pairing).toContain('return `${base}/code?${params.toString()}`');
  });

  it('prints /code URL from CLI bootstrap output', () => {
    const cli = readSource('bin/soupz.js');
    expect(cli).toContain('/code?code=${pairing.code}');
  });
});
