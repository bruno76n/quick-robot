# 12 · API

Contrato completo entre la interfaz y el servidor: **cada operación con su entrada, su salida y sus errores**. Es la versión detallada de `08 › Forma de la API`. Los esquemas Zod de `packages/contract` se escriben a partir de este documento; si algo cambia, cambia aquí primero.

Los nombres de los casos de uso son los de `06 §16`. Los textos en español de cada error están en `13`.

---

## 1. Reglas generales

| Tema | Regla |
|---|---|
| Base | `/api/v1`. Un cambio que rompa compatibilidad crea `/api/v2`; no se modifica la versión publicada |
| Formato | JSON UTF-8. Claves en `camelCase` en inglés (`unitCostCents`, `dueOn`) |
| Dinero | **Enteros en centavos**, claves terminadas en `Cents`. La interfaz formatea; nunca se manda un decimal de pesos |
| Gramos, horas, porcentajes | Números con un decimal (g), dos (h) y dos (%). Claves `grams`, `hours`, `…Pct` |
| Fechas | Día de calendario: `"2026-11-01"`. Momento: ISO 8601 en UTC (`"2026-11-01T18:30:00Z"`) |
| Ids | UUID v7 en texto |
| Sesión (local) | Encabezado `Authorization: Bearer <secreto de arranque>`. Lo agrega la ventana de Electron (o el proxy de Vite en desarrollo); el código de la interfaz no maneja el secreto |
| Sesión (nube) | Cookie `HttpOnly; Secure; SameSite=Lax` + encabezado `X-CSRF-Token` en toda petición que escribe (fase 5) |
| Contexto | Cada ruta resuelve `ctx = { workspaceId, userId, role }` **antes** de hacer nada. Un id de otro negocio responde `404` |
| Rastreo | Toda respuesta trae `X-Request-Id`. Los errores 500 además traen `errorId` en el cuerpo |
| Idempotencia | Las transiciones de estado se protegen por **estado**, no por llave: repetir `deliver` responde `409 ORDER_INVALID_STATE`. La interfaz además deshabilita el botón mientras la petición está en curso |
| Concurrencia | Una persona por negocio en esta etapa: sin control de versiones por registro. En la fase 5 se agrega `If-Match` con `updatedAt` |

### Éxito

```json
{ "data": { … }, "warnings": [ { "code": "FILAMENT_SHORTFALL", "details": { … } } ] }
```
- `data` es el recurso resultante (o el resumen de la operación). `warnings` es opcional: la operación **se hizo**, pero hay algo que avisar.
- Las listas devuelven `data: { items, page, pageSize, total }`. Parámetros: `page` (desde 1), `pageSize` (50 por defecto, máximo 200), `q` (texto), `sort` (`campo` o `-campo`), `from` y `to` (fechas).
- Una escritura **devuelve el recurso ya actualizado**; la interfaz no necesita volver a pedirlo.

### Error

```json
{ "code": "INSUFFICIENT_STOCK", "message": "Not enough free stock for 2 items", "details": { … }, "errorId": "…" }
```
- `code`: estable, en `UPPER_SNAKE`. La interfaz lo traduce a español con `13`.
- `message`: inglés, para quien depura. **Nunca** se muestra a la persona.
- `details`: los datos con que la interfaz arma el texto (cantidades, nombres, folios). Nunca trazas ni SQL.
- `errorId`: solo en `5xx`; también queda en el registro.
- Un error de validación trae `details.fields = [ { path: "items[0].qty", rule: "too_small", params: { min: 1 } } ]`.

### Códigos HTTP

| Código | Cuándo |
|---|---|
| 200 / 201 / 204 | Éxito / creado / borrado sin cuerpo |
| 401 | Sin sesión o sesión vencida |
| 403 | Sin permiso por rol o por plan (fase 5). Nunca para ids de otro negocio |
| 404 | No existe **o es de otro negocio** |
| 409 | Choca con el estado actual de los datos (estado del pedido, existencias, nombre repetido, tiene historial) |
| 413 / 415 | Archivo o cuerpo demasiado grande / tipo no admitido |
| 422 | El cuerpo tiene forma válida pero rompe una regla (monto mayor al permitido, sin artículos) |
| 429 | Demasiadas peticiones (fase 5, ver `15`) |
| 500 / 503 / 507 | Falla inesperada / la app se está iniciando o migrando / disco lleno |

---

## 2. Catálogo de errores

"Siempre posibles" en cualquier operación: `UNAUTHENTICATED` (401), `VALIDATION_ERROR` (422), `NOT_FOUND` (404), `PAYLOAD_TOO_LARGE` (413), `RATE_LIMITED` (429), `INTERNAL_ERROR` (500), `SERVICE_UNAVAILABLE` (503), `STORAGE_FULL` (507). Las tablas de cada área solo listan los de negocio.

