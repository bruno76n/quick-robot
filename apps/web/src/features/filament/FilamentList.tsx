// Filamentos (docs/06 §6, reference/ronda-4/filamentos.html): each filament (material + color) with its numbered spools below.
// Tapping a filament opens its drawer (summary and every movement); tapping a spool opens the drawer of that spool (exception 2).
import type { FilamentListItem, Spool } from '@app/contract';
import { useSearch } from '@tanstack/react-router';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Button } from '../../components/Button';
import { Kpis } from '../../components/Kpis';
import { Mascot } from '../../components/Mascot';
import { Meter } from '../../components/Meter';
import { PageHead } from '../../components/PageHead';
import { Pill, Swatch } from '../../components/Pill';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { centsTotal, date, grams, number1 } from '../../lib/format';
import { go } from '../../lib/nav';
import { useFilaments } from './api';
import { FilamentDrawer } from './FilamentDrawer';
import { FinishDialog, SpoolDrawer } from './SpoolDrawer';
import { SpoolDialog } from './SpoolDialog';
import { costSourceShort, filamentName, perGram, spoolName, SpoolTag } from './spools';
import { FILAMENT_TONE, SPOOL_TONE } from './tone';
import './filament.css';

const L = es.screens.filaments;
type Action = 'pesar' | 'movimientos';

export function FilamentList() {
  const { data, isLoading } = useFilaments();
  const search = useSearch({ strict: false }) as { f?: string; r?: string; a?: Action };
  const [dialog, setDialog] = useState<{ filamentId?: string; spoolId?: string } | null>(null);
  const [finish, setFinish] = useState<Spool | null>(null);
  const filamentId = search.f ?? null;
  const spoolId = search.r ?? null;
  const openFilament = (id: string | null) => go(id ? `/filamentos?f=${id}` : '/filamentos', true);
  const openSpool = (id: string, a?: Action) => go(`/filamentos?r=${id}${a ? `&a=${a}` : ''}`, true);
  const items = [...(data?.items ?? [])].sort((a, b) => a.material.localeCompare(b.material, 'es') || a.color.localeCompare(b.color, 'es'));
  const totalGrams = items.reduce((a, f) => a + f.remainingGrams, 0);
  const spools = items.reduce((a, f) => a + f.spoolCount, 0);
  const value = items.reduce((a, f) => a + f.valueCents, 0);
  const low = items.filter((f) => f.status === 'low' || f.status === 'ending' || f.status === 'out').length;
  const noCost = items.reduce((a, f) => a + f.noCostSpools, 0);
  const spoolOf = (id: string | null) => (id ? items.flatMap((f) => f.spools).find((s) => s.id === id) : undefined);
  const spool = spoolOf(spoolId);
  const onMenu = (s: Spool, what: 'weigh' | 'finish' | 'edit' | 'movements') => {
    if (what === 'weigh') openSpool(s.id, 'pesar');
    else if (what === 'movements') openSpool(s.id, 'movimientos');
    else if (what === 'finish') setFinish(s);
    else setDialog({ filamentId: s.filamentId, spoolId: s.id });
  };
  return (
    <>
      <PageHead
        title={L.title}
        sub={data ? t('screens.filaments.sub', { filaments: items.length, spools }) : null}
        actions={<Button variant="primary" icon="plus" onClick={() => setDialog({})}>{L.addSpool}</Button>}
      />
      {data && items.length ? (
        <Kpis label={L.kpisAria} className="fil-k" items={[
          { label: L.available, value: t('screens.filaments.kg', { kg: number1(totalGrams / 1000) }) },
          { label: L.inventoryValue, value: centsTotal(value), sub: L.valueSub },
          { label: L.lowOrCritical, value: low, tone: low ? 'bad' : '' },
          { label: L.noCostSpools, value: noCost, sub: L.noCostSub },
        ]} />
      ) : null}
      {isLoading ? <div className="skel" /> : null}
      {data && !items.length ? (
        <div className="empty-card"><Mascot size={48} /><p>{L.empty}</p><Button variant="primary" onClick={() => setDialog({})}>{L.emptyButton}</Button></div>
      ) : null}
      <div className="fg-list">
        {items.map((f) => <FilamentGroup key={f.id} f={f} selected={filamentId === f.id} spoolId={spoolId} onOpen={() => openFilament(f.id)} onSpool={(s) => openSpool(s.id)} onMenu={onMenu} />)}
      </div>
      <FilamentDrawer id={spoolId ? null : filamentId} onClose={() => openFilament(null)} onAddSpool={(id) => setDialog({ filamentId: id })} onEditSpool={(id) => setDialog({ ...(filamentId ? { filamentId } : {}), spoolId: id })} onOpenSpool={(id) => openSpool(id)} />
      <SpoolDrawer spool={spool ?? null} focus={search.a} filaments={items} onClose={() => openFilament(null)} onEdit={(s) => setDialog({ filamentId: s.filamentId, spoolId: s.id })} onFinish={setFinish} />
      {finish ? <FinishDialog spool={finish} filament={items.find((f) => f.id === finish.filamentId)} onClose={() => setFinish(null)} /> : null}
      {dialog ? <SpoolDialog filamentId={dialog.filamentId} spoolId={dialog.spoolId} filaments={items} onClose={() => setDialog(null)} onAdded={(id) => { setDialog(null); if (!spoolId) openFilament(id); }} onDeleted={() => { setDialog(null); if (spoolId) openFilament(null); }} /> : null}
    </>
  );
}

