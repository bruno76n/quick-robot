// The 14 screens of the menu and the 5 detail screens load in three widths (1440, 820, 390) with the mockup
// business: no console errors, no blank screen, no horizontal scroll of the page (docs/10 §3, docs/15 §5).
import { expect, test } from '@playwright/test';
import { startServer, type LocalServer } from './support/server';

let server: LocalServer;
test.beforeAll(async () => { server = await startServer(); });
test.afterAll(async () => { await server.stop(); });

const MENU = ['/inicio', '/productos', '/ventas', '/pedidos', '/filamentos', '/insumos', '/impresoras', '/produccion', '/existencias', '/compras', '/clientes', '/gastos', '/reportes', '/ajustes'];

test('14 menu screens and 5 detail screens in three widths', async ({ page, request }) => {
  const get = async (p: string) => ((await (await request.get(`${server.url}/api/v1${p}`)).json()) as { data: Record<string, unknown> }).data;
  const order = ((await get('/orders?pageSize=1')).items as { id: string }[])[0]!.id;
  const customer = ((await get('/customers')) as unknown as { id: string }[])[0]!.id;
  const product = ((await get('/products')).items as { id: string }[])[0]!.id;
  const collection = ((await get('/collections')).items as { id: string }[])[0]!.id;
  const DETAIL = [`/productos/pieza?id=${product}`, `/productos/coleccion?id=${collection}`, `/pedidos/pedido?id=${order}`, `/clientes/cliente?id=${customer}`, '/armar?modo=venta'];
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${page.url()}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`${page.url()}: ${String(e)}`));
  for (const width of [1440, 820, 390]) {
    await page.setViewportSize({ width, height: width > 800 ? 900 : 844 });
    for (const path of [...MENU, ...DETAIL]) {
      await page.goto(`${server.url}${path}`);
      await expect(page.locator('#view')).not.toBeEmpty();
      await expect(page.getByText('Esta pantalla no se pudo mostrar.')).toHaveCount(0);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} at ${width}`).toBeLessThanOrEqual(1);
    }
  }
  expect(errors).toEqual([]);
});
