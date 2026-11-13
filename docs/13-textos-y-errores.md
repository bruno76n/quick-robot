# 13 · Textos y mensajes de error

Todo lo que la persona lee, en español, y cómo se organiza en `apps/web/src/i18n/es.ts`. Tres fuentes, para que nadie invente redacciones:

| Qué | Dónde está |
|---|---|
| Texto fijo de cada pantalla, cajón y diálogo | `reference/mockup-textos.md` (extraído automáticamente del mockup) |
| Mensajes emergentes del mockup (105) | Este documento, §5 — ya adaptados al producto |
| Mensajes de error del servidor | Este documento, §3 — uno por código de `12 §2` |

**Regla:** si un texto del mockup y uno de este documento difieren, gana el del mockup, salvo que aquí diga "adaptado".

---

## 1. Cómo se escribe

- **Vocabulario fijo:** Total, Costo, Ganancia, Ventas, Saldo, Pagado, Por cobrar, Disponible, Libres, Apartadas, Artículos. No se usan sinónimos (nada de "Importe", "Utilidad" ni "Stock" en la interfaz).
- **Botones y títulos:** verbo en infinitivo o sustantivo, sin segunda persona: "Registrar venta", "Nuevo pedido".
- **Mensajes que explican algo:** cortos, dicen **qué pasó** y **qué hacer**. Se conserva la voz del mockup ("Agrega al menos un artículo.", "Reduce la cantidad…", "Toca de nuevo para eliminar"); los nuevos usan infinitivo ("Revisar los campos marcados.") o frase impersonal ("Sin permiso para hacer esto."). **Nunca** "tu/tus", "tienes/puedes" ni pasados en segunda persona ("escribiste", "elegiste").
- **Los errores no se disculpan, no dicen "error" ni muestran códigos**, salvo el `errorId` de una falla inesperada, para poder reportarla.
- **Una acción se llama igual en el botón y en el aviso:** "Registrar abono" → "Abono registrado".
- **Mayúsculas:** solo la primera letra de la oración y los nombres propios.
- **Comillas:** angulares curvas “así” para nombres de registros (`“Mercado Libre”`).
- **Los avisos de éxito no llevan punto si son de dos o tres palabras** ("Gasto guardado"); las frases completas sí ("Venta registrada.").
- **Código y claves en inglés; textos en español.** Los textos nunca se arman concatenando fragmentos: cada frase es una entrada completa con parámetros, porque el orden de las palabras cambia con el plural.

## 2. Organización de `es.ts`

```ts
export const es = {
  common:   { save: 'Guardar', cancel: 'Cancelar', delete: 'Eliminar', undo: 'Deshacer', … },
  nav:      { home: 'Inicio', products: 'Productos', … },
  status:   { order: {…}, filament: {…}, spool: {…}, supply: {…}, stock: {…}, maintenance: {…}, printRunReason: {…} },
  errors:   { INSUFFICIENT_STOCK: 'Existencias insuficientes. …', … },   // §3, una por código de 12
  warnings: { STOCK_SHORT: '…', … },                                      // §4
  fields:   { required: 'Falta este dato.', 'product.name.required': 'Ponle un nombre a la pieza.', … },  // §6
  toast:    { 'order.accepted': 'Pedido #{folio} aceptado.', … },        // §5
  confirm:  { tapAgainDelete: 'Toca de nuevo para eliminar', … },        // §7
  screens:  { home: {…}, products: {…}, … },                              // texto fijo de cada pantalla
};
```

- **Sintaxis de los textos** (un solo ayudante, `t(key, params)`, en `apps/web/src/i18n/t.ts`, con prueba). Solo hay tres formas y en todas la primera palabra es el nombre del parámetro:
  - `{nombre}`: se sustituye por el valor.
  - `{count|pieza|piezas}`: **plural**; elige según el número `count` (1 → singular; 0 y 2 o más → plural) e imprime solo la palabra. El número se escribe aparte: `{count} {count|pieza|piezas}` → “3 piezas”.
  - `{status|delivered=entregado|cancelled=cancelado}`: **elección** según el valor de `status`; cada opción es `valor=texto`.
  - En las tablas de este documento la barra va escrita `\|` solo por el formato de Markdown; en `es.ts` es `|`.
