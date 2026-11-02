// Startup configuration validated with Zod: if something is missing or unsafe, it does not start (docs/11 A02).
import { z } from 'zod';

export const localConfigSchema = z.object({
  host: z.enum(['127.0.0.1', 'localhost']).default('127.0.0.1'),
  port: z.coerce.number().int().min(0).max(65535).default(8787),
  dataDir: z.string().min(1).optional(),
  /** Per-launch secret; at least 256 bits in hex/base64url. */
  secret: z.string().regex(/^[A-Za-z0-9_-]{43,}$/, 'secret must be at least 256 bits').optional(),
  webRoot: z.string().optional(),
  timeZone: z.string().default('America/Mexico_City'),
  allowedOrigins: z.array(z.url()).default([]),
});

export type LocalConfig = z.infer<typeof localConfigSchema>;

export function loadLocalConfig(raw: unknown): LocalConfig {
  const r = localConfigSchema.safeParse(raw);
  if (!r.success) throw new Error(`Invalid configuration: ${r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  return r.data;
}
