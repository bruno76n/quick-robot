// Ronda 4 · phase C: spools in the screens (docs/mejoras/ronda-4.md §5, docs/06 §6, §9, §5.1). Add 2 spools of PLA Negro
// (consecutive numbers, shipping of the order split, the cost for pieces before → after), print choosing a spool, split a
// print between two spools, weigh a spool on the scale (the empty-spool weight is kept for its brand) and finish it;
// then start an order with a chosen spool. Development seed: PLA Negro has #2 eSUN with 410 g ($360 with shipping), purge 5 %.
import { expect, test, type Page } from './support/test';
import { startServer, type LocalServer } from './support/server';

let server: LocalServer;
test.beforeAll(async () => { server = await startServer(); });
test.afterAll(async () => { await server.stop(); });
test.describe.configure({ mode: 'serial' });

const status = (page: Page) => page.getByRole('status');
const group = (page: Page, name: string) => page.locator('section.fg').filter({ has: page.getByTestId('filament-row').filter({ hasText: name }) });
const row = (page: Page, number: number) => page.getByTestId('spool-row').filter({ has: page.locator('.rnum', { hasText: new RegExp(`^#${number}$`) }) });

/** A material test of PLA Negro with `grams`, leaving the dialog open on its spool section. */
async function testPrint(page: Page, grams: string) {
  await page.goto(`${server.url}/produccion`);
  await page.getByRole('button', { name: 'Registrar impresión' }).first().click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('radio', { name: 'Prueba de material' }).check();
  await dlg.locator('input[name=texto]').fill('Torre de temperatura');
  const label = await dlg.locator('select[name=fil] option', { hasText: 'PLA Negro' }).first().textContent();
  await dlg.locator('select[name=fil]').selectOption({ label: label! });
  await dlg.locator('input[name=gt]').fill(grams);
  return dlg;
}

