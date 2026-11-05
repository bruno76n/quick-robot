// Clientes (docs/06 §12): create, edit, duplicate name refused, a customer with history cannot be deleted,
// delete and "Deshacer"; and the sale payment and delete + "Deshacer" of Ventas (docs/06 §4.1).
import { expect, test, type Page } from './support/test';
import { startServer, type LocalServer } from './support/server';

let server: LocalServer;
test.beforeAll(async () => { server = await startServer(); });
test.afterAll(async () => { await server.stop(); });
const status = (page: Page) => page.locator('.toast[role=status]');

test('customer: create, edit, duplicate name, delete and undo', async ({ page }) => {
  await page.goto(`${server.url}/clientes`);
  await page.getByRole('button', { name: 'Nuevo cliente' }).first().click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('button', { name: 'Guardar cliente' }).click();
  await expect(dlg).toContainText('Falta el nombre del cliente.');
  await dlg.locator('input[name=nombre]').fill('Papelería Sol');
  await dlg.locator('select[name=tipo]').selectOption('Empresa');
  await dlg.locator('input[name=tel]').fill('33 9999 0000');
  await dlg.getByRole('button', { name: 'Guardar cliente' }).click();
  await expect(status(page)).toHaveText('Cliente guardado');
  await expect(page.getByRole('heading', { name: 'Papelería Sol' })).toBeVisible();
  await expect(page.getByText('Todavía no tiene pedidos ni ventas.').first()).toBeVisible();

  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await dlg.locator('input[name=tel]').fill('33 1111 2222');
  await dlg.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(status(page)).toHaveText('Cliente guardado');
  await expect(page.locator('.cli-s')).toContainText('33 1111 2222');

  await page.getByRole('link', { name: 'Clientes' }).first().click();
  await page.getByRole('button', { name: 'Nuevo cliente' }).first().click();
  await dlg.locator('input[name=nombre]').fill('tacos el güero');
  await dlg.getByRole('button', { name: 'Guardar cliente' }).click();
  await expect(status(page)).toHaveText('Ya existe un cliente llamado “Tacos El Güero”. Cambiar el nombre o editar el cliente existente.');
  await dlg.getByRole('button', { name: 'Cancelar' }).click();

  await page.getByTestId('customer-row').filter({ hasText: 'Tacos El Güero' }).click();
  await expect(page.getByText(/No se puede eliminar porque tiene \d+ pedidos? y \d+ ventas?\./)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Eliminar cliente' })).toHaveCount(0);

  await page.getByRole('link', { name: 'Clientes' }).first().click();
  await page.getByTestId('customer-row').filter({ hasText: 'Papelería Sol' }).click();
  await page.getByRole('button', { name: 'Eliminar cliente' }).click();
  await page.getByRole('button', { name: 'Toca de nuevo para eliminar' }).click();
  await expect(status(page)).toContainText('Cliente “Papelería Sol” eliminado.');
  await expect(page).toHaveURL(/\/clientes$/);
  await expect(page.getByTestId('customer-row').filter({ hasText: 'Papelería Sol' })).toHaveCount(0);
  await status(page).getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByTestId('customer-row').filter({ hasText: 'Papelería Sol' })).toBeVisible();
});

test('customer page opens the builder with the customer chosen', async ({ page }) => {
  await page.goto(`${server.url}/clientes`);
  await page.getByTestId('customer-row').filter({ hasText: 'Mariana R.' }).click();
  await page.getByRole('button', { name: 'Nuevo pedido' }).click();
  await expect(page.getByRole('heading', { name: 'Nuevo pedido' })).toBeVisible();
  await expect(page.locator('[data-b=cliente] option:checked')).toHaveText('Mariana R.');
});

test('sale: record a payment, remove it, delete the sale and undo', async ({ page }) => {
  await page.goto(`${server.url}/ventas`);
  const row = page.getByTestId('sale-row').filter({ hasText: 'Colección completa y dos llaveros' });
  await expect(row).toContainText('Debe $500');
  await row.click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('button', { name: 'Registrar abono' }).click();
  await dlg.locator('input[name=monto]').fill('200');
  await dlg.getByRole('button', { name: 'Registrar abono' }).click();
  await expect(status(page)).toHaveText('Abono registrado. Faltan $300.');
  await expect(row).toContainText('Debe $300');
  await row.click();
  await dlg.getByRole('button', { name: 'Quitar el pago de $200' }).click();
  await expect(status(page)).toHaveText('Pago quitado de la venta.');
  await expect(row).toContainText('Debe $500');
  await dlg.getByRole('button', { name: 'Eliminar venta' }).click();
  await dlg.getByRole('button', { name: 'Toca de nuevo para eliminar' }).click();
  await expect(status(page)).toContainText('Venta eliminada.');
  await expect(row).toHaveCount(0);
  await status(page).getByRole('button', { name: 'Deshacer' }).click();
  await expect(row).toHaveCount(1);
});
