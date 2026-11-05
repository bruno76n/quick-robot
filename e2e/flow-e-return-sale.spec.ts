// Flow E (docs/06 §17): Ventas → open a sale → Devolver, with and without "regresan a Existencias".
// Income becomes 0; with restock the pieces come back (+n) and the cost is 0; without, the cost is lost.
import { expect, test, type Page } from './support/test';
import { startServer, type LocalServer } from './support/server';

let server: LocalServer;
test.beforeAll(async () => { server = await startServer(); });
test.afterAll(async () => { await server.stop(); });
const status = (page: Page) => page.locator('.toast[role=status]');

const api = <T>(page: Page, method: string, path: string, body?: unknown) => page.evaluate(async ([m, p, b]) => {
  const r = await fetch(`/api/v1${p as string}`, { method: m as string, headers: b ? { 'content-type': 'application/json' } : {}, ...(b ? { body: JSON.stringify(b) } : {}) });
  return (await r.json()).data;
}, [method, path, body] as const) as Promise<T>;
const freeOf = async (page: Page, name: string) => (await api<{ items: { name: string; free: number }[] }>(page, 'GET', '/products')).items.find((p) => p.name === name)!.free;

async function sellOne(page: Page, note: string) {
  const products = await api<{ items: { id: string; name: string; listCents: number }[] }>(page, 'GET', '/products');
  const settings = await api<{ channels: { id: string }[] }>(page, 'GET', '/settings');
  const p = products.items.find((x) => x.name === 'Llavero con nombre')!;
  const today = '2026-11-01'; // the frozen "today" of the seed (support/test.ts)
  return api<{ id: string }>(page, 'POST', '/sales', { on: today, channelId: settings.channels[0]!.id, note, items: [{ kind: 'piece', productId: p.id, qty: 1, priceCents: p.listCents }] });
}

test('E. return a sale with the pieces back in stock', async ({ page }) => {
  await page.goto(`${server.url}/ventas`);
  const sale = await sellOne(page, 'Devolución con existencias');
  const before = await freeOf(page, 'Llavero con nombre');
  await page.reload();
  await page.getByTestId('sale-row').filter({ hasText: 'Devolución con existencias' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('button', { name: 'Devolver venta' }).click();
  await expect(dlg.getByRole('heading', { name: 'Devolver venta' })).toBeVisible();
  await expect(dlg.locator('select[name=repone]')).toHaveValue('1');
  await dlg.locator('input[name=nota]').fill('Defecto');
  await dlg.getByRole('button', { name: 'Devolver venta' }).click();
  await expect(status(page)).toHaveText('Venta devuelta. 1 pieza regresó a Existencias.');
  const row = page.getByTestId('sale-row').filter({ hasText: 'Devolución con existencias' });
  await expect(row).toContainText('Devuelta');
  await expect(row.locator('td').last()).toHaveText('—');
  expect(await freeOf(page, 'Llavero con nombre')).toBe(before + 1);
  const d = await api<{ totals: { incomeCents: number; costCents: number }; return: { restock: boolean } }>(page, 'GET', `/sales/${sale.id}`);
  expect(d.totals.incomeCents).toBe(0);
  expect(d.totals.costCents).toBe(0);
  expect(d.return.restock).toBe(true);
  await row.click();
  await expect(dlg).toContainText('Las piezas regresaron a Existencias.');
  await expect(dlg.getByRole('button', { name: 'Devolver venta' })).toHaveCount(0);
});

test('E. return a sale whose pieces cannot be resold', async ({ page }) => {
  await page.goto(`${server.url}/ventas`);
  const sale = await sellOne(page, 'Devolución sin existencias');
  const before = await freeOf(page, 'Llavero con nombre');
  await page.reload();
  await page.getByTestId('sale-row').filter({ hasText: 'Devolución sin existencias' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('button', { name: 'Devolver venta' }).click();
  await dlg.locator('select[name=repone]').selectOption('0');
  await dlg.getByRole('button', { name: 'Devolver venta' }).click();
  await expect(status(page)).toHaveText('Venta devuelta.');
  expect(await freeOf(page, 'Llavero con nombre')).toBe(before);
  const d = await api<{ totals: { incomeCents: number; costCents: number; profitCents: number } }>(page, 'GET', `/sales/${sale.id}`);
  expect(d.totals.incomeCents).toBe(0);
  expect(d.totals.costCents).toBeGreaterThan(0);
  expect(d.totals.profitCents).toBe(-d.totals.costCents);
});

test('E. a refund above what was paid is refused', async ({ page }) => {
  await page.goto(`${server.url}/ventas`);
  await sellOne(page, 'Reembolso de más');
  await page.reload();
  await page.getByTestId('sale-row').filter({ hasText: 'Reembolso de más' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByRole('button', { name: 'Devolver venta' }).click();
  await dlg.locator('input[name=reembolso]').fill('99999');
  await dlg.getByRole('button', { name: 'Devolver venta' }).click();
  await expect(status(page)).toContainText('El reembolso no puede ser mayor a lo pagado');
});