test('add 2 spools: consecutive numbers, the shipping of the order split, the cost for pieces before → after', async ({ page }) => {
  await page.goto(`${server.url}/filamentos`);
  await expect(group(page, 'PLA Negro').getByTestId('spool-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'Agregar rollo' }).first().click();
  const dlg = page.getByRole('dialog');
  await dlg.locator('select[name=material]').selectOption('PLA');
  await dlg.locator('select[name=color]').selectOption('Negro');
  await expect(dlg.getByText('PLA Negro ya existe: el rollo se agrega como uno nuevo, no se suma a los que tienes.')).toBeVisible();
  await dlg.locator('input[name=cantidad]').fill('2');
  await expect(dlg.getByText('PLA Negro ya existe: los rollos se agregan como nuevos, no se suman a los que tienes.')).toBeVisible();
  await dlg.locator('input[name=costo]').fill('360');
  await dlg.locator('input[name=envio]').fill('10');
  // (360 + 365 + 365) / 3,000 g = $0.363/g; before, only #2: $0.360/g.
  await expect(dlg.locator('.prev-l li').first()).toContainText('2 rollos nuevos de PLA Negro · eSUN · 1,000 g cada uno · $360 cada uno');
  await expect(dlg.locator('.prev-l li').first().locator('.rnum')).toHaveText(['#9', '#10']);
  await expect(dlg.locator('.prev-l .old')).toHaveText('$0.360/g');
  await expect(dlg.getByTestId('cost-after')).toHaveText('$0.363/g');
  await expect(dlg.locator('.prev-l')).toContainText('promedio de #2, #9 y #10');
  await dlg.getByRole('button', { name: 'Agregar 2 rollos' }).click();
  await expect(status(page)).toHaveText('Rollos #9 y #10 agregados a PLA Negro. Disponible: 2,410 g.');
  const g = group(page, 'PLA Negro');
  await expect(g.getByTestId('spool-row')).toHaveCount(3);
  await expect(g.getByTestId('filament-row')).toContainText('$0.363/g');
  await expect(g.getByTestId('filament-row')).toContainText('promedio de #2, #9 y #10');
  await expect(row(page, 10)).toContainText('$365');
});

test('a print from the chosen spool (not the suggested one): only that spool goes down', async ({ page }) => {
  const dlg = await testPrint(page, '50');
  const sec = dlg.getByTestId('spool-use');
  await expect(sec).toContainText('50 g + 5% de purga = 52.5 g');
  const radios = sec.getByRole('radio');
  await expect(radios).toHaveCount(3);
  await expect(radios.first()).toBeChecked(); // #2, the opened one, is suggested
  await expect(sec.locator('li.on')).toContainText('Sugerido · abierto');
  await sec.locator('li', { hasText: '#9' }).locator('input').check();
  await expect(sec.locator('.after-h')).toContainText('1,000 g → 947.5 g');
  await expect(sec).toContainText('PLA Negro: 2,410 g → 2,357.5 g. El costo de la pieza no cambia con el rollo: $0.363/g.');
  await dlg.getByRole('button', { name: 'Registrar impresión' }).click();
  await expect(status(page)).toContainText('Prueba registrada. Se descontaron 52.5 g.');
  await page.goto(`${server.url}/filamentos`);
  await expect(row(page, 9)).toContainText('947.5 g de 1,000 g');
  await expect(row(page, 2)).toContainText('410 g de 1,000 g');
  await expect(row(page, 10)).toContainText('1,000 g de 1,000 g');
});

test('split between two spools: #2 gives all it has and ends, #10 continues', async ({ page }) => {
  const dlg = await testPrint(page, '500');
  const sec = dlg.getByTestId('spool-use');
  await sec.getByRole('button', { name: 'Repartir entre dos rollos' }).click();
  await sec.locator('select[name^=rollo1-]').selectOption({ label: '#2 · eSUN · 410 g' });
  await sec.locator('select[name^=rollo2-]').selectOption({ label: '#10 · eSUN · 1,000 g' });
  const alloc = sec.locator('.spk.alloc li');
  await expect(alloc).toHaveCount(2);
  await expect(alloc.nth(0)).toContainText('se termina');
  await expect(alloc.nth(0)).toContainText('410 g → 0 g');
  await expect(alloc.nth(1)).toContainText('1,000 g → 885 g');
  await expect(alloc.nth(1)).toContainText('−115 g');
  await dlg.getByRole('button', { name: 'Registrar impresión' }).click();
  await expect(status(page)).toContainText('Prueba registrada. Se descontaron 525 g.');
  await page.goto(`${server.url}/filamentos`);
  const g = group(page, 'PLA Negro');
  await expect(g.getByTestId('spool-row')).toHaveCount(2);
  await expect(g.getByText('1 rollo vacío oculto')).toBeVisible();
  await expect(row(page, 10)).toContainText('885 g de 1,000 g');
  await g.getByText('1 rollo vacío oculto').click();
  await expect(row(page, 2)).toContainText('Vacío');
});

test('weigh a spool from its drawer, then finish it with its confirmation', async ({ page }) => {
  await page.goto(`${server.url}/filamentos`);
  await row(page, 10).click();
  const drawer = page.getByRole('complementary', { name: 'Detalle' });
  await expect(drawer.getByRole('heading', { name: 'PLA Negro · eSUN' })).toBeVisible();
  await expect(drawer).toContainText('Para calcular piezas, PLA Negro usa $0.363/g (promedio de #2, #9 y #10)');
  await drawer.locator('input[name=bascula]').fill('1100');
  await drawer.locator('input[name=tara]').fill('248');
  await expect(drawer.locator('.weigh-r')).toContainText('852 g');
  await expect(drawer.locator('.weigh-r')).toContainText('ajuste de -33 g');
  await drawer.locator('input[name=bascula]').fill('1400');
  await expect(drawer.locator('.weigh-r')).toContainText('El peso no cuadra con el rollo: puede quedar de 0 a 1,050 g.');
  await expect(drawer.getByRole('button', { name: 'Guardar peso' })).toBeDisabled();
  await drawer.locator('input[name=bascula]').fill('1100');
  await drawer.getByRole('button', { name: 'Guardar peso' }).click();
  await expect(status(page)).toHaveText('Peso guardado: quedan 852 g (ajuste de -33 g).');
  await expect(row(page, 10)).toContainText('852 g de 1,000 g');
  await expect(drawer.locator('.mv')).toContainText('Ajuste');
  // The empty-spool weight is kept for eSUN and proposed for its other spools.
  await page.keyboard.press('Escape');
  await row(page, 9).click();
  await expect(drawer.locator('input[name=tara]')).toHaveValue('248');

  await page.keyboard.press('Escape');
  await row(page, 10).getByTestId('spool-menu').click();
  await page.getByRole('menuitem', { name: 'Terminar rollo' }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg).toContainText('Lo que queda (852 g) se registra como merma y el rollo pasa a Vacío.');
  await dlg.getByRole('button', { name: 'Terminar rollo' }).click();
  await expect(status(page)).toHaveText('Rollo #10 terminado.');
  await expect(group(page, 'PLA Negro').getByText('2 rollos vacíos ocultos')).toBeVisible();
  await expect(group(page, 'PLA Negro').getByTestId('spool-row')).toHaveCount(1);
});

test('start an order with a chosen spool: «Empezar con el rollo» and the split that results', async ({ page }) => {
  await page.goto(`${server.url}/pedidos`);
  await page.getByTestId('next-step').filter({ hasText: 'Poner en producción' }).first().click();
  const dlg = page.getByRole('dialog');
  const start = dlg.getByTestId('start-spool').first();
  await expect(start).toContainText('PLA Blanco');
  const select = start.locator('select');
  await expect(select.locator('option:checked')).toHaveText('#1 · Bambu Lab · 720 g');
  await select.selectOption({ label: '#8 · Sunlu · 1,000 g' });
  await expect(start.locator('.spk.alloc li')).toHaveCount(1);
  await expect(start.locator('.spk.alloc li')).toContainText('1,000 g → 960.1 g');
  await dlg.getByRole('button', { name: 'Poner en producción' }).click();
  await expect(status(page)).toContainText('en producción');
  await page.goto(`${server.url}/filamentos`);
  await expect(row(page, 8)).toContainText('960.1 g de 1,000 g');
  await expect(row(page, 1)).toContainText('720 g de 1,000 g');
});

test('a no-cost spool of a filament without any cost asks for the reference price per kilo', async ({ page }) => {
  await page.goto(`${server.url}/filamentos`);
  await page.getByRole('button', { name: 'Agregar rollo' }).first().click();
  const dlg = page.getByRole('dialog');
  await dlg.locator('select[name=material]').selectOption('ABS');
  await dlg.locator('select[name=color]').selectOption('Negro');
  await expect(dlg.locator('input[name=referencia]')).toHaveCount(0);
  await dlg.getByRole('switch', { name: 'Sin costo (regalo o incluido con la impresora)' }).check();
  await expect(dlg.locator('input[name=costo]')).toBeDisabled();
  await expect(dlg.getByText('Precio de referencia por kilo')).toBeVisible();
  await expect(dlg.getByTestId('cost-after')).toHaveText('$0.000/g');
  await dlg.getByRole('button', { name: 'Agregar rollo #11' }).click();
  await expect(status(page)).toHaveText('Falta el precio de referencia por kilo.');
  await dlg.locator('input[name=referencia]').fill('300');
  await expect(dlg.getByTestId('cost-after')).toHaveText('$0.300/g');
  await expect(dlg.locator('.prev-l')).toContainText('precio de referencia; el #11 no cuenta');
  await dlg.getByRole('button', { name: 'Agregar rollo #11' }).click();
  await expect(status(page)).toHaveText('Rollo #11 agregado a ABS Negro. Disponible: 1,000 g.');
  const g = group(page, 'ABS Negro');
  await expect(g.getByTestId('filament-row')).toContainText('$0.300/g');
  await expect(g.getByTestId('filament-row')).toContainText('precio de referencia');
  await expect(row(page, 11)).toContainText('Sin costo');
  await expect(page.locator('dl.fil-k')).toContainText('Rollos sin costo1');
});

