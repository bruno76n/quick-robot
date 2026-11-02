// NEGATIVE FIXTURE — security: SQL built from a string in packages/db. Must be rejected.
export function broken(db: { execute(q: unknown): unknown }, name: string) {
  return db.execute("select * from product where name = '" + name + "'");
}
