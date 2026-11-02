import type { Entitlements } from '../../deps';

/** Local mode: no plan, everything allowed (docs/08). */
export const unlimitedEntitlements: Entitlements = { assert: async () => undefined };
