// Filamentos (docs/06 §6): wide list with what is left, spools, cost per gram and status; a row opens the drawer.
import { useSearch } from '@tanstack/react-router';
import { go } from '../../lib/nav';
import { useState } from 'react';
import { PageHead } from '../../components/PageHead';
import { Button } from '../../components/Button';
import { Kpis } from '../../components/Kpis';
import { Mascot } from '../../components/Mascot';
import { Meter } from '../../components/Meter';
import { Panel } from '../../components/Panel';
import { Pill, Swatch } from '../../components/Pill';
import { Table, Td, Th } from '../../components/Table';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { centsTotal, grams, money2d, number1 } from '../../lib/format';
import { useFilaments } from './api';
import { FilamentDrawer } from './FilamentDrawer';
import { SpoolDialog } from './SpoolDialog';
import { FILAMENT_TONE, METER_TONE } from './tone';
import './filament.css';

const L = es.screens.filaments;

export function FilamentList() {
  const { data, isLoading } = useFilaments();
  const search = useSearch({ strict: false }) as { f?: string };
  const [dialog, setDialog] = useState<{ filamentId?: string; spoolId?: string } | null>(null);
  const selected = search.f ?? null;
  const select = (id: string | null) => go(id ? `/filamentos?f=${id}` : '/filamentos', true);
  const items = [...(data?.items ?? [])].sort((a, b) => a.material.localeCompare(b.material, 'es') || a.color.localeCompare(b.color, 'es'));
  const totalGrams = items.reduce((a, f) => a + f.remainingGrams, 0);
  const spools = items.reduce((a, f) => a + f.spoolCount, 0);
  const value = items.reduce((a, f) => a + f.valueCents, 0);
  const low = items.filter((f) => f.status === 'low').length;
  const critical = items.filter((f) => f.status === 'ending').length;
  return (
    <>
      <PageHead
        title={L.title}
        sub={data ? t('screens.filaments.sub', { filaments: items.length, spools }) : null}
        actions={<Button variant="primary" icon="plus" onClick={() => setDialog({})}>{L.addSpool}</Button>}
      />
      {data && items.length ? (
        <Kpis label={L.kpisAria} className={`fil-k${low ? ' has-low' : ''}`} items={[
          { label: L.available, value: t('screens.filaments.kg', { kg: number1(totalGrams / 1000) }) },
          { label: L.inventoryValue, value: centsTotal(value) },
          { label: es.status.filament.low, value: low },
          { label: es.status.filament.ending, value: critical, tone: critical ? 'bad' : '' },
        ]} />
      ) : null}
      <Panel flush className="fil-p">
        <Table fit className="fil-t" head={<><Th>{L.colFilament}</Th><Th r hideSm>{L.colPerGram}</Th><Th>{L.colAvailable}</Th><Th r>{L.colStatus}</Th></>}>
          {isLoading ? <tr><td colSpan={4}><div className="skel" /></td></tr> : null}
          {!isLoading && !items.length ? (
            <tr><td colSpan={4} className="empty-td"><Mascot size={48} /><p>{L.empty}</p><Button variant="primary" onClick={() => setDialog({})}>{L.emptyButton}</Button></td></tr>
          ) : null}
          {items.map((f) => (
            <tr key={f.id} className={`click${selected === f.id ? ' sel' : ''}`} tabIndex={0} onClick={() => select(f.id)} onKeyDown={(e) => { if (e.key === 'Enter') select(f.id); }} data-testid="filament-row">
              <Td><div className="pn"><Swatch hex={f.hex} /><div><b>{f.material} {f.color}</b><small className="meta">{f.activeSpools ? t('screens.filaments.rowSpools', { count: f.activeSpools, brands: f.brands.join(', ') || es.common.noBrand }) : L.noMaterial}</small></div></div></Td>
              <Td r hideSm className="num">{money2d(f.costPerGram)}</Td>
              <Td className="fil-q"><Meter value={f.remainingGrams} max={f.capacityGrams} tone={METER_TONE[FILAMENT_TONE[f.status]]} /><span className="num meta">{grams(f.remainingGrams)}</span></Td>
              <Td r><Pill tone={FILAMENT_TONE[f.status]}>{es.status.filament[f.status]}</Pill></Td>
            </tr>
          ))}
        </Table>
      </Panel>
      <FilamentDrawer id={selected} onClose={() => select(null)} onAddSpool={(filamentId) => setDialog({ filamentId })} onEditSpool={(spoolId) => setDialog({ ...(selected ? { filamentId: selected } : {}), spoolId })} />
      {dialog ? <SpoolDialog filamentId={dialog.filamentId} spoolId={dialog.spoolId} filaments={items} onClose={() => setDialog(null)} onAdded={(id) => { setDialog(null); select(id); }} onDeleted={() => setDialog(null)} /> : null}
    </>
  );
}
