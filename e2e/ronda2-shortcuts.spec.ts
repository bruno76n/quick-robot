// Ronda 2 · fase D (mejoras/ronda-2.md §12): the shortcuts that the click budgets (e2e/clicks) do not cover in full:
// where Cancelar goes back to, what stays the same for a sale or order that owes nothing.
import { expect, test, type Page } from './support/test';
import { startServer, type LocalServer } from './support/server';
import { createOrder, seed } from './support/order-helpers';

let server: LocalServer;
test.beforeAll(async () => { server = await startServer(); });
test.afterAll(async () => { await server.stop(); });

const saleRow = (page: Page, text: string) => page.getByTestId('sale-row').filter({ hasText: text });

test('D5: the "Saldo" chip opens the payment on top of the sale; Cancelar returns to the sale, Cerrar to the list', async ({ page }) => {
  await page.goto(`${server.url}/ventas`);
  const row = saleRow(page, 'Colección completa y dos llaveros');
  await row.getByRole('button', { name: /^Saldo .*: registrar abono$/ }).focus();
  await page.keyboard.press('Enter'); // keyboard works too, and the row does not open the plain sale instead
  await expect(page).toHaveURL(/\/ventas\?v=[^&]+&abono=1$/);
  const pay = page.getByRole('dialog', { name: 'Registrar abono' });
  await expect(pay.locator('input[name=monto]')).toHaveValue('500');
  await pay.getByRole('button', { name: 'Cancelar' }).click();
  const sale = page.getByRole('dialog');
  await expect(sale.getByRole('button', { name: 'Registrar abono' })).toBeVisible();
  await sale.getByRole('button', { name: 'Cerrar' }).first().click();
  await expect(page).toHaveURL(/\/ventas$/);
  // A sale paid in full has no chip; its row opens the sale as before.
  await expect(page.getByTestId('sale-row').filter({ hasNot: page.getByRole('button', { name: /^Saldo/ }) }).first()).toBeVisible();
});

test('D5: ?abono=1 on a sale that owes nothing shows the sale, not an empty payment', async ({ page }) => {
  await page.goto(`${server.url}/ventas`);
  const paid = page.getByTestId('sale-row').filter({ hasNot: page.getByRole('button', { name: /^Saldo/ }) }).filter({ hasNot: page.getByText('Devuelta') }).first();
  await paid.click();
  await expect(page).toHaveURL(/\/ventas\?v=/);
  const url = new URL(page.url());
  await page.goto(`${server.url}/ventas?v=${url.searchParams.get('v')}&abono=1`);
  await expect(page.getByRole('dialog', { name: 'Registrar abono' })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('D6: "Nuevo cliente" under the customer of a sale being edited creates it and leaves it chosen', async ({ page }) => {
  await page.goto(`${server.url}/ventas`);
  const walkIn = page.getByTestId('sale-row').filter({ hasNot: page.getByText(/Pedido #/) }).first();
  await walkIn.click();
  await page.getByRole('dialog').getByRole('button', { name: 'Editar datos' }).click();
  const edit = page.getByRole('dialog');
  const customer = edit.locator('select[name=cliente]');
  await customer.selectOption({ index: 0 }); // Sin cliente: the link shows
  await edit.getByRole('button', { name: 'Nuevo cliente' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.locator('input[name=nombre]').fill('Cliente desde editar');
  await dlg.getByRole('button', { name: 'Guardar cliente' }).click();
  await expect(page.getByRole('dialog').locator('select[name=cliente] option:checked')).toHaveText('Cliente desde editar');
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Nuevo cliente' })).toHaveCount(0);
});

test('D7: "Registrar pago" under Saldo from any tab of an active order that owes; Cobro keeps only its own', async ({ page, request }) => {
  const s = await seed(request, server.url);
  const order = await createOrder(request, server.url, s, { accepted: false, items: [{ name: 'Servilletero con logo', qty: 1 }], depositCents: 5000 });
  await page.goto(`${server.url}/pedidos/pedido?id=${order.id}`);
  const band = page.getByRole('region', { name: 'Resumen del pedido' });
  await expect(band.getByRole('button', { name: 'Registrar pago' })).toBeVisible();
  await page.getByRole('tab', { name: 'Datos' }).click();
  await expect(band.getByRole('button', { name: 'Registrar pago' })).toBeVisible();
  await page.getByRole('tab', { name: /^Cobro/ }).click();
  await expect(page.getByRole('button', { name: 'Registrar pago' })).toHaveCount(1);
  await expect(band.getByRole('button', { name: 'Registrar pago' })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Piezas' }).click();
  await band.getByRole('button', { name: 'Registrar pago' }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg.locator('input[name=monto]')).toBeFocused();
  await dlg.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByRole('tab', { name: 'Piezas', selected: true })).toBeVisible();
});

test('D9: Cancelar of a purchase opened from Compras leaves the drawer of the supply open, and does not reopen', async ({ page }) => {
  await page.goto(`${server.url}/compras`);
  await page.getByTestId('purchase-line').filter({ hasText: 'Caja de regalo' }).getByRole('button', { name: 'Registrar compra' }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg.locator('input[name=n]')).toBeFocused();
  await dlg.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page).toHaveURL(/\/insumos\?i=[^&]+$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const drawer = page.getByRole('complementary', { name: 'Detalle' });
  await expect(drawer.getByRole('heading', { name: 'Caja de regalo' })).toBeVisible();
  await drawer.getByRole('button', { name: 'Registrar compra' }).click(); // the drawer's own button still works
  await expect(page.getByRole('dialog')).toContainText('Caja de regalo');
});

test('D1: the filament picker works with the keyboard alone, with a visible focus', async ({ page }) => {
  await page.goto(`${server.url}/productos/pieza`);
  const name = page.getByPlaceholder('Nombre de la pieza, por ejemplo: Llavero con nombre');
  await expect(name).toBeFocused(); // D2
  const first = page.locator('.frow .pkr-b').first();
  await first.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(first).toBeFocused();
  expect(await first.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listbox', { name: 'Filamento' })).toBeVisible();
  await page.keyboard.type('negro');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(first).toHaveAccessibleName(/^Filamento: PLA Negro$/);
  await expect(page.locator('.frow .unit input').first()).toBeFocused();
  // Esc closes and returns the focus to the button.
  await first.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('.pkr-q')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(first).toBeFocused();
  await expect(page).toHaveURL(/\/productos\/pieza$/); // Esc did not leave the screen
});
