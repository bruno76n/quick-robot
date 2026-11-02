import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import type { BusinessInfo, Channel, UpdateSettingsInput } from '@app/contract';
import { normalizeName } from '@app/core';
import { PageHeader } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { Note } from '../../components/Note';
import { useToast } from '../../components/Toast';
import { UnitInput } from '../../components/UnitInput';
import { useTwoTap } from '../../components/useTwoTap';
import { es } from '../../i18n/es';
import { api } from '../../lib/api';
import { errorText } from '../../lib/error-text';
import { formatMoney } from '../../lib/format';
import { centsFromText, numFromText, textFromCents, textFromNum } from '../../lib/numbers';
import { useInvalidate, usePrinters, useSettings } from '../../lib/queries';

const t = es.settings;

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="grid content-start gap-3">
      <h2>{title}</h2>
      {sub && <p className="mt-1 max-w-[62ch] text-ink-2">{sub}</p>}
      {children}
    </section>
  );
}

/** Field saved when it loses focus (the mockup saves as it is typed). */
function CostField({ label, help, unit, value, onSave }: { label: string; help: string; unit: string; value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const id = `cfg-${label}`;
  return (
    <Field label={label} help={help} htmlFor={id}>
      <UnitInput id={id} unit={unit} inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onSave(v)} />
    </Field>
  );
}

function ChannelRow({ ch, onSaved }: { ch: Channel; onSaved: () => void }) {
  const toast = useToast((s) => s.show);
  const two = useTwoTap();
  const [name, setName] = useState(ch.name);
  const [pct, setPct] = useState(textFromNum(ch.commissionPct));
  useEffect(() => setName(ch.name), [ch.name]);
  useEffect(() => setPct(textFromNum(ch.commissionPct)), [ch.commissionPct]);
  const fail = (e: unknown) => toast(errorText(e));
  const saveName = async () => {
    const clean = name.trim().replace(/\s+/g, ' ');
    if (clean === ch.name) return setName(ch.name);
    if (!clean) return setName(ch.name), toast(t.channelNameMissing);
    try {
      await api.settings.updateChannel(ch.id, { name: clean });
      toast(t.channelRenamed);
      onSaved();
    } catch (e) {
      setName(ch.name);
      fail(e);
    }
  };
  const savePct = async () => {
    const n = Math.max(0, Math.min(95, numFromText(pct, ch.commissionPct)));
    if (n === ch.commissionPct) return setPct(textFromNum(ch.commissionPct));
    await api.settings.updateChannel(ch.id, { commissionPct: n }).then(onSaved, fail);
  };
  const remove = () =>
    two.tap(async () => {
      try {
        await api.settings.removeChannel(ch.id);
        onSaved();
        useToast.getState().show(t.channelRemoved(ch.name), { label: es.app.undo, run: () => void api.settings.restoreChannel(ch.id).then(onSaved, fail) });
      } catch (e) {
        fail(e);
      }
    });
  return (
    <div className="mb-2 grid max-w-[500px] grid-cols-[1fr_130px_auto] items-center gap-2">
      <input aria-label={t.channel} value={name} onChange={(e) => setName(e.target.value)} onBlur={() => void saveName()} data-channel={ch.id} />
      <UnitInput aria-label={t.commission} unit={es.units.pct} inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} onBlur={() => void savePct()} />
      <Button variant="ghost" size="sm" aria-label={t.removeChannel(ch.name)} onClick={remove}>
        {two.armed ? es.app.confirmRemove : es.app.remove}
      </Button>
    </div>
  );
}

