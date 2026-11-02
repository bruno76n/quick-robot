// tsc --noEmit for every package and app that has a tsconfig.json, plus the root (scripts, tools).
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';

const dirs = ['.', ...['packages', 'apps'].flatMap((d) => (existsSync(d) ? readdirSync(d).map((x) => `${d}/${x}`) : []))]
  .filter((d) => existsSync(`${d}/tsconfig.json`));
let failed = false;
for (const d of dirs) {
  try {
    execFileSync('pnpm', ['exec', 'tsc', '-p', `${d}/tsconfig.json`], { stdio: 'inherit' });
    console.log(`typecheck ok  ${d}`);
  } catch {
    failed = true;
    console.error(`typecheck FAILED  ${d}`);
  }
}
process.exit(failed ? 1 : 0);
