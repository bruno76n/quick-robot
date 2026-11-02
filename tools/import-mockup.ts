// Imports a mockup v7 backup (or an export of the app) into a local data folder and prints the summary:
// rows per table and the differences of the sums (spools, stock, sales, owed). Never touches a folder without --data.
// Usage: pnpm import:mockup --data <folder> <backup.json> [--yes]
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { importWorkspace, loadLocalConfig, localDeps, LOCAL_CTX } from '@app/server';

const { values, positionals } = parseArgs({ allowPositionals: true, options: { data: { type: 'string' }, yes: { type: 'boolean', default: false } } });
const file = positionals[0];
if (!values.data || !file) {
  process.stderr.write('Uso: pnpm import:mockup --data <carpeta> <copia.json> [--yes]\n');
  process.exit(2);
}
const cfg = loadLocalConfig({ dataDir: values.data, allowedOrigins: [] });
const { deps, conn } = await localDeps(cfg, { version: 'import' });
try {
  const r = await importWorkspace(deps, LOCAL_CTX, new Uint8Array(readFileSync(file)), { confirm: values.yes === true });
  const out = process.stdout;
  out.write(`Formato: ${r.format}\nCopia previa: ${r.backupId ?? '—'}\n\nFilas por tabla:\n`);
  for (const [t, n] of Object.entries(r.counts).filter(([, n]) => n > 0)) out.write(`  ${t.padEnd(22)} ${n}\n`);
  out.write(r.differences.length ? `\nDiferencias (${r.differences.length}):\n${r.differences.map((d) => `  ${d}`).join('\n')}\n` : '\nSin diferencias.\n');
  if (r.notes.length) out.write(`\nNotas:\n${r.notes.map((n) => `  ${n}`).join('\n')}\n`);
  process.exitCode = r.differences.length ? 1 : 0;
} catch (e) {
  process.stderr.write(`No se importó nada: ${(e as { code?: string }).code ?? 'INTERNAL_ERROR'}\n`);
  process.exitCode = 1;
} finally {
  await conn.close();
}