| Código | HTTP | `details` | Cuándo |
|---|---|---|---|
| `VALIDATION_ERROR` | 422 | `fields[]` | Falta un dato, formato inválido, fuera de rango, fecha final antes de la inicial |
| `UNAUTHENTICATED` | 401 | — | Sin sesión / secreto incorrecto |
| `FORBIDDEN` | 403 | `capability` | El rol no puede hacerlo (fase 5) |
| `PLAN_LIMIT` | 403 | `capability`, `limit` | El plan no permite más (fase 5) |
| `NOT_FOUND` | 404 | `entity` | No existe o es de otro negocio |
| `PAYLOAD_TOO_LARGE` | 413 | `maxBytes` | Cuerpo mayor al límite de la ruta |
| `FILE_TOO_LARGE` | 413 | `maxMb` | Archivo mayor al límite: imágenes 8 MB (logos) o 12 MB (fotos de pieza e impresión); copia de seguridad al importar 100 MB en local y 50 MB en la nube (`15 §4`) |
| `UNSUPPORTED_IMAGE` | 415 | `accepted[]` | No es JPG, PNG o WebP, o no se puede leer |
| `RATE_LIMITED` | 429 | `retryAfterSec` | Demasiadas peticiones |
| `STORAGE_FULL` | 507 | — | No hay espacio en el disco al escribir (solo local); lo anterior queda intacto |
| `INTERNAL_ERROR` | 500 | — (+`errorId`) | Falla inesperada; lo hecho se revirtió completo |
| `SERVICE_UNAVAILABLE` | 503 | — | Arrancando o aplicando migraciones |
| `RESTORE_CONFLICT` | 409 | `entity`, `reason` | "Deshacer" ya no es posible (el nombre ya lo usa otro registro) |
| `PRODUCT_IN_ACTIVE_ORDERS` | 409 | `count`, `folios[]` | Eliminar una pieza que está en pedidos sin entregar |
| `PRODUCT_HAS_STOCK` | 409 | `onHand` | Eliminar una pieza con existencias físicas |
| `PRODUCT_HAS_VARIANTS` | 409 | `count` | Eliminar una original que aún tiene variantes vivas (ronda 2) |
| `STOCK_TRACKING_HAS_STOCK` | 409 | `onHand` | Dejar de llevar existencias con piezas en la repisa |
| `COLLECTION_EMPTY` | 422 | — | Colección sin piezas |
| `NO_PRODUCTS` | 409 | — | Crear una colección sin que existan piezas |
| `LINE_ITEMS_REQUIRED` | 422 | — | Venta o pedido sin artículos |
| `CUSTOMER_REQUIRED` | 422 | — | Pedido sin cliente |
| `INSUFFICIENT_STOCK` | 409 | `items[]` (`productId`, `name`, `requested`, `free`) | Venta que pide más de lo libre |
| `PAYMENT_EXCEEDS_BALANCE` | 422 | `balanceCents` | Abono o pago mayor al saldo |
| `REFUND_EXCEEDS_PAID` | 422 | `paidCents` | Reembolso mayor a lo pagado |
| `SALE_ALREADY_RETURNED` | 409 | — | Devolver una venta ya devuelta |
| `ORDER_INVALID_STATE` | 409 | `status`, `expected[]` | Transición que no corresponde al estado actual |
| `ORDER_NOT_ACTIVE` | 409 | `status` | Modificar un pedido entregado o cancelado |
| `PRINTER_ASSIGNMENT_REQUIRED` | 422 | `count`, `lineItemIds[]` | Poner en producción con artículos sin impresora |
| `NO_PRINTERS` | 409 | — | Producir sin impresoras registradas |
| `CUSTOMER_NAME_EXISTS` | 409 | `name` | Nombre de cliente repetido (sin importar mayúsculas ni acentos) |
| `CUSTOMER_HAS_HISTORY` | 409 | `orders`, `sales` | Eliminar un cliente con pedidos o ventas |
| `CHANNEL_NAME_EXISTS` | 409 | `name` | Canal repetido |
| `CHANNEL_IN_USE` | 409 | `name`, `sales`, `orders` | Quitar un canal con ventas o pedidos (se puede renombrar) |
| `LAST_CHANNEL` | 409 | — | Quitar el único canal |
| `NO_SPOOL_FOR_FILAMENT` | 409 | — | Registrar movimiento o usar un filamento sin rollos |
| `NO_SPOOLS` | 409 | — | Registrar una impresión sin ningún rollo |
| `SPOOL_INSUFFICIENT` | 422 | `availableGrams` | Descontar de un rollo más de lo que tiene |
| `SUPPLY_NAME_EXISTS` | 409 | `name` | Insumo repetido |
| `SUPPLY_IN_USE` | 409 | `products` | Eliminar un insumo que usan piezas |
| `SUPPLY_INSUFFICIENT` | 422 | `available` | Usar más de lo que hay |
| `COUNT_UNCHANGED` | 422 | — | Ajuste cuyo conteo coincide con el actual |
| `PRINTER_HAS_QUEUE` | 409 | `name`, `jobs` | Eliminar una impresora con trabajos en cola |
| `PRINT_RUN_LOCKED` | 409 | `reason` (`order_history` \| `pieces_unavailable`), `pieces` | Eliminar un registro que no se puede deshacer (`04 §8`) |
| `CONFIRMATION_REQUIRED` | 422 | — | Operación destructiva sin `confirm: true` |
| `IMPORT_INVALID_FILE` | 422 | `reason` | Copia ilegible, truncada o con datos inválidos |
| `IMPORT_UNSUPPORTED_VERSION` | 422 | `found`, `supported` | Copia de una versión que la app no entiende |

