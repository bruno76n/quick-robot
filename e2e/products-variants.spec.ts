// Productos by families (mejoras/ronda-2.md §3, §10): the variants panel, the list rows, search and counters,
// and the one new-variant flow, at 1440 and 390.
import { expect, test, type Page } from './support/test';
import { startServer, type LocalServer } from './support/server';

let server: LocalServer;
test.beforeAll(async () => { server = await startServer(); await addVariant(server.url, 'Llavero con nombre', 'Azul'); });
test.afterAll(async () => { await server.stop(); });

const tile = (page: Page, name: string) => page.getByTestId('product-tile').filter({ has: page.locator('.pt-n', { hasText: new RegExp(`^${name}$`) }) });
const panel = (page: Page) => page.getByTestId('variants-panel');

/** A second family with a variant, made through the API like the calculator does (a copy of the original). */
async function addVariant(base: string, originalName: string, label: string) {
  const json = async (r: Response) => { if (!r.ok) throw new Error(`${r.url} ${r.status}`); return (await r.json()).data; };
  const opts = (await json(await fetch(`${base}/api/v1/products/options`))).items as { id: string; name: string }[];
  const id = opts.find((p) => p.name === originalName)!.id;
  const d = await json(await fetch(`${base}/api/v1/products/${id}`));
  const body = { name: d.name, tags: d.tags, mode: d.mode, priceCents: d.priceCents, marginPct: d.marginPct, printerId: d.printerId, hours: d.hours, batchSize: d.batchSize, extrasCents: d.extrasCents, tracksStock: d.tracksStock, filaments: d.filaments, supplies: d.supplies, spec: d.spec, note: d.note, variantLabel: label };
  await json(await fetch(`${base}/api/v1/products/${id}/variant`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
}

for (const width of [1440, 390]) {
  test(`fichas at ${width}: the variants panel opens and closes, one at a time`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${server.url}/productos`);
    const salto = tile(page, 'Spider-Man · salto');
    const llavero = tile(page, 'Llavero con nombre');
    await expect(panel(page)).toHaveCount(0);
    const toggleSalto = salto.getByTestId('variants-toggle');
    await expect(toggleSalto).toHaveText(/1 variante/);
    await expect(toggleSalto).toHaveAttribute('aria-expanded', 'false');
    await toggleSalto.click();
    await expect(toggleSalto).toHaveAttribute('aria-expanded', 'true');
    await expect(panel(page)).toHaveCount(1);
    await expect(panel(page)).toContainText('Variantes de Spider-Man · salto');
    const rows = panel(page).getByTestId('variant-row');
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText('Original');
    await expect(rows.first()).toContainText('PLA Blanco');
    await expect(rows.nth(1)).toContainText('silk morado');
    await expect(page).toHaveURL(/\/productos$/);
    // Opening another family closes the first one.
    await llavero.getByTestId('variants-toggle').click();
    await expect(panel(page)).toHaveCount(1);
    await expect(panel(page)).toContainText('Variantes de Llavero con nombre');
    await expect(toggleSalto).toHaveAttribute('aria-expanded', 'false');
    await llavero.getByTestId('variants-toggle').click();
    await expect(panel(page)).toHaveCount(0);
    // Editar opens that member in the calculator.
    await toggleSalto.click();
    await panel(page).getByTestId('variant-row').nth(1).getByRole('button', { name: 'Editar' }).click();
    await expect(page).toHaveURL(/\/productos\/pieza\?id=/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
}

for (const width of [1440, 390]) {
  test(`lista at ${width}: the arrow unfolds the variant rows and "+ Agregar variante de …"`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${server.url}/productos?vista=lista`);
    const salto = page.getByTestId('family-row').filter({ hasText: 'Spider-Man · salto' });
    await expect(page.getByTestId('family-row').filter({ hasText: 'Doctor Doom' }).getByTestId('variants-arrow')).toHaveCount(0);
    await expect(salto).toContainText('1 variante');
    const arrow = salto.getByTestId('variants-arrow');
    await expect(arrow).toHaveAttribute('aria-label', 'Ver variantes');
    await expect(page.getByTestId('variant-list-row')).toHaveCount(0);
    await arrow.click();
    await expect(arrow).toHaveAttribute('aria-expanded', 'true');
    await expect(arrow).toHaveAttribute('aria-label', 'Ocultar variantes');
    const rows = page.getByTestId('variant-list-row');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('silk morado');
    await expect(rows.first()).not.toContainText('Original');
    await expect(page.getByRole('button', { name: 'Agregar variante de Spider-Man · salto' })).toBeVisible();
    if (width === 390) expect(await page.locator('table.fam thead').isVisible()).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await arrow.click();
    await expect(rows).toHaveCount(0);
  });
}

test('search by a variant label opens its family; "Piezas N" and the chips count families', async ({ page }) => {
  await page.goto(`${server.url}/productos`);
  // 8 originals and 2 variants (the seed's and the one made here): families, not pieces.
  await expect(page.getByTestId('pieces-count')).toHaveText('8');
  await expect(page.getByTestId('product-tile')).toHaveCount(8);
  await expect(page.getByRole('button', { name: 'Con variantes 2' })).toBeVisible();
  await page.getByRole('button', { name: 'Con variantes 2' }).click();
  await expect(page).toHaveURL(/filtro=con-variantes/);
  await expect(page.getByTestId('product-tile')).toHaveCount(2);
  await page.getByRole('button', { name: /^Todas/ }).click();
  await page.getByPlaceholder('Buscar pieza').fill('silk');
  await expect(page.getByTestId('product-tile')).toHaveCount(1);
  await expect(page.getByTestId('pieces-count')).toHaveText('1');
  await expect(panel(page)).toContainText('Variantes de Spider-Man · salto');
  await expect(tile(page, 'Spider-Man · salto').getByTestId('variants-toggle')).toHaveAttribute('aria-expanded', 'true');
  // A text that matches the original does not open the panel.
  await page.getByPlaceholder('Buscar pieza').fill('trepando');
  await expect(page.getByTestId('product-tile')).toHaveCount(1);
  await expect(panel(page)).toHaveCount(0);
});

