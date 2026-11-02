import { execSync } from 'node:child_process';

/** The local server serves the built web app, like Electron will. */
export default function globalSetup() {
  execSync('pnpm build', { stdio: 'inherit' });
}
