import type { MenuItemConstructorOptions } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import { menuTemplate } from '../src/menu';
import { es } from '../../web/src/i18n/es';
import { fill, type DesktopTexts } from '../src/texts';

// The labels are the ones of es.ts (the web build emits them as desktop-texts.json; tests may read the source).
const texts: DesktopTexts = { desktop: es.screens.desktop };
const subOf = (t: MenuItemConstructorOptions[], i: number) => t[i]!.submenu as MenuItemConstructorOptions[];
const roles = (items: MenuItemConstructorOptions[]) => items.map((x) => x.role ?? x.type ?? x.id);

describe('menu', () => {
  const base = { appName: 'App', isMac: true, isPackaged: true, openAtLogin: false, onOpenAtLogin: () => undefined };
  it('Mac: app menu (Acerca de, Ocultar, Salir), Edición, Ver, Ventana', () => {
    const t = menuTemplate(texts, base);
    expect(t.map((x) => x.label)).toEqual(['App', 'Edición', 'Ver', 'Ventana']);
    const app = subOf(t, 0);
    expect(app.find((x) => x.role === 'about')!.label).toBe('Acerca de App');
    expect(app.find((x) => x.role === 'hide')!.label).toBe('Ocultar App');
    expect(app.find((x) => x.role === 'quit')!.label).toBe('Salir de App');
  });
  it('Edición has what text fields need on macOS', () => {
    expect(roles(subOf(menuTemplate(texts, base), 1))).toEqual(['undo', 'redo', 'separator', 'cut', 'copy', 'paste', 'selectAll']);
    expect(subOf(menuTemplate(texts, base), 1).map((x) => x.label).filter(Boolean)).toEqual(['Deshacer', 'Rehacer', 'Cortar', 'Copiar', 'Pegar', 'Seleccionar todo']);
  });
  it('DevTools only when not packaged', () => {
    expect(roles(subOf(menuTemplate(texts, base), 2))).not.toContain('toggleDevTools');
    expect(roles(subOf(menuTemplate(texts, { ...base, isPackaged: false }), 2))).toContain('toggleDevTools');
    expect(roles(subOf(menuTemplate(texts, base), 2))).toEqual(expect.arrayContaining(['reload', 'resetZoom', 'zoomIn', 'zoomOut', 'togglefullscreen']));
  });
  it('"Abrir al iniciar sesión" is a checkbox that reports its new state', () => {
    const on = vi.fn();
    const item = subOf(menuTemplate(texts, { ...base, openAtLogin: true, onOpenAtLogin: on }), 0).find((x) => x.id === 'openAtLogin')!;
    expect(item).toMatchObject({ type: 'checkbox', checked: true, label: 'Abrir al iniciar sesión' });
    (item.click as (i: { checked: boolean }) => void)({ checked: false });
    expect(on).toHaveBeenCalledWith(false);
  });
  it('without macOS there is no Ocultar and Ventana closes the window', () => {
    const t = menuTemplate(texts, { ...base, isMac: false });
    expect(roles(subOf(t, 0))).not.toContain('hide');
    expect(roles(subOf(t, 3))).toContain('close');
  });
  it('fill replaces placeholders and leaves unknown ones', () => {
    expect(fill('Salir de {app} {x}', { app: 'A' })).toBe('Salir de A {x}');
  });
});
