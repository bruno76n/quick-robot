// Legacy variant names of informe-ronda2-a §4.3 that apply to labels. Shared by the core test and the SQL parity
// test of migration 0007 (packages/db/test/migration-variants.test.ts): both must give the same label.
export const VARIANT_NAME_CASES: readonly { case: string; name: string; original: string; label: string }[] = [
  { case: '4: only "(variante)" → Variante', name: 'Llavero Bambu (variante)', original: 'Llavero Bambu', label: 'Variante' },
  { case: '1: chain, "(variante)" twice', name: 'Llavero Bambu (variante) (variante)', original: 'Llavero Bambu', label: 'Variante' },
  { case: '5: own text in parentheses', name: 'Spider-Man · salto (silk morado)', original: 'Spider-Man · salto', label: 'silk morado' },
  { case: '5: own text after "(variante)"', name: 'Maceta geo (variante) negro mate', original: 'Maceta geo', label: 'negro mate' },
  { case: '5: separator after the original', name: 'Maceta geo – Negro mate', original: 'Maceta geo', label: 'Negro mate' },
  { case: '6: does not start with the original', name: 'Hombre araña azul (variante)', original: 'Spider-Man · salto', label: 'Hombre araña azul' },
  { case: '6: starts with a longer word', name: 'Macetas grandes', original: 'Maceta', label: 'Macetas grandes' },
  { case: '7: "·" inside the original is not split', name: 'Spider-Man · salto · rojo', original: 'Spider-Man · salto', label: 'rojo' },
  { case: '8: case and accents differ', name: 'CAFÉ  oscuro: Mate', original: 'Cafe Oscuro', label: 'Mate' },
  { case: '9: longer than 60 → cut to 60', name: `Llavero ${'x'.repeat(70)}`, original: 'Llavero', label: 'x'.repeat(60) },
  { case: '10: same name twice gives the same label', name: 'Llavero Bambu (variante)', original: 'Llavero Bambu', label: 'Variante' },
  { case: 'same name as the original → Variante', name: 'Llavero Bambu', original: 'Llavero Bambu', label: 'Variante' },
  { case: 'cut leaves no trailing space', name: `Llavero ${'a'.repeat(59)} b`, original: 'Llavero', label: 'a'.repeat(59) },
];
