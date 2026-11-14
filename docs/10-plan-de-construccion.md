# 10 · Plan de construcción

Qué se hace en cada fase, en qué orden, **qué archivos se crean** y qué documentos leer antes. `09` da la visión; este documento es la lista de trabajo.

**Cómo usarlo:** se trabaja una fase a la vez, en modo autónomo (`CLAUDE.md › Modo autónomo`). Cada paso termina con sus pruebas pasando. Al cerrar una fase se actualiza `docs/progreso.md` y se escribe el informe `docs/informe-fase-N.md` (plantilla en `prompts.md §6`).

**Los prompts listos para pegar de cada fase están en `prompts.md`.** Convenciones y pruebas: `14`. Contrato de la API: `12`. Textos y errores: `13`. Rendimiento, límites y fallos: `15`.

**Archivos de referencia que se copian al repositorio desde el inicio**
```
reference/
  Quick Robot mockup.html          comportamiento de referencia
  mockup-backup-v7.json            copia de seguridad del mockup con datos de ejemplo
  mockup-textos.md                 texto visible de cada pantalla y diálogo (para es.ts)
assets/                            ícono, logo y mascota (provisionales)
packages/core/test/golden/
  mockup-values.json               valores esperados de costos y precios del mockup
```
Todo esto **ya existe** en el repositorio inicial; ninguna fase lo genera de nuevo.

---

## Fase 1 · Cimientos y esqueleto que camina

**Objetivo:** el monorepo listo y un recorrido completo mínimo (crear un filamento con un rollo y verlo en la lista) en el navegador, con los datos guardados en un archivo local (PGlite). Electron todavía no.
**Leer:** `CLAUDE.md`, `02`, `03`, `05` (reglas generales y tablas de filamento), `07`, `08`, `11`, `12` (§1–3 y filamentos), `14`, `15` (§3–4).

### 1.0 Comprobación de PGlite (un día)
Criterios en `02 §4`. Carpeta desechable `spikes/pglite/` con: `schema.ts`, `migrations/`, `seed-load.ts` (5 000 ventas y la versión de 25 000 de `15 §1`), `report-query.ts`, `bench.ts`, `crash-test.ts`, `rls-test.ts`, `electron-smoke/` (prueba de humo de PGlite dentro de Electron empaquetado). Resultado en `docs/decisiones.md` (pasa / falla con el dato medido). Si falla, se aplica el plan B de `02 §4` y se continúa.

### 1.1 Monorepo y herramientas
```
package.json, pnpm-workspace.yaml, tsconfig.base.json, .nvmrc, .gitignore
eslint.config.js                 con no-restricted-imports según 03 (fronteras) y sin texto literal en español en apps/web (13 §2)
.dependency-cruiser.cjs          verifica las flechas permitidas
vitest.workspace.ts               con los umbrales de cobertura de 14 §4
scripts/security.mjs               pnpm security: lint de seguridad, audit, escaneo de secretos (ver 11)
scripts/size-check.mjs             pnpm size: JS inicial comprimido ≤ 350 KB (ver 15 §2)
packages/server/test/security/     headers.test.ts, access-matrix.test.ts (todas las rutas × otro negocio → 404),
                                   injection.test.ts, import-untrusted.test.ts, failure-midway.test.ts
.github/workflows/ci.yml         instalar, lint, typecheck, test
docs/progreso.md                 una fila por pantalla
```
Prueba de las fronteras: un archivo de ejemplo que viola una regla debe **romper** el lint (se deja como prueba negativa).

### 1.2 `packages/core` (primeras reglas)
```
packages/core/package.json, tsconfig.json
src/money.ts                      centavos ↔ pesos, round2, formato
src/filament.ts                   costo por gramo (últimas compras), valor, número de rollo, orden y elección de rollos, descontar, faltante, pesar, terminar, estado
src/index.ts
test/money.test.ts
test/filament.test.ts             casos 1.1, 1.2 y 1.3 de 04
```

