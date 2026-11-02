// Phase 3 fills the hooks that phase 2 left for stock, sales, queues, profit and channel usage.
import { usageOf } from '@app/db';
import { printerHooks } from '../printers';
import { productHooks } from '../products';
import { setChannelUsage } from '../settings';
import { queueViews } from './queue';
import { grossProfitAndExpenses } from './reports';
import { activeOrderFolios, soldOf, stockOf } from './stock';

productHooks.stock = stockOf;
productHooks.activeOrderFolios = activeOrderFolios;
productHooks.sold = soldOf;
printerHooks.queue = async (tx, ctx, printerIds, now) => {
  const q = await queueViews(tx, ctx, { printerIds }, now);
  return new Map([...q].map(([id, list]) => [id, list.map((e) => ({ id: e.id, orderId: e.orderId, orderNumber: e.orderNumber, text: e.text, minutes: e.minutes, startedAt: e.startedAt, remainingMinutes: e.remainingMinutes, progress: e.progress }))]));
};
printerHooks.grossProfitAndExpenses = grossProfitAndExpenses;
setChannelUsage((tx, ctx, channelId) => usageOf(tx, ctx, { channelId }));
