// Flow G (ronda-4.md §6 D, docs/06 §17): add 2 spools → print choosing a spool → split a print between two → weigh → finish,
// in one run, checking the numbers after every step: grams of each spool, the filament total, Disponible and Valor del
// inventario (each spool at what it cost, docs/04 case 1.4), and the cost per gram for pieces, which only depends on the last
// purchases (case 1.1a) and never on the spool chosen. Development seed: PLA Negro = #2 eSUN 410 g at $360 with shipping,
// 4,855 g and $2,043.55 of inventory in all, purge 5 %, the average over 3 purchases.
import { expect, test, type Locator, type Page } from './support/test';
import { startServer, type LocalServer } from './support/server';

let server: LocalServer;
test.beforeAll(async () => { server = await startServer(); });
test.afterAll(async () => { await server.stop(); });

const status = (page: Page) => page.getByRole('status');
const group = (page: Page, name: string) => page.locator('section.fg').filter({ has: page.getByTestId('filament-row').filter({ hasText: name }) });
const row = (page: Page, number: number) => page.getByTestId('spool-row').filter({ has: page.locator('.rnum', { hasText: new RegExp(`^#${number}$`) }) });

/** Filamentos after a step: the strip, the PLA Negro header and the grams of each spool. */
async function expectFilaments(page: Page, o: { available: string; value: string; total: string; spools: [number, string][] }) {
  await page.goto(`${server.url}/filamentos`);
  const strip = page.locator('dl.fil-k');
  await expect(strip).toContainText(`Disponible${o.available}`);
  await expect(strip).toContainText(`Valor del inventario${o.value}`);
  const head = group(page, 'PLA Negro').getByTestId('filament-row');
  await expect(head).toContainText(o.total);
  // The cost for pieces: the last 3 purchases with cost (#2 $360, #9 and #10 $365 each), even when they are empty.
  await expect(head).toContainText('$0.363/g');
  await expect(head).toContainText('promedio de #2, #9 y #10');
  for (const [n, text] of o.spools) await expect(row(page, n)).toContainText(text);
}

/** A material test of PLA Negro with `grams`; returns the dialog and its spool section. */
async function testPrint(page: Page, grams: string): Promise<{ dlg: Locator; sec: Locator }> {
  await page.goto(`${server.url}/produccion`);
  await page.getByRole('button', { name: 'Registrar impresión' }).first().click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('radio', { name: 'Prueba de material' }).check();
  await dlg.locator('input[name=texto]').fill('Calibración');
  const label = await dlg.locator('select[name=fil] option', { hasText: 'PLA Negro' }).first().textContent();
  await dlg.locator('select[name=fil]').selectOption({ label: label! });
  await dlg.locator('input[name=gt]').fill(grams);
  return { dlg, sec: dlg.getByTestId('spool-use') };
}

