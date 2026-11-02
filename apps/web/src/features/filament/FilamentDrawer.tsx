import { useState } from 'react';
import type { FilamentDetail, Spool } from '@app/contract';
import { MovementDialog } from './MovementDialog';
import { Button } from '../../components/Button';
import { Drawer } from '../../components/Drawer';
import { Pill, type Tone } from '../../components/Pill';
import { Table, Td, Th } from '../../components/Table';
import { es } from '../../i18n/es';
import { cn } from '../../lib/cn';
import { errorText } from '../../lib/error-text';
import { formatGrams, formatMoney, formatMoney0, formatNumber1, formatShortDate } from '../../lib/format';
import { useFilament } from './api';
import { filamentName } from './names';

const t = es.filament;
const d = t.drawer;
const movementTone = { failure: 'bad', waste: 'warn', purchase: 'info', consumption: 'plain', adjustment: 'plain' } as const satisfies Record<string, Tone>;

function SpoolCard({ s, onMovement, onEdit }: { s: Spool; onMovement: () => void; onEdit: () => void }) {
  return (
    <li className="grid gap-[6px] rounded-card border border-line bg-bg px-3 py-[10px]" data-testid="spool-card">
      <div className="flex flex-wrap items-center gap-2">
        <b>{s.brand || t.noBrand}</b>
        {s.usedFirst ? <Pill tone="info">{d.usedFirst}</Pill> : s.status === 'empty' ? <Pill tone="plain">{t.spoolStatus.empty}</Pill> : null}
        <span className="ml-auto inline-flex gap-[6px]">
          <Button variant="ghost" size="sm" onClick={onMovement}>
            {d.movement}
          </Button>
          <Button variant="ghost" size="sm" onClick={onEdit}>
            {d.edit}
          </Button>
        </span>
      </div>
      <div className="flex items-center gap-[10px]">
        <span className={cn('stk min-w-[60px] flex-1', s.remainingGrams <= 150 && 'low')}>
          <i style={{ width: `${Math.min(100, (s.remainingGrams / s.grams) * 100)}%` }} />
        </span>
        <span className="num">
          {formatGrams(s.remainingGrams)} <small>{d.ofGrams(formatGrams(s.grams))}</small>
        </span>
      </div>
      <small>{d.spoolLine(formatShortDate(s.purchasedOn), formatMoney0((s.costCents + s.shippingCents) / 100), formatMoney(s.costPerGram))}</small>
    </li>
  );
}

