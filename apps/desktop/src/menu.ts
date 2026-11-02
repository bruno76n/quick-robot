// Native menu (docs/10 Fase 4 › Pulido de Electron). Labels come from es.ts through the web build (src/texts.ts).
import type { MenuItemConstructorOptions } from 'electron';
import { fill, type DesktopTexts } from './texts';

export interface MenuOptions {
  appName: string;
  isMac: boolean;
  isPackaged: boolean;
  openAtLogin: boolean;
  onOpenAtLogin: (on: boolean) => void;
}

export function menuTemplate(texts: DesktopTexts, o: MenuOptions): MenuItemConstructorOptions[] {
  const m = texts.desktop.menu;
  const app = { app: o.appName };
  const loginItem: MenuItemConstructorOptions = {
    id: 'openAtLogin', label: m.openAtLogin, type: 'checkbox', checked: o.openAtLogin,
    click: (item) => o.onOpenAtLogin(item.checked),
  };
  const appMenu: MenuItemConstructorOptions = {
    label: o.appName,
    submenu: [
      { role: 'about', label: fill(m.about, app) },
      { type: 'separator' },
      loginItem,
      { type: 'separator' },
      ...(o.isMac ? [
        { role: 'hide', label: fill(m.hide, app) },
        { role: 'hideOthers', label: m.hideOthers },
        { role: 'unhide', label: m.showAll },
        { type: 'separator' },
      ] satisfies MenuItemConstructorOptions[] : []),
      { role: 'quit', label: fill(m.quit, app) },
    ],
  };
  const edit: MenuItemConstructorOptions = {
    label: m.edit,
    submenu: [
      { role: 'undo', label: m.undo },
      { role: 'redo', label: m.redo },
      { type: 'separator' },
      { role: 'cut', label: m.cut },
      { role: 'copy', label: m.copy },
      { role: 'paste', label: m.paste },
      { role: 'selectAll', label: m.selectAll },
    ],
  };
  const view: MenuItemConstructorOptions = {
    label: m.view,
    submenu: [
      { role: 'reload', label: m.reload },
      { type: 'separator' },
      { role: 'resetZoom', label: m.resetZoom },
      { role: 'zoomIn', label: m.zoomIn },
      { role: 'zoomOut', label: m.zoomOut },
      { type: 'separator' },
      { role: 'togglefullscreen', label: m.fullScreen },
      ...(o.isPackaged ? [] : [{ role: 'toggleDevTools', label: m.devTools }] satisfies MenuItemConstructorOptions[]),
    ],
  };
  const windowMenu: MenuItemConstructorOptions = {
    role: 'window',
    label: m.window,
    submenu: [
      { role: 'minimize', label: m.minimize },
      { role: 'zoom', label: m.zoom },
      ...(o.isMac ? [{ type: 'separator' }, { role: 'front', label: m.front }] satisfies MenuItemConstructorOptions[] : [{ role: 'close', label: m.close }] satisfies MenuItemConstructorOptions[]),
    ],
  };
  return [appMenu, edit, view, windowMenu];
}
