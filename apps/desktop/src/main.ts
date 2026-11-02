// Electron main process (docs/02 §6): starts the same server inside the app on 127.0.0.1 and opens a window on it.
// No screens and no business rules live here; every native function has a web equivalent (CLAUDE.md rules 1 and 8).
import { app, BrowserWindow, dialog, ipcMain, Menu, session, shell, utilityProcess, type IpcMainInvokeEvent } from 'electron';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { listBackups, moveDataAside } from './data-folder';
import { menuTemplate } from './menu';
import type { FatalKind } from './protocol';
import { isAllowedNavigation, isExternalLink, isFromApp, isFromFatalPage, serverOrigin, windowOptions, withSecret } from './security';
import { ServerSupervisor } from './supervisor';
import { loadTexts, type DesktopTexts } from './texts';

const env = (name: string) => (__TEST_HOOKS__ ? process.env[name] || undefined : undefined);
// Test hooks (never in the release build): a separate user-data folder and a migrations folder.
const userDataOverride = env('DESKTOP_USER_DATA');
if (userDataOverride) app.setPath('userData', userDataOverride);

const appRoot = app.getAppPath();
const paths = {
  bundle: join(appRoot, 'dist', 'app'),
  migrations: env('DESKTOP_TEST_MIGRATIONS') ?? join(appRoot, 'dist', 'migrations'),
  web: app.isPackaged ? join(process.resourcesPath, 'web') : (process.env.DESKTOP_WEB_DIST ?? join(appRoot, '..', 'web', 'dist')),
  icon: app.isPackaged ? join(process.resourcesPath, 'icon-512.png') : join(appRoot, '..', '..', 'assets', 'icon-512.png'),
  data: join(app.getPath('userData'), 'data'),
};
const logsDir = join(paths.data, 'logs');
const fatalFile = join(paths.web, 'fatal.html');
const secret = randomBytes(32).toString('base64url');
const MAX_OPEN_BYTES = 200 * 1024 * 1024;

let texts: DesktopTexts;
let win: BrowserWindow | null = null;
let origin: string | null = null;
let fatalKind: FatalKind | null = null;
let pendingRestore: { resolve: (ok: boolean) => void } | null = null;
let quitting = false;

const supervisor = new ServerSupervisor({
  fork: () => utilityProcess.fork(join(paths.bundle, 'server-entry.mjs'), [], { serviceName: 'local-server', stdio: 'ignore' }),
  startMessage: (port, restoreFrom) => ({
    type: 'start', secret, port, dataDir: paths.data, webRoot: paths.web, migrationsFolder: paths.migrations, version: app.getVersion(),
    ...(restoreFrom ? { restoreFrom } : {}),
  }),
  events: {
    onListening(port) {
      fatalKind = null;
      const next = serverOrigin(port);
      const moved = next !== origin;
      origin = next;
      injectSecret(next);
      if (pendingRestore) { pendingRestore.resolve(true); pendingRestore = null; }
      const w = ensureWindow();
      if (moved || !isAllowedNavigation(w.webContents.getURL(), next)) void w.loadURL(`${next}/`);
    },
    onFatal(m) {
      if (pendingRestore && m.restoreFailed) {
        // The copy could not be applied on the fresh data file: put that file aside too and stay on the screen.
        void moveDataAside(paths.data, 'restore-failed', new Date()).catch(() => undefined);
        pendingRestore.resolve(false);
        pendingRestore = null;
        return;
      }
      showFatal(m.kind);
    },
    onDown() { showFatal('down'); },
  },
});

function injectSecret(own: string) {
  // Only requests to the window's own server get the secret (docs/11 A07); the interface never sees it.
  session.defaultSession.webRequest.onBeforeSendHeaders({ urls: [`${own}/*`] }, (details, cb) => {
    cb({ requestHeaders: withSecret(details.url, details.requestHeaders, own, secret) });
  });
}

function showFatal(kind: FatalKind) {
  fatalKind = kind;
  const w = ensureWindow();
  void w.loadFile(fatalFile, { query: { kind } });
}

function ensureWindow(): BrowserWindow {
  if (win && !win.isDestroyed()) return win;
  const w = new BrowserWindow(windowOptions(join(paths.bundle, 'preload.cjs'), existsSync(paths.icon) ? { icon: paths.icon } : {}));
  win = w;
  w.once('ready-to-show', () => w.show());
  const wc = w.webContents;
  wc.on('will-navigate', (e, url) => {
    if (origin && isAllowedNavigation(url, origin)) return;
    e.preventDefault();
    if (isExternalLink(url)) void shell.openExternal(url);
  });
  wc.on('will-redirect', (e, url) => { if (!origin || !isAllowedNavigation(url, origin)) e.preventDefault(); });
  wc.setWindowOpenHandler(({ url }) => {
    if (isExternalLink(url) && !(origin && isAllowedNavigation(url, origin))) void shell.openExternal(url);
    return { action: 'deny' };
  });
  w.on('closed', () => { if (win === w) win = null; });
  return w;
}