export function SettingsPage() {
  const { data } = useSettings();
  const printers = usePrinters();
  const invalidate = useInvalidate();
  const toast = useToast((s) => s.show);
  const newChannel = useRef<string | null>(null);
  const save = useMutation({ mutationFn: (input: UpdateSettingsInput) => api.settings.update(input), onSuccess: () => invalidate('settings'), onError: (e) => toast(errorText(e)) });
  useEffect(() => {
    if (!newChannel.current) return;
    const el = document.querySelector<HTMLInputElement>(`[data-channel="${newChannel.current}"]`);
    if (el) {
      el.focus();
      el.select();
      newChannel.current = null;
    }
  }, [data]);
  if (!data) return <PageHeader title={t.title} sub={t.sub} />;
  const s = data.settings;
  const pctField = (k: 'failurePct' | 'purgePct' | 'minMarginPct' | 'formulaMarginPct') => (v: string) => save.mutate({ [k]: Math.max(0, Math.min(95, numFromText(v, s[k]))) });
  const bizField = (k: keyof BusinessInfo) => (v: string) => save.mutate({ business: { [k]: k === 'quoteValidDays' ? Math.max(0, Math.round(numFromText(v, 7))) : v.trim() } });
  const p0 = printers.data?.items[0];
  const kwh = s.kwhPriceCents / 100;
  const addChannel = async () => {
    const taken = new Set(data.channels.map((c) => normalizeName(c.name)));
    let name = t.newChannel;
    for (let k = 2; taken.has(normalizeName(name)); k++) name = `${t.newChannel} ${k}`;
    try {
      const c = await api.settings.addChannel({ name });
      newChannel.current = c.id;
      await invalidate('settings');
    } catch (e) {
      toast(errorText(e));
    }
  };
  const hc = p0 ? t.hourCost(p0.name, formatMoney(p0.machinePerHour + p0.kw * kwh), formatMoney(p0.machinePerHour), formatMoney(p0.kw * kwh)) : null;
  return (
    <>
      <PageHeader title={t.title} sub={t.sub} />
      <div className="grid max-w-[760px] gap-[34px]">
        <Section title={t.costs}>
          <div className="grid grid-cols-3 gap-x-[14px] gap-y-3 max-[560px]:grid-cols-1">
            <CostField label={t.kwh} help={t.kwhHelp} unit={es.units.kwh} value={textFromCents(s.kwhPriceCents)} onSave={(v) => save.mutate({ kwhPriceCents: Math.max(0, centsFromText(v, s.kwhPriceCents)) })} />
            <CostField label={t.failures} help={t.failuresHelp} unit={es.units.pct} value={textFromNum(s.failurePct)} onSave={pctField('failurePct')} />
            <CostField label={t.purge} help={t.purgeHelp} unit={es.units.pct} value={textFromNum(s.purgePct)} onSave={pctField('purgePct')} />
            <CostField label={t.minMargin} help={t.minMarginHelp} unit={es.units.pct} value={textFromNum(s.minMarginPct)} onSave={pctField('minMarginPct')} />
            <CostField label={t.formulaMargin} help={t.formulaMarginHelp} unit={es.units.pct} value={textFromNum(s.formulaMarginPct)} onSave={pctField('formulaMarginPct')} />
          </div>
          <Note>
            {hc ? (
              <>
                {hc.before}
                <b>{hc.printer}</b>
                {hc.middle}
                <b>{hc.total}</b>
                {hc.after}
              </>
            ) : (
              t.noPrinters
            )}
          </Note>
        </Section>
        <Section title={t.channels} sub={t.channelsSub}>
          <div>
            {data.channels.map((c) => (
              <ChannelRow key={c.id} ch={c} onSaved={() => void invalidate('settings')} />
            ))}
          </div>
          <Button size="sm" onClick={() => void addChannel()}>
            <Icon name="plus" size={14} />
            {t.addChannel}
          </Button>
        </Section>
        <Section title={t.documents} sub={t.documentsSub}>
          <div className="grid grid-cols-2 gap-x-[14px] gap-y-3 max-[560px]:grid-cols-1">
            <BizInput label={t.business.name} value={s.business.name} onSave={bizField('name')} />
            <BizInput label={t.business.trade} value={s.business.trade} placeholder={t.business.tradePh} onSave={bizField('trade')} />
            <BizInput label={t.business.phone} value={s.business.phone} placeholder={t.business.phonePh} onSave={bizField('phone')} />
            <BizInput label={t.business.email} value={s.business.email} placeholder={t.business.emailPh} onSave={bizField('email')} />
            <BizInput label={t.business.city} value={s.business.city} onSave={bizField('city')} />
            <CostField label={t.business.validDays} help="" unit={es.units.days} value={String(s.business.quoteValidDays)} onSave={bizField('quoteValidDays')} />
          </div>
          <BizInput label={t.business.footer} help={t.business.footerHelp} value={s.business.footer} multiline onSave={bizField('footer')} />
        </Section>
      </div>
    </>
  );
}

function BizInput({ label, value, placeholder, help, multiline, onSave }: { label: string; value: string; placeholder?: string; help?: string; multiline?: boolean; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const id = `biz-${label}`;
  const props = { id, value: v, placeholder, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV(e.target.value), onBlur: () => v !== value && onSave(v) };
  return (
    <Field label={label} help={help} htmlFor={id}>
      {multiline ? <textarea rows={2} {...props} /> : <input {...props} />}
    </Field>
  );
}