function FilamentGroup({ f, selected, spoolId, onOpen, onSpool, onMenu }: { f: FilamentListItem; selected: boolean; spoolId: string | null; onOpen: () => void; onSpool: (s: Spool) => void; onMenu: (s: Spool, what: 'weigh' | 'finish' | 'edit' | 'movements') => void }) {
  const [showEmpty, setShowEmpty] = useState(false);
  const live = f.spools.filter((s) => s.status !== 'empty');
  const empty = f.spools.filter((s) => s.status === 'empty');
  const shown = showEmpty ? [...live, ...empty] : live;
  const name = filamentName(f);
  const key = (e: KeyboardEvent, fn: () => void) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } };
  return (
    <section className="fg" aria-label={name}>
      <div className={`fg-h${selected ? ' sel' : ''}`} tabIndex={0} role="button" onClick={onOpen} onKeyDown={(e) => key(e, onOpen)} data-testid="filament-row">
        <Swatch hex={f.hex} />
        <span className="fg-n"><b>{name}</b><span className="meta">{f.activeSpools ? t('screens.filaments.rowSpools', { count: f.activeSpools, brands: f.brands.join(', ') || es.common.noBrand }) : L.noMaterial}</span></span>
        <span className="fg-q"><b className="num">{grams(f.remainingGrams)}</b><span className="meta">{L.availableSub}</span></span>
        <span className="fg-c"><b className="num">{perGram(f.costPerGram)}</b><span className="meta">{costSourceShort(f)}</span></span>
        <Pill tone={FILAMENT_TONE[f.status]}>{es.status.filament[f.status]}</Pill>
      </div>
      {f.spools.length ? (
        <ul className="rr-list">
          {shown.map((s) => <SpoolRow key={s.id} s={s} name={name} on={spoolId === s.id} onOpen={() => onSpool(s)} onMenu={(what) => onMenu(s, what)} />)}
          {empty.length ? (
            <li className="rr-more"><button type="button" aria-expanded={showEmpty} onClick={() => setShowEmpty(!showEmpty)}>
              {showEmpty ? L.hideEmpty : t('screens.filaments.emptyHidden', { count: empty.length })}
            </button></li>
          ) : null}
        </ul>
      ) : null}
    </section>
  );
}

function SpoolRow({ s, name, on, onOpen, onMenu }: { s: Spool; name: string; on: boolean; onOpen: () => void; onMenu: (what: 'weigh' | 'finish' | 'edit' | 'movements') => void }) {
  return (
    <li className={`rr${on ? ' on' : ''}${s.status === 'empty' ? ' empty' : ''}`} tabIndex={0} onClick={onOpen} onKeyDown={(e) => { if (e.target === e.currentTarget && e.key === 'Enter') onOpen(); }}
      aria-label={t('screens.filaments.spoolAria', { number: spoolName(s.number), name })} data-testid="spool-row">
      <SpoolTag n={s.number} />
      <span className="rr-b"><b>{s.brand || es.common.noBrand}</b>
        <span className="meta">{date(s.purchasedOn)}<span aria-hidden="true">·</span>{s.noCost ? <Pill tone="info">{es.screens.spools.noCost}</Pill> : <span className="num">{centsTotal(s.costCents + s.shippingCents)}</span>}</span>
      </span>
      <span className="rr-m"><Meter value={s.remainingGrams} max={s.grams} /><span className="meta num">{t('screens.filaments.spoolLeft', { leftGrams: s.remainingGrams, totalGrams: s.grams })}</span></span>
      <Pill tone={SPOOL_TONE[s.status]}>{es.status.spool[s.status]}</Pill>
      <SpoolMenu number={s.number} empty={s.status === 'empty'} onPick={onMenu} />
    </li>
  );
}

/** The ··· of a spool: Pesar, Terminar rollo, Editar, Movimientos (mockup .rr-x). */
function SpoolMenu({ number, empty, onPick }: { number: number; empty: boolean; onPick: (what: 'weigh' | 'finish' | 'edit' | 'movements') => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc, true);
    ref.current?.querySelector<HTMLButtonElement>('[role=menuitem]')?.focus();
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc, true); };
  }, [open]);
  const pick = (what: 'weigh' | 'finish' | 'edit' | 'movements') => { setOpen(false); onPick(what); };
  const items: ['weigh' | 'finish' | 'edit' | 'movements', string][] = [['weigh', L.weigh], ...(empty ? [] : [['finish', L.finish] as ['finish', string]]), ['edit', es.common.edit], ['movements', L.movements]];
  return (
    <span className="rr-x" ref={ref} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <button type="button" className="btn ghost" aria-haspopup="menu" aria-expanded={open} aria-label={t('screens.filaments.spoolMenu', { number: spoolName(number) })} onClick={() => setOpen(!open)} data-testid="spool-menu">
        <span aria-hidden="true">{L.menuDots}</span>
      </button>
      {open ? (
        <ul className="rmenu" role="menu">
          {items.map(([k, label]) => <li key={k} role="none"><button type="button" role="menuitem" onClick={() => pick(k)}>{label}</button></li>)}
        </ul>
      ) : null}
    </span>
  );
}
