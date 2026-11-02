/** Request context. Every repository receives it; there is no query without a workspace. */
export interface Ctx {
  readonly workspaceId: string;
  readonly userId: string;
}

/** Runtime guard so a missing workspace can never turn into an unfiltered query. */
export function assertCtx(ctx: Ctx): string {
  if (!ctx || typeof ctx.workspaceId !== 'string' || ctx.workspaceId.length === 0) {
    throw new Error('Repository called without ctx.workspaceId');
  }
  return ctx.workspaceId;
}
