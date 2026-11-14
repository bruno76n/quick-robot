// The compact summary of Ventas (mockup briefHTML compacto): one sentence and "of every $100 sold, where it goes".
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { moneyTotal, number1 } from '../../lib/format';
import { rich } from './rich';

const L = es.screens.sales;
export interface BriefTotals { count: number; income: number; cost: number; commission: number; profit: number }
export interface BriefConcepts { M: number; L: number; Q: number; E: number; F: number }

const p100 = (x: number) => `$${x >= 10 ? Math.round(x) : number1(x)}`;

export function SalesBrief({ T, K, when }: { T: BriefTotals; K: BriefConcepts; when: string }) {
  if (!T.count) return <section className="brf one"><p className="brf-l mut">{L.briefEmpty}</p></section>;
  const segs: [string, number, string, string][] = [
    [L.cMaterial, K.M, '--c-m', ''], [L.cPower, K.L, '--c-l', ''], [L.cMachine, K.Q, '--c-q', ''], [L.cExtras, K.E, '--c-e', 'dk'],
    [L.cFailure, K.F, '--c-f', 'hatch'], [L.cCommission, T.commission, '--c-t', ''],
  ];
  segs.push([L.cProfit, Math.max(0, T.income - segs.reduce((a, s) => a + s[1], 0)), '--green', 'gan dk']);
  const base = T.income;
  const scale = Math.max(base, segs.reduce((a, s) => a + s[1], 0), 1);
  return (
    <section className="brf" aria-label={L.briefLabel}>
      <div className="brf-t">
        <p className="brf-l">{rich(L.brief, { count: T.count, when }, { income: <b>{moneyTotal(T.income)}</b>, profit: <b className={T.profit < 0 ? 'r' : 'g'}>{moneyTotal(T.profit)}</b> })}</p>
      </div>
      <div className="brf-m">
        <h3 className="brf-h">{L.briefBarTitle}</h3>
        <div className="c100" role="img" aria-label={L.briefBarAria}>
          {segs.filter((s) => s[1] > 0).map((s) => {
            const w = (s[1] / scale) * 100;
            return (
              <i key={s[0]} className={s[3]} style={{ width: `${w.toFixed(2)}%`, ['--s' as string]: `var(${s[2]})` }} data-tip={t('screens.sales.briefTip', { name: s[0], amount: moneyTotal(s[1]), per: p100((s[1] / base) * 100) })} tabIndex={0}>
                {w >= 9 && base ? <span>{p100((s[1] / base) * 100)}</span> : null}
              </i>
            );
          })}
        </div>
        <ul className="c100-l">
          {segs.map((s) => <li key={s[0]} className={s[3]}><span className="lk" style={{ ['--s' as string]: `var(${s[2]})` }} /><span className="nm">{s[0]} <small>{moneyTotal(s[1])}</small></span><b className="num">{p100((s[1] / base) * 100)}</b></li>)}
        </ul>
      </div>
    </section>
  );
}
