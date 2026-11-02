// Screenshots of the mockup's Filamentos screen (list, drawer, add-spool dialog) at the three widths.
// Usage: node tools/visual/shoot-mockup.mjs <outDir>
import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const out = resolve(process.argv[2] ?? 'tools/visual/out');
mkdirSync(out, { recursive: true });
const url = pathToFileURL(resolve('reference/Quick Robot mockup.html')).href + '#filamentos';
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
const browser = await chromium.launch(proxy ? { proxy } : {});
for (const [name, width, height] of [['desktop', 1440, 900], ['tablet', 820, 1180], ['mobile', 390, 844]]) {
  const page = await browser.newPage({ viewport: { width, height }, ignoreHTTPSErrors: true });
  await page.goto(url);
  await page.waitForTimeout(800);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${out}/mockup-${name}-list.png`, fullPage: true });
  await page.click('tr.click');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/mockup-${name}-drawer.png` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.click('[data-act="rollo-new"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/mockup-${name}-dialog.png` });
  await page.close();
}
await browser.close();
console.log('ok', out);
