// Neutral panel (ronda-2 §2, D36–D37): every interface color lives in tokens.css; no purple, no tinted shadows.
// Data colors (the real color of a filament) come from the data and are not checked here.
import { describe, expect, it } from 'vitest';
import segmented from './segmented.snapshot.json';

// Sources read as text by Vite (the web package does not import node:fs; docs/03).
const raw = (m: Record<string, unknown>) => Object.entries(m as Record<string, string>).filter(([p]) => !/\.test\.tsx?$/.test(p));
const sources = new Map<string, string>(raw({
  ...import.meta.glob('/src/**/*.css', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob('/src/**/*.tsx', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob('/src/fatal/*.ts', { query: '?raw', import: 'default', eager: true }),
}));
const css = [...sources.keys()].filter((p) => p.endsWith('.css'));
const read = (p: string) => sources.get(p) ?? '';
const rel = (p: string) => p.replace(/^\/src\//, '');
const TOKENS = '/src/styles/tokens.css';

// The old purple of the brand and its layers, the lavender of the timeline and the violet-tinted shadows.
const FORBIDDEN = [/--purple/i, /#6b3fd4/i, /#efe9fd/i, /#4c28a8/i, /#9b7de6/i, /#c4b2f2/i, /#e0d7f8/i, /#b9a8ee/i,
  /rgba\(\s*107\s*,\s*63\s*,\s*212/, /rgba\(\s*32\s*,\s*26\s*,\s*54/, /rgba\(\s*20\s*,\s*12\s*,\s*40/, /rgba\(\s*25\s*,\s*12\s*,\s*60/];

describe('design tokens', () => {
  it('no purple value or tinted shadow in styles, the fatal page or any component', () => {
    expect(css).toContain(TOKENS);
    expect([...sources.keys()].some((p) => p.endsWith('AppShell.tsx'))).toBe(true);
    const hits = [...sources.keys()].flatMap((p) => {
      const text = read(p);
      return FORBIDDEN.filter((re) => re.test(text)).map((re) => `${rel(p)}: ${re.source}`);
    });
    expect(hits).toEqual([]);
  });

  it('only tokens.css declares :root', () => {
    expect(css.filter((p) => p !== TOKENS && /:root\b/.test(read(p))).map(rel)).toEqual([]);
  });

  it('no hex color in a stylesheet outside tokens.css; shadows and overlays only in neutral ink or white', () => {
    const bad = css.filter((p) => p !== TOKENS).flatMap((p) => {
      const text = read(p).replace(/\/\*[\s\S]*?\*\//g, '');
      const hex = [...text.matchAll(/#[0-9a-f]{3,8}\b/gi)].map((m) => m[0]);
      const rgba = [...text.matchAll(/rgba?\(([^)]*)\)/gi)].map((m) => m[1]!.replace(/\s/g, '')).filter((v) => !/^(18,18,20|255,255,255),/.test(v));
      return [...hex, ...rgba].map((v) => `${rel(p)}: ${v}`);
    });
    expect(bad).toEqual([]);
  });

  it('declares the ronda-3 token values (ronda-3 §2, informe-ronda3-a §1.3)', () => {
    const t = read(TOKENS);
    const want: Record<string, string> = {
      '--accent': '#121214', '--ink': '#121214', '--ink-2': '#6a6a73', '--ink-3': '#9b9ba5', '--ink-3t': '#777782',
      '--soft': '#f6f6f8', '--soft-2': '#e9e9ef', '--soft-3': '#dedee5', '--col': '#ececf0', '--track': '#ebebf0',
      '--line': '#e9e9ee', '--line-soft': '#f0f0f3', '--cost': '#4a4a53',
      '--green': '#00ae42', '--green-d': '#00873a', '--green-ink': '#067a30', '--green-l': '#e3f5e9',
      '--amber': '#b4740a', '--amber-d': '#8a5a06', '--amber-l': '#fdf3e1', '--red': '#c8302a', '--red-l': '#fbeaea',
      '--r-btn': '7px', '--r-field': '8px', '--r-panel': '12px', '--r-pill': '6px', '--r-in': '10px',
    };
    const got = Object.fromEntries([...t.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]));
    expect(Object.fromEntries(Object.keys(want).map((k) => [k, got[k]]))).toEqual(want);
  });

  it('every var(--x) used is declared, and no removed token is used', () => {
    const all = [...sources.entries()];
    // Declared: tokens, local custom properties set in a stylesheet, and style keys set from components ('--c': …).
    const declared = new Set(all.flatMap(([, text]) => [...text.matchAll(/(--[\w-]+)\s*:/g), ...text.matchAll(/['"](--[\w-]+)['"]\s*(?:as string\]\s*)?:/g)].map((m) => m[1]!)));
    const tokens = new Set([...read(TOKENS).matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]!));
    const used = all.flatMap(([p, text]) => [...text.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => [p, m[1]!] as const));
    expect(used.filter(([, v]) => !declared.has(v)).map(([p, v]) => `${rel(p)}: ${v}`)).toEqual([]);
    // A token named as a value from a component ([label, cents, '--cost']) must be a real token.
    const named = all.filter(([p]) => p.endsWith('.tsx')).flatMap(([p, text]) => [...text.matchAll(/['"](--[\w-]+)['"](?!\s*(?:as string\]\s*)?:)/g)].map((m) => [p, m[1]!] as const));
    expect(named.filter(([, v]) => !tokens.has(v)).map(([p, v]) => `${rel(p)}: ${v}`)).toEqual([]);
    const REMOVED = ['--r', '--sh-soft', '--panel', '--panel-2', '--green-soft', '--amber-ink', '--amber-soft', '--red-ink', '--red-soft', '--blue', '--cost-soft', '--sh', '--c-legend', '--c-m', '--c-l', '--c-q', '--c-t', '--c-e', '--c-f', '--sand'];
    const hits = all.flatMap(([p, text]) => REMOVED.filter((r) => new RegExp(`${r}(?![\\w-])`).test(text)).map((r) => `${rel(p)}: ${r}`));
    expect(hits).toEqual([]);
  });

  it('no hex color in a component: data fallbacks use var(--no-color)', () => {
    const bad = [...sources.keys()].filter((p) => p.endsWith('.tsx')).flatMap((p) => [...read(p).matchAll(/['"`]#[0-9a-f]{3,8}\b/gi)].map((m) => `${rel(p)}: ${m[0]}`));
    expect(bad).toEqual([]);
  });

  // Rules of every stylesheet, as [selector, body]; the segmented switches are guarded byte by byte elsewhere (exception 1).
  const rulesOf = (p: string) => [...read(p).replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1]!.trim(), m[2]!] as const);
  const SEG = /\.(seg|seg2|rad)\b/;
  const notSeg = css.filter((p) => p !== TOKENS).flatMap((p) => rulesOf(p).filter(([sel]) => !SEG.test(sel)).map(([sel, body]) => [p, sel, body] as const));

  it('border-radius only from a --r-* token, 0, a percentage or 99px', () => {
    const ok = (term: string) => /^(0|\d+%|99px|var\(--r-[a-z]+\)|\/)$/.test(term);
    const bad = notSeg.flatMap(([p, sel, body]) => [...body.matchAll(/border(?:-[a-z]+-[a-z]+)?-radius:\s*([^;]+)/g)]
      .filter((m) => !(m[1]!.trim().match(/var\([^)]*\)|[^\s]+/g) ?? []).every(ok)).map((m) => `${rel(p)} ${sel}: ${m[1]!.trim()}`));
    expect(bad).toEqual([]);
  });

  it('box-shadow: panels have none; only floating things take var(--sh-up), plus rings and inner lines', () => {
    // A layer is fine when it is none, the floating token, an inner line (inset) or a ring with no offset and no blur.
    const layer = (l: string) => /^(none|var\(--sh-up\)|inset\s.+|0 0 0 [\d.]+px\s.+)$/.test(l.trim());
    const bad = notSeg.flatMap(([p, sel, body]) => [...body.matchAll(/box-shadow:\s*([^;]+)/g)]
      .filter((m) => !m[1]!.split(/,(?![^(]*\))/).every(layer)).map((m) => `${rel(p)} ${sel}: ${m[1]!.trim()}`));
    expect(bad).toEqual([]);
    expect(read(TOKENS)).toMatch(/--sh-up:/);
  });

  it('the segmented switches (.seg, .seg2, .seg4, .rad) keep their rules byte for byte (exception 1 of the person, 2026-11-14)', () => {
    // Snapshot taken at the start of ronda 3 · B4. A rule may move between files, never change.
    const now = css.flatMap((p) => [...read(p).replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter((m) => /\.(seg|seg2|seg4|rad)\b/.test(m[1]!)).map((m) => `${m[1]!.trim()} {${m[2]!}}`)).sort();
    expect(now).toEqual(segmented);
    expect(read('/src/components/Segmented.tsx')).toContain('className="seg"');
  });

  it('the focus ring and the accent of checkboxes and radios use --accent, in the app and on the fatal page', () => {
    const rules = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '');
    const app = css.filter((p) => p !== TOKENS).map(rules).join('\n');
    expect(app).toMatch(/(^|\n|\})\s*:focus-visible\s*\{\s*outline:\s*2px solid var\(--accent\)/);
    expect(rules('/src/fatal/fatal.css')).toMatch(/:focus-visible\s*\{\s*outline:\s*2px solid var\(--accent\)/);
    expect(app).toMatch(/input\[type="checkbox"\], input\[type="radio"\]\s*\{\s*accent-color:\s*var\(--accent\)/);
    // Every focus ring (2px outline on :focus*) and every accent-color takes the accent.
    const focus = [...app.matchAll(/[^{}]*:focus[^{]*\{([^}]*)\}/g)].map((m) => m[1]!).filter((b) => /outline:\s*2px/.test(b));
    expect(focus.length).toBeGreaterThan(2);
    expect(focus.filter((b) => !/var\(--accent\)/.test(b))).toEqual([]);
    expect([...app.matchAll(/accent-color:\s*([^;}]+)/g)].map((m) => m[1]!.trim()).filter((v) => v !== 'var(--accent)')).toEqual([]);
  });
});