- **Los parámetros se llaman igual que el campo de `details` en `12 §2`** y se formatean por su sufijo, sin importar mayúsculas, según §2.1: `…Cents` → dinero (`$1,250`), `…Grams` → gramos (`535 g`; la unidad la pone el formato, **nunca** el texto), `…Hours` → horas, `…Pct` → porcentaje; el resto se muestra tal cual. Así `i18n.test.ts` puede comprobar que cada `{x}` existe en `details`.
- **Búsqueda del texto de un error:** `errors[code]`; si no existe, `errors.INTERNAL_ERROR`. Un código sin texto **rompe la prueba** `i18n.test.ts`, que compara las claves de `errors` y `warnings` con las de `12 §2`.
- **Búsqueda del texto de un campo inválido:** `fields['<formulario>.<campo>.<regla>']`, luego `fields['<regla>']`, luego `fields.required`.
- **Ningún texto fuera de `es.ts`.** Un lint (`no-literal-string` en JSX) lo vigila en `apps/web/src/features` y `components`.

## 2.1 Formatos

| Qué | Formato | Ejemplo |
|---|---|---|
| Dinero en totales y listas | Pesos sin centavos, miles con coma, `es-MX` | `$1,250` |
| Dinero con centavos | Solo cuando hay centavos reales (precios, costos unitarios, abonos) | `$35.95` |
| Gramos | Un decimal máximo + ` g` | `1,234.5 g` |
| Horas | `2 h`, `2 h 30 min` | `7 h 15 min` |
| Porcentaje | Un decimal máximo | `14.6%` |
| Fecha de calendario | Día y mes corto | `31 oct` |
| Fecha relativa | `hoy`, `mañana`, `en N días`, `hace N d`, `Retrasado N d` | `en 3 días` |
| Duración de cola | `ya` (menos de 1 min), `N min`, `H h M min`, `D d H h` (desde 48 h) | `3 d 4 h` |
| Folio | `#N` | `#12` |

Los formatos salen de `Intl` con `es-MX` y MXN; viven en `apps/web/src/lib/format.ts` y se prueban con los ejemplos de esta tabla.

---

## 3. Mensajes de error (`errors`)

Un renglón por código de `12 §2`. Entre llaves, los parámetros de `details`.

### Generales

| Código | Texto |
|---|---|
| `VALIDATION_ERROR` | Revisar los campos marcados. |
| `UNAUTHENTICATED` | *(escritorio)* No se pudo conectar con la aplicación. Cerrarla y volver a abrirla. · *(nube)* La sesión terminó. Iniciar sesión de nuevo. |
| `FORBIDDEN` | Sin permiso para hacer esto. |
| `PLAN_LIMIT` | El plan actual no permite agregar más. |
| `NOT_FOUND` | No se encontró. Puede que ya se haya eliminado. |
| `PAYLOAD_TOO_LARGE` | Los datos son demasiado grandes. |
| `FILE_TOO_LARGE` | El archivo supera {maxMb} MB. |
| `UNSUPPORTED_IMAGE` | No se pudo leer la imagen. Formatos admitidos: JPG, PNG o WebP. |
| `RATE_LIMITED` | Demasiados intentos. Esperar {retryAfterSec} segundos. |
| `INTERNAL_ERROR` | Algo salió mal y no se guardó nada. Intentar de nuevo; si se repite, avisar con este código: {errorId}. |
| `SERVICE_UNAVAILABLE` | La aplicación se está iniciando. Intentar de nuevo en unos segundos. |
| `STORAGE_FULL` | No hay espacio en el disco. Liberar espacio e intentar de nuevo. No se perdió nada de lo anterior. |
| `NETWORK_ERROR` *(solo cliente)* | *(escritorio)* La aplicación no responde. Cerrarla y volver a abrirla. · *(nube)* No hay conexión. Revisar el internet e intentar de nuevo. |
| `RESTORE_CONFLICT` | No se pudo deshacer: ya existe otro registro con ese nombre. |
| `CONFIRMATION_REQUIRED` | Falta confirmar la operación. |

