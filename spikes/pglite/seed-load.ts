// Loads ~5 000 sales (12 months) for two workspaces using a deterministic PRNG.
import { randomUUID } from 'node:crypto';
import * as s from './schema.ts';

type AnyDb = { insert: any; transaction: any };

function prng(seed: number) {
  let x = seed >>> 0;
  return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

export const WS_A = '00000000-0000-7000-8000-00000000000a';
export const WS_B = '00000000-0000-7000-8000-00000000000b';

export async function seedLoad(db: AnyDb, sales = 5000) {
  const rnd = prng(42);
  await db.insert(s.workspace).values([
    { id: WS_A, name: 'A' },
    { id: WS_B, name: 'B' },
  ]);
  for (const ws of [WS_A, WS_B]) {
    const products = Array.from({ length: 40 }, (_, i) => ({
      id: randomUUID(),
      workspaceId: ws,
      name: `Product ${i + 1}`,
      priceCents: 5000 + Math.floor(rnd() * 50000),
    }));
    await db.insert(s.product).values(products);
    const n = ws === WS_A ? sales : Math.floor(sales / 5);
    const start = Date.UTC(2025, 10, 1);
    const saleRows: (typeof s.sale.$inferInsert)[] = [];
    const items: (typeof s.lineItem.$inferInsert)[] = [];
    for (let i = 0; i < n; i++) {
      const id = randomUUID();
      const on = new Date(start + Math.floor(rnd() * 365) * 86400000).toISOString().slice(0, 10);
      saleRows.push({ id, workspaceId: ws, on, channel: ['Local', 'Instagram', 'Mercado Libre'][i % 3]! });
      const k = 1 + Math.floor(rnd() * 3);
      for (let j = 0; j < k; j++) {
        const p = products[Math.floor(rnd() * products.length)]!;
        items.push({
          id: randomUUID(),
          workspaceId: ws,
          saleId: id,
          productId: p.id,
          qty: 1 + Math.floor(rnd() * 4),
          priceCents: p.priceCents,
          costCents: Math.floor(p.priceCents * 0.45),
        });
      }
    }
    await db.transaction(async (tx: AnyDb) => {
      for (let i = 0; i < saleRows.length; i += 1000) await tx.insert(s.sale).values(saleRows.slice(i, i + 1000));
      for (let i = 0; i < items.length; i += 1000) await tx.insert(s.lineItem).values(items.slice(i, i + 1000));
    });
  }
}
