// Existencias (docs/06 §10): finished pieces on the shelf as cards with cubes (free / reserved), a drawer with the
// movements and the orders that reserve them; Ajustar, Llevar existencias and Registrar impresión.
import { useSearch } from '@tanstack/react-router';
import { useState, type CSSProperties } from 'react';
import { PageHead } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { Drawer } from '../../components/Drawer';
import { Pill, type Tone } from '../../components/Pill';
import { Table } from '../../components/Table';
import { toast } from '../../components/Toast';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { cents, centsTotal, date, number1 } from '../../lib/format';
import { go } from '../../lib/nav';
import { tbOnly } from '../production/bold';
import { PrintRunDialog } from '../production/PrintRunDialog';
import { Piece3d } from '../products/Piece3d';
import { useStock, useStockDetail, type StockDetail, type StockItem, type StockMovementKind, type StockStatus } from './api';
import { AdjustDialog, EnableDialog } from './StockDialogs';

const L = es.screens.stock;
export const STOCK_TONE: Record<StockStatus, Tone> = { out: 'bad', all_reserved: 'info', few: 'warn', ok: 'good' };
const MOVE_TONE: Record<StockMovementKind, Tone> = { initial: 'plain', print: 'info', order_print: 'info', sale: 'good', return: 'info', delivery: 'good', adjustment: 'warn' };
const ORDER_TONE: Record<string, Tone> = { quoted: '', accepted: 'info', in_production: 'warn', ready: 'good', delivered: '', cancelled: 'bad' };
type Dlg = { kind: 'print'; productId?: string } | { kind: 'adjust'; detail: StockDetail } | { kind: 'enable' } | null;

export function MiniPiece({ photoUrl, hexes, id }: { photoUrl: string | null; hexes: string[]; id: string }) {
  return photoUrl ? <span className="lay-img"><img src={photoUrl} alt="" /></span> : <Piece3d hexes={hexes} id={id} cls="sm" />;
}

/** Mockup `cubos`: one cube per piece (scaled above 36), reserved ones hollow. */
function Cubes({ item }: { item: StockItem }) {
  const MAX = 36;
  const f = item.physical;
  const a = item.reserved;
  if (f <= 0) return <span className="cubes none">{[0, 1, 2, 3].map((i) => <i key={i} className="cube" />)}</span>;
  const l = f - a;
  const sc = f > MAX ? MAX / f : 1;
  const nl = l ? Math.max(1, Math.round(l * sc)) : 0;
  const na = a ? Math.min(MAX - nl, Math.max(1, Math.round(a * sc))) : 0;
  return (
    <span className="cubes" style={{ '--cc': item.hexes[0] ?? '#c9c9d1' } as CSSProperties}>
      {Array.from({ length: nl }, (_, i) => <i key={`l${i}`} className="cube" />)}
      {Array.from({ length: na }, (_, i) => <i key={`a${i}`} className="cube ap" />)}
      {f > MAX ? <small>{t('screens.stock.cubeScale', { n: number1(f / MAX) })}</small> : null}
    </span>
  );
}

