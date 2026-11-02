// Negative tests (docs/14 §7): code that breaks a boundary or a security rule must FAIL the lint.
// If one of these starts passing, the lint stopped guarding.
import { ESLint } from 'eslint';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../..', import.meta.url));
const eslint = new ESLint({ cwd: root });

async function errorsFor(filePath: string, code: string) {
  const [res] = await eslint.lintText(code, { filePath: `${root}/${filePath}` });
  return (res?.messages ?? []).filter((m) => m.severity === 2).map((m) => m.message);
}

const broken: [string, string, string][] = [
  ['core imports db', 'packages/core/src/probe.ts', "import { x } from '@app/db';\nexport const y = x;\n"],
  ['core imports Node', 'packages/core/src/probe.ts', "import { readFileSync } from 'node:fs';\nexport const y = readFileSync;\n"],
  ['core reads the clock', 'packages/core/src/probe.ts', 'export const now = () => new Date();\n'],
  ['web imports db', 'apps/web/src/lib/probe.ts', "import { x } from '@app/db';\nexport const y = x;\n"],
  ['web imports server', 'apps/web/src/lib/probe.ts', "import { x } from '@app/server';\nexport const y = x;\n"],
  ['web imports Node', 'apps/web/src/lib/probe.ts', "import { readFileSync } from 'node:fs';\nexport const y = readFileSync;\n"],
  ['server writes SQL', 'packages/server/src/usecases/probe.ts', "import { sql } from 'drizzle-orm';\nexport const y = sql;\n"],
  ['db imports core', 'packages/db/src/probe.ts', "import { x } from '@app/core';\nexport const y = x;\n"],
  ['contract imports core', 'packages/contract/src/probe.ts', "import { x } from '@app/core';\nexport const y = x;\n"],
  ['mode branch in a use case', 'packages/server/src/usecases/probe.ts', "export const f = (mode: string) => (mode === 'cloud' ? 1 : 2);\n"],
  ['dangerouslySetInnerHTML', 'apps/web/src/lib/probe.tsx', 'export const C = () => <div dangerouslySetInnerHTML={{ __html: "x" }} />;\n'],
  ['Spanish literal in a component', 'apps/web/src/components/Probe.tsx', 'export const C = () => <p>Guardar venta</p>;\n'],
  ['eval', 'packages/server/src/probe.ts', "export const f = (s: string) => eval(s);\n"],
  ['sql.raw', 'packages/db/src/probe.ts', "import { sql } from 'drizzle-orm';\nexport const f = (s: string) => sql.raw(s);\n"],
  ['SQL concatenation', 'packages/db/src/probe.ts', 'export const f = (c: { query(s: string): void }, id: string) => c.query(`select * from t where id = ${id}`);\n'],
  ['default export', 'packages/server/src/probe.ts', 'export default 1;\n'],
  ['console.log', 'packages/server/src/probe.ts', "console.log('x');\nexport {};\n"],
];

describe('lint rejects broken boundaries and rules', () => {
  it.each(broken)('%s', async (_name, file, code) => {
    expect((await errorsFor(file, code)).length).toBeGreaterThan(0);
  });

  it('allows web → core and contract', async () => {
    expect(await errorsFor('apps/web/src/lib/probe.ts', "import { x } from '@app/core';\nimport { y } from '@app/contract';\nexport const z = [x, y];\n")).toEqual([]);
  });

  it('the fixture packages/core/test/fixtures/forbidden-import.ts fails the lint', async () => {
    const code = readFileSync(`${root}/packages/core/test/fixtures/forbidden-import.ts`, 'utf8');
    expect((await errorsFor('packages/core/src/forbidden-import.ts', code)).join('\n')).toMatch(/packages\/core imports nothing/);
  });

  it('dependency-cruiser rejects the fixture', async () => {
    const { cruise } = await import('dependency-cruiser');
    const config = createRequire(import.meta.url)(`${root}/.dependency-cruiser.cjs`) as { forbidden: unknown[] };
    const result = await cruise(['packages/core/test/fixtures/forbidden-import.ts'], {
      validate: true, ruleSet: { forbidden: config.forbidden } as never, doNotFollow: { path: 'node_modules' }, baseDir: root,
    });
    const output = result.output as { summary: { violations: { rule: { name: string } }[] } };
    expect(output.summary.violations.map((v) => v.rule.name)).toContain('core-imports-nothing');
  });
});
