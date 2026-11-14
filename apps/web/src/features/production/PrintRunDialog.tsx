// "Registrar impresión" (mockup printDlg): a run for stock (piece, qty, grams per filament prefilled from the piece × qty)
// or a material test (text, one filament, grams). Also opened from Existencias with the piece already chosen.
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { Field } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { toast } from '../../components/Toast';
import { UnitInput } from '../../components/UnitInput';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { api } from '../../lib/api';
import { errorText } from '../../lib/errors';
import { grams as fmtGrams } from '../../lib/format';
import { parseNumber, todayLocal } from '../../lib/input';
import { keys, usePrinters, useProducts, useSettings } from '../../lib/queries';
import { useFilaments } from '../filament/api';
import { spoolPicks, SpoolUse, type SpoolChoice } from '../filament/SpoolUse';
import { productionApi, type PrintRunInput } from './api';
import { useWriteWithWarnings, warningTexts } from './write';

const L = es.screens.production;
const fmt = (n: number) => String(Math.round(n * 100) / 100);

type Filaments = NonNullable<ReturnType<typeof useFilaments>['data']>['items'];
type Printers = NonNullable<ReturnType<typeof usePrinters>['data']>['items'];
type Products = NonNullable<ReturnType<typeof useProducts>['data']>['items'];
interface Props { productId?: string | undefined; onClose: () => void; onDone?: () => void }

/** Waits for filaments, pieces and printers; without any spool it does not open (NO_SPOOLS, like the mockup). */
export function PrintRunDialog(props: Props) {
  const filaments = useFilaments().data?.items;
  const products = useProducts().data?.items;
  const printers = usePrinters().data?.items;
  const noSpools = filaments !== undefined && !filaments.some((f) => f.spoolCount > 0);
  const { onClose } = props;
  useEffect(() => { if (noSpools) { toast(es.errors.NO_SPOOLS); onClose(); } }, [noSpools, onClose]);
  if (!filaments || !products || !printers || noSpools) return null;
  return <PrintRunForm {...props} filaments={filaments} products={products} printers={printers} />;
}

