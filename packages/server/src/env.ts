import type { Session } from './deps';

/** Hono environment: every authenticated request carries its ctx. */
export interface AppEnv {
  Variables: { ctx: Session; requestId: string };
}