export function StockPage() {
  const { data } = useStock();
  const search = useSearch({ strict: false }) as { p?: string };
  const [dlg, setDlg] = useState<Dlg>(null);
  const select = (id: string | null) => go(id ? `/existencias?p=${id}` : '/existencias', true);
  const items = [...(data?.items ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const T = data?.totals ?? { physical: 0, free: 0, reserved: 0 };
  const enable = () => { if (data && !data.untracked.length) toast(es.toast['stock.allTracked']); else setDlg({ kind: 'enable' }); };
  return (
    <>
      <PageHead
        title={L.title}
        sub={items.length ? tbOnly('screens.stock.summary', { total: T.physical, pieces: items.length, free: T.free, reserved: T.reserved }, { total: '', free: '', reserved: '' }) : L.subEmpty}
        actions={<><Button variant="primary" icon="plus" onClick={() => setDlg({ kind: 'print' })}>{L.register}</Button><Button onClick={enable}>{L.enableOther}</Button></>}
      />
      <div className="xlist grid">
        {items.map((p) => (
          <div key={p.productId} className={`xc${search.p === p.productId ? ' sel' : ''}`} tabIndex={0} onClick={() => select(p.productId)} onKeyDown={(e) => { if (e.key === 'Enter') select(p.productId); }} data-testid="stock-card">
            <div className="xc-h"><MiniPiece photoUrl={p.photoUrl} hexes={p.hexes} id={p.productId} /><div className="xc-t"><b>{p.name}</b><small>{t('screens.stock.ofList', { price: centsTotal(p.listCents) })}</small></div><span className={`pill ${STOCK_TONE[p.status]}`}>{es.status.stock[p.status]}</span></div>
            <Cubes item={p} />
            <div className="xc-n">
              <span>{tbOnly('screens.stock.freeN', { count: p.free }, { count: 'num' })}</span>
              <span className={p.reserved ? '' : 'mut'}>{tbOnly('screens.stock.reservedN', { count: p.reserved }, { count: 'num' })}</span>
              <span className="mut">{tbOnly('screens.stock.totalN', { count: p.physical }, { count: 'num' })}</span>
            </div>
          </div>
        ))}
        {data && !items.length ? (
          <div className="empty-card"><p>{L.empty}</p><Button variant="primary" icon="plus" onClick={() => setDlg({ kind: 'print' })}>{L.register}</Button> <Button onClick={enable}>{L.enableOne}</Button></div>
        ) : null}
      </div>
      <StockDrawer id={search.p ?? null} onClose={() => select(null)} open={setDlg} />
      {dlg?.kind === 'print' ? <PrintRunDialog productId={dlg.productId} onClose={() => setDlg(null)} /> : null}
      {dlg?.kind === 'adjust' ? <AdjustDialog detail={dlg.detail} onClose={() => setDlg(null)} /> : null}
      {dlg?.kind === 'enable' && data ? <EnableDialog candidates={data.untracked} onClose={() => setDlg(null)} onDone={(id) => { setDlg(null); select(id); }} /> : null}
    </>
  );
}

function StockDrawer({ id, onClose, open }: { id: string | null; onClose: () => void; open: (d: Dlg) => void }) {
  const { data: s, isError } = useStockDetail(id);
  const list = useStock().data?.items.find((x) => x.productId === id);
  const moves = [...(s?.movements ?? [])].sort((a, b) => b.on.localeCompare(a.on)).slice(0, 14);
  return (
    <Drawer open={Boolean(id) && !isError} kind={L.drawerKind} onClose={onClose}>
      {s ? (
        <>
          <div className="det-h"><MiniPiece photoUrl={s.photoUrl} hexes={list?.hexes ?? []} id={s.productId} /><div><h2>{s.name}</h2><small>{t('screens.stock.priceLine', { price: centsTotal(s.listCents), cost: cents(s.costCents) })}</small></div></div>
          <dl className="dl">
            <div><dt>{L.total}</dt><dd className="num">{s.physical}<small><Pill tone={STOCK_TONE[s.status]}>{es.status.stock[s.status]}</Pill></small></dd></div>
            <div><dt>{L.free}</dt><dd className="num">{s.free}</dd></div>
            <div><dt>{L.reserved}</dt><dd className="num">{s.reserved}<small>{s.reserved ? L.inOrders : L.noOrders}</small></dd></div>
            <div><dt>{L.listValue}</dt><dd className="num">{centsTotal(s.physical * s.listCents)}<small>{t('screens.stock.costValue', { amount: centsTotal(s.physical * s.costCents) })}</small></dd></div>
          </dl>
          <div className="det-a btnrow">
            <Button size="sm" variant="primary" onClick={() => open({ kind: 'print', productId: s.productId })}>{L.register}</Button>
            <Button size="sm" onClick={() => open({ kind: 'adjust', detail: s })}>{L.adjust}</Button>
            {s.free > 0
              ? <Button size="sm" onClick={() => go(`/armar?modo=venta&pieza=${s.productId}`)}>{L.sell}</Button>
              : <Button size="sm" onClick={() => go(`/armar?modo=pedido&pieza=${s.productId}`)}>{L.makeOrder}</Button>}
          </div>
          {s.reservedBy.length ? (
            <>
              <h3>{L.reservedFor}</h3>
              <ul className="apl">
                {s.reservedBy.map((o) => (
                  <li key={o.orderId}>
                    <button type="button" className="link" onClick={() => go(`/pedidos/pedido?id=${o.orderId}`)}>{t('screens.stock.orderLine', { folio: o.number, customer: o.customer })}</button>
                    <span className="num">{t('screens.stock.pieces', { count: o.qty })}</span>
                    <Pill tone={ORDER_TONE[o.status] ?? ''}>{(es.status.order as Record<string, string>)[o.status] ?? o.status}</Pill>
                  </li>
                ))}
              </ul>
              <p className="hint">{L.reservedHint}</p>
            </>
          ) : null}
          <h3>{L.movements}</h3>
          {moves.length ? (
            <>
              <p className="hint">{L.movementsHint}</p>
              <Table small head={<><th>{L.colDate}</th><th>{L.colMovement}</th><th className="r">{L.colPieces}</th><th>{L.colNote}</th></>}>
                {moves.map((m) => (
                  <tr key={m.id}><td>{date(m.on)}</td><td><Pill tone={MOVE_TONE[m.kind] ?? 'warn'}>{L.kind[m.kind] ?? L.kind.adjustment}</Pill></td><td className={`r num${m.qty >= 0 ? ' pos' : ''}`}>{m.qty > 0 ? '+' : ''}{m.qty}</td><td className="nota">{m.note || L.kind[m.kind]}</td></tr>
                ))}
              </Table>
            </>
          ) : <p className="muted">{L.noMovements}</p>}
        </>
      ) : <div className="skel" />}
    </Drawer>
  );
}