### 1.3 `packages/contract`
```
src/errors.ts                     todos los códigos de error y avisos de 12 §2 con su HTTP, y la clase BusinessError
src/schemas/filament.ts           Filament, Spool, SpoolMovement, entradas y salidas
src/schemas/common.ts             Money, Id, Page
src/index.ts
```

### 1.4 `packages/db`
```
src/schema/workspace.ts, user.ts, membership.ts
src/schema/filament.ts, spool.ts, spool-movement.ts
src/ctx.ts                         tipo Ctx { workspaceId, userId }
src/repos/filament-repo.ts         todos reciben ctx
src/connect.ts                     connectPglite(), connectPostgres()
migrations/                        generadas
test/tenancy.test.ts               negocio A nunca ve ni modifica datos de B
```

### 1.5 `packages/server`
```
src/deps.ts                        AuthProvider, FileStore, Entitlements, Mailer, BackupStore, Clock, Ids
src/providers/local/auth.ts        sesión fija
src/providers/local/entitlements.ts  siempre permite
src/providers/local/files.ts       carpeta en disco
src/providers/local/backups.ts     BackupStore: una copia por día, las últimas 7 (se usa desde la fase 4)
src/logger.ts                      registro estructurado con redacción (11 › A09)
src/middleware/session.ts          sesión → ctx
src/middleware/errors.ts           errores de negocio → HTTP
src/routes/filament.ts
src/usecases/add-spool.ts          transacción, movimiento `purchase`
src/app.ts                         createApp(deps)
src/static.ts                      sirve el build de web
test/add-spool.test.ts
```

### 1.6 `apps/web`
```
apps/web/package.json, vite.config.ts, tailwind.config.ts, index.html
src/styles/tokens.css              tokens de 07
src/i18n/es.ts, t.ts                textos de 13 (errors, warnings, fields, toast, confirm) y su ayudante
src/lib/format.ts                  moneda, fechas y duraciones (13 §2.1)
src/app/main.tsx, router.tsx, providers.tsx
src/lib/api.ts                     cliente tipado
src/lib/platform.ts                window.desktop si existe, navegador si no
src/components/                    Button, Field, UnitInput, Dialog, Drawer, Toast, Table, Pill, Segmented, Banner, ErrorBoundary
src/components/AppShell.tsx        barra lateral (mascota + nombre y giro del negocio, de Ajustes), cabecera, atajos mínimos
src/features/filament/             FilamentList.tsx, SpoolDialog.tsx, api.ts
```

### 1.7 Semilla de desarrollo
```
packages/db/seed/quick-robot.ts    datos de ejemplo del mockup (solo desarrollo)
pnpm dev                           servidor local + web con la semilla
```

**Pruebas:** casos 1.1, 1.2 y 1.3; aislamiento; el lint rechaza una frontera rota; un test de integración "agregar rollo → aparece en la lista"; `i18n.test.ts` y `format.test.ts` (`13 §10`); `access-matrix` con las rutas existentes.
**Terminado cuando:** se agrega un rollo en el navegador y queda guardado en el archivo local; las pruebas de `core` y de aislamiento pasan; el lint rechaza una frontera rota.

---

## Fase 2 · Taller y catálogo

**Objetivo:** poder costear piezas con los mismos números que el mockup.
**Leer:** `04 §1–3, §9, §11`, `05` (taller y catálogo), `06 §3, §6–8, §15`, `12` (§4, §5, §8), `13` (§3, §6), `14`, `15 §4`.

### 2.1 Golden tests del mockup
```
packages/core/test/golden/mockup-values.json     ya incluido en el repositorio inicial
tools/export-mockup-golden.mjs                   opcional: regenera el archivo anterior abriendo el mockup
```
Esta tabla es el criterio de la fase: el producto debe dar los mismos valores (±0.01).

