# 06 · Pantallas y flujos

Esto **no es un diseño nuevo**: es la descripción escrita de lo que ya hace el mockup (`Quick Robot mockup.html`). El mockup es la referencia de comportamiento; si este documento y el mockup difieren, se revisa cuál tiene razón antes de programar.

Para cada pantalla: qué muestra, qué botones tiene, qué hace cada uno (caso de uso del servidor, nombres en `packages/server/src/usecases`) y a dónde lleva.

**Documentos hermanos:** la entrada, salida y errores de cada caso de uso están en `12`; los textos exactos en `13` y en `reference/mockup-textos.md`; qué se ve cuando algo falla, en `15 §5`.

**Convenciones del mockup que se conservan**
- Solo modo claro. Solo tipografía Geist.
- Vocabulario fijo: Total, Costo, Ganancia, Ventas, Saldo, Pagado, Por cobrar, Disponible, Libres, Apartadas, Artículos.
- Botones y títulos sin segunda persona ("Registrar venta", no "Registra tu venta"); los mensajes que explican algo siguen la regla de `13 §1`. Los documentos para clientes sí pueden hablar directo.
- Las eliminaciones se pueden **deshacer** (en el producto: restaurar el borrado suave) y avisan con un aviso emergente que trae el botón "Deshacer".

---

## 1. Elementos globales

| Elemento | Qué hace |
|---|---|
| **Barra lateral** | Arriba: la **mascota** con el **nombre y el giro del negocio** (datos de Ajustes; el mockup los traía fijos como “Quick Robot · Impresión 3D”: ya no, el texto sale de Ajustes; la mascota se conserva por decisión de la persona del 2026-11-13, `mejoras/ronda-2.md §2`). Sin nombre ni giro, “Mi negocio” y “Giro del negocio” en gris. Después: Inicio · *Vender*: Productos, Ventas, Pedidos · *Taller*: Filamentos, Insumos, Impresoras, Producción, Existencias, Compras · *Negocio*: Clientes, Gastos, Reportes, Ajustes. En pantallas pequeñas se oculta tras un botón de menú |
| **Buscar** (⌘/Ctrl + K) | Paleta de comandos: busca piezas, clientes, pedidos, ventas, filamentos y acciones; Enter abre el resultado |
| **Atajos** (`?`) | Muestra la lista. `g` + letra navega (ir a pantalla); `⌘/Ctrl+Z` deshace; `⇧⌘Z` rehace |
| **Cajón lateral** | Detalle de un elemento de una lista ancha (filamento, insumo, pieza de existencias) sin salir de la lista; Esc o clic fuera lo cierra |
| **Diálogos** | Formularios cortos de alta/edición y confirmaciones; se cierran con Esc. **Foco al abrir** (ronda 2 · T1): el campo marcado como el útil (`data-autofocus`); si no hay, el primer campo visible que no sea radio, casilla ni fecha. Marcados: “Cantidad impresa” cuando la pieza viene elegida (Registrar impresión), “Costo” del rollo cuando el filamento ya viene elegido, “Cantidad” en Usar o ajustar (insumo) y “Costo de piezas” en Mantenimiento hecho |
| **Selector con búsqueda** (`components/Picker.tsx`, ronda 2 · D1) | Lo usan las filas de filamentos e insumos de la calculadora y las piezas de una colección. Un botón con el valor elegido abre una lista (`role=listbox`) con un campo “Escribir para buscar…” arriba. Teclado: Enter, Espacio o ↓ abren (escribir una letra sobre el botón abre con esa letra buscada); ↑ ↓ Inicio Fin se mueven; Enter o clic eligen; Esc cierra y devuelve el foco al botón; Tab cierra sin elegir. Al elegir, el foco pasa al campo siguiente de la fila (gramos o cantidad). Una fila nueva creada con “Agregar …” nace con la lista abierta y el foco dentro |
| **Aviso emergente** | Confirma lo hecho; si fue una eliminación, trae "Deshacer" (devolver una venta y cancelar un pedido no se deshacen: mueven dinero y existencias, `D32`) |

