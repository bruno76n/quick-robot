// Local session (docs/02 §5): one user, one workspace, fixed ids. When a launch secret is configured,
// every request must carry `Authorization: Bearer <secret>`; Electron (or the Vite proxy) adds it.
import { timingSafeEqual } from 'node:crypto';
import type { AuthProvider, Session } from '../../deps';

export const LOCAL_WORKSPACE_ID = '00000000-0000-7000-8000-000000000001';
export const LOCAL_USER_ID = '00000000-0000-7000-8000-000000000002';

export function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function localAuth(opts: { secret?: string; workspaceId?: string; userId?: string } = {}): AuthProvider {
  const session: Session = { workspaceId: opts.workspaceId ?? LOCAL_WORKSPACE_ID, userId: opts.userId ?? LOCAL_USER_ID, role: 'owner' };
  return {
    async resolve(req) {
      if (!opts.secret) return session;
      const header = req.headers.get('authorization') ?? '';
      const given = header.startsWith('Bearer ') ? header.slice(7) : '';
      return given && sameSecret(given, opts.secret) ? session : null;
    },
  };
}
