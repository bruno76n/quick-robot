// Ronda 2 · Inicio with attention by priority (ronda-2 §5, §10): filters, "Ver las N restantes", no filament rolls,
// column order and each attention button, at desktop and phone widths, against the development seed.
import { expect, test, type Page } from './support/test';
import { startServer, type LocalServer } from './support/server';

let server: LocalServer;
test.beforeAll(async () => { server = await startServer(); });
test.afterAll(async () => { await server?.stop(); });

const list = (page: Page) => page.getByTestId('attentions');
const chip = (page: Page, name: RegExp) => page.getByRole('group', { name: 'Atención' }).getByRole('button', { name });

/** /home answered by the real server plus `extra` copies of the seed's owed sale (all "Esta semana"). */
async function withExtraOwed(page: Page, extra: number) {
  await page.route('**/api/v1/home', async (route) => {
    const res = await route.fetch();
    const body = await res.json() as { data?: { attentions: { kind: string }[] }; attentions?: { kind: string }[] };
    const data = body.data ?? body;
    const owed = data.attentions!.find((a) => a.kind === 'sale_owed')!;
    data.attentions!.push(...Array.from({ length: extra }, () => owed));
    await route.fulfill({ response: res, json: body });
  });
}

for (const width of [1440, 390]) {
  test.describe(`at ${width} px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('the attention is grouped by priority and filtered with the chips', async ({ page }) => {
      await page.goto(`${server.url}/inicio`);
      await expect(list(page).locator('li')).toHaveCount(9);
      await expect(chip(page, /^Todas 9$/)).toHaveAttribute('aria-pressed', 'true');
      await expect(chip(page, /^Urgente 2$/)).toBeVisible();
      await expect(chip(page, /^Esta semana 4$/)).toBeVisible();
      await expect(chip(page, /^Para revisar 3$/)).toBeVisible();
      const heads = list(page).locator('.atn-gh');
      await expect(heads).toHaveCount(3);
      await expect(heads.nth(0)).toHaveText(/Urgente\s*Bloquea una impresión o vence hoy o mañana/);
      await expect(heads.nth(1)).toHaveText(/Esta semana\s*Conviene resolverlo pronto/);
      await expect(heads.nth(2)).toHaveText(/Para revisar\s*Sin prisa/);
      // Same texts as before, important part in bold, today's order inside the group.
      const urgent = list(page).locator('[data-severity="urgent"] li');
      await expect(urgent.nth(0)).toContainText('Pedido #5 de Tacos El Güero: faltan 535 g de PLA Negro (disponible 410 g).');
      await expect(urgent.nth(0).locator('b').first()).toHaveText('#5');
      await expect(urgent.nth(1)).toContainText('Pedido #2 de Mariana R.: entrega mañana (listo para entregar).');

      await chip(page, /^Urgente/).click();
      await expect(chip(page, /^Urgente/)).toHaveAttribute('aria-pressed', 'true');
      await expect(list(page).locator('li')).toHaveCount(2);
      await expect(heads).toHaveCount(0);
      await chip(page, /^Para revisar/).click();
      await expect(list(page).locator('li')).toHaveCount(3);
      await expect(list(page)).toContainText('Aún no se ha descargado una copia de seguridad de los datos.');
      await chip(page, /^Todas/).click();
      await expect(list(page).locator('li')).toHaveCount(9);
      // The filter is not saved.
      await chip(page, /^Esta semana/).click();
      await page.reload();
      await expect(chip(page, /^Todas/)).toHaveAttribute('aria-pressed', 'true');
    });

    test('"Ver las N restantes" opens the rest of a group in place, in batches of 50', async ({ page }) => {
      await withExtraOwed(page, 60);
      await page.goto(`${server.url}/inicio`);
      const soon = list(page).locator('[data-severity="soon"]');
      await expect(chip(page, /^Esta semana 64$/)).toBeVisible();
      await expect(soon.locator('li')).toHaveCount(5);
      await soon.getByRole('button', { name: 'Ver las 59 restantes' }).click();
      await expect(soon.locator('li')).toHaveCount(55);
      await soon.getByRole('button', { name: 'Ver las 9 restantes' }).click();
      await expect(soon.locator('li')).toHaveCount(64);
      await expect(soon.getByRole('button', { name: /restantes/ })).toHaveCount(0);
      await expect(list(page).locator('[data-severity="urgent"] li')).toHaveCount(2);
    });

    test('never more than 200 attention rows on screen', async ({ page }) => {
      await withExtraOwed(page, 400);
      await page.goto(`${server.url}/inicio`);
      const soon = list(page).locator('[data-severity="soon"]');
      for (let i = 0; i < 6; i++) await soon.getByRole('button', { name: /restantes/ }).click();
      await expect(soon.getByRole('button', { name: 'Ver las 99 restantes' })).toBeVisible();
      expect(await list(page).locator('li').count()).toBeLessThanOrEqual(200);
    });

    test('Inicio shows no filament rolls and does not ask for /filaments', async ({ page }) => {
      const asked: string[] = [];
      page.on('request', (r) => { if (/\/api\/v1\/filaments/.test(r.url())) asked.push(r.url()); });
      await page.goto(`${server.url}/inicio`);
      await expect(list(page).locator('li')).toHaveCount(9);
      await expect(page.getByRole('heading', { name: 'Impresoras' })).toBeVisible();
      await page.waitForLoadState('networkidle');
      expect(asked).toEqual([]);
      await expect(page.getByRole('heading', { name: 'Filamento', exact: true })).toHaveCount(0);
      await expect(page.locator('.spool, .spools')).toHaveCount(0);
      // Atención first; Piezas con más ganancia and Impresoras beside it (desktop) or after it (phone).
      const box = async (name: string) => (await page.getByRole('heading', { name, exact: true }).boundingBox())!;
      const [att, top, prn] = [await box('Atención'), await box('Piezas con más ganancia'), await box('Impresoras')];
      expect(top.y).toBeLessThan(prn.y);
      if (width >= 1000) { expect(top.x).toBeGreaterThan(att.x); expect(top.y).toBeCloseTo(att.y, -1); }
      else { expect(att.y).toBeLessThan(top.y); }
    });

    test('each attention button still goes to its element', async ({ page }) => {
      const cases: [string, RegExp][] = [
        ['Agregar rollo', /\/filamentos\?f=/],
        ['Abrir pedido', /\/pedidos\/pedido\?id=/],
        ['Registrar abono', /\/ventas\?v=/],
        ['Ver filamento', /\/filamentos\?f=/],
        ['Ver insumo', /\/insumos\?i=/],
        ['Ver impresoras', /\/impresoras$/],
        ['Hacer copia', /\/ajustes$/],
      ];
      for (const [button, url] of cases) {
        await page.goto(`${server.url}/inicio`);
        await list(page).getByRole('link', { name: button }).first().click();
        await expect(page).toHaveURL(url);
      }
    });
  });
}