*Producto:* "Deshacer/Rehacer" por historial de estados no se porta tal cual. En el producto, toda eliminación es suave (`deleted_at`) y el aviso llama a `restore<Entidad>` (`12`). El rehacer general queda fuera de la primera versión. Las eliminaciones y cancelaciones piden **confirmación en dos toques** (el botón cambia a "Toca de nuevo para eliminar", `13 §7`), no un cuadro de diálogo.

---

## 2. Inicio

**Muestra:** resumen compacto del taller (el "brief"): cifras clave del periodo, qué se está imprimiendo ahora, y las **atenciones** agrupadas por prioridad, cada una con un botón que lleva al elemento. **Ronda 2:** “Atención” es la columna principal, las atenciones se agrupan en **Urgente · Esta semana · Para revisar** con chips de filtro, y **se quitó la cuadrícula de rollos de filamento** (`mejoras/ronda-2.md §5`, maqueta `reference/ronda-2/inicio.html`). Las atenciones se generan con estas reglas:

- Pedido **aceptado** sin descontar filamento y con faltante → "falta tanto de tal filamento".
- Filamento con rollos y **150 g o menos** disponibles.
- Pedido activo con entrega en **2 días o menos** (o vencido).
- Venta con saldo por cobrar.
- Pieza o colección con precio fijo **por debajo del piso** (margen mínimo).
- Mantenimiento pendiente ("Pronto" o "Toca ya"), hasta 3.
- Insumo agotado o en su mínimo.
- Sin copia de seguridad descargada, o la última con más de **7 días**.

**Prioridad de cada atención** (`severity`, `core › classifyAttention`): **Urgente** = pedido aceptado con faltante de filamento; pedido activo con entrega vencida, hoy o mañana. **Esta semana** = entrega en 2 días; venta con saldo; filamento con 150 g o menos; insumo agotado o en su mínimo. **Para revisar** = mantenimiento pendiente; precio por debajo del piso; copia de seguridad.

**Cómo se ve la atención:** cada grupo lleva un punto de su color (rojo, ámbar, gris), su título y una nota (“Bloquea una impresión o vence hoy o mañana” · “Conviene resolverlo pronto” · “Sin prisa”). Arriba, chips con contador **Todas · Urgente · Esta semana · Para revisar**; el filtro no se guarda (al volver a Inicio está en “Todas”) y con un grupo elegido no se repite su título. Cada atención: ícono por tipo (filamento, pedido, cobro, mantenimiento, precio, insumo, copia) en el color de su grupo, el texto de siempre con lo importante en negrita y su botón de siempre. Dentro de un grupo se conserva el orden en que llegan. Si un grupo pasa de 5, se muestran 5 y “Ver las N restantes” agrega 50 más en el mismo lugar hasta acabar; abrir un grupo regresa los otros a 5 y la pantalla nunca pinta más de 200 atenciones (si un grupo pasa de ese número, se quedan a la vista las últimas que se abrieron). Sin atenciones: “Todo en orden”.

**Acciones**
| Botón | Caso de uso / efecto | Lleva a |
|---|---|---|
| Nueva pieza | — | Calculadora (pieza nueva) |
| Nuevo pedido | — | Armar venta o pedido (modo pedido) |
| Registrar venta | — | Armar venta o pedido (modo venta) |
| Cada atención | — | La pantalla o el elemento al que se refiere (pedido, impresora, filamento) |

---

## 3. Productos

**Muestra:** dos pestañas con contador, **Piezas** y **Colecciones**; buscador; forma de ver en **Fichas** o **Lista**; en Piezas, filtros **Todas · Técnicas · Con variantes**. Cada pieza muestra precio, costo, ganancia y libres en Existencias. **Ronda 2:** las variantes viven **dentro de su pieza original** (una familia): el botón “N variantes” de la ficha despliega un panel debajo de su fila, y en la lista una flecha despliega sus filas. “Piezas N” cuenta familias. Detalle en `mejoras/ronda-2.md §3`; maquetas `productos-fichas.html` y `productos-lista.html`.

