// NEGATIVE FIXTURE — linted as if it lived in apps/web/src. Must be rejected.
import { filamentRepo } from '@app/db';

export const broken = filamentRepo;
