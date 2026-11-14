// Ronda 2 end to end (mejoras/ronda-2.md §10), at 1440 and 390: a variant created from Productos is seen in its
// panel, in Existencias as part of its family (the family row is the sum of its members), in the sale picker with
// its full name, and is sold. The pieces of each step are covered in detail by products-variants, stock-families
// and home-attention; this spec checks that they are tied together.
import { expect, test, type Page } from './support/test';
import { startServer, type LocalServer } from './support/server';

let server: LocalServer;
test.beforeAll(async () => { server = await startServer(); });
test.afterAll(async () => { await server.stop(); });

const status = (page: Page) => page.locator('.toast[role=status]');
const tile = (page: Page, name: string) => page.getByTestId('product-tile').filter({ has: page.locator('.pt-n', { hasText: new RegExp(`^${name}$`) }) });
const stockRow = (page: Page, name: string) => page.getByTestId('stock-row').filter({ has: page.getByText(name, { exact: true }) });
const totalOf = async (page: Page, name: string) => {
  const r = await page.evaluate(async () => (await (await fetch('/api/v1/products/options')).json()) as { data: { items: { name: string; displayName: string; physical: number; free: number }[] } });
  return r.data.items.filter((p) => p.name === name).reduce((a, p) => ({ physical: a.physical + p.physical, free: a.free + p.free }), { physical: 0, free: 0 });
};

// One original per width so both runs share the server without stepping on each other; both keep stock in the seed.
const CASES = [
  { width: 1440, original: 'Llavero con nombre', label: 'Dorado e2e' },
  { width: 390, original: 'Soporte de celular PETG', label: 'Blanco e2e' },
] as const;

for (const { width, original, label } of CASES) {
  test(`at ${width}: create a variant in Productos, see it in its panel, in Existencias and in the sale picker, then sell it`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 900 });
    const full = `${original} · ${label}`;

    // 1. Productos › "+ Variante" on the tile of a piece without variants opens the calculator copy.
    await page.goto(`${server.url}/productos`);
    const before = await totalOf(page, original);
    expect(before.physical).toBeGreaterThan(0);
    await tile(page, original).getByRole('button', { name: 'Variante', exact: true }).click();
    await expect(page.getByRole('heading', { name: `Nueva variante de ${original}` })).toBeVisible();
    await page.getByLabel('Nombre de la variante').fill(label);
    await page.getByRole('button', { name: 'Guardar en el catálogo' }).click();
    await expect(page.getByRole('status')).toHaveText('Variante guardada en el catálogo');

    // 2. Back in Productos with its family open: the panel lists the original and the new variant.
    await expect(page).toHaveURL(/\/productos\?abierta=/);
    const panel = page.getByTestId('variants-panel');
    await expect(panel).toContainText(`Variantes de ${original}`);
    await expect(panel.getByTestId('variant-row')).toHaveCount(2);
    await expect(panel.getByTestId('variant-row').filter({ hasText: label })).toHaveCount(1);
    await expect(tile(page, original).getByTestId('variants-toggle')).toHaveText(/1 variante/);

    // 3. Existencias › "Registrar impresión" of 2 for the variant: the family row sums the original and the variant.
    await page.goto(`${server.url}/existencias`);
    await page.getByRole('button', { name: 'Registrar impresión' }).first().click();
    const dlg = page.getByRole('dialog');
    await dlg.locator('select[name=prod]').selectOption({ label: full });
    await dlg.locator('input[name=cant]').fill('2');
    await expect(dlg.getByTestId('spool-use').first()).toBeVisible();
    await dlg.getByRole('button', { name: 'Registrar impresión' }).click();
    await expect(page.getByRole('status')).toContainText('Se sumaron 2 piezas a Existencias.');
    const fam = stockRow(page, original);
    await expect(fam.getByTestId('stock-total').first()).toHaveText(String(before.physical + 2));
    await expect(fam.getByTestId('stock-free').first()).toHaveText(String(before.free + 2));
    await fam.getByText(original, { exact: true }).click();
    const members = fam.getByTestId('stock-member');
    await expect(members).toHaveCount(2);
    await expect(members.filter({ hasText: label }).getByTestId('stock-total')).toHaveText('2');

    // 4. The sale picker lists it flat with its full name, right after its original; selling it takes 1 out.
    await page.goto(`${server.url}/armar?modo=venta`);
    await page.locator('[data-b=q]').fill(label);
    const pick = page.getByTestId('pick-piece').filter({ hasText: full });
    await expect(pick).toHaveCount(1);
    await page.locator('[data-b=q]').fill(original);
    await expect(page.getByTestId('pick-piece').locator('b')).toHaveText([original, full]);
    await page.getByTestId('pick-piece').filter({ hasText: full }).click();
    const line = page.getByTestId('builder-line');
    await expect(line).toHaveCount(1);
    await expect(line).toContainText(full);
    await page.locator('[data-b=cobrado]').fill(await page.locator('#b-total').inputValue());
    await page.locator('[data-b=nota]').fill(`Ronda 2 e2e ${width}`);
    await page.locator('.res-act').getByRole('button', { name: 'Registrar venta' }).click();
    await expect(status(page)).toHaveText('Venta registrada. 1 pieza salió de Existencias.');
    await expect(page.getByTestId('sale-row').filter({ hasText: `Ronda 2 e2e ${width}` })).toContainText(full);

    // 5. Existencias: the family has one piece less, taken from the variant.
    await page.goto(`${server.url}/existencias`);
    await expect(stockRow(page, original).getByTestId('stock-total').first()).toHaveText(String(before.physical + 1));
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });
}
