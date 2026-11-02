import { execFileSync } from 'node:child_process';

/** Build the web once; every spec serves the build from its own local server. E2E_WEB_DIST picks another folder. */
export default function globalSetup() {
  const out = process.env.E2E_WEB_DIST;
  if (process.env.E2E_SKIP_BUILD !== '1') execFileSync('pnpm', ['--filter', '@app/web', 'exec', 'vite', 'build', ...(out ? ['--outDir', out, '--emptyOutDir'] : [])], { stdio: 'inherit' });
}
