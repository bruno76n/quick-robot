import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { AuthProvider, Session } from '../../deps';

export const SECRET_HEADER = 'x-app-secret';

/**
 * Local mode: one user, one business, fixed ids. If a per-launch `secret` is given (Electron, phase 4),
 * every request must carry it in the `x-app-secret` header.
 */
export function createLocalAuth(o: { workspaceId: string; userId: string; secret?: string }): AuthProvider {
  const session: Session = { workspaceId: o.workspaceId, userId: o.userId, role: 'owner' };
  const expected = o.secret ? digest(o.secret) : null;
  return {
    async resolve(req) {
      if (expected && !timingSafeEqual(digest(req.headers.get(SECRET_HEADER) ?? ''), expected)) return null;
      return session;
    },
  };
}

/** Fixed-length digests so the comparison takes the same time whatever the input (docs/11 · A07). */
const digest = (s: string) => createHash('sha256').update(s).digest();

/** A per-launch secret: 256 random bits (docs/11 · A04). */
export const newLaunchSecret = (): string => randomBytes(32).toString('base64url');
