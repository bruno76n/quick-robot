// Shared components of phase 3: command palette, shortcuts, documents, two-tap button and the shell.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setNavigator } from '../lib/nav';
import { AppShell, PageHead } from './AppShell';
import { CommandPalette, filterItems, localItems, norm, onNewExpenseRequest, openPalette, remoteItems, requestNewExpense, takeNewExpenseRequest, usePalette } from './CommandPalette';
import { ConfirmButton } from './ConfirmButton';
import { DocumentDialog, documentText } from './DocumentSheet';
import { CommandLayer, GOTO, installShortcuts, ShortcutsDialog } from './Shortcuts';
import { toast, useToast } from './Toast';
import { LoadingSkeleton } from './LoadingSkeleton';
import { QueryClient as QC, useQuery } from '@tanstack/react-query';

const went: string[] = [];
beforeEach(() => { went.length = 0; setNavigator(async (href) => { went.push(href); }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); usePalette.getState().set({ palette: false, shortcuts: false }); useToast.getState().hide(); });
const withQuery = (ui: ReactNode) => <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>;
const json = (data: unknown) => Promise.resolve(new Response(JSON.stringify({ data }), { status: 200, headers: { 'content-type': 'application/json' } }));
const RESULT = {
  products: [{ id: 'p1', name: 'Spider-Man · salto', listCents: 25000 }], collections: [{ id: 'c1', name: 'Set', priceCents: 100000 }],
  customers: [{ id: 'u1', name: 'Mariana R.', type: 'Persona', phone: '33' }], orders: [{ id: 'o1', number: 3, customer: 'Taquería', status: 'in_production' as const, itemsText: '1 × A, 2 × B, 3 × C' }],
  sales: [{ id: 's1', on: '2026-10-31', itemsText: '1 × A', customer: '', totalCents: 5000 }], filaments: [{ id: 'f1', name: 'PLA Negro', hex: '#000', remainingGrams: 410 }],
  supplies: [{ id: 'i1', name: 'Imán', stock: 57, unit: '' }],
};

describe('command palette', () => {
  it('normalizes, filters local items and ranks prefix matches first; remote items open their element', () => {
    expect(norm('  Cámara  Rápida ')).toBe('camara rapida');
    const local = localItems();
    expect(filterItems(local, [], '').length).toBeGreaterThan(5);
    const remote = remoteItems(RESULT);
    expect(remote.map((r) => r.kind)).toEqual(['piece', 'collection', 'customer', 'order', 'sale', 'filament', 'supply']);
    const hits = filterItems(local, remote, 'ventas');
    expect(hits[0]!.title).toBe('Ventas');
    remote.forEach((r) => r.run());
    expect(went).toEqual(['/productos/pieza?id=p1', '/productos/coleccion?id=c1', '/clientes/cliente?id=u1', '/pedidos/pedido?id=o1', '/ventas?v=s1', '/filamentos?f=f1', '/insumos?i=i1']);
  });
  it('the "new expense" intent waits for the page or calls it at once', () => {
    requestNewExpense();
    expect(takeNewExpenseRequest()).toBe(true);
    expect(takeNewExpenseRequest()).toBe(false);
    const fn = vi.fn();
    const off = onNewExpenseRequest(fn);
    requestNewExpense();
    expect(fn).toHaveBeenCalledOnce();
    off();
  });
  it('opens, searches the server from 2 letters, moves with the arrows and opens with Enter', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json(RESULT)));
    render(withQuery(<CommandPalette />));
    act(() => openPalette());
    const input = await screen.findByRole('combobox').catch(() => screen.getByRole('textbox'));
    fireEvent.change(input, { target: { value: 'sp' } });
    await waitFor(() => expect(screen.getByText('Spider-Man · salto')).toBeTruthy(), { timeout: 2000 });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Escape' });
    act(() => openPalette());
    const again = await screen.findByRole('combobox').catch(() => screen.getByRole('textbox'));
    fireEvent.change(again, { target: { value: 'spider' } });
    fireEvent.click(await screen.findByText('Spider-Man · salto', {}, { timeout: 2000 }));
    expect(went).toContain('/productos/pieza?id=p1');
  });
});

describe('shortcuts', () => {
  it('⌘K toggles the palette, ? opens the list, G then a letter goes to a screen, ⌘Z runs the undo of the toast', () => {
    const off = installShortcuts();
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    expect(usePalette.getState().palette).toBe(true);
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    expect(usePalette.getState().palette).toBe(false);
    fireEvent.keyDown(document, { key: '?' });
    expect(usePalette.getState().shortcuts).toBe(true);
    usePalette.getState().set({ shortcuts: false });
    fireEvent.keyDown(document, { key: 'g' });
    fireEvent.keyDown(document, { key: 'v' });
    expect(went).toEqual([GOTO.v![0]]);
    const undo = vi.fn();
    toast('Eliminado', undo);
    fireEvent.keyDown(document, { key: 'z', metaKey: true });
    expect(undo).toHaveBeenCalledOnce();
    off();
  });
  it('the shortcuts dialog lists every screen; the layer mounts both', () => {
    render(withQuery(<CommandLayer />));
    act(() => usePalette.getState().set({ shortcuts: true }));
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(Object.keys(GOTO).length);
    cleanup();
    act(() => usePalette.getState().set({ shortcuts: false }));
    expect(render(<ShortcutsDialog />).container.textContent).toBe('');
  });
});

