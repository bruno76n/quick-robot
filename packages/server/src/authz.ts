// Deny by default (docs/11 A01). Every route declares its action with guard(action); can() decides.
// Local mode has a single owner; the full role split arrives with accounts in phase 5.
import type { Role } from './deps';

const OPERATOR_ACTIONS = new Set<string>([
  'workspace.read', 'filament.read', 'spool.create', 'spool.movement',
]);
const ADMIN_DENIED = new Set<string>(['workspace.clear', 'workspace.import']);

export function can(role: Role | string | undefined, action: string): boolean {
  if (role === 'owner') return true;
  if (role === 'admin') return !ADMIN_DENIED.has(action);
  if (role === 'operator') return OPERATOR_ACTIONS.has(action) || action.endsWith('.read');
  return false;
}
