import type { Clock } from '../../deps';

/** Today's date in the machine's local time zone. */
export const systemClock: Clock = {
  today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },
};