Reservados para la fase 5 (se definen en `16`): `INVALID_CREDENTIALS`, `EMAIL_TAKEN`, `TOKEN_EXPIRED`, `ACCOUNT_LOCKED`, `SUBSCRIPTION_INACTIVE`.

### Avisos (`warnings`): la operación sí se hizo

| Código | `details` | Dónde aparece |
|---|---|---|
| `STOCK_SHORT` | `missing` | `acceptOrder`: no alcanzaron las piezas planeadas de existencias; el resto se imprime |
| `FILAMENT_SHORTFALL` | `items[]` (`filamentId`, `name`, `missingGrams`) | `startProduction`, `logPrintRun`: se descontó lo que había y faltó |
| `ORDER_WAITING_OTHER_PRINTERS` | `orderNumber`, `printerNames[]` | `finishQueueEntry`: el pedido aún tiene trabajos en otras impresoras |
| `PRODUCTS_MISSING` | `count` | `GET /sales/:id` y `/orders/:id` al editar: piezas que ya no existen en el catálogo |
| `FILAMENT_NOT_RETURNED` | — | `deletePrintRun` de un registro anterior sin movimientos de rollo |

---

## 3. Tipos comunes

```
LineItemInput = {
  kind: 'piece' | 'set',
  productId?: Id,            // si kind = 'piece'
  collectionId?: Id,         // si kind = 'set'
  qty: int ≥ 1,
  priceCents: int ≥ 0,       // el precio unitario que se cobra
  fromStock?: { [productId]: int }   // solo pedidos: cuántas salen de la repisa
}
```
**Lo que el servidor agrega y la interfaz nunca manda:** `name`, `listCents`, `costCents`, `extrasCents`, `parts` (las partes del set) — la foto del momento (`04 §4`). Si la interfaz mandara un costo, se ignora. El `name` de una pieza (y de cada parte de un set) es su `displayName` del momento: una variante se guarda como “original · etiqueta”; cambiar la etiqueta después no reescribe ventas ni pedidos ya guardados. Los nombres de `INSUFFICIENT_STOCK`, la búsqueda (que también busca en `variant_label`), las partes de las colecciones y la clasificación de Reportes (cada variante por separado) usan `displayName`.

```
LineItem   = LineItemInput + { id, name, listCents, costCents, parts?, printerId? }
Payment    = { id, on: Date, amountCents (negativo = reembolso), note }
Breakdown  = { materialCents, powerCents, machineCents, extrasCents, failureReserveCents, costCents }
Page<T>    = { items: T[], page, pageSize, total }
```

---

## 4. Sistema, ajustes y negocio

| Operación | Entrada | Salida | Errores |
|---|---|---|---|
| `GET /health` (sin sesión) | — | `{ ok, version, schemaVersion }` | — |
| `GET /me` | — | `{ user, workspace, role }` | — |
| `GET /settings` | — | `{ settings, channels[], catalogs }` donde `catalogs = { materials, colors, brands, customerTypes, expenseCategories }`. `settings` incluye `lastBackupOn` (solo lectura: lo fija `exportWorkspace`) | — |
| `updateSettings` · `PATCH /settings` | Cualquiera de: `kwhPriceCents`, `failurePct`, `purgePct`, `minMarginPct`, `formulaMarginPct`, `business { name, trade, phone, email, city, quoteValidDays, footer }` | `settings` | — |
| `addChannel` · `POST /channels` | `{ name, commissionPct }` | `channel` | `CHANNEL_NAME_EXISTS` |
| `updateChannel` · `PATCH /channels/:id` | `{ name?, commissionPct?, position? }` | `channel` | `CHANNEL_NAME_EXISTS` |
| `removeChannel` · `DELETE /channels/:id` | — | 204 | `CHANNEL_IN_USE`, `LAST_CHANNEL` |

Los catálogos (material, color, marca, tipo de cliente, categoría de gasto) **no tienen rutas**: se crean solos cuando una operación recibe un valor nuevo (`addSpool` con un color nuevo, `createCustomer` con un tipo nuevo).

**Invalidan:** `settings`, y `reports`/`home` cuando cambia un porcentaje.

---

## 5. Productos y colecciones

