import type { Catalogue, CostingContextDto, Product } from '@app/contract';
import type { CostingContext } from '@app/core';
import { create } from 'zustand';

/** Interface preference (not data): tiles or list, kept while the app is open. */
export const useCatalogView = create<{ view: 'tiles' | 'list'; setView: (v: 'tiles' | 'list') => void }>((set) => ({ view: 'tiles', setView: (view) => set({ view }) }));

/** Same mapping the server does (queries/costing.ts): the DTO into core's costing context. */
export function costingFromDto(dto: CostingContextDto): CostingContext {
  return {
    settings: dto.settings,
    printers: dto.printers,
    filaments: Object.fromEntries(dto.filaments.map((f) => [f.id, { costPerGram: f.costPerGram, material: f.material }])),
    supplies: Object.fromEntries(dto.supplies.map((x) => [x.id, { cost: x.cost }])),
  };
}

export const hexesOf = (p: Pick<Product, 'filaments'>, ctx: CostingContextDto | undefined) =>
  p.filaments.map((f) => ctx?.filaments.find((x) => x.id === f.filamentId)?.hex).filter((h): h is string => !!h);

export const timesCost = (price: number, cost: number) => (cost > 0 ? price / cost : 0);

export type { Catalogue };
