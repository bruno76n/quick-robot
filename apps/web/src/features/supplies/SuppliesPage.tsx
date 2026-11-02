import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import type { Supply, SupplyDetail, SupplyList } from '@app/contract';
import { PageHeader } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { DataList } from '../../components/DataList';
import { Drawer } from '../../components/Drawer';
import { Icon } from '../../components/Icon';
import { Pill, type Tone } from '../../components/Pill';
import { Table, Td, Th } from '../../components/Table';
import { es } from '../../i18n/es';
import { cn } from '../../lib/cn';
import { errorText } from '../../lib/error-text';
import { formatMoney, formatMoney0, formatNumber1, formatShortDate } from '../../lib/format';
import { useSupplies } from '../../lib/queries';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { SupplyDialog, SupplyMovementDialog, SupplyPurchaseDialog } from './SupplyDialogs';

const t = es.supplies;
const statusTone: Record<Supply['status'], Tone> = { out: 'bad', low: 'warn', enough: 'good' };
const kindTone = { purchase: 'good', use: 'plain', adjustment: 'warn', waste: 'bad' } as const satisfies Record<string, Tone>;

export function SupplyIcon({ size = 36 }: { size?: number }) {
  return (
    <span className="grid flex-none place-items-center rounded-[12px] bg-panel-2 text-ink-2" style={{ width: size, height: size }} aria-hidden="true">
      <Icon name="nut" size={Math.round(size / 2)} />
    </span>
  );
}

function SupplyCard({ s, selected, onOpen }: { s: Supply; selected: boolean; onOpen: () => void }) {
  const top = Math.max(s.minimum * 3, s.stock, 1);
  return (
    <div
      role="button"
      tabIndex={0}
      data-testid="supply-card"
      onClick={onOpen}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen())}
      className={cn(
        'grid min-w-0 cursor-pointer gap-[10px] rounded-[16px] bg-bg px-4 py-[14px] transition-shadow',
        selected ? 'shadow-[0_0_0_2px_var(--ink),0_8px_22px_rgba(18,18,20,.10)]' : 'shadow-[0_0_0_1px_var(--line)] hover:shadow-[0_0_0_1px_var(--line-2),var(--sh-up)]',
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <SupplyIcon />
        <div className="min-w-0 flex-1">
          <b className="block truncate">{s.name}</b>
          <small className="block truncate">{t.perUnit(formatMoney(s.costCents / 100), s.unit)}</small>
        </div>
        <Pill tone={statusTone[s.status]} dot={false}>
          {t.status[s.status]}
        </Pill>
      </div>
      <div className="flex items-baseline gap-2 text-[13.5px] text-ink-2">
        <b className="num text-[26px] font-semibold leading-[1.45] tracking-[-0.03em] text-ink">{formatNumber1(s.stock)}</b>
        <span>{t.available(s.unit)}</span>
        <span className="text-ink-3">{t.warnAt(formatNumber1(s.minimum))}</span>
      </div>
      <div className={cn('rk-b h-2', statusTone[s.status] === 'good' ? '' : statusTone[s.status])}>
        <i style={{ width: `${Math.max(0, Math.min(100, (s.stock / top) * 100))}%` }} />
        <s style={{ left: `${Math.min(100, (s.minimum / top) * 100)}%` }} />
      </div>
    </div>
  );
}

