// Desktop shell (docs/10 Fase 4, docs/15 §5 desktop rows, docs/11 A02/A07) against the packaged Linux app
// (`pnpm desktop:dist:linux`), run with `pnpm e2e:desktop` (under xvfb-run). Skipped when the package is not built.
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const exe = process.env.DESKTOP_APP ?? join(process.cwd(), 'apps/desktop/out/linux-unpacked/quick-robot');
const canRun = existsSync(exe) && (process.platform !== 'linux' || Boolean(process.env.DISPLAY));
test.skip(!canRun, 'packaged desktop app not built (pnpm desktop:dist:linux) or no display (use xvfb-run)');
test.describe.configure({ mode: 'serial' });

const userData = mkdtempSync(join(tmpdir(), 'desktop-e2e-'));
const dataDir = join(userData, 'data');
const timings: Record<string, number> = {};
const CONCEPT = 'Prueba de escritorio';

interface Hooks { serverPid: () => number | undefined; secret: () => string; origin: () => string | null }
interface Launched { app: ElectronApplication; page: Page; ms: number }

async function launch(env: Record<string, string> = {}): Promise<Launched> {
  const t0 = Date.now();
  const app = await electron.launch({
    executablePath: exe,
    args: process.platform === 'linux' ? ['--no-sandbox'] : [],
    env: { ...(process.env as Record<string, string>), DESKTOP_USER_DATA: userData, ...env },
    timeout: 60_000,
  });
  const page = await app.firstWindow();
  return { app, page, ms: Date.now() - t0 };
}
async function untilHome(l: Launched) {
  const t0 = Date.now() - l.ms;
  await expect(l.page.getByRole('heading', { name: 'Inicio' })).toBeVisible({ timeout: 60_000 });
  return Date.now() - t0;
}
// Test hooks of the main process (only in builds with test hooks: never in the release .dmg).
type G = { __desktopTest: Hooks };
const serverPid = (app: ElectronApplication) => app.evaluate(() => (globalThis as unknown as G).__desktopTest.serverPid());
const secretOf = (app: ElectronApplication) => app.evaluate(() => (globalThis as unknown as G).__desktopTest.secret());
const originOf = (app: ElectronApplication) => app.evaluate(() => (globalThis as unknown as G).__desktopTest.origin());
const origin = async (app: ElectronApplication) => (await originOf(app))!;

async function expenseListed(page: Page, base: string) {
  await page.goto(`${base}/gastos`);
  await expect(page.getByTestId('expense-list')).toContainText(CONCEPT, { timeout: 20_000 });
}
const backupFolder = () => { const b = join(dataDir, 'backups'); const ws = readdirSync(b).find((f) => /^[0-9a-f-]{36}$/.test(f))!; return join(b, ws); };

test.afterAll(() => {
  console.log(`[desktop] open time: cold ${timings.cold} ms · warm ${timings.warm} ms (launch → Inicio visible)`);
  rmSync(userData, { recursive: true, force: true });
});

