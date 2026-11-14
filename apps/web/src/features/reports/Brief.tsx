// Split bar (mockup c100Bar): the inventory of Reportes. The brief sentence left in ronda 3 (§6).
import type { CSSProperties } from 'react';
import { t } from '../../i18n/t';
import { centsTotal, number1 } from '../../lib/format';

/** "$43" or "$8.7": what goes to each concept out of every $100. */
export const per100 = (x: number) => `$${x >= 10 ? Math.round(x) : number1(x)}`;

export type Seg = [name: string, cents: number, cssVar: string, cls?: string];

/** Split bar (mockup c100Bar). base = what 100% is worth (0: show amounts instead of shares). */
export function C100Bar({ segs, base, label, cls = '' }: { segs: readonly Seg[]; base: number; label: string; cls?: string }) {
  const tot = segs.reduce((a, s) => a + s[1], 0);
  const scale = Math.max(base, tot, 1);
  return (
    <>
      <div className={`c100 ${cls}`} role="img" aria-label={label}>
        {segs.filter((s) => s[1] > 0).map((s) => {
          const w = (s[1] / scale) * 100;
          const tip = `${s[0]}: ${centsTotal(s[1])}${base ? t('screens.reports.per100Of', { value: per100((s[1] / base) * 100) }) : ''}`;
          return <i key={s[0]} className={s[3] ?? ''} style={{ width: `${w.toFixed(2)}%`, '--s': `var(${s[2]})` } as CSSProperties} title={tip} tabIndex={0}>{w >= 9 && base ? <span>{per100((s[1] / base) * 100)}</span> : null}</i>;
        })}
      </div>
      <ul className="c100-l">
        {segs.map((s) => (
          <li key={s[0]} className={s[3] ?? ''}><span className="lk" style={{ '--s': `var(${s[2]})` } as CSSProperties} /><span className="nm">{s[0]}{base ? <> <small>{centsTotal(s[1])}</small></> : null}</span><b className="num">{base ? per100((s[1] / base) * 100) : centsTotal(s[1])}</b></li>
        ))}
      </ul>
    </>
  );
}
