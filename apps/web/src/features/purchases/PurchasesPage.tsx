// Compras (docs/06 §11, docs/04 §9): calculated list grouped by supplier, "Copiar lista" per supplier, suppliers and latest purchases.
import type { SupplierView } from '@app/contract';
import { useState } from 'react';
import { PageHead } from '../../components/PageHead';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { Panel } from '../../components/Panel';
import { Pill } from '../../components/Pill';
import { Table, Td, Th } from '../../components/Table';
import { toast } from '../../components/Toast';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { centsTotal, date, number1 } from '../../lib/format';
import { go } from '../../lib/nav';
import { useSuppliers, useSupplies } from '../../lib/queries';
import { usePurchases, type PurchaseGroup, type PurchaseLine } from './api';
import { SupplierDialog } from './SupplierDialog';
import './purchases.css';

const L = es.screens.purchases;

const qtyText = (x: PurchaseLine) => (x.kind === 'filament' ? t('screens.purchases.rolls', { count: x.qty }) : t('screens.purchases.qtyUnit', { qty: number1(x.qty), unit: x.unit || es.screens.supplies.pza }));
function reasonText(x: PurchaseLine): string {
  if (x.kind === 'filament') {
    return x.reason === 'order'
      ? t('screens.purchases.orderNeed', { orders: x.orderNumbers.map((n) => `#${n}`).join(', '), missingGrams: x.missingGrams, remainingGrams: x.remainingGrams })
      : t('screens.purchases.left', { remainingGrams: x.remainingGrams });
  }
  return (x.stock ?? 0) <= 0 ? L.supplyOut : t('screens.purchases.supplyLow', { qty: number1(x.stock ?? 0), unit: x.unit || es.screens.supplies.pza, min: number1(x.minimum ?? 0) });
}

/** Text to send by message (mockup compraTxt). */
export function copyText(g: PurchaseGroup): string {
  const head = g.supplier ? t('screens.purchases.copyHeadSupplier', { name: g.supplier.name }) : L.copyHead;
  return `${head}\n\n${g.lines.map((x) => t('screens.purchases.copyLine', { qty: qtyText(x), name: x.name }) + (x.brand ? t('screens.purchases.copyBrand', { brand: x.brand }) : '')).join('\n')}`;
}