function Detail({ s, onPurchase, onUse, onEdit }: { s: SupplyDetail; onPurchase: () => void; onUse: () => void; onEdit: () => void }) {
  const d = t.drawer;
  return (
    <>
      <div className="mb-[14px] flex items-center gap-3">
        <SupplyIcon size={46} />
        <div className="min-w-0">
          <h2>{s.name}</h2>
          <small>
            {t.perUnit(formatMoney(s.costCents / 100), s.unit)}
            {s.note ? ` · ${s.note}` : ''}
          </small>
        </div>
      </div>
      <DataList
        items={[
          { label: d.available, value: `${formatNumber1(s.stock)} ${s.unit}`, sub: <Pill tone={statusTone[s.status]}>{t.status[s.status]}</Pill> },
          { label: d.warnWhen, value: `${formatNumber1(s.minimum)} ${s.unit}` },
          { label: d.value, value: formatMoney(s.valueCents / 100) },
          { label: d.usedIn, value: d.pieces(s.usedBy.length) },
        ]}
      />
      <div className="mb-1 flex flex-wrap gap-2">
        <Button variant="primary" size="sm" onClick={onPurchase}>
          {d.purchase}
        </Button>
        <Button size="sm" onClick={onUse}>
          {d.useOrAdjust}
        </Button>
        <Button variant="ghost" size="sm" onClick={onEdit}>
          {es.app.edit}
        </Button>
      </div>
      {s.usedBy.length ? (
        <>
          <h3>{d.usedBy}</h3>
          <ul className="m-0 mb-[6px] grid list-none gap-[6px] p-0">
            {s.usedBy.map((u) => (
              <li key={u.productId} className="flex flex-wrap items-center gap-x-[10px] gap-y-1 rounded-card border border-line bg-bg px-[10px] py-2 text-[14px]">
                <Link to="/productos/pieza/$id" params={{ id: u.productId }} className="font-semibold text-ink underline">
                  {u.productName}
                </Link>
                <span className="text-ink-3">{d.perPiece(formatNumber1(u.qty), s.unit)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-2 text-[13px] text-ink-3">{d.notUsed}</p>
      )}
      <h3>{d.movements}</h3>
      {s.movements.length ? (
        <>
          <p className="mt-2 text-[13px] text-ink-3">{d.movementsHint}</p>
          <Table small>
            <thead>
              <tr>
                <Th>{d.col.date}</Th>
                <Th>{d.col.movement}</Th>
                <Th align="right">{d.col.qty}</Th>
                <Th>{d.col.note}</Th>
              </tr>
            </thead>
            <tbody>
              {s.movements.map((m) => (
                <tr key={m.id}>
                  <Td small className="whitespace-nowrap">
                    {formatShortDate(m.on)}
                  </Td>
                  <Td small>
                    <Pill tone={kindTone[m.kind]}>{t.kinds[m.kind]}</Pill>
                  </Td>
                  <Td small align="right" className={cn('num', m.qty >= 0 && 'text-green-ink')}>
                    {m.qty > 0 ? '+' : ''}
                    {formatNumber1(m.qty)}
                  </Td>
                  <Td small className="min-w-[90px] [overflow-wrap:anywhere]">
                    {m.note}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      ) : (
        <p className="mt-1 text-ink-2">{d.noMovements}</p>
      )}
    </>
  );
}

type DialogState = { kind: 'new' } | { kind: 'edit' | 'purchase' | 'use'; supply: SupplyDetail } | null;

export function SuppliesPage() {
  const { data, error } = useSupplies();
  const search = useSearch({ from: '/insumos' });
  const navigate = useNavigate({ from: '/insumos' });
  const [dialog, setDialog] = useState<DialogState>(null);
  const detail = useQuery({ queryKey: ['supplies', 'detail', search.s ?? ''], queryFn: () => api.supplies.get(search.s!), enabled: !!search.s });
  const open = (id: string | undefined) => void navigate({ search: id ? { s: id } : {}, replace: !id });
  const list: SupplyList | undefined = data;
  const sum = list && list.items.length ? t.summary(list.totals.count, formatMoney0(list.totals.valueCents / 100), list.totals.toRestock) : null;
  return (
    <>
      <PageHeader
        title={t.title}
        sub={
          sum ? (
            <>
              <b>{sum.count}</b>
              {sum.noun}
              <b>{sum.value}</b>
              {sum.restock}
              <b>{sum.toRestock}</b>
              {sum.end}
            </>
          ) : list ? (
            t.emptySub
          ) : undefined
        }
        actions={
          <Button variant="primary" onClick={() => setDialog({ kind: 'new' })}>
            <Icon name="plus" size={16} />
            {t.new}
          </Button>
        }
      />
      {error && <p className="text-red-ink">{errorText(error)}</p>}
      {list &&
        (list.items.length ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
            {list.items.map((s) => (
              <SupplyCard key={s.id} s={s} selected={search.s === s.id} onOpen={() => open(s.id)} />
            ))}
          </div>
        ) : (
          <div className="card grid justify-items-center gap-3 px-6 py-9 text-center text-ink-2">
            <p className="max-w-[60ch]">{t.empty}</p>
            <Button variant="primary" onClick={() => setDialog({ kind: 'new' })}>
              <Icon name="plus" size={16} />
              {t.createFirst}
            </Button>
          </div>
        ))}
      <Drawer open={!!search.s} onOpenChange={(o) => !o && open(undefined)} kicker={t.drawer.kicker} closeLabel={es.filament.drawer.close}>
        {detail.data ? (
          <Detail s={detail.data} onPurchase={() => setDialog({ kind: 'purchase', supply: detail.data })} onUse={() => setDialog({ kind: 'use', supply: detail.data })} onEdit={() => setDialog({ kind: 'edit', supply: detail.data })} />
        ) : detail.error ? (
          <p className="text-red-ink">{errorText(detail.error)}</p>
        ) : (
          <p className="text-ink-2">{es.app.loading}</p>
        )}
      </Drawer>
      <SupplyDialog
        open={dialog?.kind === 'new' || dialog?.kind === 'edit'}
        supply={dialog?.kind === 'edit' ? dialog.supply : undefined}
        suppliers={list?.suppliers ?? []}
        onClose={() => setDialog(null)}
        onSaved={(id) => open(id)}
        onDeleted={() => open(undefined)}
      />
      {dialog?.kind === 'purchase' && <SupplyPurchaseDialog supply={dialog.supply} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'use' && <SupplyMovementDialog supply={dialog.supply} onClose={() => setDialog(null)} />}
    </>
  );
}
