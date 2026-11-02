import { describe, expect, it } from 'vitest';
import { countTags, itemRows, originLabel, originsOf } from './origins';

const set = { kind: 'set' as const, productId: null, name: 'Set', qty: 1, printerId: 'p1', printerName: 'Bambu', parts: [{ productId: 'a', name: 'A', qty: 1 }, { productId: 'b', name: 'B', qty: 2 }], fromStock: { a: 1, b: 1 } };

describe('where each piece of an order is (mockup itemDesglose)', () => {
  it('accepted: shelf pieces are reserved, the rest is to print', () => {
    const rows = itemRows(set, 'accepted', []);
    expect(rows.map((r) => r.tags.map((t) => [t.k, t.n]))).toEqual([[['stock', 1]], [['stock', 1], ['todo', 1]]]);
    expect(countTags(rows)).toEqual({ stock: 2, todo: 1 });
    expect(originsOf(rows).map((o) => [o.k, o.n, o.pz])).toEqual([['stock', 2, { A: 1, B: 1 }], ['todo', 1, { B: 1 }]]);
  });
  it('in production: printing on the first job, queued after, unassigned otherwise', () => {
    expect(itemRows(set, 'in_production', [{ printerId: 'p1', printerName: 'Bambu', progress: 40, waitMinutes: 0, position: 0 }])[1]!.tags[1]).toMatchObject({ k: 'print', n: 1, pct: 40, s: 'Bambu · 40%' });
    expect(itemRows(set, 'in_production', [{ printerId: 'p1', printerName: 'Bambu', progress: 0, waitMinutes: 90, position: 1 }])[1]!.tags[1]).toMatchObject({ k: 'queue', s: 'Bambu · le toca en ~1 h 30 min' });
    expect(itemRows({ ...set, printerId: null }, 'in_production', [])[1]!.tags[1]).toMatchObject({ k: 'warn', s: 'falta asignar' });
  });
  it('ready and delivered count every piece', () => {
    expect(countTags(itemRows(set, 'ready', []))).toEqual({ ok: 3 });
    expect(countTags(itemRows(set, 'delivered', []))).toEqual({ done: 3 });
    expect([originLabel('ok', 1), originLabel('ok', 3), originLabel('done', 2)]).toEqual(['Lista', 'Listas', 'Entregadas']);
  });
});
