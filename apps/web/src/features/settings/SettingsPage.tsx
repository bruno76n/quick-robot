// Ajustes (docs/06 §15): workshop costs, sales channels and business data. Edits are kept in the form and saved together with the "Guardar cambios" button.
import type { ChannelView } from '@app/contract';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { PageHead } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { ConfirmButton } from '../../components/ConfirmButton';
import { Field } from '../../components/Field';
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

const L = es.screens.settings;
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
      await invalidate(qc, 'settings', 'products', 'collections', 'printers', 'me');
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
  return (
    <>
      <PageHead title={L.title} sub={L.sub} actions={<>
        {dirty ? <span className="mut" role="status">{L.unsaved}</span> : null}
        <Button variant="primary" type="submit" form="settings-form" disabled={!dirty} busy={saving}>{L.save}</Button>
      </>} />
      <div className="set">
        <form id="settings-form" onSubmit={(e) => void save(e)} onInput={() => setDirty(true)} noValidate>
        <section>
          <h2>{L.costs}</h2>
          <div className="grid3">
            {cost(L.kwh, 'kwhPriceCents', L.kwhUnit, L.kwhHint)}{cost(L.failures, 'failurePct', '%', L.failuresHint)}{cost(L.purge, 'purgePct', '%', L.purgeHint)}
            {cost(L.minMargin, 'minMarginPct', '%', L.minMarginHint)}{cost(L.formulaMargin, 'formulaMarginPct', '%', L.formulaMarginHint)}
          </div>
          <p className="note">{p0 ? <>{tb('screens.settings.perHourLead', { printer: p0.name, total: money2d(machine + power) })} {t('screens.settings.perHourSplit', { machine: money2d(machine), power: money2d(power) })}</> : L.noPrinters}</p>
        </section>
        <section>
          <h2>{L.channels}</h2>
          <p className="muted">{L.channelsHint}</p>
          <div className="chan">{data.channels.map((c) => <ChannelRow key={c.id} c={c} run={run} />)}</div>
          <Button size="sm" icon="plus" onClick={() => {
            const names = new Set(data.channels.map((c) => c.name.toLowerCase()));
            let name: string = L.newChannel;
            for (let k = 2; names.has(name.toLowerCase()); k++) name = `${L.newChannel} ${k}`;
            void run(api.settings.addChannel({ name, commissionPct: 0 }), ['settings']);
          }}>{L.addChannel}</Button>
        </section>
        <section>
          <h2>{L.documents}</h2>
          <p className="muted">{L.documentsHint}</p>
          <div className="grid2">
            {business(L.businessName, 'name')}{business(L.trade, 'trade', L.tradePlaceholder)}{business(L.phone, 'phone', L.phonePlaceholder)}{business(L.email, 'email', L.emailPlaceholder)}{business(L.city, 'city')}
            <Field label={L.validity}><UnitInput unit={L.days} name="b-quoteValidDays" inputMode="numeric" defaultValue={String(s.business.quoteValidDays)} key={`v-${s.business.quoteValidDays}`} /></Field>
          </div>
          <div className="mt"><Field label={L.footer} hint={L.footerHint}><textarea name="b-footer" rows={2} defaultValue={s.business.footer} key={`f-${s.business.footer}`} /></Field></div>
        </section>
        </form>
        <BackupSection />
        <CsvExport />
        <ClearSection />
      </div>
    </>
  );
}

function ChannelRow({ c, run }: { c: ChannelView; run: (p: Promise<unknown>, touches: ('settings' | 'products')[], ok?: string) => Promise<void> }) {
  return (
    <div className="crow">
      <input name={`ch-name-${c.id}`} defaultValue={c.name} key={`n-${c.name}`} aria-label={L.channel} />
      <UnitInput unit="%" name={`ch-pct-${c.id}`} inputMode="decimal" defaultValue={String(c.commissionPct)} key={`c-${c.commissionPct}`} aria-label={L.commission} />
      <ConfirmButton variant="ghost" size="sm" confirmText={es.confirm.removeQuestion} onConfirm={() => void run(api.settings.removeChannel(c.id), ['settings'], t('toast.channel.removed', { name: c.name }))} aria-label={t('screens.settings.removeChannel', { name: c.name })}>{L.remove}</ConfirmButton>
    </div>
  );
}
