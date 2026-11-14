// Flow A (docs/06 §17): Productos → Vender → builder with one piece in stock, "Cobrado ahora" = total → Registrar venta.
// The sale appears in Ventas and the piece has one free piece less in Existencias.
import { expect, test, type Page } from './support/test';
import { startServer, type LocalServer } from './support/server';

let server: LocalServer;
test.beforeAll(async () => { server = await startServer(); });
test.afterAll(async () => { await server.stop(); });
const status = (page: Page) => page.locator('.toast[role=status]');
const freeOf = (page: Page, name: string) => page.evaluate(async (n) => {
  const r = await (await fetch('/api/v1/products')).json() as { data: { items: { name: string; free: number }[] } };
  return r.data.items.find((p) => p.name === n)!.free;
}, name);

test('A. quick sale of a piece in stock', async ({ page }) => {
  await page.goto(`${server.url}/productos`);
  const before = await freeOf(page, 'Llavero con nombre');
  expect(before).toBeGreaterThan(0);
  const tile = page.getByTestId('product-tile').filter({ hasText: 'Llavero con nombre' });
  await tile.getByRole('button', { name: 'Vender', exact: true }).click();
  await expect(page).toHaveURL(/\/armar\?.*modo=venta/);
  await expect(page.getByRole('heading', { name: 'Nueva venta' })).toBeVisible();
  const line = page.getByTestId('builder-line');
  await expect(line).toHaveCount(1);
  await expect(line).toContainText('Llavero con nombre');
  await expect(line).toContainText('Existencias');
  const total = await page.locator('#b-total').inputValue();
  expect(Number(total)).toBeGreaterThan(0);
  await page.locator('[data-b=cobrado]').fill(total);
  await page.locator('[data-b=nota]').fill('Venta rápida e2e');
  await page.locator('.res-act').getByRole('button', { name: 'Registrar venta' }).click();
  await expect(status(page)).toHaveText('Venta registrada. 1 pieza salió de Existencias.');
  await expect(page).toHaveURL(/\/ventas$/);
  const row = page.getByTestId('sale-row').filter({ hasText: 'Venta rápida e2e' });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Llavero con nombre');
  await expect(row).not.toContainText('Saldo');
  expect(await freeOf(page, 'Llavero con nombre')).toBe(before - 1);
  // The sale dialog shows the breakdown and that it was charged in full.
  await row.click();
  const dlg = page.getByRole('dialog');
  await expect(dlg).toContainText('Cobrada completa al momento de la venta.');
  await expect(dlg.getByRole('button', { name: 'Nota de venta' })).toBeVisible();
});

test('A. a sale that needs more than the free pieces is refused and offers an order', async ({ page }) => {
  await page.goto(`${server.url}/productos`);
  const free = await freeOf(page, 'Llavero con nombre');
  const tile = page.getByTestId('product-tile').filter({ hasText: 'Llavero con nombre' });
  await tile.getByRole('button', { name: 'Vender', exact: true }).click();
  await page.getByTestId('builder-line').locator('[data-b=cant]').fill(String(free + 1));
  await expect(page.locator('#b-dyn')).toContainText('Existencias insuficientes.');
  await page.locator('.res-act').getByRole('button', { name: 'Registrar venta' }).click();
  await expect(status(page)).toHaveText('Existencias insuficientes. Reduce la cantidad o convierte la venta en pedido.');
  await page.locator('#b-dyn').getByRole('button', { name: 'Convertir en pedido' }).click();
  await expect(page.getByRole('heading', { name: 'Nuevo pedido' })).toBeVisible();
  await expect(page.getByTestId('builder-line')).toContainText('Por imprimir');
});
