// Ajustes (docs/06 §15): workshop costs, sales channels and business data. Each field saves when it is left.
import type { ChannelView } from '@app/contract';
import { useQueryClient } from '@tanstack/react-query';
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
  if (!data) return <PageHead title={L.title} sub={L.sub} />;
  const s = data.settings;
  const cost = (label: string, key: CostKey, unit: string, hint: string) => {
    const value = key === 'kwhPriceCents' ? s.kwhPriceCents / 100 : s[key];
    return (
      <Field label={label} hint={hint}>
        <UnitInput unit={unit} inputMode="decimal" defaultValue={String(value)} key={`${key}-${value}`} onBlur={(e) => {
          const v = parseNumber(e.target.value, value);
          if (v === value) return;
          void run(api.settings.update({ [key]: key === 'kwhPriceCents' ? Math.round(v * 100) : v }), ['settings', 'products', 'collections', 'printers']);
        }} />
      </Field>
    );
  };
  const p0 = printers[0];
  const machine = p0 ? p0.costCents / 100 / p0.lifeHours + p0.maintenanceCentsPerHour / 100 : 0;
  const power = p0 ? p0.kw * (s.kwhPriceCents / 100) : 0;
  const business = (label: string, key: 'name' | 'trade' | 'phone' | 'email' | 'city', placeholder = '') => (
    <Field label={label}>
      <input defaultValue={s.business[key]} key={`${key}-${s.business[key]}`} placeholder={placeholder} onBlur={(e) => { if (e.target.value !== s.business[key]) void run(api.settings.update({ business: { [key]: e.target.value } }), ['settings']); }} />
    </Field>
  );
  return (
    <>
      <PageHead title={L.title} sub={L.sub} />
      <div className="set">
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
            <Field label={L.validity}><UnitInput unit={L.days} inputMode="numeric" defaultValue={String(s.business.quoteValidDays)} key={`v-${s.business.quoteValidDays}`} onBlur={(e) => {
              const v = Math.max(0, Math.round(parseNumber(e.target.value, s.business.quoteValidDays)));
              if (v !== s.business.quoteValidDays) void run(api.settings.update({ business: { quoteValidDays: v } }), ['settings']);
            }} /></Field>
          </div>
          <div className="mt"><Field label={L.footer} hint={L.footerHint}><textarea rows={2} defaultValue={s.business.footer} key={`f-${s.business.footer}`} onBlur={(e) => { if (e.target.value !== s.business.footer) void run(api.settings.update({ business: { footer: e.target.value } }), ['settings']); }} /></Field></div>
        </section>
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
      <input defaultValue={c.name} key={`n-${c.name}`} aria-label={L.channel} onBlur={(e) => {
        const v = e.target.value.trim();
        if (!v) { e.target.value = c.name; toast(es.fields['channel.name.required']); return; }
        if (v !== c.name) void run(api.settings.updateChannel(c.id, { name: v }), ['settings', 'products'], es.toast['channel.renamed']);
      }} />
      <UnitInput unit="%" inputMode="decimal" defaultValue={String(c.commissionPct)} key={`c-${c.commissionPct}`} aria-label={L.commission} onBlur={(e) => {
        const v = parseNumber(e.target.value, c.commissionPct);
        if (v !== c.commissionPct) void run(api.settings.updateChannel(c.id, { commissionPct: v }), ['settings', 'products']);
      }} />
      <ConfirmButton variant="ghost" size="sm" confirmText={es.confirm.removeQuestion} onConfirm={() => void run(api.settings.removeChannel(c.id), ['settings'], t('toast.channel.removed', { name: c.name }))} aria-label={t('screens.settings.removeChannel', { name: c.name })}>{L.remove}</ConfirmButton>
    </div>
  );
}
