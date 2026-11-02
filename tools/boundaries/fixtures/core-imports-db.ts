// NEGATIVE FIXTURE — linted as if it lived in packages/core/src. Must be rejected.
import { connectPglite } from '@app/db';

export const broken = connectPglite;
