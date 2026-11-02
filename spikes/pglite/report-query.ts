// "Sales by product" for a period: reads only the needed columns in one query (docs/15 §3.5).
import { sql } from 'drizzle-orm';
import { WS } from './seed-load.ts';

export async function salesByProduct(db: any, from: string | null, to: string) {
  const r = await db.execute(sql`
    select li.product_id, sum(li.qty)::int as qty, sum(li.qty * li.price_cents)::bigint as revenue,
           sum(li.qty * li.cost_cents)::bigint as cost
    from sale s
    join line_item li on li.workspace_id = s.workspace_id and li.parent_kind = 'sale' and li.parent_id = s.id
    where s.workspace_id = ${WS} and s.deleted_at is null
      and (${from}::date is null or s.on >= ${from}::date) and s.on <= ${to}::date
    group by li.product_id order by revenue desc`);
  return (r.rows ?? r) as unknown[];
}