// ── IPC: every handler checks which page is calling ───────────────────────────────────────────────────────────────
const fromApp = (e: IpcMainInvokeEvent) => isFromApp(e.senderFrame?.url, origin);
const fromFatal = (e: IpcMainInvokeEvent) => isFromFatalPage(e.senderFrame?.url, pathToFileURL(fatalFile).href);
function handle(channel: string, allowed: (e: IpcMainInvokeEvent) => boolean, fn: (...args: unknown[]) => unknown) {
  ipcMain.handle(channel, (e, ...args) => { if (!allowed(e)) throw new Error('not allowed'); return fn(...args); });
}
const safeName = (name: unknown) => [...basename(String(name ?? ''))].map((c) => (c < ' ' || '\\/:*?"<>|'.includes(c) ? '_' : c)).join('').slice(0, 120) || 'file';

function registerIpc() {
  const d = texts.desktop.dialogs;
  handle('desktop:saveFile', fromApp, async (name, data) => {
    if (!(data instanceof Uint8Array) || !win) return false;
    const r = await dialog.showSaveDialog(win, { title: d.save, defaultPath: join(app.getPath('downloads'), safeName(name)) });
    if (r.canceled || !r.filePath) return false;
    await writeFile(r.filePath, data);
    return true;
  });
  handle('desktop:openFile', fromApp, async (accept) => {
    if (!win) return null;
    const exts = (Array.isArray(accept) ? accept : []).filter((a): a is string => typeof a === 'string' && /^\.[a-z0-9]{1,8}$/i.test(a)).map((a) => a.slice(1));
    const r = await dialog.showOpenDialog(win, { title: d.open, properties: ['openFile'], filters: exts.length ? [{ name: d.files, extensions: exts }] : [] });
    const file = r.filePaths[0];
    if (r.canceled || !file || (await stat(file)).size > MAX_OPEN_BYTES) return null;
    return { name: basename(file), data: new Uint8Array(await readFile(file)) };
  });
  handle('desktop:print', fromApp, () => new Promise<void>((resolve) => { win?.webContents.print({}, () => resolve()); }));
  handle('desktop:showLogFile', (e) => fromApp(e) || fromFatal(e), async () => { mkdirSync(logsDir, { recursive: true }); await shell.openPath(logsDir); });
  handle('desktop:openAtLogin:get', fromApp, () => app.getLoginItemSettings().openAtLogin);
  handle('desktop:openAtLogin:set', fromApp, (on) => { setOpenAtLogin(on === true); return app.getLoginItemSettings().openAtLogin; });

  handle('fatal:kind', fromFatal, () => fatalKind ?? 'down');
  handle('fatal:retry', fromFatal, () => { supervisor.start(); });
  handle('fatal:listBackups', fromFatal, async () => (await listBackups(paths.data)).map(({ id, on, sizeKb }) => ({ id, on, sizeKb })));
  handle('fatal:restoreBackup', fromFatal, async (id) => {
    const hit = (await listBackups(paths.data)).find((b) => b.id === id);
    return hit ? restoreFrom(hit.path) : false;
  });
  handle('fatal:chooseBackupFile', fromFatal, async () => {
    if (!win) return null;
    const r = await dialog.showOpenDialog(win, { title: d.chooseBackup, properties: ['openFile'], filters: [{ name: d.backupFiles, extensions: ['json'] }] });
    const file = r.filePaths[0];
    return r.canceled || !file ? null : restoreFrom(file);
  });
  handle('fatal:showLogs', fromFatal, async () => { mkdirSync(logsDir, { recursive: true }); await shell.openPath(logsDir); });
  handle('fatal:quit', fromFatal, () => { app.quit(); });
}

/** "Restaurar": the unreadable data file is moved aside (never deleted) and the server applies the copy on a fresh one. */
async function restoreFrom(file: string): Promise<boolean> {
  if (fatalKind !== 'data' || pendingRestore) return false;
  await supervisor.stop();
  await moveDataAside(paths.data, 'unreadable', new Date());
  return new Promise<boolean>((resolve) => {
    pendingRestore = { resolve };
    supervisor.start({ restoreFrom: file });
  });
}

function setOpenAtLogin(on: boolean) {
  app.setLoginItemSettings({ openAtLogin: on });
  buildMenu();
}

function buildMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate(texts, {
    appName: app.name, isMac: process.platform === 'darwin', isPackaged: app.isPackaged,
    openAtLogin: app.getLoginItemSettings().openAtLogin, onOpenAtLogin: setOpenAtLogin,
  })));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.on('web-contents-created', (_e, wc) => { wc.on('will-attach-webview', (ev) => ev.preventDefault()); });
  app.whenReady().then(() => {
    texts = loadTexts(paths.web);
    session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === 'clipboard-sanitized-write' || permission === 'fullscreen'));
    buildMenu();
    registerIpc();
    supervisor.start();
    if (__TEST_HOOKS__) Object.assign(globalThis, { __desktopTest: { serverPid: () => supervisor.pid, secret: () => secret, origin: () => origin, dataDir: paths.data } });
  }).catch((err: unknown) => { dialog.showErrorBox(app.name, String(err)); app.exit(1); });
  app.on('activate', () => {
    if (win) return;
    if (fatalKind) showFatal(fatalKind);
    else if (origin) void ensureWindow().loadURL(`${origin}/`);
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
  app.on('will-quit', (e) => {
    if (quitting) return;
    // Close the data file cleanly before leaving.
    e.preventDefault();
    quitting = true;
    void supervisor.stop().finally(() => app.quit());
  });
}

