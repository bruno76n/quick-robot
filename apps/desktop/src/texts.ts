// Spanish labels for the native menu and dialogs: they live in apps/web/src/i18n/es.ts and reach the shell through the
// web build (desktop-texts.json, emitted by apps/web/vite.config.ts). The shell writes no user-facing text itself.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface DesktopTexts {
  desktop: {
    menu: Record<'about' | 'hide' | 'hideOthers' | 'showAll' | 'quit' | 'openAtLogin' | 'edit' | 'undo' | 'redo' | 'cut' | 'copy' | 'paste'
      | 'selectAll' | 'view' | 'reload' | 'resetZoom' | 'zoomIn' | 'zoomOut' | 'fullScreen' | 'devTools' | 'window' | 'minimize' | 'zoom'
      | 'close' | 'front', string>;
    dialogs: Record<'save' | 'open' | 'chooseBackup' | 'backupFiles' | 'files', string>;
  };
}

export function loadTexts(webRoot: string): DesktopTexts {
  return JSON.parse(readFileSync(join(webRoot, 'desktop-texts.json'), 'utf8')) as DesktopTexts;
}

/** Replaces {name} placeholders. */
export const fill = (s: string, params: Record<string, string>) => s.replace(/\{(\w+)\}/g, (m, k: string) => params[k] ?? m);
