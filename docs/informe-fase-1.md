# Informe · Fase 1 · Cimientos y esqueleto que camina

**Estado:** terminada, lista para fusionar. Todo en verde: `pnpm test` (58 pruebas), `pnpm lint`, `pnpm typecheck` y `pnpm e2e` (1 flujo).
**Rama:** `claude/wizardly-fermi-3ur0nk` (y `fase-1` local en el mismo commit; ver decisiones).
**Criterio de terminado de `10`:** se agrega un rollo en el navegador y queda guardado en el archivo local ✔ · pruebas de `core` y de aislamiento pasan ✔ · el lint rechaza una frontera rota ✔.

---

## 1. Lo que se hizo (un commit por paso)

| Paso | Commit | Qué quedó |
|---|---|---|
| — | `docs: add project documentation…` / `chore: add mockup reference` | Documentación y `reference/Quick Robot mockup.html` (sin modificar) |
| 1.0 | `chore(spike): PGlite feasibility check…` | `spikes/pglite/`: esquema, migraciones, carga de 5 000 ventas, consulta de reportes, benchmark, prueba de cierre forzado, RLS y prueba de humo en Electron empaquetado. Resultados en `spikes/pglite/results/*.json` |
| 1.1 | `build: pnpm monorepo…` | pnpm workspaces, TS estricto, ESLint con fronteras, dependency-cruiser, Vitest (proyectos), CI, prueba negativa de fronteras |
| 1.2 | `feat(core): money helpers and filament rules…` | `money.ts`, `filament.ts` (+ `catalog.ts` en 1.6) con casos 1.1 y 1.2 |
| 1.3 | `feat(contract): zod schemas…` | Esquemas de filamento/rollo/movimiento, entrada de `addSpool`, códigos de error → HTTP |
| 1.4 | `feat(db): workspace, user, membership, filament, spool…` | Esquema Drizzle, migración `0000_init.sql`, repositorios con `ctx`, `connectPglite()`/`connectPostgres()`, prueba de aislamiento |
| 1.5 | `feat(server): createApp with injected deps…` | `createApp(deps)`, proveedores locales (auth fija con secreto opcional, archivos en disco, sin límites, correo nulo, reloj), middleware de sesión y errores, caso de uso `addSpool` en una transacción, rutas `/api/v1/filaments` y `/workspace` |
| 1.6 | `feat(web): Vite + React app shell…` | Tokens, componentes (Button, Field, UnitInput, Dialog, Drawer, Toast, Table, Pill, Segmented, AppShell), cliente tipado, `platform.ts`, `i18n/es.ts`, pantalla **Filamentos** (lista, cajón, "Agregar rollo") |
| 1.7 | `feat(dev): mockup development seed, local runner…` | Semilla con los datos del mockup, `pnpm dev` / `dev:file` / `start`, prueba E2E con reinicio, ajustes de la comparación visual |

## 2. Resultados medidos de PGlite (paso 1.0)

Entorno: Linux x64, 4 CPU, Node 22. PGlite 0.5.10 (= PostgreSQL 18.6 en WASM). "Postgres normal": PostgreSQL 16.15 nativo.

| # | Criterio (`02 §4`) | Resultado | Dato medido |
|---|---|---|---|
| 1 | Mismas migraciones en PGlite y Postgres | **Pasa** | La misma carpeta de migraciones Drizzle se aplica sin cambios en ambos (también en `packages/db/test/migrations.test.ts` cuando hay `PG_URL`; el CI levanta Postgres 16) |
| 2 | Reporte "ventas por pieza, 12 meses", ~5 000 ventas, < 200 ms | **Pasa** | 5 000 ventas / 10 003 artículos, archivo en disco: **p50 52.5 ms, p95 82.4 ms, máx 95 ms** (50 corridas). Reabierto en frío: p50 49.4 ms. Postgres nativo: p50 30.9 ms. Serie mensual: p50 26.9 ms |
| 3 | Cierre forzado no corrompe | **Pasa** | 8 rondas de `kill -9` a mitad de escrituras (transacciones de 100 filas, hasta 171 200 filas): 0 lotes a medias, todo lo confirmado presente, conteo por índice = conteo por tabla |
| 4 | PGlite dentro de Electron empaquetado | **Pasa en Linux** | Electron 38.8.6 empaquetado con asar: abre, migra, escribe y en la segunda apertura relee (1 → 2 filas). Primera apertura 7.8 s (crea la base), segunda 0.6 s. **No se pudo probar el empaquetado para Mac** (no hay macOS aquí) |
| 5 | RLS | **Pasa** | Con `FORCE ROW LEVEL SECURITY`, rol `app_user` y `set_config('app.workspace_id')`: A no ve, no modifica ni inserta en B; sin el ajuste no ve nada. Igual en PGlite y Postgres |

