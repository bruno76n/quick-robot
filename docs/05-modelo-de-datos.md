# 05 · Modelo de datos

Punto de partida: el estado del mockup (esquema v7). Aquí se traduce a tablas. Nombres en inglés (glosario en `03`).

## Reglas generales

- **Todas** las tablas de negocio llevan `workspace_id` (FK a `workspace`), **también las hijas** (`product_filament`, `product_supply`, `collection_part`, `print_run_filament`…). Los índices empiezan por `workspace_id`. Las únicas tablas sin él son `workspace` (es el negocio) y `user` (una persona puede entrar a varios negocios, por `membership`).
- En una tabla hija el `workspace_id` es el de su padre y la clave foránea es compuesta, `(workspace_id, padre_id)`, para que una fila no pueda apuntar a un registro de otro negocio.
- `id`: UUID v7 (ordenable por tiempo) generado por el servidor.
- `created_at`, `updated_at` en todas; `deleted_at` en las que se pueden borrar desde la interfaz (borrado suave, para "Deshacer").
- **Dinero**: enteros en **centavos** (`*_cents`). **Gramos**: `numeric(10,1)`. **Horas**: `numeric(8,2)`. **Porcentajes**: `numeric(5,2)`.
- **Fechas de calendario** (venta, entrega, gasto): tipo `date`. **Momentos** (inicio de impresión): `timestamptz`.
- **Libros de movimientos**: solo se insertan filas; nunca se actualiza ni se borra una (salvo al deshacer un registro de producción, que borra los suyos en la misma transacción).
- **Fotos del momento**: los artículos de venta/pedido guardan precio, lista y costo en sus propias columnas.
- Los campos que en el mockup eran listas anidadas se convierten en tablas hijas cuando se consultan por separado (pagos, mantenimiento, cola) y en `jsonb` cuando solo se leen junto con su padre (ficha técnica, partes de un set congeladas en un artículo).

## Negocio y cuentas

| Tabla | Columnas principales |
|---|---|
| `workspace` | `id`, `name`, `created_at` |
| `user` | `id`, `email` (único), `name`, `password_hash` (solo nube) |
| `membership` | `workspace_id`, `user_id`, `role` (`owner` \| `admin` \| `operator`) |
| `subscription` *(solo nube)* | `workspace_id`, `plan`, `status`, `current_period_end`, `provider_customer_id` |
| `workspace_settings` | `workspace_id` (PK), `kwh_price_cents`, `failure_pct`, `purge_pct`, `min_margin_pct`, `formula_margin_pct`, `business` (jsonb: `name`, `trade`, `phone`, `email`, `city`, `quote_valid_days`, `footer`), `last_backup_on` (date, nulo si nunca) |
| `sales_channel` | `id`, `workspace_id`, `name` (único por negocio, sin importar mayúsculas), `commission_pct`, `position` |
| `catalog_item` | `workspace_id`, `kind` (`material` \| `color` \| `brand` \| `customer_type` \| `expense_category`), `name`, `name_key` (único por tipo, sin mayúsculas ni acentos), `hex` (solo colores) |

*En modo local* hay exactamente una fila de `workspace`, `user`, `membership`, con ids fijos.

## Taller

| Tabla | Columnas principales | Notas |
|---|---|---|
| `filament` | `workspace_id`, `material`, `color`, `hex` | Único por (`workspace_id`, material, color) sin importar mayúsculas |
| `spool` | `workspace_id`, `filament_id`, `brand`, `cost_cents`, `shipping_cents`, `grams`, `purchased_on`, `supplier_id?` | Un rollo = una compra |
| `spool_movement` | `workspace_id`, `spool_id`, `on`, `kind` (`purchase` \| `consumption` \| `failure` \| `waste` \| `adjustment`), `grams` (± ), `note`, `ref_id?` | `ref_id` apunta al `print_run` o pedido que lo causó |
| `supplier` | `workspace_id`, `name`, `phone`, `brands` (texto), `note` | |
| `supply` | `workspace_id`, `name`, `unit`, `cost_cents`, `minimum`, `note`, `supplier_id?` | Insumo (argollas, imanes, cajas) |
| `supply_movement` | `workspace_id`, `supply_id`, `on`, `kind` (`purchase` \| `use` \| `adjustment` \| `waste`), `qty` (±), `note`, `ref_id?` | |
| `printer` | `workspace_id`, `name`, `cost_cents`, `life_hours`, `maintenance_cents_per_hour`, `kw`, `hours` (acumuladas), `purchased_on` | |
| `maintenance_task` | `workspace_id`, `printer_id`, `task`, `every_hours`, `last_hours`, `last_on` | Tareas base: boquilla 300 h, ejes 200 h, cama 100 h |
| `print_queue_entry` | `workspace_id`, `printer_id`, `order_id`, `position`, `text`, `minutes`, `started_at?` | Una por (impresora, pedido); el primero de cada impresora tiene `started_at` |