| Operación | Entrada | Salida | Errores |
|---|---|---|---|
| `GET /products` | `q`, `filter` (`all` \| `technical` \| `with_variants`), `tag`, `page`, `pageSize` (50 por defecto, máx. 200) | **Página de familias** (la paginación cuenta familias, no piezas): `{ id, name, displayName, tags, photoUrl, costCents, listCents, floorCents, tracksStock, free, material, variantCount, variants[], matchedByVariant }`, donde cada variante trae `{ id, name, label, displayName, costCents, listCents, floorCents, tracksStock, free, physical, reserved, soldCount, material, hexes[], technical, … }` (`material` = “PLA Silk Morado”, material y color de sus filamentos). Una pieza sin variantes trae `variants: []`. También devuelve `total` (familias que cumplen) y `counts { families, technical, withVariants }` para los chips y la pestaña; `counts` aplica la búsqueda y la etiqueta pero no el filtro. Una familia cumple la búsqueda, la etiqueta o “Técnica” si **cualquiera** de sus miembros la cumple (nombre, `variant_label` o etiquetas); `matchedByVariant` = el texto solo coincide con una variante (la pantalla abre su panel). Dos consultas de piezas por página (originales y luego `parent_id IN (…)`), no una por tarjeta. (`variant` ya no existe como valor de `filter`: `VALIDATION_ERROR`.) Cada familia conserva además lo que pintan las fichas del mockup: `technical`, `mode`, `hexes[]`, `hours`, `printerId`, `printerName`, `collections[]`, `sold`, `physical`, `reserved` | — |
| `GET /products/options` | — | **Lista plana para selectores** (armar venta o pedido, registrar impresión, colección, CSV): `{ items[] }` con **todas** las piezas vivas, cada una con los campos de una pieza de la lista (`id`, `name`, `displayName`, `variantLabel`, `parentId`, `listCents`, `costCents`, `free`, `physical`, `tracksStock`, `hours`, `hexes[]`, `collections[]`, …), **ordenadas por familia** (la original y enseguida sus variantes). Sin paginar: el catálogo es pequeño (`15 §3.1`). No agrupa variantes (`mejoras/ronda-2.md §6`) | — |
| `GET /products/:id` | — | Pieza completa + `breakdown`, `suggestedCents`, `floorCents`, `listCents`, `profitByChannel[]`, `stock { physical, reserved, free }` | — |
| `saveProduct` · `POST /products` y `PUT /products/:id` | `{ name, tags[], mode ('value' \| 'formula'), priceCents?, marginPct?, printerId? (nulo = promedio), hours, batchSize, extrasCents, tracksStock, filaments[{ filamentId, grams }], supplies[{ supplyId, qty }], spec{…}, note, photoFileId?, variantLabel? }` (`variantLabel` solo cambia la etiqueta de una variante; en una original se ignora) | Pieza completa con `displayName` (el costo lo recalcula el servidor) | `STOCK_TRACKING_HAS_STOCK` |
| `saveProductAsVariant` · `POST /products/:id/variant` | Igual que `saveProduct` más `variantLabel` (1–60, obligatorio); crea una copia con `parentId` = la **original raíz** de `:id` (si `:id` es una variante, se sube a su original). Sin etiqueta o con más de 60 letras: `VALIDATION_ERROR` (`variantLabel`) | Pieza nueva con `displayName` | — |
| `deleteProduct` · `DELETE /products/:id` | — | 204 (borrado suave). Una variante se puede eliminar sola; una original con variantes vivas, no | `PRODUCT_HAS_VARIANTS` (`count` = variantes vivas), `PRODUCT_IN_ACTIVE_ORDERS`, `PRODUCT_HAS_STOCK` |
| `restoreProduct` · `POST /products/:id/restore` | — | Pieza | `RESTORE_CONFLICT` |
| `GET /collections` | `q`, `page` | Página de `{ id, name, tags, listCents, costCents, buildableSets }` más `looseCents`, `pieces`, `partNames[]`, `typedPrice`, `sold`, `hexes[]`, `partHexes[]` | — |
| `GET /collections/:id` | — | Colección + partes `{ productId, name, qty }` + costo, precio, ganancia, `looseCents`, `buildableSets` | — |
| `saveCollection` · `POST /collections` y `PUT /collections/:id` | `{ name, tags[], parts[{ productId, qty }], extrasCents, priceCents? (vacío = suma de sueltas), note }` | Colección completa | `COLLECTION_EMPTY`, `NO_PRODUCTS` |
| `deleteCollection` · `DELETE /collections/:id` | — | 204 | — |
| `restoreCollection` · `POST /collections/:id/restore` | — | Colección | `RESTORE_CONFLICT` |

*Cotizar* (cantidad → total y tiempo) y la vista previa de la calculadora se calculan en el navegador con `core`; no tienen ruta.

**Invalidan:** `products`, `collections`, y `stock` / `reports` / `home` cuando cambia costo o existencias.

---

## 6. Ventas

