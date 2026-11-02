// Authorization (docs/11 · A01): every route declares the action it performs and `can(ctx, action)` decides.
// Deny by default: an unknown role or action is refused. Roles beyond "owner" are refined in phase 5.
import type { Session } from './deps';

export const ACTIONS = [
  'workspace.read',
  'catalog.read',
  'filaments.read',
  'filaments.write',
  'filaments.delete',
  'settings.read',
  'settings.write',
  'suppliers.read',
  'suppliers.write',
  'suppliers.delete',
  'supplies.read',
  'supplies.write',
  'supplies.delete',
  'printers.read',
  'printers.write',
  'printers.delete',
  'products.read',
  'products.write',
  'products.delete',
  'files.read',
  'files.write',
] as const;
export type Action = (typeof ACTIONS)[number];

const ALL = new Set<Action>(ACTIONS);
/** The operator works the workshop (records movements, uses supplies) but does not change prices, settings or delete. */
const OPERATOR = new Set<Action>([
  'workspace.read',
  'catalog.read',
  'filaments.read',
  'filaments.write',
  'settings.read',
  'suppliers.read',
  'supplies.read',
  'supplies.write',
  'printers.read',
  'products.read',
  'files.read',
]);

const PERMISSIONS: Record<Session['role'], ReadonlySet<Action>> = { owner: ALL, admin: ALL, operator: OPERATOR };

export function can(session: Pick<Session, 'role'>, action: Action): boolean {
  return Object.hasOwn(PERMISSIONS, session.role) ? PERMISSIONS[session.role].has(action) : false;
}
