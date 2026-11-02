import type { AuthProvider, Session } from '../../deps';

export const SECRET_HEADER = 'x-app-secret';

/**
 * Local mode: one user, one business, fixed ids. If a per-launch `secret` is given (Electron, phase 4),
 * every request must carry it in the `x-app-secret` header.
 */
export function createLocalAuth(o: { workspaceId: string; userId: string; secret?: string }): AuthProvider {
  const session: Session = { workspaceId: o.workspaceId, userId: o.userId, role: 'owner' };
  return {
    async resolve(req) {
      if (o.secret && req.headers.get(SECRET_HEADER) !== o.secret) return null;
      return session;
    },
  };
}
