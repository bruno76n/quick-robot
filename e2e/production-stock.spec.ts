// Phase 3: Producción and Existencias (docs/06 §9–10, docs/04 §8). A run for stock adds pieces and deducts filament,
// undoing it gives both back; a run whose pieces were sold is locked; Ajustar with a count; enable stock for a piece.
import { expect, test, type Page } from '@playwright/test';
import { startServer, type LocalServer } from './support/server';

let server: LocalServer;
test.beforeAll(async () => { server = await startServer(); });
test.afterAll(async () => { await server.stop(); });
const status = (page: Page) => page.getByRole('status');
const card = (page: Page, name: string) => page.getByTestId('stock-card').filter({ has: page.getByText(name, { exact: true }) });
const gramsIn = (s: string) => Number((/disponible ([\d,.]+) g/.exec(s)?.[1] ?? '0').replace(/,/g, ''));

/** Opens "Registrar impresión" from the drawer of a piece and returns the first filament row text. */
async function openRegister(page: Page, piece: string) {
  await card(page, piece).click();
  const drawer = page.getByRole('complementary', { name: 'Detalle' });
  await drawer.getByRole('button', { name: 'Registrar impresión' }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg.locator('select[name=prod]')).toHaveValue(/.+/);
  await expect(dlg.locator('.frow.ro').first()).toBeVisible();
  return dlg;
}

test('print run for stock: +n in Existencias, filament goes down; undo puts both back', async ({ page }) => {
  const piece = 'Soporte de celular PETG';
  await page.goto(`${server.url}/existencias`);
  await expect(card(page, piece)).toContainText('Total 2');
  let dlg = await openRegister(page, piece);
  await expect(dlg.locator('select[name=prod] option:checked')).toHaveText(piece);
  const before = gramsIn(await dlg.locator('.frow.ro').first().innerText());
  await dlg.locator('input[name=cant]').fill('2');
  const used = Number(await dlg.locator('.frow.ro input').first().inputValue());
  expect(used).toBeGreaterThan(0);
  await dlg.getByRole('button', { name: 'Registrar impresión' }).click();
  await expect(status(page)).toContainText('Impresión registrada. Se descontaron');
  await expect(status(page)).toContainText('Se sumaron 2 piezas a Existencias.');
  await expect(card(page, piece)).toContainText('Total 4');

  await page.keyboard.press('Escape');
  dlg = await openRegister(page, piece);
  const after = gramsIn(await dlg.locator('.frow.ro').first().innerText());
  expect(after).toBeLessThan(before);
  await dlg.getByRole('button', { name: 'Cancelar' }).click();

  await page.goto(`${server.url}/produccion?motivo=stock`);
  await page.getByTestId('print-run-row').filter({ hasText: `2 × ${piece}` }).click();
  dlg = page.getByRole('dialog');
  await expect(dlg).toContainText('Sumó 2 piezas a Existencias.');
  await dlg.getByRole('button', { name: 'Eliminar registro' }).click();
  await dlg.getByRole('button', { name: 'Toca de nuevo para eliminar' }).click();
  await expect(status(page)).toContainText('Registro eliminado.');
  await expect(status(page)).toContainText('Se quitaron 2 piezas de Existencias.');

  await page.goto(`${server.url}/existencias`);
  await expect(card(page, piece)).toContainText('Total 2');
  dlg = await openRegister(page, piece);
  expect(gramsIn(await dlg.locator('.frow.ro').first().innerText())).toBeCloseTo(before, 1);
});

test('a run whose pieces were sold is locked; an order run is history', async ({ page }) => {
  await page.goto(`${server.url}/produccion`);
  await page.getByTestId('print-run-row').filter({ hasText: '10 × Llavero con nombre' }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg.getByTestId('run-locked')).toContainText('Esta impresión sumó 10 piezas a Existencias y ya no hay tantas libres');
  await expect(dlg.getByRole('button', { name: 'Eliminar registro' })).toHaveCount(0);
  await dlg.getByRole('button', { name: 'Cerrar' }).click();
  await page.getByRole('button', { name: /^Pedidos 1$/ }).click();
  await expect(page).toHaveURL(/motivo=order/);
  await page.getByTestId('print-run-row').first().click();
  await expect(page.getByRole('dialog')).toContainText('Este registro se creó solo al terminar un pedido. Se conserva como historial.');
});

test('Ajustar with a real count, and Llevar existencias de otra pieza', async ({ page }) => {
  await page.goto(`${server.url}/existencias`);
  await card(page, 'Hulk · puño').click();
  const drawer = page.getByRole('complementary', { name: 'Detalle' });
  await drawer.getByRole('button', { name: 'Ajustar' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.locator('select[name=tipo]').selectOption('count');
  await dlg.locator('input[name=n]').fill('0');
  await expect(dlg.locator('#aj-prev')).toHaveText('El conteo no puede ser menor a 1 (apartadas para pedidos).');
  await dlg.locator('input[name=n]').fill('5');
  await dlg.locator('input[name=nota]').fill('Repisa');
  await expect(dlg.locator('#aj-prev')).toHaveText('Total: de 3 a 5 piezas.');
  await dlg.getByRole('button', { name: 'Registrar' }).click();
  await expect(status(page)).toHaveText('Existencias de Hulk · puño: total 5.');
  await expect(card(page, 'Hulk · puño')).toContainText('Total 5');
  await expect(drawer.getByText('Conteo: Repisa')).toBeVisible();

  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Llevar existencias de otra pieza' }).click();
  await dlg.locator('select[name=prod]').selectOption({ label: 'Servilletero con logo' });
  await dlg.locator('input[name=n]').fill('3');
  await dlg.getByRole('button', { name: 'Llevar existencias' }).click();
  await expect(status(page)).toHaveText('Servilletero con logo ahora lleva existencias: total 3.');
  await expect(card(page, 'Servilletero con logo')).toContainText('Total 3');
  await expect(drawer.getByRole('heading', { name: 'Servilletero con logo' })).toBeVisible();
});