### Piezas y colecciones

| Código | Texto |
|---|---|
| `PRODUCT_IN_ACTIVE_ORDERS` | Esta pieza está en {count} {count\|pedido sin entregar\|pedidos sin entregar} ({folios}). Primero deben entregarse o eliminarse. |
| `PRODUCT_HAS_STOCK` | No se puede eliminar: quedan {onHand} {onHand\|pieza\|piezas} en Existencias. Primero ajustar el conteo a 0. |
| `PRODUCT_HAS_VARIANTS` | Esta pieza tiene {count} {count\|variante\|variantes}. Primero hay que eliminarlas. |
| `STOCK_TRACKING_HAS_STOCK` | Hay {onHand} en existencias: ajústalas a 0 en Existencias antes de desactivarlo. |
| `COLLECTION_EMPTY` | La colección necesita al menos una pieza. |
| `NO_PRODUCTS` | Primero crea una pieza en Productos. |

### Ventas y pedidos

| Código | Texto |
|---|---|
| `LINE_ITEMS_REQUIRED` | Agrega al menos un artículo. |
| `CUSTOMER_REQUIRED` | Falta elegir el cliente del pedido. |
| `INSUFFICIENT_STOCK` | Existencias insuficientes. Reduce la cantidad o convierte la venta en pedido. *(debajo, por cada pieza de `items`:)* {name}: se piden {requested}, hay {free} libres. |
| `PAYMENT_EXCEEDS_BALANCE` | El monto no puede ser mayor al saldo ({balanceCents}). |
| `REFUND_EXCEEDS_PAID` | El reembolso no puede ser mayor a lo pagado ({paidCents}). |
| `SALE_ALREADY_RETURNED` | Esta venta ya se devolvió. |
| `ORDER_INVALID_STATE` | El pedido ya no está en ese paso. Se actualizó la pantalla. |
| `ORDER_NOT_ACTIVE` | Este pedido ya está {status\|delivered=entregado\|cancelled=cancelado} y no se puede modificar. |
| `PRINTER_ASSIGNMENT_REQUIRED` | Falta asignar impresora a {count} {count\|artículo\|artículos}. |
| `NO_PRINTERS` | Primero registra una impresora. |

### Taller

| Código | Texto |
|---|---|
| `NO_SPOOL_FOR_FILAMENT` | Primero agrega un rollo de este filamento. |
| `NO_SPOOLS` | Primero agrega un rollo en Filamentos. |
| `SPOOL_INSUFFICIENT` | Ese rollo solo tiene {availableGrams}. |
| `SUPPLY_NAME_EXISTS` | Ya existe “{name}”. |
| `SUPPLY_IN_USE` | Está en {products} {products\|pieza\|piezas}. Quítalo de ellas primero. |
| `SUPPLY_INSUFFICIENT` | Solo hay {available} disponibles. |
| `COUNT_UNCHANGED` | El conteo coincide con el total actual. |
| `PRINTER_HAS_QUEUE` | No se puede eliminar: {name} tiene {jobs} {jobs\|trabajo\|trabajos} en cola. Primero terminarlos o reasignarlos. |
| `PRINT_RUN_LOCKED` · `order_history` | Este registro se creó solo al terminar un pedido. Se conserva como historial. |
| `PRINT_RUN_LOCKED` · `pieces_unavailable` | Esta impresión sumó {pieces} {pieces\|pieza\|piezas} a Existencias y ya no hay {pieces\|esa pieza libre\|tantas libres}: se vendieron o están apartadas. Primero debe corregirse Existencias. |

### Negocio y datos

