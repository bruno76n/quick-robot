// Product families (mejoras/ronda-2.md §3.1, docs/12 §5): one page of originals, then their variants with
// parent_id IN (…). Two queries of pieces per page, never one per card; counts come from one aggregate.
import { and, asc, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm';
import type { Ctx } from '../ctx';
import type { Executor } from '../db';
import { filament, product, productFilament, productSupply } from '../schema';
import type { ProductFull, ProductRow } from './product-repo';
import { inWorkspace, likePattern } from './scope';

export type FamilyFilter = 'all' | 'technical' | 'with_variants';
export interface FamilyPageOpts {
  q?: string | undefined;
  filter?: FamilyFilter | undefined;
  tag?: string | undefined;
  page: number;
  pageSize: number;
  /** Material prefixes that make a piece technical (core › TECHNICAL_MATERIALS); db does not import core. */
  technicalPrefixes: readonly string[];
}
export interface FamilyCounts { families: number; technical: number; withVariants: number }
export interface FamilyPage { roots: ProductFull[]; variants: ProductFull[]; total: number; counts: FamilyCounts }

const m = sql`m`;
/** An original: no parent, or a parent that is not alive (old data; the migration already fixes it). */
const isRoot = sql`(${product.parentId} is null or not exists (select 1 from ${product} o where o.workspace_id = ${product.workspaceId} and o.id = ${product.parentId} and o.deleted_at is null))`;
/** Live members of the family of the outer row: itself and its live variants. */
const memberOf = sql`${m}.workspace_id = ${product.workspaceId} and ${m}.deleted_at is null and (${m}.id = ${product.id} or ${m}.parent_id = ${product.id})`;

function searchCond(q: string | undefined): SQL | undefined {
  const t = q?.trim();
  if (!t) return undefined;
  const p = likePattern(t);
  return sql`exists (select 1 from ${product} ${m} where ${memberOf} and (${m}.name ilike ${p} or ${m}.variant_label ilike ${p} or array_to_string(${m}.tags, ' ') ilike ${p}))`;
}
function tagCond(tag: string | undefined): SQL | undefined {
  return tag ? sql`exists (select 1 from ${product} ${m} where ${memberOf} and ${tag} = any(${m}.tags))` : undefined;
}
function technicalCond(prefixes: readonly string[]): SQL {
  const patterns = prefixes.map((x) => `${x.toUpperCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  if (!patterns.length) return sql`false`;
  return sql`exists (select 1 from ${product} ${m} join ${productFilament} pf on pf.workspace_id = ${m}.workspace_id and pf.product_id = ${m}.id
    join ${filament} f on f.workspace_id = pf.workspace_id and f.id = pf.filament_id
    where ${memberOf} and upper(f.material) like any (array[${sql.join(patterns.map((x) => sql`${x}`), sql`, `)}]))`;
}
const hasVariants = sql`exists (select 1 from ${product} v where v.workspace_id = ${product.workspaceId} and v.parent_id = ${product.id} and v.deleted_at is null)`;

async function withParts(ex: Executor, ctx: Ctx, rows: ProductRow[]): Promise<ProductFull[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const fil = await ex.select().from(productFilament).where(and(inWorkspace(productFilament.workspaceId, ctx), inArray(productFilament.productId, ids))).orderBy(asc(productFilament.position));
  const sup = await ex.select().from(productSupply).where(and(inWorkspace(productSupply.workspaceId, ctx), inArray(productSupply.productId, ids))).orderBy(asc(productSupply.position));
  return rows.map((r) => ({ ...r, filaments: fil.filter((f) => f.productId === r.id), supplies: sup.filter((s) => s.productId === r.id) }));
}

/** One page of families: originals that match (any member counts for search, tag and technical), then their variants. */
export async function listProductFamilies(ex: Executor, ctx: Ctx, opts: FamilyPageOpts): Promise<FamilyPage> {
  const base = and(inWorkspace(product.workspaceId, ctx), isNull(product.deletedAt), isRoot, searchCond(opts.q), tagCond(opts.tag));
  const technical = technicalCond(opts.technicalPrefixes);
  const [c] = await ex.select({
    families: sql<number>`count(*)::int`,
    technical: sql<number>`(count(*) filter (where ${technical}))::int`,
    withVariants: sql<number>`(count(*) filter (where ${hasVariants}))::int`,
  }).from(product).where(base);
  const counts: FamilyCounts = { families: c?.families ?? 0, technical: c?.technical ?? 0, withVariants: c?.withVariants ?? 0 };
  const filter = opts.filter ?? 'all';
  const total = filter === 'technical' ? counts.technical : filter === 'with_variants' ? counts.withVariants : counts.families;
  const roots = await ex.select().from(product)
    .where(and(base, filter === 'technical' ? technical : filter === 'with_variants' ? hasVariants : undefined))
    .orderBy(asc(product.createdAt), asc(product.id)).limit(opts.pageSize).offset((opts.page - 1) * opts.pageSize);
  const variants = roots.length
    ? await ex.select().from(product).where(and(inWorkspace(product.workspaceId, ctx), isNull(product.deletedAt), inArray(product.parentId, roots.map((r) => r.id))))
      .orderBy(asc(product.createdAt), asc(product.id))
    : [];
  const full = await withParts(ex, ctx, [...roots, ...variants]);
  return { roots: full.slice(0, roots.length), variants: full.slice(roots.length), total, counts };
}

/** Live variants of an original (deleteProduct › PRODUCT_HAS_VARIANTS). */
export async function countLiveVariants(ex: Executor, ctx: Ctx, parentId: string): Promise<number> {
  const [r] = await ex.select({ n: sql<number>`count(*)::int` }).from(product).where(and(inWorkspace(product.workspaceId, ctx), eq(product.parentId, parentId), isNull(product.deletedAt)));
  return r?.n ?? 0;
}
