import { useState } from 'react';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { Field } from '../../components/Field';
import { useToast } from '../../components/Toast';
import { UnitInput } from '../../components/UnitInput';
import { es } from '../../i18n/es';
import { formatMoney0 } from '../../lib/format';
import { numFromText } from '../../lib/numbers';

const t = es.quote;

/** "Cotizar a cliente": a message to paste in WhatsApp. No cost or margin, only what the customer sees. */
export function QuoteDialog({ name, price, colors, attends, onClose }: { name: string; price: number; colors: string[]; attends: string; onClose: () => void }) {
  const toast = useToast((s) => s.show);
  const [f, setF] = useState({ qty: '1', price: price ? String(price) : '', days: '5', attends });
  const qty = Math.max(1, Math.round(numFromText(f.qty, 1)));
  const p = numFromText(f.price);
  const text = t.text({ name: name || t.pieceFallback, qty, price: formatMoney0(p), total: formatMoney0(qty * p), days: numFromText(f.days, 5), colors: colors.map((c) => c.toLowerCase()).join(t.and), attends: f.attends });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const copy = async () => {
    await navigator.clipboard?.writeText(text).catch(() => undefined);
    toast(t.copied);
    onClose();
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t.title}
      onSubmit={(e) => (e.preventDefault(), void copy())}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {es.app.cancel}
          </Button>
          <Button variant="primary" type="submit">
            {t.submit}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-x-[14px] gap-y-3 max-[560px]:grid-cols-1">
        <Field label={t.qty} htmlFor="q-n">
          <input id="q-n" inputMode="numeric" value={f.qty} onChange={set('qty')} data-autofocus="" />
        </Field>
        <Field label={t.price} htmlFor="q-p">
          <UnitInput id="q-p" unit={es.units.money} inputMode="decimal" value={f.price} onChange={set('price')} />
        </Field>
        <Field label={t.delivery} htmlFor="q-e">
          <UnitInput id="q-e" unit={es.units.days} inputMode="numeric" value={f.days} onChange={set('days')} />
        </Field>
        <Field label={t.attends} htmlFor="q-a">
          <input id="q-a" value={f.attends} onChange={set('attends')} />
        </Field>
      </div>
      <Field label={t.message} help={t.messageHelp} htmlFor="q-txt">
        <textarea id="q-txt" rows={8} readOnly value={text} />
      </Field>
    </Dialog>
  );
}
