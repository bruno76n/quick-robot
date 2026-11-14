// Accessibility (ronda-3 §8): axe finds no serious or critical violation on the 16 screens, the filament and spool drawers,
// the order page and the most used dialogs (ronda 4: the spool menu, Terminar rollo, splitting a print, Poner en producción), at desktop and phone width (WCAG 2.1 A and AA rules).
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './support/test';
import { startServer, type LocalServer } from './support/server';

let server: LocalServer;
test.beforeAll(async () => { server = await startServer(); });
test.afterAll(async () => { await server.stop(); });

const SCREENS = ['/inicio', '/productos', '/ventas', '/pedidos', '/filamentos', '/insumos', '/impresoras', '/produccion', '/existencias', '/compras', '/clientes', '/gastos', '/reportes', '/ajustes'];

/** Serious and critical violations of the page as it is now, one line each (rule · first targets). */
async function violations(page: Page, where: string) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return r.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${where} · ${v.id} · ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
}

async function open(page: Page, path: string) {
  await page.goto(`${server.url}${path}`);
  await expect(page.locator('#view')).not.toBeEmpty();
  await page.waitForLoadState('networkidle');
}

for (const width of [1440, 390]) {
  test(`axe: screens, details, drawer and dialogs at ${width}`, async ({ page, request }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width, height: width > 800 ? 900 : 844 });
    const get = async (p: string) => ((await (await request.get(`${server.url}/api/v1${p}`)).json()) as { data: Record<string, unknown> }).data;
    const order = ((await get('/orders?pageSize=1')).items as { id: string }[])[0]!.id;
    const customer = ((await get('/customers')) as unknown as { id: string }[])[0]!.id;
    const product = ((await get('/products')).items as { id: string }[])[0]!.id;
    const collection = ((await get('/collections')).items as { id: string }[])[0]!.id;
    const DETAIL = [`/productos/pieza?id=${product}`, `/productos/coleccion?id=${collection}`, `/pedidos/pedido?id=${order}`, `/clientes/cliente?id=${customer}`, '/armar?modo=venta'];
    const found: string[] = [];
    for (const path of [...SCREENS, ...DETAIL]) {
      await open(page, path);
      found.push(...await violations(page, path));
    }
    // Filament drawer (E2) and the dialogs used most.
    await open(page, '/filamentos');
    await page.getByTestId('filament-row').first().click();
    await expect(page.locator('.fdr')).toBeVisible();
    found.push(...await violations(page, 'filament drawer'));
    // Ronda 4: the spool drawer (Pesar, Terminar rollo), the menu of a spool and Terminar rollo's confirmation.
    await open(page, '/filamentos');
    await page.getByTestId('spool-row').first().click();
    await expect(page.locator('.sdr')).toBeVisible();
    await page.locator('input[name=bascula]').fill('900');
    found.push(...await violations(page, 'spool drawer'));
    await open(page, '/filamentos');
    if (width > 760) {
      await page.getByTestId('spool-menu').first().click();
      await expect(page.getByRole('menu')).toBeVisible();
      found.push(...await violations(page, 'spool menu'));
      await page.getByRole('menuitem', { name: 'Terminar rollo' }).click();
    } else {
      // On a phone the menu is not drawn (ronda-4 mockup): Terminar rollo is in the spool drawer.
      await page.getByTestId('spool-row').first().click();
      await page.locator('.sdr').getByRole('button', { name: 'Terminar rollo' }).click();
    }
    await expect(page.locator('dialog[open]')).toBeVisible();
    found.push(...await violations(page, 'Terminar rollo'));
    await open(page, '/filamentos');
    await page.getByRole('button', { name: 'Agregar rollo' }).first().click();
    await expect(page.locator('dialog[open]')).toBeVisible();
    found.push(...await violations(page, 'Agregar rollo'));
    await open(page, '/produccion');
    await page.getByRole('button', { name: 'Registrar impresión' }).first().click();
    await expect(page.locator('dialog[open]')).toBeVisible();
    found.push(...await violations(page, 'Registrar impresión'));
    await page.getByRole('dialog').locator('select[name=prod]').selectOption({ label: 'Hulk · puño' }); // PLA Blanco: two spools
    await page.getByRole('dialog').getByRole('button', { name: 'Repartir entre dos rollos' }).first().click();
    found.push(...await violations(page, 'Registrar impresión · repartir'));
    await open(page, '/pedidos');
    await page.getByTestId('next-step').filter({ hasText: 'Poner en producción' }).first().click();
    await expect(page.getByTestId('start-spool').first()).toBeVisible();
    found.push(...await violations(page, 'Poner en producción'));
    if (width < 1100) {
      await open(page, '/inicio');
      await page.getByRole('button', { name: 'Menú' }).click();
      found.push(...await violations(page, 'mobile menu'));
    }
    expect(found).toEqual([]);
  });
}