| Código | Texto |
|---|---|
| `CUSTOMER_NAME_EXISTS` | Ya existe un cliente llamado “{name}”. Cambiar el nombre o editar el cliente existente. |
| `CUSTOMER_HAS_HISTORY` | Ese cliente tiene pedidos o ventas y no se puede eliminar. |
| `CHANNEL_NAME_EXISTS` | Ya existe un canal llamado “{name}”. |
| `CHANNEL_IN_USE` | “{name}” tiene {sales} {sales\|venta\|ventas} y {orders} {orders\|pedido\|pedidos}. No se puede quitar; se puede renombrar. |
| `LAST_CHANNEL` | Debe quedar al menos un canal de venta. |
| `IMPORT_INVALID_FILE` | No se pudo leer la copia. *(si hay `reason`, debajo en gris:)* {reason}. No se cambió ningún dato. |
| `IMPORT_UNSUPPORTED_VERSION` | Esta copia es de una versión que esta aplicación no entiende ({found}). Actualizar la aplicación e intentar de nuevo. |

### Pantallas de falla (`screens.fatal`)

Se muestran cuando la aplicación completa no puede seguir (`15 §5`). Cada una con sus botones.

| Clave | Título y texto | Botones |
|---|---|---|
| `fatal.serverDown` | La aplicación no responde. Cerrarla y volver a abrirla. | Reintentar |
| `fatal.migrationFailed` | No se pudo actualizar los datos. Se restauró la copia anterior; los datos están intactos. | Abrir de nuevo · Mostrar archivo de registro |
| `fatal.dataFileUnreadable` | No se pudo abrir el archivo de datos. | Restaurar la copia más reciente · Elegir otra copia |
| `fatal.screenCrashed` | Esta pantalla no se pudo mostrar. *(debajo, en gris:)* Código: {errorId} | Volver al Inicio |
| `fatal.offline` *(nube)* | Sin conexión. Lo escrito sigue aquí; se puede guardar cuando vuelva. | — |
| `fatal.slow` | Tarda más de lo normal. | Reintentar |
| `fatal.importing` | Importando… No cerrar la aplicación. | — |

## 4. Avisos (`warnings`): la operación sí se hizo

| Código | Texto |
|---|---|
| `STOCK_SHORT` | Faltaron {missing} {missing\|pieza\|piezas} en existencias; esas se imprimen. |
| `FILAMENT_SHORTFALL` | Faltaron {missingGrams} de {name}; se descontó lo que había. |
| `ORDER_WAITING_OTHER_PRINTERS` | Trabajo terminado. El pedido #{orderNumber} aún tiene trabajos en {printerNames}. |
| `PRODUCTS_MISSING` | Algunas piezas ya no existen en el catálogo y no se cargaron. |
| `FILAMENT_NOT_RETURNED` | El filamento descontado no se devuelve (registro anterior); se puede ajustar en Filamentos. |

Un aviso se muestra **junto** al mensaje de éxito de la operación, en el mismo aviso emergente, separado por un espacio.

**Cómo se llenan los parámetros** (igual que `INSUFFICIENT_STOCK` en §3):
- Los parámetros salen de `details` del código en `12 §2`; el servidor manda números y la interfaz los formatea por su sufijo (§2): `{missingGrams}` → `535 g`.
- Si `details` trae una lista de objetos (`items[]`), el texto se escribe **una vez por elemento** y los campos del elemento son los parámetros.
- Si trae una lista de textos (`printerNames[]`), se une con `Intl.ListFormat('es-MX')`: “Impresora 1 y Impresora 2”.

---

## 5. Avisos emergentes de éxito (`toast`)

Los que traen **Deshacer** (`undo: true`) llaman a `restore<Entidad>` (`12`). Entre llaves, parámetros.

### Piezas y colecciones
| Clave | Texto | Deshacer |
|---|---|---|
| `product.saved` | Guardado en el catálogo | |
| `product.variantSaved` | Variante guardada en el catálogo | |
| `product.deleted` | Pieza eliminada. | ✓ |
| `collection.saved` | Colección guardada | |
| `collection.deleted` | Colección eliminada. Las piezas siguen en el catálogo y las ventas anteriores se conservan. | ✓ |
| `builder.split` | Colección separada en piezas. El precio del set se repartió entre ellas; se pueden quitar o cambiar. | |
| `builder.toOrder` | Convertido en pedido: lo disponible en existencias se aparta y el resto se imprime. Falta elegir cliente y fecha de entrega. | |
| `product.photoTooBig` | → usa `FILE_TOO_LARGE` con 12 MB | |