function Detail({ f, onAddSpool, onMovement, onEdit }: { f: FilamentDetail; onAddSpool: () => void; onMovement: (spoolId?: string) => void; onEdit: (spool: Spool) => void }) {
  const name = filamentName(f);
  const several = f.spools.length > 1;
  const brandOf = new Map(f.spools.map((s) => [s.id, s.brand || t.noBrand]));
  const asOne = d.asOne(f.activeSpoolCount, formatGrams(f.remainingGrams), name);
  return (
    <>
      <div className="mb-[14px] flex items-center gap-3">
        <span className="sw" style={{ background: f.hex, width: 34, height: 34 }} />
        <div className="min-w-0">
          <h2>{name}</h2>
          <small>{d.registered(f.spoolCount)}</small>
        </div>
      </div>
      <dl className="mb-[14px] grid grid-cols-2 gap-x-4 gap-y-[10px]">
        <div>
          <dt className="text-[12.5px] font-semibold text-ink-3">{d.available}</dt>
          <dd className="num m-0 font-semibold">{formatGrams(f.remainingGrams)}</dd>
        </div>
        <div>
          <dt className="text-[12.5px] font-semibold text-ink-3">{d.value}</dt>
          <dd className="num m-0 font-semibold">{formatMoney0(f.valueCents / 100)}</dd>
        </div>
        <div>
          <dt className="text-[12.5px] font-semibold text-ink-3">{d.costPerGram}</dt>
          <dd className="num m-0 font-semibold">
            {formatMoney(f.costPerGram)}
            {several && <small className="block font-normal">{d.averageOfSpools}</small>}
          </dd>
        </div>
        <div>
          <dt className="text-[12.5px] font-semibold text-ink-3">{d.activeSpools}</dt>
          <dd className="num m-0 font-semibold">{f.activeSpoolCount}</dd>
        </div>
      </dl>
      <div className="mb-1 flex flex-wrap gap-2">
        <Button variant="primary" size="sm" onClick={onAddSpool}>
          {d.addSpoolOf(name)}
        </Button>
        {f.spoolCount > 0 && (
          <Button size="sm" onClick={() => onMovement()}>
            {d.recordMovement}
          </Button>
        )}
      </div>
      {f.activeSpoolCount > 1 && (
        <p className="mt-[14px] rounded-card bg-green-soft px-[14px] py-[11px] text-[13.5px] text-green-ink">
          {asOne.before}
          <b>{asOne.grams}</b>
          {asOne.after}
        </p>
      )}
      <h3>{d.spools}</h3>
      {f.spools.length ? (
        <ul className="m-0 mt-2 grid list-none gap-2 p-0">
          {f.spools.map((s) => (
            <SpoolCard key={s.id} s={s} onMovement={() => onMovement(s.id)} onEdit={() => onEdit(s)} />
          ))}
        </ul>
      ) : (
        <p className="mt-1 max-w-[62ch] text-ink-2">{d.noSpools}</p>
      )}
      {f.movements.length > 0 && (
        <>
          <h3>{d.movements}</h3>
          <p className="mt-2 text-[13px] text-ink-3">{d.movementsHint}</p>
          <Table small>
            <thead>
              <tr>
                <Th>{d.col.date}</Th>
                {several && <Th>{d.col.spool}</Th>}
                <Th>{d.col.movement}</Th>
                <Th align="right">{d.col.grams}</Th>
                <Th>{d.col.note}</Th>
              </tr>
            </thead>
            <tbody>
              {f.movements.map((m) => (
                <tr key={m.id}>
                  <Td small className="whitespace-nowrap">
                    {formatShortDate(m.on)}
                  </Td>
                  {several && <Td small>{brandOf.get(m.spoolId)}</Td>}
                  <Td small>
                    <Pill tone={movementTone[m.kind]}>{t.movementKind[m.kind]}</Pill>
                  </Td>
                  <Td small align="right" className={cn('num', m.grams >= 0 && 'text-green-ink')}>
                    {m.grams > 0 ? '+' : ''}
                    {formatNumber1(m.grams)}
                  </Td>
                  <Td small className="min-w-[90px] [overflow-wrap:anywhere]">
                    {m.note || (m.kind === 'purchase' ? t.purchaseNote : '')}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}
    </>
  );
}

export function FilamentDrawer({
  filamentId,
  onClose,
  onAddSpool,
  onEditSpool,
}: {
  filamentId: string | undefined;
  onClose: () => void;
  onAddSpool: (filamentId: string) => void;
  onEditSpool: (filamentId: string, spool: Spool) => void;
}) {
  const { data, error, isPending } = useFilament(filamentId);
  const [movement, setMovement] = useState<{ spoolId?: string } | null>(null);
  return (
    <Drawer open={!!filamentId} onOpenChange={(o) => !o && onClose()} kicker={d.kicker} closeLabel={d.close}>
      {isPending ? (
        <p className="text-ink-2">{es.app.loading}</p>
      ) : error ? (
        <p className="text-red-ink">{errorText(error)}</p>
      ) : (
        <Detail f={data} onAddSpool={() => onAddSpool(data.id)} onMovement={(spoolId) => setMovement(spoolId ? { spoolId } : {})} onEdit={(s) => onEditSpool(data.id, s)} />
      )}
      {movement && data && <MovementDialog filament={data} {...(movement.spoolId ? { spoolId: movement.spoolId } : {})} onClose={() => setMovement(null)} />}
    </Drawer>
  );
}
