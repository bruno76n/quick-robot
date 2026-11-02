// Helpers for the order flows (docs/06 §17 B, C, D): seeded ids and creating an order through the API.
import { expect, type APIRequestContext } from '@playwright/test';

export async function api<T>(request: APIRequestContext, base: string, method: string, path: string, body?: unknown): Promise<T> {
  const res = await request.fetch(`${base}/api/v1${path}`, { method, ...(body === undefined ? {} : { data: body }) });
  expect(res.ok(), `${method} ${path} → ${res.status()} ${await res.text()}`).toBeTruthy();
  return (await res.json()).data as T;
}

export interface Seed { channelId: string; customerId: string; customerName: string; products: Map<string, { id: string; free: number; reserved: number; physical: number; listCents: number }> }

export async function seed(request: APIRequestContext, base: string): Promise<Seed> {
  const settings = await api<{ channels: { id: string; name: string }[] }>(request, base, 'GET', '/settings');
  const customers = await api<{ id: string; name: string }[] | { items: { id: string; name: string }[] }>(request, base, 'GET', '/customers');
  const list = Array.isArray(customers) ? customers : customers.items;
  const products = await api<{ items: { id: string; name: string; free: number; reserved: number; physical: number; listCents: number }[] }>(request, base, 'GET', '/products');
  const c = list.find((x) => x.name === 'Cafetería Alma') ?? list[0]!;
  return { channelId: settings.channels[0]!.id, customerId: c.id, customerName: c.name, products: new Map(products.items.map((p) => [p.name, p])) };
}

export const isoDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

export async function createOrder(request: APIRequestContext, base: string, s: Seed, input: { accepted: boolean; items: { name: string; qty: number; fromStock?: number }[]; depositCents?: number }) {
  return api<{ id: string; number: number }>(request, base, 'POST', '/orders', {
    customerId: s.customerId, channelId: s.channelId, createdOn: isoDays(0), dueOn: isoDays(5), accepted: input.accepted, note: '',
    ...(input.depositCents ? { depositCents: input.depositCents } : {}),
    items: input.items.map((it) => {
      const p = s.products.get(it.name)!;
      return { kind: 'piece', productId: p.id, qty: it.qty, priceCents: p.listCents, ...(it.fromStock ? { fromStock: { [p.id]: it.fromStock } } : {}) };
    }),
  });
}