### Ventas
| Clave | Texto | Deshacer |
|---|---|---|
| `sale.created` | Venta registrada. {count} {count\|pieza salió\|piezas salieron} de Existencias. | |
| `sale.updated` | Venta actualizada. | |
| `sale.deleted` | Venta eliminada. | ✓ |
| `sale.paymentRemoved` | Pago quitado de la venta. | |
| `sale.returned` | Venta devuelta. *(si repone:)* {count} {count\|pieza regresó\|piezas regresaron} a Existencias. |  |

### Pedidos
| Clave | Texto | Deshacer |
|---|---|---|
| `order.created` | Pedido #{folio} creado. Está en Pendientes. *(si aceptado con existencias:)* Se apartaron {count} {count\|pieza\|piezas} de existencias. | |
| `order.updated` | Pedido #{folio} actualizado | |
| `order.accepted` | Pedido #{folio} aceptado. | |
| `order.readyFromStock` | Pedido #{folio} listo para entregar: todo salió de existencias. | |
| `order.ready` | Pedido #{folio} listo para entregar. Impresoras libres. | |
| `order.delivered` | Pedido #{folio} entregado. La venta se registró sola. | |
| `order.cancelled` | Pedido #{folio} cancelado. |  |
| `order.deleted` | Pedido #{folio} eliminado. | ✓ |
| `order.paymentRecorded` | Pago registrado | |
| `order.paymentRemoved` | Pago de {amount} quitado. Saldo del pedido: {balance}. | |
| `order.printersUpdated` | Impresoras actualizadas | |

### Filamentos, insumos, impresoras y producción
| Clave | Texto | Deshacer |
|---|---|---|
| `spool.added` | Rollo agregado a {filament}. Disponible: {available}. | |
| `spool.deleted` | Rollo eliminado *(si tenía movimientos:)* junto con sus {count} {count\|movimiento\|movimientos}. | ✓ |
| `spool.movementRecorded` | Movimiento registrado | |
| `supply.saved` | Insumo guardado | |
| `supply.deleted` | Insumo eliminado | ✓ |
| `supply.purchaseRecorded` | Compra registrada | |
| `supply.movementRecorded` | Movimiento guardado | |
| `supplier.deleted` | Proveedor eliminado. Los insumos que tenía quedaron sin proveedor. | ✓ |
| `printer.saved` | Impresora guardada | |
| `printer.deleted` | Impresora “{name}” eliminada. | ✓ |
| `maintenance.saved` | Tarea guardada | |
| `maintenance.removed` | Tarea quitada | |
| `maintenance.done` | Mantenimiento registrado | |
| `printRun.recorded` | Impresión registrada. Se descontaron {grams}. | |
| `printRun.testRecorded` | Prueba registrada. Se descontaron {grams}. | |
| `printRun.deleted` | Registro eliminado. *(si devolvió filamento:)* Se devolvieron {grams} al inventario de filamento. *(si quitó piezas:)* Se quitaron {count} {count\|pieza\|piezas} de Existencias. | |
| `stock.trackingEnabled` | {name} ahora lleva existencias | |
| `stock.summary` | Existencias de {name}: total {physical}. | |
| `stock.allTracked` | Todas las piezas ya llevan existencias. | |

