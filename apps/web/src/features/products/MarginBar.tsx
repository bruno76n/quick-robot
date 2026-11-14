/** Cost against price: gray is cost, green is profit (mockup `mbar`). */
export function MarginBar({ cost, price }: { cost: number; price: number }) {
  if (price <= 0) return <span className="mbar" />;
  const c = Math.min(100, (cost / price) * 100);
  return <span className={`mbar${cost > price ? ' loss' : ''}`}><i className="c" style={{ width: `${c}%` }} /><i className="g" style={{ width: `${100 - c}%` }} /></span>;
}
