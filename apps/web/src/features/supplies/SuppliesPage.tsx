// Insumos (docs/06 §7): wide list with stock, minimum, supplier and status, filtered by status in the browser;
// drawer with movements; purchase and use dialogs. Ronda 3: table and chips of reference/ronda-3/insumos.html.
import type { SupplyDetail, SupplyListItem } from '@app/contract';
import { useQuery } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';
import { go } from '../../lib/nav';
import { useState, type CSSProperties } from 'react';
import { PageHead } from '../../components/PageHead';
import { Button } from '../../components/Button';
import { Drawer } from '../../components/Drawer';
import { Icon } from '../../components/Icon';
import { Mascot } from '../../components/Mascot';
import { Panel } from '../../components/Panel';
import { Pill, type Tone } from '../../components/Pill';
import { Table, Td, Th } from '../../components/Table';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { api } from '../../lib/api';
import { centsTotal, date, money, number1 } from '../../lib/format';
import { keys, useSupplies } from '../../lib/queries';
import { PurchaseDialog, SupplyDialog, UseDialog } from './SupplyDialogs';
import '../filament/filament.css';
import './supplies.css';

const L = es.screens.supplies;
export const SUPPLY_TONE: Record<SupplyListItem['status'], Tone> = { out: 'bad', low: 'warn', ok: 'good' };
export const SupplyIcon = ({ size = 20 }: { size?: number }) => <span className="ins-ic" style={{ '--s': `${size}px` } as CSSProperties}><Icon name="nut" size={Math.round(size * 0.6)} /></span>;
type Filter = 'all' | SupplyListItem['status'];
const FILTERS: Filter[] = ['all', 'ok', 'low', 'out'];
type Dlg = { kind: 'new' } | { kind: 'edit' | 'purchase' | 'use'; supply: SupplyDetail } | null;

