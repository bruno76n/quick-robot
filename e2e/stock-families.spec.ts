// Existencias by families (mejoras/ronda-2.md §4 and §10): Lista by default, Fichas remembered, filters by state
// where a family counts once, the family sum, search by variant label, fewest free first, and the drawer per member.
// Seed: 6 pieces with stock; "Spider-Man · salto" has the variant "silk morado" (3 + 1 in total, 1 + 1 free).
import { expect, test, type Page } from './support/test';
import { startServer, type LocalServer } from './support/server';

let server: LocalServer;
test.beforeAll(async () => { server = await startServer(); });
test.afterAll(async () => { await server.stop(); });

const FAMILY = 'Spider-Man · salto';
const rows = (page: Page) => page.getByTestId('stock-row');
const row = (page: Page, name: string) => rows(page).filter({ has: page.getByText(name, { exact: true }) });
const filter = (page: Page, name: RegExp) => page.getByRole('group', { name: 'Filtrar por estado' }).getByRole('button', { name });
const drawer = (page: Page) => page.getByRole('complementary', { name: 'Detalle' });

for (const width of [1440, 390]) {
  test.describe(`at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('Lista by default; Fichas is remembered after a reload and on the next visit', async ({ page }) => {
      await page.goto(`${server.url}/existencias`);
      await expect(page.getByRole('button', { name: 'Lista', pressed: true })).toBeVisible();
      await expect(page.getByTestId('stock-list')).toBeVisible();
      await expect(page.getByText(/Total: 22 unidades de 6 piezas · Disponibles: 13 · Apartadas: 9/)).toBeVisible();
      await page.getByRole('button', { name: 'Fichas' }).click();
      await expect(page).toHaveURL(/vista=fichas/);
      await expect(page.getByTestId('stock-card')).toHaveCount(6);
      await page.reload();
      await expect(page.getByTestId('stock-card')).toHaveCount(6);
      await page.goto(`${server.url}/inicio`);
      await page.goto(`${server.url}/existencias`);
      await expect(page.getByRole('button', { name: 'Fichas', pressed: true })).toBeVisible();
      await expect(page.getByTestId('stock-card')).toHaveCount(6);
    });

    test('filters by state with counters; a family counts once', async ({ page }) => {
      await page.goto(`${server.url}/existencias`);
      await expect(filter(page, /^Todas 6$/)).toBeVisible();
      await expect(rows(page)).toHaveCount(6);
      await filter(page, /^Stock bajo 4$/).click();
      await expect(rows(page)).toHaveCount(4);
      await expect(row(page, FAMILY)).toHaveCount(1);
      await filter(page, /^Disponible 1$/).click();
      await expect(rows(page)).toHaveCount(1);
      await expect(row(page, 'Llavero con nombre')).toBeVisible();
      await filter(page, /^Apartado 1$/).click();
      await expect(row(page, 'Spider-Man · trepando')).toBeVisible();
      await filter(page, /^Agotado 0$/).click();
      await expect(rows(page)).toHaveCount(0);
      await expect(page.getByText('No hay piezas con ese filtro o búsqueda.')).toBeVisible();
    });

    test('Vender on the row only when there are free units, also on a member and on its card (D4)', async ({ page }) => {
      await page.goto(`${server.url}/existencias`);
      await expect(row(page, 'Llavero con nombre').getByRole('button', { name: 'Vender Llavero con nombre' })).toBeVisible();
      await expect(row(page, 'Spider-Man · trepando').getByRole('button', { name: /^Vender/ })).toHaveCount(0);
      await expect(row(page, FAMILY).getByRole('button', { name: /^Vender/ })).toHaveCount(0); // the family row only unfolds
      await row(page, FAMILY).getByText(FAMILY, { exact: true }).click();
      await row(page, FAMILY).getByTestId('stock-member').first().getByRole('button', { name: /^Vender/ }).click();
      await expect(page).toHaveURL(/\/armar\?modo=venta&pieza=/);
      await expect(page.getByTestId('builder-line')).toHaveCount(1);
      await page.goto(`${server.url}/existencias?vista=fichas`);
      const card = page.getByTestId('stock-card').filter({ hasText: 'Llavero con nombre' });
      await card.getByRole('button', { name: 'Vender Llavero con nombre' }).click();
      await expect(page).toHaveURL(/\/armar\?modo=venta&pieza=/);
    });

    test('a family shows the sum of its members and the drawer opens from a member, never from the family row', async ({ page }) => {
      await page.goto(`${server.url}/existencias`);
      const fam = row(page, FAMILY);
      await expect(fam.getByTestId('stock-total').first()).toHaveText('4');
      await expect(fam.getByTestId('stock-free').first()).toHaveText('2');
      await fam.getByText(FAMILY, { exact: true }).click();
      const members = fam.getByTestId('stock-member');
      await expect(members).toHaveCount(2);
      await expect(members.first()).toContainText('Original');
      await expect(members.nth(0).getByTestId('stock-total')).toHaveText('3');
      await expect(members.nth(1).getByTestId('stock-total')).toHaveText('1');
      await expect(drawer(page)).toBeHidden();
      await members.nth(1).getByRole('button', { name: /^Abrir / }).click();
      await expect(drawer(page)).toBeVisible();
      await expect(drawer(page)).toContainText('silk morado');
      await expect(page).toHaveURL(/p=/);
      await page.keyboard.press('Escape');
      await fam.getByRole('button', { name: 'Ocultar variantes' }).click();
      await expect(members).toHaveCount(0);
    });

    test('search by a variant label opens its family; Disponibles toggles the order', async ({ page }) => {
      await page.goto(`${server.url}/existencias`);
      await expect(rows(page).first()).toContainText('Spider-Man · trepando');
      if (width > 760) {
        await page.getByRole('button', { name: 'Disponibles: menos primero' }).click();
        await expect(rows(page).first()).toContainText('Llavero con nombre');
        await page.getByRole('button', { name: 'Disponibles: más primero' }).click();
        await expect(rows(page).first()).toContainText('Spider-Man · trepando');
      }
      await page.getByPlaceholder('Buscar pieza').fill('silk');
      await expect(rows(page)).toHaveCount(1);
      await expect(row(page, FAMILY).getByTestId('stock-member')).toHaveCount(2);
    });

    test('Fichas: a big free number, a bar and free per variant; a variant line opens its drawer', async ({ page }) => {
      await page.goto(`${server.url}/existencias?vista=fichas`);
      const card = page.getByTestId('stock-card').filter({ hasText: FAMILY });
      await expect(card.getByTestId('stock-free').first()).toHaveText('2');
      await expect(card).toContainText('de 4 en total');
      await expect(card.getByRole('img', { name: '2 disponibles y 2 apartadas' })).toBeVisible();
      await expect(card).toContainText('2 variantes · disponibles por variante');
      await card.getByTestId('stock-variant').nth(1).click();
      await expect(drawer(page)).toContainText('silk morado');
      await page.keyboard.press('Escape');
      await page.getByTestId('stock-card').filter({ hasText: 'Hulk · puño' }).click();
      await expect(drawer(page).getByRole('heading', { name: 'Hulk · puño' })).toBeVisible();
    });
  });
}
