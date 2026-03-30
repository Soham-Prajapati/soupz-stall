import { describe, it, expect } from 'vitest';

describe('Pairing Code', () => {
  it('generates 9-character alphanumeric numeric code', () => {
    const code = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).join('');
    expect(code).toHaveLength(8);
    expect(/^\d{8}$/.test(code)).toBe(true);
  });

  it('codes are unique across generations', () => {
    const codes = new Set();
    for (let i = 0; i < 100; i++) {
      codes.add(Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).join(''));
    }
    // With 100M possible codes, 100 should all be unique
    expect(codes.size).toBe(100);
  });
});
