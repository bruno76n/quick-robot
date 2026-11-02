import type { ReactNode } from 'react';

/** Fixed banner: "the app does not respond" (desktop) or "offline" (cloud) (docs/15 §5). */
export function Banner({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return <div className="banner" role="alert">{children}{action}</div>;
}
