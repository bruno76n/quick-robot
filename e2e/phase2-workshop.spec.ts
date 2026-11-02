// Phase 2 in the browser: settings feed costs, supplies, the calculator (live preview = saved value),
// collections, spool movements and undo — against the local server with the mockup seed.
import { expect, test } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startLocalServer, stopLocalServer } from './local-server';
import type { ChildProcess } from 'node:child_process';

const PORT = 8798;
const base = `http://127.0.0.1:${PORT}`;
let server: ChildProcess;
let dir: string;

test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'app-e2e2-'));
  server = await startLocalServer({ dataDir: join(dir, 'pgdata'), port: PORT });
});
test.afterAll(async () => {
  await stopLocalServer(server);
  rmSync(dir, { recursive: true, force: true });
});

test('catalogue shows the mockup costs and prices', async ({ page }) => {
  await page.goto(`${base}/productos`);
  const tile = page.getByTestId('product-tile').filter({ hasText: 'Letrero de taquería' });
  await expect(tile).toContainText('$450');
  await expect(tile).toContainText('Costo $68.89');
  await page.getByRole('button', { name: 'Lista' }).click();
  await expect(page.getByTestId('product-row').filter({ hasText: 'Soporte de celular PETG' })).toContainText('$39.28');
});

test('calculator: live cost equals the saved cost; new piece appears in the catalogue', async ({ page }) => {
  await page.goto(`${base}/productos/pieza/nueva`);
  await page.getByPlaceholder('Nombre de la pieza, por ejemplo: Llavero con nombre').fill('Maceta geométrica');
  await page.getByRole('textbox', { name: 'Horas' }).fill('2');
  const line = page.getByTestId('filament-line').first();
  await line.getByRole('combobox').selectOption({ label: 'PLA Blanco' });
  await line.getByRole('textbox', { name: 'Gramos' }).fill('50');
  await page.getByLabel('Precio de lista').fill('180');
  const live = await page.getByTestId('calc-cost').textContent();
  await expect(page.getByText(/Ganancia de \$\d+ por pieza/)).toBeVisible();
  await page.getByRole('button', { name: 'Guardar en el catálogo' }).click();
  await expect(page.getByRole('status')).toContainText('Guardado en el catálogo');
  const tile = page.getByTestId('product-tile').filter({ hasText: 'Maceta geométrica' });
  await expect(tile).toContainText('$180');
  await expect(tile).toContainText(`Costo ${live}`);
});

test('settings: a higher kWh price raises the cost of a piece', async ({ page }) => {
  await page.goto(`${base}/productos`);
  const tile = page.getByTestId('product-tile').filter({ hasText: 'Letrero de taquería' });
  await expect(tile).toContainText('Costo $68.89');
  await page.goto(`${base}/ajustes`);
  const kwh = page.getByLabel('Luz (CFE)');
  await kwh.fill('6');
  await kwh.blur();
  await page.waitForResponse((r) => r.url().endsWith('/api/v1/settings') && r.request().method() === 'PATCH');
  await page.goto(`${base}/productos`);
  await expect(tile).not.toContainText('Costo $68.89');
  await page.goto(`${base}/ajustes`);
  await page.getByLabel('Luz (CFE)').fill('3');
  await page.getByLabel('Luz (CFE)').blur();
  await page.waitForResponse((r) => r.url().endsWith('/api/v1/settings') && r.request().method() === 'PATCH');
});

test('supplies: create with initial inventory, buy, use; delete with undo', async ({ page }) => {
  await page.goto(`${base}/insumos`);
  await page.getByRole('button', { name: 'Nuevo insumo' }).click();
  const d = page.getByRole('dialog', { name: 'Nuevo insumo' });
  await d.getByLabel('Nombre').fill('Llavero metálico');
  await d.getByLabel('Costo por unidad').fill('2');
  await d.getByLabel('Avisar cuando queden').fill('20');
  await d.getByLabel('Cantidad que hay ahora').fill('12');
  await d.getByRole('button', { name: 'Guardar' }).click();
  const drawer = page.getByRole('dialog', { name: 'Insumo' });
  await expect(drawer.getByRole('heading', { name: 'Llavero metálico' })).toBeVisible();
  await expect(drawer).toContainText('12 pza');
  await expect(drawer).toContainText('Inventario inicial');
  await drawer.getByRole('button', { name: 'Registrar compra' }).click();
  const buy = page.getByRole('dialog', { name: 'Registrar compra · Llavero metálico' });
  await buy.getByLabel('Cantidad comprada').fill('100');
  await buy.getByLabel('Total pagado').fill('150');
  await expect(buy).toContainText('Costo por unidad: $1.50');
  await buy.getByRole('button', { name: 'Registrar' }).click();
  await expect(drawer).toContainText('112 pza');
  await expect(drawer).toContainText('$1.50 por pza');
  await drawer.getByRole('button', { name: 'Usar o ajustar' }).click();
  const use = page.getByRole('dialog', { name: 'Usar o ajustar · Llavero metálico' });
  await use.getByLabel('Cantidad').fill('200');
  await use.getByRole('button', { name: 'Guardar' }).click();
  await expect(use.getByRole('alert')).toContainText('No hay tanto disponible.');
  await use.getByLabel('Cantidad').fill('12');
  await use.getByRole('button', { name: 'Guardar' }).click();
  await expect(drawer).toContainText('100 pza');
  await drawer.getByRole('button', { name: 'Editar' }).click();
  const edit = page.getByRole('dialog', { name: 'Editar insumo' });
  await edit.getByRole('button', { name: 'Eliminar insumo' }).click();
  await edit.getByRole('button', { name: 'Toca de nuevo para eliminar' }).click();
  await expect(page.getByRole('status')).toContainText('Insumo eliminado');
  await expect(page.getByTestId('supply-card').filter({ hasText: 'Llavero metálico' })).toHaveCount(0);
  await page.getByRole('status').getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByTestId('supply-card').filter({ hasText: 'Llavero metálico' })).toBeVisible();
});

