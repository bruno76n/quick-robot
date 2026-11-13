// Icons redrawn from the mockup (one set for the whole app, docs/07).
import type { ReactElement } from 'react';

export const ICONS: Record<string, ReactElement> = {
  home: <><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9.5h13V10" /></>,
  box: <><path d="M21 8 12 3 3 8v8l9 5 9-5z" /><path d="M3 8l9 5 9-5M12 13v8" /></>,
  cart: <><path d="M3 4h2.5l2 11h10.5l2-8H6.5" /><circle cx="9" cy="19" r="1.3" /><circle cx="17" cy="19" r="1.3" /></>,
  coin: <><circle cx="12" cy="12" r="9" /><path d="M12 6.5v11M9.2 9.3c0-1.1 1.2-1.7 2.8-1.7s2.8.7 2.8 1.9-1.2 1.6-2.8 2-2.8.8-2.8 2 1.2 1.9 2.8 1.9 2.8-.7 2.8-1.7" /></>,
  list: <><rect x="5.5" y="4" width="13" height="17" rx="2" /><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3" /></>,
  spool: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" /><path d="M12 3c-2 3-2 6 0 9M12 21c2-3 2-6 0-9" /></>,
  printer: <><rect x="3.5" y="3.5" width="17" height="17" rx="2" /><path d="M3.5 8.5h17M8.5 8.5v5" /><path d="M7 17.5h10" /></>,
  store: <><rect x="3.5" y="4" width="17" height="7" rx="1.8" /><rect x="3.5" y="13" width="17" height="7" rx="1.8" /><path d="M8.5 7.5h7M8.5 16.5h7" /></>,
  layers: <><path d="M12 3 21 8l-9 5-9-5z" /><path d="M3 12.5l9 5 9-5M3 16.5l9 5 9-5" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 3-6 6.5-6s6.5 2.4 6.5 6" /><path d="M16 4.7a3.5 3.5 0 0 1 0 6.6M18.5 14.4c1.9.7 3 2.6 3 5.6" /></>,
  chart: <><path d="M4 20V11M10 20V4M16 20v-7M22 20H2" /></>,
  wallet: <><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M3 10h18" /><circle cx="16.5" cy="14.5" r="1" /></>,
  nut: <><path d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z" /><circle cx="12" cy="12" r="3" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  x: <><path d="M6 6l12 12M18 6 6 18" /></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h8" /></>,
  arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  warn: <><path d="M12 4 2.5 20h19z" /><path d="M12 10v4.5M12 17.5v.1" /></>,
  check: <><path d="M5 12.5 10 17.5 19 7" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  back: <><path d="M19 12H5M11 6l-6 6 6 6" /></>,
  trash: <><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" /></>,
  edit: <><path d="M4 20h4L19 9l-4-4L4 16z" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
  percent: <><path d="M5 19 19 5" /><circle cx="7" cy="7" r="2" /><circle cx="17" cy="17" r="2" /></>,
  backup: <><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" /><path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" /></>,
};

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg className="ic" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name] ?? null}
    </svg>
  );
}