## Catálogo de ventas

| Tabla | Columnas principales | Notas |
|---|---|---|
| `product` | `workspace_id`, `name`, `parent_id?` (variante; siempre apunta a la **original raíz**, un solo nivel), `variant_label?` (texto 1–60; obligatoria si hay `parent_id`; las listas agrupadas muestran solo la etiqueta y fuera de ellas se muestra `displayName` = “original · etiqueta”), `mode` (`value` \| `formula`), `price_cents`, `margin_pct?`, `printer_id?` (nulo = promedio), `hours`, `batch_size`, `extras_cents`, `tracks_stock` (bool), `tags` (text[]), `note`, `photo_file_id?`, `spec` (jsonb: capa, relleno, paredes, soportes, boquilla, cama, archivo, nota) | `batch_size` (piezas por placa) es informativo: sirve para planear y no cambia el costo. Los campos `prep` y `acab` del mockup no se usan en ninguna pantalla y no se migran |
| `product_filament` | `workspace_id`, `product_id`, `filament_id`, `grams` | Qué filamentos y cuántos gramos lleva |
| `product_supply` | `workspace_id`, `product_id`, `supply_id`, `qty` | |
| `collection` | `workspace_id`, `name`, `price_cents?`, `extras_cents`, `tags`, `note` | Precio vacío = suma de sueltas |
| `collection_part` | `workspace_id`, `collection_id`, `product_id`, `qty` | |

## Existencias

| Tabla | Columnas principales |
|---|---|
| `stock_movement` | `workspace_id`, `product_id`, `on`, `kind` (`initial` \| `print` \| `order_print` \| `sale` \| `return` \| `delivery` \| `adjustment`), `qty` (±), `note`, `ref_id?` |

*Físicas*, *apartadas* y *libres* **no se guardan**: se calculan (suma de movimientos, y pedidos en cierto estado). Para listas grandes se usa una vista que agrupa por pieza.

## Clientes, ventas y pedidos

| Tabla | Columnas principales | Notas |
|---|---|---|
| `customer` | `workspace_id`, `name`, `type` (`Restaurante` \| `Empresa` \| `Persona` \| `Otro`), `phone`, `has_logo`, `logo_file_id?`, `note`, `created_on` | El tipo es un catálogo por negocio |
| `order` | `workspace_id`, `number` (folio por negocio, correlativo), `customer_id` (obligatorio), `status`, `channel_id`, `note`, `created_on`, `due_on`, `ready_on?`, `delivered_on?`, `production_on?`, `filament_deducted` (bool), `runs_logged` (bool), `stock_reserved` (jsonb: pieza → cantidad apartada al quedar listo), `cancellation` (jsonb: fecha, motivo, reembolso) | `status`: `quoted`, `accepted`, `in_production`, `ready`, `delivered`, `cancelled` |
| `sale` | `workspace_id`, `on`, `channel_id`, `customer_id?`, `order_id?`, `note`, `tracks_payments` (bool: sin lista de pagos = pagada completa), `return` (jsonb: fecha, repone, reembolso, nota) | Una venta nace de una venta directa o al **entregar** un pedido |
| `line_item` | `workspace_id`, `parent_kind` (`order` \| `sale`), `parent_id`, `kind` (`piece` \| `set`), `product_id?`, `collection_id?`, `name`, `qty`, `price_cents`, `list_cents`, `cost_cents` (numeric(14,4): costo unitario con precisión completa), `extras_cents`, `parts` (jsonb, congelado), `printer_id?`, `from_stock` (jsonb: pieza → cantidad de existencias) | `price/list/cost` son la foto del momento |
| `payment` | `workspace_id`, `parent_kind` (`order` \| `sale`), `parent_id`, `on`, `amount_cents` (negativo = reembolso), `note` | |

El folio del pedido (`order.number`) se asigna con un contador por negocio dentro de la transacción de creación.

**Canales por id, no por nombre.** El mockup guardaba el nombre del canal en cada venta y pedido y, al renombrarlo, reescribía todos los registros. En el producto cada venta y pedido apunta a `channel_id`, así que renombrar un canal cambia **una** fila. Un canal con ventas o pedidos no se puede quitar (`CHANNEL_IN_USE`). La comisión que se aplica es la **actual** del canal (regla de `04 §6`); cambiarla recalcula las ganancias mostradas, como en el mockup.

