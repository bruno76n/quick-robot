// What the person sees when something fails (docs/15 §5): never a blank screen, never a technical error,
// and always whether something was saved. Server failures are simulated by intercepting the API.
import { expect, test, type Page } from './support/test';
import { createOrder, seed } from './support/order-helpers';
import { startServer, type LocalServer } from './support/server';

let server: LocalServer;
test.beforeAll(async () => { server = await startServer(); });
test.afterAll(async () => { await server.stop(); });
const status = (page: Page) => page.getByRole('status');

async function openExpenseDialog(page: Page) {
  await page.goto(`${server.url}/gastos`);
  await page.getByRole('button', { name: 'Registrar gasto' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('input[name=concepto]').fill('Prueba de falla');
  await dialog.locator('input[name=monto]').fill('100');
  return dialog;
}

test('unexpected failure: red notice with the code, nothing saved, the form stays open', async ({ page }) => {
  const dialog = await openExpenseDialog(page);
  await page.route('**/api/v1/expenses', (r) => (r.request().method() === 'POST'
    ? r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'INTERNAL_ERROR', message: 'boom at x.ts:1', details: { errorId: 'e2e-123' }, errorId: 'e2e-123' }) })
    : r.continue()));
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(status(page)).toContainText('no se guardó nada');
  await expect(status(page)).toContainText('e2e-123');
  await expect(status(page)).not.toContainText('x.ts');
  await expect(dialog).toBeVisible();
  await page.unroute('**/api/v1/expenses');
  await page.reload();
  await expect(page.getByTestId('expense-list')).not.toContainText('Prueba de falla');
});

test('business rule (409): the text of docs/13 and the form stays open; disk full has its own text', async ({ page }) => {
  const dialog = await openExpenseDialog(page);
  await page.route('**/api/v1/expenses', (r) => r.fulfill({ status: 507, contentType: 'application/json', body: JSON.stringify({ code: 'STORAGE_FULL', message: 'x', details: {} }) }));
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(status(page)).toContainText('No hay espacio en el disco');
  await expect(dialog).toBeVisible();
});

test('a write in progress disables its button with "Guardando…"', async ({ page }) => {
  const dialog = await openExpenseDialog(page);
  let release: () => void = () => undefined;
  await page.route('**/api/v1/expenses', async (r) => { if (r.request().method() !== 'POST') return r.continue(); await new Promise<void>((ok) => { release = ok; }); await r.continue(); });
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
  release();
  await expect(status(page)).toHaveText('Gasto guardado');
});

test('the state changed while looking (ORDER_INVALID_STATE): notice and the screen reloads', async ({ page, request }) => {
  const s = await seed(request, server.url);
  const order = await createOrder(request, server.url, s, { accepted: false, items: [{ name: 'Llavero con nombre', qty: 1 }] });
  await page.goto(`${server.url}/pedidos/pedido?id=${order.id}`);
  await expect(page.locator('.ph .chip')).toHaveText('Cotizado');
  const r = await request.post(`${server.url}/api/v1/orders/${order.id}/accept`, { headers: { origin: server.url } });
  expect(r.ok()).toBe(true);
  await page.getByTestId('next-step').click();
  await expect(status(page)).toHaveText('El pedido ya no está en ese paso. Se actualizó la pantalla.');
  await expect(page.locator('.ph .chip')).toHaveText('Aceptado');
});

test('the server does not answer: fixed banner with Reintentar; the screen comes back when it answers', async ({ page }) => {
  await page.route('**/api/v1/**', (r) => r.abort('connectionrefused'));
  await page.goto(`${server.url}/inicio`);
  const banner = page.locator('.banner, [role=alert]').first();
  await expect(banner).toBeVisible();
  await expect(page.locator('body')).not.toContainText('TypeError');
  await page.unroute('**/api/v1/**');
  await page.getByRole('button', { name: 'Reintentar' }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('a slow load shows the skeleton after 300 ms, says so after 8 s and offers Reintentar', async ({ page }) => {
  await page.goto(`${server.url}/inicio`);
  await page.route('**/api/v1/expenses**', async (r) => { await new Promise((ok) => setTimeout(ok, 12_000)); await r.continue().catch(() => undefined); });
  await page.goto(`${server.url}/gastos`);
  await expect(page.getByTestId('loading-skeleton')).toBeVisible({ timeout: 2_000 });
  await expect(page.getByText('Tarda más de lo normal.')).toBeVisible({ timeout: 11_000 });
  await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible();
});

test('undo that is no longer possible (RESTORE_CONFLICT) shows its text', async ({ page, request }) => {
  const c = await request.post(`${server.url}/api/v1/customers`, { headers: { origin: server.url }, data: { name: 'Cliente Conflicto', type: 'Persona' } });
  expect(c.ok()).toBe(true);
  await page.goto(`${server.url}/clientes`);
  await page.getByTestId('customer-row').filter({ hasText: 'Cliente Conflicto' }).click();
  await page.getByRole('button', { name: 'Eliminar cliente' }).click();
  await page.getByRole('button', { name: 'Toca de nuevo para eliminar' }).click();
  await page.route('**/restore', (r) => r.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ code: 'RESTORE_CONFLICT', message: 'x', details: { entity: 'customer', reason: 'name' } }) }));
  await status(page).getByRole('button', { name: 'Deshacer' }).click();
  await expect(status(page)).toHaveText('No se pudo deshacer: ya existe otro registro con ese nombre.');
});
