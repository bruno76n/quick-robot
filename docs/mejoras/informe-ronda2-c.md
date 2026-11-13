# Informe de la ronda 2 · fase C (medición de clics)

## Resumen
Se midieron **35 flujos** (los 19 de `ronda-2 §11.2` y 16 más encontrados en las pantallas) recorriéndolos con el mouse por el camino normal en 1440 con la semilla de desarrollo. Cada medición es una prueba de Playwright que **fija el número de hoy** en `e2e/clicks/budget.ts`. De los 35, **16 se pueden acortar** (ahorro de 1 a 2 clics, o de un campo que hoy hay que tocar para escribir) y se marcan **“hacer”** para la fase D: 12 por clics y 4 por foco inicial (un solo cambio en `Dialog.tsx`). P1 en “Agregar filamento” va primero, como pide el plan. Esta fase **no cambió el producto**.

## Pasos
| Paso | Estado | Commit | Notas |
|---|---|---|---|
| C1 · Contador `countedPage` | hecho | `7d819b4` | `e2e/clicks/counted.ts`; decisiones de la carpeta y de cómo se cuenta en `decisiones.md` |
| C2 · Presupuestos y pruebas de 35 flujos | hecho | `a14808e` | `e2e/clicks/{products,sales,orders,workshop,admin}.spec.ts` y `budget.ts` |
| C3 · Informe y progreso | hecho | este commit | Este archivo y `progreso.md` |

## Cómo se midió
- **Un clic** = un clic o toque en botón, fila, tarjeta, enlace, casilla u opción. **Un selector nativo cuesta 2**: abrirlo y elegir (si contara 1, la mejora P1 no se vería). Teclear no cuenta; **campos** = campos de texto que hay que tocar para poder escribir (el primer campo de un diálogo ya tiene el foco y no cuesta).
- Cada flujo empieza en la pantalla donde vive (abierta por dirección); llegar desde el menú no cuenta. Se usan los valores que la pantalla ya propone (cantidad 1, fecha de hoy, “Cobrado ahora” vacío = total, saldo propuesto al entregar) y se envía con el botón, no con Enter.
- **Mínimo posible:** lo que costaría quitando solo pasos que no deciden nada, sin quitar confirmaciones de dinero o existencias, sin ocultar información y sin atajos (`ronda-2 §11.5`).
- **Puntaje** = ahorro × frecuencia ÷ riesgo, con **frecuencia** alta = 3, media = 2, baja = 1 y **riesgo** bajo = 1, medio = 2, alto = 3. Ahorro en clics.
- **Regla de decisión:** “hacer” si el puntaje es 2 o más; también, con puntaje menor, **la familia de P1** que nombra `§11.3` (filamento, insumo, partes de colección; obligatorio) y **un paso repetido** (P5: un botón que lleva a otro botón con el mismo nombre) de riesgo bajo. Lo demás con ahorro, “no hacer”.

## Tabla de flujos (ordenada por puntaje)
`Prueba` es la clave en `budget.ts`. Clics y campos: **hoy → mínimo**.

