// Flow B (docs/06 §17): an order with pieces to print — Cliente aceptó → Poner en producción (filament deducted)
// → Impresoras "Terminó este trabajo" until it is ready → Entregar y cobrar → the sale exists and the order is delivered.
import { expect, test } from '@playwright/test';
import { startServer, type LocalServer } from './support/server';
import { api, createOrder, seed } from './support/order-helpers';

let server: LocalServer;
test.beforeAll(async () => { server = await startServer(); });
test.afterAll(async () => { await server.stop(); });

test('B: quoted → accepted → in production → ready from the printers → delivered with its sale', async ({ page, request }) => {
  const s = await seed(request, server.url);
  const order = await createOrder(request, server.url, s, { accepted: false, items: [{ name: 'Letrero de taquería', qty: 1 }, { name: 'Servilletero con logo', qty: 2 }], depositCents: 10000 });
  const filBefore = await api<{ items: { remainingGrams: number }[] }>(request, server.url, 'GET', '/filaments?pageSize=200');
  const gramsBefore = filBefore.items.reduce((a, f) => a + f.remainingGrams, 0);

  await page.goto(`${server.url}/pedidos/pedido?id=${order.id}`);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(s.customerName);
  await expect(page.locator('.ph .chip')).toHaveText('Cotizado');

  await page.getByTestId('next-step').click();
  await expect(page.getByRole('status')).toContainText(`Pedido #${order.number} aceptado.`);
  await expect(page.locator('.ph .chip')).toHaveText('Aceptado');

  await page.getByTestId('next-step').click();
  const dlg = page.getByRole('dialog');
  await expect(dlg.getByRole('heading', { name: `Poner en producción · Pedido #${order.number}` })).toBeVisible();
  await expect(dlg.getByText('Se propone la distribución más rápida; se puede cambiar.')).toBeVisible();
  await expect(dlg.getByTestId('printer-select')).toHaveCount(2);
  await expect(dlg.getByTestId('deduct')).toBeChecked();
  await dlg.getByRole('button', { name: 'Poner en producción' }).click();
  await expect(page.getByRole('status')).toContainText(`Pedido #${order.number} en producción. Se descontaron`);
  await expect(page.locator('.ph .chip')).toHaveText('En producción');
  const filAfter = await api<{ items: { remainingGrams: number }[] }>(request, server.url, 'GET', '/filaments?pageSize=200');
  expect(filAfter.items.reduce((a, f) => a + f.remainingGrams, 0)).toBeLessThan(gramsBefore);

  // Impresoras: finish the current job of each printer until this order becomes ready.
  await page.goto(`${server.url}/impresoras`);
  let ready = false;
  const toast = page.getByRole('status');
  for (let i = 0; i < 12 && !ready; i++) {
    await page.getByTestId('queue-finish').first().click();
    await expect(toast).toHaveText(/terminó|Trabajo terminado/);
    ready = ((await toast.textContent()) ?? '').includes(`Pedido #${order.number} listo para entregar.`);
    await expect(toast).toHaveText('', { timeout: 10_000 });
  }
  expect(ready).toBeTruthy();

  await page.goto(`${server.url}/pedidos/pedido?id=${order.id}`);
  await expect(page.locator('.ph .chip')).toHaveText('Listo');
  await page.getByTestId('next-step').click();
  await expect(dlg.getByRole('heading', { name: `Entregar pedido #${order.number}` })).toBeVisible();
  await dlg.getByRole('button', { name: 'Entregar y cobrar' }).click();
  await expect(page.getByRole('status')).toHaveText(`Pedido #${order.number} entregado. La venta se registró sola.`);
  await expect(page.locator('.ph .chip')).toHaveText('Entregado');

  const detail = await api<{ status: string; totals: { owedCents: number }; runsLogged: boolean }>(request, server.url, 'GET', `/orders/${order.id}`);
  expect(detail.status).toBe('delivered');
  expect(detail.totals.owedCents).toBe(0);
  expect(detail.runsLogged).toBe(true);
  const sales = await api<{ items: { orderId: string | null }[] }>(request, server.url, 'GET', '/sales?pageSize=200');
  expect(sales.items.some((x) => x.orderId === order.id)).toBe(true);
});
