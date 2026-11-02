// The secret scanner must catch real-looking credentials and accept the repository as it is.
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain ESM script without types
import { scanRepo, scanText } from '../../scripts/scan-secrets.mjs';

describe('secret scan', () => {
  it.each([
    ['-----BEGIN ' + 'PRIVATE KEY-----\nabc'],
    ['const k = "AKIA' + 'ABCDEFGHIJKLMNOP"'],
    ['token: "ghp_' + 'a'.repeat(36) + '"'],
    ['url = "postgres://admin:' + 'S3cr3tPass' + '@db.example.com/prod"'],
    ['const apiKey = "' + 'x9'.repeat(14) + '"'],
  ])('flags %s', (text) => {
    expect((scanText(text) as string[]).length).toBeGreaterThan(0);
  });

  it('accepts local test connection strings', () => {
    expect(scanText('postgres://qr:qr@127.0.0.1:5432/qr_test')).toEqual([]);
  });

  it('the repository is clean', () => {
    expect(scanRepo()).toEqual([]);
  });
});
