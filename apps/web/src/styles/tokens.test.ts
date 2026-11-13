// Neutral panel (ronda-2 §2, D36–D37): every interface color lives in tokens.css; no purple, no tinted shadows.
// Data colors (the real color of a filament) come from the data and are not checked here.
import { describe, expect, it } from 'vitest';

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

  it('declares the neutral accent and cost tokens', () => {
    const t = read(TOKENS);
    expect(t).toMatch(/--accent:\s*#121214/);
    expect(t).toMatch(/--cost:\s*#5a5a65/);
    expect(t).toMatch(/--cost-soft:\s*#f1f1f4/);
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
