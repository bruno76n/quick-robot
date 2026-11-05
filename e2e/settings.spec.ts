// Ajustes: edits are kept in the form and saved together with "Guardar cambios".
import { expect, test } from './support/test';
import { startServer, type LocalServer } from './support/server';

let server: LocalServer;
test.beforeAll(async () => { server = await startServer(); });
test.afterAll(async () => { await server?.stop(); });

test('Ajustes: nothing is saved until "Guardar cambios"; then costs, channel and business data persist', async ({ page }) => {
  await page.goto(`${server.url}/ajustes`);
  const save = page.getByRole('button', { name: 'Guardar cambios' });
  await expect(save).toBeDisabled();
  await page.locator('input[name=failurePct]').fill('7');
  await page.locator('input[name=b-city]').fill('Monterrey');
  await page.locator('input[name^=ch-pct-]').first().fill('4.5');
  await expect(page.getByText('Hay cambios sin guardar.')).toBeVisible();
  await page.reload();
  await expect(page.locator('input[name=b-city]')).not.toHaveValue('Monterrey');
  await page.locator('input[name=failurePct]').fill('7');
  await page.locator('input[name=b-city]').fill('Monterrey');
  await page.locator('input[name^=ch-pct-]').first().fill('4.5');
  await save.click();
  await expect(page.getByText('Cambios guardados.').first()).toBeVisible();
  await expect(save).toBeDisabled();
  await page.reload();
  await expect(page.locator('input[name=failurePct]')).toHaveValue('7');
  await expect(page.locator('input[name=b-city]')).toHaveValue('Monterrey');
  await expect(page.locator('input[name^=ch-pct-]').first()).toHaveValue('4.5');
});
