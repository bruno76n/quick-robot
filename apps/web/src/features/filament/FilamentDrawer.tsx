// Drawer of a filament (docs/06 §6): spools in the order they are used, then the empty ones, and the ledger.
import type { SpoolMovement } from '@app/contract';
import { Button } from '../../components/Button';
import { Drawer } from '../../components/Drawer';
import { Pill, Swatch, type Tone } from '../../components/Pill';
import { Table } from '../../components/Table';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { centsTotal, date, grams, money2d, number1 } from '../../lib/format';
import { useFilament } from './api';

const L = es.screens.filaments;
const MOVE_TONE: Record<SpoolMovement['kind'], Tone> = { purchase: 'info', consumption: '', failure: 'bad', waste: 'warn', adjustment: '' };

export function FilamentDrawer({ id, onClose, onAddSpool }: { id: string | null; onClose: () => void; onAddSpool: (filamentId: string) => void }) {
  const { data: f } = useFilament(id);
  const name = f ? `${f.material} ${f.color}` : '';
  const withMaterial = f?.spools.filter((s) => s.status !== 'empty') ?? [];
  const first = withMaterial.length > 1 ? withMaterial[0]?.id : null;
  const many = (f?.spools.length ?? 0) > 1;
  const brandOf = (spoolId: string) => f?.spools.find((s) => s.id === spoolId)?.brand || es.common.noBrand;
  return (
    <Drawer open={Boolean(id)} kind={L.drawerKind} onClose={onClose}>
      {f ? (
        <>
          <div className="det-h"><Swatch hex={f.hex} /><div><h2>{name}</h2><small>{f.spoolCount ? t('screens.filaments.registered', { count: f.spoolCount }) : L.noSpools}</small></div></div>
          <dl className="dl">
            <div><dt>{L.available}</dt><dd className="num">{grams(f.remainingGrams)}</dd></div>
            <div><dt>{L.value}</dt><dd className="num">{centsTotal(f.valueCents)}</dd></div>
            <div><dt>{L.costPerGram}</dt><dd className="num">{money2d(f.costPerGram)}{many ? <small>{L.averageOfSpools}</small> : null}</dd></div>
            <div><dt>{L.spoolsWithMaterial}</dt><dd className="num">{withMaterial.length}</dd></div>
          </dl>
          <div className="det-a btnrow"><Button size="sm" variant="primary" onClick={() => onAddSpool(f.id)}>{t('screens.filaments.addSpoolOf', { name })}</Button></div>
          {withMaterial.length > 1 ? <p className="note ok mt">{t('screens.filaments.asOne', { count: withMaterial.length, grams: grams(f.remainingGrams), name })}</p> : null}
          <h3>{L.spools}</h3>
          {f.spools.length ? (
            <ul className="rolls">
              {f.spools.map((s) => (
                <li className="roll" key={s.id}>
                  <div className="roll-h"><b>{s.brand || es.common.noBrand}</b>{s.id === first ? <Pill tone="info">{L.usedFirst}</Pill> : s.status === 'empty' ? <Pill tone="plain">{es.status.spool.empty}</Pill> : null}</div>
                  <div className="roll-s"><span className={`stk${s.remainingGrams <= 150 ? ' low' : ''}`}><i style={{ width: `${Math.min(100, (s.remainingGrams / s.grams) * 100)}%` }} /></span><span className="num">{grams(s.remainingGrams)} <small>{t('screens.filaments.spoolOfTotal', { total: grams(s.grams) })}</small></span></div>
                  <small>{t('screens.filaments.spoolLine', { date: date(s.purchasedOn), cost: centsTotal(s.costCents + s.shippingCents), perGram: money2d(s.costPerGram) })}</small>
                </li>
              ))}
            </ul>
          ) : <p className="muted">{L.noSpoolsHint}</p>}
          {f.movements.length ? (
            <>
              <h3>{L.movements}</h3>
              <p className="hint">{L.movementsHint}</p>
              <Table small head={<><th>{L.colDate}</th>{many ? <th>{L.colSpool}</th> : null}<th>{L.colMovement}</th><th className="r">{L.colGrams}</th><th>{L.colNote}</th></>}>
                {f.movements.slice(0, 14).map((m) => (
                  <tr key={m.id}>
                    <td>{date(m.on)}</td>
                    {many ? <td>{brandOf(m.spoolId)}</td> : null}
                    <td><Pill tone={MOVE_TONE[m.kind]}>{es.status.spoolMovement[m.kind]}</Pill></td>
                    <td className={`r num${m.grams >= 0 ? ' pos' : ''}`}>{m.grams > 0 ? '+' : ''}{number1(m.grams)}</td>
                    <td className="nota">{m.note || (m.kind === 'purchase' ? L.purchaseNote : '')}</td>
                  </tr>
                ))}
              </Table>
            </>
          ) : null}
        </>
      ) : <div className="skel" />}
    </Drawer>
  );
}
