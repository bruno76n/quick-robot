// Negative test of the secret scan: planted credentials must make it fail.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const script = fileURLToPath(new URL('./scan-secrets.mjs', import.meta.url));
const scan = (content: string, name = 'config.ts') => {
  const f = join(mkdtempSync(join(tmpdir(), 'scan-')), name);
  writeFileSync(f, content);
  try {
    execFileSync(process.execPath, [script, f], { stdio: 'pipe' });
    return 0;
  } catch (e) {
    return (e as { status: number }).status;
  }
};
// Built at run time so this test file itself does not contain a secret-looking literal.
const fake = (prefix: string, n: number) => prefix + 'A1b2C3d4E5'.repeat(Math.ceil(n / 10)).slice(0, n);

describe('secret scan (docs/11 · A04)', () => {
  it.each([
    ['private key', `-----BEGIN ${'PRIVATE'} KEY-----\nabc`],
    ['GitHub token', `const t = "${fake('ghp_', 36)}";`],
    ['API key', `key: "${fake('sk-ant-', 40)}"`],
    ['assigned secret', `password = "${fake('', 30)}"`],
    ['password in URL', `postgres://admin:${fake('', 12)}@db.example.com/prod`],
  ])('finds a %s', (_n, content) => expect(scan(content)).toBe(1));
  it('a .env file is refused', () => expect(scan('X=1', '.env')).toBe(1));
  it('clean code passes', () => expect(scan('export const port = 8787;')).toBe(0));
});
