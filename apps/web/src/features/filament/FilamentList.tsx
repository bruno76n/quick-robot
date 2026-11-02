// Filamentos (docs/06 §6): wide list with what is left, spools, cost per gram and status; a row opens the drawer.
import type { FilamentListItem } from '@app/contract';
import { useSearch } from '@tanstack/react-router';
import { go } from '../../lib/nav';
import { useState } from 'react';
import { PageHead } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { Mascot } from '../../components/Mascot';
import { Pill, Swatch, type Tone } from '../../components/Pill';
import { Table } from '../../components/Table';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { centsTotal, grams, money2d, number1 } from '../../lib/format';
import { useFilaments } from './api';
import { FilamentDrawer } from './FilamentDrawer';
import { SpoolDialog } from './SpoolDialog';

export const FILAMENT_TONE: Record<FilamentListItem['status'], Tone> = { no_spools: 'plain', out: 'bad', ending: 'bad', low: 'warn', new: 'info', ok: 'good' };
const L = es.screens.filaments;

export function FilamentList() {
  const { data, isLoading } = useFilaments();
  const search = useSearch({ strict: false }) as { f?: string };
  const [dialog, setDialog] = useState<{ filamentId?: string; spoolId?: string } | null>(null);
  const selected = search.f ?? null;
  const select = (id: string | null) => go(id ? `/filamentos?f=${id}` : '/filamentos', true);
  const items = [...(data?.items ?? [])].sort((a, b) => a.material.localeCompare(b.material, 'es') || a.color.localeCompare(b.color, 'es'));
  const totalGrams = items.reduce((a, f) => a + f.remainingGrams, 0);
  const spools = items.reduce((a, f) => a + f.spools, 0);
  const value = items.reduce((a, f) => a + f.valueCents, 0);
  return (
    <>
      <PageHead
        title={L.title}
        sub={data ? t('screens.filaments.summary', { filaments: items.length, spools, kg: number1(totalGrams / 1000), value: centsTotal(value) }) : null}
        actions={<Button variant="primary" icon="plus" onClick={() => setDialog({})}>{L.addSpool}</Button>}
      />
      <Table className="fil-t" head={<><th>{L.colFilament}</th><th className="r">{L.colPerGram}</th><th>{L.colAvailable}</th><th /></>}>
        {isLoading ? <tr><td colSpan={4}><div className="skel" /></td></tr> : null}
        {!isLoading && !items.length ? (
          <tr><td colSpan={4} className="empty-td"><Mascot size={48} /><p>{L.empty}</p><Button variant="primary" onClick={() => setDialog({})}>{L.emptyButton}</Button></td></tr>
        ) : null}
        {items.map((f) => (
          <tr key={f.id} className={`click${selected === f.id ? ' sel' : ''}`} tabIndex={0} onClick={() => select(f.id)} onKeyDown={(e) => { if (e.key === 'Enter') select(f.id); }} data-testid="filament-row">
            <td><div className="pn"><Swatch hex={f.hex} /><div><b>{f.material} {f.color}</b><small>{f.activeSpools ? t('screens.filaments.rowSpools', { count: f.activeSpools, brands: f.brands.join(', ') || es.common.noBrand }) : L.noMaterial}</small></div></div></td>
            <td className="r num">{money2d(f.costPerGram)}</td>
            <td className="stk-td"><span className={`stk${FILAMENT_TONE[f.status] === 'bad' ? ' low' : ''}`}><i style={{ width: `${f.capacityGrams ? Math.min(100, (f.remainingGrams / f.capacityGrams) * 100) : 0}%` }} /></span><span className="num">{grams(f.remainingGrams)}</span></td>
            <td><Pill tone={FILAMENT_TONE[f.status]}>{es.status.filament[f.status]}</Pill></td>
          </tr>
        ))}
      </Table>
      <FilamentDrawer id={selected} onClose={() => select(null)} onAddSpool={(filamentId) => setDialog({ filamentId })} onEditSpool={(spoolId) => setDialog({ ...(selected ? { filamentId: selected } : {}), spoolId })} />
      {dialog ? <SpoolDialog filamentId={dialog.filamentId} spoolId={dialog.spoolId} filaments={items} onClose={() => setDialog(null)} onAdded={(id) => { setDialog(null); select(id); }} onDeleted={() => setDialog(null)} /> : null}
    </>
  );
}
