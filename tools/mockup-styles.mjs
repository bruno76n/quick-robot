// Dumps computed styles of selectors in the mockup (design reference for building screens).
// Usage: node tools/mockup-styles.mjs <hash> '<js to run before>' sel1 sel2 ...
import { openMockup } from './mockup-page.mjs';

const [hash, pre, ...sels] = process.argv.slice(2);
const { browser, page } = await openMockup({ hash });
await page.waitForTimeout(500);
if (pre && pre !== '-') {
  await page.evaluate(pre);
  await page.waitForTimeout(500);
}
const props = ['font-size', 'font-weight', 'line-height', 'letter-spacing', 'color', 'background-color', 'background-image', 'border', 'border-top', 'border-bottom', 'border-left', 'border-radius', 'padding', 'margin', 'width', 'height', 'min-height', 'box-shadow', 'gap', 'display', 'grid-template-columns', 'position', 'top'];
for (const s of sels) {
  const r = await page.evaluate(
    ([s, props]) => {
      const el = document.querySelector(s);
      if (!el) return null;
      const cs = getComputedStyle(el);
      const o = {};
      for (const p of props) {
        const v = cs.getPropertyValue(p);
        if (!v || v === 'normal' || v === 'none' || v === '0px' || v === 'auto' || /0px none/.test(v) || v === 'rgba(0, 0, 0, 0)' || v === 'static' || (p === 'display' && v === 'block')) continue;
        o[p] = v;
      }
      return o;
    },
    [s, props],
  );
  console.log(s, '→', r ? Object.entries(r).map(([k, v]) => `${k}:${v}`).join('; ') : 'NOT FOUND');
}
await browser.close();