test('opens on Inicio; the secret never reaches the page; the server refuses calls without it', async () => {
  const l = await launch();
  timings.cold = await untilHome(l);
  const { app, page } = l;
  const secret = await secretOf(app);
  const base = await origin(app);
  expect(base).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
  expect(secret.length).toBeGreaterThanOrEqual(43);
  const seen = await page.evaluate(() => {
    const d = window.desktop as unknown as Record<string, unknown>;
    const walk = (o: unknown): string => (o && typeof o === 'object' ? Object.entries(o).map(([k, v]) => `${k}:${walk(v)}`).join(',') : String(o));
    return [document.documentElement.outerHTML, JSON.stringify({ ...localStorage }), JSON.stringify({ ...sessionStorage }), document.cookie, walk(d),
      performance.getEntries().map((e) => e.name).join(' ')].join('\n');
  });
  expect(seen).not.toContain(secret);
  expect(await page.evaluate(() => typeof (window as unknown as { require?: unknown }).require)).toBe('undefined');
  // The window's own requests carry it (added by the main process)...
  expect(await page.evaluate(async () => (await fetch('/api/v1/me')).status)).toBe(200);
  // ...another program on the Mac does not have it.
  expect((await fetch(`${base}/api/v1/me`)).status).toBe(401);
  expect((await fetch(`${base}/api/v1/me`, { headers: { authorization: 'Bearer wrong' } })).status).toBe(401);
  expect((await fetch(`${base}/api/v1/me`, { headers: { authorization: `Bearer ${secret}` } })).status).toBe(200);
  // Navigation outside its origin is blocked.
  await page.evaluate(() => { window.location.href = 'https://example.com/'; });
  await page.waitForTimeout(500);
  expect(page.url().startsWith(base)).toBe(true);

  await page.goto(`${base}/gastos`);
  await page.getByRole('button', { name: 'Registrar el primer gasto' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('input[name=concepto]').fill(CONCEPT);
  await dialog.locator('input[name=monto]').fill('123');
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByTestId('expense-list')).toContainText(CONCEPT);
  await app.close();
});

test('data survives closing and reopening the app', async () => {
  const l = await launch();
  timings.warm = await untilHome(l);
  await expenseListed(l.page, await origin(l.app));
  await l.app.close();
});

test('the server is restarted once by itself; if it falls again, "no responde" with Reintentar', async () => {
  const { app, page } = await launch();
  await expect(page.getByRole('heading', { name: 'Inicio' })).toBeVisible({ timeout: 60_000 });
  const base = await origin(app);
  const pid = (await serverPid(app))!;
  process.kill(pid, 'SIGKILL');
  await expect.poll(() => serverPid(app), { timeout: 30_000 }).not.toBe(pid);
  await expect.poll(() => originOf(app), { timeout: 30_000 }).toBe(base);
  await expect.poll(async () => (await fetch(`${base}/api/v1/health`).catch(() => null))?.status ?? 0, { timeout: 30_000 }).toBe(200);
  await expenseListed(page, base);

  const pid2 = (await serverPid(app))!;
  process.kill(pid2, 'SIGKILL');
  await expect(page.getByRole('heading', { name: 'La aplicación no responde. Cerrarla y volver a abrirla.' })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.getByRole('heading', { name: 'Inicio' })).toBeVisible({ timeout: 60_000 });
  await expenseListed(page, await origin(app));
  await app.close();
});

test('unreadable data file: the screen lists the automatic copies and restoring the most recent brings the data back', async () => {
  // The automatic copy of today was taken on the first open (before the expense): take it again, as the next day would.
  rmSync(backupFolder(), { recursive: true, force: true });
  const first = await launch();
  await expect(first.page.getByRole('heading', { name: 'Inicio' })).toBeVisible({ timeout: 60_000 });
  await first.app.close();
  expect(readdirSync(backupFolder()).some((f) => f.startsWith('backup-'))).toBe(true);

  writeFileSync(join(dataDir, 'pgdata', 'global', 'pg_control'), Buffer.alloc(8192, 7));
  const { app, page } = await launch();
  await expect(page.getByRole('heading', { name: 'No se pudo abrir el archivo de datos.' })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('listitem')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Elegir otra copia' })).toBeVisible();
  await page.getByRole('button', { name: 'Restaurar la copia más reciente' }).click();
  await expect(page.getByRole('heading', { name: 'Inicio' })).toBeVisible({ timeout: 60_000 });
  await expenseListed(page, await origin(app));
  // The unreadable folder is kept aside, never deleted.
  expect(readdirSync(dataDir).some((f) => f.startsWith('pgdata-unreadable-'))).toBe(true);
  await app.close();
});

test('a failing migration shows its screen and the data stays intact', async () => {
  const bad = mkdtempSync(join(tmpdir(), 'desktop-bad-migrations-'));
  cpSync(join(process.cwd(), 'packages/db/migrations'), bad, { recursive: true });
  const journalPath = join(bad, 'meta', '_journal.json');
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as { entries: { idx: number; version: string; when: number; tag: string; breakpoints: boolean }[] };
  const last = journal.entries.at(-1)!;
  journal.entries.push({ idx: last.idx + 1, version: last.version, when: last.when + 1000, tag: '9999_broken', breakpoints: true });
  writeFileSync(journalPath, JSON.stringify(journal));
  writeFileSync(join(bad, '9999_broken.sql'), 'ALTER TABLE this_table_does_not_exist ADD COLUMN x int;');

  const { app, page } = await launch({ DESKTOP_TEST_MIGRATIONS: bad });
  const text = 'No se pudo actualizar los datos. Se restauró la copia anterior; los datos están intactos.';
  await expect(page.getByRole('heading', { name: text })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('button', { name: 'Mostrar archivo de registro' })).toBeVisible();
  await page.getByRole('button', { name: 'Abrir de nuevo' }).click();
  await expect(page.getByRole('heading', { name: text })).toBeVisible({ timeout: 60_000 });
  expect(readdirSync(join(dataDir, 'backups')).some((f) => f.startsWith('before-update-'))).toBe(true);
  await app.close();
  rmSync(bad, { recursive: true, force: true });

  const again = await launch();
  await expect(again.page.getByRole('heading', { name: 'Inicio' })).toBeVisible({ timeout: 60_000 });
  await expenseListed(again.page, await origin(again.app));
  await again.app.close();
});
