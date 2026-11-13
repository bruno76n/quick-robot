// The accessible picker of the calculator and the collection rows (components/Picker.tsx, ronda-2 §12 · D1).
import { expect, type Locator, type Page } from '@playwright/test';

const exact = (label: string) => new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);

/** The option of the open list named exactly `label` (the option may also show a hint, like the grams). */
export const option = (page: Page, label: string): Locator => page.getByRole('listbox').getByRole('option').filter({ has: page.locator('.pkr-l', { hasText: exact(label) }) });

/** Opens a picker (the button of a row) and chooses an option with the mouse: two clicks, like a native select. */
export async function pick(page: Page, picker: Locator, label: string) {
  await picker.click();
  await option(page, label).click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
}

/** Chooses in the list that a just-created row opened by itself (one click), checking it opened with the focus inside. */
export async function pickOpen(page: Page, label: string) {
  await expect(page.getByRole('listbox')).toBeVisible();
  await expect(page.locator('.pkr-q')).toBeFocused();
  await option(page, label).click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
}