| Botón | Efecto | Lleva a |
|---|---|---|
| Nueva pieza | — | Calculadora |
| Nueva colección | — | Colección (nueva). Pide que existan piezas |
| Fichas / Lista | Preferencia de vista | — |
| Vender (en una pieza con libres) | — | Armar venta con esa pieza |
| Variante · Nueva variante · Agregar variante de … (en una pieza) | Abre la calculadora (`/productos/pieza?variante=<id>`) con una **copia** de la original, título “Nueva variante de {pieza}” y el campo **Nombre de la variante** vacío y enfocado (sin etiqueta no se guarda); al Guardar se crea con `saveProductAsVariant` (`parentId` = la original raíz) y se vuelve a Productos con su panel abierto (`?abierta=<id>`) | Calculadora |
| N variantes (en una ficha) · flecha (en la lista) | Despliega o cierra las variantes de la pieza; un solo panel abierto a la vez en Fichas | — |
| Abrir pieza / colección | — | Calculadora / Colección |

### 3.1 Calculadora (pieza)
**Muestra:** formulario de la pieza (nombre, etiquetas, impresora, horas, filamentos con gramos, insumos con cantidad, extras, "piezas por placa", ficha técnica, nota, "llevar existencias"), y a la derecha el **desglose en vivo**: M, L, Q, E, reserva de fallos, **Costo**, **Precio** (sugerido, piso, de lista) y **Ganancia** por canal.

| Botón | Caso de uso | Lleva a |
|---|---|---|
| Modo (valor / fórmula) | Cambia cómo se fija el precio | — |
| Agregar otro filamento | Crea la fila con su lista de filamentos **ya abierta y el foco dentro** (selector con búsqueda, §1); arriba van los filamentos que ya usa la pieza (o su original, si es variante), después “Los demás”. Al elegir, el foco pasa a los gramos | — |
| Agregar rollo de otro filamento | Si no existe el filamento → "Agregar rollo"; el nuevo queda elegido en la fila vacía (o en una fila nueva) | Diálogo de rollo |
| Agregar insumo | Crea la fila con la lista de insumos abierta y el foco dentro; al elegir, el foco pasa a la cantidad | — |
| Copiar ficha | Copia la ficha técnica como texto | — |
| Quitar foto | Quita la imagen de la ficha | — |
| Cotizar | Diálogo de cotización rápida (cantidad → total y tiempo) | — |
| Vender | — | Armar venta |
| Guardar | `saveProduct` | Productos |
| Guardar como variante nueva | Pasa al mismo flujo de “Nueva variante” con lo que hay en el formulario (título, campo de etiqueta vacío y enfocado); Guardar llama `saveProductAsVariant` (copia con `parent_id` = la original raíz y `variant_label`) | Productos con su panel abierto |
| Eliminar | `deleteProduct` (soft) + Deshacer | Productos |
| Cancelar | Descarta cambios | Productos |

*Foco al abrir:* una pieza nueva abre con el foco en su nombre; una variante nueva, en “Nombre de la variante” (ronda 2 · D2).

*Variante:* al editar una variante se ve “Variante de {pieza}” y su campo **Nombre de la variante** en lugar del nombre (el nombre que se muestra es `<original> · <etiqueta>`).

*Cálculo en vivo:* el navegador usa `core` para la vista previa. Al guardar, el servidor recalcula; nunca confía en el costo enviado.

### 3.2 Colección
Nombre, piezas con cantidad, extras, precio del set (vacío = suma de sueltas), etiquetas, nota. Muestra costo, precio, ganancia, y cuántos **sets se pueden armar hoy** con los libres. Una colección nueva abre con el foco en su nombre. Acciones: Agregar pieza (crea la fila con la lista de piezas abierta y el foco dentro, con búsqueda; al elegir, el foco pasa a la cantidad), Guardar (`saveCollection`), Eliminar, Vender, Cancelar.

---

## 4. Ventas

**Muestra:** lista de **4 columnas**: Fecha · Artículos (con cliente, pedido, canal y nota) · Total (con chips Debe / Devuelta) · Ganancia. Filtro por canal.