## Producción

| Tabla | Columnas principales |
|---|---|
| `print_run` | `workspace_id`, `on`, `product_id?`, `qty`, `printer_id?`, `result` (`ok` \| `fail`), `hours`, `reason` (`stock` \| `order` \| `test`), `text`, `order_id?`, `photo_file_id?` |
| `print_run_filament` | `workspace_id`, `print_run_id`, `filament_id`, `grams` |
| `print_queue_entry` | `workspace_id`, `printer_id`, `order_id`, `text`, `minutes`, `position`, `started_at?` (una entrada por impresora y pedido en producción) |

## Gastos

| Tabla | Columnas principales |
|---|---|
| `expense` | `workspace_id`, `on`, `concept`, `category`, `amount_cents`, `recurring` (bool), `ends_on?` |

Categorías: Renta o espacio, Servicios, Mantenimiento y refacciones, Herramientas, Publicidad, Envíos, Sueldo propio, Otros (catálogo editable).

## Archivos

| Tabla | Columnas principales |
|---|---|
| `file` | `workspace_id`, `kind` (`product_photo` \| `customer_logo` \| `print_photo`), `mime` (solo JPG, PNG o WebP), `size`, `storage_key` |

En el mockup los logos y fotos son *data URL* dentro del estado. En el producto van a un `FileStore` (disco en local, almacenamiento de objetos en nube) y se referencian por `file_id`.

## Vistas calculadas

Para que listas y saldos no sumen fila por fila en la aplicación (`15 §3`):

| Vista | Qué agrupa |
|---|---|
| `spool_levels` | restante por rollo y por filamento (suma de `spool_movement`, sin rollos borrados) |
| `stock_levels` | físicas por pieza (suma de `stock_movement`); las apartadas salen de los pedidos en cierto estado (`04 §5`) |
| `supply_levels` | existencia por insumo |

Son vistas de lectura; la fuente de verdad siguen siendo los libros de movimientos.

## Borrado suave

Llevan `deleted_at` (y por tanto "Deshacer" = `restore…`, `12`): `product`, `collection`, `sale`, `order`, `customer`, `expense`, `spool`, `supply`, `supplier`, `printer`. Las filas hijas (artículos, pagos, movimientos) **no** se borran: dejan de contar porque su padre está borrado. Restaurar puede fallar si el nombre ya lo usa otro registro (`RESTORE_CONFLICT`).

## Índices que importan

- Toda tabla: `(workspace_id, …)`.
- `spool_movement (workspace_id, spool_id, on)`, `stock_movement (workspace_id, product_id, on)`, `supply_movement (workspace_id, supply_id, on)`.
- `order (workspace_id, status, due_on)` para el calendario y la lista.
- `sale (workspace_id, on)` para reportes.
- `line_item (workspace_id, parent_kind, parent_id)`.

## Aislamiento entre negocios

- Todo repositorio recibe `ctx.workspaceId` y lo agrega a **cada** consulta.
- Si la comprobación de PGlite lo confirma, además se activa seguridad por filas (RLS) con una política `workspace_id = current_setting('app.workspace_id')`, fijada al inicio de cada transacción. Es una segunda barrera, no la primera.
- Prueba obligatoria: dos negocios con datos parecidos; cada endpoint, llamado con la sesión de A, nunca devuelve ni modifica nada de B.

## Importar el mockup

El importador lee la copia de seguridad del mockup (v7) y la convierte con estas reglas:
- Los ids del mockup (`f1`, `r1`, …) se reemplazan por UUID y se guarda una tabla temporal de equivalencias.
- `pagos` vacío en una venta → no se crean pagos (se considera pagada completa).
- Los *data URL* de logos y fotos se suben al `FileStore` y se registran en `file`.
- Los nombres de canal de ventas y pedidos se convierten a `channel_id`; si una venta usa un canal que ya no existe en la lista, se crea ese canal con comisión 0 y se anota en el resumen.
- Los estados del mockup se traducen con la tabla de valores internos de `03` (`cotizado` → `quoted`, `inventario` → `stock`, …).
- Un pedido sin cliente (no debería existir) se importa con un cliente "Sin nombre" y se anota en el resumen.
- `pref.copia` del mockup pasa a `workspace_settings.last_backup_on`.
- Los movimientos se importan tal cual (conservan fechas); `Existencias` y `Rollos` se verifican comparando sumas antes y después.
- Al terminar, el importador imprime un resumen: cuántas filas por tabla y las diferencias, si las hay.