### 2.2 `core`
```
src/costs.ts                       M, L, Q, E, fallos; promedio de impresoras
src/pricing.ts                     sugerido, piso, precio de lista, sets, reparto
src/printers.ts                    mantenimiento, inversión recuperada
test/costs.test.ts                 caso 2.1
test/pricing.test.ts               casos 3.1–3.3
test/printers.test.ts              casos 11.1–11.2
test/golden.test.ts                compara con mockup-values.json
```

### 2.3 Datos y servidor (por área)
| Área | db | usecases | routes |
|---|---|---|---|
| Ajustes de costos y canales | `workspace-settings.ts`, `sales-channel.ts`, `catalog-item.ts` | `update-settings.ts`, `add-channel.ts`, `update-channel.ts`, `remove-channel.ts` | `settings.ts` |
| Proveedores | `supplier.ts` | `create/update/delete-supplier.ts` | `suppliers.ts` |
| Insumos | `supply.ts`, `supply-movement.ts` | `create-supply`, `record-supply-purchase`, `record-supply-movement` | `supplies.ts` |
| Filamento (completar) | — | `update-spool`, `delete-spool`, `record-spool-movement` | `filament.ts` |
| Impresoras | `printer.ts`, `maintenance-task.ts` | `create-printer`, `update-printer`, `delete-printer`, `create/update/delete-maintenance-task`, `complete-maintenance` (crea gasto) | `printers.ts` |
| Productos y colecciones | `product.ts`, `product-filament.ts`, `product-supply.ts`, `collection.ts` | `save-product`, `save-product-as-variant`, `delete-product`, `save-collection` | `products.ts`, `collections.ts` |

Cada caso de uso con su prueba (camino feliz, cada error de `12`, fallo a la mitad); cada tabla con prueba de aislamiento. Los `restore…` de las entidades de esta fase (`12`) van con su caso de uso de borrado. Archivos subidos (`POST /files`, fotos de pieza) y sus límites (`15 §4`) entran aquí. Pruebas de inyección en todos los campos de texto (`11`).

### 2.4 Pantallas (`apps/web/src/features/`)
`settings/`, `supplies/`, `printers/`, `filament/` (cajón de rollos y movimientos), `products/` (lista, **calculadora** con desglose en vivo usando `core`, colección).

**Terminado cuando:** `golden.test.ts` pasa para todas las piezas y colecciones de ejemplo, y las pantallas de la fase se ven y se comportan como el mockup.

---

## Fase 3 · Vender y producir

**Objetivo:** todos los flujos A–F de `06 §17`.
**Leer:** `04 §4–8, §10, §12–13`, `05` (existencias, ventas, pedidos, producción), `06` completo, `12` (§6–9), `13`, `14` (§2–5), `15` (§2–5).

Orden interno (cada paso depende del anterior). Cada uno: reglas en `core` con prueba → tablas → casos de uso con prueba de transacción → rutas → pantalla.

| Paso | `core` | `db` | `server/usecases` | `web/features` |
|---|---|---|---|---|
| **3.1 Existencias** | `stock.ts`, `line-items.ts` (caso 4.1, 5.1) | `stock-movement.ts` | `enable-stock-tracking`, `adjust-stock` | `stock/` |
| **3.2 Clientes** | `customers.ts` | `customer.ts` | `create/update/delete-customer` | `customers/` (lista y ficha) |
| **3.3 Ventas** | `sales.ts` (casos 6.1, 6.2) | `sale.ts`, `line-item.ts`, `payment.ts` | `create-sale`, `update-sale`, `delete-sale`, `record-sale-payment`, `return-sale` | `sales/` + **armador** (`features/builder/`) |
| **3.4 Pedidos** | `orders.ts` (casos 7.1, 7.2) | `order.ts` | `create-order`, `update-order`, `accept-order`, `record-order-payment`, `delete-order-payment`, `cancel-order`, `delete-order` | `orders/` (**tablero**, lista, calendario, página con pestañas) |
| **3.5 Producción y colas** | `production.ts` | `print-run.ts`, `print-queue-entry.ts` | `start-production`, `reassign-printers`, `finish-queue-entry`, `mark-order-ready`, `deliver-order`, `log-print-run`, `delete-print-run` | `production/`, parte de `printers/` |
| **3.6 Gastos** | `expenses.ts` (caso 10.1) | `expense.ts` | `create/update/delete-expense` | `expenses/` |
| **3.7 Reportes y Compras** | `reports.ts`, compras en `stock.ts`/`filament.ts` (caso 9.1) | vistas/consultas | consultas (sin escritura) | `reports/`, `purchases/` |
| **3.8 Inicio, documentos, búsqueda, atajos, estados de falla** | atenciones del brief (`06 §2`) | vistas `stock_levels`, `spool_levels`, `supply_levels` (`05`) | consultas `home`, `search` | `home/`, `components/DocumentSheet.tsx`, `CommandPalette.tsx`, `Shortcuts.tsx`, `lib/csv.ts`, exportar a Excel en `settings/` |

