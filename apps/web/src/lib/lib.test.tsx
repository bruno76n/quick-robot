import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useToast } from '../components/Toast';
import { api, ApiError } from './api';
import { initialsOf } from './initials';
import { parseNumber, todayLocal } from './input';
import { useWrite } from './mutate';
import { go, setNavigator } from './nav';
import { isDesktop, printPage, saveFile } from './platform';

const json = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
afterEach(() => { vi.restoreAllMocks(); delete window.desktop; });

describe('api client', () => {
  it('returns data and warnings; sends JSON with the right method and path', async () => {
    const f = vi.spyOn(globalThis, 'fetch').mockImplementation(() => json(201, { data: { id: 'x' }, warnings: [{ code: 'STOCK_SHORT' }] }));
    const r = await api.supplies.purchase('abc', { qty: 1, on: '2026-11-01' });
    expect(r).toEqual({ data: { id: 'x' }, warnings: [{ code: 'STOCK_SHORT' }] });
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe('/api/v1/supplies/abc/purchases');
    expect(init).toMatchObject({ method: 'POST', headers: { 'content-type': 'application/json' } });
  });

  it('turns error bodies into ApiError with code, details and errorId', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => json(409, { code: 'LAST_CHANNEL', message: 'x', details: { a: 1 } }));
    await expect(api.settings.removeChannel('c')).rejects.toMatchObject({ code: 'LAST_CHANNEL', status: 409, details: { a: 1 } });
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(new Response('oops', { status: 502 })));
    await expect(api.me()).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
  });

  it('network failures are NETWORK_ERROR; 204 has no data; uploads go as form data', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.reject(new TypeError('down')));
    await expect(api.printers.list()).rejects.toBeInstanceOf(ApiError);
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(new Response(null, { status: 204 })));
    expect((await api.products.remove('p')).data).toBeUndefined();
    const f = vi.spyOn(globalThis, 'fetch').mockImplementation(() => json(201, { data: { fileId: 'f', url: '/u' } }));
    await api.files.upload('product_photo', new Blob(['x']));
    expect(f.mock.calls.at(-1)![1]!.body).toBeInstanceOf(FormData);
    expect(f.mock.calls.at(-1)![1]!.headers).toEqual({});
  });

  it('every endpoint builds its path', async () => {
    const f = vi.spyOn(globalThis, 'fetch').mockImplementation(() => json(200, { data: {} }));
    const calls = [
      api.health(), api.filaments.list({ q: 'pla', page: 2 }), api.filaments.get('f'), api.spools.add({} as never), api.spools.update('s', {}), api.spools.remove('s'), api.spools.restore('s'),
      api.spools.move('s', {} as never), api.settings.get(), api.settings.update({}), api.settings.addChannel({} as never), api.settings.updateChannel('c', {}),
      api.suppliers.list(), api.suppliers.create({} as never), api.suppliers.update('s', {} as never), api.suppliers.remove('s'), api.suppliers.restore('s'),
      api.supplies.list(), api.supplies.get('s'), api.supplies.create({} as never), api.supplies.update('s', {} as never), api.supplies.remove('s'), api.supplies.restore('s'), api.supplies.move('s', {} as never),
      api.printers.create({} as never), api.printers.update('p', {} as never), api.printers.remove('p'), api.printers.restore('p'), api.printers.addTask('p', {} as never),
      api.printers.updateTask('p', 't', {} as never), api.printers.removeTask('p', 't'), api.printers.completeTask('p', 't', {} as never),
      api.products.list(), api.products.get('p'), api.products.create({} as never), api.products.update('p', {} as never), api.products.variant('p', {} as never), api.products.restore('p'),
      api.collections.list(), api.collections.get('c'), api.collections.create({} as never), api.collections.update('c', {} as never), api.collections.remove('c'), api.collections.restore('c'),
    ];
    await Promise.all(calls);
    expect(f.mock.calls.map((c) => c[0])).toContain('/api/v1/filaments?q=pla&page=2');
    expect(f).toHaveBeenCalledTimes(calls.length);
  });
});

describe('input, navigation and platform', () => {
  it('reads numbers as the mockup did', () => {
    expect(parseNumber('1,250')).toBe(1250);
    expect(parseNumber('$35.95')).toBe(35.95);
    expect(parseNumber('abc', 7)).toBe(7);
    expect(todayLocal(new Date('2026-11-01T12:00:00'))).toBe('2026-11-01');
  });

  it('go() uses the bound navigator', () => {
    const nav = vi.fn();
    setNavigator(nav);
    go('/productos', true);
    expect(nav).toHaveBeenCalledWith('/productos', true);
  });

  it('native functions are used only when they exist', async () => {
    expect(isDesktop()).toBe(false);
    const saveNative = vi.fn(async () => true);
    const printNative = vi.fn(async () => undefined);
    window.desktop = { saveFile: saveNative, print: printNative };
    expect(isDesktop()).toBe(true);
    await saveFile('a.csv', new Uint8Array([1]), 'text/csv');
    await printPage();
    expect(saveNative).toHaveBeenCalled();
    expect(printNative).toHaveBeenCalled();
    delete window.desktop;
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    await saveFile('a.csv', new Uint8Array([1]), 'text/csv');
    expect(click).toHaveBeenCalled();
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    await printPage();
    expect(print).toHaveBeenCalled();
  });
});

describe('useWrite', () => {
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
  it('shows the ok toast with Deshacer, and the error text on failure', async () => {
    const restore = vi.fn(async () => undefined);
    const { result } = renderHook(() => useWrite(async (x: number) => ({ data: x * 2 }), { touches: ['supplies'], ok: (out) => `ok ${out}`, undo: () => restore }), { wrapper });
    await act(async () => { result.current.mutate(2); });
    await waitFor(() => expect(useToast.getState().text).toBe('ok 4'));
    await act(async () => { useToast.getState().undo!(); });
    await waitFor(() => expect(useToast.getState().text).toBe('Cambio deshecho.'));
    const fail = renderHook(() => useWrite(async () => { throw new ApiError('LAST_CHANNEL', 409); }, { touches: ['settings'] }), { wrapper });
    await act(async () => { fail.result.current.mutate(undefined); });
    await waitFor(() => expect(useToast.getState().text).toBe('Debe quedar al menos un canal de venta.'));
  });
});

describe('initialsOf (business monogram)', () => {
  it('two words give their first letters; connectors are skipped', () => {
    expect(initialsOf('Mi negocio')).toBe('MN');
    expect(initialsOf('Taller de Ana')).toBe('TA');
    expect(initialsOf('impresiones   del   norte  3D')).toBe('IN');
  });
  it('one word gives its first two letters', () => {
    expect(initialsOf('Prototipos')).toBe('PR');
    expect(initialsOf('X')).toBe('X');
  });
  it('keeps accents and ñ, ignores symbols and emoji', () => {
    expect(initialsOf('Ángel Óptica')).toBe('ÁÓ');
    expect(initialsOf('ñandú')).toBe('ÑA');
    expect(initialsOf('“El Ñu” & Co.')).toBe('ÑC');
    expect(initialsOf('🚀 3D Lab')).toBe('3L');
  });
  it('empty or without letters gives an empty string', () => {
    expect(initialsOf('')).toBe('');
    expect(initialsOf('   ')).toBe('');
    expect(initialsOf('— · —')).toBe('');
  });
});
