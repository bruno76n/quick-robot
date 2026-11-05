// Flow C (docs/06 §17): an accepted order that comes fully from stock → "Marcar listo" directly → Entregar y cobrar.
import { expect, test } from './support/test';
import { startServer, type LocalServer } from './support/server';
import { api, createOrder, seed } from './support/order-helpers';

let server: LocalServer;
test.beforeAll(async () => { server = await startServer(); });
test.afterAll(async () => { await server.stop(); });

test('C: accepted from stock → Marcar listo → delivered, the pieces leave stock', async ({ page, request }) => {
  const s = await seed(request, server.url);
  const before = s.products.get('Llavero con nombre')!;
  const order = await createOrder(request, server.url, s, { accepted: true, items: [{ name: 'Llavero con nombre', qty: 2, fromStock: 2 }] });

  await page.goto(`${server.url}/pedidos/pedido?id=${order.id}`);
  await expect(page.locator('.ph .chip')).toHaveText('Aceptado');
  await expect(page.getByText('2 piezas están apartadas en Existencias para este pedido: no se pueden vender a otro cliente.')).toBeVisible();
  await page.getByRole('tab', { name: 'Producción' }).click();
  await expect(page.getByText(/Todo sale de existencias: no hay nada que imprimir ni filamento que descontar\. Se puede marcar como listo\./)).toBeVisible();

  await expect(page.getByTestId('next-step')).toHaveText('Marcar listo');
  await page.getByTestId('next-step').click();
  await expect(page.getByRole('status')).toHaveText(`Pedido #${order.number} listo para entregar: todo salió de existencias.`);
  await expect(page.locator('.ph .chip')).toHaveText('Listo');

  await page.getByTestId('next-step').click();
  const dlg = page.getByRole('dialog');
  await dlg.locator('input[name=cobro]').fill('100');
  await dlg.getByRole('button', { name: 'Entregar y cobrar' }).click();
  await expect(page.getByRole('status')).toHaveText(`Pedido #${order.number} entregado. La venta se registró sola.`);
  await expect(page.locator('.ph .chip')).toHaveText('Entregado');

  const detail = await api<{ status: string; totals: { paidCents: number; owedCents: number } }>(request, server.url, 'GET', `/orders/${order.id}`);
  expect(detail.status).toBe('delivered');
  expect(detail.totals.paidCents).toBe(10000);
  const after = (await api<{ items: { name: string; physical: number }[] }>(request, server.url, 'GET', '/products')).items.find((p) => p.name === 'Llavero con nombre')!;
  expect(after.physical).toBe(before.physical - 2);
});

test('orders, an order and printers: three widths without console errors or horizontal scroll', async ({ browser, request }) => {
  const list = await api<{ items: { id: string; status: string }[] }>(request, server.url, 'GET', '/orders?view=list');
  const paths = ['/pedidos', '/pedidos?vista=lista', '/pedidos?vista=calendario', '/impresoras', ...list.items.slice(0, 4).map((o) => `/pedidos/pedido?id=${o.id}`)];
  for (const width of [1440, 820, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    for (const p of paths) {
      await page.goto(`${server.url}${p}`);
      await expect(page.locator('main h1, .ph h1').first()).toBeVisible();
      await page.waitForLoadState('networkidle');
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${p} at ${width}`).toBeLessThanOrEqual(0);
    }
    expect(errors).toEqual([]);
    await page.close();
  }
});
