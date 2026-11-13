// Click measurement · Ventas (mejoras/ronda-2.md §11.2): selling from Existencias and from Productos, a sale with
// several articles, a payment of a sale and returning a sale, at 1440 with the development seed.
import { expect, test, type Page } from '../support/test';
import { startServer, type LocalServer } from '../support/server';
import { BUDGET } from './budget';
import { countedPage } from './counted';

let server: LocalServer;
test.beforeAll(async () => { server = await startServer(); });
test.afterAll(async () => { await server.stop(); });

const status = (page: Page) => page.locator('.toast[role=status]');
const stockRow = (page: Page, name: string) => page.getByTestId('stock-row').filter({ has: page.getByText(name, { exact: true }) });

test('vender una pieza de existencias: row → drawer → Vender → Registrar venta', async ({ page }) => {
  const c = await countedPage(page);
  await c.start(`${server.url}/existencias`);
  await stockRow(page, 'Llavero con nombre').click();
  await page.getByRole('complementary', { name: 'Detalle' }).getByRole('button', { name: 'Vender', exact: true }).click();
  await expect(page.getByTestId('builder-line')).toHaveCount(1);
  await page.locator('.res-act').getByRole('button', { name: 'Registrar venta' }).click();
  await expect(status(page)).toHaveText('Venta registrada. 1 pieza salió de Existencias.');
  await c.expectBudget(BUDGET.sellFromStock);
});

test('vender desde Productos: Vender on the tile → Registrar venta', async ({ page }) => {
  const c = await countedPage(page);
  await c.start(`${server.url}/productos`);
  await page.getByTestId('product-tile').filter({ hasText: 'Soporte de celular PETG' }).getByRole('button', { name: 'Vender', exact: true }).click();
  await expect(page.getByTestId('builder-line')).toHaveCount(1);
  await page.locator('.res-act').getByRole('button', { name: 'Registrar venta' }).click();
  await expect(status(page)).toHaveText('Venta registrada. 1 pieza salió de Existencias.');
  await c.expectBudget(BUDGET.sellFromProducts);
});

test('registrar venta con varios artículos, a customer and a note', async ({ page }) => {
  const c = await countedPage(page);
  await c.start(`${server.url}/ventas`);
  await page.getByRole('button', { name: 'Registrar venta' }).first().click();
  await expect(page.getByRole('heading', { name: 'Nueva venta' })).toBeVisible();
  await page.locator('[data-b=cliente]').selectOption({ label: 'Mariana R.' });
  // Three different pieces with free pieces (the seed's first three in the list that show "N libres").
  const withFree = page.getByTestId('pick-piece').filter({ hasText: /\d+ libres?/ });
  for (let i = 0; i < 3; i++) await withFree.nth(i).click();
  await expect(page.getByTestId('builder-line')).toHaveCount(3);
  await c.fill(page.locator('[data-b=nota]'), 'Venta clics');
  await page.locator('.res-act').getByRole('button', { name: 'Registrar venta' }).click();
  await expect(status(page)).toContainText('Venta registrada.');
  await c.expectBudget(BUDGET.saleSeveralItems);
});

test('registrar abono of a sale that owes', async ({ page }) => {
  const c = await countedPage(page);
  await c.start(`${server.url}/ventas`);
  await page.getByTestId('sale-row').filter({ hasText: 'Colección completa y dos llaveros' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('button', { name: 'Registrar abono' }).click();
  await c.fill(dlg.locator('input[name=monto]'), '200');
  await dlg.getByRole('button', { name: 'Registrar abono' }).click();
  await expect(status(page)).toHaveText('Abono registrado. Faltan $300.');
  await c.expectBudget(BUDGET.salePayment);
});

test('registrar abono from Inicio (attention "Registrar abono")', async ({ page }) => {
  const c = await countedPage(page);
  await c.start(`${server.url}/inicio`);
  await page.getByTestId('attentions').getByRole('link', { name: 'Registrar abono' }).first().click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('button', { name: 'Registrar abono' }).click();
  await dlg.getByRole('button', { name: 'Registrar abono' }).click();
  await expect(status(page)).toContainText('Abono registrado.');
  await c.expectBudget(BUDGET.salePaymentFromHome);
});

test('devolver una venta (confirmation stays: it moves money and stock)', async ({ page }) => {
  const c = await countedPage(page);
  await c.start(`${server.url}/ventas`);
  await page.getByTestId('sale-row').filter({ hasText: 'Venta clics' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('button', { name: 'Devolver venta' }).click();
  await dlg.getByRole('button', { name: 'Devolver venta' }).click();
  await expect(status(page)).toContainText('devuel');
  await c.expectBudget(BUDGET.returnSale);
});
