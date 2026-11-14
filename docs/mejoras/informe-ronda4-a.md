# Informe de la ronda 4 · Fase A · Reglas de rollos en `core`

## Resumen
Las reglas de `ronda-4.md §2` viven en `packages/core/src/filament.ts` con sus casos numéricos como pruebas: costo por gramo de un filamento = promedio de sus **últimas 3 compras con costo** (con respaldo material → precio de referencia → 0 y su origen), rollos sin costo, valor del inventario por rollo, números de rollo y reparto del envío, qué rollo se gasta (con y sin elección, consumo y purga por rollo), terminar y pesar. `docs/04 §1` está reescrito y el golden recalculado: solo cambia **PLA Blanco** (0.3784 → 0.38) y las 5 piezas y 2 colecciones que lo usan; las ventas guardadas no cambian. El servidor ya cuesta piezas y filamentos con la regla nueva (sin cambiar datos ni contrato).

## Pasos
| Paso | Estado | Commit | Notas |
|---|---|---|---|
| Pruebas de los casos 2.2a–g, 2.3, 2.5a–c, 2.7 (+ 2.1, 2.4, 2.6, rangos, envío) | hecho | `063c040` | Escritas primero; fallaron (funciones inexistentes y golden) antes de programar las reglas |
| Reglas en `core` (`filament.ts`) | hecho | `063c040` | `filamentCost`/`filamentCosts`, `inventoryValue`, `nextSpoolNumbers`, `splitCents`, `planSpoolUse`, `suggestedSpool`, `finishSpool`, `weighSpool`, constantes de rangos |
| `docs/04 §1`, `14 §5`, `10` y golden | hecho | `063c040` | Casos en `04` como 1.1a–g, 1.4, 1.5a–c, 1.6 (con su número de la ronda) |
| Servidor con la regla nueva | hecho | `2f96779` | Costeo de piezas, `GET /filaments(/:id)`, `addSpool`, edición de rollos; prueba nueva 1.1a/1.1d por `addSpool` |
| e2e con el costo nuevo | hecho | (en el commit del informe) | `workshop.spec.ts`: Doctor Doom «Costo $41.56» → «Costo $41.64» (golden pr5) |
| Informe y progreso | hecho | `docs(ronda4): phase A report` | |

## Pruebas
- **Reglas de core** (`filament.test.ts`, `spool-use.test.ts`, `edges.test.ts`): casos 1.1a–g (= 2.2a–g), 1.2, 1.3, 1.4 (= 2.3), 1.5a–c (= 2.5a–c), 1.6 (= 2.7), más 2.1 (sin costo), 2.4 (números, nunca se reutilizan), 2.6 (terminar, `SPOOL_ALREADY_EMPTY`), `SPOOL_INSUFFICIENT`, `SPOOL_NOT_IN_FILAMENT`, `WEIGHT_OUT_OF_RANGE` (borde 1.05), N de 1 a 10, desempates, borrados, respaldo por material y el reparto del envío (propiedad: suma exacta, residuo al primero). Propiedad nueva: con elecciones al azar ningún rollo queda negativo y consumo + purga = lo tomado.
- `pnpm vitest run --project core`: **192 pruebas** en verde · `pnpm test:tz` en verde · golden de la fase 2 recalculado y golden de la fase 3 **sin cambios**.
- `pnpm test` (core, db, server, web, contract, tools): **57 archivos, 655 pruebas** en verde, cobertura en umbral (`core` 100 % líneas, 95.4 % ramas; `filament.ts` 100 % / 97.2 %).
- `pnpm typecheck` ok · `pnpm lint` 0 errores (33 avisos, los mismos de antes) · **`pnpm security` en verde** (lint de seguridad, audit, secretos, 153 pruebas de cabeceras, matriz de acceso, inyección, importación y fallo a la mitad).
- **`pnpm e2e` completa: 122 pasan, 5 omitidas** (las de siempre), con el único cambio de `workshop.spec.ts` (Doctor Doom $41.56 → $41.64, el valor nuevo del golden).

