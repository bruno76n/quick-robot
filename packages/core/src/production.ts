// Production (docs/04 §7 queues, §8 print runs): queue times, fastest distribution, and what a print run writes.

export interface QueueEntry { id: string; orderId: string; minutes: number; startedAt: Date | null }

/** Progress of a job: percent (≤ 99 while running) and minutes left; jobs that did not start keep their full time. */
export function jobProgress(e: Pick<QueueEntry, 'minutes' | 'startedAt'>, now: Date) {
  if (!e.startedAt) return { pct: 0, left: e.minutes, active: false };
  const t = (now.getTime() - e.startedAt.getTime()) / 60000;
  return { pct: Math.round(Math.max(0, Math.min(99, (t / Math.max(1, e.minutes)) * 100))), left: Math.max(0, Math.round(e.minutes - t)), active: true };
}

/** Minutes until a printer is free: what is left of the first job plus the others. */
export function queueMinutes(queue: readonly Pick<QueueEntry, 'minutes' | 'startedAt'>[], now: Date): number {
  return queue.reduce((a, e, k) => a + (k === 0 ? jobProgress(e, now).left : e.minutes), 0);
}

/** Wait before the entry at `pos` starts. */
export function waitBefore(queue: readonly Pick<QueueEntry, 'minutes' | 'startedAt'>[], pos: number, now: Date): number {
  if (pos === 0) return 0;
  return jobProgress(queue[0]!, now).left + queue.slice(1, pos).reduce((a, x) => a + x.minutes, 0);
}

/** Job length in minutes for a group of items: hours × 60, at least 1 minute. */
export const jobMinutes = (hours: number) => Math.max(1, Math.round(hours * 60));

/** Fastest distribution: each item goes to the printer that is free soonest, counting what was already assigned. */
export function proposeAssignment(itemHours: readonly number[], printerLoads: ReadonlyMap<string, number>): string[] {
  const load = new Map(printerLoads);
  return itemHours.map((h) => {
    let best: string | undefined;
    for (const [id, m] of load) if (best === undefined || m < load.get(best)!) best = id;
    load.set(best!, load.get(best!)! + h * 60);
    return best!;
  });
}

export type PrintRunReason = 'stock' | 'order' | 'test';
/** A good print run for stock adds pieces; a good run that is not a test uses the supplies of the piece. */
export function printRunEffects(r: { result: 'ok' | 'fail'; reason: PrintRunReason; qty: number; tracksStock: boolean }, supplies: readonly { supplyId: string; qty: number }[]) {
  const good = r.result === 'ok';
  return {
    stockQty: good && r.reason === 'stock' && r.tracksStock ? r.qty : 0,
    supplyUse: good && r.reason !== 'test' ? supplies.filter((s) => s.qty > 0).map((s) => ({ supplyId: s.supplyId, qty: -s.qty * r.qty })) : [],
  };
}

/** A print run can be undone unless it belongs to an order or its pieces were already sold or reserved (docs/04 §8). */
export function printRunLock(r: { reason: PrintRunReason; piecesAdded: number }, freeNow: number): { reason: 'order_history' | 'pieces_unavailable'; pieces: number } | null {
  if (r.reason === 'order') return { reason: 'order_history', pieces: r.piecesAdded };
  if (r.piecesAdded > 0 && freeNow < r.piecesAdded) return { reason: 'pieces_unavailable', pieces: r.piecesAdded };
  return null;
}
