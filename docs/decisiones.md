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

## 2026-11-02 · Fase 1 · Paso 1.2 · Estados del filamento
- Situación: `06 §6` dice que la lista muestra estado "Disponible/Poco/Agotado"; el mockup (`estFil`) usa seis: Sin rollos, Agotado (≤ 0.5 g), Se acaba (≤ 150 g), Poco (≤ 300 g), Nuevo (≥ 95 % de la capacidad de los rollos con material), Normal. `06 §2` usa el mismo umbral de 150 g para la alerta de Inicio.
- Decisión: manda el mockup (CLAUDE.md, regla 1 para dudas; `06` dice que es "la descripción escrita de lo que ya hace el mockup"). `filamentStatus()` en `core` reproduce `estFil` con sus umbrales. No es regla de dinero; no se marca para revisión, pero se anota.
- Otras traducciones fieles del mockup: `planDeduction` reordena los rollos antes de registrar la purga (el mockup llama `ordenRollos` en cada `sacar`); tolerancias 0.05 g (rollo usable), 0.5 g (vacío), 0.01 g (faltante).
- Impacto: `packages/core/src/filament.ts`, `packages/core/test/filament.test.ts`.

## 2026-11-02 · Fase 1 · Paso 1.4 · Unicidad del filamento y llaves compuestas
- Situación: `05` pide filamento único por (negocio, material, color) "sin importar mayúsculas"; el mockup además ignora acentos y espacios (`norm`). `db` no puede importar `core`.
- Decisión: columna `name_key` (= `core.filamentKey`, calculada por el caso de uso) con índice único `(workspace_id, name_key)`. Además, las tablas hijas apuntan a su padre con **llave foránea compuesta** `(workspace_id, id)`, así la base misma impide colgar un rollo o un movimiento de un filamento de otro negocio (barrera extra a la del repositorio). `spool.supplier_id` queda sin FK hasta que exista `supplier` (fase 2). Si se vuelve a agregar un filamento borrado (suave), se restaura.
- Impacto: `packages/db/src/schema/*`, `migrations/0000_init.sql`.

## 2026-11-02 · Fase 1 · Paso 1.5 · Servidor: reloj inyectado, consultas y secreto local
- Situación: los casos de uso necesitarán "hoy" (fechas de movimientos) y `core` no lee la hora; `08` lista cuatro interfaces inyectadas.
- Decisión: se agrega una quinta dependencia mínima, `Clock { today() }`, para que tampoco los casos de uso lean la hora directamente (misma idea que `core`). Las lecturas sin escritura viven en `src/queries/` (`listFilaments`, `getFilamentDetail`) y calculan todo con `core`. El `AuthProvider` local acepta un secreto opcional por arranque (cabecera `x-app-secret`) que usará Electron en la fase 4; en desarrollo no se usa. Las tasas (costo por gramo) viajan en pesos sin redondear; los importes guardados, en centavos.
- Impacto: `packages/server/src/deps.ts`, `src/queries/filaments.ts`, `src/providers/local/*`.

## 2026-11-02 · Fase 1 · Paso 1.6 · Interfaz: marca del negocio, pantallas futuras y selector de filamento
- Situación: el mockup muestra la mascota y el nombre "Quick Robot"/"Impresión 3D" fijos en la barra lateral; CLAUDE.md (regla 6) prohíbe datos de Quick Robot en el código. El catálogo de materiales/colores/marcas (`catalog_item`) y Ajustes son de la fase 2. El mockup elige material/color/marca con `<select>` + opción de agregar.
- Decisión: (a) el nombre sale de `GET /api/v1/workspace` (registro del negocio) y la marca es la inicial del negocio en un cuadro morado; el logo propio llega con Ajustes (fase 2). El giro ("Impresión 3D") se mostrará cuando exista `workspace_settings`. (b) La barra lateral conserva las 14 pantallas del mockup; las que no son de esta fase abren una página "se construye en una fase siguiente". "Nueva pieza", "Buscar", "Registrar movimiento", "Movimiento" y "Editar" se muestran deshabilitados (fase 2/3). (c) Material, color y marca se escriben con sugerencias (`datalist`) del catálogo genérico (`core/catalog.ts`, mismas listas que el mockup) más lo ya registrado; "negro" y "Negro " se resuelven al mismo nombre como en el mockup (`canon`). Un color nuevo muestra el selector de color. (d) Los estilos se tomaron de los valores **calculados** del mockup en el navegador (botón principal negro `#121214`, radios 10/14/18/99 px, pastillas con punto de color), no solo de la tabla de `07`, porque el mockup manda. (e) La tipografía Geist se empaqueta (`@fontsource-variable/geist`) para que funcione sin internet.
- Impacto: `apps/web/src/**`, `packages/core/src/catalog.ts`, `packages/server/src/routes/workspace.ts`.

## 2026-11-02 · Fase 1 · Paso 1.7 · Semilla y arranque local
- Situación: `10` pone la semilla en `packages/db/seed/`, pero `db` no puede importar `core` ni los casos de uso, y el nombre único del filamento se calcula con `core`.
- Decisión: `packages/db/seed/quick-robot.ts` solo **describe** los datos (mismo generador del mockup: 7 filamentos, 8 rollos, mismos movimientos y fechas relativas a hoy). El ejecutor local `packages/server/dev/local.ts` los aplica con el **mismo caso de uso** `addSpool` que usa la pantalla, más los movimientos del libro. Resultado verificado: 7 filamentos · 8 rollos · 4.9 kg · valor $2,044, mismos costos por gramo y estados que el mockup. El ejecutor es la misma composición que hará `apps/desktop` en la fase 4 (dependencias locales + `createApp` + `127.0.0.1`). Ids locales fijos en `LOCAL_WORKSPACE_ID`/`LOCAL_USER_ID`.
- Scripts: `pnpm dev` (PGlite en memoria + semilla, Vite con proxy), `pnpm dev:file` (igual pero con archivo en `.data/pgdata`), `pnpm start` (compila la web y la sirve el mismo servidor desde el archivo local, como lo hará Electron).
- Impacto: `packages/db/seed/`, `packages/server/dev/`, `package.json`.

## 2026-11-02 · Fase 2 · Paso 2.1 · Exportar valores del mockup sin tocar `reference/`
- Situación: las funciones de cálculo del mockup viven dentro de una función anónima y no se pueden leer desde fuera; CLAUDE.md prohíbe modificar `reference/`.
- Decisión: `tools/mockup-page.mjs` sirve con Playwright una **copia en memoria** del mockup con un gancho (`window.__mockup`) añadido al final del script; el archivo en disco no cambia. `tools/export-mockup-golden.mjs` exporta entradas (configuración, rollos con lo que queda, impresoras, insumos, piezas, colecciones) y resultados (M, L, Q, E, F, costo, precio de lista, piso, sugerido por canal; sueltas, precio, costo de cada set). Las fechas se guardan como días relativos para que el archivo no cambie cada día.
- Impacto: `tools/`, `packages/core/test/golden/mockup-values.json`.

## 2026-11-02 · Fase 2 · Paso 2.2 · Tareas base de mantenimiento en `core`
- Situación: una impresora nueva trae tres tareas base (`04 §11`) con nombre ("Cambiar la boquilla"…). Son valores genéricos que la persona edita después.
- Decisión: viven en `core/printers.ts` como datos por defecto (igual que el catálogo genérico), no en `i18n`, porque se guardan como registros del negocio. El servidor los copia al crear la impresora.
- Impacto: `packages/core/src/printers.ts`.
