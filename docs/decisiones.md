# Decisiones tomadas durante la construcción

Registro que llena Claude Code en modo autónomo. Una entrada por decisión. No se borra nada.

Formato:

```
## AAAA-MM-DD · Fase N · Paso N.N · Título corto
- Situación: qué no estaba claro o qué falló.
- Opciones consideradas.
- Decisión y por qué (qué regla de CLAUDE.md la respalda).
- Impacto: archivos o documentos afectados.
```

---

## 2026-11-01 · Planeación · Decisiones previas a la construcción
Ver `01-vision-y-decisiones.md` (D1–D19).

## 2026-11-02 · Fase 1 · Paso 1.0 · Comprobación de PGlite: PASA
- Situación: criterios de `02 §4` para confirmar Postgres en ambos modos.
- Medido (PGlite 0.5.10 = Postgres 18.6 en WASM; Postgres 16.15 nativo como "Postgres normal"; Linux x64, 4 CPU):
  1. Mismas migraciones Drizzle (`spikes/pglite/migrations/`) aplicadas sin cambios en PGlite y en Postgres 16 → **pasa**.
  2. Reporte "ventas por pieza, 12 meses" con 5 000 ventas / 10 003 artículos, archivo en disco: p50 52.5 ms, p95 82.4 ms, máx 95 ms (Postgres nativo: p50 30.9 ms) → **pasa** (< 200 ms).
  3. 8 rondas de `kill -9` mientras escribe transacciones de 100 filas: 0 lotes a medias, todo lo confirmado presente, índice y tabla coinciden → **pasa**.
  4. PGlite dentro de Electron 38.8.6 empaquetado con asar (`@electron/packager`, Linux x64): abre, migra, escribe, relee en una segunda apertura → **pasa en Linux**. El empaquetado para Mac no se pudo ejecutar en este entorno (sin macOS); queda para revisión en la fase 4.
  5. RLS con política `workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid`, `FORCE ROW LEVEL SECURITY` y rol `app_user` (`SET LOCAL ROLE`): A no ve, no modifica ni inserta en B; sin el ajuste no se ve nada → **pasa** en PGlite y Postgres.
- Observaciones: la primera creación del archivo de datos tarda ~6–8 s (initdb dentro de WASM); reabrir tarda ~0.6 s. Conviene, en la fase 4, mostrar "Preparando datos…" en el primer arranque o partir de una base precreada (`loadDataDir`).
- Decisión: se mantiene **Postgres en ambos modos (PGlite en local)**; el plan B (SQLite) no se aplica. RLS queda viable como segunda barrera; en la fase 1 se usa solo el filtro por `workspace_id` en repositorios (la primera barrera), y la RLS se activa en la fase 5 como dice `05`.
- Impacto: `spikes/pglite/`, `docs/informe-fase-1.md`.

## 2026-11-02 · Fase 1 · Rama de trabajo
- Situación: `CLAUDE.md` pide una rama `fase-1`; el entorno de esta ejecución solo permite publicar en `claude/wizardly-fermi-3ur0nk`.
- Opciones: publicar `fase-1` (no permitido aquí) o trabajar en la rama asignada.
- Decisión: los commits se hacen en `claude/wizardly-fermi-3ur0nk` y se crea además la rama local `fase-1` apuntando al mismo commit final. Al fusionar, la rama asignada equivale a `fase-1`.
- Impacto: ninguno en el código.

## 2026-11-02 · Fase 1 · Paso 1.0 · Versiones de herramientas
- Situación: el stack está fijado por nombre, no por versión.
- Decisión: versiones exactas (sin `^`), elegidas entre las publicadas hace más de dos semanas y con API conocida: TypeScript 5.9, Vite 7, Vitest 3, ESLint 9, React 19.1, Tailwind 4, Zod 4, Hono 4, Drizzle 0.45, PGlite 0.5.10, Electron 38 (solo en el spike). Regla más simple que respeta CLAUDE.md (no cambia herramientas).
- Impacto: `package.json` de cada paquete.

## 2026-11-02 · Fase 1 · Paso 1.1 · Nombres de paquetes, Vitest y prueba negativa
- Situación: `10` pide `vitest.workspace.ts`; en Vitest 3.2 ese archivo está obsoleto y se reemplaza por `test.projects`. Los paquetes necesitan un alcance (`@…/core`) y el nombre comercial está abierto (O7).
- Decisión: (a) `vitest.config.ts` en la raíz con `projects: ['packages/*', 'tools']` (mismo efecto, sin aviso de obsoleto). (b) Alcance neutro `@app/*` (`@app/core`, `@app/contract`, `@app/db`, `@app/server`, `@app/web`), para no meter "Quick Robot" en el código (regla 6). (c) La prueba negativa vive en `tools/boundaries/`: archivos de ejemplo que rompen cada flecha se pasan por ESLint "como si" estuvieran en el paquete prohibido, y un archivo sonda se pasa por dependency-cruiser; ambas pruebas exigen el error. Corre dentro de `pnpm test`. (d) Además de las flechas, el lint prohíbe en `core` y en `usecases` comparar contra `'cloud'`/`'local'`, en `core` usar `Date`/`crypto` globales, en `server` importar `drizzle-orm`/`pg`/PGlite (solo `db` escribe SQL) y en `apps/web` texto suelto en JSX (va en `i18n/es.ts`).
- Impacto: `eslint.config.js`, `.dependency-cruiser.cjs`, `vitest.config.ts`, `tools/boundaries/`.
