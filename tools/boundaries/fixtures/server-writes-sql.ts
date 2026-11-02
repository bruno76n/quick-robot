// NEGATIVE FIXTURE — linted as if it lived in packages/server/src. Must be rejected (only db writes SQL).
import { sql } from 'drizzle-orm';

export const broken = sql`select 1`;
