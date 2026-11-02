import { useNavigate, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import type { Filament, Spool } from '@app/contract';
import { PageHeader } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Pill } from '../../components/Pill';
import { Table, Td, Th, Tr } from '../../components/Table';
import { es } from '../../i18n/es';
import { errorText } from '../../lib/error-text';
import { formatGrams, formatMoney, formatMoney0, formatNumber1 } from '../../lib/format';
import { useFilaments } from './api';
import { FilamentDrawer } from './FilamentDrawer';
import { SpoolDialog } from './SpoolDialog';
import { filamentName } from './names';

const t = es.filament;

function Row({ f, selected, onOpen }: { f: Filament; selected: boolean; onOpen: () => void }) {
  return (
    <Tr selected={selected} onActivate={onOpen} data-testid="filament-row">
      <Td>
        <div className="flex items-center gap-[10px]">
          <span className="sw" style={{ background: f.hex }} />
          <div>
            <b>{filamentName(f)}</b>
            <small className="block">{f.activeSpoolCount ? t.rowSub(f.activeSpoolCount, f.brands.map((b) => b || t.noBrand).join(', ')) : t.noMaterial}</small>
          </div>
        </div>
      </Td>
      <Td align="right" className="num">
        {formatMoney(f.costPerGram)}
      </Td>
      <Td className="whitespace-nowrap">
        <span className={f.tone === 'bad' ? 'stk low mr-[10px]' : 'stk mr-[10px]'}>
          <i style={{ width: `${f.fillPct}%` }} />
        </span>
        <span className="num">{formatGrams(f.remainingGrams)}</span>
      </Td>
      <Td>
        <Pill tone={f.tone}>{t.status[f.status]}</Pill>
      </Td>
    </Tr>
  );
}

export function FilamentList() {
  const { data, error, isPending, refetch } = useFilaments();
  const search = useSearch({ from: '/filamentos' });
  const navigate = useNavigate({ from: '/filamentos' });
  const [dialog, setDialog] = useState<{ open: boolean; filamentId?: string; spool?: Spool }>({ open: false });
  const openDrawer = (id: string | undefined) => void navigate({ search: id ? { f: id } : {}, replace: !id });

  const totals = data?.totals;
  return (
    <>
      <PageHeader
        title={t.title}
        sub={totals ? t.summary(totals.filaments, totals.spools, formatNumber1(totals.remainingGrams / 1000), formatMoney0(totals.valueCents / 100)) : undefined}
        actions={
          <Button variant="primary" onClick={() => setDialog({ open: true })}>
            <Icon name="plus" size={16} />
            {t.addSpool}
          </Button>
        }
      />
      {isPending ? (
        <p className="text-ink-2">{es.app.loading}</p>
      ) : error ? (
        <p className="text-red-ink" role="alert">
          {errorText(error)}{' '}
          <Button variant="link" onClick={() => void refetch()}>
            {es.app.retry}
          </Button>
        </p>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t.col.filament}</Th>
              <Th align="right">{t.col.perGram}</Th>
              <Th>{t.col.available}</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {data.items.length ? (
              data.items.map((f) => <Row key={f.id} f={f} selected={search.f === f.id} onOpen={() => openDrawer(f.id)} />)
            ) : (
              <tr>
                <td colSpan={4} className="px-3 py-9 text-center text-ink-2">
                  <p className="mb-[14px] mt-2">{t.empty}</p>
                  <Button variant="primary" onClick={() => setDialog({ open: true })}>
                    {t.addFirstSpool}
                  </Button>
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      )}
      <FilamentDrawer
        filamentId={search.f}
        onClose={() => openDrawer(undefined)}
        onAddSpool={(id) => setDialog({ open: true, filamentId: id })}
        onEditSpool={(id, spool) => setDialog({ open: true, filamentId: id, spool })}
      />
      <SpoolDialog
        open={dialog.open}
        {...(dialog.filamentId ? { filamentId: dialog.filamentId } : {})}
        {...(dialog.spool ? { spool: dialog.spool } : {})}
        filaments={data?.items ?? []}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        onAdded={(id) => openDrawer(id)}
      />
    </>
  );
}