export function SuppliesPage() {
  const { data } = useSupplies();
  const search = useSearch({ strict: false }) as { i?: string; compra?: string };
  const [filter, setFilter] = useState<Filter>('all');
  const [dlg, setDlg] = useState<Dlg>(null);
  const select = (id: string | null) => go(id ? `/insumos?i=${id}` : '/insumos', true);
  // `?i=<id>&compra=1` ("Registrar compra" of a line in Compras): the purchase opens over its drawer (ronda-2 §12, D9).
  const buying = search.compra === '1' && search.i ? search.i : null;
  const { data: toBuy } = useQuery({ queryKey: [...keys.supplies, 'detail', buying], queryFn: async () => (await api.supplies.get(buying!)).data, enabled: Boolean(buying) });
  const items = data?.items ?? [];
  const value = items.reduce((a, i) => a + Math.max(0, i.stock) * i.costCents, 0);
  const shown = filter === 'all' ? items : items.filter((i) => i.status === filter);
  const unitOf = (i: SupplyListItem) => i.unit || L.pza;
  return (
    <>
      <PageHead title={L.title} sub={items.length ? t('screens.supplies.sub', { count: items.length, value: centsTotal(value) }) : L.subEmpty}
        actions={<Button variant="primary" icon="plus" onClick={() => setDlg({ kind: 'new' })}>{L.newSupply}</Button>} />
      {items.length ? (
        <div className="tags ins-f" role="group" aria-label={L.filterAria}>
          {FILTERS.map((k) => (
            <button key={k} type="button" className={`tag${filter === k ? ' on' : ''}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>
              {k === 'all' ? L.all : es.status.supply[k]}<span className="num">{k === 'all' ? items.length : items.filter((i) => i.status === k).length}</span>
            </button>
          ))}
        </div>
      ) : null}
      {data && !items.length ? <div className="empty-card"><Mascot size={64} /><p>{L.empty}</p><Button variant="primary" icon="plus" onClick={() => setDlg({ kind: 'new' })}>{L.emptyButton}</Button></div> : null}
      {items.length ? (
        <Panel flush className="ins-p">
          <Table fit className="ins-t" head={<><Th>{L.colSupply}</Th><Th r>{L.colStock}</Th><Th r hideSm>{L.colMinimum}</Th><Th r hideSm>{L.colCost}</Th><Th className="ins-s">{L.colStatus}</Th></>}>
            {shown.map((i) => (
              <tr key={i.id} className={`click${search.i === i.id ? ' sel' : ''}`} tabIndex={0} onClick={() => select(i.id)} onKeyDown={(e) => { if (e.key === 'Enter') select(i.id); }} data-testid="supply-card">
                <Td><b className="ins-n">{i.name}</b><span className="meta">{i.supplier?.name ?? L.noSupplier}</span></Td>
                <Td r className="num nw">{number1(i.stock)} {unitOf(i)}</Td>
                <Td r hideSm className="num nw">{number1(i.minimum)} {unitOf(i)}</Td>
                <Td r hideSm className="num">{money(i.costCents / 100)}</Td>
                <Td className="ins-s"><Pill tone={SUPPLY_TONE[i.status]}>{es.status.supply[i.status]}</Pill></Td>
              </tr>
            ))}
            {!shown.length ? <tr><td colSpan={5} className="empty-td">{L.noMatch}</td></tr> : null}
          </Table>
        </Panel>
      ) : null}
      <SupplyDrawer id={search.i ?? null} onClose={() => select(null)} open={(kind, supply) => setDlg({ kind, supply })} />
      {dlg?.kind === 'new' || dlg?.kind === 'edit' ? <SupplyDialog supply={dlg.kind === 'edit' ? dlg.supply : null} onClose={() => setDlg(null)} onSaved={(id) => { setDlg(null); select(id); }} onDeleted={() => { setDlg(null); select(null); }} /> : null}
      {dlg?.kind === 'purchase' ? <PurchaseDialog supply={dlg.supply} onClose={() => setDlg(null)} /> : null}
      {buying && toBuy && !dlg ? <PurchaseDialog key={buying} supply={toBuy} onClose={() => select(buying)} /> : null}
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
        <div className="fdr">
          <div className="fdr-h">
            <SupplyIcon size={32} />
            <div><h2>{s.name}</h2><small className="meta">{t('screens.supplies.perUnit', { cost: money(s.costCents / 100), unit })}{s.note ? ` · ${s.note}` : ''}</small></div>
            <Pill tone={SUPPLY_TONE[s.status]}>{es.status.supply[s.status]}</Pill>
          </div>
          <dl className="mini-kv">
            <div><dt>{L.available}</dt><dd className="num">{number1(s.stock)} {unit}</dd></div>
            <div><dt>{L.warnWhen}</dt><dd className="num">{number1(s.minimum)} {unit}</dd></div>
            <div><dt>{L.value}</dt><dd className="num">{money((Math.max(0, s.stock) * s.costCents) / 100)}</dd></div>
            <div><dt>{L.usedIn}</dt><dd className="num">{t('screens.supplies.pieces', { count: s.products.length })}</dd></div>
          </dl>
          <div className="fdr-a top btnrow">
            <Button variant="primary" onClick={() => open('purchase', s)}>{L.recordPurchase}</Button>
            <Button onClick={() => open('use', s)}>{L.useOrAdjust}</Button>
            <Button variant="ghost" onClick={() => open('edit', s)}>{es.common.edit}</Button>
          </div>
          <h3 className="lbl">{L.piecesWithIt}</h3>
          {s.products.length ? (
            <ul className="mv ins-pc">{s.products.map((p) => <li key={p.id}><span>{p.name}</span><span className="meta">{t('screens.supplies.perPiece', { qty: number1(p.qty), unit })}</span></li>)}</ul>
          ) : <p className="meta">{L.noPieces}</p>}
          <h3 className="lbl">{L.movements}</h3>
          {s.movements.length ? (
            <>
              <ul className="mv" aria-label={L.movements}>
                {s.movements.slice(0, 14).map((m) => (
                  <li key={m.id}>
                    <span className="num">{date(m.on)}</span>
                    <span><b>{es.status.supplyMovement[m.kind]}</b><span className="meta">{m.note || es.status.supplyMovementNote[m.kind]}</span></span>
                    <b className={`num${m.qty >= 0 ? ' pos' : ''}`}>{m.qty > 0 ? '+' : ''}{number1(m.qty)}</b>
                  </li>
                ))}
              </ul>
              <p className="hint">{L.movementsHint}</p>
            </>
          ) : <p className="meta">{L.noMovements}</p>}
        </div>
      ) : <div className="skel" />}
    </Drawer>
  );
}
