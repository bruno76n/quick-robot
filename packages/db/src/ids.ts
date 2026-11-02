import { v7 } from 'uuid';

/** UUID v7 (time ordered), generated on the server side (docs/05). */
export const newId = (): string => v7();
