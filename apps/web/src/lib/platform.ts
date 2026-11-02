// Native functions improve, never enable (CLAUDE.md rule 8): window.desktop if it exists, the browser otherwise.
export interface DesktopBridge {
  saveFile?: (name: string, data: Uint8Array, mime: string) => Promise<boolean>;
  openFile?: (accept: string[]) => Promise<{ name: string; data: Uint8Array } | null>;
  print?: () => Promise<void>;
  showLogFile?: () => Promise<void>;
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
