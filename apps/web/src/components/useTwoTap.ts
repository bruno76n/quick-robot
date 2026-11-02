import { useEffect, useRef, useState } from 'react';

/**
 * Destructive buttons ask for a second tap (mockup `dosToques`): the first tap arms it and changes the
 * label; a second tap within 3 s runs the action.
 */
export function useTwoTap(): { armed: boolean; tap: (run: () => void) => void } {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return {
    armed,
    tap(run) {
      if (armed) {
        clearTimeout(timer.current);
        setArmed(false);
        run();
        return;
      }
      setArmed(true);
      timer.current = setTimeout(() => setArmed(false), 3000);
    },
  };
}
