import { cn } from '../lib/cn';

/** Shape from the id (mockup `forma`): same piece, same silhouette. */
const shapeOf = (id: string) => [...id].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 3;

/** A piece drawn in layers with its filament colors (mockup `pieza3d`). */
export function Piece3D({ hexes, id, small, className }: { hexes: readonly string[]; id: string; small?: boolean; className?: string }) {
  const hs = hexes.length ? hexes : ['#c9c9d1'];
  const n = hs.length;
  const stops = hs.map((h, i) => `${h} ${(i * 100) / n}% ${((i + 1) * 100) / n}%`).join(',');
  return <span aria-hidden="true" className={cn('lay', `s${shapeOf(id)}`, small && 'sm', className)} style={{ ['--lb' as string]: `linear-gradient(to top,${stops})` }} />;
}

/** Cost (grey) vs profit (green) over the price (mockup `mbar`). */
export function MiniBar({ cost, price, title, className }: { cost: number; price: number; title?: string; className?: string }) {
  if (price <= 0) return <span className={cn('mbar', className)} />;
  const c = Math.min(100, (cost / price) * 100);
  return (
    <span className={cn('mbar', cost > price && 'loss', className)} title={title}>
      <i className="c" style={{ width: `${c}%` }} />
      <i className="g" style={{ width: `${100 - c}%` }} />
    </span>
  );
}
