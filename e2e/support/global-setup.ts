import { execFileSync } from 'node:child_process';

/** Build the web once; every spec serves apps/web/dist from its own local server. */
export default function globalSetup() {
  if (process.env.E2E_SKIP_BUILD !== '1') execFileSync('pnpm', ['--filter', '@app/web', 'build'], { stdio: 'inherit' });
}
