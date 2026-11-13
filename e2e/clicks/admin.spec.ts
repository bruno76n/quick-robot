// Click measurement · Clientes, Gastos and Impresoras (mejoras/ronda-2.md §11.2), at 1440 with the development seed.
import { expect, test, type Page } from '../support/test';
import { startServer, type LocalServer } from '../support/server';
import { BUDGET } from './budget';
import { countedPage } from './counted';

let server: LocalServer;
test.beforeAll(async () => { server = await startServer(); });
test.afterAll(async () => { await server.stop(); });

const status = (page: Page) => page.locator('.toast[role=status]');

test('nuevo cliente with type and phone', async ({ page }) => {
  const c = await countedPage(page);
  await c.start(`${server.url}/clientes`);
  await page.getByRole('button', { name: 'Nuevo cliente' }).first().click();
  const dlg = page.getByRole('dialog');
  await c.fill(dlg.locator('input[name=nombre]'), 'Papelería Clics');
  await dlg.locator('select[name=tipo]').selectOption('Empresa');
  await c.fill(dlg.locator('input[name=tel]'), '33 9999 0000');
  await dlg.getByRole('button', { name: 'Guardar cliente' }).click();
  await expect(status(page)).toHaveText('Cliente guardado');
  await c.expectBudget(BUDGET.newCustomer);
});

test('nueva venta from a customer page (the customer comes chosen)', async ({ page }) => {
  const c = await countedPage(page);
  await c.start(`${server.url}/clientes`);
  await page.getByTestId('customer-row').filter({ hasText: 'Mariana R.' }).click();
  await page.getByRole('button', { name: 'Registrar venta' }).first().click();
  await page.getByTestId('pick-piece').filter({ hasText: 'Llavero con nombre' }).first().click();
  await page.locator('.res-act').getByRole('button', { name: 'Registrar venta' }).click();
  await expect(status(page)).toContainText('Venta registrada.');
  await c.expectBudget(BUDGET.saleFromCustomer);
});

test('registrar gasto with category, amount and date of today', async ({ page }) => {
  const c = await countedPage(page);
  await c.start(`${server.url}/gastos`);
  await page.getByRole('button', { name: 'Registrar gasto' }).click();
  const dlg = page.getByRole('dialog');
  await c.fill(dlg.locator('input[name=concepto]'), 'Lija y pegamento');
  await dlg.locator('select[name=cat]').selectOption({ index: 1 });
  await c.fill(dlg.locator('input[name=monto]'), '180');
  await dlg.getByRole('button', { name: 'Guardar' }).click();
  await expect(status(page)).toHaveText('Gasto guardado');
  await c.expectBudget(BUDGET.newExpense);
});

test('mantenimiento hecho with its cost (Impresoras)', async ({ page }) => {
  const c = await countedPage(page);
  await c.start(`${server.url}/impresoras`);
  await page.getByTestId('printer-card').first().getByRole('button', { name: 'Hecho' }).first().click();
  const dlg = page.getByRole('dialog');
  await expect(dlg.locator('input[name=costo]')).toBeFocused(); // T1: not the date, which is already today
  await c.fill(dlg.locator('input[name=costo]'), '150');
  await dlg.getByRole('button', { name: 'Marcar como hecha' }).click();
  await expect(status(page)).toHaveText('Mantenimiento registrado');
  await c.expectBudget(BUDGET.maintenanceDone);
});

test('nueva impresora (name and cost)', async ({ page }) => {
  const c = await countedPage(page);
  await c.start(`${server.url}/impresoras`);
  await page.getByRole('button', { name: 'Agregar impresora' }).click();
  const dlg = page.getByRole('dialog');
  await c.fill(dlg.locator('input[name=nombre]'), 'Prusa clics');
  await c.fill(dlg.locator('input[name=costo]'), '18000');
  await dlg.getByRole('button', { name: 'Guardar' }).click();
  await expect(status(page)).toHaveText('Impresora guardada');
  await c.expectBudget(BUDGET.newPrinter);
});