## Comparación con la maqueta
No aplica (fase sin pantallas).

## Decisiones tomadas
`docs/decisiones.md` › **2026-11-14 · Ronda 4 · Fase A · Reglas de rollos en `core`**: el cambio de regla con la lista old → new de los 30 valores del golden; numeración de casos en `04`; rollo de $0 = sin costo *(para revisión)*; material comparado como nombre; referencia solo > 0; N fuera de rango al borde; elección de rollo con gramos opcionales, tope en lo necesario y resto de los demás y luego de los elegidos *(para revisión: inventario)*; consumo y purga por rollo también en el orden automático; rollo sugerido no vacío; pesar y terminar al décimo; errores de `core` como `{ ok: false, code }`; servidor con la regla nueva sin datos nuevos.

## Bloqueado o dudoso
- Nada bloqueado.
- **Cambio visible para la persona:** con la regla nueva, PLA Blanco pasa de $0.3784 a $0.38 por gramo y Spider-Man · salto, Spider-Man · trepando, Doctor Doom, Hulk y el Letrero suben entre $0.05 y $0.08 de costo; las dos colecciones, $0.14 y $0.29. Es lo esperado (`ronda-4.md`, decisión del dueño).
- **Reparto de consumo y purga** en un trabajo que toca dos rollos: ahora cada rollo lleva su consumo y su purga (antes, el consumo iba primero y la purga al final del orden). Lo que baja el filamento es igual.

## Qué conviene que revise la persona
- El costo de 3 o 4 piezas antes y después (lista exacta en `decisiones.md`).
- Si un rollo que costó $0 debe contar siempre como «Sin costo» (hoy sí).
- Si al elegir rollos que no alcanzan, lo que falta debe salir de los demás rollos y luego de lo que les quede a los elegidos (hoy así), o avisar faltante antes.

## Cómo probarlo
```
pnpm vitest run --project core
pnpm test:tz
pnpm test
pnpm e2e e2e/workshop.spec.ts e2e/filaments.spec.ts
```

---

## Plan de la fase B · Migración, datos y operaciones (`ronda-4.md §3–§4`)

Orden: documento → migración y repositorio → caso de uso con su prueba → ruta. Cada operación con **camino feliz, cada error, fallo a la mitad** (`failOnWrite` de `server/test/harness.ts`, como `add-spool.test.ts`) y **aislamiento** (otro negocio → 404; `db/test/tenancy.test.ts`, `server/test/security/access-matrix.test.ts`). Un commit por paso.