| Botón | Caso de uso | Lleva a |
|---|---|---|
| Registrar venta | — | Armar venta |
| Abrir venta | — | Diálogo de la venta |
| Chip “Debe $X” (botón) | Abre la venta **con el diálogo “Registrar abono” ya abierto** (monto = saldo; `/ventas?v=<id>&abono=1`). Cancelar vuelve al diálogo de la venta; la confirmación con el monto se queda (ronda 2 · D5). “Registrar abono” de la Atención de Inicio usa la misma dirección. Una venta sin saldo o devuelta abre la venta normal | Diálogo del abono |

### 4.1 Diálogo de la venta
Desglose por pieza (con dónde está cada una), cobro (pagos), nota de venta.
| Botón | Caso de uso |
|---|---|
| Registrar abono | `recordSalePayment` |
| Quitar pago | `deleteSalePayment` |
| Nota de venta | Abre el documento (ver §14) |
| Devolver venta | `returnSale` (con o sin regresar a existencias; reembolso y nota) |
| Editar | `updateSale` (fecha, canal, cliente, nota). Sin cliente elegido, el enlace “Nuevo cliente” bajo el selector crea uno y lo deja elegido (como en Armar venta) |
| Eliminar | `deleteSale` + Deshacer (devuelve las piezas a existencias si salieron) |
| Cliente / Pedido | Abre la ficha del cliente / el pedido |

### 4.2 Armar venta o pedido
**Una sola pantalla para ambos.** Se agregan artículos (piezas y sets) con cantidad y precio; muestra **Total, Costo, Ganancia** y avisos de precio bajo el piso. Campos: canal, fecha, cliente, nota; si es pedido: entrega, aceptado o cotización, anticipo; si es venta: "Cobrado ahora" (si es menos que el total se crea un pago parcial).

| Botón | Caso de uso | Lleva a |
|---|---|---|
| Agregar pieza / set | — | — |
| Precio de lista / separar / descuento / piso | Ajustan el precio unitario | — |
| Convertir en pedido | Cambia el modo; lo que hay en existencias se aparta y el resto se imprime | — |
| Nuevo cliente (enlace bajo el selector de cliente, sin cliente elegido) | Abre el diálogo de cliente nuevo; al guardar queda elegido. La opción “＋ Cliente nuevo…” al final del selector se conserva (ronda 2 · D6) | — |
| Guardar venta | `createSale` (descuenta existencias de las piezas con `tracks_stock`) | Ventas |
| Guardar pedido | `createOrder` (+ `acceptOrder` si ya está aceptado; + pago de anticipo) | Pedido |
| Cancelar | — | Ventas / Pedidos |

---

## 5. Pedidos

**Muestra:** franja de resumen (pedidos en curso, por cobrar, entregas próximas, ganancia si se entregan todos) y tres vistas, que se cambian con un selector:

- **Tablero** (la que abre por defecto): cuatro columnas — **Pendientes** (cotizados y aceptados, con su conteo), **En producción**, **Listos para entregar**, **Entregados** (solo los 3 más recientes y el enlace "Ver los N entregados"). Cada tarjeta trae cliente, folio, artículos, dónde está cada pieza (existencias / por imprimir), avance de impresión, fecha de entrega, Total · Saldo o Pagado · Ganancia, y el botón del siguiente paso.
- **Lista**: **5 columnas** — Pedido · Estado · Entrega · Total · Saldo; filtros **Todos · Pendientes · En producción · Listos · Entregados · Cancelados**, cada uno con su conteo.
- **Calendario**: por mes, con los pedidos en su fecha de entrega; botón "Hoy".

Tras guardar un pedido nuevo se vuelve al Tablero.

| Botón | Lleva a |
|---|---|
| Nuevo pedido | Armar pedido |
| Tablero / Lista / Calendario | Cambia la vista |
| Abrir pedido | Pedido |

### 5.1 Pedido
**Muestra:** encabezado con cliente y siguiente paso; avance (cotizado → aceptado → producción → listo → entregado) o estado Cancelado; tres cifras (Total, Pagado, Saldo) y, plegado, **Costo y ganancia**; y **pestañas**: Piezas · Cobro · Producción (si aplica) · Datos.

