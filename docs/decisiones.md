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
Ver `01-vision-y-decisiones.md` (D1–D21).

## 2026-11-01 · Planeación · Cierre de la planeación de las fases 1 a 4
Se agregan los documentos 12 al 15, `prompts.md`, `reference/mockup-textos.md`, `assets/` y los valores esperados del mockup. Decisiones D22–D29 en `01` (las D30–D35 vienen de la revisión de coherencia, más abajo). Cambios que se hicieron al revisar la coherencia de todo el conjunto:
- **Tablero de pedidos:** `06` solo describía Lista y Calendario; el mockup abre por defecto en **Tablero** (4 columnas). Se agregó a `06 §5` y a los pasos 3.4 de `10`.
- **Canales por id:** `05` guardaba el nombre del canal en ventas y pedidos; ahora `channel_id` (D27). Se agregó el caso de uso `updateChannel`.
- **Pedido siempre con cliente:** `order.customer_id` obligatorio (el mockup lo exige).
- **Foto de la pieza:** faltaba `product.photo_file_id` en `05`.
- **Última copia descargada:** `workspace_settings.last_backup_on` (alimenta la atención de Inicio).
- **Copias automáticas:** nueva dependencia inyectada `BackupStore` (una por día, últimas 7) en `02`, `08`, `10`.
- **Pantallas de falla de Electron:** `apps/desktop/src/fatal.html`, porque si el servidor cae la interfaz no se puede cargar.
- **Secreto local:** pasa de "lo lee la interfaz" a "lo agrega Electron como encabezado" (D29).
- **Valores internos en inglés** (estados, motivos, tipos de movimiento): tabla en `03`.
- **Acciones del mockup sin documentar:** `variante` e `imp-del` agregadas a `06`.
- **Filtros reales del mockup:** Productos (Fichas/Lista; Todas/Técnicas/Variantes) y Producción (sin filtro "Fallos") corregidos en `06`.
- **Informe de fase:** `docs/informe-fase-N.md` (antes `10` mencionaba otro nombre).
- Dependencias nuevas anotadas: `fast-check` (solo pruebas, `14`); ninguna en tiempo de ejecución.

## 2026-11-01 · Planeación · Revisión de coherencia del paquete completo
Claude Code leyó el zip entero y encontró contradicciones; todas se verificaron y se corrigieron (D30–D35 en `01`):
- **Logo con “Quick Robot”** contra la regla 6: la barra lateral y los documentos escriben el nombre y el giro de Ajustes; el logo con texto queda solo para uso externo.
- **Tablas hijas sin `workspace_id`** (`product_filament`, `product_supply`, `collection_part`, `print_run_filament`): ahora lo llevan, con clave foránea compuesta.
- **“Deshacer” sin operación:** se agregan `restoreSupply`, `restoreSupplier` y `restorePrinter`. Devolver una venta y cancelar un pedido dejan de ofrecer “Deshacer” (no había operación ni regla para revertir dinero y existencias).
- **Avisos con parámetros que la API no mandaba:** `FILAMENT_SHORTFALL` usa `{missingGrams}` y `{name}`; `ORDER_WAITING_OTHER_PRINTERS` manda `orderNumber` y `printerNames[]`. Regla de llenado en `13 §4`.
- **Estados sin regla:** el mockup calculaba “Se acaba”, “Nuevo”, “Todo apartado”, “Pocas”, etc. solo en código; ahora están en `04` (casos 1.3 y 5.2), `03` y `13 §8`. “Disponible” no es un estado de filamento.
- **Parámetros de los errores:** `PAYMENT_EXCEEDS_BALANCE`, `REFUND_EXCEEDS_PAID` y `PRINTER_ASSIGNMENT_REQUIRED` usaban parámetros que la API no mandaba; ahora el parámetro se llama igual que el campo de `details` y se formatea por su sufijo (`13 §2`).
- Menores: `FILE_TOO_LARGE` dice “archivo” (también sirve para copias), paquetes `@app/*`, rol `operator`, y la segunda persona queda como regla única en `13 §1`, `06` y `CLAUDE.md`.

## 2026-11-01 · Planeación · Segunda lectura del paquete v2
Claude Code leyó la v2 completa: confirmó que las 9 contradicciones estaban resueltas y encontró 3 menores nuevas, que se corrigieron antes de empezar la fase 1:
- **Unidad repetida:** `SPOOL_INSUFFICIENT` escribía “g” después de `{availableGrams}`, que ya se formatea con su unidad. Regla nueva en `13 §2`: la unidad nunca va en el texto; `i18n.test.ts` lo comprueba.
- **Sintaxis de `t()`:** había plurales sin nombre (`{count} {pieza|piezas}`) y elecciones sin definir (`{entregado|cancelado}`). Ahora hay tres formas explícitas (valor, plural, elección) y todos los textos se reescribieron con ellas.
- **Referencia:** el límite de 100 MB de las copias está en `15 §4`, no en `§3` (corregido en `12` y `07`).