| Operación | Entrada | Salida | Errores |
|---|---|---|---|
| `GET /sales` | `channelId`, `customerId`, `from`, `to`, `q`, `page` | Página de `{ id, on, channel, customer, itemsText, totalCents, profitCents, owedCents, returned, orderId? }` | — |
| `GET /sales/:id` | — | Venta con `items[]` (cada uno con `breakdown` por pieza y su origen), `payments[]`, `totals { grossCents, commissionCents, costCents, profitCents, paidCents, owedCents }` | — |
| `createSale` · `POST /sales` | `{ on, channelId, customerId?, note?, items: LineItemInput[], paidNowCents? }`. Si `paidNowCents` es menor al total, se crea un pago parcial; si falta, se considera pagada completa | Venta. Descuenta existencias de las piezas con `tracksStock` | `LINE_ITEMS_REQUIRED`, `INSUFFICIENT_STOCK` |
| `updateSale` · `PATCH /sales/:id` | `{ on?, channelId?, customerId?, note? }` (los artículos no se editan) | Venta | — |
| `deleteSale` · `DELETE /sales/:id` | — | 204. Las piezas que salieron regresan a existencias | — |
| `restoreSale` · `POST /sales/:id/restore` | — | Venta | `RESTORE_CONFLICT`, `INSUFFICIENT_STOCK` |
| `recordSalePayment` · `POST /sales/:id/payments` | `{ on, amountCents > 0, note? }` | Venta | `PAYMENT_EXCEEDS_BALANCE` |
| `deleteSalePayment` · `DELETE /sales/:id/payments/:paymentId` | — | Venta | — |
| `returnSale` · `POST /sales/:id/return` | `{ on, restock: bool, refundCents? ≥ 0, note? }` | Venta (ingreso 0; `restock` repone existencias y costo 0, si no se pierde el costo) | `SALE_ALREADY_RETURNED`, `REFUND_EXCEEDS_PAID` |

**Invalidan:** `sales`, `stock`, `customers`, `reports`, `home`.

---

## 7. Pedidos

| Operación | Entrada | Salida | Errores |
|---|---|---|---|
| `GET /orders` | `status` (uno o varios), `view` (`board` \| `list` \| `calendar`), `month` (`2026-11`), `q`, `page`. En `board` devuelve todos los activos y los 3 entregados más recientes | Página de `{ id, number, customer, status, dueOn, itemsText, items[], jobs[], totalCents, owedCents, profitCents, origins[], queueProgress? }` | — |
| `GET /orders/:id` | — | Pedido con `items[]` (desglose y origen de cada pieza), `payments[]`, `totals`, `queue[]` (por impresora, con avance), `material { needs[], shortfall[] }`, `nextStep` | — |
| `createOrder` · `POST /orders` | `{ customerId, channelId, createdOn, dueOn, accepted: bool, note?, items: LineItemInput[], depositCents? }`. `accepted = false` crea un **cotizado**; `true` crea y ejecuta `acceptOrder`. El anticipo crea un pago | Pedido (folio asignado por el servidor) + `warnings` (`STOCK_SHORT`) | `CUSTOMER_REQUIRED`, `LINE_ITEMS_REQUIRED` |
| `updateOrder` · `PUT /orders/:id` | Igual que `createOrder` (sin `accepted`). Solo en Cotizado o Aceptado | Pedido | `ORDER_NOT_ACTIVE`, `CUSTOMER_REQUIRED`, `LINE_ITEMS_REQUIRED` |
| `deleteOrder` · `DELETE /orders/:id` | — | 204. Sale de colas; las piezas apartadas se liberan | — |
| `restoreOrder` · `POST /orders/:id/restore` | — | Pedido | `RESTORE_CONFLICT` |
| `acceptOrder` · `POST /orders/:id/accept` | — | Pedido en `accepted`; aparta lo planeado de existencias | `ORDER_INVALID_STATE` · aviso `STOCK_SHORT` |
| `startProduction` · `POST /orders/:id/start-production` | `{ assignments: [{ lineItemId, printerId }], deductFilament: bool }` | Pedido en `in_production` con su cola | `ORDER_INVALID_STATE`, `PRINTER_ASSIGNMENT_REQUIRED`, `NO_PRINTERS` · aviso `FILAMENT_SHORTFALL` |
| `reassignPrinters` · `POST /orders/:id/reassign-printers` | `{ assignments }` | Pedido (quita de las colas y vuelve a asignar) | `ORDER_INVALID_STATE`, `PRINTER_ASSIGNMENT_REQUIRED` |
| `markOrderReady` · `POST /orders/:id/ready` | — | Pedido en `ready`: sale de colas, registra impresiones si se descontó filamento, aparta piezas | `ORDER_INVALID_STATE` |
| `deliverOrder` · `POST /orders/:id/deliver` | `{ on, collectCents? ≥ 0 (cobro final; por omisión el saldo), note? }` | `{ order, sale }`: el pedido en `delivered` y la venta creada | `ORDER_INVALID_STATE`, `PAYMENT_EXCEEDS_BALANCE` |
| `cancelOrder` · `POST /orders/:id/cancel` | `{ reason, refundCents? ≥ 0 }` | Pedido en `cancelled` (pago negativo por el reembolso; no cuenta como venta) | `ORDER_INVALID_STATE`, `REFUND_EXCEEDS_PAID` |
| `recordOrderPayment` · `POST /orders/:id/payments` | `{ on, amountCents > 0, note? }` | Pedido | `ORDER_NOT_ACTIVE`, `PAYMENT_EXCEEDS_BALANCE` |
| `deleteOrderPayment` · `DELETE /orders/:id/payments/:paymentId` | — | Pedido | `ORDER_NOT_ACTIVE` |