| Botón | Caso de uso | Detalle |
|---|---|---|
| Siguiente paso (texto cambia) | `acceptOrder` / `startProduction` / `markOrderReady` / `deliverOrder` | Ver `04 §7`. Poner en producción abre diálogo de impresoras |
| Poner en producción | `startProduction` | Diálogo: asignar impresora por artículo, ver plan y fecha de término, opción de descontar filamento, aviso de faltante |
| Reasignar impresoras | `reassignPrinters` | Quita de las colas y vuelve a asignar |
| Registrar pago | `recordOrderPayment` | Diálogo con monto máximo = saldo |
| Quitar pago | `deleteOrderPayment` | |
| Entregar y cobrar | `deliverOrder` | Diálogo con saldo a cobrar; crea la venta |
| Editar | `updateOrder` | Abre el armador con el pedido |
| Cotización / Nota de venta | Documento (ver §14) | |
| Copiar | Resumen del pedido como texto | |
| Cancelar pedido (pestaña Datos) | `cancelOrder` | Motivo y reembolso; efectos listados en el diálogo |
| Eliminar (pestaña Datos) | `deleteOrder` + Deshacer | |
| Cliente | | Ficha del cliente |

---

## 6. Filamentos

**Muestra:** lista ancha de filamentos (material + color) con lo que queda, rollos, costo por gramo, y estado (Sin rollos · Agotado · Se acaba · Poco · Nuevo · Normal, `04 §1`). Seleccionar uno abre el **cajón** con sus rollos y movimientos.

| Botón | Caso de uso |
|---|---|
| Agregar rollo | `addSpool` (crea el filamento si no existe; movimiento `purchase`). Si el material y color ya existen (o el diálogo se abre desde el filamento), la **marca** propone la de su último rollo (el de fecha de compra más reciente) hasta que la persona elige otra; se ve en el resumen y sigue editable (ronda 2 · D3) |
| Editar rollo / Eliminar rollo | `updateSpool` / `deleteSpool` |
| Movimiento (en el cajón) | `recordSpoolMovement` (consumo, fallo, merma, ajuste) con nota |
| Ver filamento | Abre el cajón |

---

## 7. Insumos

**Muestra:** lista ancha con existencia, mínimo, proveedor y estado. Cajón con movimientos.
| Botón | Caso de uso |
|---|---|
| Nuevo insumo | `createSupply` (con "inventario inicial") |
| Editar / Eliminar | `updateSupply` / `deleteSupply` |
| Registrar compra | `recordSupplyPurchase` |
| Registrar uso / ajuste / merma | `recordSupplyMovement` |

---

## 8. Impresoras

**Muestra:** por impresora: estado (imprimiendo/libre), cola con progreso y tiempo restante, horas acumuladas, mantenimiento (Al corriente / Pronto / Toca ya) y **recuperación de la inversión**.
| Botón | Caso de uso |
|---|---|
| Nueva / Editar impresora | `createPrinter` / `updatePrinter` (nueva trae las 3 tareas base) |
| Terminar (trabajo actual) | `finishQueueEntry`: saca el trabajo de la cola, empieza el siguiente; **si ya no queda nada del pedido en ninguna impresora, ejecuta `markOrderReady`** |
| Nueva tarea / Editar tarea | `createMaintenanceTask` / `updateMaintenanceTask` |
| Hecho (tarea) | `completeMaintenance`: fija `last_hours` a las horas actuales y crea un **gasto** (si lleva costo) |
| Eliminar tarea / impresora | `delete…` |
| Abrir pedido (desde la cola) | Pedido |

---

## 9. Producción

**Muestra:** bloque **Imprimiéndose ahora** (cola en vivo por impresora) y la lista de **registros**: todo lo que se imprimió (para existencias, pedidos y pruebas), con filtros **Todo · Existencias · Pedidos · Pruebas** (cada uno con su conteo) y totales de piezas, horas, filamento.
| Botón | Caso de uso |
|---|---|
| Registrar impresión | `logPrintRun` (pieza, cantidad, impresora, resultado, horas, filamento por rollo, motivo, foto) |
| Abrir registro | Diálogo con detalle |
| Eliminar registro | `deletePrintRun` (con las condiciones de `04 §8`) |
| Abrir pedido | Pedido |
| Filtros | Cambian la lista |

