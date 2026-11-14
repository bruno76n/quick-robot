# Informe de la ronda 4 · Fase B · Migración, datos y operaciones

## Resumen
Los rollos ya tienen **número** (#1, #2… por negocio, nunca se reutiliza) y la marca **sin costo**; el filamento guarda su **precio de referencia**, la marca el **peso del carrete vacío** y Ajustes las **compras para el promedio** (3, de 1 a 10). La migración `0008` es aditiva y numera los datos existentes en orden de compra sin tocar un gramo. Están todas las operaciones de `ronda-4.md §4` con su contrato en `docs/12`: agregar varios rollos a la vez, marcar sin costo, terminar, pesar, elegir rollo al imprimir y al poner en producción, y `GET /filaments` con los rollos de cada filamento y de qué compras sale su costo. Las pantallas actuales siguen funcionando; la interfaz nueva es la fase C.

## Pasos
| # | Paso | Estado | Commit | Notas |
|---|---|---|---|---|
| B1 | Docs primero (`05`, `12`, `13`) | hecho | `1a4a609` | Columnas, operaciones, 4 errores y sus textos, «Rollo terminado», «Sin costo de referencia para {filamento}» |
| B2 | Migración `0008` + esquema | hecho | `5ab4ee6` | `migration-spools.test.ts` con el respaldo v7 y casos raros; `maxSpoolNumber` con bloqueo del negocio |
| B3 | Repositorios | hecho | `c013dd7` | Orden por número, `updateFilament` (referencia), `saveBrandTare`; pruebas de aislamiento de cada columna nueva |
| B4 | `GET /filaments` con rollos y origen del costo | hecho | `d148db5` | N de Ajustes y precio de referencia en el costeo; web: `f.spools` → `f.spoolCount` (5 lugares) |
| B5 | `addSpool` (cantidad, sin costo, referencia) | hecho | `768c775` | 4 códigos nuevos en `contract`, `es.ts` (`messages.ts`) |
| B6 | `updateSpool` + `noCost` | hecho | `ad035e6` | |
| B7 | `finishSpool` | hecho | `fa92f05` | `POST /spools/:id/finish`, cuerpo opcional |
| B8 | `weighSpool` | hecho | `25b438c` | `POST /spools/:id/weigh`; tara por marca en `GET /settings` |
| B9 | `logPrintRun` con rollos elegidos | hecho | `c6ebb13` | |
| B10 | `startProduction` con `startSpools` | hecho | `32bc2ea` | Regla nueva en `core › startSpoolPicks` + `04 §1` |
| B11 | Ajustes › `costAvgPurchases` | hecho | `b495e74` | |
| B12 | Copias de seguridad e importación | hecho | `a4e5bcd` | `core › numberSpools`; semilla e importador del mockup en orden de compra |
| — | Valor del inventario en Reportes | hecho | `fdf961b` | Contaba el precio de un rollo marcado sin costo |
| B13 | Cierre | hecho | `docs(ronda4): phase B report` | |

## Pruebas
- **Reglas de core:** 196 pruebas (`pnpm test:tz` en verde). Nuevas: `startSpoolPicks` (caso 1.5c con uno y dos artículos, rollo vacío, rollo ajeno) y `numberSpools`. Cobertura `core` 100 % líneas, 95.3 % ramas (`filament.ts` 100 % / 96.8 %).
- **Migración:** `migration-spools.test.ts` (respaldo v7: números en orden de compra, ninguno sin costo, ningún gramo/precio/fecha/borrado cambia; mismo día por id; borrado en medio conserva su número; solo costo + envío = 0 es sin costo; dos negocios desde 1; valores por omisión; la base rechaza número repetido, < 1, N fuera de 1–10, referencia 0 y tara negativa). `migrate-local.test.ts` (copia antes de migrar, restaura si falla) y `fk-indexes.test.ts` siguen en verde.
- **Operaciones** (camino feliz, cada error, fallo a la mitad, otro negocio → 404):
  - `addSpool`: cantidad 2 → números consecutivos; borrado en medio y el último borrado no se reutilizan; otro negocio desde 1; envío $10.00 / 3 = 334 + 333 + 333; sin costo (y $0); `REFERENCE_COST_REQUIRED` sin escribir nada; referencia $300/kg → $0.30 (1.1e); material (1.1d); validación; fallo en cada una de 7 escrituras.
  - `updateSpool` + `noCost` (sale y vuelve al promedio, número fijo), `finishSpool` (merma «Rollo terminado», `SPOOL_ALREADY_EMPTY` 409, cuerpo vacío, 404, 422), `weighSpool` (caso 1.6: 348 g → sin movimiento, 330 g → −18 g; tara guardada, reemplazada, marca nueva, sin marca; fuera de rango por abajo y por arriba con `maxGrams` 1050; borde 1.05 válido; 422 y 404).
  - `logPrintRun`: casos 1.5a y 1.5b por la ruta, el resto del orden automático, sin `spools` igual que antes, `SPOOL_NOT_IN_FILAMENT`, `SPOOL_INSUFFICIENT`, rollo de otro negocio o borrado → 404, más de 10 rollos / 0 g → 422, fallo a la mitad.
  - `startProduction`: caso 1.5c, el elegido gana al orden automático, sin `startSpools` igual que antes, `SPOOL_NOT_IN_FILAMENT`, otro negocio → 404 (también sin descontar), filamento que el artículo no usa se ignora, fallo inyectado en cada escritura.
  - Ajustes: N = 3 por omisión, N = 1 (1.1f) y N = 2 cambian filamento y pieza; 0, 11, 2.5 y "3" → 422; otro negocio conserva su N.
  - Copias: copia vieja sin columnas → números en orden de compra y $0 sin costo; semilla e importador del mockup = numeración de la migración; número repetido, < 1 o decimal, N 11, referencia 0, tara −1 → `IMPORT_INVALID_FILE` sin cambiar nada.
- **Matriz de acceso y fallo a la mitad:** las rutas nuevas (`/finish`, `/weigh`) están en `access-matrix.test.ts` y `failure-midway.test.ts`.
- `pnpm test`: **62 archivos, 742 pruebas** en verde (7 omitidas, las de Postgres y `perf`), cobertura en umbral (todo: 95.8 % líneas). `pnpm typecheck` ok. `pnpm lint` **0 errores** (39 avisos: los 33 de antes + 6 de `max-lines-per-function` en los `describe` de las pruebas nuevas). **`pnpm security` en verde** (155 pruebas).
- **`pnpm e2e` completa: 122 pasan, 5 omitidas** (las de siempre), sin cambiar ninguna prueba: las pantallas actuales siguen funcionando con las respuestas nuevas.
- Rendimiento: `GET /filaments` hace una carga de filamentos, rollos y Ajustes por petición (sin consulta por filamento); `pnpm perf` no se corrió (no lo pide la fase).

## Comparación con la maqueta
No aplica (fase sin pantallas nuevas). Las pantallas actuales solo cambiaron de dónde leen el número de rollos.

## Decisiones tomadas
`docs/decisiones.md` › **2026-11-14 · Ronda 4 · Fase B · Migración, datos y operaciones**: numeración con borrados y bloqueo del negocio; `spools[]` + `spoolCount` en la lista; respuesta de `addSpool`; rollo de $0 siempre sin costo y `REFERENCE_COST_REQUIRED` solo con `noCost: true` explícito *(para revisión)*; cuerpo opcional de terminar; tara por marca con *upsert*; validación de rollos elegidos (404 / `SPOOL_NOT_IN_FILAMENT`); «Empezar con el rollo» como partes elegidas por artículo *(para revisión: inventario)*; copias viejas numeradas como la migración; valor del inventario de Reportes con `no_cost`.

## Bloqueado o dudoso
- Nada bloqueado.
- **Para revisión:** un rollo de $0 sin la marca «Sin costo» no pide precio de referencia (solo la marca explícita lo pide). **Inventario:** con varios artículos que empiezan con rollos distintos, el descuento sigue siendo uno por filamento; cada artículo toma de su rollo hasta lo que necesita y lo demás sale en el orden automático.

## Qué puede usar la fase C
**Rutas y formas** (`docs/12 §4, §7, §8`; tipos en `@app/contract`):
- `GET /filaments` y `GET /filaments/:id` → `FilamentListItem` / `FilamentDetail`: `spools: Spool[]` (vivos: orden de uso, luego vacíos del más nuevo al más viejo), `spoolCount`, `costPerGram`, `costSource` (`purchases` | `material` | `reference` | `none`), `costSpoolNumbers[]` (del más nuevo al más viejo), `referenceCentsPerKg`, `noCostSpools`, `activeSpools`, `capacityGrams`, `valueCents`, `status`; detalle + `movements[]`.
- `Spool`: `{ id, number, filamentId, brand, costCents, shippingCents, grams, purchasedOn, supplierId, noCost, remainingGrams, costPerGram, status }`.
- `POST /spools` (`AddSpoolInput` + `quantity?`, `noCost?`, `referenceCentsPerKg?`) → `AddSpoolOutput { spool, spools[], filament }`.
- `PATCH /spools/:id` (+ `noCost?`), `POST /spools/:id/restore`, `POST /spools/:id/movements`, `POST /spools/:id/finish` (`{ on? }`, cuerpo opcional) → `SpoolOutput { spool, filament }`.
- `POST /spools/:id/weigh` (`{ scaleGrams, tareGrams, on? }`) → `WeighSpoolOutput { spool, filament, leftGrams, adjustmentGrams }`. Tara propuesta: `GET /settings` › `catalogs.brands[].tareGrams`.
- `POST /print-runs`: `filaments[].spools?: [{ spoolId, grams? }]` (gramos con purga; sin gramos = lo que tenga).
- `POST /orders/:id/start-production`: `assignments[].startSpools?: [{ filamentId, spoolId }]`.
- `GET /settings` › `settings.costAvgPurchases`; `PATCH /settings` `{ costAvgPurchases }` (1–10).
- **Vista previa en el navegador** con `core`: `nextSpoolNumbers`, `splitCents`, `filamentCost`/`filamentCosts`, `planSpoolUse`, `suggestedSpool`, `startSpoolPicks`, `weighSpool`, `finishSpool`, `SPOOL_QUANTITY`, `COST_AVG_PURCHASES`, `WEIGH_TOLERANCE`.

**Códigos de error nuevos** (textos en `13 §3` y `messages.ts`): `SPOOL_NOT_IN_FILAMENT` (422, `spoolId`), `SPOOL_ALREADY_EMPTY` (409), `WEIGHT_OUT_OF_RANGE` (422, `maxGrams`), `REFERENCE_COST_REQUIRED` (422). Siguen: `SPOOL_INSUFFICIENT` (422, `availableGrams`), aviso `FILAMENT_SHORTFALL`. Texto pendiente para la pantalla: «Sin costo de referencia para {filamento}» (`13 §9.4`, aún no en `es.ts`).

## Qué conviene que revise la persona
- Los números que recibieron sus rollos reales (en orden de compra; dos del mismo día por orden de alta) antes de rotular los contenedores.
- Si un rollo registrado a $0 sin marcar «Sin costo» debe pedir precio de referencia (hoy no).
- El reparto de «Empezar con el rollo» cuando dos artículos del mismo pedido empiezan con rollos distintos.

## Cómo probarlo
```
pnpm vitest run --project db packages/db/test/migration-spools.test.ts
pnpm vitest run --project server packages/server/test/usecases/add-spool.test.ts packages/server/test/usecases/spools.test.ts packages/server/test/usecases/print-run-spools.test.ts packages/server/test/usecases/start-production-spools.test.ts packages/server/test/usecases/cost-avg.test.ts
pnpm test && pnpm security && pnpm e2e
```
