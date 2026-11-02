// Attack strings in every text field are stored and returned as plain text (docs/11 A05).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeHarness, validSpool, type Harness } from '../harness';

let h: Harness;
beforeAll(async () => { h = await makeHarness(); });
afterAll(() => h.close());

const ATTACKS = ["'; DROP TABLE spool; --", '<script>alert(1)</script>', '=HYPERLINK("http://x","y")', '../../etc/passwd', "\" OR 1=1 --", '%_\\'];

describe('injection', () => {
  it.each(ATTACKS)('%s in material, color and brand is kept literally', async (attack) => {
    const r = await h.call('POST', '/api/v1/spools', { body: validSpool({ filament: { material: attack.slice(0, 40), color: `c ${attack}`.slice(0, 120) }, brand: attack.slice(0, 40), note: attack }) });
    expect(r.status).toBe(201);
    const out = r.json.data as { filament: { id: string; material: string; color: string }; spool: { brand: string } };
    expect(out.filament.material).toBe(attack.slice(0, 40).trim().replace(/\s+/g, ' '));
    expect(out.spool.brand).toBe(attack.slice(0, 40).trim().replace(/\s+/g, ' '));
    const d = await h.call('GET', `/api/v1/filaments/${out.filament.id}`);
    expect(JSON.stringify(d.json.data)).toContain(JSON.stringify(out.filament.color).slice(1, -1));
  });

  it('the tables are still there and search treats wildcards as text', async () => {
    const all = await h.call('GET', '/api/v1/filaments?pageSize=200');
    expect((all.json.data as { total: number }).total).toBe(ATTACKS.length);
    expect((await h.call('GET', `/api/v1/filaments?q=${encodeURIComponent("' OR 1=1 --")}`)).status).toBe(200);
    const wild = await h.call('GET', `/api/v1/filaments?q=${encodeURIComponent('%')}`);
    expect((wild.json.data as { total: number }).total).toBe(1);
  });

  it('text over the limits is rejected with the right rule', async () => {
    const r = await h.call('POST', '/api/v1/spools', { body: validSpool({ filament: { material: 'x'.repeat(121), color: 'y' }, note: 'z'.repeat(2001) }) });
    expect(r.status).toBe(422);
    expect(r.json.details?.fields).toEqual(expect.arrayContaining([
      { path: 'filament.material', rule: 'too_long', params: { max: 120 } }, { path: 'note', rule: 'too_long', params: { max: 2000 } },
    ]));
  });
});
