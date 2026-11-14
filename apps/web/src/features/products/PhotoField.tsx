// Piece photo: the browser shrinks it (longest side ≤ 1 600 px, JPEG) before uploading (docs/07 › Imágenes).
import { useState } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { PieceThumb } from '../../components/PieceThumb';
import { toast } from '../../components/Toast';
import { es } from '../../i18n/es';
import { api } from '../../lib/api';
import { errorText } from '../../lib/errors';

const MAX_SIDE = 1600;

async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', 0.85));
}

export function PhotoField({ fileId, url, hexes, onChange }: { fileId: string | null; url: string | null; hexes: string[]; onChange: (fileId: string | null, url: string | null) => void }) {
  const [busy, setBusy] = useState(false);
  const L = es.screens.calculator;
  return (
    <div className="foto-row">
      <PieceThumb photoUrl={url} hexes={hexes} size={64} />
      <div className="foto-ctl">
        <div className="btnrow">
          <label className="btn sm" htmlFor="pf-file"><Icon name="plus" size={14} />{busy ? es.common.saving : L.uploadPhoto}</label>
          <input type="file" id="pf-file" accept="image/jpeg,image/png,image/webp" className="sr" onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setBusy(true);
            try { const out = (await api.files.upload('product_photo', await shrink(f))).data; onChange(out.fileId, out.url); } catch (err) { toast(errorText(err).text); } finally { setBusy(false); e.target.value = ''; }
          }} />
          {fileId ? <Button size="sm" variant="ghost" onClick={() => onChange(null, null)}>{L.removePhoto}</Button> : null}
        </div>
        <small>{fileId ? L.photoSaved : L.noPhoto}</small>
      </div>
    </div>
  );
}
