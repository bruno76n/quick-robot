// Neutral panel (mejoras/ronda-2.md §2, R6 and R8): no interface element uses the old purples or the violet-tinted
// shadows, and no screen writes "Quick Robot" from code. The business is renamed first in Ajustes, because the
// seed business is called "Quick Robot" (legitimate data). The mascot is the owner's brand art and keeps its colors
// (person's decision, docs/decisiones.md 2026-11-13); data colors (filament swatches, pieces) are not interface.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from './support/test';
import { startServer, type LocalServer } from './support/server';

let server: LocalServer;
test.beforeAll(async () => { server = await startServer(); });
test.afterAll(async () => { await server.stop(); });

const MENU = ['/inicio', '/productos', '/ventas', '/pedidos', '/filamentos', '/insumos', '/impresoras', '/produccion', '/existencias', '/compras', '/clientes', '/gastos', '/reportes', '/ajustes'];
// #6b3fd4, #efe9fd, #4c28a8, #9b7de6, #c4b2f2, #e0d7f8 (the brand purple and its layers), #b9a8ee (timeline lavender)
// and the tinted shadows rgba(32, 26, 54), rgba(20, 12, 40), rgba(25, 12, 60) (informe-ronda2-a §3.1).
const RGB = ['107, 63, 212', '239, 233, 253', '76, 40, 168', '155, 125, 230', '196, 178, 242', '224, 215, 248', '185, 168, 238', '32, 26, 54', '20, 12, 40', '25, 12, 60'];
const HEX = ['6b3fd4', 'efe9fd', '4c28a8', '9b7de6', 'c4b2f2', 'e0d7f8', 'b9a8ee'];

/** Every element's computed colors, except the mascot and anything painted from data (inline style with a color). */
const purpleHits = (page: Page) => page.evaluate((rgb) => {
  const props = ['color', 'background-color', 'background-image', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color', 'outline-color', 'box-shadow', 'text-decoration-color', 'fill', 'stroke', 'accent-color', 'caret-color'];
  const data = (el: Element) => el.closest('img, .mascot, [style*="#"], [style*="--"], [style*="rgb"]') !== null;
  const hits: string[] = [];
  for (const el of [document.documentElement, ...document.querySelectorAll('body *')]) {
    if (data(el)) continue;
    const cs = getComputedStyle(el);
    for (const p of props) {
      const v = cs.getPropertyValue(p);
      const bad = rgb.find((c) => v.includes(`rgb(${c})`) || v.includes(`rgba(${c},`));
      if (bad) hits.push(`${el.tagName.toLowerCase()}.${(el.getAttribute('class') ?? '').replace(/\s+/g, '.')} ${p}: ${v}`);
    }
  }
  return [...new Set(hits)].slice(0, 20);
}, RGB);

test('the compiled stylesheets of the web build carry none of the old purples or tinted shadows', () => {
  const dir = join(process.env.E2E_WEB_DIST ?? 'apps/web/dist', 'assets');
  const files = readdirSync(dir).filter((f) => f.endsWith('.css'));
  expect(files.length).toBeGreaterThan(0);
  const hits = files.flatMap((f) => {
    const css = readFileSync(join(dir, f), 'utf8').toLowerCase();
    return [
      ...HEX.filter((h) => css.includes(`#${h}`)).map((h) => `${f}: #${h}`),
      ...RGB.filter((c) => new RegExp(`rgba?\\(\\s*${c.replace(/, /g, '[ ,]+')}\\b`).test(css)).map((c) => `${f}: rgb(${c})`),
      ...(/--purple/.test(css) ? [`${f}: --purple`] : []),
    ];
  });
  expect(hits).toEqual([]);
});

test('no purple and no "Quick Robot" on any menu screen at 1440 and 390', async ({ page }) => {
  test.setTimeout(180_000);
  // Rename the business: the seed name is data, the check is that no screen writes the brand from code.
  await page.goto(`${server.url}/ajustes`);
  await page.locator('input[name=b-name]').fill('Taller de prueba');
  await page.locator('input[name=b-trade]').fill('Piezas a medida');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText('Cambios guardados.').first()).toBeVisible();

  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of MENU) {
      await page.goto(`${server.url}${path}`);
      await expect(page.locator('#view')).not.toBeEmpty();
      await page.waitForLoadState('networkidle');
      const where = `${path} at ${width}`;
      await expect(page.locator('.brand b'), where).toHaveText('Taller de prueba');
      expect(await page.locator('body').innerText(), where).not.toMatch(/quick\s*robot/i);
      expect(await page.title(), where).not.toMatch(/quick\s*robot/i);
      expect(await purpleHits(page), where).toEqual([]);
      // The keyboard focus ring is neutral too.
      await page.keyboard.press('Tab');
      expect(await purpleHits(page), `${where} with focus`).toEqual([]);
    }
  }
});