*Estados:* `quoted → accepted → in_production → ready → delivered`, y `cancelled`. Los pasos válidos están en `04 §7`; cualquier otro responde `ORDER_INVALID_STATE` con `expected[]`.
*Atajo:* si todo el pedido sale de existencias, `markOrderReady` es válido desde `accepted`.
*El plan de producción* (distribución más rápida, tiempos, fecha de término, faltante de filamento) se calcula en el navegador con `core` para mostrarlo en el diálogo, y el servidor lo **recalcula** al ejecutar `startProduction`.

**Invalidan:** `orders`, `stock`, `printers`, `filaments` (si descuenta), `printRuns`, `sales` y `customers` (al entregar), `reports`, `home`, `purchases`.

---

## 8. Taller

### Filamentos y rollos

| Operación | Entrada | Salida | Errores |
|---|---|---|---|
| `GET /filaments` | `q`, `page` | Página de `{ id, material, color, hex, remainingGrams, spools, costPerGram, status (`no_spools` \| `out` \| `ending` \| `low` \| `new` \| `ok`), activeSpools, brands[], capacityGrams, valueCents }` (rollos con material, sus marcas y capacidad para la barra, y el valor de lo que queda) | — |
| `GET /filaments/:id` | — | Filamento con `spools[]` (restante y `status` de cada uno: `empty` \| `new` \| `in_use`) y `movements[]` | — |
| `addSpool` · `POST /spools` | `{ filamentId? \| { material, color, hex? }, brand, costCents, shippingCents, grams, purchasedOn, supplierId? }`. Si el filamento no existe, se crea. Registra el movimiento `purchase` | Rollo + filamento | — |
| `updateSpool` · `PATCH /spools/:id` | Los mismos campos | Rollo + filamento. Si cambian los gramos, se registra un movimiento `adjustment` por la diferencia (el libro no se reescribe) | — |
| `deleteSpool` · `DELETE /spools/:id` | — | `{ movements }` (cuántos tenía, para el aviso). Borrado suave; sus movimientos se conservan y dejan de sumar | — |
| `restoreSpool` · `POST /spools/:id/restore` | — | Rollo | — |
| `recordSpoolMovement` · `POST /spools/:id/movements` | `{ kind ('consumption' \| 'failure' \| 'waste' \| 'adjustment'), grams, on, note? }`. `grams` con signo: negativo saca material (consumo, fallo y merma siempre restan); un ajuste puede sumar o restar | Rollo + filamento | `SPOOL_INSUFFICIENT`, `NO_SPOOL_FOR_FILAMENT` |

### Insumos y proveedores

| Operación | Entrada | Salida | Errores |
|---|---|---|---|
| `GET /supplies` | `q`, `page` | Página de `{ id, name, unit, stock, minimum, status (`out` \| `low` \| `ok`), supplier }` | — |
| `GET /supplies/:id` | — | Insumo con `movements[]` y las piezas que lo usan | — |
| `createSupply` · `POST /supplies` | `{ name, unit, costCents, minimum, supplierId?, note?, initialStock? }` | Insumo | `SUPPLY_NAME_EXISTS` |
| `updateSupply` · `PATCH /supplies/:id` | Los mismos campos | Insumo | `SUPPLY_NAME_EXISTS` |
| `deleteSupply` · `DELETE /supplies/:id` | — | 204 (borrado suave) | `SUPPLY_IN_USE` |
| `restoreSupply` · `POST /supplies/:id/restore` | — | Insumo | `RESTORE_CONFLICT` |
| `recordSupplyPurchase` · `POST /supplies/:id/purchases` | `{ qty > 0, on, costCents?, note? }`. `costCents` es el **total pagado**: el costo por unidad pasa a ser total ÷ cantidad (como el mockup) | Insumo | — |
| `recordSupplyMovement` · `POST /supplies/:id/movements` | `{ kind ('use' \| 'adjustment' \| 'waste'), mode ('delta' \| 'count'), value, on, note? }`. Con `mode = 'count'` se manda el conteo real y el servidor calcula la diferencia | Insumo | `SUPPLY_INSUFFICIENT`, `COUNT_UNCHANGED` |
| `GET /suppliers` | — | Lista | — |
| `createSupplier` · `POST /suppliers` | `{ name, phone?, brands?, note? }` | Proveedor | — |
| `updateSupplier` · `PATCH /suppliers/:id` | Los mismos campos | Proveedor | — |
| `deleteSupplier` · `DELETE /suppliers/:id` | — | 204 (borrado suave). Los insumos y rollos que tenía se muestran sin proveedor mientras esté borrado; conservan el vínculo y lo recuperan al restaurar | — |
| `restoreSupplier` · `POST /suppliers/:id/restore` | — | Proveedor | — |

### Impresoras y mantenimiento

