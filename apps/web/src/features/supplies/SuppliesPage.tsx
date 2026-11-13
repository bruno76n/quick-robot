// Insumos (docs/06 §7): cards with stock, minimum and status; drawer with movements; purchase and use dialogs.
import type { SupplyDetail, SupplyListItem } from '@app/contract';
import { useQuery } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';
import { go } from '../../lib/nav';
import { useState, type CSSProperties } from 'react';
import { PageHead } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { Drawer } from '../../components/Drawer';
import { Icon } from '../../components/Icon';
import { Mascot } from '../../components/Mascot';
import { Pill, type Tone } from '../../components/Pill';
import { Table } from '../../components/Table';
import { es } from '../../i18n/es';
import { tb } from '../../i18n/rich';
import { t } from '../../i18n/t';
import { api } from '../../lib/api';
import { centsTotal, date, money, number1 } from '../../lib/format';
import { keys, useSupplies } from '../../lib/queries';
import { PurchaseDialog, SupplyDialog, UseDialog } from './SupplyDialogs';

const L = es.screens.supplies;
export const SUPPLY_TONE: Record<SupplyListItem['status'], Tone> = { out: 'bad', low: 'warn', ok: 'good' };
const MOVE_TONE: Record<string, Tone> = { purchase: 'good', use: '', adjustment: 'warn', waste: 'bad' };
export const SupplyIcon = ({ size = 20 }: { size?: number }) => <span className="ins-ic" style={{ '--s': `${size}px` } as CSSProperties}><Icon name="nut" size={Math.round(size * 0.6)} /></span>;
type Dlg = { kind: 'new' } | { kind: 'edit' | 'purchase' | 'use'; supply: SupplyDetail } | null;

export function SuppliesPage() {
  const { data } = useSupplies();
  const search = useSearch({ strict: false }) as { i?: string };
  const [dlg, setDlg] = useState<Dlg>(null);
  const select = (id: string | null) => go(id ? `/insumos?i=${id}` : '/insumos', true);
  const items = data?.items ?? [];
  const low = items.filter((i) => i.stock <= i.minimum).length;
  const value = items.reduce((a, i) => a + Math.max(0, i.stock) * i.costCents, 0);
  return (
    <>
      <PageHead title={L.title} sub={items.length ? tb('screens.supplies.summary', { count: items.length, value: centsTotal(value), low }) : L.subEmpty}
        actions={<Button variant="primary" icon="plus" onClick={() => setDlg({ kind: 'new' })}>{L.newSupply}</Button>} />
      <div className="xlist grid">
        {items.map((i) => {
          const top = Math.max(i.minimum * 3, i.stock, 1);
          const tone = SUPPLY_TONE[i.status];
          return (
            <div key={i.id} className={`xc${search.i === i.id ? ' sel' : ''}`} tabIndex={0} onClick={() => select(i.id)} onKeyDown={(e) => { if (e.key === 'Enter') select(i.id); }} data-testid="supply-card">
              <div className="xc-h"><SupplyIcon size={36} /><div className="xc-t"><b>{i.name}</b><small>{t('screens.supplies.perUnit', { cost: money(i.costCents / 100), unit: i.unit || L.pza })}</small></div><span className={`pill ${tone}`}>{es.status.supply[i.status]}</span></div>
              <div className="ins-st"><b className="num">{number1(i.stock)}</b><span>{t('screens.supplies.availableUnits', { unit: i.unit || L.pza })}</span><span className="mut">{t('screens.supplies.warnAt', { min: number1(i.minimum) })}</span></div>
              <div className={`rk-b ins-b ${tone}`}><i style={{ width: `${Math.max(0, Math.min(100, (i.stock / top) * 100))}%` }} /><s style={{ left: `${Math.min(100, (i.minimum / top) * 100)}%` }} /></div>
            </div>
          );
        })}
        {data && !items.length ? <div className="empty-card"><Mascot size={64} /><p>{L.empty}</p><Button variant="primary" icon="plus" onClick={() => setDlg({ kind: 'new' })}>{L.emptyButton}</Button></div> : null}
      </div>
      <SupplyDrawer id={search.i ?? null} onClose={() => select(null)} open={(kind, supply) => setDlg({ kind, supply })} />
      {dlg?.kind === 'new' || dlg?.kind === 'edit' ? <SupplyDialog supply={dlg.kind === 'edit' ? dlg.supply : null} onClose={() => setDlg(null)} onSaved={(id) => { setDlg(null); select(id); }} onDeleted={() => { setDlg(null); select(null); }} /> : null}
      {dlg?.kind === 'purchase' ? <PurchaseDialog supply={dlg.supply} onClose={() => setDlg(null)} /> : null}
      {dlg?.kind === 'use' ? <UseDialog supply={dlg.supply} onClose={() => setDlg(null)} /> : null}
    </>
  );
}