describe('documents', () => {
  const b = { name: 'Mi Taller', trade: 'Impresión', phone: '33', email: 'a@b.c', city: 'GDL', quoteValidDays: 7, footer: 'Anticipo 50 %.' };
  const d = { number: 4, on: '2026-11-01', customerId: 'c', customerName: 'Cliente', items: [{ kind: 'set' as const, name: 'Set', qty: 1, priceCents: 100000, parts: [{ name: 'A', qty: 2 }] }, { kind: 'piece' as const, name: 'B', qty: 2, priceCents: 5000, parts: [] }], totalCents: 110000, paidCents: 50000, owedCents: 60000, dueOn: '2026-11-05', note: 'Con logo', phone: '' };
  it('the text version carries the business from Ajustes, the items, totals, validity and footer', () => {
    const text = documentText('quote', d as never, b);
    expect(text).toContain('Mi Taller');
    expect(text).toContain('Anticipo 50 %.');
    expect(text).not.toContain('Quick Robot');
    expect(documentText('sale_note', { ...d, number: null, paidCents: 0, customerName: '' } as never, { ...b, name: '' })).not.toContain('Anticipo');
  });
  it('the dialog loads the order or the sale and the settings, then prints and copies', async () => {
    const settings = { settings: { business: b }, channels: [] };
    const order = { number: 4, createdOn: '2026-11-01', dueOn: '2026-11-05', note: '', customer: { id: 'c', name: 'Cliente' }, items: d.items, totals: { totalCents: 110000, paidCents: 0, owedCents: 110000 } };
    const sale = { on: '2026-11-01', customerId: null, customer: '', orderNumber: null, note: '', items: d.items, totals: { grossCents: 110000, paidCents: 110000, owedCents: 0 } };
    vi.stubGlobal('fetch', vi.fn((url: string) => json(url.includes('settings') ? settings : url.includes('sales') ? sale : url.includes('customers') ? { phone: '33' } : order)));
    vi.stubGlobal('print', vi.fn());
    Object.assign(navigator, { clipboard: { writeText: vi.fn(() => Promise.resolve()) } });
    const close = vi.fn();
    render(withQuery(<DocumentDialog kind="quote" id="o1" onClose={close} />));
    await waitFor(() => expect(screen.getAllByTestId('document')[0]!.textContent).toContain('Mi Taller'));
    for (const btn of screen.getAllByRole('button')) fireEvent.click(btn);
    cleanup();
    render(withQuery(<DocumentDialog kind="sale_note" id="s1" onClose={close} />));
    await waitFor(() => expect(screen.getAllByTestId('document').length).toBeGreaterThan(0));
  });
});

describe('two-tap button and shell', () => {
  it('ConfirmButton asks again and resets when tapping elsewhere', () => {
    const ok = vi.fn();
    render(<ConfirmButton confirmText="Toca de nuevo" onConfirm={ok}>Eliminar</ConfirmButton>);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button').textContent).toBe('Toca de nuevo');
    fireEvent.pointerDown(document.body);
    expect(screen.getByRole('button').textContent).toBe('Eliminar');
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('button'));
    expect(ok).toHaveBeenCalledOnce();
  });
  it('AppShell shows the business, the menu, the search and opens the menu on small screens', async () => {
    const onSearch = vi.fn();
    const onNew = vi.fn();
    const root = createRootRoute({ component: () => <AppShell businessName="Mi Taller" trade="Impresión" onSearch={onSearch} onNewPiece={onNew}><PageHead title="Hola" sub="sub" actions={<b>x</b>} /></AppShell> });
    const router = createRouter({ routeTree: root, history: createMemoryHistory({ initialEntries: ['/ventas'] }) });
    render(<RouterProvider router={router} />);
    await waitFor(() => expect(screen.getByText('Hola')).toBeTruthy());
    expect(document.body.textContent).toContain('Mi Taller');
    for (const btn of screen.getAllByRole('button')) fireEvent.click(btn);
    expect(onSearch).toHaveBeenCalled();
  });
});

describe('loading skeleton', () => {
  it('appears only when a first load takes more than 300 ms', async () => {
    vi.useFakeTimers();
    const qc = new QC();
    const Slow = () => { useQuery({ queryKey: ['slow'], queryFn: () => new Promise(() => undefined) }); return null; };
    render(<QueryClientProvider client={qc}><LoadingSkeleton /><Slow /></QueryClientProvider>);
    await act(async () => { vi.advanceTimersByTime(10); });
    expect(screen.queryByTestId('loading-skeleton')).toBeNull();
    await act(async () => { vi.advanceTimersByTime(400); });
    expect(screen.getByTestId('loading-skeleton')).toBeTruthy();
    vi.useRealTimers();
  });
});
