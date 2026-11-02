import { defineConfig } from 'vitest/config';

// Coverage thresholds from docs/14 §4.
export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: ['packages/*', 'apps/*', 'tools'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**', 'apps/web/src/**'],
      exclude: ['**/*.test.*', '**/index.ts', '**/seed/**', 'apps/web/src/app/**', 'apps/web/src/features/**'],
      thresholds: {
        'packages/core/src/**': { lines: 95, branches: 90 },
        'packages/server/src/usecases/**': { lines: 85 },
        'apps/web/src/lib/**': { lines: 60 },
        'apps/web/src/components/**': { lines: 60 },
      },
    },
  },
});
