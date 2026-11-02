# 10 · Plan de construcción

Qué se hace en cada fase, en qué orden, **qué archivos se crean** y qué documentos leer antes. `09` da la visión; este documento es la lista de trabajo.

**Cómo usarlo:** se trabaja una fase a la vez, en modo autónomo (`CLAUDE.md › Modo autónomo`). Cada paso termina con sus pruebas pasando. Al cerrar una fase se actualiza `docs/progreso.md` y se escribe un informe corto (`docs/11-resultado-fase-N.md`) cuando la fase tiene decisiones o mediciones.

**Archivos de referencia que se copian al repositorio desde el inicio**
```
reference/
  Quick Robot mockup.html          comportamiento de referencia
  mockup-backup-v7.json            copia de seguridad del mockup con datos de ejemplo
```

---

## Fase 1 · Cimientos y esqueleto que camina

**Objetivo:** el monorepo listo y un recorrido completo mínimo (crear un filamento con un rollo y verlo en la lista) en el navegador, con los datos guardados en un archivo local (PGlite). Electron todavía no.
**Leer:** `CLAUDE.md`, `02`, `03`, `05` (tablas de filamento), `07`, `08`.

### 1.0 Comprobación de PGlite (un día)
Criterios en `02 §4`. Carpeta desechable `spikes/pglite/` con: `schema.ts`, `migrations/`, `seed-load.ts` (~5 000 ventas), `report-query.ts`, `bench.ts`, `crash-test.ts`, `rls-test.ts`, `electron-smoke/` (prueba de humo de PGlite dentro de Electron empaquetado). Resultado en `docs/decisiones.md` (pasa / falla con el dato medido). Si falla, se aplica el plan B de `02 §4` y se continúa.

### 1.1 Monorepo y herramientas
```
package.json, pnpm-workspace.yaml, tsconfig.base.json, .nvmrc, .gitignore
eslint.config.js                 con no-restricted-imports según 03 (fronteras)
.dependency-cruiser.cjs          verifica las flechas permitidas
vitest.workspace.ts
.github/workflows/ci.yml         instalar, lint, typecheck, test
docs/progreso.md                 una fila por pantalla
```
Prueba de las fronteras: un archivo de ejemplo que viola una regla debe **romper** el lint (se deja como prueba negativa).

### 1.2 `packages/core` (primeras reglas)
```
packages/core/package.json, tsconfig.json
src/money.ts                      centavos ↔ pesos, round2, formato
src/filament.ts                   costo por gramo, promedio ponderado, orden de rollos, descontar, faltante
src/index.ts
test/money.test.ts
test/filament.test.ts             casos 1.1 y 1.2 de 04
```

### 1.3 `packages/contract`
```
src/errors.ts                     códigos de error de negocio
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
src/deps.ts                        AuthProvider, FileStore, Entitlements, Mailer
src/providers/local/auth.ts        sesión fija
src/providers/local/entitlements.ts  siempre permite
src/providers/local/files.ts       carpeta en disco
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
src/i18n/es.ts
src/app/main.tsx, router.tsx, providers.tsx
src/lib/api.ts                     cliente tipado
src/lib/platform.ts                window.desktop si existe, navegador si no
src/components/                    Button, Field, UnitInput, Dialog, Drawer, Toast, Table, Pill, Segmented
src/components/AppShell.tsx        barra lateral, cabecera, atajos mínimos
src/features/filament/             FilamentList.tsx, SpoolDialog.tsx, api.ts
```

### 1.7 Semilla de desarrollo
```
packages/db/seed/quick-robot.ts    datos de ejemplo del mockup (solo desarrollo)
pnpm dev                           servidor local + web con la semilla
```

**Pruebas:** casos 1.1 y 1.2; aislamiento; el lint rechaza una frontera rota; un test de integración "agregar rollo → aparece en la lista".
**Terminado cuando:** se agrega un rollo en el navegador y queda guardado en el archivo local; las pruebas de `core` y de aislamiento pasan; el lint rechaza una frontera rota.

---

## Fase 2 · Taller y catálogo

