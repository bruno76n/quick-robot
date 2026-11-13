// Click measurement · Productos (mejoras/ronda-2.md §11.2): each flow walked by the normal path at 1440 with the
// development seed; the count must equal its budget in ./budget.ts.
import { expect, test, type Page } from '../support/test';
import { startServer, type LocalServer } from '../support/server';
import { BUDGET } from './budget';
import { countedPage } from './counted';

let server: LocalServer;
test.beforeAll(async () => { server = await startServer(); });
test.afterAll(async () => { await server.stop(); });

const status = (page: Page) => page.locator('.toast[role=status]');
const tileName = (page: Page, name: string) => page.getByTestId('product-tile').locator('.pt-n', { hasText: new RegExp(`^${name}$`) });
const tile = (page: Page, name: string) => page.getByTestId('product-tile').filter({ has: page.locator('.pt-n', { hasText: new RegExp(`^${name}$`) }) });

test('nueva pieza completa: two filaments, a supply, time and price', async ({ page }) => {
  const c = await countedPage(page);
  await c.start(`${server.url}/productos`);
  await page.getByRole('button', { name: 'Nueva pieza' }).first().click();
  await c.fill(page.getByPlaceholder('Nombre de la pieza, por ejemplo: Llavero con nombre'), 'Maceta clics');
  await c.fill(page.getByLabel('Horas'), '3');
  await page.locator('.frow select').first().selectOption({ label: 'PLA Negro' });
  await c.fill(page.locator('.frow input').first(), '80');
  await page.getByRole('button', { name: 'Agregar otro filamento' }).click();
  await page.locator('.frow select').nth(1).selectOption({ label: 'PLA Blanco' });
  await c.fill(page.locator('.frow input').nth(1), '20');
  await page.getByRole('button', { name: 'Agregar insumo' }).click();
  await page.locator('.irow select').first().selectOption({ label: 'Bolsa de empaque' });
  await c.fill(page.locator('.res-top input'), '250');
  await page.getByRole('button', { name: 'Guardar en el catálogo' }).click();
  await expect(status(page)).toHaveText('Guardado en el catálogo');
  await c.expectBudget(BUDGET.newPieceFull);
});

test('agregar filamento a una pieza (P1: the new row asks for another click to open its selector)', async ({ page }) => {
  const c = await countedPage(page);
  await c.start(`${server.url}/productos`);
  await tileName(page, 'Hulk · puño').click();
  await expect(page.locator('.frow select').first()).toBeVisible();
  const rows = await page.locator('.frow').count();
  await page.getByRole('button', { name: 'Agregar otro filamento' }).click();
  await page.locator('.frow select').nth(rows).selectOption({ label: 'PLA Rojo' });
  await c.fill(page.locator('.frow input').nth(rows), '5');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(status(page)).toHaveText('Guardado en el catálogo');
  await c.expectBudget(BUDGET.addFilamentToPiece);
});

test('agregar insumo a una pieza', async ({ page }) => {
  const c = await countedPage(page);
  await c.start(`${server.url}/productos`);
  await tileName(page, 'Doctor Doom · busto').click();
  await expect(page.getByRole('button', { name: 'Agregar insumo' })).toBeVisible();
  const rows = await page.locator('.irow').count();
  await page.getByRole('button', { name: 'Agregar insumo' }).click();
  await page.locator('.irow select').nth(rows).selectOption({ label: 'Caja de regalo' });
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(status(page)).toHaveText('Guardado en el catálogo');
  await c.expectBudget(BUDGET.addSupplyToPiece);
});

test('nueva variante from the tile', async ({ page }) => {
  const c = await countedPage(page);
  await c.start(`${server.url}/productos`);
  await tile(page, 'Servilletero con logo').getByRole('button', { name: 'Variante', exact: true }).click();
  await c.fill(page.getByLabel('Nombre de la variante'), 'Negro');
  await page.getByRole('button', { name: 'Guardar en el catálogo' }).click();
  await expect(status(page)).toHaveText('Variante guardada en el catálogo');
  await c.expectBudget(BUDGET.newVariant);
});

test('cotizar: open the piece, quote 10 and copy the message', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: server.url });
  const c = await countedPage(page);
  await c.start(`${server.url}/productos`);
  await tileName(page, 'Llavero con nombre').click();
  await page.getByRole('button', { name: 'Cotizar a cliente' }).click();
  const dlg = page.getByRole('dialog');
  await c.fill(dlg.getByLabel('Cantidad'), '10');
  await dlg.getByRole('button', { name: 'Copiar mensaje' }).click();
  await expect(status(page)).toContainText('copiado');
  await c.expectBudget(BUDGET.quote);
});

test('nueva colección with two pieces (P1 on "Agregar pieza")', async ({ page }) => {
  const c = await countedPage(page);
  await c.start(`${server.url}/productos?tab=colecciones`);
  await page.getByRole('button', { name: 'Nueva colección' }).click();
  await c.fill(page.getByPlaceholder('Nombre de la colección, por ejemplo: Colección Doomsday blanca'), 'Dúo clics');
  await page.locator('.cparte select').first().selectOption({ label: 'Spider-Man · salto' });
  await page.getByRole('button', { name: 'Agregar pieza' }).click();
  await page.locator('.cparte select').nth(1).selectOption({ label: 'Hulk · puño' });
  await page.getByRole('button', { name: 'Guardar la colección' }).click();
  await expect(status(page)).toHaveText('Colección guardada');
  await c.expectBudget(BUDGET.newCollection);
});
