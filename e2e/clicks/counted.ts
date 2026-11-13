// Click measurement (mejoras/ronda-2.md §11.1, D42). `countedPage` wraps a Playwright page and counts what a person
// would do with the mouse while the test walks a flow by the normal path:
// - a click or tap on anything (button, row, card, link, checkbox, radio, label) = 1 click;
// - choosing in a native <select> = 2 clicks: opening it (1) and choosing the option (1). Playwright's
//   `selectOption` does not move the mouse, so the page reports the `change` of the select instead;
// - typing does not count, but a text field that is not focused when the person starts typing had to be clicked
//   to focus it: that is 1 in `fieldsClicked`, not in `clicks`. `fill` here does that click only when needed, so a
//   field that already has the focus (first field of a dialog, a field the screen focused) costs nothing.
// The page reports every trusted pointer press through a binding, so the count survives client navigations and
// counts clicks that the test makes with the plain Playwright API too.
import { expect, type Locator, type Page } from '@playwright/test';

export interface ClickCount { today: number; fieldsClicked: number }

export interface CountedPage {
  page: Page;
  /** Goes to the screen where the flow starts and resets the count (getting there is not part of the flow). */
  start(path: string): Promise<void>;
  /** Types into a field; clicks it first only when it does not already have the focus. */
  fill(field: Locator, value: string): Promise<void>;
  /** What the flow cost so far, and the steps it took (for the message of a failed budget). */
  count(): Promise<ClickCount & { steps: string[] }>;
  /** Asserts the flow cost exactly its budget (mejoras/ronda-2.md §12: phase D lowers the budget, a regression breaks it). */
  expectBudget(budget: ClickCount): Promise<void>;
}

/** Runs in the page: reports trusted pointer presses (fields apart) and select changes. */
function reporter() {
  const w = window as unknown as { __qrClick?: (kind: string, what: string) => void; __qrReady?: boolean };
  if (w.__qrReady) return;
  w.__qrReady = true;
  const NOT_TEXT = ['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'color', 'range', 'image'];
  const describe = (el: Element) => {
    const label = el.getAttribute('aria-label') || el.getAttribute('name') || el.getAttribute('data-testid') || (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
    return `${el.tagName.toLowerCase()} ${label}`.trim();
  };
  document.addEventListener('pointerdown', (e) => {
    if (!e.isTrusted || !(e.target instanceof Element)) return;
    const field = e.target.closest('input, textarea, select');
    if (field instanceof HTMLSelectElement) return; // counted on change
    if (field instanceof HTMLTextAreaElement || (field instanceof HTMLInputElement && !NOT_TEXT.includes(field.type))) { w.__qrClick?.('field', describe(field)); return; }
    const target = e.target.closest('button, a, label, [role=button], [tabindex], input') ?? e.target;
    w.__qrClick?.('click', describe(target));
  }, true);
  document.addEventListener('change', (e) => {
    if (e.target instanceof HTMLSelectElement) w.__qrClick?.('select', `select ${e.target.getAttribute('aria-label') || e.target.name || e.target.dataset.b || ''} → ${e.target.selectedOptions[0]?.textContent ?? ''}`);
  }, true);
}

export async function countedPage(page: Page): Promise<CountedPage> {
  let clicks = 0;
  let fields = 0;
  let steps: string[] = [];
  await page.exposeBinding('__qrClick', (_src, kind: string, what: string) => {
    if (kind === 'field') { fields += 1; steps.push(`(field) ${what}`); return; }
    clicks += kind === 'select' ? 2 : 1;
    steps.push(`${kind === 'select' ? '+2 select' : '+1'} ${what}`);
  });
  await page.addInitScript(reporter);
  const settle = async () => { await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null)))); };
  const api: CountedPage = {
    page,
    async start(path) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await settle();
      clicks = 0; fields = 0; steps = [];
    },
    async fill(field, value) {
      const focused = await field.evaluate((el) => el === document.activeElement);
      if (!focused) await field.click();
      await field.fill(value);
    },
    async count() {
      await settle();
      return { today: clicks, fieldsClicked: fields, steps: [...steps] };
    },
    async expectBudget(budget) {
      const got = await api.count();
      expect({ today: got.today, fieldsClicked: got.fieldsClicked }, `steps:\n${got.steps.join('\n')}`).toEqual(budget);
    },
  };
  return api;
}