### Clientes, gastos, canales y datos
| Clave | Texto | Deshacer |
|---|---|---|
| `customer.saved` | Cliente guardado | |
| `customer.deleted` | Cliente “{name}” eliminado. | ✓ |
| `customer.logoRemoved` | Imagen quitada | |
| `expense.saved` | Gasto guardado | |
| `expense.deleted` | Gasto eliminado | ✓ |
| `channel.renamed` | Canal renombrado. *(si cambió registros:)* Se actualizaron {count} {count\|registro\|registros}. | |
| `channel.removed` | Canal “{name}” quitado. | |
| `data.exported` | Copia lista. Quedó guardada en la carpeta elegida. *(adaptado: el mockup mandaba a "Copiar respaldo")* | |
| `data.restored` | Copia restaurada. | |
| `data.cleared` | Datos vaciados. Agregar rollos e impresoras para comenzar. | |
| `csv.ready` | {entity}: archivo listo para abrir en Excel. | |
| `copy.done` | {what} copiado. *(ej.: "Ficha copiada.", "Compras copiado. Pégalo en Excel.")* | |
| `copy.failed` | No se pudo copiar. Selecciona el texto y cópialo. | |
| `print.hint` | En la ventana de impresión, elegir “Guardar como PDF”. | |
| `undo.done` | Cambio deshecho. | |
| `screens.backup.backupMade` *(fase 4)* | Copia automática guardada. | |

**Resumen de una restauración** (fase 4, `es.screens.backup`): "Copia restaurada", "Quedó así:", filas por tabla, "Sin diferencias: los totales coinciden con la copia." o la lista "Diferencias con la copia" (rollos, existencias, ventas, ganancia, por cobrar: "{x} en la copia, {y} aquí"), notas (canal creado, cliente "Sin nombre", imagen no importada) y "Antes se guardó una copia de lo que había ({date}); está en Copias automáticas." Durante la importación: "Importando… No cerrar la aplicación."

**Fuera del producto** (solo existían por ser maqueta): "Datos de ejemplo restaurados", "No se pudieron actualizar los datos anteriores…", "Copiar respaldo como texto" y "Restaurar pegando texto". La carga de ejemplo es solo de desarrollo (`06 §15`).

---

## 6. Mensajes de campos (`fields`)

Salen de `VALIDATION_ERROR.details.fields[]` (`path` + `rule`). Aparecen **debajo del campo** y también se enfoca el primero inválido.

### Reglas generales (último recurso)
| Regla | Texto |
|---|---|
| `required` | Falta este dato. |
| `too_long` | Es demasiado largo (máximo {max} caracteres). |
| `too_small` | Debe ser al menos {min}. |
| `too_big` | Debe ser como máximo {max}. |
| `not_integer` | Debe ser un número entero. |
| `invalid_format` | El formato no es válido. |
| `invalid_date` | La fecha no es válida. |
| `invalid_email` | El correo no es válido. |

### Específicos del mockup
| Clave | Texto |
|---|---|
| `product.name.required` | Ponle un nombre a la pieza. |
| `product.price.required` | Escribe el precio de venta. |
| `collection.name.required` | Ponle un nombre a la colección. |
| `sale.on.required` | Falta la fecha de la venta. |
| `salePayment.amount.required` | Falta el monto del abono. |
| `orderPayment.amount.required` | Falta el monto del pago. |
| `spool.filament.required` | Elige el material y el color del rollo. |
| `spool.cost.required` | Falta el costo del rollo. |
| `spoolMovement.grams.required` | Falta la cantidad en gramos. |
| `printRun.text.required` | Falta describir la prueba. |
| `customer.name.required` | Falta el nombre del cliente. |
| `channel.name.required` | Falta el nombre del canal. |
| `expense.concept.required` | Falta el concepto del gasto. |
| `expense.amount.required` | Escribe el monto del gasto. |
| `expense.endsOn.before_start` | La fecha final no puede ser anterior al inicio. |
| `supply.name.required` | Falta el nombre del insumo. |
| `supplyPurchase.qty.required` | Escribe la cantidad comprada. |
| `supplyMovement.value.required` | Escribe la cantidad. |
| `maintenance.task.required` | Falta el nombre de la tarea. |
| `supplier.name.required` | Falta el nombre del proveedor. |

---

## 7. Confirmación en dos toques (`confirm`)

Las acciones destructivas **no abren un cuadro de confirmación**: el botón cambia de texto y hay que tocarlo otra vez. Si la persona toca en otra parte o cierra el diálogo, el botón vuelve a su texto.

