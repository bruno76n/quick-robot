// Phase 1 "walking skeleton": add a spool in the browser → it shows in the list → it is still there
// after restarting the server on the same local PGlite file.
import { expect, test } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startLocalServer, stopLocalServer } from './local-server';

const PORT = 8799;
const url = `http://127.0.0.1:${PORT}/filamentos`;
let dataDir: string;

test.beforeAll(() => {
  dataDir = join(mkdtempSync(join(tmpdir(), 'app-e2e-')), 'pgdata');
});
test.afterAll(() => rmSync(join(dataDir, '..'), { recursive: true, force: true }));

test('add a spool, see it in the list, keep it after a restart', async ({ page }) => {
  let server = await startLocalServer({ dataDir, port: PORT });
  try {
    await page.goto(url);
    await expect(page.getByRole('heading', { name: 'Filamentos' })).toBeVisible();
    await expect(page.getByText('7 filamentos · 8 rollos · 4.9 kg disponibles · valor $2,044.')).toBeVisible();

    await page.locator('main').getByRole('button', { name: 'Agregar rollo' }).click();
    const dialog = page.getByRole('dialog', { name: 'Agregar rollo' });
    await expect(dialog.getByLabel('Material')).toBeFocused();
    // Submitting without filament shows the mockup's message
    await dialog.getByRole('button', { name: 'Agregar rollo' }).click();
    await expect(dialog.getByText('Elige el material y el color del rollo.')).toBeVisible();

    await dialog.getByLabel('Material').fill('petg');
    await dialog.getByLabel('Color', { exact: true }).fill('verde');
    await dialog.getByLabel('Marca').fill('Polymaker');
    await expect(dialog.getByText('Filamento nuevo:')).toContainText('PETG Verde');
    await dialog.getByLabel('Costo del rollo').fill('400');
    await dialog.getByLabel('Envío').fill('50');
    await expect(dialog.getByText('Costo por gramo:')).toContainText('$0.45');
    await dialog.getByRole('button', { name: 'Agregar rollo' }).click();

    await expect(page.getByRole('status')).toContainText('Rollo agregado a PETG Verde. Disponible: 1,000 g.');
    const drawer = page.getByRole('dialog', { name: 'Filamento' });
    await expect(drawer.getByRole('heading', { name: 'PETG Verde' })).toBeVisible();
    await page.keyboard.press('Escape');

    const row = page.getByTestId('filament-row').filter({ hasText: 'PETG Verde' });
    await expect(row).toContainText('1 rollo · Polymaker');
    await expect(row).toContainText('$0.45');
    await expect(row).toContainText('1,000 g');
    await expect(row).toContainText('Nuevo');
    await expect(page.getByText('8 filamentos · 9 rollos')).toBeVisible();

    // A second spool of "PLA blanco" joins the existing PLA Blanco
    await page.getByTestId('filament-row').filter({ hasText: 'PLA Blanco' }).click();
    await drawer.getByRole('button', { name: 'Agregar rollo de PLA Blanco' }).click();
    await expect(dialog.getByText('Se suma a')).toContainText('PLA Blanco');
    await dialog.getByLabel('Costo del rollo').fill('300');
    await dialog.getByRole('button', { name: 'Agregar rollo' }).click();
    await expect(drawer.getByText('3 rollos registrados')).toBeVisible();
    await expect(drawer.getByText('Los 3 rollos cuentan como un solo filamento')).toContainText('2,720 g de PLA Blanco');
  } finally {
    await stopLocalServer(server);
  }

  server = await startLocalServer({ dataDir, port: PORT });
  try {
    await page.goto(url);
    await expect(page.getByTestId('filament-row').filter({ hasText: 'PETG Verde' })).toContainText('1,000 g');
    await expect(page.getByText('8 filamentos · 10 rollos')).toBeVisible();
  } finally {
    await stopLocalServer(server);
  }
});
