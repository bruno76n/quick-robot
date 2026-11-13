// Live preview of a piece in the browser with the same core functions the server uses (docs/06 §3.1).
// The server recalculates when saving; this is only the preview.
import type { FilamentListItem, PrinterView, SettingsView, SupplyListItem } from '@app/contract';
import { costProduct, effectiveMargin, floorPrice, isTechnicalMaterial, listPrice, type PrinterCost } from '@app/core';

export interface Draft {
  name: string; tags: string[]; mode: 'value' | 'formula'; price: string; margin: string; printerId: string; hours: string; minutes: string;
  batch: string; extras: string; filaments: { filamentId: string; grams: string }[]; supplies: { supplyId: string; qty: string }[];
  spec: Record<string, string>; note: string; tracksStock: boolean; photoFileId: string | null; photoUrl: string | null; parentId: string | null;
  /** Only for a variant: its label ("Silk morado"). */
  variantLabel: string;
}

export const num = (v: string | number | undefined, d = 0) => { const x = Number.parseFloat(String(v ?? '').replace(/[,\s$]/g, '')); return Number.isFinite(x) ? x : d; };
export const toPrinterCost = (p: PrinterView): PrinterCost => ({ costPesos: p.costCents / 100, lifeHours: p.lifeHours, maintenancePerHour: p.maintenanceCentsPerHour / 100, kw: p.kw });
export const draftHours = (d: Pick<Draft, 'hours' | 'minutes'>) => num(d.hours) + num(d.minutes) / 60;

export interface Catalog { settings: SettingsView; printers: PrinterView[]; filaments: FilamentListItem[]; supplies: SupplyListItem[] }

export function previewCost(d: Draft, c: Catalog, printerId = d.printerId) {
  const printer = c.printers.find((p) => p.id === printerId);
  return costProduct({
    hours: draftHours(d), extras: num(d.extras), printer: printer ? toPrinterCost(printer) : null,
    filaments: d.filaments.filter((f) => f.filamentId).map((f) => ({ grams: num(f.grams), costPerGram: c.filaments.find((x) => x.id === f.filamentId)?.costPerGram ?? 0 })),
    supplies: d.supplies.filter((s) => s.supplyId).map((s) => ({ qty: num(s.qty), unitCost: (c.supplies.find((x) => x.id === s.supplyId)?.costCents ?? 0) / 100 })),
  }, c.printers.map(toPrinterCost), { kwhPrice: c.settings.kwhPriceCents / 100, purgePct: c.settings.purgePct, failurePct: c.settings.failurePct });
}

export const marginOf = (d: Draft, c: Catalog) => effectiveMargin(d.margin === '' ? null : num(d.margin), c.settings.formulaMarginPct);
export const priceOf = (d: Draft, c: Catalog, total: number) => listPrice(d.mode, total, marginOf(d, c), num(d.price));
export const floorOf = (total: number, c: Catalog) => floorPrice(total, c.settings.minMarginPct);
export const isTechnical = (d: Draft, c: Catalog) => d.filaments.some((f) => isTechnicalMaterial(c.filaments.find((x) => x.id === f.filamentId)?.material ?? ''));
