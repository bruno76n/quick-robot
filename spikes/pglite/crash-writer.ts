// Child process for crash-test.ts: writes 100-row transactions forever, printing each committed batch.
import { randomUUID } from 'node:crypto';
import { openPglite } from './db.ts';

const dataDir = process.argv[2]!;
const { client } = await openPglite(dataDir);
const ws = '00000000-0000-7000-8000-00000000000a';
await client.query(`insert into workspace (id, name) values ($1, 'A') on conflict do nothing`, [ws]);
let batch = (await client.query<{ m: number }>('select coalesce(max(seq), -1)::int + 1 as m from spool_movement')).rows[0]!.m;
console.log('READY');
for (;;) {
  await client.transaction(async (tx) => {
    const values: string[] = [];
    for (let i = 0; i < 100; i++) values.push(`('${randomUUID()}','${ws}','${ws}','2026-01-01','consumption',-1.5,${batch})`);
    await tx.query(`insert into spool_movement (id, workspace_id, spool_id, "on", kind, grams, seq) values ${values.join(',')}`);
  });
  console.log(`COMMIT ${batch}`);
  batch++;
}
