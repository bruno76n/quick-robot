// Ronda 2 · fase D (mejoras/ronda-2.md §12): the shortcuts that the click budgets (e2e/clicks) do not cover in full:
// where Cancelar goes back to, what stays the same for a sale or order that owes nothing.
import { expect, test, type Page } from './support/test';
import { startServer, type LocalServer } from './support/server';

let server: LocalServer;
test.beforeAll(async () => { server = await startServer(); });
test.afterAll(async () => { await server.stop(); });

const saleRow = (page: Page, text: string) => page.getByTestId('sale-row').filter({ hasText: text });

test('D5: the "Debe" chip opens the payment on top of the sale; Cancelar returns to the sale, Cerrar to the list', async ({ page }) => {
  await page.goto(`${server.url}/ventas`);
  const row = saleRow(page, 'Colección completa y dos llaveros');
  await row.getByRole('button', { name: /^Debe .*: registrar abono$/ }).focus();
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
  await expect(page.getByTestId('sale-row').filter({ hasNot: page.getByRole('button', { name: /^Debe/ }) }).first()).toBeVisible();
});

test('D5: ?abono=1 on a sale that owes nothing shows the sale, not an empty payment', async ({ page }) => {
  await page.goto(`${server.url}/ventas`);
  const paid = page.getByTestId('sale-row').filter({ hasNot: page.getByRole('button', { name: /^Debe/ }) }).filter({ hasNot: page.getByText('Devuelta') }).first();
  await paid.click();
  await expect(page).toHaveURL(/\/ventas\?v=/);
  const url = new URL(page.url());
  await page.goto(`${server.url}/ventas?v=${url.searchParams.get('v')}&abono=1`);
  await expect(page.getByRole('dialog', { name: 'Registrar abono' })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toBeVisible();
});
