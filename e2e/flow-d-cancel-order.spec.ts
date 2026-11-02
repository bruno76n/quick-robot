// Flow D (docs/06 §17): cancel an order with reason and refund → paid 0, owed 0, Cancelado, reserved pieces freed.
// Also: the quote document shows the business name from Ajustes, not from the code (docs/06 §14).
import { expect, test } from '@playwright/test';
import { startServer, type LocalServer } from './support/server';
import { api, createOrder, seed } from './support/order-helpers';

let server: LocalServer;
test.beforeAll(async () => { server = await startServer(); });
test.afterAll(async () => { await server.stop(); });

test('D: cancel with reason and full refund', async ({ page, request }) => {
  const s = await seed(request, server.url);
  const reservedBefore = s.products.get('Llavero con nombre')!.reserved;
  const order = await createOrder(request, server.url, s, { accepted: true, items: [{ name: 'Llavero con nombre', qty: 2, fromStock: 2 }, { name: 'Letrero de taquería', qty: 1 }], depositCents: 20000 });
  const reservedMid = (await api<{ items: { name: string; reserved: number }[] }>(request, server.url, 'GET', '/products')).items.find((p) => p.name === 'Llavero con nombre')!.reserved;
  expect(reservedMid).toBe(reservedBefore + 2);

  await page.goto(`${server.url}/pedidos/pedido?id=${order.id}&tab=datos`);
  await page.getByTestId('cancel-order').click();
  const dlg = page.getByRole('dialog');
  await expect(dlg.getByRole('heading', { name: `Cancelar pedido #${order.number}` })).toBeVisible();
  await expect(dlg.getByText('2 piezas apartadas pasan a libres en Existencias.')).toBeVisible();
  await dlg.locator('input[name=motivo]').fill('Cambió el diseño');
  await expect(dlg.locator('input[name=reembolso]')).toHaveValue('200');
  await dlg.getByRole('button', { name: 'Cancelar pedido' }).click();
  await expect(page.getByRole('status')).toHaveText(`Pedido #${order.number} cancelado.`);
  await expect(page.locator('.ph .chip')).toHaveText('Cancelado');
  await expect(page.getByText(/Motivo: Cambió el diseño\. Se reembolsaron \$200\. No cuenta como venta\./)).toBeVisible();

  const d = await api<{ status: string; totals: { paidCents: number; owedCents: number } }>(request, server.url, 'GET', `/orders/${order.id}`);
  expect(d.status).toBe('cancelled');
  expect(d.totals.paidCents).toBe(0);
  expect(d.totals.owedCents).toBe(0);
  const reservedAfter = (await api<{ items: { name: string; reserved: number }[] }>(request, server.url, 'GET', '/products')).items.find((p) => p.name === 'Llavero con nombre')!.reserved;
  expect(reservedAfter).toBe(reservedBefore);

  await page.goto(`${server.url}/pedidos?vista=lista`);
  await page.getByRole('button', { name: /^Cancelados/ }).click();
  await expect(page.getByTestId('order-row')).toContainText(`#${order.number}`);
});

test('documents: the quote shows the business data from Ajustes', async ({ page, request }) => {
  await api(request, server.url, 'PATCH', '/settings', { business: { name: 'Taller Prueba', city: 'Zapopan', quoteValidDays: 10 } });
  const list = await api<{ items: { id: string; status: string; number: number }[] }>(request, server.url, 'GET', '/orders?view=list');
  const quoted = list.items.find((o) => o.status === 'quoted')!;
  await page.goto(`${server.url}/pedidos/pedido?id=${quoted.id}`);
  await page.getByTestId('doc-open').click();
  const doc = page.getByRole('dialog').getByTestId('document');
  await expect(doc).toContainText('Taller Prueba');
  await expect(doc).toContainText('Zapopan');
  await expect(doc).toContainText('Cotización');
  await expect(doc).toContainText(`Pedido #${quoted.number}`);
  await expect(doc).toContainText('Válida hasta');
  await expect(doc).not.toContainText('Quick Robot');
});
