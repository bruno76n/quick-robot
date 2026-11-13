// Existencias by families and Inicio (docs/12 §8 and §9, mejoras/ronda-2.md §4 and §5, R9).
import { z } from 'zod';
import { id, pageQuery } from './common';

export const stockStatus = z.enum(['out', 'all_reserved', 'few', 'ok']);
export const stockQuery = pageQuery.extend({
  status: z.enum(['all', 'few', 'all_reserved', 'ok', 'out']).default('all'),
  sort: z.enum(['free_asc', 'free_desc']).default('free_asc'),
});
const level = { physical: z.number(), reserved: z.number(), free: z.number(), status: stockStatus };
const pieceFields = {
  productId: id, name: z.string(), displayName: z.string(), photoUrl: z.string().nullable(), hexes: z.array(z.string()),
  listCents: z.number().int(), costCents: z.number().int(), printerName: z.string().nullable(), ...level,
};
/** A member of a family (original first, `label` null for it). */
export const stockMember = z.object({ ...pieceFields, label: z.string().nullable(), isOriginal: z.boolean() });
/** A row: a simple piece (members empty) or a family with the sum of its members. */
export const stockRow = z.object({ ...pieceFields, members: z.array(stockMember) });
export const stockCounts = z.object({ all: z.number().int(), few: z.number().int(), allReserved: z.number().int(), ok: z.number().int(), out: z.number().int() });
export const stockPage = z.object({
  items: z.array(stockRow), page: z.number().int(), pageSize: z.number().int(), total: z.number().int(), counts: stockCounts,
  /** units = physical pieces; pieces = families with stock (a family counts once). `physical` = units (kept for older screens). */
  totals: z.object({ units: z.number(), pieces: z.number().int(), free: z.number(), reserved: z.number(), physical: z.number() }),
  untracked: z.array(z.object({ id, name: z.string() })),
  sets: z.array(z.object({ id, name: z.string(), buildableSets: z.number().int().nullable() })),
});

export const attentionSeverity = z.enum(['urgent', 'soon', 'review']);
export const attention = z.object({
  kind: z.enum(['order_filament_short', 'order_due', 'sale_owed', 'filament_low', 'supply_low', 'maintenance', 'price_below_floor', 'backup']),
  severity: attentionSeverity, target: z.object({ type: z.string(), id: id.nullable() }), params: z.record(z.string(), z.unknown()),
});
export const homeOutput = z.object({
  stats: z.record(z.string(), z.number()), printingNow: z.array(z.record(z.string(), z.unknown())), attentions: z.array(attention),
  upcoming: z.array(z.record(z.string(), z.unknown())),
}).loose();

export type StockQuery = z.infer<typeof stockQuery>;
export type StockRow = z.infer<typeof stockRow>;
export type StockMember = z.infer<typeof stockMember>;
export type StockPage = z.infer<typeof stockPage>;
export type AttentionSeverity = z.infer<typeof attentionSeverity>;
export type Attention = z.infer<typeof attention>;
export type HomeOutput = z.infer<typeof homeOutput>;
