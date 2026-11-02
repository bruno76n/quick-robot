// Native <dialog> (like the mockup): focus stays inside, Esc closes (docs/07 › Accesibilidad).
import { useEffect, useRef, type FormEvent, type ReactNode } from 'react';
import { es } from '../i18n/es';
import { Button } from './Button';

export interface DialogProps {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  onSubmit?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  wide?: boolean;
  children: ReactNode;
}

export function Dialog({ open, title, onClose, onSubmit, submitLabel, cancelLabel, busy, wide, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
      const first = d.querySelector<HTMLElement>('input:not([type=hidden]):not([hidden]),select,textarea');
      first?.focus();
    }
    if (!open && d.open) { if (typeof d.close === 'function') d.close(); else d.removeAttribute('open'); }
  }, [open]);
  const submit = (e: FormEvent) => { e.preventDefault(); onSubmit?.(); };
  if (!open) return <dialog ref={ref} />;
  return (
    <dialog ref={ref} className={wide ? 'wide' : ''} onCancel={(e) => { e.preventDefault(); onClose(); }} aria-label={typeof title === 'string' ? title : undefined}>
      <form id="dlg-form" autoComplete="off" onSubmit={submit} noValidate>
        <h2 className="dlg-t">{title}</h2>
        <div className="dlg-b">{children}</div>
        <div className="dlg-f">
          <Button variant="ghost" onClick={onClose}>{cancelLabel ?? es.common.cancel}</Button>
          {onSubmit ? <Button type="submit" variant="primary" busy={busy ?? false} busyLabel={es.common.saving}>{submitLabel ?? es.common.save}</Button> : null}
        </div>
      </form>
    </dialog>
  );
}
