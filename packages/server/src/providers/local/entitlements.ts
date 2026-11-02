import type { Entitlements } from '../../deps';

/** Local mode has no plan limits. */
export const localEntitlements: Entitlements = {
  async assert() {},
};
