import { PGlite } from '@electric-sql/pglite';
let t = performance.now();
const a = new PGlite(); await a.waitReady; console.log('create', Math.round(performance.now() - t));
await a.exec('create table x (id int); insert into x values (1)');
t = performance.now(); const b = await a.clone(); console.log('clone', Math.round(performance.now() - t), (await b.query('select count(*) from x')).rows);
t = performance.now(); const c = new PGlite(); await c.waitReady; console.log('create2', Math.round(performance.now() - t));
const dump = await a.dumpDataDir('none'); t = performance.now(); const d = new PGlite({ loadDataDir: dump }); await d.waitReady; console.log('load', Math.round(performance.now() - t));
