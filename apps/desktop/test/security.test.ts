// docs/11 A02 "revisión de opciones de BrowserWindow" and A07 (secret only to the own server).
import { describe, expect, it } from 'vitest';
import { isAllowedNavigation, isExternalLink, isFromApp, isFromFatalPage, serverOrigin, windowOptions, withSecret } from '../src/security';

describe('BrowserWindow options', () => {
  it('are hardened: context isolation, sandbox, no node, web security, a preload', () => {
    const w = windowOptions('/app/preload.cjs').webPreferences!;
    expect(w).toMatchObject({ preload: '/app/preload.cjs', contextIsolation: true, nodeIntegration: false, nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false, sandbox: true, webSecurity: true, allowRunningInsecureContent: false, webviewTag: false });
  });
  it('the window starts hidden (shown when ready) and keeps the icon when given', () => {
    const o = windowOptions('/p', { icon: '/i.png' });
    expect(o.show).toBe(false);
    expect(o.icon).toBe('/i.png');
    expect(windowOptions('/p').icon).toBeUndefined();
  });
});

describe('navigation', () => {
  const origin = serverOrigin(53124);
  it('only inside its own origin', () => {
    expect(origin).toBe('http://127.0.0.1:53124');
    expect(isAllowedNavigation('http://127.0.0.1:53124/ventas?x=1', origin)).toBe(true);
    expect(isAllowedNavigation('http://127.0.0.1:53125/', origin)).toBe(false);
    expect(isAllowedNavigation('http://localhost:53124/', origin)).toBe(false);
    expect(isAllowedNavigation('https://127.0.0.1:53124/', origin)).toBe(false);
    expect(isAllowedNavigation('http://127.0.0.1:53124@evil.com/', origin)).toBe(false);
    expect(isAllowedNavigation('file:///etc/passwd', origin)).toBe(false);
    expect(isAllowedNavigation('not a url', origin)).toBe(false);
  });
  it('external links: only http(s) go to the system browser', () => {
    expect(isExternalLink('https://wa.me/123')).toBe(true);
    expect(isExternalLink('http://example.com')).toBe(true);
    expect(isExternalLink('file:///Applications')).toBe(false);
    expect(isExternalLink('javascript:alert(1)')).toBe(false);
    expect(isExternalLink('smb://server/share')).toBe(false);
    expect(isExternalLink('::')).toBe(false);
  });
});

describe('secret header', () => {
  const origin = 'http://127.0.0.1:4000';
  it('is added only to requests to the own server', () => {
    expect(withSecret('http://127.0.0.1:4000/api/v1/me', { Accept: 'x' }, origin, 's3cret')).toEqual({ Accept: 'x', Authorization: 'Bearer s3cret' });
    expect(withSecret('http://127.0.0.1:4001/api/v1/me', { Accept: 'x' }, origin, 's3cret')).toEqual({ Accept: 'x' });
    expect(withSecret('https://example.com/', {}, origin, 's3cret')).toEqual({});
  });
  it('replaces any authorization the page tried to send', () => {
    expect(withSecret('http://127.0.0.1:4000/', { authorization: 'Bearer fake' }, origin, 'real')).toEqual({ Authorization: 'Bearer real' });
  });
});

describe('IPC sender checks', () => {
  it('app calls come from the own origin only', () => {
    expect(isFromApp('http://127.0.0.1:4000/ajustes', 'http://127.0.0.1:4000')).toBe(true);
    expect(isFromApp('http://127.0.0.1:4001/', 'http://127.0.0.1:4000')).toBe(false);
    expect(isFromApp(undefined, 'http://127.0.0.1:4000')).toBe(false);
    expect(isFromApp('http://127.0.0.1:4000/', null)).toBe(false);
  });
  it('fatal calls come from the bundled fatal.html only', () => {
    const page = 'file:///app/resources/web/fatal.html';
    expect(isFromFatalPage('file:///app/resources/web/fatal.html?kind=data', page)).toBe(true);
    expect(isFromFatalPage('file:///app/resources/web/index.html', page)).toBe(false);
    expect(isFromFatalPage('http://127.0.0.1:4000/fatal.html', page)).toBe(false);
    expect(isFromFatalPage(undefined, page)).toBe(false);
  });
});
