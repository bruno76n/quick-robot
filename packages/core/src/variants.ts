// Variant families (mejoras/ronda-2.md §3.1, docs/05 product): one original + its variants, one level only.
// A variant shows as "<original> · <label>" outside grouped lists; old variants get their label from their name.
import { tidyName } from './catalog';

export const VARIANT_LABEL_MAX = 60;
export const VARIANT_LABEL_FALLBACK = 'Variante';
export const VARIANT_SEPARATOR = ' · ';

/** Name shown outside grouped lists: "Spider-Man · salto · silk morado"; an original (no label) keeps its name. */
export function variantDisplayName(name: string, originalName: string | null | undefined, label: string | null | undefined): string {
  const l = tidyName(label ?? '');
  const o = tidyName(originalName ?? '');
  return l && o ? `${o}${VARIANT_SEPARATOR}${l}` : tidyName(name);
}

/** Case and accent fold that keeps one character per character (so positions match the original text). */
function fold(s: string): string {
  let out = '';
  for (const ch of s) {
    const f = ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    out += f.length === 1 ? f : ch.toLowerCase().charAt(0) || ch;
  }
  return out;
}

const VARIANTE_WORD = /\s*\(\s*variante\s*\)/giu;
const LEADING_SEPARATORS = /^[\s·\-–—:/,]+/u;
const WRAPPED = /^\(([^()]*)\)$/u;
const WORD_CHAR = /^[\p{L}\p{N}]/u;

/**
 * Label of an old variant from its name (migration 0007, import of old backups and the dev seed use the same rule,
 * and the SQL of 0007 is tested against this function): drop "(variante)", drop the original's name at the start
 * (case and accents do not matter) with its separator, drop parentheses that wrap the rest, cut to 60 letters.
 * If the name does not start with the original's, the label is the whole name. Empty → "Variante".
 */
export function variantLabelFromName(name: string, originalName: string): string {
  let rest = tidyName(String(name ?? '').normalize('NFC').replace(VARIANTE_WORD, ''));
  const orig = tidyName(String(originalName ?? '').normalize('NFC').replace(VARIANTE_WORD, ''));
  if (orig && fold(rest).startsWith(fold(orig)) && !WORD_CHAR.test(rest.slice(orig.length))) rest = rest.slice(orig.length);
  rest = rest.replace(LEADING_SEPARATORS, '');
  rest = tidyName(rest.replace(WRAPPED, '$1'));
  rest = [...rest].slice(0, VARIANT_LABEL_MAX).join('').trim();
  return rest || VARIANT_LABEL_FALLBACK;
}

export interface FamilyMember { id: string; parentId: string | null; deleted?: boolean }

/**
 * Original of each piece, normalized to one level (old data may have chains, or variants whose original was
 * deleted): the highest live ancestor, walking up through deleted links too. A piece without a live ancestor is
 * an original (its parent is cleared). Returns id → parent id (null for originals).
 */
export function normalizeParents(pieces: readonly FamilyMember[]): Map<string, string | null> {
  const byId = new Map(pieces.map((p) => [p.id, p]));
  const out = new Map<string, string | null>();
  for (const p of pieces) {
    let root: string | null = null;
    const seen = new Set<string>([p.id]);
    let cycle = false;
    for (let cur = p.parentId ? byId.get(p.parentId) : undefined; cur; cur = cur.parentId ? byId.get(cur.parentId) : undefined) {
      if (seen.has(cur.id)) { cycle = cur.id === p.id; break; }
      seen.add(cur.id);
      if (!cur.deleted) root = cur.id;
    }
    // Corrupt data (a piece that is its own ancestor) never hangs and never stays a cycle: it becomes an original.
    out.set(p.id, cycle ? null : root);
  }
  return out;
}