**Pruebas de flujo (Playwright):** `e2e/flow-a-quick-sale.spec.ts` … `flow-f-purchases.spec.ts`, una por flujo de `06 §17`, más `e2e/failure-states.spec.ts` (`15 §5`) y una prueba de humo por pantalla en tres anchos. Se corren contra el servidor con la semilla.
**Rendimiento:** `packages/db/seed/load-test.ts` (conjunto de `15 §1`) y `packages/server/test/perf/budget.test.ts` (`15 §2`); revisión con `EXPLAIN` de las 6 consultas pesadas.
**Terminado cuando:** pasan los seis flujos y los casos 4.1–10.1 de `04`; se cumplen los presupuestos de `15 §2`; ninguna pantalla de las 14 + 5 queda sin construir.

---

## Fase 4 · Electron y uso diario

**Objetivo:** envolver la web en Electron y reemplazar el mockup por la app real con tus datos.
**Leer:** `02 §6`, `05` (importar el mockup), `08` (migraciones, seguridad), `11`, `12 §10`, `15` (§5–6).

| Paso | Archivos |
|---|---|
| Cáscara de Electron | `apps/desktop/src/main.ts` (arranca el servidor dentro de la app en `127.0.0.1`, puerto aleatorio y secreto por arranque que agrega como encabezado a cada petición de la ventana, y abre la ventana), `preload.ts`, `local-deps.ts`, `electron-builder.yml` (.dmg, con `assets/icon.icns`) |
| Pantallas de falla | `apps/desktop/src/fatal.html` y su lógica: servidor caído (reinicio automático una vez), migración fallida, archivo de datos ilegible (`15 §5`) |
| Importador del mockup v7 | `packages/server/src/usecases/import-workspace.ts`, `tools/import-mockup.ts`, `test/import-mockup.test.ts` (compara sumas de rollos, existencias y totales de ventas antes/después) |
| Exportar y restaurar | `usecases/export-workspace.ts`, pantalla Ajustes › Copia de seguridad |
| Copias automáticas y migraciones locales con copia previa | `BackupStore` local (`packages/server/src/providers/local/backups.ts`, carpeta que le da `apps/desktop/src/local-deps.ts`), `packages/db/src/migrate-local.ts`; casos de uso `create-backup`, `restore-backup`; "Mostrar archivo de registro" |
| Vaciar negocio | `usecases/clear-workspace.ts` |
| Pulido de Electron | `apps/desktop/src/menu.ts`, abrir al iniciar sesión, ícono. Sin actualización automática ni firma de Apple por ahora (se instala la versión nueva a mano) |
| Revisión pantalla por pantalla | `docs/progreso.md` (cada fila: "igual al mockup") |

**Terminado cuando:** la app abre desde el `.dmg`, la importación de `reference/mockup-backup-v7.json` no da diferencias, una actualización de prueba conserva los datos, una migración que falla restaura la copia, los estados de falla se ven como dice `15 §5` y llevas una semana usándola en lugar del mockup (importando tus datos reales, con la copia previa descargada).

---

