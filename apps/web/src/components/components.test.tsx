import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell';
import { Banner } from './Banner';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { Drawer } from './Drawer';
import { ErrorBoundary } from './ErrorBoundary';
import { Field } from './Field';
import { Icon } from './Icon';
import { Mascot } from './Mascot';
import { Pill, Swatch } from './Pill';
import { Segmented } from './Segmented';
import { Table, Td, Th } from './Table';
import { toast, ToastViewport, useToast } from './Toast';
import { UnitInput } from './UnitInput';

afterEach(() => { cleanup(); vi.useRealTimers(); useToast.getState().hide(); });

describe('components', () => {
  it('Button: variants, icon and busy state disable it with its label', () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button variant="primary" size="sm" icon="plus" onClick={onClick}>Ok</Button>);
    const b = screen.getByRole('button');
    expect(b.className).toBe('btn primary sm');
    fireEvent.click(b);
    expect(onClick).toHaveBeenCalledOnce();
    rerender(<Button busy busyLabel="…">Ok</Button>);
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('button').textContent).toBe('…');
    rerender(<Button variant="link">L</Button>);
    expect(screen.getByRole('button').className).toBe('link');
  });

  it('Field shows the error instead of the hint; UnitInput keeps its unit', () => {
    const { rerender } = render(<Field label="Costo" hint="ayuda"><UnitInput unit="$" defaultValue="3" /></Field>);
    expect(screen.getByText('ayuda')).toBeTruthy();
    expect(screen.getByText('$')).toBeTruthy();
    rerender(<Field label="Costo" hint="ayuda" error="mal"><input /></Field>);
    expect(screen.getByRole('alert').textContent).toBe('mal');
    expect(screen.queryByText('ayuda')).toBeNull();
  });

  it('Pill, Swatch, Icon, Mascot, Table and Banner render', () => {
    render(<><Pill tone="bad">Agotado</Pill><Swatch hex="#ff0000" large /><Icon name="spool" /><Icon name="nope" /><Mascot size={60} /><Table small head={<th>A</th>}><tr><td>1</td></tr></Table><Banner action={<button type="button">r</button>}>x</Banner></>);
    expect(screen.getByText('Agotado').className).toBe('chip bad');
    expect(document.querySelector('.sw.lg')).toBeTruthy();
    expect(document.querySelectorAll('svg.ic')).toHaveLength(2);
    expect(document.querySelector('img.mascot')?.getAttribute('height')).toBe('53');
    expect(document.querySelector('table.tbl.sm')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('x');
  });

  it('Pill keeps the text and maps the tone to its class; ok is the same green as good', () => {
    render(<><Pill tone="ok">Disponible</Pill><Pill tone="warn">Stock bajo</Pill><Pill tone="bad">Crítico</Pill><Pill tone="info">Info</Pill><Pill>Sin tono</Pill></>);
    expect(screen.getByText('Disponible').className).toBe('chip good');
    expect(screen.getByText('Stock bajo').className).toBe('chip warn');
    expect(screen.getByText('Crítico').className).toBe('chip bad');
    expect(screen.getByText('Info').className).toBe('chip info');
    expect(screen.getByText('Sin tono').className.trim()).toBe('chip');
  });

  it('Button sizes: md is the plain button, sm adds .sm; green and primary are both the main action', () => {
    render(<><Button>Md</Button><Button size="sm">Sm</Button><Button variant="green">G</Button><Button variant="primary" block>P</Button></>);
    expect(screen.getByRole('button', { name: 'Md' }).className).toBe('btn');
    expect(screen.getByRole('button', { name: 'Sm' }).className).toBe('btn sm');
    expect(screen.getByRole('button', { name: 'G' }).className).toBe('btn green');
    expect(screen.getByRole('button', { name: 'P' }).className).toBe('btn primary block');
  });

  it('Table: Th and Td mark number columns (.r) and columns hidden on a phone (.hide-sm)', () => {
    render(<Table head={<><Th>Producto</Th><Th r hideSm>Costo</Th><Th r>Ganancia</Th></>}><tr><Td>Llavero</Td><Td r hideSm className="num">$10</Td><Td r>$40</Td></tr></Table>);
    const th = [...document.querySelectorAll('th')].map((x) => x.getAttribute('class'));
    expect(th).toEqual([null, 'r hide-sm', 'r']);
    expect(screen.getByText('$10').className).toBe('r hide-sm num');
    expect(screen.getByText('Llavero').getAttribute('class')).toBeNull();
    expect(document.querySelector('table')?.className.trim()).toBe('tbl');
    cleanup();
    render(<Table fit head={<Th>A</Th>}><tr><Td>1</Td></tr></Table>);
    expect(document.querySelector('table')?.className.trim()).toBe('tbl fit');
  });

  it('Segmented marks the current option', () => {
    const onChange = vi.fn();
    render(<Segmented label="Vista" value="a" options={[{ value: 'a', label: 'A', count: 2 }, { value: 'b', label: 'B' }]} onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'A2' }).className).toBe('on');
    fireEvent.click(screen.getByRole('button', { name: 'B' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('Dialog: submit, cancel and Esc', () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    const { rerender } = render(<Dialog open title="Agregar" onClose={onClose} onSubmit={onSubmit} submitLabel="Listo"><input name="x" /></Dialog>);
    fireEvent.click(screen.getByRole('button', { name: 'Listo' }));
    expect(onSubmit).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalledOnce();
    fireEvent(document.querySelector('dialog')!, new Event('cancel', { cancelable: true }));
    expect(onClose).toHaveBeenCalledTimes(2);
    rerender(<Dialog open={false} title="Agregar" onClose={onClose}><input /></Dialog>);
    expect(screen.queryByText('Agregar')).toBeNull();
  });

  it('Dialog initial focus (T1): the marked field first; else the first visible field that is not radio, checkbox or date', () => {
    const { unmount } = render(<Dialog open title="Hecho" onClose={vi.fn()}><input type="radio" name="m" aria-label="Motivo" /><input type="date" aria-label="Fecha" /><div hidden><input aria-label="Oculto" /></div><input aria-label="Costo" /><input aria-label="Nota" /></Dialog>);
    expect(document.activeElement).toBe(screen.getByLabelText('Costo'));
    unmount();
    render(<Dialog open title="Rollo" onClose={vi.fn()}><select aria-label="Motivo"><option>Uso</option></select><input aria-label="Cantidad" data-autofocus="" /></Dialog>);
    expect(document.activeElement).toBe(screen.getByLabelText('Cantidad'));
  });

  it('Drawer: content only while open, closes with Esc and with the button', () => {
    const onClose = vi.fn();
    const { rerender } = render(<Drawer open kind="Filamento" onClose={onClose}><p>dentro</p></Drawer>);
    expect(screen.getByText('dentro')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar el detalle' }));
    expect(onClose).toHaveBeenCalledTimes(2);
    rerender(<Drawer open={false} kind="Filamento" onClose={onClose}><p>dentro</p></Drawer>);
    expect(screen.queryByText('dentro')).toBeNull();
  });

  it('Toast: shows, offers Deshacer and hides by itself', () => {
    vi.useFakeTimers();
    const undo = vi.fn();
    render(<ToastViewport />);
    act(() => toast('Rollo eliminado', undo));
    expect(screen.getByRole('status').textContent).toContain('Rollo eliminado');
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(undo).toHaveBeenCalledOnce();
    act(() => toast('Guardado'));
    act(() => { vi.advanceTimersByTime(3300); });
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('ErrorBoundary: a broken screen shows the card with a code, and Volver al Inicio resets', () => {
    const Boom = () => { throw new Error('boom'); };
    const onHome = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<ErrorBoundary onHome={onHome}><Boom /></ErrorBoundary>);
    expect(screen.getByRole('alert').textContent).toContain('Esta pantalla no se pudo mostrar.');
    expect(screen.getByText(/Código: /)).toBeTruthy();
    expect(screen.queryByText('boom')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Volver al Inicio' }));
    expect(onHome).toHaveBeenCalledOnce();
  });
});

describe('neutral sidebar (ronda-2 §2)', () => {
  const shell = async (businessName: string, trade: string) => {
    const root = createRootRoute({ component: () => <AppShell businessName={businessName} trade={trade}><p>vista</p></AppShell> });
    render(<RouterProvider router={createRouter({ routeTree: root, history: createMemoryHistory({ initialEntries: ['/inicio'] }) })} />);
    await waitFor(() => expect(screen.getByText('vista')).toBeTruthy());
    return document.querySelector('.brand')!;
  };

  it('shows the mascot, the name and the trade from Ajustes', async () => {
    const brand = await shell('Taller de Ana', 'Impresión 3D');
    expect(brand.querySelector('img.mascot')).toBeTruthy();
    expect(brand.querySelector('b')?.textContent).toBe('Taller de Ana');
    expect(brand.querySelector('b')?.className ?? '').not.toContain('ph-txt');
    expect(brand.querySelector('small')?.textContent).toBe('Impresión 3D');
    expect(document.querySelector('.topbar img.mascot')).toBeTruthy();
  });

  it('without a name or trade shows "Mi negocio" and "Giro del negocio" in grey', async () => {
    const brand = await shell('  ', '');
    expect(brand.querySelector('b.ph-txt')?.textContent).toBe('Mi negocio');
    expect(brand.querySelector('small.ph-txt')?.textContent).toBe('Giro del negocio');
    expect(document.querySelector('.topbar .ph-txt')?.textContent).toBe('Mi negocio');
  });
});
