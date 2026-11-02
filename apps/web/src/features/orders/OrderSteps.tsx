// The next step of an order (docs/04 §7, mockup "ped-next"): accept and ready run at once; production and delivery open a dialog.
import { useState } from 'react';
import { Button } from '../../components/Button';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { useWrite } from '../../lib/mutate';
import { ordersApi, ORDER_TOUCHES, type OrderDetail, type OrderStatus, type OrderStep } from './api';
import { CancelDialog, DeliverDialog, PaymentDialog, ProductionDialog } from './OrderDialogs';

export type StepDlg = { kind: 'production' | 'reassign' | 'deliver' | 'pay' | 'cancel'; id: string } | null;
interface OrderRef { id: string; number: number; status: OrderStatus; nextStep: OrderStep | null }

export const warningText = (w: { code: string; details?: Record<string, unknown> }) => t(`warnings.${w.code}`, w.details ?? {});
const fromStockCount = (o: OrderDetail) => o.items.reduce((a, it) => a + (it.kind === 'set' ? it.parts.reduce((x, p) => x + p.qty, 0) * it.qty : it.qty) - it.toPrint, 0);

export function useStepRunner() {
  const [dlg, setDlg] = useState<StepDlg>(null);
  const accept = useWrite(async (id: string) => ({ data: await ordersApi.accept(id) }), {
    touches: [...ORDER_TOUCHES],
    ok: ({ data: o, warnings }) => {
      const res = fromStockCount(o);
      const toPrint = o.items.reduce((a, it) => a + it.toPrint, 0);
      return [t('toast.order.accepted', { folio: o.number }), res ? t('screens.order.reservedToast', { count: res }) : '', ...warnings.map(warningText),
        toPrint ? es.screens.order.canStartToast : es.screens.order.nothingToPrintToast].filter(Boolean).join(' ');
    },
  });
  const ready = useWrite(async (o: OrderRef) => ordersApi.ready(o.id), {
    touches: [...ORDER_TOUCHES],
    ok: (_, o) => t(o.status === 'accepted' ? 'toast.order.readyFromStock' : 'toast.order.ready', { folio: o.number }),
  });
  const run = (o: OrderRef) => {
    if (o.nextStep === 'accept') accept.mutate(o.id);
    else if (o.nextStep === 'ready') ready.mutate(o);
    else if (o.nextStep === 'start_production') setDlg({ kind: 'production', id: o.id });
    else if (o.nextStep === 'deliver') setDlg({ kind: 'deliver', id: o.id });
  };
  return { dlg, setDlg, run, busy: accept.isPending || ready.isPending };
}
export type StepRunner = ReturnType<typeof useStepRunner>;

export function NextStepButton({ order, runner, size = 'md', block, primary }: { order: OrderRef; runner: StepRunner; size?: 'sm' | 'md'; block?: boolean; primary?: boolean }) {
  if (!order.nextStep) return null;
  return (
    <Button variant={primary ? 'primary' : 'default'} size={size} block={block ?? false} busy={runner.busy} onClick={(e) => { e.stopPropagation(); runner.run(order); }} data-testid="next-step">
      {es.screens.orders.next[order.nextStep]}
    </Button>
  );
}

export function StepDialogs({ runner }: { runner: StepRunner }) {
  const { dlg, setDlg } = runner;
  if (!dlg) return null;
  const close = () => setDlg(null);
  if (dlg.kind === 'production' || dlg.kind === 'reassign') return <ProductionDialog id={dlg.id} reassign={dlg.kind === 'reassign'} onClose={close} />;
  if (dlg.kind === 'deliver') return <DeliverDialog id={dlg.id} onClose={close} />;
  if (dlg.kind === 'pay') return <PaymentDialog id={dlg.id} onClose={close} />;
  return <CancelDialog id={dlg.id} onClose={close} />;
}