## 2026-11-02 · Fase 1 · Paso 1.0 · Comprobación de PGlite: pasa
- Situación: `02 §4` pide comprobar PGlite antes de construir (5 criterios). Carpeta `spikes/pglite/`, resultados en `spikes/pglite/results/`.
- Entorno: Linux x64, 4 CPU, Node 22.23. PGlite 0.5.10; Postgres 16 nativo para comparar.
- Resultados (p95, archivo en disco):
  1. Mismas migraciones en PGlite y Postgres 16: **pasa** (la misma carpeta generada por drizzle-kit se aplica en los dos sin cambios).
  2. Ventas por pieza, 12 meses, 5 000 ventas: **17.7 ms** (< 200 ms). "Todo" con 25 000 ventas / 48 973 artículos: **53.5 ms** (< 1.5 s). Al reabrir: 38.6 ms. Postgres nativo: 23.5 / 40.4 ms. **Pasa.**
  3. Cierre forzado: 8 rondas de `kill -9` en medio de transacciones de 100 filas (hasta 56 100 filas): 0 lotes a medias, todo lo confirmado está, conteo por índice = conteo por tabla. **Pasa.**
  4. PGlite dentro de Electron 38 empaquetado (electron-builder, asar): abre, crea, escribe; la segunda apertura relee los datos (1 → 2 filas). Primera apertura 8.6 s (crea la base), segunda 0.7 s. **Pasa en Linux**; el empaquetado para Mac no se puede probar aquí (sin macOS) y queda para la fase 4.
  5. RLS con `FORCE ROW LEVEL SECURITY`, rol sin privilegios y `set_config('app.workspace_id')`: A no ve, no modifica ni inserta en B; sin el ajuste no ve nada. **Pasa** en PGlite y en Postgres.
- Decisión: se mantiene Postgres en los dos modos (PGlite en local). No hace falta el plan B. El filtro por `workspace_id` en los repositorios es la barrera principal; RLS queda viable como segunda barrera y se activa en la fase 5 (en local hay un solo negocio).
- Impacto: crear la base por primera vez tarda 4–8 s (initdb en WASM): la fase 4 debe mostrar "Preparando datos…" o partir de una base creada.

## 2026-11-02 · Fase 1 · Paso 1.1 · Herramientas del monorepo
- Situación: `10 §1.1` pide `vitest.workspace.ts`; en Vitest 4 ese archivo ya no existe (se reemplazó por `test.projects`).
- Decisión: `vitest.config.ts` en la raíz con `projects: ['packages/*', 'apps/*', 'tools']` y los umbrales de cobertura de `14 §4` por carpeta. `pnpm test` corre con cobertura. Regla 3 de "cuando algo no está claro": la opción más simple.
- Versiones (A03): solo versiones con más de dos semanas publicadas al 2026-11-02, fijadas exactas. TypeScript 5.9.3, Vitest 4.1.12, Vite 7.3.7 (fijado con `overrides` porque Vitest pedía Vite 8, publicado hace menos de dos semanas), ESLint 9.39.5, typescript-eslint 8.71.2, dependency-cruiser 17.4.3, fast-check 4.10.2 (solo pruebas, `14 §5`), cross-env 10.1.0 (para `pnpm test:tz`), tsx 4.23.15. `@playwright/test` 1.63.0 para usar el navegador ya instalado en este entorno.
- Las pruebas de seguridad del servidor (`packages/server/test/security/`) se crean en el paso 1.5, cuando existe el servidor; `pnpm security` las incluye en cuanto la carpeta existe.
- Prueba negativa de fronteras: `packages/core/test/fixtures/forbidden-import.ts` (excluido del lint normal) y `tools/test/boundaries.test.ts`, que además comprueba 16 violaciones más (núcleo con Node o reloj, web con db/server/Node, servidor con SQL, `mode === 'cloud'`, `dangerouslySetInnerHTML`, texto en español en JSX, `eval`, `sql.raw`, SQL concatenado, exportación por defecto, `console.log`).
- `pnpm audit`: 2 avisos **moderados** (`minimatch` dentro de herramientas de desarrollo); ninguno alto ni crítico. Se revisan al actualizar esas herramientas.
- Impacto: `package.json`, `pnpm-workspace.yaml`, `vitest.config.ts`, `eslint.config.js`, `.dependency-cruiser.cjs`, `scripts/`, `.github/workflows/ci.yml`.
