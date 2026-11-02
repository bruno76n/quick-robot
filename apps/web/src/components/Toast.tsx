import { useEffect } from 'react';
import { create } from 'zustand';
import { cn } from '../lib/cn';

interface ToastState {
  message: string | null;
  action?: { label: string; run: () => void };
  seq: number;
  show: (message: string, action?: { label: string; run: () => void }) => void;
  hide: () => void;
}

/** Floating notice. Destructive actions pass an "Deshacer" action (phase 2+). */
export const useToast = create<ToastState>((set) => ({
  message: null,
  seq: 0,
  show: (message, action) => set((s) => ({ message, ...(action ? { action } : { action: undefined }), seq: s.seq + 1 })),
  hide: () => set({ message: null, action: undefined }),
}));

export function Toaster() {
  const { message, action, seq, hide } = useToast();
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(hide, action ? 6000 : 3200);
    return () => clearTimeout(t);
  }, [message, action, seq, hide]);
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed bottom-[max(22px,env(safe-area-inset-bottom,0px))] left-1/2 z-[90] flex max-w-[calc(100vw-32px)] items-center gap-3 rounded-[10px] bg-ink px-4 py-[10px] text-center font-semibold text-bg transition-[opacity,transform] duration-200',
        message ? '-translate-x-1/2 opacity-100' : 'pointer-events-none -translate-x-1/2 translate-y-4 opacity-0',
      )}
    >
      <span>{message}</span>
      {action && (
        <button type="button" className="cursor-pointer border-0 bg-transparent font-semibold text-[#c4b2f2] underline" onClick={() => (action.run(), hide())}>
          {action.label}
        </button>
      )}
    </div>
  );
}

/** Notice with "Deshacer" for destructive actions (soft delete → restore). */
export function showUndo(message: string, undoLabel: string, restore: () => Promise<unknown>, after?: () => void) {
  useToast.getState().show(message, { label: undoLabel, run: () => void restore().then(() => after?.()) });
}
