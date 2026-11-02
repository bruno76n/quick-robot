// One customer form for the whole app (mockup clienteDlg): from Clientes, from the builder and from a sale.
import { DEFAULT_CUSTOMER_TYPES } from '@app/core';
import { useState } from 'react';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { Field } from '../../components/Field';
import { toast } from '../../components/Toast';
import { es } from '../../i18n/es';
import { api } from '../../lib/api';
import { errorText } from '../../lib/errors';
import { useWrite } from '../../lib/mutate';
import { customersApi, type CustomerDetail, type CustomerView } from './api';

const L = es.screens.customers;
const MAX_SIDE = 160;

/** Shrinks the logo in the browser (longest side 160 px, PNG) before uploading; SVG is drawn to a bitmap too. */
function shrinkLogo(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('read')); };
    im.onload = () => {
      const iw = im.naturalWidth || MAX_SIDE, ih = im.naturalHeight || MAX_SIDE, k = Math.min(1, MAX_SIDE / Math.max(iw, ih));
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(iw * k)); cv.height = Math.max(1, Math.round(ih * k));
      cv.getContext('2d')!.drawImage(im, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      cv.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), 'image/png');
    };
    im.src = url;
  });
}

export function CustomerDialog({ customer, initialName = '', onClose, onSaved }: { customer?: CustomerView | null; initialName?: string; onClose: () => void; onSaved?: (c: CustomerDetail) => void }) {
  const c = customer ?? null;
  const [name, setName] = useState(c?.name ?? initialName);
  const [type, setType] = useState(c?.type ?? DEFAULT_CUSTOMER_TYPES[0]);
  const [phone, setPhone] = useState(c?.phone ?? '');
  const [note, setNote] = useState(c?.note ?? '');
  const [logo, setLogo] = useState<{ fileId: string | null; url: string | null }>({ fileId: c?.logoFileId ?? null, url: c?.logoUrl ?? null });
  const [received, setReceived] = useState(Boolean(c?.hasLogo && !c.logoFileId));
  const [busyLogo, setBusyLogo] = useState(false);
  const [nameError, setNameError] = useState<string | undefined>();
  const types: string[] = (DEFAULT_CUSTOMER_TYPES as readonly string[]).includes(type) ? [...DEFAULT_CUSTOMER_TYPES] : [...DEFAULT_CUSTOMER_TYPES, type];
  const save = useWrite((input: { name: string; type: string; phone: string; note: string; logoFileId: string | null; hasLogo: boolean }) => (c ? customersApi.update(c.id, input) : customersApi.create(input)), {
    touches: ['customers', 'sales', 'orders', 'search'],
    ok: () => es.toast['customer.saved'],
    onDone: (out) => (onSaved ? onSaved(out) : onClose()),
  });
  const removeSaved = useWrite((id: string) => customersApi.removeLogo(id), { touches: ['customers'], ok: () => es.toast['customer.logoRemoved'] });
  const submit = () => {
    if (!name.trim()) { setNameError(es.fields['customer.name.required']); return; }
    save.mutate({ name: name.trim(), type, phone: phone.trim(), note: note.trim(), logoFileId: logo.fileId, hasLogo: Boolean(logo.fileId) || received });
  };
  const removeLogo = () => {
    if (c?.logoFileId && logo.fileId === c.logoFileId) removeSaved.mutate(c.id);
    setLogo({ fileId: null, url: null });
  };
  return (
    <Dialog open title={c ? L.dlgEdit : L.dlgNew} onClose={onClose} onSubmit={submit} submitLabel={c ? L.saveEdit : L.saveNew} busy={save.isPending}>
      <div className="grid2">
        <Field label={L.name} error={nameError}><input name="nombre" required value={name} placeholder={L.namePlaceholder} onChange={(e) => { setName(e.target.value); setNameError(undefined); }} /></Field>
        <Field label={L.type}><select name="tipo" value={type} onChange={(e) => setType(e.target.value)}>{types.map((x) => <option key={x}>{x}</option>)}</select></Field>
      </div>
      <div className="mt"><Field label={L.phone}><input name="tel" value={phone} placeholder={L.phonePlaceholder} onChange={(e) => setPhone(e.target.value)} /></Field></div>
      <fieldset className="blk">
        <legend>{L.logoLegend}</legend>
        <div className="logo-row">
          <div className="lg-prev" id="cl-prev">{logo.url ? <img src={logo.url} alt={L.logoAlt} /> : <span className="mut">{L.noImage}</span>}</div>
          <div className="lg-ctl">
            <label className="btn sm" htmlFor="cl-file">{busyLogo ? es.common.saving : L.upload}</label>
            <input type="file" id="cl-file" accept="image/*" className="sr" onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > 8e6) { toast(L.imageTooBig); e.target.value = ''; return; }
              setBusyLogo(true);
              try { const out = (await api.files.upload('customer_logo', await shrinkLogo(f))).data; setLogo({ fileId: out.fileId, url: out.url }); } catch (err) { toast(errorText(err).text); } finally { setBusyLogo(false); e.target.value = ''; }
            }} />
            {logo.fileId ? <Button size="sm" variant="ghost" id="cl-quitar" onClick={removeLogo}>{L.removeImage}</Button> : null}
            <small className="hint">{L.logoHint}</small>
          </div>
        </div>
        <label className="chk mt"><input type="checkbox" name="logo" checked={received} onChange={(e) => setReceived(e.target.checked)} /><span>{L.logoReceived}</span><small>{L.logoReceivedHint}</small></label>
      </fieldset>
      <div className="mt"><Field label={L.notes}><textarea name="nota" rows={2} value={note} placeholder={L.notesPlaceholder} onChange={(e) => setNote(e.target.value)} /></Field></div>
    </Dialog>
  );
}