| Operación | Entrada | Salida | Errores |
|---|---|---|---|
| `GET /printers` | — | Lista con estado (imprimiendo/libre), `queue[]` con avance y tiempo restante, horas, `maintenance[]` con estado (`ok` \| `soon` \| `due`) y `roi { recoveredCents, pct }` | — |
| `createPrinter` · `POST /printers` | `{ name, costCents, lifeHours, maintenanceCentsPerHour, kw, purchasedOn }`. Crea las 3 tareas base | Impresora | — |
| `updatePrinter` · `PATCH /printers/:id` | Los mismos campos | Impresora | — |
| `deletePrinter` · `DELETE /printers/:id` | — | 204 (borrado suave; sus registros de producción, horas y mantenimiento se conservan, y las piezas que la usaban se calculan con el promedio mientras esté borrada) | `PRINTER_HAS_QUEUE` |
| `restorePrinter` · `POST /printers/:id/restore` | — | Impresora | — |
| `finishQueueEntry` · `POST /printers/:id/queue/:entryId/finish` | — | `{ printer, order, readyTriggered: bool }`. Arranca el siguiente trabajo; si el pedido ya no tiene nada pendiente, ejecuta `markOrderReady` | — · aviso `ORDER_WAITING_OTHER_PRINTERS` |
| `createMaintenanceTask` · `POST /printers/:id/maintenance` | `{ task, everyHours, lastHours? }` | Tarea | — |
| `updateMaintenanceTask` · `PATCH /printers/:id/maintenance/:taskId` | Los mismos campos | Tarea | — |
| `completeMaintenance` · `POST /printers/:id/maintenance/:taskId/complete` | `{ on, costCents? }`. Fija `lastHours` a las horas actuales y, si hay costo, crea un **gasto** | `{ task, expense? }` | — |
| `deleteMaintenanceTask` · `DELETE /printers/:id/maintenance/:taskId` | — | 204 | — |

### Producción y existencias

| Operación | Entrada | Salida | Errores |
|---|---|---|---|
| `GET /print-runs` | `reason` (`stock` \| `order` \| `test`), `page` | Página + totales (piezas, horas, gramos) | — |
| `GET /print-runs/:id` | — | Registro con filamento por rollo y foto | — |
| `logPrintRun` · `POST /print-runs` | `{ on, productId? (o `text` si es prueba), qty, printerId?, result ('ok' \| 'fail'), hours, reason, filaments[{ filamentId, grams }], photoFileId? }` | Registro. El filamento se descuenta rollo por rollo con la purga. `ok` + `stock` suma piezas a existencias; `ok` que no sea prueba gasta los insumos de la pieza | `NO_SPOOLS` · aviso `FILAMENT_SHORTFALL` |
| `deletePrintRun` · `DELETE /print-runs/:id` | — | 204. Devuelve filamento e insumos, quita las piezas que sumó, resta las horas | `PRINT_RUN_LOCKED` · aviso `FILAMENT_NOT_RETURNED` |
| `GET /stock` | `q` (nombre o etiqueta de cualquier miembro), `status` (`all` \| `few` \| `all_reserved` \| `ok` \| `out`), `sort` (`free_asc` por defecto \| `free_desc`; a igualdad, por nombre), `page`, `pageSize` | **Página de filas** (una pieza simple o una familia; solo piezas con `tracksStock`): `{ productId, name, displayName, photoUrl, hexes[], listCents, costCents, printerName, physical, reserved, free, status, members[] }`. Una familia suma sus miembros y su `status` sigue `04 §5` (caso 5.3); `members[]` trae `{ productId, name, label, displayName, isOriginal, printerName, physical, reserved, free, status, … }` (la original primero, con `label` nulo) y va vacío en una pieza simple. Si de una familia solo un miembro lleva existencias, sale como fila simple con su `displayName`. Además `counts { all, few, allReserved, ok, out }` (familias, sin aplicar `status`), `totals { units, pieces, free, reserved, physical }` (`pieces` cuenta familias; `physical` = `units`), `untracked[]` (piezas sin existencias, para “Llevar existencias de otra pieza”) y `sets[]` (sets armables por colección) | — |
| `GET /stock/:productId` | — | Pieza con `movements[]` | — |
| `enableStockTracking` · `POST /stock/:productId/enable` | `{ initialCount ≥ 0 }` | Pieza | — |
| `adjustStock` · `POST /stock/:productId/adjust` | `{ mode ('count' \| 'delta'), value, note }`. El conteo no baja de lo apartado; una salida no pasa de las libres | Pieza | `COUNT_UNCHANGED`, `INSUFFICIENT_STOCK`, `VALIDATION_ERROR` (`value` < apartadas) |
| `GET /purchases` | — | Lista calculada de compras agrupada por proveedor: filamento e insumos con cantidad, costo estimado y motivo (`04 §9`) | — |

**Invalidan:** `filaments`, `supplies`, `suppliers`, `printers`, `printRuns`, `stock`, `purchases`, `home`, y `expenses` (mantenimiento con costo).

---

## 9. Clientes, gastos, reportes e inicio

