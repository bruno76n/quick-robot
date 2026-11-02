import type { Context } from 'hono';

/** JSON body or {} (validation happens in the use case with the contract schema). */
export const body = (c: Context): Promise<unknown> => c.req.json().catch(() => ({}));
