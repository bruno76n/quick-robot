// The change against the previous period (Inicio and Reportes): "▲ 14.6%" in green or "▼ 3%" in red.
import { t } from '../../i18n/t';
import { pct } from '../../lib/format';

/** Green when it moves the good way (`good`: up is good), red otherwise; nothing without a previous value. */
export function Delta({ value, good = true }: { value: number | null; good?: boolean }) {
  if (value === null) return null;
  const up = value >= 0;
  return <span className={up === good ? 'up' : 'down'}>{t(up ? 'screens.home.up' : 'screens.home.down', { pct: pct(Math.abs(value)) })}</span>;
}