**Objetivo:** poder costear piezas con los mismos números que el mockup.
**Leer:** `04 §1–3, §9, §11`, `05` (taller y catálogo), `06 §3, §6–8, §15`.

### 2.1 Golden tests del mockup
```
tools/export-mockup-golden.mjs     abre el mockup, exporta costos y precios de cada pieza/colección
packages/core/test/golden/mockup-values.json
```
Esta tabla es el criterio de la fase: el producto debe dar los mismos valores.

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
| Ajustes de costos y canales | `workspace-settings.ts`, `sales-channel.ts`, `catalog-item.ts` | `update-settings.ts`, `add-channel.ts`, `remove-channel.ts` | `settings.ts` |
| Proveedores | `supplier.ts` | `create/update/delete-supplier.ts` | `suppliers.ts` |
| Insumos | `supply.ts`, `supply-movement.ts` | `create-supply`, `record-supply-purchase`, `record-supply-movement` | `supplies.ts` |
| Filamento (completar) | — | `update-spool`, `delete-spool`, `record-spool-movement` | `filament.ts` |
| Impresoras | `printer.ts`, `maintenance-task.ts` | `create-printer`, `update-printer`, `complete-maintenance` (crea gasto) | `printers.ts` |
| Productos y colecciones | `product.ts`, `product-filament.ts`, `product-supply.ts`, `collection.ts` | `save-product`, `save-product-as-variant`, `delete-product`, `save-collection` | `products.ts`, `collections.ts` |

Cada caso de uso con su prueba; cada tabla con prueba de aislamiento.

### 2.4 Pantallas (`apps/web/src/features/`)
`settings/`, `supplies/`, `printers/`, `filament/` (cajón de rollos y movimientos), `products/` (lista, **calculadora** con desglose en vivo usando `core`, colección).

**Terminado cuando:** `golden.test.ts` pasa para todas las piezas y colecciones de ejemplo, y las pantallas de la fase se ven y se comportan como el mockup.

---

## Fase 3 · Vender y producir

**Objetivo:** todos los flujos A–F de `06 §17`.
**Leer:** `04 §4–8, §10, §12–13`, `05` (existencias, ventas, pedidos, producción), `06` completo.

Orden interno (cada paso depende del anterior). Cada uno: reglas en `core` con prueba → tablas → casos de uso con prueba de transacción → rutas → pantalla.

| Paso | `core` | `db` | `server/usecases` | `web/features` |
|---|---|---|---|---|
| **3.1 Existencias** | `stock.ts`, `line-items.ts` (caso 4.1, 5.1) | `stock-movement.ts` | `enable-stock-tracking`, `adjust-stock` | `stock/` |
| **3.2 Clientes** | `customers.ts` | `customer.ts` | `create/update/delete-customer` | `customers/` (lista y ficha) |
| **3.3 Ventas** | `sales.ts` (casos 6.1, 6.2) | `sale.ts`, `line-item.ts`, `payment.ts` | `create-sale`, `update-sale`, `delete-sale`, `record-sale-payment`, `return-sale` | `sales/` + **armador** (`features/builder/`) |
| **3.4 Pedidos** | `orders.ts` (casos 7.1, 7.2) | `order.ts` | `create-order`, `update-order`, `accept-order`, `record-order-payment`, `cancel-order`, `delete-order` | `orders/` (lista, calendario, página con pestañas) |
| **3.5 Producción y colas** | `production.ts` | `print-run.ts`, `print-queue-entry.ts` | `start-production`, `reassign-printers`, `finish-queue-entry`, `mark-order-ready`, `deliver-order`, `log-print-run`, `delete-print-run` | `production/`, parte de `printers/` |
| **3.6 Gastos** | `expenses.ts` (caso 10.1) | `expense.ts` | `create/update/delete-expense` | `expenses/` |
| **3.7 Reportes y Compras** | `reports.ts`, compras en `stock.ts`/`filament.ts` (caso 9.1) | vistas/consultas | consultas (sin escritura) | `reports/`, `purchases/` |
| **3.8 Inicio, documentos, búsqueda, atajos** | atenciones del brief (`06 §2`) | — | consulta `home-brief` | `home/`, `components/DocumentSheet.tsx`, `CommandPalette.tsx`, `Shortcuts.tsx` |

