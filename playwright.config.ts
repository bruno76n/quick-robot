import { defineConfig, devices } from '@playwright/test';

// Flows run against the real local server with the development seed (docs/14 §2). Each spec starts its own
// server on a free port with its own data folder, so they can restart it.
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  globalSetup: './e2e/support/global-setup.ts',
  use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, trace: 'off', locale: 'es-MX', timezoneId: 'America/Mexico_City' },
});
