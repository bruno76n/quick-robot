// Calculator draft: what the form holds, how it becomes the API input and the costing input for core.
import type { PrintSpec, Product, ProductInput } from '@app/contract';
import { toMinutes, type ProductForCosting } from '@app/core';
import { centsFromText, numFromText, textFromCents, textFromNum } from '../../lib/numbers';

export const ANY_PRINTER = '*';

export interface Draft {
  name: string;
  /** '' = no printers, '*' = average, otherwise a printer id. */
  printerId: string;
  hours: string;
  minutes: string;
  filaments: { filamentId: string; grams: string }[];
  supplies: { supplyId: string; qty: string }[];
  batch: string;
  extras: string;
  mode: 'value' | 'formula';
  price: string;
  margin: string;
  tags: string[];
  note: string;
  spec: PrintSpec;
  tracksStock: boolean;
  /** undefined = unchanged, null = removed, id = new upload. */
  photoFileId?: string | null;
  photoUrl: string | null;
}

export function emptyDraft(firstPrinterId: string | undefined): Draft {
  return { name: '', printerId: firstPrinterId ?? '', hours: '', minutes: '', filaments: [{ filamentId: '', grams: '' }], supplies: [], batch: '1', extras: '', mode: 'value', price: '', margin: '', tags: [], note: '', spec: {}, tracksStock: false, photoUrl: null };
}

export function draftFromProduct(p: Product): Draft {
  const h = Math.floor(p.printMinutes / 60);
  const m = p.printMinutes - h * 60;
  return {
    name: p.name,
    printerId: p.printerId ?? ANY_PRINTER,
    hours: h ? String(h) : '',
    minutes: m ? String(m) : '',
    filaments: p.filaments.length ? p.filaments.map((f) => ({ filamentId: f.filamentId, grams: textFromNum(f.grams) })) : [{ filamentId: '', grams: '' }],
    supplies: p.supplies.map((s) => ({ supplyId: s.supplyId, qty: textFromNum(s.qty) })),
    batch: String(p.batchSize),
    extras: p.extrasCents ? textFromCents(p.extrasCents) : '',
    mode: p.mode,
    price: p.mode === 'value' && p.priceCents ? textFromCents(p.priceCents) : '',
    margin: p.marginPct == null ? '' : textFromNum(p.marginPct),
    tags: [...p.tags],
    note: p.note,
    spec: { ...(p.spec ?? {}) },
    tracksStock: p.tracksStock,
    photoUrl: p.photoUrl,
  };
}

const printMinutes = (d: Draft) => toMinutes(numFromText(d.hours), numFromText(d.minutes));

export function forCosting(d: Draft, overridePrinter?: string): ProductForCosting {
  const pid = overridePrinter ?? d.printerId;
  return {
    mode: d.mode,
    price: numFromText(d.price),
    marginPct: d.margin.trim() === '' ? null : Math.min(95, Math.max(0, numFromText(d.margin))),
    printerId: pid && pid !== ANY_PRINTER ? pid : null,
    hours: printMinutes(d) / 60,
    extras: numFromText(d.extras),
    filaments: d.filaments.filter((f) => f.filamentId).map((f) => ({ filamentId: f.filamentId, grams: numFromText(f.grams) })),
    supplies: d.supplies.filter((s) => s.supplyId).map((s) => ({ supplyId: s.supplyId, qty: numFromText(s.qty) })),
  };
}

export function toInput(d: Draft, parentId: string | null): ProductInput {
  const c = forCosting(d);
  const spec = Object.fromEntries(Object.entries(d.spec).filter(([, v]) => v && String(v).trim())) as PrintSpec;
  return {
    name: d.name,
    parentId,
    mode: d.mode,
    priceCents: d.mode === 'value' ? Math.max(0, centsFromText(d.price)) : 0,
    marginPct: c.marginPct,
    printerId: c.printerId,
    printMinutes: printMinutes(d),
    batchSize: Math.max(1, Math.round(numFromText(d.batch, 1))),
    extrasCents: Math.max(0, centsFromText(d.extras)),
    tracksStock: d.tracksStock,
    tags: d.tags,
    note: d.note,
    spec: Object.keys(spec).length ? spec : null,
    filaments: c.filaments.map((f) => ({ ...f, grams: Math.max(0, Math.round(f.grams * 10) / 10) })),
    supplies: c.supplies.filter((s) => s.qty > 0),
    ...(d.photoFileId !== undefined ? { photoFileId: d.photoFileId } : {}),
  };
}
