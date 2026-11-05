// Phase 3 · Inicio, Reportes, Gastos, Buscar en todo and Exportar a Excel against the development seed (mockup business).
import { expect, test, type Page } from './support/test';
import { readFile } from 'node:fs/promises';
import { startServer, type LocalServer } from './support/server';

let server: LocalServer;
test.beforeAll(async () => { server = await startServer(); });
test.afterAll(async () => { await server?.stop(); });

const status = (page: Page) => page.getByRole('status');

test('Inicio shows the brief and the attentions; each button goes to its element', async ({ page }) => {
  await page.goto(`${server.url}/inicio`);
  await expect(page.getByRole('heading', { name: 'Inicio' })).toBeVisible();
  await expect(page.getByTestId('brief')).toContainText('Se vendieron $6,270 en 13 ventas en los últimos 30 días.');
  const att = page.getByTestId('attentions');
  await expect(att.locator('li')).toHaveCount(6);
  await expect(page.getByText('Y 3 avisos más.')).toBeVisible();
  await expect(att).toContainText('Pedido #5 de Tacos El Güero: faltan 535 g de PLA Negro (disponible 410 g).');

  const cases: [string, RegExp][] = [
    ['Agregar rollo', /\/filamentos\?f=/],
    ['Ver filamento', /\/filamentos\?f=/],
    ['Abrir pedido', /\/pedidos\/pedido\?id=/],
    ['Registrar abono', /\/ventas\?v=/],
    ['Ver impresoras', /\/impresoras$/],
  ];
  for (const [button, url] of cases) {
    await page.goto(`${server.url}/inicio`);
    await page.getByTestId('attentions').getByRole('link', { name: button }).first().click();
    await expect(page).toHaveURL(url);
  }
  await page.goto(`${server.url}/inicio`);
  await page.getByRole('button', { name: 'Registrar venta' }).first().click();
  await expect(page).toHaveURL(/\/armar\?modo=venta/);
});

test('Reportes: "Todo" shows the mockup totals and the period can change', async ({ page }) => {
  await page.goto(`${server.url}/reportes?periodo=todo`);
  const brief = page.getByTestId('brief');
  await expect(brief).toContainText('Se vendieron $13,170 en 25 ventas.');
  await page.getByText('Ver como tabla').click();
  await expect(page.locator('tr.tot')).toContainText('$13,170');
  await expect(page.locator('tr.tot')).toContainText('$10,575');
  await expect(page.getByText('· todo el historial')).toBeVisible();

  await page.getByRole('button', { name: '30 días' }).click();
  await expect(page).toHaveURL(/periodo=(%22)?30/);
  await expect(brief).toContainText('Se vendieron $6,270 en 13 ventas.');
  await expect(brief).toContainText('Ventas ▲ 14.6%');
  await expect(page.getByRole('heading', { name: 'Ventas por semana' })).toBeVisible();

  await page.getByRole('button', { name: '7 días' }).click();
  await expect(page.getByRole('heading', { name: 'Ventas por día' })).toBeVisible();
  await expect(page.getByTestId('chart-cols').locator('.tcol')).toHaveCount(7);
});

test('Gastos: create, edit, validation of the end date, delete and Deshacer', async ({ page }) => {
  await page.goto(`${server.url}/gastos`);
  await expect(page.getByTestId('expenses-summary')).toContainText('En los últimos 30 días hubo $2,707 en gastos.');
  const list = page.getByTestId('expense-list');
  await expect(list.locator('li')).toHaveCount(5);

  await page.getByRole('button', { name: 'Registrar gasto' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(status(page)).toHaveText('Falta el concepto del gasto.');
  await dialog.locator('input[name=concepto]').fill('Software de diseño');
  await dialog.locator('select[name=cat]').selectOption('Servicios');
  await dialog.locator('input[name=monto]').fill('250');
  await dialog.locator('input[name=fecha]').fill('2026-10-10');
  await dialog.locator('input[name=rec]').check();
  await dialog.locator('input[name=fin]').fill('2026-09-01');
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(status(page)).toHaveText('La fecha final no puede ser anterior al inicio.');
  await dialog.locator('input[name=fin]').fill('');
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(status(page)).toHaveText('Gasto guardado');
  await expect(list.locator('li')).toHaveCount(6);
  const row = list.locator('li', { hasText: 'Software de diseño' });
  await expect(row).toContainText('Cada mes desde 10 oct');
  await expect(row).toContainText('al mes');

  await row.click();
  await dialog.locator('input[name=monto]').fill('300');
  await dialog.locator('input[name=concepto]').fill('Software CAD');
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(status(page)).toHaveText('Gasto guardado');
  await expect(list.locator('li', { hasText: 'Software CAD' })).toContainText('$300');

  await list.locator('li', { hasText: 'Software CAD' }).click();
  await dialog.getByRole('button', { name: 'Eliminar gasto' }).click();
  await dialog.getByRole('button', { name: '¿Eliminar?' }).click();
  await expect(status(page)).toContainText('Gasto eliminado');
  await expect(list.locator('li')).toHaveCount(5);
  await status(page).getByRole('button', { name: 'Deshacer' }).click();
  await expect(list.locator('li', { hasText: 'Software CAD' })).toBeVisible();
  await expect(list.locator('li')).toHaveCount(6);

  await page.getByRole('button', { name: '7 días' }).click();
  await expect(page.getByTestId('expenses-period')).toContainText('Total del periodo');
});

test('Buscar en todo finds "Spider" and opens the piece; "?" shows the shortcuts', async ({ page }) => {
  await page.goto(`${server.url}/inicio`);
  await expect(page.getByRole('heading', { name: 'Inicio' })).toBeVisible();
  await page.keyboard.press('Control+k');
  const pal = page.locator('#pal');
  await expect(pal).toBeVisible();
  await expect(pal.getByRole('option', { name: /Registrar una venta/ })).toBeVisible();
  await page.keyboard.type('Spider');
  await expect(pal.getByRole('option').first()).toContainText('Spider-Man · salto');
  await page.keyboard.press('ArrowDown');
  await expect(pal.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/productos\/pieza\?id=/);
  await expect(pal).toBeHidden();

  await page.goto(`${server.url}/inicio`);
  await expect(page.getByRole('heading', { name: 'Inicio' })).toBeVisible();
  await page.keyboard.press('?');
  await expect(page.getByRole('dialog', { name: 'Atajos del teclado' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('g');
  await page.keyboard.press('r');
  await expect(page).toHaveURL(/\/reportes/);
});

test('Exportar a Excel downloads a CSV with BOM', async ({ page }) => {
  await page.goto(`${server.url}/ajustes`);
  const block = page.getByTestId('csv-export');
  const [download] = await Promise.all([page.waitForEvent('download'), block.getByRole('button', { name: /Gastos/ }).click()]);
  expect(download.suggestedFilename()).toMatch(/gastos-\d{4}-\d{2}-\d{2}\.csv$/);
  const text = await readFile((await download.path())!, 'utf8');
  expect(text.charCodeAt(0)).toBe(0xfeff);
  expect(text).toContain('Fecha,Concepto,Categoría,Monto,Se repite cada mes,Hasta');
  expect(text).toContain('Renta del espacio de trabajo');
  await expect(status(page)).toHaveText('Gastos: archivo listo para abrir en Excel.');
});
