// Visual comparison of a screen: mockup vs app at 1440, 820 and 390 px (CLAUDE.md › Modo autónomo, step 4).
// Usage: node tools/visual/compare.mjs <screen> [appUrl] [outDir]
//   screens: productos, productos-lista, colecciones, pieza, coleccion, insumos, insumos-cajon, impresoras, ajustes
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { openMockup } from '../mockup-page.mjs';

const SCREENS = {
  productos: { hash: 'productos', path: '/productos' },
  'productos-lista': { hash: 'productos', mpre: `document.querySelector('[data-act="vista"][data-v="lista"]').click()`, path: '/productos', apre: `[...document.querySelectorAll('button')].find(b => b.textContent === 'Lista').click()` },
  colecciones: { hash: 'productos', mpre: `document.querySelector('[data-act="cat"][data-v="colecciones"]').click()`, path: '/productos?tab=colecciones' },
  pieza: { hash: 'productos', mpre: `document.querySelectorAll('article[data-act="open-prod"]')[0].click()`, path: '/productos', apre: `document.querySelectorAll('[data-testid="product-tile"]')[0].click()` },
  coleccion: { hash: 'productos', mpre: `document.querySelector('[data-act="cat"][data-v="colecciones"]').click(); setTimeout(() => document.querySelector('[data-act="open-col"]').click(), 200)`, path: '/productos?tab=colecciones', apre: `document.querySelectorAll('[data-testid="product-tile"]')[0].click()` },
  insumos: { hash: 'insumos', path: '/insumos' },
  'insumos-cajon': { hash: 'insumos', mpre: `document.querySelector('[data-act="ins-sel"]').click()`, path: '/insumos', apre: `document.querySelector('[data-testid="supply-card"]').click()` },
  impresoras: { hash: 'impresoras', path: '/impresoras' },
  ajustes: { hash: 'ajustes', path: '/ajustes' },
};

const [screen, appUrl = 'http://127.0.0.1:5173', outArg] = process.argv.slice(2);
const cfg = SCREENS[screen];
if (!cfg) throw new Error(`unknown screen ${screen}`);
const out = resolve(outArg ?? 'tools/visual/out');
mkdirSync(out, { recursive: true });
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } : undefined;
for (const [name, width, height] of [['desktop', 1440, 900], ['tablet', 820, 1180], ['mobile', 390, 844]]) {
  const { browser, page } = await openMockup({ width, height, hash: cfg.hash });
  await page.waitForTimeout(500);
  if (cfg.mpre) {
    await page.evaluate(cfg.mpre);
    await page.waitForTimeout(700);
  }
  await page.screenshot({ path: `${out}/${screen}-${name}-mockup.png` });
  await browser.close();
  const b2 = await chromium.launch(proxy ? { proxy } : {});
  const p2 = await b2.newPage({ viewport: { width, height } });
  await p2.goto(appUrl + cfg.path);
  await p2.waitForLoadState('networkidle');
  await p2.waitForTimeout(500);
  if (cfg.apre) {
    await p2.evaluate(cfg.apre);
    await p2.waitForLoadState('networkidle');
    await p2.waitForTimeout(800);
  }
  await p2.screenshot({ path: `${out}/${screen}-${name}-app.png` });
  await b2.close();
}
console.log('ok', screen);
