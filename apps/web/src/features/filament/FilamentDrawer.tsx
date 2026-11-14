// Drawer of a filament (docs/06 §6): spools in the order they are used, then the empty ones, and the ledger.
// Ronda 3: it stays an overlay drawer (exception 2); its content follows the mockup's aside (filamentos.html).
import type { FilamentDetail, SpoolMovement } from '@app/contract';
import { Button } from '../../components/Button';
import { Drawer } from '../../components/Drawer';
import { Meter } from '../../components/Meter';
import { Pill, Swatch } from '../../components/Pill';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { centsTotal, date, grams, money2d } from '../../lib/format';
import { useState } from 'react';
import { useFilament } from './api';
import { FILAMENT_TONE } from './tone';
import { MovementDialog } from './MovementDialog';
import { costSourceShort, perGram, spoolName, SpoolTag } from './spools';

type Spool = FilamentDetail['spools'][number];
const L = es.screens.filaments;

export function FilamentDrawer({ id, onClose, onAddSpool, onEditSpool, onOpenSpool }: { id: string | null; onClose: () => void; onAddSpool: (filamentId: string) => void; onEditSpool: (spoolId: string) => void; onOpenSpool?: (spoolId: string) => void }) {
  const [move, setMove] = useState<{ spoolId?: string } | null>(null);
  const { data: f } = useFilament(id);
  const name = f ? `${f.material} ${f.color}` : '';
  const withMaterial = f?.spools.filter((s) => s.status !== 'empty') ?? [];
  const first = withMaterial.length > 1 ? withMaterial[0]?.id : null;
  const many = (f?.spools.length ?? 0) > 1;
  const brandOf = (spoolId: string) => { const s = f?.spools.find((x) => x.id === spoolId); return s ? `${spoolName(s.number)} · ${s.brand || es.common.noBrand}` : es.common.noBrand; };
  const noteOf = (m: SpoolMovement) => [many ? brandOf(m.spoolId) : '', m.note || (m.kind === 'purchase' ? L.purchaseNote : '')].filter(Boolean).join(' · ');
  return (
    <Drawer open={Boolean(id)} kind={L.drawerKind} onClose={onClose}>
      {f ? (
        <div className="fdr">
          <div className="fdr-h">
            <Swatch hex={f.hex} />
            <div><h2>{name}</h2><small className="meta">{f.spoolCount ? t('screens.filaments.registered', { count: f.spoolCount }) : L.noSpools}</small></div>
            <Pill tone={FILAMENT_TONE[f.status]}>{es.status.filament[f.status]}</Pill>
          </div>
          <dl className="mini-kv">
            <div><dt>{L.available}</dt><dd className="num">{grams(f.remainingGrams)}</dd></div>
            <div><dt>{L.value}</dt><dd className="num">{centsTotal(f.valueCents)}</dd></div>
            <div><dt>{L.costPerGram}</dt><dd className="num">{perGram(f.costPerGram)}<small>{costSourceShort(f)}</small></dd></div>
            <div><dt>{L.spoolsWithMaterial}</dt><dd className="num">{withMaterial.length}</dd></div>
          </dl>
          {withMaterial.length > 1 ? <p className="note ok">{t('screens.filaments.asOne', { count: withMaterial.length, grams: grams(f.remainingGrams), name })}</p> : null}
          <h3 className="lbl">{L.spools}</h3>
          {f.spools.length ? (
            <ul className="rolls">
              {f.spools.map((s) => (
                <SpoolCard key={s.id} s={s} first={s.id === first} onMove={() => setMove({ spoolId: s.id })} onEdit={() => onEditSpool(s.id)} onOpen={onOpenSpool ? () => onOpenSpool(s.id) : undefined} />
              ))}
            </ul>
          ) : <p className="meta">{L.noSpoolsHint}</p>}
          {f.movements.length ? (
            <>
              <h3 className="lbl">{L.movements}</h3>
              <ul className="mv" aria-label={L.movements}>
                {f.movements.slice(0, 14).map((m) => (
                  <li key={m.id} className={m.kind}>
                    <span className="num">{date(m.on)}</span>
                    <span><b>{es.status.spoolMovement[m.kind]}</b>{noteOf(m) ? <span className="meta">{noteOf(m)}</span> : null}</span>
                    <b className={`num${m.grams >= 0 ? ' pos' : ''}`}>{m.grams > 0 ? '+' : ''}{grams(m.grams)}</b>
                  </li>
                ))}
              </ul>
              <p className="hint">{L.movementsHint}</p>
            </>
          ) : null}
          <div className="fdr-a btnrow">
            {f.spools.length ? <Button onClick={() => setMove({})}>{L.recordMovement}</Button> : null}
            <Button variant="primary" icon="plus" onClick={() => onAddSpool(f.id)}>{t('screens.filaments.addSpoolOf', { name })}</Button>
          </div>
        </div>
      ) : <div className="skel" />}
      {move && f ? <MovementDialog f={f} spoolId={move.spoolId} onClose={() => setMove(null)} /> : null}
    </Drawer>
  );
}

function SpoolCard({ s, first, onMove, onEdit, onOpen }: { s: Spool; first: boolean; onMove: () => void; onEdit: () => void; onOpen?: (() => void) | undefined }) {
  // Ronda 4: the card carries the number of the spool; tapping it opens the drawer of that spool (Pesar, Terminar rollo).
  return (
    <li className={`roll${onOpen ? ' click' : ''}`} onClick={onOpen} data-testid="drawer-spool">
      <div className="roll-h">
        <SpoolTag n={s.number} small />
        <b>{s.brand || es.common.noBrand} · {grams(s.grams)}</b>
        {first ? <Pill tone="info">{L.usedFirst}</Pill> : s.status === 'empty' ? <Pill tone="plain">{es.status.spool.empty}</Pill> : null}
        <span className="rowa" onClick={(e) => e.stopPropagation()}><Button size="sm" variant="ghost" onClick={onMove}>{L.movement}</Button><Button size="sm" variant="ghost" onClick={onEdit}>{es.common.edit}</Button></span>
      </div>
      <small className="meta">{t('screens.filaments.spoolLine', { date: date(s.purchasedOn), cost: s.noCost ? es.screens.spools.noCost : centsTotal(s.costCents + s.shippingCents), perGram: money2d(s.costPerGram) })}</small>
      <Meter value={s.remainingGrams} max={s.grams} tone={s.remainingGrams <= 150 ? 'bad' : ''} />
      <small className="meta num">{grams(s.remainingGrams)} {t('screens.filaments.spoolOfTotal', { total: grams(s.grams) })}</small>
    </li>
  );
}
