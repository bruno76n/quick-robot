import type { CSSProperties } from 'react';

/** A printed piece drawn in layers with the color of its filaments (the mockup's `pieza3d`). */
export const shapeOf = (id: string) => [...id].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 3;
export function Piece3d({ hexes, id, cls = '', pct }: { hexes: readonly string[]; id: string; cls?: string; pct?: number }) {
  const hs = hexes.length ? hexes : ['#c9c9d1'];
  const stops = hs.map((h, i) => `${h} ${(i * 100) / hs.length}% ${((i + 1) * 100) / hs.length}%`).join(',');
  const style = { '--lb': `linear-gradient(to top,${stops})`, ...(pct !== undefined && pct < 100 ? { '--p': `${pct}%` } : {}) } as CSSProperties;
  return <span className={`lay s${shapeOf(id)} ${cls}`} style={style} />;
}

/** Cost against price: gray is cost, green is profit (mockup `mbar`). */
export function MarginBar({ cost, price }: { cost: number; price: number }) {
  if (price <= 0) return <span className="mbar" />;
  const c = Math.min(100, (cost / price) * 100);
  return <span className={`mbar${cost > price ? ' loss' : ''}`}><i className="c" style={{ width: `${c}%` }} /><i className="g" style={{ width: `${100 - c}%` }} /></span>;
}