test('G: add 2 spools, print choosing a spool, split between two, weigh and finish — the numbers add up at every step', async ({ page }) => {
  await page.goto(`${server.url}/filamentos`);
  await expect(page.locator('dl.fil-k')).toContainText('Disponible4.9 kg');
  await expect(page.locator('dl.fil-k')).toContainText('Valor del inventario$2,044');
  await expect(group(page, 'PLA Negro').getByTestId('filament-row')).toContainText('$0.360/g');

  // 1. Two spools of $360 with $10 of shipping for the order → #9 and #10, $365 each.
  await page.getByRole('button', { name: 'Agregar rollo' }).first().click();
  let dlg = page.getByRole('dialog');
  await dlg.locator('select[name=material]').selectOption('PLA');
  await dlg.locator('select[name=color]').selectOption('Negro');
  await dlg.locator('input[name=cantidad]').fill('2');
  await dlg.locator('input[name=costo]').fill('360');
  await dlg.locator('input[name=envio]').fill('10');
  await expect(dlg.getByTestId('cost-after')).toHaveText('$0.363/g');
  await dlg.getByRole('button', { name: 'Agregar 2 rollos' }).click();
  await expect(status(page)).toHaveText('Rollos #9 y #10 agregados a PLA Negro. Disponible: 2,410 g.');
  // 4,855 + 2,000 g · $2,043.55 + 2 × $365.
  await expectFilaments(page, { available: '6.9 kg', value: '$2,774', total: '2,410 g', spools: [[2, '410 g de 1,000 g'], [9, '1,000 g de 1,000 g'], [10, '1,000 g de 1,000 g']] });

  // 2. A 50 g test from #9 instead of the suggested #2: 52.5 g with purge, only #9 goes down; the cost is the same with any spool.
  let p = await testPrint(page, '50');
  await expect(p.sec).toContainText('50 g + 5% de purga = 52.5 g');
  await expect(p.sec.getByRole('radio').first()).toBeChecked();
  for (const n of [2, 10, 9]) {
    await p.sec.locator('li', { hasText: `#${n}` }).locator('input').check();
    await expect(p.sec).toContainText('El costo de la pieza no cambia con el rollo: $0.363/g.');
  }
  await expect(p.sec).toContainText('PLA Negro: 2,410 g → 2,357.5 g.');
  await p.dlg.getByRole('button', { name: 'Registrar impresión' }).click();
  await expect(status(page)).toContainText('Prueba registrada. Se descontaron 52.5 g.');
  // $2,773.55 − 52.5 g × $0.365.
  await expectFilaments(page, { available: '6.8 kg', value: '$2,754', total: '2,357.5 g', spools: [[2, '410 g de 1,000 g'], [9, '947.5 g de 1,000 g'], [10, '1,000 g de 1,000 g']] });

  // 3. 500 g split between #2 (all it has) and #10 (the rest): 525 g with purge.
  p = await testPrint(page, '500');
  await p.sec.getByRole('button', { name: 'Repartir entre dos rollos' }).click();
  await p.sec.locator('select[name^=rollo1-]').selectOption({ label: '#2 · eSUN · 410 g' });
  await p.sec.locator('select[name^=rollo2-]').selectOption({ label: '#10 · eSUN · 1,000 g' });
  await expect(p.sec.locator('.spk.alloc li').nth(0)).toContainText('410 g → 0 g');
  await expect(p.sec.locator('.spk.alloc li').nth(1)).toContainText('1,000 g → 885 g');
  await expect(p.sec).toContainText('El costo de la pieza no cambia con el rollo: $0.363/g.');
  await p.dlg.getByRole('button', { name: 'Registrar impresión' }).click();
  await expect(status(page)).toContainText('Prueba registrada. Se descontaron 525 g.');
  // − 410 g × $0.36 − 115 g × $0.365; #2 is empty and hidden, but still counts for the cost (it is a purchase).
  await expectFilaments(page, { available: '6.3 kg', value: '$2,565', total: '1,832.5 g', spools: [[9, '947.5 g de 1,000 g'], [10, '885 g de 1,000 g']] });
  await expect(group(page, 'PLA Negro').getByText('1 rollo vacío oculto')).toBeVisible();

  // 4. Weigh #10: 1,100 g on the scale − 248 g of the empty spool = 852 g, an adjustment of −33 g.
  await row(page, 10).click();
  const drawer = page.getByRole('complementary', { name: 'Detalle' });
  await drawer.locator('input[name=bascula]').fill('1100');
  await drawer.locator('input[name=tara]').fill('248');
  await expect(drawer.locator('.weigh-r')).toContainText('ajuste de -33 g');
  await drawer.getByRole('button', { name: 'Guardar peso' }).click();
  await expect(status(page)).toHaveText('Peso guardado: quedan 852 g (ajuste de -33 g).');
  await page.keyboard.press('Escape');
  // − 33 g × $0.365.
  await expectFilaments(page, { available: '6.2 kg', value: '$2,553', total: '1,799.5 g', spools: [[9, '947.5 g de 1,000 g'], [10, '852 g de 1,000 g']] });

  // 5. Finish #10: its 852 g go as waste; the filament keeps #9 and the same cost per gram.
  await row(page, 10).getByTestId('spool-menu').click();
  await page.getByRole('menuitem', { name: 'Terminar rollo' }).click();
  dlg = page.getByRole('dialog');
  await expect(dlg).toContainText('Lo que queda (852 g) se registra como merma y el rollo pasa a Vacío.');
  await dlg.getByRole('button', { name: 'Terminar rollo' }).click();
  await expect(status(page)).toHaveText('Rollo #10 terminado.');
  // − 852 g × $0.365.
  await expectFilaments(page, { available: '5.4 kg', value: '$2,242', total: '947.5 g', spools: [[9, '947.5 g de 1,000 g']] });
  await expect(group(page, 'PLA Negro').getByTestId('spool-row')).toHaveCount(1);
  await expect(group(page, 'PLA Negro').getByText('2 rollos vacíos ocultos')).toBeVisible();

  // The next spool is #11 even after deleting #10, the highest number (numbers are never reused, ronda 4 · D).
  await group(page, 'PLA Negro').getByText('2 rollos vacíos ocultos').click();
  await row(page, 10).click();
  await page.getByRole('complementary', { name: 'Detalle' }).getByRole('button', { name: 'Editar' }).click();
  dlg = page.getByRole('dialog');
  await dlg.getByRole('button', { name: 'Eliminar este rollo' }).click();
  await dlg.getByRole('button', { name: 'Toca de nuevo para eliminar' }).click();
  await expect(status(page)).toContainText('Rollo eliminado');
  await page.goto(`${server.url}/filamentos`);
  await page.getByRole('button', { name: 'Agregar rollo' }).first().click();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Agregar rollo #11' })).toBeVisible();
});
