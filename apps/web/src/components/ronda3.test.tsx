// Shared panels, figures and charts of ronda 3 (B5): the rules that phase C relies on.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AlertList, AlertRow } from './AlertRow';
import { HBarList, Per100Bar, per100, rankItems, WeekColumns, weekHeights } from './charts';
import { Kpis } from './Kpis';
import { Meter, pctOf } from './Meter';
import { Count, Panel } from './Panel';
import { PieceThumb } from './PieceThumb';
import { Steps } from './Steps';

afterEach(cleanup);
const width = (el: Element | null | undefined) => (el as HTMLElement | null)?.style.width;
const height = (el: Element | null | undefined) => (el as HTMLElement | null)?.style.height;

describe('ronda 3 shared components', () => {
  it('Panel: title on the left, its action on the right; no header without them; Count light or dark', () => {
    const { rerender } = render(<Panel title="Alertas" aside={<Count n={5} />}><p>x</p></Panel>);
    expect(screen.getByRole('heading', { name: 'Alertas' }).tagName).toBe('H2');
    expect(document.querySelector('.panel-a .count')?.textContent).toBe('5');
    rerender(<Panel flush><p>x</p></Panel>);
    expect(document.querySelector('.panel.flush')).toBeTruthy();
    expect(document.querySelector('.panel-h')).toBeNull();
    rerender(<Count n={2} light />);
    expect(document.querySelector('.count')?.className).toBe('count num lt');
  });

  it('Kpis: one strip with as many columns as figures (n3, n4), tones and sub lines', () => {
    const { rerender } = render(<Kpis label="Cifras" items={[{ label: 'Ventas', value: '$1' }, { label: 'Ganancia', value: '$2', tone: 'net' }, { label: 'Saldo', value: '$3', tone: 'bad' }]} />);
    const dl = screen.getByLabelText('Cifras');
    expect(dl.className).toBe('kps n3 row');
    expect(dl.querySelectorAll('.kp')).toHaveLength(3);
    expect(dl.querySelector('.kp.net dd')?.textContent).toBe('$2');
    rerender(<Kpis inline items={[{ label: 'A', value: '1', sub: '▲ 5%', tone: 'up' }, { label: 'B', value: '2' }, { label: 'C', value: '3' }, { label: 'D', value: '4' }]} />);
    expect(document.querySelector('dl')?.className).toBe('kps n4 inline');
    expect(document.querySelector('.kp.up small')?.textContent).toBe('▲ 5%');
  });

  it('Meter keeps the fill between 0 and 100 % and names itself only with a label', () => {
    expect([pctOf(50), pctOf(150), pctOf(-5), pctOf(3, 0), pctOf(Number.NaN), pctOf(30, 60)]).toEqual([50, 100, 0, 0, 0, 50]);
    const { rerender } = render(<Meter value={150} tone="warn" label="Avance" />);
    const m = screen.getByRole('meter', { name: 'Avance' });
    expect(m.className).toBe('meter warn');
    expect(width(m.firstElementChild)).toBe('100%');
    expect(m.getAttribute('aria-valuenow')).toBe('100');
    rerender(<Meter value={-3} />);
    expect(width(document.querySelector('.meter i'))).toBe('0%');
    expect(document.querySelector('.meter')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('WeekColumns: heights proportional to the largest sales, profit inside its own column, .tcol on each column', () => {
    expect(weekHeights([{ sales: 200, profit: 100 }, { sales: 100, profit: 150 }, { sales: 0, profit: 0 }])).toEqual([{ sales: 100, profit: 50 }, { sales: 50, profit: 100 }, { sales: 0, profit: 0 }]);
    render(<WeekColumns label="Ventas por semana" testId="cols" legend={{ sales: 'Ventas', profit: 'Ganancia bruta' }}
      columns={[{ key: 'a', label: '20 oct', sales: 400, profit: 100, display: '$4' }, { key: 'b', label: '27 oct', sales: 100, profit: 50, display: '$1', title: 'detalle' }]} />);
    const cols = screen.getByTestId('cols').querySelectorAll('.tcol');
    expect(cols).toHaveLength(2);
    expect(height(cols[0]!.querySelector('.s'))).toBe('100%');
    expect(height(cols[0]!.querySelector('.g'))).toBe('25%');
    expect(height(cols[1]!.querySelector('.s'))).toBe('25%');
    expect(height(cols[1]!.querySelector('.g'))).toBe('50%');
    expect(cols[1]!.getAttribute('title')).toBe('detalle');
    expect(cols[0]!.getAttribute('tabindex')).toBe('0');
    expect(screen.getByRole('img', { name: 'Ventas por semana' })).toBeTruthy();
    expect(document.querySelector('figcaption')?.textContent).toBe('VentasGanancia bruta');
  });

  it('Per100Bar: the two parts add up to 100; a loss is all cost; the list goes from largest to smallest', () => {
    expect(per100(62.1, 37.9)).toEqual({ cost: expect.closeTo(62.1, 6), net: expect.closeTo(37.9, 6) });
    const { cost, net } = per100(3, 7);
    expect(cost + net).toBe(100);
    expect(per100(10, -4)).toEqual({ cost: 100, net: 0 });
    expect(per100(0, 0)).toEqual({ cost: 0, net: 0 });
    render(<Per100Bar label="De cada $100" cost={{ label: 'Costos y gastos', value: 62.1, display: '$62.10' }} net={{ label: 'Ganancia neta', value: 37.9, display: '$37.90' }}
      items={[{ key: 'm', label: 'Material', value: 8.7, display: '$8.70' }, { key: 'g', label: 'Gastos', value: 43, display: '$43.00' }, { key: 'q', label: 'Máquina', value: 5.4, display: '$5.40' }]} />);
    const parts = [...document.querySelectorAll('.p100-bar i')].map((i) => parseFloat(width(i) ?? '0'));
    expect(parts[0]! + parts[1]!).toBeCloseTo(100, 6);
    expect([...document.querySelectorAll('.p100-l li span:first-child')].map((x) => x.textContent)).toEqual(['Gastos', 'Material', 'Máquina']);
    expect(width(document.querySelector('.p100-l li .hb-track i'))).toBe('100%');
  });

  it('HBarList: sorted from largest to smallest, bars as % of the largest, rows as buttons when they open something', () => {
    expect(rankItems([{ value: 1 }, { value: 4 }, { value: 2 }]).map((r) => [r.item.value, r.pct])).toEqual([[4, 100], [2, 50], [1, 25]]);
    const open = vi.fn();
    render(<HBarList tone="green" label="Productos con más ganancia" items={[{ key: 'a', label: 'Llavero', value: 100, display: '$100' }, { key: 'b', label: 'Dragón', meta: '5 vendidas', value: 400, display: '$400', onClick: open, actionLabel: 'Abrir Dragón' }]} />);
    const list = screen.getByLabelText('Productos con más ganancia');
    expect(list.className).toBe('hbl green');
    expect([...list.querySelectorAll('.hbl-n b')].map((b) => b.textContent)).toEqual(['Dragón', 'Llavero']);
    expect(width(list.querySelectorAll('.hb-track i')[1])).toBe('25%');
    fireEvent.keyDown(screen.getByRole('button', { name: 'Abrir Dragón' }), { key: 'Enter' });
    expect(open).toHaveBeenCalledOnce();
  });

  it('Steps: done before the current one, the current one marked, a date only when it comes', () => {
    render(<Steps label="Pasos" current={2} steps={[{ key: 'q', label: 'Cotizado', date: '2 nov' }, { key: 'a', label: 'Aceptado' }, { key: 'p', label: 'En producción', date: '12 nov' }, { key: 'r', label: 'Listo' }, { key: 'd', label: 'Entregado' }]} />);
    const li = [...screen.getByLabelText('Pasos').querySelectorAll('li')];
    expect(li.map((x) => x.className)).toEqual(['done', 'done', 'cur', '', '']);
    expect(li[2]!.getAttribute('aria-current')).toBe('step');
    expect(li.map((x) => x.querySelector('small')?.textContent ?? null)).toEqual(['2 nov', null, '12 nov', null, null]);
    expect(li[0]!.querySelector('.dot svg')).toBeTruthy();
    expect(li[3]!.querySelector('.dot svg')).toBeNull();
  });

  it('AlertRow: icon square in the tone, title, detail and action', () => {
    render(<AlertList label="Alertas"><AlertRow tone="bad" icon="warn" title="Pedido #5" detail="Fecha de entrega: hoy" action={<button type="button">Abrir pedido</button>} /></AlertList>);
    expect(document.querySelector('.al-ic.bad svg')).toBeTruthy();
    expect(document.querySelector('.al-t b')?.textContent).toBe('Pedido #5');
    expect(screen.getByRole('button', { name: 'Abrir pedido' })).toBeTruthy();
  });

  it('PieceThumb: the photo when there is one, otherwise a cube in the first filament color (or --no-color)', () => {
    const { rerender } = render(<PieceThumb photoUrl="/p.jpg" hexes={['#ff0000']} />);
    expect(document.querySelector('.thumb.photo img')?.getAttribute('src')).toBe('/p.jpg');
    expect(document.querySelector('.thumb svg')).toBeNull();
    rerender(<PieceThumb hexes={['#d8283f', '#00ff00']} shape="wide" />);
    const cube = document.querySelector('.thumb.cube.wide') as HTMLElement;
    expect(cube.style.getPropertyValue('--pc')).toBe('#d8283f');
    expect(cube.querySelectorAll('path')).toHaveLength(4);
    rerender(<PieceThumb hexes={[]} size={38} />);
    const sq = document.querySelector('.thumb.cube.square') as HTMLElement;
    expect(sq.style.getPropertyValue('--pc')).toBe('var(--no-color)');
    expect(sq.style.width).toBe('38px');
  });
});
