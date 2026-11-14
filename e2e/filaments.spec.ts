// Phase 1 flow: add a spool in the browser and it stays saved in the local data file after a restart.
import { expect, test } from './support/test';
import { startServer } from './support/server';

test('add spool → appears in the list → survives a restart', async ({ page }) => {
  let server = await startServer();
  try {
    await page.goto(`${server.url}/filamentos`);
    await expect(page.getByRole('heading', { name: 'Filamentos' })).toBeVisible();
    await expect(page.getByText('7 filamentos · 8 rollos', { exact: true })).toBeVisible();
    await expect(page.locator('dl.fil-k')).toContainText('Disponible4.9 kg');
    await expect(page.locator('dl.fil-k')).toContainText('Valor del inventario$2,044');

    await page.getByRole('button', { name: 'Agregar rollo' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Agregar rollo' }).click();
    await expect(page.getByRole('status')).toHaveText('Elige el material y el color del rollo.');

    await dialog.locator('select[name=material]').selectOption('PETG');
    await dialog.locator('select[name=color]').selectOption('Verde');
    await dialog.locator('select[name=marca]').selectOption('Polymaker');
    await expect(dialog.getByText('Filamento nuevo: PETG Verde. Se crea con este rollo.')).toBeVisible();
    await dialog.locator('input[name=costo]').fill('420');
    await dialog.locator('input[name=envio]').fill('30');
    await expect(dialog.getByText('Costo por gramo: $0.45.')).toBeVisible();
    await dialog.getByRole('button', { name: 'Agregar rollo' }).click();

    await expect(page.getByRole('status')).toHaveText('Rollo agregado a PETG Verde. Disponible: 1,000 g.');
    const drawer = page.getByRole('complementary', { name: 'Detalle' });
    await expect(drawer.getByRole('heading', { name: 'PETG Verde' })).toBeVisible();
    await expect(page.getByText('8 filamentos · 9 rollos', { exact: true })).toBeVisible();
    await expect(page.locator('dl.fil-k')).toContainText('Disponible5.9 kg');
    await expect(page.locator('dl.fil-k')).toContainText('Valor del inventario$2,494');

    // A second spool of PLA Blanco from its drawer joins the same filament.
    await page.keyboard.press('Escape');
    await page.getByTestId('filament-row').filter({ hasText: 'PLA Blanco' }).click();
    await drawer.getByRole('button', { name: 'Agregar rollo de PLA Blanco' }).click();
    await expect(dialog.getByText(/Se suma a PLA Blanco: hay 1,720 g en 2 rollos/)).toBeVisible();
    await dialog.locator('input[name=costo]').fill('350');
    await dialog.getByRole('button', { name: 'Agregar rollo' }).click();
    await expect(page.getByRole('status')).toHaveText('Rollo agregado a PLA Blanco. Disponible: 2,720 g.');
    await expect(drawer.getByText('3 rollos registrados')).toBeVisible();

    await server.stop();
    server = await startServer({ dataDir: server.dataDir });
    await page.goto(`${server.url}/filamentos`);
    await expect(page.getByText('8 filamentos · 10 rollos', { exact: true })).toBeVisible();
    await expect(page.locator('dl.fil-k')).toContainText('Disponible6.9 kg');
    await expect(page.getByTestId('filament-row').filter({ hasText: 'PETG Verde' })).toContainText('1 rollo · Polymaker');
  } finally {
    await server.stop();
  }
});

test('three widths load without console errors', async ({ browser }) => {
  const server = await startServer();
  try {
    for (const width of [1440, 820, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors: string[] = [];
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.goto(`${server.url}/filamentos`);
      await expect(page.getByTestId('filament-row')).toHaveCount(7);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect(errors).toEqual([]);
      await page.close();
    }
  } finally {
    await server.stop();
  }
});
