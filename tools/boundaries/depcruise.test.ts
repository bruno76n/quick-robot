// Negative test for dependency-cruiser: a probe file that breaks an arrow must produce a violation.
import { cruise } from 'dependency-cruiser';
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../..', import.meta.url));
const config = createRequire(import.meta.url)('../../.dependency-cruiser.cjs');
const probes: string[] = [];

async function cruiseProbe(relPath: string, code: string) {
  const abs = `${root}/${relPath}`;
  mkdirSync(abs.slice(0, abs.lastIndexOf('/')), { recursive: true });
  writeFileSync(abs, code);
  probes.push(abs);
  const cwd = process.cwd();
  process.chdir(root);
  try {
    const result = await cruise([relPath], { ...config.options, validate: true, ruleSet: { forbidden: config.forbidden } });
    const output = typeof result.output === 'string' ? JSON.parse(result.output) : result.output;
    return output.summary.violations.map((v: { rule: { name: string } }) => v.rule.name) as string[];
  } finally {
    process.chdir(cwd);
  }
}

afterAll(() => probes.forEach((p) => rmSync(p, { force: true })));

describe('dependency-cruiser boundaries (negative test)', () => {
  it('rejects core importing a Node module', async () => {
    const rules = await cruiseProbe('packages/core/src/__probe_node.ts', "import { readFileSync } from 'node:fs';\nexport const x = readFileSync;\n");
    expect(rules).toContain('core-imports-nothing');
  });
  it('rejects db importing the server package', async () => {
    const rules = await cruiseProbe('packages/db/src/__probe_server.ts', "import * as s from '../../server/src/index';\nexport const x = s;\n");
    expect(rules).toContain('db-no-monorepo');
  });
});
