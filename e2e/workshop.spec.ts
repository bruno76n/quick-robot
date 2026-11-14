// Phase 2 flows: the costs of the mockup, the calculator saves the cost it shows, supplies, printers,
// collections, spools; and every phase 2 screen in three widths without console errors.
import { expect, test, type Page } from './support/test';
import { startServer, type LocalServer } from './support/server';
import { pick, pickOpen } from './support/picker';

let server: LocalServer;
test.beforeAll(async () => { server = await startServer(); });
test.afterAll(async () => { await server.stop(); });
const status = (page: Page) => page.getByRole('status');

test('catalog shows the mockup costs; the calculator saves the cost it shows', async ({ page }) => {
  await page.goto(`${server.url}/productos`);
  const llavero = page.getByTestId('product-tile').filter({ hasText: 'Llavero con nombre' });
  await expect(llavero).toContainText('$50');
  await expect(llavero).toContainText('Costo $3.67');
  await expect(page.getByTestId('product-tile').filter({ hasText: 'Doctor Doom' })).toContainText('Costo $41.64');
  await page.getByRole('button', { name: 'Nueva pieza' }).first().click();
  await page.getByPlaceholder('Nombre de la pieza, por ejemplo: Llavero con nombre').fill('Pieza de prueba');
  await pick(page, page.locator('.frow .pkr-b').first(), 'PLA Negro');
  await page.locator('.frow .unit input').first().fill('50');
  await page.getByLabel('Horas').fill('2');
  const shown = await page.locator('.res-top .big').first().textContent();
  await page.locator('.res-top input').fill('120');
  await page.getByRole('button', { name: 'Guardar en el catálogo' }).click();
  await expect(status(page)).toHaveText('Guardado en el catálogo');
  await expect(page.getByTestId('product-tile').filter({ hasText: 'Pieza de prueba' })).toContainText(`Costo ${shown}`);
});

test('supply: create, purchase, use beyond stock is refused, delete and undo', async ({ page }) => {
  await page.goto(`${server.url}/insumos`);
  await page.getByRole('button', { name: 'Nuevo insumo' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.locator('input[name=nombre]').fill('Llavero metálico');
  await dlg.locator('input[name=costo]').fill('2');
  await dlg.locator('input[name=inicial]').fill('10');
  await dlg.getByRole('button', { name: 'Guardar' }).click();
  await expect(status(page)).toHaveText('Insumo guardado');
  const drawer = page.getByRole('complementary', { name: 'Detalle' });
  await drawer.getByRole('button', { name: 'Registrar compra' }).click();
  await dlg.locator('input[name=n]').fill('20');
  await dlg.locator('input[name=tot]').fill('30');
  await expect(dlg.getByText('Total disponible después: 30. Costo por unidad: $1.50.')).toBeVisible();
  await dlg.getByRole('button', { name: 'Registrar' }).click();
  await expect(status(page)).toHaveText('Compra registrada');
  await drawer.getByRole('button', { name: 'Usar o ajustar' }).click();
  await dlg.locator('input[name=n]').fill('31');
  await dlg.getByRole('button', { name: 'Guardar' }).click();
  await expect(status(page)).toHaveText('Solo hay 30 disponibles.');
  await dlg.getByRole('button', { name: 'Cancelar' }).click();
  await drawer.getByRole('button', { name: 'Editar' }).click();
  await dlg.getByRole('button', { name: 'Eliminar insumo' }).click();
  await dlg.getByRole('button', { name: '¿Eliminar?' }).click();
  await expect(status(page)).toContainText('Insumo eliminado');
  await status(page).getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByTestId('supply-card').filter({ hasText: 'Llavero metálico' })).toBeVisible();
});

test('printer: new one brings 3 tasks; "Hecho" with a cost', async ({ page }) => {
  await page.goto(`${server.url}/impresoras`);
  await page.getByRole('button', { name: 'Agregar impresora' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.locator('input[name=nombre]').fill('Prusa MK4');
  await dlg.locator('input[name=costo]').fill('18000');
  await dlg.getByRole('button', { name: 'Guardar' }).click();
  await expect(status(page)).toHaveText('Impresora guardada');
  const card = page.getByTestId('printer-card').filter({ hasText: 'Prusa MK4' });
  await expect(card.locator('.mt-l li')).toHaveCount(3);
  await card.getByRole('button', { name: 'Hecho' }).first().click();
  await dlg.locator('input[name=costo]').fill('150');
  await dlg.getByRole('button', { name: 'Marcar como hecha' }).click();
  await expect(status(page)).toHaveText('Mantenimiento registrado');
});

test('collection: new set with its price; spool: movement, edit and delete with undo', async ({ page }) => {
  await page.goto(`${server.url}/productos?tab=colecciones`);
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Nueva colección' }).click();
  await page.getByPlaceholder('Nombre de la colección, por ejemplo: Colección Doomsday blanca').fill('Dúo arácnido');
  await pick(page, page.locator('.cparte .pkr-b').first(), 'Spider-Man · salto');
  await page.getByRole('button', { name: 'Agregar pieza' }).click();
  await pickOpen(page, 'Spider-Man · trepando');
  await expect(page.getByText('Las piezas sueltas suman $500.')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar la colección' }).click();
  await expect(status(page)).toHaveText('Colección guardada');

  await page.goto(`${server.url}/filamentos`);
  await page.getByTestId('filament-row').filter({ hasText: 'PLA Rojo' }).click();
  const drawer = page.getByRole('complementary', { name: 'Detalle' });
  await drawer.getByRole('button', { name: 'Registrar movimiento' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.locator('input[name=g]').fill('25');
  await dlg.getByRole('button', { name: 'Registrar' }).click();
  await expect(status(page)).toHaveText('Movimiento registrado');
  await expect(page.getByTestId('filament-row').filter({ hasText: 'PLA Rojo' })).toContainText('575 g');
  await drawer.getByRole('button', { name: 'Editar' }).first().click();
  await dlg.locator('input[name=gramos]').fill('1100');
  await dlg.getByRole('button', { name: 'Guardar rollo' }).click();
  await expect(status(page)).toHaveText('Rollo guardado');
  await expect(page.getByTestId('filament-row').filter({ hasText: 'PLA Rojo' })).toContainText('675 g');
  await drawer.getByRole('button', { name: 'Editar' }).first().click();
  await dlg.getByRole('button', { name: 'Eliminar este rollo' }).click();
  await dlg.getByRole('button', { name: 'Toca de nuevo para eliminar' }).click();
  await expect(status(page)).toContainText('Rollo eliminado');
  await status(page).getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByTestId('filament-row').filter({ hasText: 'PLA Rojo' })).toContainText('675 g');
});

test('phase 2 screens in three widths: no console errors, no horizontal overflow', async ({ browser }) => {
  for (const width of [1440, 820, 390]) {
    for (const path of ['/productos', '/productos?vista=lista', '/productos?tab=colecciones', '/productos/pieza', '/productos/coleccion', '/insumos', '/impresoras', '/ajustes', '/filamentos']) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors: string[] = [];
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.goto(`${server.url}${path}`);
      await page.waitForLoadState('networkidle');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${path} @${width}`).toBe(true);
      expect(errors, `${path} @${width}`).toEqual([]);
      await page.close();
    }
  }
});