export function PurchasesPage() {
  const { data } = usePurchases();
  // In the order they were added (ids are time-ordered), like the mockup.
  const suppliers = [...(useSuppliers().data ?? [])].sort((a, b) => a.id.localeCompare(b.id));
  const [dlg, setDlg] = useState<{ supplier: SupplierView | null } | null>(null);
  const [shown, setShown] = useState<string | null>(null);
  const copy = async (g: PurchaseGroup) => {
    const text = copyText(g);
    try { await navigator.clipboard.writeText(text); toast(L.copied); } catch { setShown(text); }
  };
  const edit = (id: string) => setDlg({ supplier: suppliers.find((s) => s.id === id) ?? null });
  // A supply line opens its purchase directly, with its drawer behind (ronda-2 §12, D9); a filament opens its drawer.
  const goBuy = (x: PurchaseLine) => go(x.kind === 'filament' ? `/filamentos?f=${x.id}` : `/insumos?i=${x.id}&compra=1`);
  const supplierSub = (g: PurchaseGroup) => {
    if (!g.supplier) return L.noSupplierHint;
    const full = suppliers.find((s) => s.id === g.supplier!.id);
    return [g.supplier.phone, full?.note ?? g.supplier.note].filter(Boolean).join(' · ') || ' ';
  };
  const meta = data?.count ? t('screens.purchases.suggestedMeta', { count: data.count, amount: centsTotal(data.estimatedCents) }) : '';
  return (
    <>
      <PageHead title={L.title} sub={data?.count ? t('screens.purchases.sub', { count: data.count }) : null} actions={<Button icon="plus" onClick={() => setDlg({ supplier: null })}>{L.newSupplier}</Button>} />
      <div className="cp-grid">
        <Panel title={L.suggested} className="cp-s">
          {data ? <p className="meta cp-m">{data.count ? meta : L.allStocked}</p> : null}
          {data?.groups.map((g) => (
            <section className="cp-g" key={g.supplierId ?? 'none'} data-testid="purchase-group">
              <header className="cp-gh">
                <div><h3>{g.supplier?.name ?? L.noSupplier}</h3><span className="meta">{supplierSub(g)}</span></div>
                <div className="btnrow">
                  <Button size="sm" icon="copy" onClick={() => void copy(g)}>{L.copyList}</Button>
                  {g.supplier ? <Button size="sm" variant="ghost" onClick={() => edit(g.supplier!.id)}>{es.common.edit}</Button> : null}
                </div>
              </header>
              <ul>
                {g.lines.map((x) => (
                  <li key={`${x.kind}-${x.id}`} data-testid="purchase-line">
                    {x.kind === 'filament' ? <span className="dot" style={{ background: x.hex ?? 'var(--no-color)' }} /> : <span className="dot sq" />}
                    <div className="cp-n"><b>{x.name}</b>{x.brand ? <small> {x.brand}</small> : null}{x.urgent ? <Pill tone="bad">{L.urgentTag}</Pill> : null}<span className="meta">{reasonText(x)}</span></div>
                    <div className="cp-q"><b className="num">{qtyText(x)}</b><span className="meta num">{x.estimatedCents > 0 ? t('screens.purchases.estimate', { amount: centsTotal(x.estimatedCents) }) : ''}</span></div>
                    <Button size="sm" onClick={() => goBuy(x)}>{L.registerPurchase}</Button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </Panel>
        <Side suppliers={suppliers} onEdit={(p) => setDlg({ supplier: p })} />
      </div>
      {dlg ? <SupplierDialog supplier={dlg.supplier} onClose={() => setDlg(null)} /> : null}
      {shown !== null ? (
        <Dialog open title={L.copyTitle} onClose={() => setShown(null)} cancelLabel={es.common.close}>
          <p className="hint">{L.copyHint}</p>
          <textarea readOnly rows={8} value={shown} data-testid="copy-text" onFocus={(e) => e.currentTarget.select()} />
        </Dialog>
      ) : null}
    </>
  );
}

/** Right column: suppliers and the latest purchases. */
function Side({ suppliers, onEdit }: { suppliers: SupplierView[]; onEdit: (p: SupplierView) => void }) {
  const { data } = usePurchases();
  const supplies = useSupplies().data?.items ?? [];
  return (
    <div className="cp-side">
      <Panel title={L.suppliers} className="cp-sup">
        {suppliers.length ? (
          <Table fit head={<><Th>{L.name}</Th><Th hideSm>{L.contact}</Th><Th /></>}>
            {suppliers.map((p) => {
              const ni = supplies.filter((s) => s.supplier?.id === p.id).length;
              const sub = [p.brands ? t('screens.purchases.brands', { brands: p.brands }) : '', ni ? t('screens.purchases.supplies', { count: ni }) : ''].filter(Boolean).join(' · ');
              return (
                <tr key={p.id}>
                  <Td><b>{p.name}</b><span className="meta">{sub || p.phone || L.noData}</span></Td>
                  <Td hideSm>{p.phone}</Td>
                  <Td r><Button size="sm" onClick={() => onEdit(p)}>{es.common.edit}</Button></Td>
                </tr>
              );
            })}
          </Table>
        ) : <p className="meta">{L.noSuppliers}</p>}
      </Panel>
      <Panel title={L.recent}>
        {data?.recent.length ? (
          <ul className="lastb">
            {data.recent.map((u, i) => (
              <li key={`${u.kind}-${u.id}-${u.on}-${i}`}>
                <span className="num">{date(u.on)}</span>
                <b>{u.kind === 'filament' ? t('screens.purchases.recentFilament', { name: u.name, brand: u.brand || L.noBrand }) : t('screens.purchases.recentSupply', { name: u.name, qty: number1(u.qty) })}</b>
                <span className="num">{centsTotal(u.amountCents)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="meta">{L.noRecent}</p>}
      </Panel>
    </div>
  );
}
