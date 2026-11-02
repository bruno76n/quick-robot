import type { Filament } from '@app/contract';

/** "PLA Negro" — a filament is material + color. */
export const filamentName = (f: Pick<Filament, 'material' | 'color'>) => `${f.material} ${f.color}`;
