/** HTTP hardening options (docs/11). Chosen by the composition root (local: no HSTS; cloud: HSTS on). */
export interface SecurityOptions {
  /** Send Strict-Transport-Security (only where the app is served over HTTPS). */
  hsts: boolean;
  /** Extra origins allowed to write (besides the page's own origin). */
  allowedOrigins: readonly string[];
  /** Writes per minute per user. */
  writesPerMinute: number;
  /** Uploads per minute per user. */
  uploadsPerMinute: number;
}

export const defaultSecurity: SecurityOptions = { hsts: false, allowedOrigins: [], writesPerMinute: 300, uploadsPerMinute: 20 };
