// Two-tap confirmation (docs/13 §7): the button changes its text and must be tapped again.
// Tapping elsewhere or closing the dialog brings the original text back.
import { useEffect, useRef, useState } from 'react';
import { Button, type ButtonProps } from './Button';

export function ConfirmButton({ confirmText, onConfirm, children, ...rest }: ButtonProps & { confirmText: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!armed) return;
    const off = (e: Event) => { if (!ref.current?.contains(e.target as Node)) setArmed(false); };
    document.addEventListener('pointerdown', off);
    return () => document.removeEventListener('pointerdown', off);
  }, [armed]);
  return (
    <span ref={ref} className="cfm">
      <Button {...rest} onClick={() => { if (armed) { setArmed(false); onConfirm(); } else setArmed(true); }}>{armed ? confirmText : children}</Button>
    </span>
  );
}
