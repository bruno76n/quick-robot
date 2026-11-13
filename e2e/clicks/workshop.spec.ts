// Click measurement · Existencias, Producción, Filamentos, Insumos and Compras (mejoras/ronda-2.md §11.2), at 1440
// with the development seed.
import { expect, test, type Page } from '../support/test';
import { startServer, type LocalServer } from '../support/server';
import { BUDGET } from './budget';
import { countedPage } from './counted';

let server: LocalServer;
test.beforeAll(async () => { server = await startServer(); });
test.afterAll(async () => { await server.stop(); });

const status = (page: Page) => page.locator('.toast[role=status]');
const stockRow = (page: Page, name: string) => page.getByTestId('stock-row').filter({ has: page.getByText(name, { exact: true }) });
const drawer = (page: Page) => page.getByRole('complementary', { name: 'Detalle' });

test('registrar impresión from Existencias (choose the piece, quantity 3)', async ({ page }) => {
  const c = await countedPage(page);
  await c.start(`${server.url}/existencias`);
  await page.getByRole('button', { name: 'Registrar impresión' }).first().click();
  const dlg = page.getByRole('dialog');
  await dlg.locator('select[name=prod]').selectOption({ label: 'Hulk · puño' });
  await c.fill(dlg.locator('input[name=cant]'), '3');
  await expect(dlg.locator('.frow.ro').first()).toBeVisible();
  await dlg.getByRole('button', { name: 'Registrar impresión' }).click();
  await expect(status(page)).toContainText('Se sumaron 3 piezas a Existencias.');
  await c.expectBudget(BUDGET.printRun);
});

test('registrar impresión from the drawer of a piece (the piece comes chosen)', async ({ page }) => {
  const c = await countedPage(page);
  await c.start(`${server.url}/existencias`);
  await stockRow(page, 'Soporte de celular PETG').click();
  await drawer(page).getByRole('button', { name: 'Registrar impresión' }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg.locator('.frow.ro').first()).toBeVisible();
  await expect(dlg.locator('input[name=cant]')).toBeFocused(); // T1: the dialog focuses the marked field
  await c.fill(dlg.locator('input[name=cant]'), '2');
  await dlg.getByRole('button', { name: 'Registrar impresión' }).click();
  await expect(status(page)).toContainText('Se sumaron 2 piezas a Existencias.');
  await c.expectBudget(BUDGET.printRunFromPiece);
});

test('ajustar existencias (one damaged piece, with a note)', async ({ page }) => {
  const c = await countedPage(page);
  await c.start(`${server.url}/existencias`);
  await stockRow(page, 'Llavero con nombre').click();
  await drawer(page).getByRole('button', { name: 'Ajustar' }).click();
  const dlg = page.getByRole('dialog');
  // D8: the four reasons at sight; one tap. The focus is on the quantity (T1), already 1.
  await expect(dlg.getByRole('radiogroup', { name: 'Motivo' }).getByRole('radio')).toHaveCount(4);
  await expect(dlg.locator('input[name=n]')).toBeFocused();
  await dlg.getByRole('radio', { name: 'Dañada o defectuosa' }).check();
  await c.fill(dlg.locator('input[name=nota]'), 'Se rompió');
  await dlg.getByRole('button', { name: 'Registrar' }).click();
  await expect(status(page)).toContainText('Existencias de Llavero con nombre: total');
  await c.expectBudget(BUDGET.adjustStock);
});