| # | Paso | Archivos | Pruebas |
|---|---|---|---|
| B1 | Docs primero: `05` (§3: columnas), `12` (§4: operaciones, campos y errores nuevos), `13` (4 textos de error de §4 + «Sin costo de referencia para {filamento}», «Rollo terminado») | `docs/05-modelo-de-datos.md`, `docs/12-api.md`, `docs/13-textos-y-errores.md` | — |
| B2 | **Migración 0008** (aditiva): `spool.number` int (rellenado por negocio en orden de `purchased_on`, desempate por id; luego `NOT NULL` + índice único `(workspace_id, number)`), `spool.no_cost` bool default false (true donde `cost_cents + shipping_cents = 0`), `filament.reference_cents_per_kg` int nulo, `catalog_item.spool_tare_grams` int nulo, `workspace_settings.cost_avg_purchases` int default 3 con `CHECK 1–10`. La copia de seguridad antes de migrar ya la hace `migrate-local.ts` (`backups/before-update-*`). | `packages/db/migrations/0008_spools.sql` + `meta/`, `packages/db/src/schema/spool.ts`, `filament.ts`, `catalog.ts`, `settings.ts` | `db/test/migration-spools.test.ts` (como `migration-variants.test.ts`): con `mockup-backup-v7.json` los números siguen el orden de compra (r1, r2 el 22 sep por id…), ningún gramo cambia, rollos de costo 0 quedan `no_cost`; dos negocios numeran cada uno desde 1; `migrate-local.test.ts` (copia antes, restaura si falla) |
| B3 | Repositorio: `listSpools` devuelve `number`, `noCost`; `nextSpoolNumbers` en la transacción (`max(number)` con borrados, bajo `lock` del negocio); tara por marca; `costAvgPurchases` y `referenceCentsPerKg` en lecturas | `packages/db/src/repos/filament-repo.ts`, `settings-repo.ts` | `db/test/tenancy.test.ts` (cada consulta nueva con `ctx`) |
| B4 | Vista: `toSpoolInput` con `number`/`noCost`; `filamentCostMap` con `reference_cents_per_kg` y N de Ajustes; `GET /filaments` + `spools[]` (número, marca, gramos, restante, precio o `noCost`, fecha, estado) y `costSource` con los números | `server/src/views/filament-view.ts`, `views/costing.ts`, `contract/src/schemas/filament.ts` | `routes/filament.test.ts`; `dev-seed.test.ts` (sigue 0.38 y $2,044) |
| B5 | `addSpool`: `quantity` 1–20 (N rollos con números consecutivos, `splitCents` del envío, residuo al primero), `noCost`, `referenceCentsPerKg?`; `REFERENCE_COST_REQUIRED` (422) si `noCost` y `filamentCost` da `none`; respuesta con los rollos creados | `usecases/add-spool.ts`, `contract` | cantidad 2 → números consecutivos; con un número borrado en medio no se reutiliza; envío $10.00 / 3; sin costo con y sin referencia; fallo en cada escritura deja todo igual; otro negocio → 404 |
| B6 | `updateSpool` + `noCost` | `usecases/spools.ts` | cambia el costo del filamento; 404 entre negocios |
| B7 | `finishSpool` `POST /spools/:id/finish` (`finishSpool` de core → movimiento `waste` «Rollo terminado»; `SPOOL_ALREADY_EMPTY` 409) | `usecases/spools.ts`, `routes/filament.ts`, `routes/access` (permiso `spool.update`) | feliz, ya vacío, fallo a la mitad, 404, matriz de acceso |
| B8 | `weighSpool` `POST /spools/:id/weigh` `{ scaleGrams, tareGrams }` (`weighSpool` de core; ajuste solo si ≠ 0; guarda la tara en la marca; `WEIGHT_OUT_OF_RANGE` 422 con `maxGrams`) | ídem + `catalog_item` | caso 1.6 (348/330 g), fuera de rango por arriba y abajo, tara guardada y propuesta, fallo a la mitad, 404 |
| B9 | `logPrintRun`: `filaments[].spools?: [{ spoolId, grams }]` → `planSpoolUse`; `SPOOL_INSUFFICIENT`, `SPOOL_NOT_IN_FILAMENT` (422); sin `spools` = orden automático (igual que hoy) | `usecases/sell/material.ts` (`deductFilament` recibe las elecciones), `sell/production.ts`, `contract/schemas/sell.ts` | casos 1.5a/1.5b por la ruta; rollo de otro filamento; más de lo que tiene; rollo de otro negocio → 404/422 sin escribir; fallo a la mitad |
| B10 | `startProduction`: `assignments[].startSpools?: [{ filamentId, spoolId }]` → elección `{ spoolId }` sin gramos y lo demás en orden (caso 1.5c) al descontar | `usecases/sell/orders.ts`, `material.ts`, `contract` | caso 1.5c; rollo de otro filamento; sin `startSpools` igual que hoy |
| B11 | Ajustes: `costAvgPurchases` (1–10) en `GET /settings` y `updateSettings`; cambia el costo de las piezas | `usecases/settings.ts`, `contract/schemas/settings.ts` | rango; N = 1 da caso 1.1f |
| B12 | Copia de seguridad e importación: columnas nuevas en exportar/importar (`workspace-data`), validación de los archivos importados (número único, `no_cost` bool); `import-mockup` asigna números | `db/repos/workspace-data-repo.ts`, `usecases/workspace-data.ts`, `import-mockup.ts` | `workspace-data.test.ts`, `security/import-untrusted.test.ts` |
| B13 | Cierre: `pnpm test`, `typecheck`, `lint`, `security`; informe `informe-ronda4-b.md` | | |

