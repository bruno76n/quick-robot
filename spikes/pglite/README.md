# Spike: PGlite (paso 1.0) — desechable

Comprobación de los criterios de `docs/02 §4`. Se puede borrar sin afectar nada.

```
pnpm install --ignore-workspace
npx drizzle-kit generate          # migrations/ (ya generadas)
npx tsx bench.ts                  # criterios 1 y 2 (necesita Postgres en PG_URL para el 1)
npx tsx crash-test.ts             # criterio 3
npx tsx rls-test.ts               # criterio 5
cd electron-smoke && npm install && npm run package && \
  SMOKE_OUT=$PWD/../results/electron-smoke.json xvfb-run -a ./out/pglite-smoke-linux-x64/pglite-smoke --no-sandbox   # criterio 4
```

Resultados medidos en `results/*.json`; resumen en `docs/decisiones.md` y `docs/informe-fase-1.md`.
