// Native functions improve, never enable (CLAUDE.md rule 8): window.desktop if it exists, the browser otherwise.
export interface DesktopBackup { id: string; on: string; sizeKb: number }
/** Only on the desktop fatal page (apps/web/fatal.html, docs/15 §5). */
export interface DesktopFatal {
  kind: () => Promise<'down' | 'migration' | 'data'>;
  retry: () => Promise<void>;
  listBackups: () => Promise<DesktopBackup[]>;
  /** true: restored and the app opens; false: the copy could not be applied. */
  restoreBackup: (id: string) => Promise<boolean>;
  /** Like restoreBackup with a file chosen in the native dialog; null when the dialog is cancelled. */
  chooseBackupFile: () => Promise<boolean | null>;
  showLogs: () => Promise<void>;
  quit: () => Promise<void>;
}
export interface DesktopBridge {
  saveFile?: (name: string, data: Uint8Array, mime: string) => Promise<boolean>;
  openFile?: (accept: string[]) => Promise<{ name: string; data: Uint8Array } | null>;
  print?: () => Promise<void>;
  showLogFile?: () => Promise<void>;
  openAtLogin?: { get: () => Promise<boolean>; set: (on: boolean) => Promise<boolean> };
  fatal?: DesktopFatal;
}

declare global {
  interface Window { desktop?: DesktopBridge }
}

export const isDesktop = () => typeof window !== 'undefined' && Boolean(window.desktop);

export async function saveFile(name: string, data: Uint8Array, mime: string): Promise<void> {
  if (window.desktop?.saveFile) { await window.desktop.saveFile(name, data, mime); return; }
  const url = URL.createObjectURL(new Blob([data as BlobPart], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function printPage(): Promise<void> {
  if (window.desktop?.print) { await window.desktop.print(); return; }
  window.print();
}