| # | Flujo | Prueba | Clics | Campos | Ahorro | Frec. | Riesgo | Puntaje | Decisión y por qué |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Agregar rollo desde el encabezado (material, color y marca) | `addSpoolHeader` | 8 → 6 | 1 → 1 | 2 | media | bajo | 4 | **Hacer (P4).** La marca se vuelve a elegir aunque el filamento ya exista; proponer la del último rollo de ese material y color. Material y color sí deciden |
| 2 | Nueva pieza completa (2 filamentos, 1 insumo, tiempo, precio) | `newPieceFull` | 10 → 8 | 5 → 2 | 2 | media | bajo | 4 | **Hacer (P1 + P2), obligatorio.** “Agregar otro filamento” y “Agregar insumo” crean una fila que pide otro clic para abrir su selector; el nombre no tiene el foco al abrir; al elegir un filamento el foco no pasa a sus gramos |
| 3 | Vender una pieza de existencias | `sellFromStock` | 3 → 2 | 0 → 0 | 1 | alta | bajo | 3 | **Hacer (P8).** Hoy: fila → cajón → Vender → Registrar venta. “Vender” en la fila, como en la ficha de Productos |
| 4 | Registrar abono de una venta (Ventas) | `salePayment` | 3 → 2 | 0 → 0 | 1 | media | bajo | 2 | **Hacer (P5/P8).** El chip “Debe $X” de la fila abre directo el diálogo del abono (el monto ya viene con el saldo). La confirmación con monto se queda |
| 5 | Registrar abono desde Inicio | `salePaymentFromHome` | 3 → 2 | 0 → 0 | 1 | media | bajo | 2 | **Hacer (P5).** “Registrar abono” lleva a la venta, que vuelve a pedir “Registrar abono”: que abra el diálogo del abono |
| 6 | Nuevo pedido con cliente nuevo | `newOrderNewCustomer` | 6 → 5 | 1 → 1 | 1 | media | bajo | 2 | **Hacer (P9).** “＋ Cliente nuevo…” está al final del selector (abrir + bajar + elegir = 2); un enlace “Nuevo cliente” visible bajo el selector cuesta 1. Se conserva la opción del selector |
| 7 | Registrar pago de un pedido | `orderPayment` | 4 → 3 | 0 → 0 | 1 | media | bajo | 2 | **Hacer (P8).** Hoy: pedido → pestaña Cobro → Registrar pago → enviar. “Registrar pago” junto a las cifras (Saldo) del encabezado, visible en cualquier pestaña |
| 8 | Ajustar existencias (una dañada, con nota) | `adjustStock` | 5 → 4 | 1 → 1 | 1 | media | bajo | 2 | **Hacer (P7).** Los 4 motivos van en un selector (2 clics); como botones segmentados (como “Motivo” de Registrar impresión) cuestan 1 y se ven todos |
| 9 | Agregar filamento a una pieza | `addFilamentToPiece` | 5 → 4 | 1 → 0 | 1 | baja | bajo | 1 | **Hacer (P1), obligatorio.** Mismo cambio que el #2 (misma pantalla) |
| 10 | Agregar insumo a una pieza | `addSupplyToPiece` | 5 → 4 | 0 → 0 | 1 | baja | bajo | 1 | **Hacer (P1).** Mismo componente de fila que el #2; `§11.3` lo nombra |
| 11 | Nueva colección (2 piezas) | `newCollection` | 7 → 6 | 1 → 0 | 1 | baja | bajo | 1 | **Hacer (P1 + P2).** “Agregar pieza” igual que filamentos; el nombre con el foco al abrir |
| 12 | Registrar compra desde Compras | `supplyPurchaseFromPurchases` | 3 → 2 | 1 → 1 | 1 | baja | bajo | 1 | **Hacer (P5).** “Registrar compra” lleva a Insumos con el cajón, que pide otra vez “Registrar compra”: abrir el diálogo de la compra directamente |
| 13 | Registrar movimiento de filamento | `filamentMovement` | 5 → 4 | 1 → 0 | 1 | baja | bajo | 1 | No hacer. Poco frecuente (el consumo lo descuenta la impresión). Si D cambia #8, puede reusar el mismo segmentado |
| 14 | Nuevo cliente (Clientes) | `newCustomer` | 4 → 3 | 1 → 1 | 1 | baja | bajo | 1 | No hacer. El tipo (Persona/Empresa) como segmentado ahorra 1, pero casi siempre se deja el que viene; los clientes nacen más desde el pedido (#6) |
| 15 | Cotizar a cliente | `quote` | 3 → 2 | 0 → 0 | 1 | media | medio | 1 | No hacer. Ahorrar el clic exige un botón más en cada ficha de Productos (ya tiene Vender y Variante): más ruido en la pantalla más usada |
| 16 | Registrar compra de un insumo (Insumos) | `supplyPurchase` | 3 → 2 | 1 → 1 | 1 | baja | medio | 0.5 | No hacer. Un botón en cada tarjeta de Insumos; la tarjeta ya abre el cajón con la acción a la vista |
| 17 | Registrar impresión desde el cajón (pieza ya elegida) | `printRunFromPiece` | 3 → 3 | 1 → 0 | 0 | alta | bajo | 0 | **Hacer (P2, ver T1).** El foco cae en el botón de radio “Motivo”; debe caer en “Cantidad impresa” |
| 18 | Agregar rollo de un filamento que existe | `addSpoolExisting` | 3 → 3 | 1 → 0 | 0 | media | bajo | 0 | **Hacer (P2, ver T1).** “Costo” tiene `autoFocus`, pero el diálogo le quita el foco |
| 19 | Usar o ajustar un insumo | `supplyUse` | 3 → 3 | 1 → 0 | 0 | baja | bajo | 0 | **Hacer (P2, ver T1).** El foco cae en “Motivo” (selector con un valor ya puesto); debe caer en “Cantidad” |
| 20 | Mantenimiento hecho (con costo) | `maintenanceDone` | 2 → 2 | 1 → 0 | 0 | baja | bajo | 0 | **Hacer (P2, ver T1).** El foco cae en la fecha (ya es hoy); debe caer en “Costo de piezas” |
| 21 | Registrar venta con varios artículos | `saleSeveralItems` | 7 → 7 | 1 → 1 | 0 | alta | — | 0 | No hacer. Cada pieza se agrega con un toque y el cobro ya es el total; el cliente es una decisión real (2) |
| 22 | Registrar impresión desde Existencias | `printRun` | 4 → 4 | 1 → 1 | 0 | alta | — | 0 | No hacer. Elegir la pieza es la decisión; cantidad, impresora, horas y gramos ya vienen propuestos |
| 23 | Vender desde Productos | `sellFromProducts` | 2 → 2 | 0 → 0 | 0 | alta | — | 0 | No hacer. Vender + confirmar (mueve existencias) |
| 24 | Poner en producción | `startProduction` | 2 → 2 | 0 → 0 | 0 | media | — | 0 | No hacer. El diálogo asigna impresoras y descuenta filamento: es la confirmación de un movimiento de inventario |
| 25 | Entregar y cobrar | `deliverAndCharge` | 2 → 2 | 0 → 0 | 0 | media | — | 0 | No hacer. Cobro con el saldo propuesto; confirmación de dinero |
| 26 | Cliente aceptó | `acceptOrder` | 1 → 1 | 0 → 0 | 0 | media | — | 0 | Ya es mínimo (un toque en la tarjeta del Tablero) |
| 27 | Marcar listo | `markReady` | 1 → 1 | 0 → 0 | 0 | media | — | 0 | Ya es mínimo |
| 28 | Terminó este trabajo (Impresoras) | `finishJob` | 1 → 1 | 0 → 0 | 0 | media | — | 0 | Ya es mínimo |
| 29 | Nueva variante | `newVariant` | 2 → 2 | 0 → 0 | 0 | media | — | 0 | Ya es mínimo (la etiqueta nace con el foco) |
| 30 | Llevar existencias a una pieza | `enableStock` | 4 → 4 | 1 → 1 | 0 | baja | — | 0 | No hacer. La pieza y el conteo son la decisión |
| 31 | Venta desde la ficha de un cliente | `saleFromCustomer` | 4 → 4 | 0 → 0 | 0 | media | — | 0 | Ya es mínimo (el cliente viene elegido) |
| 32 | Registrar gasto | `newExpense` | 4 → 4 | 1 → 1 | 0 | media | — | 0 | No hacer. La categoría es una decisión; proponer la última usada cambiaría lo que se guarda sin que se vea |
| 33 | Nuevo insumo | `newSupply` | 4 → 4 | 2 → 2 | 0 | baja | — | 0 | No hacer. El proveedor es una decisión |
| 34 | Nueva impresora | `newPrinter` | 2 → 2 | 1 → 1 | 0 | baja | — | 0 | Ya es mínimo |
| 35 | Devolver una venta | `returnSale` | 3 → 3 | 0 → 0 | 0 | baja | — | 0 | No hacer (`§11.5`): devolver mueve dinero y existencias; la confirmación se queda |

**Total:** 16 “hacer” (12 por clics y 4 por foco), 19 “no hacer” o ya mínimos. Ahorro si D hace todo: 14 clics y 9 campos en la suma de los 35 flujos.

## Qué cambiar en la fase D (por orden)
**D1 · P1 en filas nuevas (#2, #9, #10, #11) — primero, obligatorio.** `apps/web/src/features/products/ProductEditor.tsx` (filas `.frow` de filamentos, `.irow` de insumos) y `CollectionEditor.tsx` (`.cparte`). Hoy son `<select>` nativos, que no se pueden abrir desde el código. Cambiar el selector de la fila por un **selector propio accesible** (botón + lista con `role=listbox`, abre con Enter/Espacio/flecha, Esc cierra, el foco vuelve al botón) y al tocar “Agregar otro filamento” / “Agregar insumo” / “Agregar pieza” **crear la fila con la lista abierta y el foco dentro**; al elegir, el foco pasa a gramos / cantidad. En filamentos, la lista lleva primero los usados en la pieza y búsqueda al escribir (P7); “Agregar rollo de otro filamento” se queda (P9 ya existe). Un componente para las tres filas. Bajar `newPieceFull` 10 → 8 (campos 5 → 2 junto con D2), `addFilamentToPiece` 5 → 4, `addSupplyToPiece` 5 → 4, `newCollection` 7 → 6. Las pruebas que usan `.frow select` / `.cparte select` (`e2e/workshop.spec.ts`, `e2e/products-variants.spec.ts`, `e2e/clicks/products.spec.ts`) se ajustan al nuevo selector.

**D2 · P2 en las calculadoras nuevas (#2, #11).** `ProductEditor.tsx` (pieza nueva, sin `id` ni `variante`) y `CollectionEditor.tsx` (colección nueva): el campo del nombre con el foco al abrir.

**T1 · P2 en todos los diálogos (#17–#20).** `apps/web/src/components/Dialog.tsx`: hoy enfoca el primer `input/select/textarea` aunque sea un radio, una fecha o un campo oculto, y le quita el foco al campo que tenía `autoFocus` (el costo del rollo). Cambiar a: primero el elemento marcado (`[autofocus]` o `data-autofocus`), si no, el primer campo **visible** que no sea radio, casilla ni fecha. Marcar: “Cantidad impresa” cuando la pieza viene elegida (`PrintRunDialog.tsx`), “Costo” del rollo con filamento ya elegido (`SpoolDialog.tsx`, ya lo pide), “Cantidad” en `UseDialog` (`SupplyDialogs.tsx`), “Costo de piezas” en `DoneDialog` (`PrinterDialogs.tsx`). Baja `fieldsClicked` de `printRunFromPiece`, `addSpoolExisting`, `supplyUse`, `maintenanceDone` a 0. Prueba de componente en `components.test.tsx`.

**D3 · Marca propuesta del rollo (#1).** `apps/web/src/features/filament/SpoolDialog.tsx`: al elegir un material y color que ya existen (“Se suma a …”), proponer la marca de su último rollo (sigue editable y visible en el resumen). `addSpoolHeader` 8 → 6.

**D4 · Vender desde la fila de Existencias (#3).** `apps/web/src/features/stock/StockPage.tsx`: en Lista, botón “Vender” en `sk-act` de cada pieza o variante con libres (texto `screens.stock.sell`, el mismo destino que el del cajón: `/armar?modo=venta&pieza=`); en Fichas, en la línea de la pieza. Sin libres, nada nuevo (el cajón sigue ofreciendo “Hacer pedido”). En móvil cabe en la tarjeta. `sellFromStock` 3 → 2.

**D5 · Abono directo (#4, #5).** `apps/web/src/features/sales/SalesPage.tsx` y `SaleDialogs.tsx`: el chip “Debe $X” de la fila es un botón que abre la venta **con el diálogo del abono ya abierto** (por ejemplo `?v=<id>&abono=1`; Cancelar del abono vuelve a la venta). El enlace “Registrar abono” de Inicio (`features/home/attentionView.tsx`, hoy `/ventas?v=<id>`) usa la misma dirección. `salePayment` y `salePaymentFromHome` 3 → 2.

**D6 · Cliente nuevo visible en el armador (#6).** `apps/web/src/features/builder/BuilderPage.tsx`: en la línea `#b-cli-info`, sin cliente elegido, un enlace “Nuevo cliente” que abre `CustomerDialog` (se conserva la opción del selector). Igual en el diálogo “Editar datos” de la venta si se reutiliza. `newOrderNewCustomer` 6 → 5.

**D7 · Registrar pago a la vista (#7).** `apps/web/src/features/orders/OrderPage.tsx`: “Registrar pago” junto a las tres cifras (bajo Saldo) cuando hay saldo y el pedido está activo, sin cambiar de pestaña; el de la pestaña Cobro se queda. `orderPayment` 4 → 3.

**D8 · Motivo del ajuste segmentado (#8).** `apps/web/src/features/stock/StockDialogs.tsx` (`AdjustDialog`): los 4 motivos como el segmentado “Motivo” de `PrintRunDialog` (radios con etiqueta, navegables con flechas). Con T1, el foco va a la cantidad. `adjustStock` 5 → 4.

**D9 · Compra directa desde Compras (#12).** `apps/web/src/features/purchases/PurchasesPage.tsx` y `supplies/SuppliesPage.tsx`: “Registrar compra” de una línea de insumo abre el diálogo de la compra (por ejemplo `/insumos?i=<id>&compra=1`, con el cajón detrás). `supplyPurchaseFromPurchases` 3 → 2.

Para cada uno: bajar su número en `e2e/clicks/budget.ts` en el mismo commit que la mejora y describir el comportamiento en `06`.

## Otros hallazgos (sin cambio de número)
- **P3 · Teclado:** los diálogos son `<form>`: Enter envía y Esc cierra. La calculadora y el armador no son formularios: Enter no guarda. **No se cambia**: en el armador, Enter en un campo registraría una venta (mueve existencias) sin querer.
- **P8 · Zona de clic:** filas y tarjetas de Productos, Pedidos (Tablero), Existencias, Ventas, Clientes, Filamentos e Insumos ya abren su detalle al tocarlas en cualquier parte.
- **P9:** “Agregar rollo de otro filamento” (calculadora) y “＋ Cliente nuevo…” (armador y venta) ya crean sin salir; falta solo hacerlo visible (#6).
- **P7:** los selectores de cliente y de pieza son nativos, sin búsqueda; con la semilla son cortos. Si el negocio real tiene muchos clientes, el selector de D1 se puede reusar después (no se marca: no cambia clics).

## Pruebas
- **Medición:** `pnpm exec playwright test e2e/clicks` → 35 pruebas en verde, cada una con su presupuesto exacto (clics y campos). Si un número cambia, la prueba falla y muestra los pasos contados.
- `pnpm typecheck` en verde; `pnpm lint` 0 errores.
- No se tocó código del producto: `pnpm test`, `pnpm security` y `pnpm size` no cambian respecto de la fase B.

## Comparación con el mockup
No aplica (no hay pantallas nuevas).

## Decisiones tomadas
En `docs/decisiones.md`, al final, bajo “2026-11-13 · Ronda 2 · Fase C · Medición de clics”: carpeta `e2e/clicks/` (no `apps/web/e2e/clicks/`), selector nativo = 2 clics, dónde empieza cada flujo, camino normal y escalas del puntaje.

## Bloqueado o dudoso
- **Frecuencias** estimadas con el uso típico de un taller (ventas e impresiones a diario, pedidos y rollos varias veces por semana, compras de insumos y gastos de vez en cuando); no hay registro de uso real para medirlas. Si la persona usa algo mucho más o mucho menos, el orden cambia.
- **D1 cambia un control nativo por uno propio**: es el de más trabajo y el único con riesgo de accesibilidad; por eso lleva su prueba de teclado (abrir, flechas, Enter, Esc, foco visible).
- Medido solo en 1440 (`§11.1`); en móvil los selectores nativos abren la lista del sistema y los números pueden diferir.

## Qué conviene que revise la persona
- Si las frecuencias de la tabla se parecen a su uso real (sobre todo abonos, ajustes y rollos).
- Los “no hacer” por decisión de diseño: botón “Cotizar” en cada ficha (#15), categoría de gasto propuesta (#32), Enter para guardar en el armador.

## Cómo probarlo
```
pnpm exec playwright test e2e/clicks      # 35 mediciones; budget.ts tiene los números de hoy
pnpm exec playwright test e2e/clicks/products.spec.ts -g "agregar filamento"
pnpm lint && pnpm typecheck
```
