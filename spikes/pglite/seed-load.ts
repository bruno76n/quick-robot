// Deterministic synthetic load: N sales with ~2 line items each over the last 5 years.
import { sql } from 'drizzle-orm';
import { workspace, salesChannel, product, sale, lineItem } from './schema.ts';

function rng(seed: number) { return () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648); }
const uuid = (n: number, tag: number) => `00000000-0000-7000-8${tag.toString(16).padStart(3, '0')}-${n.toString(16).padStart(12, '0')}`;

export const WS = uuid(1, 0);

export async function seedLoad(db: any, sales: number, today = new Date('2026-11-01')) {
  const r = rng(42);
  await db.insert(workspace).values({ id: WS, name: 'load' });
  await db.insert(salesChannel).values([0, 1, 2].map((i) => ({ workspaceId: WS, id: uuid(i, 1), name: `c${i}`, commissionPct: String(i * 5) })));
  await db.insert(product).values(Array.from({ length: 500 }, (_, i) => ({ workspaceId: WS, id: uuid(i, 2), name: `p${i}` })));
  const days = 5 * 365;
  let li = 0;
  for (let start = 0; start < sales; start += 1000) {
    const s: any[] = []; const l: any[] = [];
    for (let i = start; i < Math.min(sales, start + 1000); i++) {
      const d = new Date(today.getTime() - Math.floor(r() * days) * 86400000).toISOString().slice(0, 10);
      s.push({ workspaceId: WS, id: uuid(i, 3), on: d, channelId: uuid(Math.floor(r() * 3), 1) });
      const items = 1 + Math.floor(r() * 3);
      for (let k = 0; k < items; k++) {
        l.push({ workspaceId: WS, id: uuid(li++, 4), parentKind: 'sale', parentId: uuid(i, 3), productId: uuid(Math.floor(r() * 500), 2), qty: 1 + Math.floor(r() * 4), priceCents: 5000 + Math.floor(r() * 50000), costCents: 1000 + Math.floor(r() * 9000) });
      }
    }
    await db.insert(sale).values(s);
    for (let j = 0; j < l.length; j += 1000) await db.insert(lineItem).values(l.slice(j, j + 1000));
  }
  await db.execute(sql`analyze`);
  return { sales, lineItems: li };
}
