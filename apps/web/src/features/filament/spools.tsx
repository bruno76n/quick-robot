// Spools in the screens of ronda 4 (docs/mejoras/ronda-4.md §5): the number tag, where the cost per gram of a filament comes
// from, and the bridge from the API shapes to core (the dialogs preview with core; the server recalculates and decides).
import type { FilamentListItem, Spool } from '@app/contract';
import { useState } from 'react';
import { filamentCost, normalizeName, type FilamentCost, type SpoolInput } from '@app/core';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { centsTotal, money3d } from '../../lib/format';
import './spools.css';

const L = es.screens.spools;
type Filament = Pick<FilamentListItem, 'id' | 'material' | 'color' | 'costPerGram' | 'costSource' | 'costSpoolNumbers' | 'referenceCentsPerKg' | 'spools'>;

/** "#7": the tag the workshop writes on the container (mockup .rnum). */
export function SpoolTag({ n, small }: { n: number; small?: boolean }) {
  return <span className={`rnum${small ? ' sm' : ''}`}>{t('screens.spools.number', { number: n })}</span>;
}

export const spoolName = (n: number) => t('screens.spools.number', { number: n });
/** "#3, #5 y #9", oldest number first (mockup). */
export const spoolNumbers = (numbers: readonly number[]) => [...numbers].sort((a, b) => a - b).map(spoolName);
/** "$0.250/g". */
export const perGram = (pesos: number) => t('screens.spools.perGram', { amount: money3d(pesos) });
export const filamentName = (f: Pick<FilamentListItem, 'material' | 'color'>) => `${f.material} ${f.color}`;

/** A spool of the API as core reads it (pesos, remaining grams). */
export function toSpoolInput(s: Spool): SpoolInput & { filamentId: string } {
  return { id: s.id, number: s.number, purchasedOn: s.purchasedOn, grams: s.grams, costPesos: s.costCents / 100, shippingPesos: s.shippingCents / 100, remaining: s.remainingGrams, noCost: s.noCost, filamentId: s.filamentId };
}

/** Spools of every filament of the same material (any color): the fallback of the cost per gram (docs/04 §1). */
export function materialSpools(all: readonly Filament[], material: string): SpoolInput[] {
  const k = normalizeName(material);
  return all.filter((f) => normalizeName(f.material) === k).flatMap((f) => f.spools.map(toSpoolInput));
}

/** Cost per gram of a filament with extra spools (Agregar rollo's preview), with the workspace's N and the material fallback. */
export function previewCost(all: readonly Filament[], material: string, own: readonly SpoolInput[], extraMaterial: readonly SpoolInput[], n: number, referenceCentsPerKg: number | null): FilamentCost {
  return filamentCost(own, { n, materialSpools: [...materialSpools(all, material), ...extraMaterial], referenceCentsPerKg });
}

/** Short source under the cost per gram: "promedio de #3, #5 y #9", "promedio de PLA", "precio de referencia". */
export function costSourceShort(f: Pick<Filament, 'material' | 'costSource' | 'costSpoolNumbers'>): string {
  if (f.costSource === 'purchases') return t('screens.spools.source.purchases', { numbers: spoolNumbers(f.costSpoolNumbers) });
  if (f.costSource === 'material') return t('screens.spools.source.material', { material: f.material });
  return L.source[f.costSource];
}

/** The sentence of the "i" and of the spool drawer: which purchases form the cost per gram, or why there is none. */
export function costSourceLong(f: Pick<Filament, 'material' | 'color' | 'costSource' | 'costSpoolNumbers' | 'referenceCentsPerKg'>): string {
  const numbers = spoolNumbers(f.costSpoolNumbers);
  if (f.costSource === 'purchases') return t('screens.spools.sourceLong.purchases', { count: numbers.length, numbers });
  if (f.costSource === 'material') return t('screens.spools.sourceLong.material', { material: f.material, numbers });
  if (f.costSource === 'reference') return t('screens.spools.sourceLong.reference', { price: centsTotal(f.referenceCentsPerKg ?? 0) });
  return t('screens.spools.sourceLong.none', { filament: filamentName(f) });
}

/** The «i» next to a cost per gram (Pieza): tapping it says which purchases form it, or why there is none (ronda-4 §5). */
export function CostInfo({ f }: { f: Pick<Filament, 'id' | 'material' | 'color' | 'costSource' | 'costSpoolNumbers' | 'referenceCentsPerKg'> }) {
  const [open, setOpen] = useState(false);
  const id = `ci-${f.id}`;
  return (
    <>
      <button type="button" className={`ib${f.costSource === 'none' ? ' bad' : ''}`} aria-expanded={open} aria-controls={id} aria-label={L.sourceAria} onClick={() => setOpen(!open)} data-testid="cost-info">{L.info}</button>
      {open ? <span id={id} className="ci-t" role="note">{costSourceLong(f)}</span> : null}
    </>
  );
}