function PrintRunForm({ productId, onClose, onDone, filaments, products, printers }: Props & { filaments: Filaments; products: Products; printers: Printers }) {
  const withSpools = filaments.filter((f) => f.spoolCount > 0).sort((a, b) => a.material.localeCompare(b.material, 'es') || a.color.localeCompare(b.color, 'es'));
  const noPieces = !products.length;
  const [test, setTest] = useState(noPieces);
  const [pieceId, setPieceId] = useState(productId && products.some((p) => p.id === productId) ? productId : products[0]?.id ?? '');
  const [qty, setQty] = useState('1');
  const [text, setText] = useState('');
  const [testFil, setTestFil] = useState(withSpools[0]?.id ?? '');
  const [testGrams, setTestGrams] = useState('');
  const [result, setResult] = useState<'ok' | 'fail'>('ok');
  const [photo, setPhoto] = useState<{ id: string; url: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  // What the person typed wins only for the piece and quantity it was typed for; otherwise the proposal of the
  // mockup applies: grams = piece × qty, time = hours × qty, the piece's printer.
  const fil = (id: string) => filaments.find((x) => x.id === id);
  const [typed, setTyped] = useState<{ key: string; grams: Record<string, string>; hours?: string }>({ key: '', grams: {} });
  const [printerTyped, setPrinterTyped] = useState<{ pieceId: string; value: string } | null>(null);
  const [testHours, setTestHours] = useState('0');
  // Ronda 4: the spool of each filament (nothing chosen = the automatic order, the suggested spool first).
  const [choices, setChoices] = useState<Record<string, SpoolChoice>>({});
  const purge = useSettings().data?.settings.purgePct ?? 0;
  const choose = (fid: string) => (c: SpoolChoice) => setChoices({ ...choices, [fid]: c });
  const withPicks = (fid: string, g: number) => { const sp = spoolPicks(fil(fid), choices[fid]); return { filamentId: fid, grams: g, ...(sp ? { spools: sp } : {}) }; };

  const piece = useQuery({ queryKey: [...keys.products, 'detail', pieceId], queryFn: async () => (await api.products.get(pieceId)).data, enabled: Boolean(pieceId) }).data;
  const ready = piece && piece.id === pieceId ? piece : undefined;
  const n = Math.max(1, Math.round(parseNumber(qty, 1)));
  const key = `${pieceId}|${n}`;
  const own = typed.key === key ? typed : { key, grams: {} as Record<string, string> };
  const gramsOf = (fid: string) => own.grams[fid] ?? (ready ? fmt((ready.filaments.find((f) => f.filamentId === fid)?.grams ?? 0) * n) : '');
  const hours = test ? testHours : own.hours ?? (ready ? fmt(ready.hours * n) : '0');
  const setHours = (v: string) => (test ? setTestHours(v) : setTyped({ ...own, hours: v }));
  const piecePrinter = ready?.printerId && printers.some((p) => p.id === ready.printerId) ? ready.printerId : '';
  const printerId = (printerTyped && (test || printerTyped.pieceId === pieceId) ? printerTyped.value : '') || piecePrinter || printers[0]?.id || '';

  const switchMode = (toTest: boolean) => { if (toTest !== test) { setTest(toTest); setTestHours('0'); setTyped({ key: '', grams: {} }); } };

  const save = useWriteWithWarnings((input: PrintRunInput) => productionApi.create(input), {
    touches: ['printRuns', 'filaments', 'stock', 'supplies', 'printers', 'purchases', 'home', 'products'],
    ok: (_out, ws, input) => {
      const used = input.filaments.reduce((a, f) => a + f.grams, 0);
      const missing = ws.filter((w) => w.code === 'FILAMENT_SHORTFALL').reduce((a, w) => {
        const d = w.details ?? {};
        const items = Array.isArray(d.items) ? (d.items as { missingGrams?: number }[]) : [d as { missingGrams?: number }];
        return a + items.reduce((x, it) => x + (Number(it.missingGrams) || 0), 0);
      }, 0);
      const head = t(input.reason === 'test' ? 'toast.printRun.testRecorded' : 'toast.printRun.recorded', { grams: fmtGrams(Math.max(0, used - missing)) });
      const after = input.reason === 'test' ? '' : input.result === 'ok'
        ? `${t('screens.production.piecesAdded', { count: input.qty })}${ready && !ready.tracksStock ? ` ${L.nowTracks}` : ''}`
        : L.failedNoAddShort;
      return [head, after, ...warningTexts(ws)].filter(Boolean).join(' ');
    },
    onDone: () => { onDone?.(); onClose(); },
  });

  const submit = () => {
    const base = { on: todayLocal(), printerId: printerId || null, result, hours: Math.max(0, parseNumber(hours)), ...(photo ? { photoFileId: photo.id } : {}) };
    if (test) {
      const g = parseNumber(testGrams);
      if (!text.trim()) { toast(es.fields['printRun.text.required']); return; }
      if (!(g > 0)) { toast(es.fields['spoolMovement.grams.required']); return; }
      save.mutate({ ...base, reason: 'test', text: text.trim(), qty: 1, filaments: [withPicks(testFil, g)] });
      return;
    }
    if (!ready) return;
    const fils = ready.filaments.map((f) => withPicks(f.filamentId, parseNumber(gramsOf(f.filamentId)))).filter((f) => f.grams > 0);
    save.mutate({ ...base, reason: 'stock', productId: ready.id, qty: n, filaments: fils });
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try { const out = (await api.files.upload('print_photo', file)).data; setPhoto({ id: out.fileId, url: out.url }); } catch (e) { toast(errorText(e).text); } finally { setUploading(false); }
  };

  return (
    <Dialog open wide className="sheet r4w" title={L.register} submitLabel={L.register} onClose={onClose} onSubmit={submit} busy={save.isPending}>
      <div className="fld">
        <span>{L.reason}</span>
        <div className="seg wide">
          <label className="rad"><input type="radio" name="motivo" value="inventario" checked={!test} disabled={noPieces} onChange={() => switchMode(false)} /><span>{L.reasonStock}</span></label>
          <label className="rad"><input type="radio" name="motivo" value="prueba" checked={test} onChange={() => switchMode(true)} /><span>{L.reasonTest}</span></label>
        </div>
        <small>{L.reasonHint}</small>
      </div>
      <div hidden={test}>
        {products?.length ? <Field label={L.piece}><select name="prod" value={pieceId} onChange={(e) => setPieceId(e.target.value)}>{products.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}</select></Field> : null}
      </div>
      <div hidden={!test}>
        <Field label={L.testText}><input name="texto" value={text} onChange={(e) => setText(e.target.value)} placeholder={L.testPlaceholder} /></Field>
        <div className="grid2 mt">
          <Field label={L.filament}><select name="fil" value={testFil} onChange={(e) => setTestFil(e.target.value)}>{withSpools.map((f) => <option key={f.id} value={f.id}>{t('screens.production.filamentOption', { name: `${f.material} ${f.color}`, grams: fmtGrams(f.remainingGrams) })}</option>)}</select></Field>
          <Field label={L.gramsUsed}><UnitInput unit="g" name="gt" inputMode="decimal" value={testGrams} onChange={(e) => setTestGrams(e.target.value)} placeholder="0" /></Field>
        </div>
        {test && fil(testFil) ? <div className="mt"><SpoolUse f={fil(testFil)!} grams={parseNumber(testGrams)} purgePct={purge} choice={choices[testFil]} onChange={choose(testFil)} /></div> : null}
      </div>
      <div className="grid3">
        {test ? null : <Field label={L.qty} hint={L.qtyHint}><input name="cant" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} data-autofocus={productId ? '' : undefined} /></Field>}
        {printers.length ? <Field label={L.printer} hint={L.printerHint}><select name="imp" value={printerId} onChange={(e) => setPrinterTyped({ pieceId, value: e.target.value })}>{printers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field> : null}
        <Field label={L.realTime}><UnitInput unit="h" name="horas" inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} /></Field>
      </div>
      <div className="fld">
        <span>{L.result}</span>
        <div className="seg wide">
          <label className="rad"><input type="radio" name="res" value="bien" checked={result === 'ok'} onChange={() => setResult('ok')} /><span>{L.ok}</span></label>
          <label className="rad"><input type="radio" name="res" value="fallo" checked={result === 'fail'} onChange={() => setResult('fail')} /><span>{L.fail}</span></label>
        </div>
      </div>
      <div className="fld" hidden={test}>
        <span>{L.gramsUsed}</span>
        <div id="imp-fil" className="fsecs">
          {ready ? (ready.filaments.length ? ready.filaments.map((f) => {
            const x = fil(f.filamentId);
            const name = x ? `${x.material} ${x.color}` : '';
            const input = <UnitInput unit="g" className="g" inputMode="decimal" value={gramsOf(f.filamentId)} onChange={(e) => setTyped({ ...own, grams: { ...own.grams, [f.filamentId]: e.target.value } })} aria-label={t('screens.production.gramsOf', { name })} />;
            return x ? <SpoolUse key={f.filamentId} f={x} grams={parseNumber(gramsOf(f.filamentId))} purgePct={purge} choice={choices[f.filamentId]} onChange={choose(f.filamentId)} gramsInput={input} /> : null;
          }) : <p className="muted">{L.noPieceFilaments}</p>) : null}
        </div>
        <small>{L.gramsHint}</small>
      </div>
      <div className="fld">
        <span>{L.photoOptional}</span>
        <div className="btnrow">
          <label className="btn sm" htmlFor="run-photo"><Icon name="plus" size={14} />{uploading ? es.common.saving : L.uploadPhoto}</label>
          <input type="file" id="run-photo" accept="image/jpeg,image/png,image/webp" className="sr" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ''; }} />
          {photo ? <Button size="sm" variant="ghost" onClick={() => setPhoto(null)}>{L.removePhoto}</Button> : null}
        </div>
        <small>{photo ? L.photoSaved : L.noPhoto}</small>
      </div>
    </Dialog>
  );
}