test('filament: record a movement from the drawer', async ({ page }) => {
  await page.goto(`${base}/filamentos`);
  await page.getByTestId('filament-row').filter({ hasText: 'PLA Rojo' }).click();
  const drawer = page.getByRole('dialog', { name: 'Filamento' });
  await expect(drawer).toContainText('600 g');
  await drawer.getByRole('button', { name: 'Registrar movimiento' }).click();
  const mv = page.getByRole('dialog', { name: 'Movimiento · PLA Rojo' });
  await mv.getByLabel('Gramos').fill('100');
  await expect(mv).toContainText('Disponible después: 500 g de PLA Rojo.');
  await mv.getByRole('button', { name: 'Registrar' }).click();
  await expect(page.getByRole('status')).toContainText('Movimiento registrado');
  await expect(drawer.getByText('500 g', { exact: true }).first()).toBeVisible();
});

test('collection: create a set and see its price and cost', async ({ page }) => {
  await page.goto(`${base}/productos/coleccion/nueva`);
  await page.getByPlaceholder('Nombre de la colección, por ejemplo: Colección Doomsday blanca').fill('Dúo Marvel');
  await page.getByRole('combobox', { name: 'Pieza' }).first().selectOption({ label: 'Hulk · puño' });
  await page.getByRole('button', { name: 'Agregar pieza' }).click();
  await page.getByRole('combobox', { name: 'Pieza' }).nth(1).selectOption({ label: 'Doctor Doom · busto' });
  await expect(page.getByTestId('set-cost')).toHaveText('$79.46');
  await page.getByRole('button', { name: 'Guardar la colección' }).click();
  await expect(page.getByRole('status')).toContainText('Colección guardada');
  await expect(page.getByTestId('product-tile').filter({ hasText: 'Dúo Marvel' })).toContainText('$500');
});

test('printers: add a printer with base tasks; "Hecho" with a cost records the expense', async ({ page }) => {
  await page.goto(`${base}/impresoras`);
  await page.getByRole('button', { name: 'Agregar impresora' }).click();
  const d = page.getByRole('dialog', { name: 'Agregar impresora' });
  await d.getByLabel('Nombre').fill('Bambu Lab A1');
  await d.getByLabel('Costo de la impresora').fill('6000');
  await d.getByLabel('Horas impresas').fill('250');
  await expect(d).toContainText('Costo por hora: $1.80 de máquina y $0.36 de luz.');
  await d.getByRole('button', { name: 'Guardar' }).click();
  const card = page.getByTestId('printer-card').filter({ hasText: 'Bambu Lab A1' });
  await expect(card.getByTestId('maintenance-task')).toHaveCount(3);
  await card.getByTestId('maintenance-task').filter({ hasText: 'Cambiar la boquilla' }).getByRole('button', { name: 'Hecho' }).click();
  const done = page.getByRole('dialog', { name: 'Cambiar la boquilla · Bambu Lab A1' });
  await done.getByLabel('Costo de refacciones').fill('120');
  await done.getByRole('button', { name: 'Marcar como hecha' }).click();
  await expect(page.getByRole('status')).toContainText('Mantenimiento registrado y gasto anotado');
});

test('filament: edit a spool (grams) and delete it with undo', async ({ page }) => {
  await page.goto(`${base}/filamentos`);
  await page.getByTestId('filament-row').filter({ hasText: 'PLA Gris claro' }).click();
  const drawer = page.getByRole('dialog', { name: 'Filamento' });
  await drawer.getByTestId('spool-card').getByRole('button', { name: 'Editar' }).click();
  const d = page.getByRole('dialog', { name: 'Editar rollo' });
  await expect(d).toContainText('Este rollo pertenece a PLA Gris claro.');
  await d.getByLabel('Peso del filamento').fill('1100');
  await d.getByRole('button', { name: 'Guardar rollo' }).click();
  await expect(page.getByRole('status')).toContainText('Rollo guardado');
  await expect(drawer.getByTestId('spool-card')).toContainText('1,040 g');
  await drawer.getByTestId('spool-card').getByRole('button', { name: 'Editar' }).click();
  await d.getByRole('button', { name: 'Eliminar este rollo' }).click();
  await d.getByRole('button', { name: 'Toca de nuevo para eliminar' }).click();
  await expect(page.getByRole('status')).toContainText('Rollo eliminado.');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('filament-row').filter({ hasText: 'PLA Gris claro' })).toHaveCount(0);
  await page.getByRole('status').getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByTestId('filament-row').filter({ hasText: 'PLA Gris claro' })).toContainText('1,040 g');
});
