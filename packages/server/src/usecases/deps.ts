import type { Database } from '@app/db';
import type { Clock, Entitlements } from '../deps';

/** What write use cases need. Every use case runs in one transaction. */
export interface UseCaseDeps {
  database: Database;
  entitlements: Entitlements;
  clock: Clock;
}
