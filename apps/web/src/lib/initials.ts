// Monogram of the business (ronda-2 §2): initials of the name set in Ajustes, never a brand from code.
const CONNECTORS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'en', '&']);

/** Up to two initials: first letter of the first two words (connectors like "de" skipped); one word gives its
 *  first two letters. Keeps accents ("Ángel Óptica" → "ÁÓ"); no letters or digits gives "". */
export function initialsOf(name: string): string {
  const words = name.normalize('NFC').split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}]/gu, '')).filter(Boolean);
  const main = words.filter((w) => !CONNECTORS.has(w.toLocaleLowerCase('es')));
  const use = main.length ? main : words;
  const out = use.length === 1 ? [...use[0]!].slice(0, 2).join('') : use.slice(0, 2).map((w) => [...w][0]).join('');
  return out.toLocaleUpperCase('es');
}