**Conclusión:** se mantiene Postgres en ambos modos (PGlite en local). El plan B (SQLite) no hizo falta.
**Otros tiempos:** crear la base por primera vez ~5–8 s (initdb dentro de WASM); reabrir ~0.6 s; arrancar el servidor local con semilla ~3–5 s.

## 3. Pruebas

| Suite | Pruebas | Qué cubre |
|---|---|---|
| `core` | 23 | Caso **1.1** ($0.54), caso **1.2** (47.6 g consumo + 2.4 g purga, inventario 0, faltan 55 g), orden de rollos, último precio cuando no queda, faltante, estados, identidad "PLA  negro" = "pla Negro", dinero (redondeo, centavos, formato es-MX), catálogo |
| `contract` | 3 | Validación de `addSpool` (centavos enteros, gramos con un decimal, fechas), errores → HTTP |
| `db` | 10 | **Aislamiento** (`tenancy.test.ts`): con la sesión de A nunca se lee ni se modifica nada de B (listas, búsqueda por nombre, detalle, sumas, movimientos, insertar rollo o movimiento en B, restaurar); repositorio sin `workspaceId` falla antes de tocar SQL. Migraciones en PGlite y Postgres |
| `server` | 11 | `addSpool`: crea filamento + rollo + movimiento `purchase`; "pla  blanco" se une a PLA Blanco con costo ponderado; entradas inválidas; límites del plan; **atomicidad** (si falla a la mitad no queda nada); escribe solo en su negocio. Integración HTTP **"agregar rollo → aparece en la lista"**, 422 con `VALIDATION_FAILED`, 404 entre negocios, secreto de arranque |
| `tools` | 11 | **Prueba negativa de fronteras**: 8 archivos que rompen una flecha (core→db, core→Node, web→db, web→server, server→SQL, db→core, contract→core, `if (mode === 'cloud')` en un caso de uso) deben fallar en ESLint; 2 sondas en dependency-cruiser; 1 flecha permitida (web→core/contract) debe pasar |
| `e2e` (Playwright) | 1 | En el navegador contra el servidor local con archivo PGlite: lista con las cifras del mockup → error "Elige el material y el color del rollo." → nuevo filamento PETG Verde ($0.45/g) → aviso y cajón → segundo rollo de PLA Blanco desde el cajón (3 rollos, 2,720 g) → **reinicio del servidor** → los datos siguen ahí |

**Prueba negativa desde la terminal** (además de la automática): se agregó `packages/core/src/__boundary_probe.ts` con `import { connectPglite } from '@app/db'` y `pnpm lint` falló (exit 1) con
`'@app/db' import is restricted… packages/core imports nothing: pure functions only (docs/03)  no-restricted-imports`;
dependency-cruiser también (exit 1): `error core-imports-nothing: packages/core/src/__boundary_probe.ts → @app/db`. Se borró la sonda y el lint volvió a verde.

## 4. Comparación visual de Filamentos

