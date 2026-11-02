# PGlite feasibility check (step 1.0)

Disposable. Criteria in `docs/02 §4`; results in `results/*.json` and in `docs/decisiones.md`.

```
pnpm install --ignore-workspace
pnpm generate        # migrations from schema.ts
pnpm bench           # 5 000 and 25 000 sales; needs PG_URL for the Postgres comparison
pnpm crash           # kill -9 during writes, 8 rounds
pnpm rls             # row level security in PGlite and Postgres
cd electron-smoke && pnpm install --ignore-workspace && node node_modules/electron/install.js && pnpm dist
```
