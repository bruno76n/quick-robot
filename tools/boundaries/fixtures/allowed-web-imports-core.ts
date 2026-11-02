// POSITIVE FIXTURE — linted as if it lived in apps/web/src. Must pass (web → contract, core is allowed).
import { round2 } from '@app/core';
import { filamentSchema } from '@app/contract';

export const ok = [round2, filamentSchema];
