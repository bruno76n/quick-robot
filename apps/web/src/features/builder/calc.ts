// The builder's live preview (mockup bAlloc, bCalc, bShare). Money in pesos; the server recalculates on save.
import { floorPrice } from '@app/core';
import { parseNumber } from '../../lib/input';

export interface Line { kind: 'piece' | 'set'; id: string; qty: string; unit: string; man?: Record<string, number> }
export interface PieceDef { id: string; name: string; list: number; cost: number; hours: number; tracks: boolean; filaments?: readonly { filamentId: string; grams: number }[] }
export interface SetDef { id: string; name: string; list: number; cost: number; parts: readonly { productId: string; qty: number }[] }
export interface Defs { pieces: Map<string, PieceDef>; sets: Map<string, SetDef>; free: (productId: string) => number }

export const lineQty = (l: Line) => Math.max(1, Math.round(parseNumber(l.qty, 1)));

export function lineNeed(l: Line, d: Defs): Record<string, number> {
  const n = lineQty(l), need: Record<string, number> = {};
  const add = (pid: string, q: number) => { if (d.pieces.has(pid)) need[pid] = (need[pid] ?? 0) + q; };
  if (l.kind === 'piece') add(l.id, n);
  else for (const p of d.sets.get(l.id)?.parts ?? []) add(p.productId, Math.max(1, p.qty) * n);
  return need;
}

/** Where each piece comes from: the free pieces first (lines in order), the rest is printed. In an order the person can lower it. */
export function allocate(lines: readonly Line[], d: Defs, order: boolean): Record<string, number>[] {
  const rem = new Map<string, number>();
  const left = (pid: string) => { if (!rem.has(pid)) rem.set(pid, d.pieces.get(pid)?.tracks ? d.free(pid) : 0); return rem.get(pid)!; };
  return lines.map((l) => {
    const use: Record<string, number> = {};
    for (const [pid, need] of Object.entries(lineNeed(l, d))) {
      const can = Math.max(0, Math.min(need, left(pid)));
      const u = order && l.man?.[pid] !== undefined ? Math.min(can, Math.max(0, l.man[pid]!)) : can;
      use[pid] = u;
      rem.set(pid, left(pid) - u);
    }
    return use;
  });
}

export interface Row {
  i: number; line: Line; name: string; set: boolean; n: number; unit: number; c1: number; list: number; total: number; cost: number;
  need: Record<string, number>; use: Record<string, number>; print: Record<string, number>; hours: number; pieces: number; printN: number; useN: number;
}
const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);

export function calc(lines: readonly Line[], d: Defs, o: { order: boolean; gPct: number; commissionPct: number; minMarginPct: number }) {
  const uses = allocate(lines, d, o.order);
  const rows: Row[] = [];
  lines.forEach((line, i) => {
    const def = line.kind === 'set' ? d.sets.get(line.id) : d.pieces.get(line.id);
    if (!def) return;
    const n = lineQty(line), unit = Math.max(0, parseNumber(line.unit)), need = lineNeed(line, d), use = uses[i]!, print: Record<string, number> = {};
    for (const [pid, q] of Object.entries(need)) { const k = q - (use[pid] ?? 0); if (k > 0) print[pid] = k; }
    const hours = Object.entries(print).reduce((a, [pid, k]) => a + (d.pieces.get(pid)?.hours ?? 0) * k, 0);
    rows.push({ i, line, name: def.name, set: line.kind === 'set', n, unit, c1: def.cost, list: def.list, total: n * unit, cost: n * def.cost, need, use, print, hours, pieces: sum(need), printN: sum(print), useN: sum(need) - sum(print) });
  });
  const f = 1 - o.gPct / 100;
  const sub = rows.reduce((a, r) => a + r.total, 0), total = sub * f, cost = rows.reduce((a, r) => a + r.cost, 0), commission = (total * o.commissionPct) / 100;
  const print: Record<string, number> = {};
  for (const r of rows) for (const [pid, k] of Object.entries(r.print)) print[pid] = (print[pid] ?? 0) + k;
  const material: Record<string, number> = {};
  for (const [pid, k] of Object.entries(print)) for (const fl of d.pieces.get(pid)?.filaments ?? []) material[fl.filamentId] = (material[fl.filamentId] ?? 0) + fl.grams * k;
  return {
    rows, sub, total, discount: sub - total, cost, commission, profit: total - commission - cost, print, material,
    hours: rows.reduce((a, r) => a + r.hours, 0), list: rows.reduce((a, r) => a + r.n * r.list, 0), pieces: rows.reduce((a, r) => a + r.pieces, 0),
    printN: rows.reduce((a, r) => a + r.printN, 0), useN: rows.reduce((a, r) => a + r.useN, 0),
    floor: rows.reduce((a, r) => a + r.n * floorPrice(r.c1, o.minMarginPct), 0),
  };
}
export type Calc = ReturnType<typeof calc>;

/** Each piece's share of the line price: a set is split by the list price of its pieces (mockup bShare). */
export function share(r: Row, d: Defs): Record<string, { qty: number; income: number }> {
  if (!r.set) return { [r.line.id]: { qty: r.n, income: r.n * r.unit } };
  const parts = (d.sets.get(r.line.id)?.parts ?? []).filter((p) => d.pieces.has(p.productId));
  const w = parts.map((p) => Math.max(0, d.pieces.get(p.productId)!.list) * Math.max(1, p.qty));
  const W = w.reduce((a, b) => a + b, 0);
  const out: Record<string, { qty: number; income: number }> = {};
  parts.forEach((p, k) => {
    const x = out[p.productId] ?? (out[p.productId] = { qty: 0, income: 0 });
    x.qty += Math.max(1, p.qty) * r.n;
    x.income += r.n * r.unit * (W > 0 ? w[k]! / W : 1 / parts.length);
  });
  return out;
}

/** "Separar en piezas": one line per part, the set price split by list price (mockup b-sep). */
export function splitSet(l: Line, d: Defs): Line[] {
  const s = d.sets.get(l.id);
  if (!s) return [l];
  const parts = s.parts.filter((p) => d.pieces.has(p.productId));
  const n = lineQty(l);
  const L = parts.reduce((a, p) => a + d.pieces.get(p.productId)!.list * Math.max(1, p.qty), 0);
  const f = L > 0 ? parseNumber(l.unit) / L : 1;
  return parts.map((p) => ({ kind: 'piece', id: p.productId, qty: String(Math.max(1, p.qty) * n), unit: String(Math.round(d.pieces.get(p.productId)!.list * f * 100) / 100) }));
}
