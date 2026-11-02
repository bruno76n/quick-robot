// NEGATIVE FIXTURE — security: sql.raw in packages/db. Must be rejected.
declare const sql: { raw(s: string): unknown };
export const broken = (name: string) => sql.raw(`name = '${name}'`);
