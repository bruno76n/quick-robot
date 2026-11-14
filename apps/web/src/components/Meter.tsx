/** Clamp a value to a 0–100 percentage of max (NaN and a max of 0 give 0). */
export const pctOf = (value: number, max = 100) => (max > 0 && Number.isFinite(value) ? Math.min(100, Math.max(0, (value / max) * 100)) : 0);

/**
 * Progress or level bar (ronda-3 §3, mockup .ui-meter): 6 px, track --track, value --cost; amber or red only
 * when the state is (tone 'warn' / 'bad'); 'ok' green only for profit or a correct state.
 * - value, max: the fill is value ÷ max, kept between 0 and 100 %.
 * - label: accessible name (role="meter"); without it the bar is decorative (aria-hidden) and the number must be
 *   written next to it.
 */
export function Meter({ value, max = 100, tone = '', label, className = '' }: { value: number; max?: number; tone?: '' | 'ok' | 'warn' | 'bad'; label?: string; className?: string }) {
  const p = pctOf(value, max);
  const a11y = label ? { role: 'meter', 'aria-label': label, 'aria-valuenow': Math.round(p), 'aria-valuemin': 0, 'aria-valuemax': 100 } : { 'aria-hidden': true };
  return <span className={['meter', tone, className].filter(Boolean).join(' ')} {...a11y}><i style={{ width: `${p}%` }} /></span>;
}
