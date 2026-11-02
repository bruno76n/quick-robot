/**
 * Native features are an enhancement, never a requirement (docs/02 §6). If Electron's preload exposes
 * `window.desktop`, use it; otherwise use the browser.
 */
export interface DesktopBridge {
  serverInfo?: { baseUrl: string; secret: string };
  saveFile?: (name: string, data: Blob) => Promise<void>;
}

declare global {
  interface Window {
    desktop?: DesktopBridge;
  }
}

export const desktop = (): DesktopBridge | undefined => (typeof window !== 'undefined' ? window.desktop : undefined);

/** Download a file: native save dialog if available, normal browser download otherwise. */
export async function saveFile(name: string, data: Blob): Promise<void> {
  const d = desktop();
  if (d?.saveFile) return d.saveFile(name, data);
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
