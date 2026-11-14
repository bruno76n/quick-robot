// Flow F (docs/06 §17): Compras shows the calculated list, "Copiar lista" per supplier, then registering the
// supply purchase in Insumos makes it leave the list.
import { expect, test } from './support/test';
import { startServer, type LocalServer } from './support/server';

let server: LocalServer;
test.beforeAll(async () => { server = await startServer(); });
test.afterAll(async () => { await server.stop(); });

test('F: list, copy per supplier, buy the supply → it leaves the list', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: server.url });
  await page.goto(`${server.url}/compras`);
  await expect(page.getByText('4 artículos · costo estimado $1,292', { exact: true })).toBeVisible();
  const group = page.getByTestId('purchase-group').filter({ hasText: 'Empaques Guadalajara' });
  await expect(group).toContainText('Caja de regalo');
  await expect(group).toContainText('Quedan 3 pza. Aviso en 5.');
  await expect(page.getByTestId('purchase-group').filter({ hasText: 'eSUN México' })).toContainText('Pedido #5 necesita 535 g más. Disponible: 410 g.');

  await group.getByRole('button', { name: 'Copiar lista' }).click();
  const expected = 'Pedido para Empaques Guadalajara:\n\n- 7 pza · Caja de regalo';
  const shown = page.getByTestId('copy-text');
  await expect(page.getByRole('status').or(shown)).toBeVisible();
  if (await shown.isVisible()) await expect(shown).toHaveValue(expected);
  else {
    await expect(page.getByRole('status')).toHaveText('Lista copiada.');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(expected);
  }

  await group.getByTestId('purchase-line').filter({ hasText: 'Caja de regalo' }).getByRole('button', { name: 'Registrar compra' }).click();
  // Ronda 2 · D9: the purchase opens directly, with the drawer of the supply behind it.
  await expect(page).toHaveURL(/\/insumos\?i=[^&]+&compra=1$/);
  const drawer = page.getByRole('complementary', { name: 'Detalle' });
  await expect(drawer.getByRole('heading', { name: 'Caja de regalo' })).toBeVisible();
  const dlg = page.getByRole('dialog');
  await expect(dlg).toContainText('Caja de regalo');
  await dlg.locator('input[name=n]').fill('20');
  await dlg.getByRole('button', { name: 'Registrar' }).click();
  await expect(page.getByRole('status')).toHaveText('Compra registrada');
  await expect(page).toHaveURL(/\/insumos\?i=[^&]+$/);
  await expect(drawer.getByRole('heading', { name: 'Caja de regalo' })).toBeVisible();

  await page.goto(`${server.url}/compras`);
  await expect(page.getByText('3 artículos · costo estimado', { exact: false })).toBeVisible();
  await expect(page.getByTestId('purchase-line').filter({ hasText: 'Caja de regalo' })).toHaveCount(0);
  await expect(page.getByTestId('purchase-group').filter({ hasText: 'Empaques Guadalajara' })).toHaveCount(0);
});
