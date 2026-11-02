// Side drawer: detail of a row of a wide list without leaving it; Esc or a click outside closes it (docs/06 §1).
import { useEffect, useRef, type ReactNode } from 'react';
import { es } from '../i18n/es';
import { Icon } from './Icon';

export function Drawer({ open, kind, onClose, children }: { open: boolean; kind: string; onClose: () => void; children: ReactNode }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('dialog[open]')) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <>
      <div className={`drw-sc${open ? ' on' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside className={`drw${open ? ' on' : ''}`} aria-label={es.common.detail} aria-hidden={!open} inert={!open}>
        <header className="drw-h">
          <span>{kind}</span>
          <button ref={closeRef} type="button" className="btn ghost icon drw-x" onClick={onClose} aria-label={es.common.closeDetail}><Icon name="x" /></button>
        </header>
        <div className="drw-b">{open ? children : null}</div>
      </aside>
    </>
  );
}
