// Desktop fatal page (docs/15 §5): texts of es.ts and every button calls window.desktop.fatal.
import { describe, expect, it, vi } from 'vitest';
import type { DesktopFatal } from '../lib/platform';
import { readKind, render } from './main';

function api(over: Partial<DesktopFatal> = {}): DesktopFatal {
  return {
    kind: vi.fn(async () => 'data' as const), retry: vi.fn(async () => undefined), showLogs: vi.fn(async () => undefined), quit: vi.fn(async () => undefined),
    listBackups: vi.fn(async () => [{ id: '2026-11-02', on: '2026-11-02', sizeKb: 12 }, { id: '2026-11-01', on: '2026-11-01', sizeKb: 11 }]),
    restoreBackup: vi.fn(async () => true), chooseBackupFile: vi.fn(async () => null), ...over,
  };
}
const click = async (root: HTMLElement, name: string) => {
  const b = [...root.querySelectorAll('button')].find((x) => x.textContent === name);
  if (!b) throw new Error(`no button ${name}`);
  b.click();
  await new Promise((r) => setTimeout(r, 0));
};

describe('fatal page', () => {
  it('reads the kind from the address (anything else is "down")', () => {
    expect(readKind('?kind=data')).toBe('data');
    expect(readKind('?kind=migration')).toBe('migration');
    expect(readKind('?kind=<x>')).toBe('down');
    expect(readKind('')).toBe('down');
  });

  it('down: text and Reintentar', async () => {
    const root = document.createElement('main');
    const a = api();
    await render(root, 'down', a);
    expect(root.querySelector('h1')!.textContent).toBe('La aplicación no responde. Cerrarla y volver a abrirla.');
    await click(root, 'Reintentar');
    expect(a.retry).toHaveBeenCalled();
  });

  it('migration: Abrir de nuevo and Mostrar archivo de registro', async () => {
    const root = document.createElement('main');
    const a = api();
    await render(root, 'migration', a);
    expect(root.querySelector('h1')!.textContent).toBe('No se pudo actualizar los datos. Se restauró la copia anterior; los datos están intactos.');
    await click(root, 'Abrir de nuevo');
    await click(root, 'Mostrar archivo de registro');
    expect(a.retry).toHaveBeenCalled();
    expect(a.showLogs).toHaveBeenCalled();
  });

  it('data: restore the most recent, a listed one or another file; a failed restore says so', async () => {
    const root = document.createElement('main');
    const a = api({ restoreBackup: vi.fn(async () => false) });
    await render(root, 'data', a);
    expect(root.querySelector('h1')!.textContent).toBe('No se pudo abrir el archivo de datos.');
    expect([...root.querySelectorAll('li span')].map((x) => x.textContent)).toEqual(['Copia del 2 nov', 'Copia del 1 nov']);
    await click(root, 'Restaurar la copia más reciente');
    expect(a.restoreBackup).toHaveBeenCalledWith('2026-11-02');
    expect(root.querySelector('[role=status]')!.textContent).toBe('No se pudo restaurar esa copia. Elegir otra.');
    await click(root, 'Elegir otra copia');
    expect(a.chooseBackupFile).toHaveBeenCalled();
    expect(root.querySelector('[role=status]')!.textContent).toBe('');
  });

  it('data without copies: only "Elegir otra copia" and a note', async () => {
    const root = document.createElement('main');
    await render(root, 'data', api({ listBackups: vi.fn(async () => []) }));
    expect([...root.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Elegir otra copia']);
    expect(root.textContent).toContain('Todavía no hay copias automáticas.');
  });
});
