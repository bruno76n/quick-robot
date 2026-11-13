// Click measurement · Pedidos (mejoras/ronda-2.md §11.2): a new order with a new customer, then one order walked
// through its steps from the Tablero (accept, production, ready, deliver), a payment of an order and a job finished
// in Impresoras, at 1440 with the development seed. The orders the steps use are created through the API (setup is
// not part of the count).
import { expect, test, type Page } from '../support/test';
import { startServer, type LocalServer } from '../support/server';
import { createOrder, seed } from '../support/order-helpers';
import { BUDGET } from './budget';
import { countedPage } from './counted';

let server: LocalServer;
test.beforeAll(async () => { server = await startServer(); });
test.afterAll(async () => { await server.stop(); });
test.describe.configure({ mode: 'serial' });

const status = (page: Page) => page.locator('.toast[role=status]');
const card = (page: Page, folio: number) => page.getByTestId('order-card').filter({ hasText: `#${folio} ·` });
let folio = 0;
let paid = 0;

test('nuevo pedido con cliente nuevo (created from the customer selector)', async ({ page }) => {
  const c = await countedPage(page);
  await c.start(`${server.url}/pedidos`);
  await page.getByRole('button', { name: 'Nuevo pedido' }).first().click();
  await expect(page.getByRole('heading', { name: 'Nuevo pedido' })).toBeVisible();
  await page.locator('[data-b=cliente]').selectOption({ label: '＋ Cliente nuevo…' });
  const dlg = page.getByRole('dialog');
  await c.fill(dlg.locator('input[name=nombre]'), 'Florería Clics');
  await c.fill(dlg.locator('input[name=tel]'), '33 1234 5678');
  await dlg.getByRole('button', { name: 'Guardar cliente' }).click();
  await expect(page.locator('[data-b=cliente] option:checked')).toHaveText('Florería Clics');
  await page.getByTestId('pick-piece').filter({ hasText: 'Letrero de taquería' }).click();
  await page.locator('.res-act').getByRole('button', { name: 'Crear pedido' }).click();
  await expect(status(page)).toContainText('creado');
  await c.expectBudget(BUDGET.newOrderNewCustomer);
});

test('cliente aceptó (from the Tablero card)', async ({ page, request }) => {
  const s = await seed(request, server.url);
  folio = (await createOrder(request, server.url, s, { accepted: false, items: [{ name: 'Servilletero con logo', qty: 1 }], depositCents: 5000 })).number;
  const c = await countedPage(page);
  await c.start(`${server.url}/pedidos`);
  await card(page, folio).getByTestId('next-step').click();
  await expect(status(page)).toContainText(`Pedido #${folio} aceptado.`);
  await c.expectBudget(BUDGET.acceptOrder);
});

test('poner en producción (from the Tablero card)', async ({ page }) => {
  const c = await countedPage(page);
  await c.start(`${server.url}/pedidos`);
  await card(page, folio).getByTestId('next-step').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Poner en producción' }).click();
  await expect(status(page)).toContainText(`Pedido #${folio} en producción.`);
  await c.expectBudget(BUDGET.startProduction);
});

test('marcar listo (from the Tablero card)', async ({ page }) => {
  const c = await countedPage(page);
  await c.start(`${server.url}/pedidos`);
  await expect(card(page, folio).getByTestId('next-step')).toHaveText('Marcar listo');
  await card(page, folio).getByTestId('next-step').click();
  await expect(status(page)).toContainText(`Pedido #${folio} listo`);
  await c.expectBudget(BUDGET.markReady);
});

test('registrar pago de un pedido (card → Cobro → Registrar pago)', async ({ page }) => {
  const c = await countedPage(page);
  await c.start(`${server.url}/pedidos`);
  await card(page, folio).locator('.kc-h').click();
  await page.getByRole('tab', { name: 'Cobro' }).click();
  await page.getByRole('button', { name: 'Registrar pago' }).click();
  const dlg = page.getByRole('dialog');
  await c.fill(dlg.locator('input[name=monto]'), '50');
  await dlg.getByRole('button', { name: 'Registrar pago' }).click();
  await expect(status(page)).toContainText('Pago registrado');
  paid = 1;
  await c.expectBudget(BUDGET.orderPayment);
});

test('entregar y cobrar (from the Tablero card, the balance is proposed)', async ({ page }) => {
  expect(paid).toBe(1);
  const c = await countedPage(page);
  await c.start(`${server.url}/pedidos`);
  await card(page, folio).getByTestId('next-step').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Entregar y cobrar' }).click();
  await expect(status(page)).toHaveText(`Pedido #${folio} entregado. La venta se registró sola.`);
  await c.expectBudget(BUDGET.deliverAndCharge);
});

test('terminó este trabajo (Impresoras, first job of the queue)', async ({ page }) => {
  const c = await countedPage(page);
  await c.start(`${server.url}/impresoras`);
  await page.getByTestId('queue-finish').first().click();
  await expect(status(page)).toHaveText(/terminó|Trabajo terminado/);
  await c.expectBudget(BUDGET.finishJob);
});
