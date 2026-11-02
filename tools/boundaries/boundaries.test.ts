// Negative test of the package boundaries: each fixture breaks one arrow of docs/03 and the lint must reject it.
import { ESLint } from 'eslint';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../..', import.meta.url));
const eslint = new ESLint({ cwd: root, ignore: false });

async function lintAs(fixture: string, pretendPath: string) {
  const code = readFileSync(new URL(`./fixtures/${fixture}`, import.meta.url), 'utf8');
  const [result] = await eslint.lintText(code, { filePath: `${root}/${pretendPath}` });
  return result!.messages;
}

const cases: [fixture: string, path: string, rule: string][] = [
  ['core-imports-db.ts', 'packages/core/src/violation.ts', 'no-restricted-imports'],
  ['core-imports-node.ts', 'packages/core/src/violation.ts', 'no-restricted-imports'],
  ['web-imports-db.ts', 'apps/web/src/violation.ts', 'no-restricted-imports'],
  ['web-imports-server.ts', 'apps/web/src/violation.ts', 'no-restricted-imports'],
  ['server-writes-sql.ts', 'packages/server/src/violation.ts', 'no-restricted-imports'],
  ['db-imports-core.ts', 'packages/db/src/violation.ts', 'no-restricted-imports'],
  ['contract-imports-core.ts', 'packages/contract/src/violation.ts', 'no-restricted-imports'],
  ['usecase-mode-branch.ts', 'packages/server/src/usecases/violation.ts', 'no-restricted-syntax'],
];

describe('package boundaries (negative test)', () => {
  it.each(cases)('%s is rejected when placed at %s', async (fixture, path, rule) => {
    const messages = await lintAs(fixture, path);
    expect(messages.some((m) => m.ruleId === rule && m.severity === 2)).toBe(true);
  });

  it('allowed arrow web → core, contract passes', async () => {
    const messages = await lintAs('allowed-web-imports-core.ts', 'apps/web/src/allowed.ts');
    expect(messages.filter((m) => m.severity === 2)).toEqual([]);
  });
});