## Plan de la fase C · Pantallas (`ronda-4.md §5`, maquetas de `reference/ronda-4/`)

Cada pantalla comparada con su maqueta en 1440, 820 y 390. **E1:** los segmentados de siempre (`.seg`, `.seg2`, `.rad`) no cambian aunque la maqueta dibuje otro (p. ej. el Motivo de Registrar impresión; `segmented.snapshot.json`). **E2:** al tocar un rollo en Filamentos se abre el **cajón** (`components/Drawer.tsx`) con ese rollo (Pesar, Terminar rollo, Editar, Movimientos), no la columna fija de la derecha. **E3:** la mascota se queda. Textos solo en `apps/web/src/i18n/es.ts`; en celular los diálogos son hojas desde abajo (`rollos.css` → reglas propias en `filament.css`, sin colores literales).

| # | Paso | Archivos | Notas |
|---|---|---|---|
| C1 | Estilos de rollos (número, filamento con rollos, selector, barra antes → después, hoja en celular) | `features/filament/filament.css` (+ `production.css`, `orders.css`) | Tokens neutros; `tokens.test` |
| C2 | **Filamentos**: cada filamento con sus rollos abajo (número, marca, fecha, precio o «Sin costo», barra, «x g de y g», estado, menú); vacíos ocultos («1 rollo vacío oculto»); costo por gramo con sus compras; franja Disponible · Valor del inventario · Stock bajo/Crítico · Rollos sin costo | `FilamentList.tsx`, `tone.ts`, `api.ts` | E2: el rollo abre el cajón |
| C3 | **Cajón del rollo**: Pesar (báscula, carrete vacío propuesto por marca, resultado y ajuste), Terminar rollo (confirmación), Editar, Movimientos | `FilamentDrawer.tsx`, nuevo `WeighDialog.tsx`, `MovementDialog.tsx` | `WEIGHT_OUT_OF_RANGE`, `SPOOL_ALREADY_EMPTY` |
| C4 | **Agregar rollo**: cantidad, Sin costo, envío del pedido, «se agrega como uno nuevo», resultado (números que se crean, rollos del filamento, costo para piezas antes → después) y «Precio de referencia por kilo» cuando hace falta | `SpoolDialog.tsx` | Usa `nextSpoolNumbers`, `filamentCost` de core para la vista previa (el servidor recalcula) |
| C5 | **Registrar impresión**: por filamento lo necesario con purga, lista de rollos con el sugerido, antes → después, barra del elegido, «Repartir entre dos rollos», total y «el costo no cambia con el rollo» | `production/PrintRunDialog.tsx`, `write.ts` | `planSpoolUse` para la vista previa; E1 en el Motivo |
| C6 | **Poner en producción**: «Empezar con el rollo» por filamento en cada artículo y el reparto que resulta | `orders/OrderDialogs.tsx`, `orders/Material.tsx` | Caso 1.5c en la vista |
| C7 | **Pieza (calculadora)**: «i» junto al costo por gramo de cada filamento con su origen (compras #…, promedio del material, precio de referencia) y aviso «Sin costo de referencia para {filamento}» | `products/ProductEditor.tsx`, `PieceResult.tsx`, `costing.ts` | |
| C8 | **Ajustes › Costos del taller**: «Compras para el promedio del filamento» (1–10) | `settings/SettingsPage.tsx` | |
| C9 | Pruebas de pantalla y e2e de cada diálogo; capturas a 1440/820/390 contra las maquetas; `docs/06` y `progreso.md`; informe `informe-ronda4-c.md` | `e2e/filaments.spec.ts`, `e2e/production*.spec.ts`, `apps/web/src/**/*.test.tsx` | |
