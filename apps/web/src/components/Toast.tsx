// One toast at a time (like the mockup). Deletions carry "Deshacer", which calls restore… (docs/13 §5).
import { useEffect } from 'react';
import { create } from 'zustand';
import { es } from '../i18n/es';

interface ToastState {
  text: string;
  undo: (() => void) | null;
  seq: number;
  show: (text: string, undo?: () => void) => void;
  hide: () => void;
}

export const useToast = create<ToastState>((set) => ({
  text: '',
  undo: null,
  seq: 0,
  show: (text, undo) => set((s) => ({ text, undo: undo ?? null, seq: s.seq + 1 })),
  hide: () => set({ text: '', undo: null }),
}));

export const toast = (text: string, undo?: () => void) => useToast.getState().show(text, undo);

export function ToastViewport() {
  const { text, undo, seq, hide } = useToast();
  useEffect(() => {
    if (!text) return;
    const id = setTimeout(hide, undo ? 7000 : 3200);
    return () => clearTimeout(id);
  }, [seq, text, undo, hide]);
  return (
    <div className={`toast${text ? ' on' : ''}`} role="status" aria-live="polite">
      {text}
      {undo ? <>{' '}<button type="button" className="toast-b" onClick={() => { hide(); undo(); }}>{es.common.undo}</button></> : null}
    </div>
  );
}