*Nota:* las impresiones de pedidos **aparecen solas** al marcar listo un pedido cuyo filamento se descontó al iniciar.

---

## 10. Existencias

**Muestra:** piezas con existencias en **Lista** (por defecto) o **Fichas** (selector, se recuerda): Estado, Libres, Apartadas, Total y precio de lista, y sets armables; filtros por estado (Todas · Pocas · Todo apartado · Disponible · Agotadas) y buscador. Orden: menos libres primero. **Ronda 2:** una pieza con variantes es **una fila o ficha** con sus miembros desplegables y la suma de sus existencias; las fichas ya no dibujan un cuadrito por unidad (un número grande de libres y una barra de libres contra apartadas). El cajón con movimientos se abre desde la pieza o el miembro que tiene movimientos propios. Detalle en `mejoras/ronda-2.md §4`; maquetas `existencias-lista.html` y `existencias-fichas.html`. La vista se recuerda así: `?vista=fichas|lista` en la dirección y, sin ella, la última elegida en este navegador (`view.stock`); si no hay ninguna, Lista. En Lista, “Libres” en el encabezado alterna menos/más libres primero; la fila de una familia solo despliega sus variantes (la original primero, “Original”), y cada pieza simple o variante abre el cajón con “›” o tocando la fila. En Fichas, tocar la ficha abre la original (o la primera variante con existencias) y cada línea de variante abre la suya.
| Botón | Caso de uso |
|---|---|
| Llevar existencias (en una pieza) | `enableStockTracking` (con conteo inicial) |
| Ajustar | `adjustStock` (conteo real o corrección con nota) |
| Registrar impresión | Abre Producción con el diálogo (suma a existencias) |
| Fichas / Lista | Preferencia de vista de Existencias (`view.stock`) | — |
| Seleccionar pieza (o un miembro de una familia) | Abre el cajón | — |
| Flecha de una familia | Despliega o cierra sus variantes | — |
| Vender (en la fila de una pieza simple o de una variante con libres; en Fichas, en la ficha de una pieza simple con libres) | Lleva a Armar venta con esa pieza, como “Vender” del cajón (ronda 2 · D4). Sin libres no aparece: el cajón ofrece “Hacer pedido”. La fila de una familia solo despliega | Armar venta |

---

## 11. Compras

**Muestra:** lista calculada de lo que conviene comprar (filamento e insumos), agrupada por proveedor, con cantidad y costo estimado; proveedores con teléfono.
| Botón | Caso de uso |
|---|---|
| Copiar lista | Texto para mandar por mensaje (por proveedor) |
| Nuevo / Editar proveedor | `createSupplier` / `updateSupplier` |
| Eliminar proveedor | `deleteSupplier` |

---

## 12. Clientes

**Lista:** 4 columnas — Cliente · Contacto · Compras · Debe. Nuevo cliente abre su ficha.
**Ficha del cliente (página):** datos, logo, nota, totales (pedidos, ventas, ingreso, ganancia, por cobrar), historial combinado de pedidos y ventas.
| Botón | Caso de uso |
|---|---|
| Nuevo cliente | `createCustomer` |
| Editar | `updateCustomer` |
| Copiar | Datos como texto |
| Nuevo pedido / Nueva venta | Armador con el cliente ya elegido |
| Eliminar | `deleteCustomer` + Deshacer |
| Quitar logo | Quita el archivo |

---

## 13. Gastos y Reportes

**Gastos:** lista con filtro de periodo, categorías, **fijos al mes** y total del periodo. Acciones: Nuevo / Editar / Eliminar gasto (`createExpense`, `updateExpense`, `deleteExpense`). Recurrente = se prorratea.

**Reportes:** periodo (7 días, 30 días, 90 días, Todo); totales (Ventas, Costo, Ganancia, margen, piezas), por canal, ranking de piezas, gastos y **ganancia neta**, inversión recuperada. Acciones: cambiar periodo, **Copiar** (resumen como texto), Registrar venta.

---

## 14. Documentos (cotización y nota de venta)

