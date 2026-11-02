// Configuration of the local runner, validated at start (docs/11 · A02): anything wrong → refuse to start
// with a clear message instead of running with unsafe defaults.
import { z } from 'zod';

export const LocalConfig = z
  .object({
    DATA_DIR: z.string().min(1).optional(),
    PORT: z.coerce.number().int().min(0).max(65535).default(8787),
    /** Only 127.0.0.1 / localhost: the local server is never exposed to the network. */
    HOST: z.enum(['127.0.0.1', 'localhost']).default('127.0.0.1'),
    SEED: z.enum(['quick-robot', 'none']).default('quick-robot'),
    WEB_DIST: z.string().min(1).optional(),
    LOG_DIR: z.string().min(1).optional(),
    /** Per-launch secret (Electron passes one); if set it must be strong. */
    APP_SECRET: z.string().min(32).optional(),
  })
  .strip();
export type LocalConfig = z.infer<typeof LocalConfig>;

export function parseLocalConfig(env: Record<string, string | undefined>): LocalConfig {
  const r = LocalConfig.safeParse(Object.fromEntries(Object.entries(env).filter(([, v]) => v !== '')));
  if (!r.success) {
    const problems = r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid configuration — ${problems}`);
  }
  return r.data;
}
