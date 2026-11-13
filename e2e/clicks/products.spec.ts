// Click measurement · Productos (mejoras/ronda-2.md §11.2): each flow walked by the normal path at 1440 with the
// development seed; the count must equal its budget in ./budget.ts.
import { expect, test, type Page } from '../support/test';
import { startServer, type LocalServer } from '../support/server';
import { BUDGET } from './budget';
import { countedPage } from './counted';
import { pick, pickOpen } from '../support/picker';

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
  await expect(page.getByPlaceholder('Nombre de la pieza, por ejemplo: Llavero con nombre')).toBeFocused();
  await c.fill(page.getByPlaceholder('Nombre de la pieza, por ejemplo: Llavero con nombre'), 'Maceta clics');
  await c.fill(page.getByLabel('Horas'), '3');
  await pick(page, page.locator('.frow .pick-b').first(), 'PLA Negro');
  await expect(page.locator('.frow .unit input').first()).toBeFocused();
  await c.fill(page.locator('.frow .unit input').first(), '80');
  await page.getByRole('button', { name: 'Agregar otro filamento' }).click();
  await pickOpen(page, 'PLA Blanco');
  await c.fill(page.locator('.frow .unit input').nth(1), '20');
  await page.getByRole('button', { name: 'Agregar insumo' }).click();
  await pickOpen(page, 'Bolsa de empaque');
  await expect(page.locator('.irow .unit input').first()).toBeFocused();
  await c.fill(page.locator('.res-top input'), '250');
  await page.getByRole('button', { name: 'Guardar en el catálogo' }).click();
  await expect(status(page)).toHaveText('Guardado en el catálogo');
  await c.expectBudget(BUDGET.newPieceFull);
});

test('agregar filamento a una pieza (P1: the new row is born with its list open)', async ({ page }) => {
  const c = await countedPage(page);
  await c.start(`${server.url}/productos`);
  await tileName(page, 'Hulk · puño').click();
  await expect(page.locator('.frow .pick-b').first()).toBeVisible();
  const rows = await page.locator('.frow').count();
  await page.getByRole('button', { name: 'Agregar otro filamento' }).click();
  // The filaments already in the piece come first.
  await expect(page.getByRole('listbox').getByRole('group').first()).toHaveAccessibleName('En esta pieza');
  await pickOpen(page, 'PLA Rojo');
  await expect(page.locator('.frow .unit input').nth(rows)).toBeFocused();
  await c.fill(page.locator('.frow .unit input').nth(rows), '5');
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
  await pickOpen(page, 'Caja de regalo');
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
  await expect(page.getByPlaceholder('Nombre de la colección, por ejemplo: Colección Doomsday blanca')).toBeFocused();
  await c.fill(page.getByPlaceholder('Nombre de la colección, por ejemplo: Colección Doomsday blanca'), 'Dúo clics');
  await pick(page, page.locator('.cparte .pick-b').first(), 'Spider-Man · salto');
  await page.getByRole('button', { name: 'Agregar pieza' }).click();
  await pickOpen(page, 'Hulk · puño');
  await expect(page.locator('.cparte .unit input').nth(1)).toBeFocused();
  await page.getByRole('button', { name: 'Guardar la colección' }).click();
  await expect(status(page)).toHaveText('Colección guardada');
  await c.expectBudget(BUDGET.newCollection);
});
