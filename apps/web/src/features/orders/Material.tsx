// Filament of an order (mockup matRows/faltaHTML): grams with purge per filament, what is left, and the shortfall note.
import { Fragment } from 'react';
import { Icon } from '../../components/Icon';
import { Swatch } from '../../components/Pill';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { grams } from '../../lib/format';
import { go } from '../../lib/nav';
import { useSettings } from '../../lib/queries';
import { useFilaments } from '../filament/api';
import { tbc } from './parts';

const L = es.screens.order;
export interface MatLine { filamentId: string; name: string; hex: string; need: number; left: number; spools: number; short: boolean }

/** Needs (grams without purge, from the server) → lines with purge against what is left. */
export function useMaterial(needs: readonly { filamentId: string; grams: number }[]) {
  const purge = useSettings().data?.settings.purgePct ?? 0;
  const fils = new Map((useFilaments().data?.items ?? []).map((f) => [f.id, f]));
  const lines: MatLine[] = needs.filter((n) => n.grams > 0).map((n) => {
    const f = fils.get(n.filamentId);
    const need = n.grams * (1 + purge / 100);
    const left = f?.remainingGrams ?? 0;
    return { filamentId: n.filamentId, name: f ? `${f.material} ${f.color}` : '', hex: f?.hex ?? '#ccc', need, left, spools: f?.spools ?? 0, short: need > left + 0.01 };
  });
  return { purge, lines, total: lines.reduce((a, l) => a + l.need, 0), short: lines.filter((l) => l.short) };
}

export function MatRows({ lines, stock = true }: { lines: readonly MatLine[]; stock?: boolean }) {
  return <>{lines.map((l) => (
    <span key={l.filamentId} className={`mrow${stock && l.short ? ' bad' : ''}`}>
      <Swatch hex={l.hex} />
      <span>{l.name}{stock && l.spools > 1 ? <> <small className="inl">{t('screens.order.spoolsInline', { count: l.spools })}</small></> : null}</span>
      <b className="num">{grams(l.need)}</b>
      {stock ? <small>{l.short ? t('screens.order.missing', { grams: l.need - l.left }) : t('screens.order.left', { grams: l.left - l.need })}</small> : null}
    </span>
  ))}</>;
}

export function Shortfall({ lines, onAdd }: { lines: readonly MatLine[]; onAdd?: () => void }) {
  if (!lines.length) return null;
  return (
    <p className="status warn"><Icon name="warn" size={16} /><span>
      {L.shortLead}{' '}
      {lines.map((l, i) => <Fragment key={l.filamentId}>{i ? ` ${L.shortAnd} ` : ''}{tbc('screens.order.shortItem', { missing: grams(l.need - l.left), name: l.name, available: grams(l.left) }, {}, ['name', 'available'])}</Fragment>)}
      . {L.canStart}<br />
      {lines.map((l, i) => <Fragment key={l.filamentId}>{i ? ' · ' : ''}<button type="button" className="link" onClick={() => { onAdd?.(); go(`/filamentos?f=${l.filamentId}`); }}>{t('screens.order.addSpoolOf', { name: l.name })}</button></Fragment>)}
    </span></p>
  );
}