`tools/visual/compare-filaments.mjs` toma capturas del mockup y de la app (lista, cajón y diálogo) en 1440, 820 y 390 px. Resultado: misma estructura, textos, colores, tipografía, cifras (7 filamentos · 8 rollos · 4.9 kg · $2,044; costos por gramo, barras y estados idénticos) y comportamiento (cajón con Esc, foco en Material, nota "Se suma a…/Filamento nuevo…", vista previa del costo por gramo, aviso al guardar). Diferencias corregidas en el camino: borde bajo la última fila, rayas en la barra de existencias, foco inicial y ancho del campo Color.
Diferencias que quedan **a propósito**: marca del negocio (inicial en lugar de la mascota, sin "Impresión 3D" todavía), botones de fase 2/3 deshabilitados, y campos con sugerencias en lugar de `<select>`. Por eso la fila de `progreso.md` queda **en curso** y no "igual al mockup".

## 5. Decisiones tomadas (detalle en `docs/decisiones.md`)

1. **PGlite pasa**; RLS viable pero se activará en la fase 5 (en fase 1 basta el filtro por `workspace_id` + llaves foráneas compuestas).
2. **Rama:** el entorno solo permite publicar `claude/wizardly-fermi-3ur0nk`; se creó `fase-1` local en el mismo commit.
3. **Versiones exactas** con más de dos semanas de publicadas (TS 5.9, Vite 7, Vitest 3, ESLint 9, React 19.1, Tailwind 4, Zod 4, Hono 4, Drizzle 0.45, PGlite 0.5.10).
4. **Alcance de paquetes `@app/*`** (nada de "Quick Robot" en el código) y `vitest.config.ts` con proyectos en lugar del `vitest.workspace.ts` obsoleto.
5. **Estados del filamento** del mockup (Sin rollos, Agotado, Se acaba, Poco, Nuevo, Normal) en vez de los tres que menciona `06 §6`.
6. **Unicidad del filamento** con `name_key` (= `core.filamentKey`) e **FK compuestas** `(workspace_id, id)`.
7. **`Clock` inyectado** además de las cuatro interfaces de `08`.
8. **Marca del negocio** desde la base (`GET /workspace`), no del código; mascota fuera.
9. **Catálogo genérico** de materiales/colores/marcas en `core/catalog.ts` hasta que exista `catalog_item` (fase 2).
10. **Estilos** tomados de los valores calculados del mockup (botón principal negro, radios 10/14/18 px, pastillas con punto); Geist empaquetada para funcionar sin internet.
11. **Semilla** como datos puros en `db/seed`, aplicada con el mismo caso de uso `addSpool`.

## 6. Bloqueado o dudoso

- **Nada bloqueado.**
- Electron empaquetado **para Mac** sin probar (sin macOS). Probado en Linux con asar.
- La primera creación de la base tarda 5–8 s: en la fase 4 conviene un "Preparando datos…" o partir de una base precreada.
- El CI (`.github/workflows/ci.yml`) está escrito pero no se ha visto correr en GitHub.
- `docs/10` dice que el informe se llama `docs/11-resultado-fase-N.md`; `CLAUDE.md` y tu pedido dicen `docs/informe-fase-N.md`. Se usó el segundo.

## 7. Lo que conviene que revises

1. **La pantalla de Filamentos en tu navegador** (comandos abajo): que la lista, el cajón y "Agregar rollo" se sientan como el mockup.
2. **La marca en la barra lateral**: ¿te sirve la inicial mientras llega el logo en Ajustes, o prefieres otra cosa?
3. **Material/color/marca con sugerencias** en lugar de listas desplegables: se escribe libre y sugiere; "negro" se vuelve "Negro". Si quieres el `<select>` exacto del mockup, se cambia en la fase 2 junto con el catálogo.
4. **Estados del filamento**: se siguieron los seis del mockup y no los tres de `06 §6`. Si `06` es el bueno, hay que corregirlo allí.
5. **Tiempos de PGlite** (sección 2) y la prueba de humo pendiente en Mac.

## 8. Cómo ver la pantalla de Filamentos

```bash
pnpm install
pnpm dev          # API (PGlite en memoria + semilla del mockup) + Vite → http://127.0.0.1:5173/filamentos
pnpm dev:file     # igual, pero guarda en .data/pgdata (sobrevive reinicios)
pnpm start        # compila la web y la sirve el servidor local con archivo → http://127.0.0.1:8787/filamentos
```