test('llevar existencias a una pieza (initial count 4)', async ({ page }) => {
  const c = await countedPage(page);
  await c.start(`${server.url}/existencias`);
  await page.getByRole('button', { name: 'Llevar existencias de otra pieza' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.locator('select[name=prod]').selectOption({ label: 'Servilletero con logo' });
  await c.fill(dlg.locator('input[name=n]'), '4');
  await dlg.getByRole('button', { name: 'Llevar existencias' }).click();
  await expect(status(page)).toHaveText('Servilletero con logo ahora lleva existencias: total 4.');
  await c.expectBudget(BUDGET.enableStock);
});

test('agregar rollo of a filament that exists (from its row)', async ({ page }) => {
  const c = await countedPage(page);
  await c.start(`${server.url}/filamentos`);
  await page.getByTestId('filament-row').filter({ hasText: 'PLA Blanco' }).click();
  await drawer(page).getByRole('button', { name: 'Agregar rollo de PLA Blanco' }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg.locator('input[name=costo]')).toBeFocused(); // T1: the dialog focuses the marked field
  await c.fill(dlg.locator('input[name=costo]'), '350');
  await dlg.getByRole('button', { name: 'Agregar rollo' }).click();
  await expect(status(page)).toContainText('Rollo agregado a PLA Blanco.');
  await c.expectBudget(BUDGET.addSpoolExisting);
});

test('agregar rollo from the header (material and color to choose; the brand of its last spool is proposed)', async ({ page }) => {
  const c = await countedPage(page);
  await c.start(`${server.url}/filamentos`);
  await page.getByRole('button', { name: 'Agregar rollo' }).first().click();
  const dlg = page.getByRole('dialog');
  await dlg.locator('select[name=material]').selectOption('PLA');
  await dlg.locator('select[name=color]').selectOption('Negro');
  // D3: PLA Negro exists; its last spool is eSUN, proposed and shown in the summary (still editable).
  await expect(dlg.locator('select[name=marca]')).toHaveValue('eSUN');
  await expect(dlg.locator('summary .fb-t small')).toHaveText('eSUN');
  await c.fill(dlg.locator('input[name=costo]'), '380');
  await dlg.getByRole('button', { name: 'Agregar rollo' }).click();
  await expect(status(page)).toContainText('Rollo agregado a PLA Negro.');
  await c.expectBudget(BUDGET.addSpoolHeader);
});

test('registrar movimiento de filamento (a failure of 25 g)', async ({ page }) => {
  const c = await countedPage(page);
  await c.start(`${server.url}/filamentos`);
  await page.getByTestId('filament-row').filter({ hasText: 'PLA Rojo' }).click();
  await drawer(page).getByRole('button', { name: 'Registrar movimiento' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.locator('select[name=tipo]').selectOption({ index: 1 });
  await c.fill(dlg.locator('input[name=g]'), '25');
  await dlg.getByRole('button', { name: 'Registrar' }).click();
  await expect(status(page)).toHaveText('Movimiento registrado');
  await c.expectBudget(BUDGET.filamentMovement);
});

test('nuevo insumo with its cost, initial stock and supplier', async ({ page }) => {
  const c = await countedPage(page);
  await c.start(`${server.url}/insumos`);
  await page.getByRole('button', { name: 'Nuevo insumo' }).click();
  const dlg = page.getByRole('dialog');
  await c.fill(dlg.locator('input[name=nombre]'), 'Cadena de llavero');
  await c.fill(dlg.locator('input[name=costo]'), '3');
  await c.fill(dlg.locator('input[name=inicial]'), '50');
  await dlg.locator('select[name=prov]').selectOption({ index: 1 });
  await dlg.getByRole('button', { name: 'Guardar' }).click();
  await expect(status(page)).toHaveText('Insumo guardado');
  await c.expectBudget(BUDGET.newSupply);
});

test('registrar compra de un insumo (Insumos: card → drawer → Registrar compra)', async ({ page }) => {
  const c = await countedPage(page);
  await c.start(`${server.url}/insumos`);
  await page.getByTestId('supply-card').filter({ hasText: 'Argolla de llavero' }).click();
  await drawer(page).getByRole('button', { name: 'Registrar compra' }).click();
  const dlg = page.getByRole('dialog');
  await c.fill(dlg.locator('input[name=n]'), '100');
  await c.fill(dlg.locator('input[name=tot]'), '150');
  await dlg.getByRole('button', { name: 'Registrar' }).click();
  await expect(status(page)).toHaveText('Compra registrada');
  await c.expectBudget(BUDGET.supplyPurchase);
});

test('registrar compra from Compras (the list sends to Insumos)', async ({ page }) => {
  const c = await countedPage(page);
  await c.start(`${server.url}/compras`);
  await page.getByTestId('purchase-line').filter({ hasText: 'Caja de regalo' }).getByRole('button', { name: 'Registrar compra' }).click();
  await drawer(page).getByRole('button', { name: 'Registrar compra' }).click();
  const dlg = page.getByRole('dialog');
  await c.fill(dlg.locator('input[name=n]'), '20');
  await c.fill(dlg.locator('input[name=tot]'), '200');
  await dlg.getByRole('button', { name: 'Registrar' }).click();
  await expect(status(page)).toHaveText('Compra registrada');
  await c.expectBudget(BUDGET.supplyPurchaseFromPurchases);
});

test('usar o ajustar un insumo (use 5)', async ({ page }) => {
  const c = await countedPage(page);
  await c.start(`${server.url}/insumos`);
  await page.getByTestId('supply-card').filter({ hasText: 'Imán de base' }).click();
  await drawer(page).getByRole('button', { name: 'Usar o ajustar' }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg.locator('input[name=n]')).toBeFocused(); // T1: the dialog focuses the marked field
  await c.fill(dlg.locator('input[name=n]'), '5');
  await dlg.getByRole('button', { name: 'Guardar' }).click();
  await expect(status(page)).toContainText('Movimiento');
  await c.expectBudget(BUDGET.supplyUse);
});
