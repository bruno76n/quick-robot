import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '@app/db';
import { getCatalog, getSettingsBundle } from '../src/queries/settings';
import { addChannel, ensureWorkspaceDefaults, removeChannel, restoreChannel, updateChannel, updateSettings } from '../src/usecases/settings';
import { addSpool } from '../src/usecases/add-spool';
import { ctxA, ctxB, spoolInput, testDatabase, useCaseDeps } from './helpers';

let database: Database;
beforeAll(async () => {
  database = await testDatabase();
});
afterAll(() => database.close());

describe('settings', () => {
  it('defaults before saving; business name from the workspace', async () => {
    const b = await getSettingsBundle(database.db, ctxA);
    expect(b.settings).toMatchObject({ kwhPriceCents: 300, failurePct: 5, purgePct: 5, minMarginPct: 30, formulaMarginPct: 50 });
    expect(b.settings.business.name).toBe('A');
  });
  it('partial update keeps the rest', async () => {
    const r = await updateSettings(useCaseDeps(database), ctxA, { kwhPriceCents: 350, business: { phone: '33 1234' } });
    expect(r.settings).toMatchObject({ kwhPriceCents: 350, failurePct: 5, business: { name: 'A', phone: '33 1234' } });
    expect((await getSettingsBundle(database.db, ctxB)).settings.kwhPriceCents).toBe(300);
  });
  it('rejects out-of-range values', async () => {
    await expect(updateSettings(useCaseDeps(database), ctxA, { failurePct: 100 })).rejects.toThrow();
  });
});

describe('channels', () => {
  it('add, rename, duplicate names rejected (case/accents insensitive), last channel kept, restore', async () => {
    const deps = useCaseDeps(database);
    const a = await addChannel(deps, ctxA, { name: 'Efectivo' });
    const b = await addChannel(deps, ctxA, { name: 'Mercado Libre', commissionPct: 17 });
    await expect(addChannel(deps, ctxA, { name: '  mercado  libre ' })).rejects.toMatchObject({ code: 'DUPLICATE_NAME' });
    expect((await updateChannel(deps, ctxA, b.id, { name: 'ML', commissionPct: 16 })).name).toBe('ML');
    await removeChannel(deps, ctxA, b.id);
    await expect(removeChannel(deps, ctxA, a.id)).rejects.toMatchObject({ code: 'LAST_CHANNEL' });
    await restoreChannel(deps, ctxA, b.id);
    expect((await getSettingsBundle(database.db, ctxA)).channels.map((c) => [c.name, c.commissionPct])).toEqual([['Efectivo', 0], ['ML', 16]]);
    await expect(updateChannel(deps, ctxB, a.id, { name: 'x' })).rejects.toMatchObject({ code: 'CHANNEL_NOT_FOUND' });
  });
});

describe('catalog', () => {
  it('starts with the generic lists and grows with what is typed in a spool', async () => {
    await database.transaction((tx) => ensureWorkspaceDefaults(tx, ctxA));
    await addSpool(useCaseDeps(database), ctxA, spoolInput({ material: 'PLA Mate', color: 'Verde menta', hex: '#98ff98', brand: 'Kingroon' }));
    const c = await getCatalog(database.db, ctxA);
    expect(c.materials).toContain('PLA');
    expect(c.materials).toContain('PLA Mate');
    expect(c.colors).toContainEqual({ name: 'Verde menta', hex: '#98ff98' });
    expect(c.brands).toContain('Kingroon');
    expect((await getCatalog(database.db, ctxB)).materials).toEqual([]);
  });
});