| Clave | Texto del botón en el segundo toque | Se usa en |
|---|---|---|
| `confirm.tapAgainDelete` | Toca de nuevo para eliminar | Rollo, registro de producción, impresora, pieza, colección, cliente, pedido, venta |
| `confirm.removeQuestion` | ¿Quitar? | Pago, tarea de mantenimiento, canal |
| `confirm.deleteQuestion` | ¿Eliminar? | Gasto, insumo |
| `confirm.tapAgainClear` | Toca de nuevo para borrar todo | Vaciar el negocio |

Después de eliminar, el aviso trae **Deshacer** (§5). Solo `importWorkspace` y `clearWorkspace` exigen `confirm: true` al servidor (`12 §10`).

---

## 8. Estados, etiquetas y catálogos fijos

| Dónde | Valor interno → texto |
|---|---|
| Estado del pedido | `quoted` Cotizado · `accepted` Aceptado · `in_production` En producción · `ready` Listo · `delivered` Entregado · `cancelled` Cancelado |
| Botón del siguiente paso | `quoted` Cliente aceptó · `accepted` Poner en producción (o **Marcar listo** si no hay nada que imprimir) · `in_production` Marcar listo · `ready` Entregar y cobrar |
| Columnas del Tablero | Pendientes (cotizados y aceptados) · En producción · Listos para entregar · Entregados |
| Filtros de la Lista de pedidos | Todos · Pendientes · En producción · Listos · Entregados · Cancelados |
| Motivo de un registro de producción | `stock` Para existencias · `test` Prueba de material · `order` Pedido |
| Estado de filamento | `no_spools` Sin rollos · `out` Agotado · `ending` Se acaba · `low` Poco · `new` Nuevo · `ok` Normal |
| Estado de rollo | `empty` Vacío · `new` Nuevo · `in_use` En uso |
| Estado de insumo | `out` Agotado · `low` Poco · `ok` Suficiente |
| Estado de una pieza en Existencias | `out` Agotada · `all_reserved` Todo apartado · `few` Pocas · `ok` Disponible |
| Estado de mantenimiento | Al corriente · Pronto · Toca ya |
| Etiquetas de precio de una pieza | Regalo · Coleccionable · Personalizado · Edición limitada · Negocio |
| Tipos de cliente (iniciales) | Restaurante · Empresa · Persona · Otro |
| Categorías de gasto (iniciales) | Renta o espacio · Servicios · Mantenimiento y refacciones · Herramientas · Publicidad · Envíos · Sueldo propio · Otros |

Color de la etiqueta de estado (del mockup): rojo = Agotado, Agotada, Se acaba · ámbar = Poco, Pocas · azul = Nuevo, Todo apartado · verde = Normal, Suficiente, Disponible, En uso · gris = Vacío, Sin rollos.
| Periodos de Reportes | 7 días · 30 días · 90 días · Todo |
| Modo de precio | Precio libre · Costo + margen |
| Vista de Productos | Fichas · Lista |
| Vista de Pedidos | Tablero · Lista · Calendario |

---

## 9. Rótulos de acciones

Texto del botón de cada acción del mockup, para que `es.ts` use los mismos. (El mapa acción → caso de uso está en `06 §16`.)

