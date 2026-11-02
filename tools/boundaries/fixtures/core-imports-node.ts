// NEGATIVE FIXTURE — linted as if it lived in packages/core/src. Must be rejected.
import { readFileSync } from 'node:fs';

export const broken = readFileSync;
