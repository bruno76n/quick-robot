// Every repository receives ctx; there is no query without it (CLAUDE.md rule 2).
export interface Ctx {
  readonly workspaceId: string;
  readonly userId: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Fails before any SQL runs if the context is missing or malformed. */
export function assertCtx(ctx: Ctx | null | undefined): asserts ctx is Ctx {
  if (!ctx || typeof ctx.workspaceId !== 'string' || !UUID.test(ctx.workspaceId)) {
    throw new Error('Repository called without a valid ctx.workspaceId');
  }
}