Se arman en la interfaz con los datos del pedido o la venta y los **datos del negocio** de Ajustes (nombre, giro, teléfono, correo, ciudad, vigencia, pie de página). **Nada de eso va escrito en el código.** El encabezado de la hoja muestra el nombre y el giro como texto; el logo con texto de `assets/` no se usa aquí.
| Botón | Efecto |
|---|---|
| Copiar texto | Versión en texto plano |
| Imprimir / PDF | Imprime la hoja (en la app de escritorio y en navegador normal; dentro de visores restringidos puede no estar disponible) |

---

## 15. Ajustes

| Sección | Qué contiene | Caso de uso |
|---|---|---|
| Costos del taller | kWh, fallos, purga, margen mínimo, margen de fórmula | `updateSettings` |
| Canales de venta | Lista editable de canales con su comisión | `addChannel` / `removeChannel` |
| Documentos | Datos del negocio que salen en cotizaciones y notas (nombre, giro, teléfono, correo, ciudad, vigencia, pie de página) | `updateSettings` |
| Copia de seguridad | Estado ("Aún no hay una copia descargada" / "Última copia hace N días"), descargar copia (archivo), restaurar desde archivo, lista de **copias automáticas** (una por día, las últimas 7) con "Restaurar", y en escritorio "Mostrar archivo de registro". Aviso fijo: *"Esta copia contiene todos los datos del negocio. Guárdala en un lugar seguro."* (`11 › S3`) | `exportWorkspace` / `importWorkspace` / `createBackup` / `restoreBackup` |
| Exportar a Excel (CSV) | Siete tablas: ventas, pedidos, clientes, piezas y costos, filamentos y rollos, insumos, gastos; descargar o copiar | Solo interfaz (`lib/csv.ts`) |
| Datos de ejemplo (mockup) | "Volver al ejemplo" / "Vaciar" (antes guarda una copia) | En el producto: **Vaciar negocio** con copia previa; la carga de ejemplo es solo de desarrollo |

Los catálogos (materiales, colores con su tono, marcas) **no tienen pantalla propia**: crecen solos cuando se escribe un valor nuevo en un formulario (`catalog_item`).

---

## 16. Mapa de acciones del mockup → casos de uso

Cada acción del mockup (`ACT` en `init.js`) y dónde cae. Las acciones de **navegación o presentación** no tocan el servidor.

