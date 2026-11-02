// "Sales per product, 12 months" — the report query from docs/02 §4 criterion 2.
import { sql } from 'drizzle-orm';

export function salesByProductQuery(workspaceId: string, from: string, to: string) {
  return sql`
    select p.id, p.name,
           sum(li.qty)::int                       as units,
           sum(li.qty * li.price_cents)::bigint   as revenue_cents,
           sum(li.qty * li.cost_cents)::bigint    as cost_cents,
           count(distinct s.id)::int              as sales
      from sale s
      join line_item li on li.workspace_id = s.workspace_id and li.sale_id = s.id
      join product p    on p.workspace_id = s.workspace_id and p.id = li.product_id
     where s.workspace_id = ${workspaceId}
       and s.on between ${from} and ${to}
     group by p.id, p.name
     order by revenue_cents desc`;
}

export function monthlyQuery(workspaceId: string, from: string, to: string) {
  return sql`
    select date_trunc('month', s.on)::date as month,
           sum(li.qty * li.price_cents)::bigint as revenue_cents
      from sale s join line_item li on li.workspace_id = s.workspace_id and li.sale_id = s.id
     where s.workspace_id = ${workspaceId} and s.on between ${from} and ${to}
     group by 1 order by 1`;
}
