// One helper for writes: run the operation, invalidate what it touched, show the toast or the error text.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '../components/Toast';
import { es } from '../i18n/es';
import { ApiError } from './api';
import { errorText } from './errors';
import { invalidate, type keys } from './queries';

export function useWrite<I, O>(fn: (input: I) => Promise<{ data: O }>, opts: { touches: (keyof typeof keys)[]; ok?: (out: O, input: I) => string | null; undo?: (out: O, input: I) => (() => Promise<unknown>) | undefined; onDone?: (out: O, input: I) => void; onError?: (e: unknown) => boolean | void }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: I) => (await fn(input)).data,
    onSuccess: async (out, input) => {
      await invalidate(qc, ...opts.touches);
      const text = opts.ok?.(out, input);
      const restore = opts.undo?.(out, input);
      // "Deshacer" restores, reloads what the write touched and confirms (docs/13 §5).
      const undo = restore ? () => { void restore().then(async () => { await invalidate(qc, ...opts.touches); toast(es.toast['undo.done']); }, (e: unknown) => toast(errorText(e).text)); } : undefined;
      if (text) toast(text, undo);
      opts.onDone?.(out, input);
    },
    onError: (e) => {
      // The state changed while the person was looking: reload what the screen shows (docs/15 §5).
      if (e instanceof ApiError && e.code === 'ORDER_INVALID_STATE') void invalidate(qc, ...opts.touches);
      if (opts.onError?.(e) === true) return;
      toast(errorText(e).text);
    },
  });
}
