// Visual comparison (CLAUDE.md › Modo autónomo, step 4): mockup vs app, Filamentos screen,
// list / drawer / add-spool dialog at 1440, 820 and 390 px.
// Usage: node tools/visual/compare-filaments.mjs [appUrl] [outDir]
import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const appUrl = process.argv[2] ?? 'http://127.0.0.1:5173';
const out = resolve(process.argv[3] ?? 'tools/visual/out');
mkdirSync(out, { recursive: true });
const mockupUrl = pathToFileURL(resolve('reference/Quick Robot mockup.html')).href + '#filamentos';
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } : undefined;
const browser = await chromium.launch(proxy ? { proxy } : {});

const targets = {
  mockup: { url: mockupUrl, row: 'tr.click', add: '.ph-a [data-act="rollo-new"]' },
  app: { url: `${appUrl}/filamentos`, row: '[data-testid="filament-row"]', add: 'main button:has-text("Agregar rollo")' },
};

for (const [name, width, height] of [['desktop', 1440, 900], ['tablet', 820, 1180], ['mobile', 390, 844]]) {
  for (const [who, t] of Object.entries(targets)) {
    const page = await browser.newPage({ viewport: { width, height }, ignoreHTTPSErrors: true });
    await page.goto(t.url);
    await page.waitForSelector(t.row);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${out}/${name}-list-${who}.png`, fullPage: true });
    await page.locator(t.row).first().click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${out}/${name}-drawer-${who}.png` });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    await page.locator(t.add).first().click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${out}/${name}-dialog-${who}.png` });
    await page.close();
  }
}
await browser.close();
console.log('screenshots in', out);
