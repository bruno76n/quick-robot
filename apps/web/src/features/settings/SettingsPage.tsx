// Ajustes (docs/06 §15): workshop costs, sales channels and business data. Edits are kept in the form and saved together with the "Guardar cambios" button.
// Ronda 3 (reference/ronda-3/ajustes.html): an index of the sections on the left, one panel per section, channels in a table.
import type { ChannelView } from '@app/contract';
import { COST_AVG_PURCHASES } from '@app/core';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { PageHead } from '../../components/PageHead';
import { Button } from '../../components/Button';
import { ConfirmButton } from '../../components/ConfirmButton';
import { Field } from '../../components/Field';
import { Panel } from '../../components/Panel';
import { Table, Td, Th } from '../../components/Table';
import { toast } from '../../components/Toast';
import { UnitInput } from '../../components/UnitInput';
import { es } from '../../i18n/es';
import { tb } from '../../i18n/rich';
import { t } from '../../i18n/t';
import { api } from '../../lib/api';
import { errorText } from '../../lib/errors';
import { money2d } from '../../lib/format';
import { parseNumber } from '../../lib/input';
import { invalidate, usePrinters, useSettings } from '../../lib/queries';
import { BackupSection, ClearSection } from './BackupSection';
import { CsvExport } from './CsvExport';
import './settings.css';

const L = es.screens.settings;
/** The index on the left: the id of each section and its title. */
const SECTIONS: [string, string][] = [['set-costs', L.costs], ['set-channels', L.channels], ['set-docs', L.documents], ['set-backup', es.screens.backup.title], ['set-export', L.exportTitle], ['set-clear', es.screens.backup.clearTitle]];
type CostKey = 'kwhPriceCents' | 'failurePct' | 'purgePct' | 'minMarginPct' | 'formulaMarginPct';

