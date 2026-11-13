// Two workspaces loaded with the mockup example data, and a lookup of their ids by name.
import type { Ctx } from '@app/db';
import { applyDevelopmentSeed } from '../src/dev-seed';
import { makeHarness, type Harness } from './harness';

export interface Ids {
  filament: Record<string, string>; spool: string; supplier: Record<string, string>; supply: Record<string, string>;
  printer: Record<string, string>; task: string; product: Record<string, string>; collection: Record<string, string>; channel: Record<string, string>; file: string;
  customer: Record<string, string>; order: Record<number, string>; sale: string; salePayment: string; saleWithPayment: string; orderPayment: string; orderWithPayment: string;
  printRun: string; expense: string; queue: { printerId: string; entryId: string };
}

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82]);

export async function idsOf(h: Harness, token: string): Promise<Ids> {
  const get = async (p: string) => (await h.call('GET', p, { token })).json.data as never;
  const byName = <T extends { id: string }>(items: T[], key: (x: T) => string) => Object.fromEntries(items.map((x) => [key(x), x.id]));
  const fil = (await get('/api/v1/filaments?pageSize=200') as { items: { id: string; material: string; color: string }[] }).items;
  const detail = await get(`/api/v1/filaments/${fil[0]!.id}`) as { spools: { id: string }[] };
  const printers = (await get('/api/v1/printers') as { items: { id: string; name: string; maintenance: { id: string }[]; queue: { id: string }[] }[] }).items;
  const settings = await get('/api/v1/settings') as { channels: { id: string; name: string }[] };
  const fd = new FormData();
  fd.set('kind', 'product_photo');
  fd.set('file', new Blob([PNG], { type: 'image/png' }), 'x.png');
  const up = await h.app.request('http://127.0.0.1/api/v1/files', { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: fd });
  return {
    filament: byName(fil, (f) => `${f.material} ${f.color}`), spool: detail.spools[0]!.id,
    supplier: byName(await get('/api/v1/suppliers') as { id: string; name: string }[], (s) => s.name),
    supply: byName((await get('/api/v1/supplies') as { items: { id: string; name: string }[] }).items, (s) => s.name),
    printer: byName(printers, (p) => p.name), task: printers[0]!.maintenance[0]!.id,
    product: byName((await get('/api/v1/products/options') as { items: { id: string; name: string }[] }).items, (p) => p.name),
    collection: byName((await get('/api/v1/collections') as { items: { id: string; name: string }[] }).items, (c) => c.name),
    channel: byName(settings.channels, (c) => c.name),
    file: ((await up.json()) as { data: { fileId: string } }).data.fileId,
    ...(await sellIds(get, printers)),
  };
}

async function sellIds(get: (p: string) => Promise<never>, printers: { id: string; queue?: { id: string }[] }[]) {
  const customers = await get('/api/v1/customers') as { id: string; name: string }[];
  const orders = (await get('/api/v1/orders?pageSize=200') as { items: { id: string; number: number; paidCents: number }[] }).items;
  const sales = (await get('/api/v1/sales?pageSize=200') as { items: { id: string; owedCents: number }[] }).items;
  const withPay = orders.find((o) => o.paidCents > 0)!;
  const od = await get(`/api/v1/orders/${withPay.id}`) as { payments: { id: string }[] };
  const sp = sales.find((x) => x.owedCents > 0)!;
  const sd = await get(`/api/v1/sales/${sp.id}`) as { payments: { id: string }[] };
  const runs = (await get('/api/v1/print-runs') as { items: { id: string }[] }).items;
  const exp = (await get('/api/v1/expenses') as { items: { id: string }[] }).items;
  const pq = printers.find((p) => p.queue?.length)!;
  return {
    customer: Object.fromEntries(customers.map((c) => [c.name, c.id])), order: Object.fromEntries(orders.map((o) => [o.number, o.id])) as Record<number, string>,
    sale: sales[0]!.id, saleWithPayment: sp.id, salePayment: sd.payments[0]!.id, orderWithPayment: withPay.id, orderPayment: od.payments[0]!.id,
    printRun: runs[0]!.id, expense: exp[0]!.id, queue: { printerId: pq.id, entryId: pq.queue![0]!.id },
  };
}

export async function seededHarness() {
  const h = await makeHarness();
  await applyDevelopmentSeed(h.deps, h.A);
  await applyDevelopmentSeed(h.deps, h.B);
  return { h, a: await idsOf(h, 'token-a'), b: await idsOf(h, 'token-b') };
}
export type Seeded = Awaited<ReturnType<typeof seededHarness>>;
export const first = (r: Record<string, string>) => Object.values(r)[0]!;
export type { Ctx };