| Operación | Entrada | Salida | Errores |
|---|---|---|---|
| `GET /customers` | `q`, `page` | Página de `{ id, name, type, phone, purchases, owedCents }` | — |
| `GET /customers/:id` | — | Ficha: datos, logo, nota, totales (pedidos, ventas, ingreso, ganancia, por cobrar) e historial combinado de pedidos y ventas | — |
| `createCustomer` · `POST /customers` | `{ name, type, phone?, note?, logoFileId? }` | Cliente | `CUSTOMER_NAME_EXISTS` |
| `updateCustomer` · `PATCH /customers/:id` | Los mismos campos | Cliente | `CUSTOMER_NAME_EXISTS` |
| `removeCustomerLogo` · `DELETE /customers/:id/logo` | — | Cliente | — |
| `deleteCustomer` · `DELETE /customers/:id` | — | 204 | `CUSTOMER_HAS_HISTORY` |
| `restoreCustomer` · `POST /customers/:id/restore` | — | Cliente | `RESTORE_CONFLICT` |
| `GET /expenses` | `from`, `to`, `category`, `page` | Página + `periodTotalCents` y `fixedPerMonthCents` | — |
| `createExpense` · `POST /expenses` | `{ on, concept, category, amountCents, recurring, endsOn? }` | Gasto | — (la fecha final anterior a la inicial es `VALIDATION_ERROR`) |
| `updateExpense` · `PATCH /expenses/:id` | Los mismos campos | Gasto | — |
| `deleteExpense` · `DELETE /expenses/:id` | — | 204 | — |
| `restoreExpense` · `POST /expenses/:id/restore` | — | Gasto | — |
| `GET /reports` | `period` (`7` \| `30` \| `90` \| `all`) o `from` y `to` | `{ totals { salesCents, costCents, profitCents, marginPct, pieces }, byChannel[], topProducts[], expensesCents, netProfitCents, investmentRecovered }` | — |
| `GET /home` | — | `{ stats, printingNow[], attentions[] }`; cada atención trae `kind`, `severity` (`urgent` \| `soon` \| `review`, calculado por `core › classifyAttention`, `06 §2`), `target { type, id }` y `params`. Ya no manda la cuadrícula de rollos de filamento | — |
| `GET /search` | `q` (mín. 2 letras) | Grupos `{ products, customers, orders, sales, filaments, actions }`, máximo 8 por grupo | — |

**Invalidan:** `customers`, `expenses`, `reports`, `home`.

---

## 10. Archivos y datos

| Operación | Entrada | Salida | Errores |
|---|---|---|---|
| `POST /files` | `multipart/form-data`: `kind` (`product_photo` \| `customer_logo` \| `print_photo`) + `file` | `{ fileId, url }` | `FILE_TOO_LARGE`, `UNSUPPORTED_IMAGE` |
| `GET /files/:id` | — | El archivo, con `Content-Type` de la lista permitida, `X-Content-Type-Options: nosniff` y `Content-Disposition: inline` | — |
| `exportWorkspace` · `GET /workspace/export` | — | Archivo `.json` con `schemaVersion`, fecha y todas las tablas del negocio; actualiza `lastBackupOn` | — |
| `importWorkspace` · `POST /workspace/import` | `multipart`: `file` + `confirm: true`. Acepta la exportación de la app **o la copia del mockup v7**. **Primero** guarda una copia automática de lo actual; valida todo el archivo y lo aplica en **una transacción** (ids nuevos, referencias reescritas) | `{ format, counts { tabla: filas }, differences[], notes[], backupId }` | `CONFIRMATION_REQUIRED`, `IMPORT_INVALID_FILE`, `IMPORT_UNSUPPORTED_VERSION`, `FILE_TOO_LARGE` |
| `clearWorkspace` · `POST /workspace/clear` | `{ confirm: true }`. Guarda una copia antes | `{ backupId }` | `CONFIRMATION_REQUIRED` |
| `GET /backups` | — | Copias automáticas: `{ id, on, sizeKb }` (una por día, se conservan las últimas 7) | — |
| `POST /backups` | — | Crea una copia ahora | — |
| `POST /backups/:id/restore` | `{ confirm: true }` | Igual que `importWorkspace` con esa copia | `CONFIRMATION_REQUIRED`, `IMPORT_INVALID_FILE` |

Las copias automáticas las maneja la dependencia inyectada `BackupStore` (`08`). Los CSV de Ajustes (ventas, pedidos, clientes, piezas y costos, filamentos y rollos, insumos, gastos) se generan en el navegador con `apps/web/src/lib/csv.ts`, que neutraliza las celdas que empiezan con `=`, `+`, `-` o `@` (`11 › A05`).

**Invalidan:** todo (`importWorkspace`, `clearWorkspace`, restaurar).

---

## 11. Cómo se prueba este contrato

- **Una prueba por operación** (`packages/server/test/<área>.test.ts`): camino feliz, cada error de su fila, y "falla a la mitad → no queda nada escrito".
- **Matriz de acceso** (`access-matrix.test.ts`): recorre las rutas registradas con ids de otro negocio y exige `404`. Una ruta nueva que no esté en esta lista **rompe la prueba**.
- **Contrato**: las respuestas se validan contra el esquema Zod de salida en las pruebas; así `docs/12`, `contract` y el servidor no se separan.
- Más detalle en `14`.
