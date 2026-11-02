// The development seed reproduces the figures of the mockup's Filamentos screen.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyDevelopmentSeed } from '../src/dev-seed';
import { makeHarness, type Harness } from './harness';

let h: Harness;
beforeAll(async () => { h = await makeHarness(); });
afterAll(() => h.close());

describe('development seed', () => {
  it('7 filaments · 8 spools · 4.9 kg · value $2,044, and the same per-filament figures as the mockup', async () => {
    expect(await applyDevelopmentSeed(h.deps, h.A)).toBe(true);
    const r = await h.call('GET', '/api/v1/filaments?pageSize=200');
    const items = (r.json.data as { items: { material: string; color: string; remainingGrams: number; spools: number; costPerGram: number; status: string; valueCents: number; brands: string[] }[] }).items;
    expect(items).toHaveLength(7);
    expect(items.reduce((a, f) => a + f.spools, 0)).toBe(8);
    expect(Math.round(items.reduce((a, f) => a + f.remainingGrams, 0) / 100) / 10).toBe(4.9);
    expect(Math.round(items.reduce((a, f) => a + f.valueCents, 0) / 100)).toBe(2044);
    const by = Object.fromEntries(items.map((f) => [`${f.material} ${f.color}`, f]));
    expect(by['PETG Negro']).toMatchObject({ remainingGrams: 800, status: 'ok', brands: ['Sunlu'] });
    expect(by['PLA Blanco']).toMatchObject({ remainingGrams: 1720, spools: 2 });
    expect(by['PLA Silk Morado']).toMatchObject({ remainingGrams: 85, status: 'ending' });
    expect(by['TPU 95A Azul']).toMatchObject({ remainingGrams: 300, status: 'low' });
    expect(by['PLA Blanco']!.costPerGram.toFixed(2)).toBe('0.38');
    expect(by['TPU 95A Azul']!.costPerGram.toFixed(2)).toBe('0.86');
  });

  it('does nothing when there is data already', async () => {
    expect(await applyDevelopmentSeed(h.deps, h.A)).toBe(false);
  });
});