| Acción | Texto | Acción | Texto |
|---|---|---|---|
| `venta-new` | Registrar venta | `ped-new` | Nuevo pedido |
| `nueva-pieza` | Nueva pieza | `nueva-coleccion` | Nueva colección |
| `save-var` | Guardar como variante nueva | `del-prod` | Eliminar pieza |
| `del-col` | Eliminar colección | `cancel-edit` / `cancel-col` / `b-cancel` | Descartar |
| `cotizar` | Cotizar a cliente | `ficha-copy` | Copiar ficha |
| `foto-quitar` | Quitar | `b-to-ped` | Convertir en pedido |
| `b-sep` | Separar en piezas | `b-lista` | Usar lista |
| `venta-abono` | Registrar abono | `venta-devolver` | Devolver venta |
| `venta-edit` | Editar datos | `venta-del` | Eliminar venta |
| `ped-pago` | Registrar pago | `ped-asignar` | Asignar / Cambiar impresoras |
| `ped-cancelar` | Cancelar pedido | `ped-del` | Eliminar pedido |
| `ped-lista` | Ver los {n} entregados | `ped-edit` | Elegir cliente / Editar |
| `rollo-new` | Agregar rollo | `rollo-edit` | Editar |
| `rollo-del` | Eliminar este rollo | `mov-new` | Registrar movimiento |
| `ins-new` | Nuevo insumo | `ins-compra` | Registrar compra |
| `ins-uso` | Usar o ajustar | `ins-del` | Eliminar insumo |
| `imp-new` | Agregar impresora | `imp-edit` | Editar costos |
| `imp-fin` | Terminó este trabajo | `imp-del` | Eliminar impresora |
| `mant-new` | Agregar tarea | `mant-hecho` | Hecho |
| `mant-del` | Quitar tarea | `print-new` | Registrar impresión |
| `prod-del` | Eliminar registro | `ex-on` | Llevar existencias de esta pieza / de otra pieza |
| `ex-ajuste` | Ajustar | `cli-new` | Nuevo cliente |
| `cli-edit` | Editar cliente | `cli-ped` | Nuevo pedido |
| `cli-venta` | Registrar venta | `cli-copy` | Copiar |
| `cli-del` | Eliminar cliente | `cl-logo-quitar` | Quitar imagen |
| `gasto-new` | Nuevo gasto | `gasto-del` | Eliminar gasto |
| `prov-new` | Nuevo proveedor | `prov-del` | Eliminar proveedor |
| `canal-add` | Agregar canal | `canal-del` | Quitar |
| `bak-dl` | Descargar copia | `auto-rest` | Restaurar |
| `demo-reset` | *(solo desarrollo)* Volver a los datos de ejemplo | `doc-print` | Guardar como PDF |
| `exp-copy` | Copiar tabla | `buscar` | Buscar ⌘K |

---

## 9.1 Textos de la ronda 2

Los textos nuevos de variantes agrupadas, Existencias (lista y fichas), Inicio (atención por prioridad) y la barra lateral neutra están en `mejoras/ronda-2.md §9` (claves de `es.ts` incluidas). Los demás textos de esas pantallas no cambian.

## 9.2 Textos de la ronda 2 · fase D (menos clics)

| Clave | Texto | Dónde |
|---|---|---|
| `common.picker.search` | Buscar | Nombre del campo de búsqueda del selector con búsqueda (`06 §1`), seguido del nombre del campo |
| `common.picker.placeholder` | Escribir para buscar… | Campo de búsqueda del selector |
| `common.picker.none` | Sin resultados. | Selector, cuando nada coincide con lo escrito |
| `screens.calculator.usedInPiece` | En esta pieza | Grupo de la lista de filamentos: los que ya usa la pieza |
| `screens.calculator.otherFilaments` | Los demás | Grupo de la lista de filamentos: el resto |
| `screens.stock.sellOne` | Vender {name} | Nombre accesible del botón “Vender” de cada fila o ficha de Existencias |
| `screens.sales.owesPay` | {owes}: registrar abono | Nombre accesible del chip “Debe $X” de la lista de Ventas, que abre el abono |

---

## 10. Cómo se prueba

- `i18n.test.ts`: cada código de `12 §2` tiene entrada en `errors` y en `warnings`; ninguna clave de `toast`, `errors` o `fields` está vacía; todo parámetro `{x}` del texto existe en `details` (también el primero de cada plural y de cada elección); ningún texto escribe a mano la unidad de un parámetro `…Cents`, `…Grams`, `…Hours` o `…Pct`.
- `format.test.ts`: los ejemplos de §2.1.
- `t.test.ts`: las tres formas (`{nombre}`, plural y elección), formato por sufijo y parámetros faltantes (no deben imprimir `{x}` en pantalla: se cae a un texto genérico y se registra).
- Lint de textos literales en JSX (§2).
- Revisión visual (modo autónomo, paso 4): cada pantalla se compara con `reference/mockup-textos.md`.
