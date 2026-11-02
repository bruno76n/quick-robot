# 05 · Modelo de datos

Punto de partida: el estado del mockup (esquema v7). Aquí se traduce a tablas. Nombres en inglés (glosario en `03`).

## Reglas generales

- **Todas** las tablas de negocio llevan `workspace_id` (FK a `workspace`). Los índices empiezan por `workspace_id`.
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
| `workspace_settings` | `workspace_id` (PK), `kwh_price_cents`, `failure_pct`, `purge_pct`, `min_margin_pct`, `formula_margin_pct`, `business` (jsonb: `name`, `trade`, `phone`, `email`, `city`, `quote_valid_days`, `footer`) |
| `sales_channel` | `workspace_id`, `name`, `commission_pct`, `position` |
| `catalog_item` | `workspace_id`, `kind` (`material` \| `color` \| `brand`), `name`, `hex` (solo colores) |

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
| `product` | `workspace_id`, `name`, `parent_id?` (variante), `mode` (`value` \| `formula`), `price_cents`, `margin_pct?`, `printer_id?` (nulo = promedio), `hours`, `batch_size`, `extras_cents`, `tracks_stock` (bool), `tags` (text[]), `note`, `spec` (jsonb: capa, relleno, paredes, soportes, boquilla, cama, archivo, nota) | `batch_size` (piezas por placa) es informativo: sirve para planear y no cambia el costo. Los campos `prep` y `acab` del mockup no se usan en ninguna pantalla y no se migran |
| `product_filament` | `product_id`, `filament_id`, `grams` | Qué filamentos y cuántos gramos lleva |
| `product_supply` | `product_id`, `supply_id`, `qty` | |
| `collection` | `workspace_id`, `name`, `price_cents?`, `extras_cents`, `tags`, `note` | Precio vacío = suma de sueltas |
| `collection_part` | `collection_id`, `product_id`, `qty` | |

## Existencias

| Tabla | Columnas principales |
|---|---|
| `stock_movement` | `workspace_id`, `product_id`, `on`, `kind` (`initial` \| `print` \| `order_print` \| `sale` \| `return` \| `delivery` \| `adjustment`), `qty` (±), `note`, `ref_id?` |

*Físicas*, *apartadas* y *libres* **no se guardan**: se calculan (suma de movimientos, y pedidos en cierto estado). Para listas grandes se usa una vista que agrupa por pieza.

## Clientes, ventas y pedidos

| Tabla | Columnas principales | Notas |
|---|---|---|
| `customer` | `workspace_id`, `name`, `type` (`Restaurante` \| `Empresa` \| `Persona` \| `Otro`), `phone`, `has_logo`, `logo_file_id?`, `note`, `created_on` | El tipo es un catálogo por negocio |
| `order` | `workspace_id`, `number` (folio por negocio, correlativo), `customer_id?`, `status`, `channel`, `note`, `created_on`, `due_on`, `ready_on?`, `delivered_on?`, `production_on?`, `filament_deducted` (bool), `runs_logged` (bool), `stock_reserved` (jsonb: pieza → cantidad apartada al quedar listo), `cancellation` (jsonb: fecha, motivo, reembolso) | `status`: `quoted`, `accepted`, `in_production`, `ready`, `delivered`, `cancelled` |
| `sale` | `workspace_id`, `on`, `channel`, `customer_id?`, `order_id?`, `note`, `return` (jsonb: fecha, repone, reembolso, nota) | Una venta nace de una venta directa o al **entregar** un pedido |
| `line_item` | `workspace_id`, `parent_kind` (`order` \| `sale`), `parent_id`, `kind` (`piece` \| `set`), `product_id?`, `collection_id?`, `name`, `qty`, `price_cents`, `list_cents`, `cost_cents`, `extras_cents`, `parts` (jsonb, congelado), `printer_id?`, `from_stock` (jsonb: pieza → cantidad de existencias) | `price/list/cost` son la foto del momento |
| `payment` | `workspace_id`, `parent_kind` (`order` \| `sale`), `parent_id`, `on`, `amount_cents` (negativo = reembolso), `note` | |

El folio del pedido (`order.number`) se asigna con un contador por negocio dentro de la transacción de creación.

## Producción

| Tabla | Columnas principales |
|---|---|
| `print_run` | `workspace_id`, `on`, `product_id?`, `qty`, `printer_id?`, `result` (`ok` \| `fail`), `hours`, `reason` (`stock` \| `order` \| `test`), `text`, `order_id?`, `photo_file_id?` |
| `print_run_filament` | `print_run_id`, `filament_id`, `grams` |

## Gastos

| Tabla | Columnas principales |
|---|---|
| `expense` | `workspace_id`, `on`, `concept`, `category`, `amount_cents`, `recurring` (bool), `ends_on?` |

Categorías: Renta o espacio, Servicios, Mantenimiento y refacciones, Herramientas, Publicidad, Envíos, Sueldo propio, Otros (catálogo editable).

## Archivos

| Tabla | Columnas principales |
|---|---|
| `file` | `workspace_id`, `kind`, `mime`, `size`, `storage_key` |

En el mockup los logos y fotos son *data URL* dentro del estado. En el producto van a un `FileStore` (disco en local, almacenamiento de objetos en nube) y se referencian por `file_id`.

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
- Los *data URL* de logos y fotos se suben al `FileStore`.
- Los movimientos se importan tal cual (conservan fechas); `Existencias` y `Rollos` se verifican comparando sumas antes y después.
- Al terminar, el importador imprime un resumen: cuántas filas por tabla y las diferencias, si las hay.
