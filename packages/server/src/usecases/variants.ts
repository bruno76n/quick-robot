// Old variants (backups without variant_label, the mockup's "padre", the dev seed) are normalized like migration 0007:
// one level to the highest live original, orphans become originals, labels come from names (core › variantLabelFromName).
import { normalizeParents, tidyName, VARIANT_LABEL_MAX, variantLabelFromName } from '@app/core';

export interface LegacyPiece { id: string; name: string; parentId: string | null; deleted?: boolean; label?: string | null }

/** id → { parentId, variantLabel } with the rules of migration 0007. A valid label already present is kept. */
export function normalizeVariants(pieces: readonly LegacyPiece[]): Map<string, { parentId: string | null; variantLabel: string | null }> {
  const parents = normalizeParents(pieces.map((p) => ({ id: p.id, parentId: p.parentId, deleted: p.deleted ?? false })));
  const names = new Map(pieces.map((p) => [p.id, p.name]));
  const out = new Map<string, { parentId: string | null; variantLabel: string | null }>();
  for (const p of pieces) {
    const parentId = parents.get(p.id) ?? null;
    const own = tidyName(p.label ?? '');
    const variantLabel = parentId ? (own ? [...own].slice(0, VARIANT_LABEL_MAX).join('').trim() : variantLabelFromName(p.name, names.get(parentId) ?? '')) : null;
    out.set(p.id, { parentId, variantLabel });
  }
  return out;
}
