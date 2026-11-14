// Compras (docs/06 §11, docs/04 §9): calculated list grouped by supplier, "Copiar lista" per supplier, suppliers and latest purchases.
import type { SupplierView } from '@app/contract';
import { useState } from 'react';
import { PageHead } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { toast } from '../../components/Toast';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { centsTotal, date, number1 } from '../../lib/format';
import { go } from '../../lib/nav';
import { useSuppliers, useSupplies } from '../../lib/queries';
import { tbOnly } from '../production/bold';
import { usePurchases, type PurchaseGroup, type PurchaseLine } from './api';
import { SupplierDialog } from './SupplierDialog';

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
  const supplies = useSupplies().data?.items ?? [];
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
  return (
    <>
      <PageHead title={L.title} actions={<Button icon="plus" onClick={() => setDlg({ supplier: null })}>{L.newSupplier}</Button>} />
      {data ? (
        <section className="brf one sm"><div><p className="brf-l">
          {data.count ? (
            <>
              {tbOnly('screens.purchases.summary', { count: data.count, amount: centsTotal(data.estimatedCents) }, { count: '', amount: '' })}{' '}
              {data.urgent ? tbOnly('screens.purchases.urgent', { count: data.urgent }, { count: 'r' }) : L.noneUrgent}
            </>
          ) : L.allStocked}
        </p></div></section>
      ) : null}
      <div className="pv-g">
        {data?.groups.map((g) => (
          <section className="pvc" key={g.supplierId ?? 'none'} data-testid="purchase-group">
            <header>
              <div><h2>{g.supplier?.name ?? L.noSupplier}</h2><small>{supplierSub(g)}</small></div>
              <div className="btnrow">
                <Button size="sm" icon="copy" onClick={() => void copy(g)}>{L.copyList}</Button>
                {g.supplier ? <Button size="sm" variant="ghost" onClick={() => edit(g.supplier!.id)}>{es.common.edit}</Button> : null}
              </div>
            </header>
            <ul className="cmp">
              {g.lines.map((x) => (
                <li key={`${x.kind}-${x.id}`} data-testid="purchase-line">
                  {x.kind === 'filament' ? <span className="dot" style={{ background: x.hex ?? 'var(--no-color)' }} /> : <span className="dot sq" />}
                  <div><b>{x.name}</b>{x.brand ? <> <small>{x.brand}</small></> : null}<small className="blk">{reasonText(x)}</small></div>
                  <div className="cmp-q"><b className="num">{qtyText(x)}</b><small>{x.estimatedCents > 0 ? t('screens.purchases.estimate', { amount: centsTotal(x.estimatedCents) }) : ''}</small></div>
                  <Button size="sm" onClick={() => goBuy(x)}>{L.registerPurchase}</Button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <div className="cols2 soft">
        <section>
          <h2>{L.suppliers}</h2>
          {suppliers.length ? (
            <ul className="pvl">
              {suppliers.map((p) => {
                const ni = supplies.filter((s) => s.supplier?.id === p.id).length;
                const sub = [p.phone, p.brands ? t('screens.purchases.brands', { brands: p.brands }) : '', ni ? t('screens.purchases.supplies', { count: ni }) : ''].filter(Boolean).join(' · ') || L.noData;
                return <li key={p.id}><div><b>{p.name}</b><small className="blk">{sub}</small></div><Button size="sm" variant="ghost" onClick={() => setDlg({ supplier: p })}>{es.common.edit}</Button></li>;
              })}
            </ul>
          ) : <p className="muted">{L.noSuppliers}</p>}
        </section>
        <section>
          <h2>{L.recent}</h2>
          {data?.recent.length ? (
            <ul className="pvl">
              {data.recent.map((u, i) => (
                <li key={`${u.kind}-${u.id}-${u.on}-${i}`}>
                  <div><b>{u.kind === 'filament' ? t('screens.purchases.recentFilament', { name: u.name, brand: u.brand || L.noBrand }) : t('screens.purchases.recentSupply', { name: u.name, qty: number1(u.qty) })}</b><small className="blk">{date(u.on)}</small></div>
                  <b className="num">{centsTotal(u.amountCents)}</b>
                </li>
              ))}
            </ul>
          ) : <p className="muted">{L.noRecent}</p>}
        </section>
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

