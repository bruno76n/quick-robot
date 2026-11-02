// The queue of a printer (docs/06 §8, mockup vImpresoras › cola): what waits, the link to its order and "Terminó este trabajo".
import type { PrinterView } from '@app/contract';
import { Button } from '../../components/Button';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { queueDuration } from '../../lib/format';
import { useWrite } from '../../lib/mutate';
import { go } from '../../lib/nav';
import { ordersApi, ORDER_TOUCHES, useOrderList } from '../orders/api';
import { warningText } from '../orders/OrderSteps';

const L = es.screens.printers;

export function QueueOrderLink({ orderId, folio }: { orderId: string; folio: number }) {
  const customer = useOrderList('board').data?.items.find((o) => o.id === orderId)?.customer;
  if (!orderId) return <span className="mut">{L.looseJob}</span>;
  return (
    <button type="button" className="link" onClick={() => go(`/pedidos/pedido?id=${orderId}`)} data-testid="queue-order-link">
      {customer ? t('screens.printers.orderLink', { folio, customer }) : t('screens.printers.orderLinkShort', { folio })}
    </button>
  );
}

export function QueueList({ printer }: { printer: PrinterView }) {
  const q = printer.queue;
  if (q.length < 2) return null;
  const first = q[0]!.remainingMinutes;
  return (
    <div><span className="k">{t('screens.printers.inQueue', { count: q.length - 1 })}</span>
      <ul className="cola">{q.slice(1).map((e, k) => {
        const wait = first + q.slice(1, k + 1).reduce((a, x) => a + x.minutes, 0);
        return <li key={e.id}><div><b>{e.text}</b><small className="blk"><QueueOrderLink orderId={e.orderId} folio={e.orderNumber} /></small></div><span className="mut">{t('screens.printers.startsIn', { time: queueDuration(wait) })}</span></li>;
      })}</ul>
    </div>
  );
}

export function QueueFinishButton({ printer }: { printer: PrinterView }) {
  const job = printer.queue[0]!;
  const next = printer.queue[1];
  const finish = useWrite(async () => ({ data: await ordersApi.finishJob(printer.id, job.id) }), {
    touches: [...ORDER_TOUCHES],
    ok: ({ data, warnings }) => [
      warnings.length ? warnings.map(warningText).join(' ') : t('screens.printers.finished', { printer: printer.name, text: job.text }),
      data.readyTriggered ? t('screens.printers.finishedReady', { folio: job.orderNumber }) : '',
      next ? t('screens.printers.nowPrinting', { text: next.text }) : '',
    ].filter(Boolean).join(' '),
  });
  return <Button size="sm" variant="primary" busy={finish.isPending} onClick={() => finish.mutate(undefined)} data-testid="queue-finish">{L.finish}</Button>;
}