export function SettingsPage() {
  const { data } = useSettings();
  const printers = usePrinters().data?.items ?? [];
  const qc = useQueryClient();
  const run = async (p: Promise<unknown>, touches: ('settings' | 'products' | 'collections' | 'printers')[], ok?: string) => {
    try { await p; await invalidate(qc, ...touches, 'me'); toast(ok ?? L.autosaved); } catch (e) { toast(errorText(e).text); await invalidate(qc, 'settings'); }
  };
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState(SECTIONS[0]![0]);
  const goTo = (id: string) => { setActive(id); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  if (!data) return <PageHead title={L.title} sub={L.sub} />;
  const s = data.settings;
  const save = async (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    const str = (k: string) => String(f.get(k) ?? '');
    const patch: Record<string, unknown> = {};
    for (const key of ['failurePct', 'purgePct', 'minMarginPct', 'formulaMarginPct'] as const) {
      const v = parseNumber(str(key), s[key]);
      if (v !== s[key]) patch[key] = v;
    }
    const avg = Math.round(parseNumber(str('costAvgPurchases'), s.costAvgPurchases));
    if (avg !== s.costAvgPurchases) {
      if (!(avg >= COST_AVG_PURCHASES.min && avg <= COST_AVG_PURCHASES.max)) { toast(es.fields['settings.costAvgPurchases.range']); return; }
      patch.costAvgPurchases = avg;
    }
    const kwh = Math.round(parseNumber(str('kwhPriceCents'), s.kwhPriceCents / 100) * 100);
    if (kwh !== s.kwhPriceCents) patch.kwhPriceCents = kwh;
    const biz: Record<string, unknown> = {};
    for (const key of ['name', 'trade', 'phone', 'email', 'city', 'footer'] as const) if (str(`b-${key}`) !== s.business[key]) biz[key] = str(`b-${key}`);
    const days = Math.max(0, Math.round(parseNumber(str('b-quoteValidDays'), s.business.quoteValidDays)));
    if (days !== s.business.quoteValidDays) biz.quoteValidDays = days;
    if (Object.keys(biz).length) patch.business = biz;
    const chans: { id: string; body: { name?: string; commissionPct?: number } }[] = [];
    for (const c of data.channels) {
      const nm = str(`ch-name-${c.id}`).trim();
      if (!nm) { toast(es.fields['channel.name.required']); return; }
      const pct = parseNumber(str(`ch-pct-${c.id}`), c.commissionPct);
      const body: { name?: string; commissionPct?: number } = {};
      if (nm !== c.name) body.name = nm;
      if (pct !== c.commissionPct) body.commissionPct = pct;
      if (Object.keys(body).length) chans.push({ id: c.id, body });
    }
    if (!Object.keys(patch).length && !chans.length) { setDirty(false); return; }
    setSaving(true);
    try {
      if (Object.keys(patch).length) await api.settings.update(patch);
      for (const c of chans) await api.settings.updateChannel(c.id, c.body);
      await invalidate(qc, 'settings', 'products', 'collections', 'printers', 'filaments', 'me');
      setDirty(false);
      toast(L.saved);
    } catch (e) { toast(errorText(e).text); await invalidate(qc, 'settings'); } finally { setSaving(false); }
  };
  const cost = (label: string, key: CostKey, unit: string, hint: string) => {
    const value = key === 'kwhPriceCents' ? s.kwhPriceCents / 100 : s[key];
    return (
      <Field label={label} hint={hint}>
        <UnitInput unit={unit} name={key} inputMode="decimal" defaultValue={String(value)} key={`${key}-${value}`} />
      </Field>
    );
  };
  const p0 = printers[0];
  const machine = p0 ? p0.costCents / 100 / p0.lifeHours + p0.maintenanceCentsPerHour / 100 : 0;
  const power = p0 ? p0.kw * (s.kwhPriceCents / 100) : 0;
  const business = (label: string, key: 'name' | 'trade' | 'phone' | 'email' | 'city', placeholder = '') => (
    <Field label={label}>
      <input name={`b-${key}`} defaultValue={s.business[key]} key={`${key}-${s.business[key]}`} placeholder={placeholder} />
    </Field>
  );
  const addChannel = () => {
    const names = new Set(data.channels.map((c) => c.name.toLowerCase()));
    let name: string = L.newChannel;
    for (let k = 2; names.has(name.toLowerCase()); k++) name = `${L.newChannel} ${k}`;
    void run(api.settings.addChannel({ name, commissionPct: 0 }), ['settings']);
  };
  return (
    <>
      <PageHead title={L.title} sub={L.sub} />
      <div className="set-grid">
        <nav className="set-nav" aria-label={L.navAria}>
          {SECTIONS.map(([id, label]) => <button key={id} type="button" className={active === id ? 'on' : undefined} aria-current={active === id ? 'true' : undefined} onClick={() => goTo(id)}>{label}</button>)}
        </nav>
        <div className="set-main">
          <form id="settings-form" className="set-form" onSubmit={(e) => void save(e)} onInput={() => setDirty(true)} noValidate>
            <Panel id="set-costs" title={L.costs}>
              <div className="grid3">
                {cost(L.kwh, 'kwhPriceCents', L.kwhUnit, L.kwhHint)}{cost(L.failures, 'failurePct', '%', L.failuresHint)}{cost(L.purge, 'purgePct', '%', L.purgeHint)}
                {cost(L.minMargin, 'minMarginPct', '%', L.minMarginHint)}{cost(L.formulaMargin, 'formulaMarginPct', '%', L.formulaMarginHint)}
                <Field label={L.avgPurchases} hint={L.avgPurchasesHint}>
                  <UnitInput unit={L.avgPurchasesUnit} name="costAvgPurchases" inputMode="numeric" defaultValue={String(s.costAvgPurchases)} key={`avg-${s.costAvgPurchases}`} />
                </Field>
              </div>
              <p className="meta set-note">{p0 ? <>{tb('screens.settings.perHourLead', { printer: p0.name, total: money2d(machine + power) })} {t('screens.settings.perHourSplit', { machine: money2d(machine), power: money2d(power) })}</> : L.noPrinters}</p>
            </Panel>
            <Panel id="set-channels" title={L.channels} aside={<Button size="sm" icon="plus" onClick={addChannel}>{L.addChannel}</Button>}>
              <p className="meta set-lead">{L.channelsHint}</p>
              <Table fit className="chan-t" head={<><Th>{L.channel}</Th><Th>{L.commission}</Th><Th><span className="sr">{L.remove}</span></Th></>}>
                {data.channels.map((c) => <ChannelRow key={c.id} c={c} run={run} />)}
              </Table>
            </Panel>
            <Panel id="set-docs" title={L.documents}>
              <p className="meta set-lead">{L.documentsHint}</p>
              <div className="grid2">
                {business(L.businessName, 'name')}{business(L.trade, 'trade', L.tradePlaceholder)}{business(L.phone, 'phone', L.phonePlaceholder)}{business(L.email, 'email', L.emailPlaceholder)}{business(L.city, 'city')}
                <Field label={L.validity}><UnitInput unit={L.days} name="b-quoteValidDays" inputMode="numeric" defaultValue={String(s.business.quoteValidDays)} key={`v-${s.business.quoteValidDays}`} /></Field>
              </div>
              <div className="mt"><Field label={L.footer} hint={L.footerHint}><textarea name="b-footer" rows={2} defaultValue={s.business.footer} key={`f-${s.business.footer}`} /></Field></div>
            </Panel>
          </form>
          <BackupSection />
          <CsvExport />
          <ClearSection />
          <div className="set-save">
            {dirty ? <span className="meta" role="status">{L.unsaved}</span> : null}
            <Button variant="primary" type="submit" form="settings-form" disabled={!dirty} busy={saving}>{L.save}</Button>
          </div>
        </div>
      </div>
    </>
  );
}

function ChannelRow({ c, run }: { c: ChannelView; run: (p: Promise<unknown>, touches: ('settings' | 'products')[], ok?: string) => Promise<void> }) {
  return (
    <tr>
      <Td><input name={`ch-name-${c.id}`} defaultValue={c.name} key={`n-${c.name}`} aria-label={L.channel} /></Td>
      <Td className="chan-pct"><UnitInput unit="%" name={`ch-pct-${c.id}`} inputMode="decimal" defaultValue={String(c.commissionPct)} key={`c-${c.commissionPct}`} aria-label={L.commission} /></Td>
      <Td r><ConfirmButton size="sm" confirmText={es.confirm.removeQuestion} onConfirm={() => void run(api.settings.removeChannel(c.id), ['settings'], t('toast.channel.removed', { name: c.name }))} aria-label={t('screens.settings.removeChannel', { name: c.name })}>{L.remove}</ConfirmButton></Td>
    </tr>
  );
}