**Pruebas de flujo (Playwright):** `e2e/flow-a-quick-sale.spec.ts` … `flow-f-purchases.spec.ts`, una por flujo de `06 §17`. Se corren contra el servidor con la semilla.
**Terminado cuando:** pasan los seis flujos y los casos 4.1–10.1 de `04`; ninguna pantalla de las 14 + 5 queda sin construir.

---

## Fase 4 · Electron y uso diario

**Objetivo:** envolver la web en Electron y reemplazar el mockup por la app real con tus datos.
**Leer:** `05` (importar el mockup), `08` (migraciones, seguridad).

| Paso | Archivos |
|---|---|
| Cáscara de Electron | `apps/desktop/src/main.ts` (arranca el servidor dentro de la app en `127.0.0.1`, puerto aleatorio y secreto por arranque, y abre la ventana), `preload.ts`, `local-deps.ts`, `electron-builder.yml` (.dmg) |
| Importador del mockup v7 | `packages/server/src/usecases/import-workspace.ts`, `tools/import-mockup.ts`, `test/import-mockup.test.ts` (compara sumas de rollos, existencias y totales de ventas antes/después) |
| Exportar y restaurar | `usecases/export-workspace.ts`, pantalla Ajustes › Copia de seguridad |
| Copia de seguridad (un solo archivo) y migraciones locales con copia previa | `apps/desktop/src/backup.ts`, `packages/db/src/migrate-local.ts` |
| Vaciar negocio | `usecases/clear-workspace.ts` |
| Pulido de Electron | `apps/desktop/src/menu.ts`, abrir al iniciar sesión, ícono. Sin actualización automática ni firma de Apple por ahora (se instala la versión nueva a mano) |
| Revisión pantalla por pantalla | `docs/progreso.md` (cada fila: "igual al mockup") |

**Terminado cuando:** la app abre desde el `.dmg`, tus datos se importan sin diferencias, una actualización de prueba conserva los datos y llevas una semana usándola en lugar del mockup.

---

## Fase 5 · Producto público

**Objetivo:** abrir a otros negocios con suscripción.
**Leer:** `02 §5`, `08` (cuentas, suscripción, seguridad).

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

## Reglas de trabajo para todas las fases

1. Regla en `core` con prueba **antes** que el caso de uso, y caso de uso **antes** que la pantalla.
2. Cada caso de uso: una transacción, una prueba que verifica que si falla a la mitad no queda nada escrito.
3. Cada tabla nueva: `workspace_id`, índice que empiece por él, y su prueba de aislamiento.
4. Cada pantalla se compara contra el mockup antes de marcarse "igual".
5. Nada fuera del alcance de `01`; lo nuevo se anota en "Después" de `09`.
6. Los textos de interfaz solo en `i18n/es.ts`.
7. **Seguridad (`11`)**: `pnpm security` en verde; cada ruta con `guard(acción)` y en las pruebas de `packages/server/test/security/`; cada caso de uso en la prueba de fallo a mitad de operación; cada funcionalidad nueva con sus 3 renglones en `docs/amenazas.md`. Fase 4: Electron endurecido (`contextIsolation`, `sandbox`, sin `nodeIntegration`, navegación solo a su dirección, secreto por arranque) e importación de copias validada como archivo no confiable. Fase 5: A04 y A07 completos (cuentas, Argon2id, cookies, CSRF, HSTS, respaldos, revisión externa).

---

## Prompt estándar para cada fase

```
Haz la fase N de docs/10-plan-de-construccion.md en modo autónomo.
Sigue el protocolo de CLAUDE.md. Lee solo los documentos que la fase indica
en "Leer". No me hagas preguntas salvo los casos de parada de CLAUDE.md.
Al terminar escribe docs/informe-fase-N.md y actualiza docs/progreso.md.
```