## Fase 5 · Producto público

**Objetivo:** abrir a otros negocios con suscripción.
**Leer:** `02 §5`, `08` (cuentas, suscripción, seguridad), `11`, `12 §2` (códigos reservados), `15 §4` (frecuencia), `16`, `17`, `legal/` (**aún sin escribir**: la fase 5 no empieza hasta que existan).

| Paso | Archivos |
|---|---|
| Raíz de la nube | `apps/cloud/src/main.ts`, `cloud-deps.ts`, `Dockerfile` o configuración del hosting |
| Cuentas | `packages/server/src/providers/cloud/auth.ts`; tablas `user` (contraseña), `session`; rutas `auth.ts`; pantallas de registro e inicio (`apps/web/src/features/auth/`) |
| Asistente de primera vez | `apps/web/src/features/onboarding/` + `usecases/create-workspace.ts` (valores genéricos) |
| Planes | tablas `plan`, `subscription`; `providers/cloud/entitlements.ts`; webhooks de pago `routes/billing-webhook.ts` |
| Archivos en la nube | `providers/cloud/files.ts` (almacenamiento de objetos) |
| Correo | `providers/cloud/mailer.ts`, plantillas |
| Aislamiento reforzado | RLS (si aplica), `packages/db/test/tenancy.test.ts` ampliada a todas las tablas, prueba E2E con dos negocios |
| Sitio público | proyecto aparte (`site/`) con el framework que elijas: precio, términos, privacidad |
| Importar desde escritorio a la nube | `usecases/import-workspace.ts` (ya existe de la fase 4) |

**Terminado cuando:** una persona nueva se registra, crea su negocio vacío, paga, completa el flujo B y no puede ver nada de otro negocio; revisión de seguridad hecha.

---

## Seguridad en cada fase

`pnpm security` (definido en `docs/11-seguridad.md`) se corre en cada paso y debe estar en verde para cerrar la fase. Cada fase suma sus pruebas:

| Fase | Se agrega |
|---|---|
| 1 | Script `pnpm security`, cabeceras, manejador global de errores, registro con redacción, `access-matrix.test.ts`, lint de seguridad |
| 2 | Pruebas de inyección en todos los campos de texto, límites de tamaño |
| 3 | Casos de abuso por caso de uso (pagar de más, doble entrega, cantidades enormes), fallo a mitad de cada operación, CSV seguro |
| 4 | Endurecimiento de Electron, importación de archivos no confiables, aviso de la copia sin cifrar |
| 5 | Autenticación completa, alertas, aviso de privacidad, revisión externa (ver `11`) |

## Reglas de trabajo para todas las fases

1. Regla en `core` con prueba **antes** que el caso de uso, y caso de uso **antes** que la pantalla.
2. Cada caso de uso: una transacción, una prueba que verifica que si falla a la mitad no queda nada escrito.
3. Cada tabla nueva: `workspace_id`, índice que empiece por él, y su prueba de aislamiento.
4. Cada pantalla se compara contra el mockup antes de marcarse "igual".
5. Nada fuera del alcance de `01`; lo nuevo se anota en "Después" de `09`.
6. Los textos de interfaz solo en `i18n/es.ts`.
7. Un cambio de comportamiento actualiza su documento en el mismo commit (reglas → `04`, pantallas → `06`, operaciones → `12`, textos → `13`).
8. Cada operación nueva aparece en `12` **antes** de programarse, y su fila define las pruebas (`14 §4`).

---

## Prompt estándar para cada fase

Los prompts completos (con su lista de lecturas y su criterio de terminado) están en `prompts.md`. Esta es la versión corta:

```
Haz la fase N de docs/10-plan-de-construccion.md en modo autónomo.
Sigue el protocolo de CLAUDE.md. Lee solo los documentos que la fase indica
en "Leer". No me hagas preguntas salvo los casos de parada de CLAUDE.md.
Al terminar escribe docs/informe-fase-N.md y actualiza docs/progreso.md.
```
