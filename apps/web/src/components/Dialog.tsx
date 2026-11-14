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
  /** Extra class of the <dialog>: `sheet` makes it a sheet from the bottom on a phone (ronda-4 §5, spools.css). */
  className?: string;
  children: ReactNode;
}

const SKIP = ['hidden', 'radio', 'checkbox', 'date', 'file', 'color'];
const visible = (el: HTMLElement) => (typeof el.checkVisibility === 'function' ? el.checkVisibility() : !el.closest('[hidden]'));

/** Initial focus (ronda-2 §12, T1): the field marked `data-autofocus` (or `autofocus`); else the first visible field
 *  that is not a radio, checkbox, date, file or color (those already carry a value the person rarely changes first). */
export function initialFocus(d: HTMLElement): HTMLElement | undefined {
  const marked = [...d.querySelectorAll<HTMLElement>('[data-autofocus], [autofocus]')].find(visible);
  if (marked) return marked;
  return [...d.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea')]
    .find((el) => !el.disabled && !(el instanceof HTMLInputElement && SKIP.includes(el.type)) && !el.hidden && visible(el));
}

export function Dialog({ open, title, onClose, onSubmit, submitLabel, cancelLabel, busy, wide, className, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
      initialFocus(d)?.focus();
    }
    if (!open && d.open) { if (typeof d.close === 'function') d.close(); else d.removeAttribute('open'); }
  }, [open]);
  const submit = (e: FormEvent) => { e.preventDefault(); onSubmit?.(); };
  if (!open) return <dialog ref={ref} />;
  return (
    <dialog ref={ref} className={[wide ? 'wide' : '', className ?? ''].filter(Boolean).join(' ')} onCancel={(e) => { e.preventDefault(); onClose(); }} aria-label={typeof title === 'string' ? title : undefined}>
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
