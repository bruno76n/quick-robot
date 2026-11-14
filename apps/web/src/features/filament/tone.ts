import type { FilamentListItem, Spool } from '@app/contract';
import type { Tone } from '../../components/Pill';

// Ronda 3: "Normal" is a grey pill like the mockup; amber and red only when the state is.
export const FILAMENT_TONE: Record<FilamentListItem['status'], Tone> = { no_spools: 'plain', out: 'bad', ending: 'bad', low: 'warn', new: 'info', ok: '' };
export const METER_TONE: Record<Tone, '' | 'warn' | 'bad'> = { plain: '', info: '', good: '', ok: '', '': '', warn: 'warn', bad: 'bad' };
export const SPOOL_TONE: Record<Spool['status'], Tone> = { in_use: 'info', new: 'ok', empty: 'plain' };
