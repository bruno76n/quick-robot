// Opens the mockup with a fresh state and exposes its internal calculation functions as window.__mockup.
// The file in reference/ is NOT modified: a patched copy is served in memory through page.route.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const HOOK = `
window.__mockup = { get S() { return S; }, costo, precioDe, costoCol, precioCol, sueltas, sugerido, piso, margenDe, costoGF,
  restante, impDe, mantEstado, inversion, stockIns, insEstado, gastosEntre };
})();`;

export async function openMockup({ width = 1440, height = 900, hash = 'inicio' } = {}) {
  const html = readFileSync(resolve('reference/Quick Robot mockup.html'), 'utf8');
  const marker = '\n})();\n</script>';
  if (!html.includes(marker)) throw new Error('mockup layout changed: hook marker not found');
  const patched = html.replace(marker, '\n' + HOOK + '\n</script>');
  const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } : undefined;
  const browser = await chromium.launch(proxy ? { proxy } : {});
  const page = await browser.newPage({ viewport: { width, height }, ignoreHTTPSErrors: true });
  await page.route('http://mockup.local/**', (route) => route.fulfill({ contentType: 'text/html; charset=utf-8', body: patched }));
  await page.goto(`http://mockup.local/index.html#${hash}`);
  await page.waitForFunction(() => !!window.__mockup);
  return { browser, page };
}
