// pnpm security (docs/11 › El chequeo): one command, run on every step and in CI.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const steps = [
  ['1. lint (boundaries + security rules)', 'pnpm', ['lint']],
  ['2. pnpm audit (high/critical)', 'pnpm', ['audit', '--audit-level', 'high']],
  ['3. secret scan', 'node', ['scripts/scan-secrets.mjs']],
  ['4-6. security tests (headers, access matrix, injection, import, failure midway) + negative lint',
    'pnpm', ['exec', 'vitest', 'run', 'tools/test', ...(existsSync('packages/server/test/security') ? ['packages/server/test/security'] : [])]],
];
let failed = [];
for (const [name, cmd, args] of steps) {
  console.log(`\n▶ ${name}`);
  try { execFileSync(cmd, args, { stdio: 'inherit' }); } catch { failed.push(name); }
}
console.log(failed.length ? `\n✗ pnpm security FAILED: ${failed.join(' · ')}` : '\n✓ pnpm security passed');
process.exit(failed.length ? 1 : 0);
