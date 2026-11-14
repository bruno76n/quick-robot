// Cajón de Existencias (docs/06 §10): opens for a simple piece or a member of a family, never for the family row.
// Totals, the orders that reserve pieces and the movements; Registrar impresión, Ajustar, Vender or Hacer pedido.
import { Button } from '../../components/Button';
import { Drawer } from '../../components/Drawer';
import { Pill, type Tone } from '../../components/Pill';
import { Table } from '../../components/Table';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { cents, centsTotal, date } from '../../lib/format';
import { go } from '../../lib/nav';
import { PieceThumb } from '../../components/PieceThumb';
import { useStockDetail, type StockDetail, type StockMovementKind, type StockStatus } from './api';

const L = es.screens.stock;
export const STOCK_TONE: Record<StockStatus, Tone> = { out: 'bad', all_reserved: 'info', few: 'warn', ok: 'good' };
const MOVE_TONE: Record<StockMovementKind, Tone> = { initial: 'plain', print: 'info', order_print: 'info', sale: 'good', return: 'info', delivery: 'good', adjustment: 'warn' };
const ORDER_TONE: Record<string, Tone> = { quoted: '', accepted: 'info', in_production: 'warn', ready: 'good', delivered: '', cancelled: 'bad' };
export type Dlg = { kind: 'print'; productId?: string } | { kind: 'adjust'; detail: StockDetail } | { kind: 'enable' } | null;

export function MiniPiece({ photoUrl, hexes }: { photoUrl: string | null; hexes: string[] }) {
  return <PieceThumb photoUrl={photoUrl} hexes={hexes} size={38} />;
}

export function StockDrawer({ id, hexes, onClose, open }: { id: string | null; hexes: string[]; onClose: () => void; open: (d: Dlg) => void }) {
  const { data: s, isError } = useStockDetail(id);
  const moves = [...(s?.movements ?? [])].sort((a, b) => b.on.localeCompare(a.on)).slice(0, 14);
  return (
    <Drawer open={Boolean(id) && !isError} kind={L.drawerKind} onClose={onClose}>
      {s ? (
        <>
          <div className="det-h"><MiniPiece photoUrl={s.photoUrl} hexes={hexes} /><div><h2>{s.name}</h2><small>{t('screens.stock.priceLine', { price: centsTotal(s.listCents), cost: cents(s.costCents) })}</small></div></div>
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