test('a new variant from Productos: the calculator copy, its panel, the sale picker; edit shows its original', async ({ page }) => {
  await page.goto(`${server.url}/productos`);
  const salto = tile(page, 'Spider-Man · salto');
  await salto.getByTestId('variants-toggle').click();
  await panel(page).getByRole('button', { name: 'Nueva variante' }).click();
  await expect(page).toHaveURL(/\/productos\/pieza\?variante=/);
  await expect(page.getByRole('heading', { name: 'Nueva variante de Spider-Man · salto' })).toBeVisible();
  const label = page.getByLabel('Nombre de la variante');
  await expect(label).toBeFocused();
  await expect(label).toHaveValue('');
  await expect(page.locator('.frow select').first()).toHaveValue(/.+/);
  // Saving without a label keeps the form and the focus on the field.
  await page.getByRole('button', { name: 'Guardar en el catálogo' }).click();
  await expect(page).toHaveURL(/\/productos\/pieza/);
  await expect(label).toBeFocused();
  await label.fill('Negro mate');
  await page.locator('.frow select').first().selectOption({ label: 'PLA Negro' });
  await page.getByRole('button', { name: 'Guardar en el catálogo' }).click();
  await expect(page.getByRole('status')).toHaveText('Variante guardada en el catálogo');
  await expect(page).toHaveURL(/\/productos\?abierta=/);
  await expect(panel(page)).toContainText('Variantes de Spider-Man · salto');
  await expect(panel(page).getByTestId('variant-row')).toHaveCount(3);
  const row = panel(page).getByTestId('variant-row').filter({ hasText: 'Negro mate' });
  await expect(row).toContainText('PLA Negro');
  await expect(tile(page, 'Spider-Man · salto').getByTestId('variants-toggle')).toHaveText(/2 variantes/);
  await expect(page.getByTestId('pieces-count')).toHaveText('8');
  // Editar shows its original and its label; the old "(variante)" name is gone.
  await row.getByRole('button', { name: 'Editar' }).click();
  await expect(page.getByTestId('variant-of')).toHaveText('Variante de Spider-Man · salto');
  await expect(page.getByLabel('Nombre de la variante')).toHaveValue('Negro mate');
  await expect(page.locator('body')).not.toContainText('(variante)');
  // The sale picker lists it flat with its displayName, after its original.
  await page.goto(`${server.url}/armar?modo=venta`);
  await page.locator('[data-b=q]').fill('salto');
  await expect(page.getByTestId('pick-piece').locator('b')).toHaveText(['Spider-Man · salto', 'Spider-Man · salto · silk morado', 'Spider-Man · salto · Negro mate']);
});

test('sell a variant from its panel row', async ({ page }) => {
  await page.goto(`${server.url}/productos`);
  await tile(page, 'Spider-Man · salto').getByTestId('variants-toggle').click();
  await panel(page).getByTestId('variant-row').filter({ hasText: 'silk morado' }).getByRole('button', { name: 'Vender' }).click();
  await expect(page).toHaveURL(/\/armar\?.*modo=venta/);
  const line = page.getByTestId('builder-line');
  await expect(line).toHaveCount(1);
  await expect(line).toContainText('Spider-Man · salto · silk morado');
  await page.locator('[data-b=cobrado]').fill(await page.locator('#b-total').inputValue());
  await page.locator('[data-b=nota]').fill('Variante e2e');
  await page.locator('.res-act').getByRole('button', { name: 'Registrar venta' }).click();
  await expect(page.locator('.toast')).toHaveText('Venta registrada. 1 pieza salió de Existencias.');
  await expect(page.getByTestId('sale-row').filter({ hasText: 'Variante e2e' })).toContainText('Spider-Man · salto · silk morado');
});

test('390: "+ Variante" of a list row and "Guardar como variante nueva" open the same flow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(`${server.url}/productos?vista=lista`);
  await page.getByTestId('family-row').filter({ hasText: 'Doctor Doom' }).getByRole('button', { name: 'Variante' }).click();
  await expect(page.getByRole('heading', { name: 'Nueva variante de Doctor Doom · busto' })).toBeVisible();
  await expect(page.getByLabel('Nombre de la variante')).toBeFocused();
  await page.goto(`${server.url}/productos?vista=lista`);
  await page.getByTestId('family-row').filter({ hasText: 'Hulk' }).click();
  await page.getByRole('button', { name: 'Guardar como variante nueva' }).click();
  await expect(page.getByRole('heading', { name: 'Nueva variante de Hulk · puño' })).toBeVisible();
  await expect(page.getByLabel('Nombre de la variante')).toBeFocused();
  await page.getByLabel('Nombre de la variante').fill('Verde');
  await page.getByRole('button', { name: 'Guardar en el catálogo' }).click();
  await expect(page.getByRole('status')).toHaveText('Variante guardada en el catálogo');
  await expect(page).toHaveURL(/\/productos\?abierta=/);
  await expect(panel(page)).toContainText('Variantes de Hulk · puño');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});