function SupplyDrawer({ id, onClose, open }: { id: string | null; onClose: () => void; open: (kind: 'edit' | 'purchase' | 'use', s: SupplyDetail) => void }) {
  const { data: s } = useQuery({ queryKey: [...keys.supplies, 'detail', id], queryFn: async () => (await api.supplies.get(id!)).data, enabled: Boolean(id) });
  const unit = s?.unit || L.pza;
  return (
    <Drawer open={Boolean(id)} kind={L.drawerKind} onClose={onClose}>
      {s ? (
        <>
          <div className="det-h"><SupplyIcon size={46} /><div><h2>{s.name}</h2><small>{t('screens.supplies.perUnit', { cost: money(s.costCents / 100), unit })}{s.note ? ` · ${s.note}` : ''}</small></div></div>
          <dl className="dl">
            <div><dt>{L.available}</dt><dd className="num">{number1(s.stock)} {unit}<small><Pill tone={SUPPLY_TONE[s.status]}>{es.status.supply[s.status]}</Pill></small></dd></div>
            <div><dt>{L.warnWhen}</dt><dd className="num">{number1(s.minimum)} {unit}</dd></div>
            <div><dt>{L.value}</dt><dd className="num">{money((Math.max(0, s.stock) * s.costCents) / 100)}</dd></div>
            <div><dt>{L.usedIn}</dt><dd className="num">{t('screens.supplies.pieces', { count: s.products.length })}</dd></div>
          </dl>
          <div className="det-a btnrow">
            <Button size="sm" variant="primary" onClick={() => open('purchase', s)}>{L.recordPurchase}</Button>
            <Button size="sm" onClick={() => open('use', s)}>{L.useOrAdjust}</Button>
            <Button size="sm" variant="ghost" onClick={() => open('edit', s)}>{es.common.edit}</Button>
          </div>
          {s.products.length ? (
            <><h3>{L.piecesWithIt}</h3><ul className="apl">{s.products.map((p) => <li key={p.id}><span>{p.name}</span><span className="mut">{t('screens.supplies.perPiece', { qty: number1(p.qty), unit })}</span></li>)}</ul></>
          ) : <p className="hint">{L.noPieces}</p>}
          <h3>{L.movements}</h3>
          {s.movements.length ? (
            <>
              <p className="hint">{L.movementsHint}</p>
              <Table small head={<><th>{L.colDate}</th><th>{L.colMovement}</th><th className="r">{L.colQty}</th><th>{L.colNote}</th></>}>
                {s.movements.slice(0, 14).map((m) => (
                  <tr key={m.id}><td>{date(m.on)}</td><td><Pill tone={MOVE_TONE[m.kind] ?? ''}>{es.status.supplyMovement[m.kind]}</Pill></td><td className={`r num${m.qty >= 0 ? ' pos' : ''}`}>{m.qty > 0 ? '+' : ''}{number1(m.qty)}</td><td className="nota">{m.note || es.status.supplyMovementNote[m.kind]}</td></tr>
                ))}
              </Table>
            </>
          ) : <p className="muted">{L.noMovements}</p>}
        </>
      ) : <div className="skel" />}
    </Drawer>
  );
}