| Acción del mockup | Tipo | Caso de uso del producto |
|---|---|---|
| go, nav-toggle, nav-close, dlg-close, drw-close, buscar, atajos, pal-pick, vista, filtro, cat, cat-col, canal-filtro, ped-vista, ped-filtro, ped-tab, prod-filtro, cal-mes, rep-per, fl-sel, ins-sel, ex-sel, fil-ver, tag | presentación | (solo interfaz) |
| nueva-pieza, variante, open-prod, save-prod, save-var, del-prod, cancel-edit, modo, fil-add, fil-del, ins-add, foto-quitar, ficha-copy, set-precio | productos | `saveProduct`, `saveProductAsVariant`, `deleteProduct` |
| nueva-coleccion, open-col, cparte-add, cparte-del, c-precio, save-col, del-col, cancel-col | colecciones | `saveCollection`, `deleteCollection` |
| cotizar | cotización rápida | (solo cálculo) |
| venta-new, ped-new, b-to-ped, b-add, b-del, b-lista, b-sep, b-desc, b-piso, b-save, b-cancel | armador | `createSale`, `createOrder` |
| venta-open, venta-edit, venta-del, venta-abono, vpago-del, venta-devolver | ventas | `updateSale`, `deleteSale`, `recordSalePayment`, `deleteSalePayment`, `returnSale` |
| ped-open, ped-next, ped-asignar, ped-pago, pago-del, ped-edit, ped-copy, ped-del, ped-cancelar, ped-lista, cli-ped | pedidos | `acceptOrder`, `startProduction`, `reassignPrinters`, `markOrderReady`, `deliverOrder`, `recordOrderPayment`, `deleteOrderPayment`, `updateOrder`, `deleteOrder`, `cancelOrder` |
| rollo-new, rollo-edit, rollo-del, mov-new | filamento | `addSpool`, `updateSpool`, `deleteSpool`, `recordSpoolMovement` |
| ins-new, ins-edit, ins-del, ins-compra, ins-uso, ins-ir | insumos | `createSupply`, `updateSupply`, `deleteSupply`, `recordSupplyPurchase`, `recordSupplyMovement` |
| imp-new, imp-edit, imp-del, imp-fin, mant-new, mant-edit, mant-hecho, mant-del | impresoras | `createPrinter`, `updatePrinter`, `deletePrinter`, `finishQueueEntry`, `createMaintenanceTask`, `updateMaintenanceTask`, `completeMaintenance`, `deleteMaintenanceTask` |
| print-new, prod-open, prod-del | producción | `logPrintRun`, `deletePrintRun` |
| ex-on, ex-ajuste | existencias | `enableStockTracking`, `adjustStock` |
| cli-new, cli-edit, cli-edit-b, cli-open, cli-copy, cli-venta, cli-del, cl-logo-quitar | clientes | `createCustomer`, `updateCustomer`, `deleteCustomer`, `removeCustomerLogo` |
| gasto-new, gasto-edit, gasto-del | gastos | `createExpense`, `updateExpense`, `deleteExpense` |
| prov-new, prov-edit, prov-del, compra-copy | compras | `createSupplier`, `updateSupplier`, `deleteSupplier` |
| doc-open, doc-copy, doc-print | documentos | (solo interfaz) |
| canal-add, canal-del, (renombrar o cambiar comisión: evento de cambio del campo, sin acción propia) | ajustes | `addChannel`, `removeChannel`, `updateChannel` |
| bak-dl, auto-rest, restaurar, export, exp-csv, exp-copy, rep-copy | datos / exportar | `exportWorkspace`, `importWorkspace`, `createBackup`, `restoreBackup`; CSV y copiar son de interfaz. "Copiar respaldo como texto" y "Restaurar pegando texto" eran de la maqueta y no pasan al producto |
| undo, redo | historial | `restoreProduct`, `restoreCollection`, `restoreSale`, `restoreOrder`, `restoreCustomer`, `restoreExpense`, `restoreSpool`, `restoreSupply`, `restoreSupplier`, `restorePrinter` (deshacer); rehacer queda fuera |
| demo-reset, demo-clear | datos de ejemplo | `clearWorkspace`; la carga de ejemplo es solo para desarrollo |

---

## 17. Flujos principales de punta a punta

**A. Venta rápida de una pieza en existencias**
Productos → Vender → Armar venta (1 pieza, precio, canal, "Cobrado ahora" = total) → Guardar → `createSale`: crea venta + artículo con foto del momento + pago; movimiento `sale` (−1) en existencias.

**B. Pedido con piezas por imprimir (el flujo largo)**
1. Armar pedido (cliente, entrega, artículos, anticipo) → `createOrder` (estado Cotizado o Aceptado).
2. *Cliente aceptó* → `acceptOrder`: aparta lo planeado de existencias; avisa si faltó.
3. *Poner en producción* → `startProduction`: asigna impresoras, crea la cola, descuenta filamento si se eligió.
4. Las impresoras trabajan; en Impresoras, *Terminar* cada trabajo. Al terminar el último → `markOrderReady`: libera colas, crea registros de producción (si se descontó filamento), aparta piezas.
5. *Entregar y cobrar* → `deliverOrder`: registra el cobro, **crea la venta**, saca las piezas de existencias.

**C. Pedido todo de existencias**
Aceptado → "Marcar listo" directo (no hay nada que imprimir) → Entregar.

**D. Cancelar un pedido**
Pedido → Datos → Cancelar → motivo y reembolso → `cancelOrder`: sale de colas, libera piezas, pago negativo; no cuenta como venta.

**E. Devolver una venta**
Ventas → abrir → Devolver → ¿regresa a existencias? ¿reembolso? → `returnSale`: ingreso 0; si regresa, movimiento `return` (+n) y costo 0; si no, se pierde el costo.

**F. Comprar lo que falta**
Compras muestra la lista calculada → Copiar por proveedor → (compra real) → Filamentos "Agregar rollo" / Insumos "Registrar compra".
