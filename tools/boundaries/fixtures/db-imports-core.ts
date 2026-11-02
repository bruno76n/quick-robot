// NEGATIVE FIXTURE — linted as if it lived in packages/db/src. Must be rejected.
import { round2 } from '@app/core';

export const broken = round2;
