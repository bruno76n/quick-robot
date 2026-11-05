// `test` for specs against the development seed: the browser clock matches the server's frozen clock (2026-11-01).
import { test as base } from '@playwright/test';

export * from '@playwright/test';
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.clock.setFixedTime(new Date('2026-11-01T18:00:00Z'));
    await use(page);
  },
});
