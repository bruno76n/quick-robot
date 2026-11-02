// Phase 4 · Ajustes › Copia de seguridad (docs/06 §15, docs/12 §10, docs/15 §5): download, Vaciar negocio, restore the
// downloaded copy, import the mockup v7 backup, an invalid file and the automatic backups. One business, in order.
import { expect, test, type Page } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer, type LocalServer } from './support/server';

let server: LocalServer;
let downloaded = '';
test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => { server = await startServer(); });
test.afterAll(async () => { await server?.stop(); });

const dialog = (page: Page) => page.locator('dialog[open]').filter({ has: page.locator('.dlg-t') });
const expectIncome = async (page: Page, text: string) => {
  await page.goto(`${server.url}/reportes?periodo=todo`);
  await expect(page.getByTestId('brief')).toContainText(text);
};
const chooseFile = async (page: Page, file: string | { name: string; mimeType: string; buffer: Buffer }) => {
  await page.goto(`${server.url}/ajustes`);
  await expect(page.getByTestId('backup')).toBeVisible();
  await page.getByTestId('restore-file').setInputFiles(file);
  await expect(dialog(page).getByRole('heading', { name: 'Restaurar copia' })).toBeVisible();
};
const confirmRestore = async (page: Page) => {
  await expect(dialog(page)).toContainText('Reemplaza todos los datos actuales. Antes se guarda una copia de seguridad de lo que hay ahora.');
  await dialog(page).getByRole('button', { name: 'Restaurar' }).click();
  const summary = page.getByTestId('restore-summary');
  await expect(summary).toBeVisible({ timeout: 30_000 });
  return summary;
};

test('Descargar copia saves the whole business as JSON and the status says today', async ({ page }) => {
  await page.goto(`${server.url}/ajustes`);
  const section = page.getByTestId('backup');
  await expect(section).toContainText('Esta copia contiene todos los datos del negocio. Guárdala en un lugar seguro.');
  await expect(section.getByText('Mostrar archivo de registro')).toHaveCount(0); // desktop only
  const [download] = await Promise.all([page.waitForEvent('download'), section.getByRole('button', { name: 'Descargar copia' }).click()]);
  expect(download.suggestedFilename()).toMatch(/\.json$/);
  downloaded = join(mkdtempSync(join(tmpdir(), 'e2e-backup-')), download.suggestedFilename());
  await download.saveAs(downloaded);
  const json = JSON.parse(await readFile(downloaded, 'utf8')) as { format: string; tables: Record<string, unknown[]> };
  expect(json.format).toBe('workspace-export');
  expect(json.tables.sale?.length).toBe(25);
  await expect(page.getByRole('status')).toContainText('Copia lista.');
  await expect(section.locator('.pill')).toHaveText('Copia descargada hoy');
});

test('Vaciar negocio asks twice and leaves Ventas empty', async ({ page }) => {
  await page.goto(`${server.url}/ajustes`);
  const clear = page.getByTestId('clear');
  await clear.getByRole('button', { name: 'Vaciar negocio' }).click();
  await clear.getByRole('button', { name: 'Toca de nuevo para borrar todo' }).click();
  await expect(page.getByRole('status')).toContainText('Datos vaciados. Agregar rollos e impresoras para comenzar.');
  await page.goto(`${server.url}/ventas`);
  await expect(page.getByRole('button', { name: 'Registrar la primera venta' })).toBeVisible();
});

test('Restaurar desde archivo brings the downloaded copy back', async ({ page }) => {
  await chooseFile(page, downloaded);
  await expect(dialog(page)).toContainText('9 piezas, 4 clientes, 7 pedidos y 25 ventas.');
  const summary = await confirmRestore(page);
  await expect(summary).toContainText('Ventas: 25');
  await expect(summary).toContainText('Sin diferencias');
  await expect(summary).toContainText('Antes se guardó una copia de lo que había');
  await dialog(page).getByRole('button', { name: 'Cerrar' }).click();
  await expectIncome(page, 'Se vendieron $13,170 en 25 ventas.');
});

test('The mockup v7 backup imports with no differences', async ({ page }) => {
  await chooseFile(page, 'reference/mockup-backup-v7.json');
  await expect(dialog(page)).toContainText('mockup-backup-v7.json: 9 piezas, 4 clientes, 7 pedidos y 25 ventas.');
  const summary = await confirmRestore(page);
  await expect(summary).toContainText('Sin diferencias: los totales coinciden con la copia.');
  await expect(summary).toContainText('Clientes: 4');
  await expectIncome(page, 'Se vendieron $13,170 en 25 ventas.');
});

test('An invalid file or another version changes nothing', async ({ page }) => {
  await chooseFile(page, { name: 'notas.json', mimeType: 'application/json', buffer: Buffer.from('esto no es una copia') });
  await expect(dialog(page)).toContainText('No se pudo leer la copia. No se cambió ningún dato.');
  await expect(dialog(page).getByRole('button', { name: 'Restaurar' })).toHaveCount(0);
  await dialog(page).getByRole('button', { name: 'Cancelar' }).click();

  await chooseFile(page, { name: 'vieja.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ v: 3, productos: [] })) });
  await dialog(page).getByRole('button', { name: 'Restaurar' }).click();
  await expect(dialog(page).getByRole('alert')).toContainText('Esta copia es de una versión que esta aplicación no entiende (v3). Actualizar la aplicación e intentar de nuevo. No se cambió ningún dato.');
  await dialog(page).getByRole('button', { name: 'Cancelar' }).click();
  await expectIncome(page, 'Se vendieron $13,170 en 25 ventas.');
});

test('Copias automáticas: list, Hacer copia ahora and Restaurar', async ({ page }) => {
  await page.goto(`${server.url}/ajustes`);
  const section = page.getByTestId('backup');
  await section.getByRole('button', { name: 'Hacer copia ahora' }).click();
  await expect(page.getByRole('status')).toContainText('Copia automática guardada.');
  const items = section.locator('.auto-l li');
  await expect(items.first()).toContainText(/KB/);
  await items.first().getByRole('button', { name: 'Restaurar' }).click();
  await expect(dialog(page)).toContainText('Copia del');
  const summary = await confirmRestore(page);
  await expect(summary).toContainText('Ventas: 25');
  await expectIncome(page, 'Se vendieron $13,170 en 25 ventas.');
});
