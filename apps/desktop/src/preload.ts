// Preload (sandboxed, context isolated): window.desktop with only what the web needs (apps/web/src/lib/platform.ts).
// The launch secret is never here: the main process adds it to the requests.
import { contextBridge, ipcRenderer } from 'electron';

const call = <T>(channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args) as Promise<T>;

contextBridge.exposeInMainWorld('desktop', {
  saveFile: (name: string, data: Uint8Array, _mime?: string) => call<boolean>('desktop:saveFile', name, data),
  openFile: (accept: string[] = []) => call<{ name: string; data: Uint8Array } | null>('desktop:openFile', accept),
  print: () => call<void>('desktop:print'),
  showLogFile: () => call<void>('desktop:showLogFile'),
  openAtLogin: {
    get: () => call<boolean>('desktop:openAtLogin:get'),
    set: (on: boolean) => call<boolean>('desktop:openAtLogin:set', on),
  },
  fatal: {
    kind: () => call<string>('fatal:kind'),
    retry: () => call<void>('fatal:retry'),
    listBackups: () => call<{ id: string; on: string; sizeKb: number }[]>('fatal:listBackups'),
    restoreBackup: (id: string) => call<boolean>('fatal:restoreBackup', id),
    chooseBackupFile: () => call<boolean | null>('fatal:chooseBackupFile'),
    showLogs: () => call<void>('fatal:showLogs'),
    quit: () => call<void>('fatal:quit'),
  },
});
