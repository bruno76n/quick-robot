// Pure builders for the window's security options (docs/11 A02 "revisión de opciones de BrowserWindow"): unit tested.
import type { BrowserWindowConstructorOptions } from 'electron';

export function windowOptions(preloadPath: string, extra: { icon?: string; title?: string } = {}): BrowserWindowConstructorOptions {
  return {
    width: 1440,
    height: 900,
    minWidth: 390,
    minHeight: 600,
    show: false,
    backgroundColor: '#ffffff',
    ...(extra.icon ? { icon: extra.icon } : {}),
    ...(extra.title ? { title: extra.title } : {}),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      webviewTag: false,
      navigateOnDragDrop: false,
      spellcheck: true,
    },
  };
}

/** The local server's origin, e.g. http://127.0.0.1:53124. */
export const serverOrigin = (port: number) => `http://127.0.0.1:${port}`;

/** The window only navigates inside its own origin (the local server). */
export function isAllowedNavigation(url: string, origin: string): boolean {
  try { return new URL(url).origin === new URL(origin).origin; } catch { return false; }
}

/** Links to the outside (http/https only) open in the system browser; anything else is ignored. */
export function isExternalLink(url: string): boolean {
  try { const p = new URL(url).protocol; return p === 'http:' || p === 'https:'; } catch { return false; }
}

/**
 * Header injection for session.webRequest.onBeforeSendHeaders: the launch secret goes only to the window's own
 * server, never to another host or port (the interface never sees it).
 */
export function withSecret(url: string, headers: Record<string, string>, origin: string, secret: string): Record<string, string> {
  if (!isAllowedNavigation(url, origin)) return headers;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) if (k.toLowerCase() !== 'authorization') out[k] = v;
  out.Authorization = `Bearer ${secret}`;
  return out;
}

/** True when an IPC call comes from the given page: the app (own origin) or the bundled fatal page (exact file). */
export function isFromApp(senderUrl: string | undefined, origin: string | null): boolean {
  return Boolean(senderUrl && origin && isAllowedNavigation(senderUrl, origin));
}
export function isFromFatalPage(senderUrl: string | undefined, fatalFileUrl: string): boolean {
  if (!senderUrl) return false;
  const bare = (s: string) => { const u = new URL(s); u.search = ''; u.hash = ''; return u; };
  try { const u = bare(senderUrl); return u.protocol === 'file:' && u.href === bare(fatalFileUrl).href; } catch { return false; }
}
