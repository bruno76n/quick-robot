// A write that also needs the warnings of the answer (FILAMENT_SHORTFALL, FILAMENT_NOT_RETURNED): run, invalidate, toast.
import type { Warning } from '@app/contract';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '../../components/Toast';
import { has, t } from '../../i18n/t';
import type { Result } from '../../lib/api';
import { errorText } from '../../lib/errors';
import { invalidate, type keys } from '../../lib/queries';

/** Spanish text of each warning (docs/13 › warnings); a warning with items gives one sentence per item. */
export function warningTexts(ws: readonly Warning[]): string[] {
  return ws.flatMap((w) => {
    const d = w.details ?? {};
    if (!has(`warnings.${w.code}`)) return [];
    const items = Array.isArray(d.items) ? (d.items as Record<string, unknown>[]) : [d];
    return items.map((it) => t(`warnings.${w.code}`, { ...d, ...it }));
  });
}

/** Grams that FILAMENT_SHORTFALL says were missing (with purge, like what the spools lose): not deducted. */
export function shortfallGrams(ws: readonly Warning[]): number {
  return ws.filter((w) => w.code === 'FILAMENT_SHORTFALL').reduce((a, w) => {
    const d = w.details ?? {};
    const items = Array.isArray(d.items) ? (d.items as { missingGrams?: number }[]) : [d as { missingGrams?: number }];
    return a + items.reduce((x, it) => x + (Number(it.missingGrams) || 0), 0);
  }, 0);
}

export function useWriteWithWarnings<I, O>(fn: (input: I) => Promise<Result<O>>, opts: { touches: (keyof typeof keys)[]; ok: (out: O, warnings: Warning[], input: I) => string; onDone?: (out: O) => void }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (res, input) => {
      await invalidate(qc, ...opts.touches);
      toast(opts.ok(res.data, res.warnings, input));
      opts.onDone?.(res.data);
    },
    onError: (e) => toast(errorText(e).text),
  });
}
