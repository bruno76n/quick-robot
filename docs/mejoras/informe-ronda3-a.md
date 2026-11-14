# Informe de la ronda 3 · Fase A (inventario)

## Resumen
Se compararon las 16 pantallas y el marco con `reference/ronda-3/` (capturas de Playwright de la app con la semilla y de cada maqueta a 1440, 820 y 390; no se suben al repositorio) y se revisó el código de estilos, componentes, API y textos. **No se cambió código.** Lo más importante: (1) el estilo vive en un `mockup.css` de 1 113 líneas con tres capas de reglas que se pisan (original, "suave", "interfaz neutra"), con ~30 radios y ~40 sombras escritos a mano; hay que partirlo por pantalla en la fase B para que cuatro agentes trabajen en paralelo sin chocar; (2) de §7 casi todo existe en la API, salvo la **fecha de "Aceptado"** (no se guarda), por lo que el Historial del pedido no se muestra; (3) varios tokens de la maqueta **no pasan contraste AA** como texto (`--ink-3`, verde sobre verde claro), y hoy no hay prueba de axe en el repositorio.

## Pasos
| Paso | Estado | Commit | Notas |
|---|---|---|---|
| Leer `CLAUDE.md`, `ronda-3.md`, `reference/ronda-3/README.md`, excepciones de la persona, informe modelo | hecho | — | |
| Inventario de estilos y componentes | hecho | — | §1 |
| Capturas app vs. maqueta (16 pantallas, 1440/820/390) | hecho | — | `pnpm dev` con semilla; servidor detenido por PID |
| Revisión de §7 contra `docs/12` y `packages/server` | hecho | — | §3 |
| Vocabulario §5 | hecho | — | §4 |
| Informe y decisiones | hecho | este | `docs/decisiones.md` |

---

## 1. Inventario de estilos

### 1.1 Archivos
| Archivo | Líneas | Qué tiene | Problema para la ronda 3 |
|---|---|---|---|
| `styles/index.css` | 6 | Tailwind (theme + utilities), Geist, `tokens.css`, `mockup.css`, `app.css` | — |
| `styles/tokens.css` | 30 | Único `:root` (lo vigila `tokens.test.ts`) | Nombres viejos (`--panel`, `--green-ink`, capas `--c-*`); `--r: 14px` |
| `styles/mockup.css` | 1 113 | Todo: reset, marco, botones, campos, `.seg`, `.tag`, `.chip`, `.pill`, `.tbl`, `.strip`, `.brf`, y **todas las pantallas** | Tres capas que se pisan (`.seg` en l. 85 y 610; `.strip` en 162 y 909; `.pill` en 622 y 944). Un solo archivo para 16 pantallas: no se puede repartir |
| `styles/app.css` | 54 | Añadidos del producto (banner, esqueleto, `Picker` `.pkr-*`, `.chip-btn`, `.seg4`) | — |
| `features/home/home.css`, `products/products.css`, `stock/stock.css` | 32 / 102 / 114 | Lo de la ronda 2 | Ya tienen dueño por pantalla |
| `fatal/fatal.css` | 25 | Página de error fatal | Un `rgba` permitido |

**Literales hoy:** 0 hex fuera de `tokens.css` en CSS (lo prueba `tokens.test`); 39 `rgba()` de tinta neutra en `mockup.css`; **6 hex en `.tsx`**, todos de respaldo de color de dato (`'#c9c9d1'`, `'#ccc'`, `'#9a9aa6'`, `'#8b8b97'` en `PurchasesPage:80`, `Material:24`, `PrintRunDialog:149`, `Piece3d:6`, `ProductEditor:155`, `ReportsPage:184`) → pasan a `var(--no-color)`. **Radios:** 15 valores distintos (99px ×25, 10 ×12, 20 ×11, 8, 6, 12, 4, 3, 2, 16, 9, 14, `var(--r)` ×6). **Sombras:** 35 en `mockup.css` (paneles con `--sh-up` y anillos `0 0 0 1px`); la maqueta: paneles **sin sombra**.

### 1.2 Cómo usan las pantallas las clases
- `PageHead` (`.ph`, `h1`, `.sub`, `.ph-a`) en 15 pantallas; `Button` en 32 archivos y `className="btn…"` a mano en 14; `Table` en 5 y `<table className="tbl">` a mano en 11; `Pill` (clase `.chip`) en 16 y `.pill` a mano en 9; franja `.strip` en 2; resumen en frase `.brf` en 9 (Inicio, Ventas, Pedidos, Impresoras, Producción, Clientes, Gastos, Reportes…); `Drawer` en 3.
- **`Segmented.tsx` no lo usa nadie**: los interruptores son `<div className="seg">`/`"seg2"` escritos a mano en Productos (Piezas | Colecciones, Fichas | Lista), Existencias (Fichas | Lista), Pedidos (Tablero | Lista | Calendario), Pedido (pestañas `.seg tabs`), Ventas (canales), Gastos y Reportes (periodo), y `.seg wide` en diálogos (Por valor | Por fórmula, motivo de impresión, `.seg4` de Ajustar). **Todos quedan como están** (excepción 1).
- Filtros tipo chip (toman el diseño nuevo `.ui-chip`): `.tag` en Productos, Pedidos (lista), Producción, etiquetas del editor y de colecciones; `.atn-chip` en Inicio; `.sk-f` en Existencias.
- Cruces entre pantallas: `home → products/Piece3d, reports/Brief`; `stock → products/Piece3d`; `expenses → reports/Brief, reports/ReportsPage (PERIODS)`; `printers → orders/parts`; `builder, customers → sales/rich`.
- Desplazamiento: la app desplaza `.main` (contenedor con `overflow-y: auto`); la maqueta desplaza el documento con la barra lateral `sticky`. Por eso `fullPage` de Playwright corta la app a 900 px.

### 1.3 Tokens actuales → ronda 3
| Hoy | Valor | Ronda 3 | Acción |
|---|---|---|---|
| `--ink`, `--ink-2` | `#121214`, `#6a6a73` | igual | se quedan |
| `--ink-3` | `#777782` | `#9b9ba5` | **D-3**: `--ink-3` toma `#9b9ba5` solo para no-texto (puntos pendientes, deshabilitado); el texto gris claro usa `--ink-3t: #777782` |
| `--bg` | `#fff` | blanco de panel | se queda |
| `--panel` | `#f6f6f8` | `--soft` / `--u-app` | **renombrar** a `--soft` (63 usos) |
| `--panel-2` | `#ececf1` | `#e9e9ef` (`.ui-count.lt`, `.ui-pill.info`), `#ececf0` (columna del tablero) | **renombrar** `--soft-2: #e9e9ef`; nuevo `--col: #ececf0` |
| `--line` / `--line-2` | `#e7e7ec` / `#d2d2da` | `--u-line #e9e9ee` / `--u-line-2 #f0f0f3` | `--line` → `#e9e9ee` (bordes de panel y tabla); nuevo `--line-soft: #f0f0f3` (filas); `--line-2` queda para borde de campo (ver R5) |
| — | — | `--u-track #ebebf0`, `--u-soft #dedee5` | **agregar** `--track`, `--soft-3` |
| `--cost` | `#5a5a65` | `--u-bar`/`--cost` `#4a4a53` | cambia valor (y la expectativa de `tokens.test`) |
| `--cost-soft`, `--sh`, `--c-e`, `--c-f`, `--c-legend`, `--sand` | | — | **quitar** (0 usos) |
| `--c-m`, `--c-l`, `--c-q`, `--c-t` | grises de capas | una gráfica = un color | **quitar** al rehacer gráficas (fase C, Reportes y Pieza) |
| `--accent`, `--btn`, `--btn-ink`, `--accent-ink` | tinta | `--ink` | se quedan como alias (foco, `tokens.test`) |
| `--green`, `--green-soft` | `#00ae42`, `#e3f5e9` | `--green`, `--green-l` | renombrar `-soft` → `-l` |
| `--green-ink` | `#067a30` | `--green-d #00873a` | **D-4**: agregar `--green-d`; `--green-ink` se queda para texto sobre `--green-l` (4.83:1; `#00873a` da 4.09) |
| `--amber`, `--amber-ink`, `--amber-soft` | `#e9a817`, `#86500a`, `#fff1d3` | `#b4740a`, `--amber-d #8a5a06`, `--amber-l #fdf3e1` | cambian valor y nombre |
| `--red`, `--red-ink`, `--red-soft` | `#d6334f`, `#b3223f`, `#fde8ec` | `#c8302a`, —, `--red-l #fbeaea` | `--red-ink` → `--red` (5.37:1 sobre blanco) |
| `--blue` | `#3f86c9` (2 usos: comisiones) | — | quitar; comisión en gris |
| `--tg-*`, `--no-color`, `--doc-ink`, `--on-dark`, `--on-green` | | — | se quedan (cronograma, datos, documentos) |
| `--sh-soft`, `--sh-up` | | solo flotantes | `--sh-up` para globo, cajón y diálogo; paneles sin sombra |
| `--r: 14px` | | botón 7, campo 8, panel 12, estado 6, bloque interno 9–10 | `--r-btn`, `--r-field`, `--r-panel`, `--r-pill`, `--r-in` |
| — | literales de la maqueta `#3a3a42` (ítem del menú), `#4a4a52` (texto de estado gris), `#fbfbfc` | | → `--ink-2`/`--cost`; `#fbfbfc` no se usa (ventana de la web) |

---

## 2. Pantalla por pantalla (§6)
Excepciones aplicadas en todas: segmentados actuales intactos (E1), filamento en cajón (E2), mascota (E3). "Se queda" = la app tiene algo que la maqueta no dibuja y es comportamiento (`06`): se conserva con el estilo nuevo.

| # | Pantalla | Diferencias concretas (maqueta → qué cambia) |
|---|---|---|
| 1 | Marco | Barra lateral blanca 232 px (hoy gris 248) con borde `--line`; ítems 32 px, radio 7, actual con fondo `--soft` y 600; grupos 11.5 px; buscador 34 px con ⌘K; **contadores grises** (Pedidos, Compras) que hoy no hay (D-6). Se queda: botón "Nueva pieza" (pasa a negro, no verde), nota del pie. Corte a cajón en **≤1099** (hoy ≤899); barra fija de celular con menú, **título de la pantalla** y «+» (hoy mascota + nombre + "Nueva pieza" verde). Encabezado: ruta, título 26/24/22, dato corto, acciones a la derecha (principal negra, 30 px). E3: mascota y nombre en la barra lateral (no «EZ») |
| 2 | Inicio | Hoy: frase de resumen + "de cada $100" + Atención agrupada con chips + Piezas con más ganancia + Impresoras. Maqueta: panel con **Ventas 30 días** (cifra 40 px, Δ% y nº de ventas) + franja Ganancia bruta (Δ%) · Gastos · Ganancia neta · Por cobrar + **Ventas por semana** (columnas); **Alertas** (lista `.al-list`, ícono en cuadro de color, contador); **En impresión** (por impresora: %, barra, tiempo restante); **Próximas entregas** (fecha, cliente, pedido, estado). Salen la frase, "de cada $100" y Piezas con más ganancia (§6 manda; siguen en Reportes). Se quedan los chips Todas · Urgente · Esta semana · Para revisar y los grupos (comportamiento de la ronda 2), con el estilo de la lista nueva (D-7). Datos: `/reports?period=30` (`totals`, `previous`, `buckets`, `expensesCents`, `netProfitCents`), `/home` (`stats.owedCents`, `printingNow`, `upcoming`). E3: mascota en el título |
| 3 | Productos | Fichas: foto alta con fondo `#f0f0f3`/cubo, nombre 14 px, línea "material · tiempo" (hoy impresora; **sin gramos**: la lista no los trae), cifras Precio · Costo · Ganancia (verde) en 3 columnas con separador, pie con estado (`Disponibles: 6`, `Sin existencias`, `Apartado`) y botón "2 variantes". Salen de la ficha: precio grande 26 px, barra de margen, "×13.6", "vendidas" (D-8: quedan en la vista Lista). E1: Piezas \| Colecciones y Fichas \| Lista siguen como hoy; los chips Todas · Técnicas · Con variantes toman `.ui-chip`. En 390: ficha horizontal (foto 110 px a la izquierda) |
| 4 | Pieza | Encabezado con ruta y acciones arriba (Cotizar, Registrar venta, **Guardar cambios**); hoy están en la columna derecha. Izquierda: paneles Datos, Impresión, Filamentos, Insumos, Extras y existencias. Derecha fija (`sticky`): cabecera con miniatura y "material · g · tiempo · impresora", **Desglose del costo** con barra gris y % por concepto (hoy cuadritos de colores), precio en bloque `--soft` con E1 (Por valor \| Por fórmula se queda), Ganancia/Margen/Veces el costo, "Arriba del precio mínimo", Costo, y **Ganancia por canal** (tabla; ya viene en `productDetail.profitByChannel`). Se quedan: Atajos de precio, Guardar como variante nueva, Eliminar pieza (al pie del panel derecho) |
| 5 | Ventas | Franja Ventas · Ganancia bruta (Δ%) · Comisiones · Saldo por cobrar (hoy frase + "de cada $100" + aviso de saldo). Tabla de 5 columnas Fecha · Artículos (cliente) · **Canal** · Total (con estado Saldo/Devuelta) · Ganancia; hoy 4 (canal dentro de Artículos). E1: el filtro de canales sigue como segmentado actual. Periodo: se queda en 60 días (`06 §4`); la maqueta dice 30 |
| 6 | Pedidos | Franja de 5: En curso · Total · Por cobrar · Entregas en 7 días · Ganancia estimada (hoy frase + barra "Cobrado"). Tablero: columnas fondo `--col` radio 12, cabecera "Pendientes 3" (hoy "3 · $5,610" y subtítulo), tarjeta blanca radio 10: cliente, "Pedido #4", estado, artículos, sublínea "Existencias: 3 · Por imprimir: 1" (hoy etiquetas numeradas), barra por impresora, fecha de entrega (ámbar si cerca), Total · Saldo · Ganancia, botón del siguiente paso. Alerta "Filamento insuficiente": **fuera** (§3). E1: Tablero \| Lista \| Calendario se queda |
| 7 | Pedido | Encabezado "Pedido #3" + cliente, acciones Editar · Registrar pago · siguiente paso. **Pasos** `.ui-steps` con punto y fecha (hoy barras de color sin fecha). 4 cifras Total · Pagado · Saldo · Fecha de entrega. Artículos con origen, impresora, avance y "Fin estimado". Derecha: Cliente (pedidos, saldo), Costo y ganancia (hoy plegable), Documentos, ~~Historial~~ (§3). E1: las pestañas Piezas · Cobro · Producción · Datos **se quedan** (D-9) |
| 8 | Filamentos | Franja Disponible · Valor del inventario · Stock bajo · Crítico (hoy en la línea de subtítulo). Tabla Filamento (punto, rollos · marca) · Costo/g · Disponible (barra 6 px + gramos) · Estado. E2: el detalle sigue en el cajón; su contenido toma `.roll` (rollos en bloque `--soft` con barra) y `.mv` (movimientos con fecha y gramos ±) |
| 9 | Insumos | Hoy fichas; maqueta **tabla** Insumo (proveedor) · Existencia · Mínimo · Costo · Estado, y **chips por estado** con contador (Todos · Normal · Stock bajo · Agotado; filtro en el navegador sobre `status`). El botón de página "Registrar compra" queda fuera (existe por insumo en su cajón) |
| 10 | Impresoras | Hoy frase + 2 columnas; maqueta tarjetas en cuadrícula `minmax(300px)`: cabecera con ícono, horas y estado; **Imprimiendo ahora** en bloque `--soft` con %, barra y "Terminar trabajo"; En cola; Mantenimiento por tarea con barra corta y estado (Al día/Próximo/Vencido); Inversión recuperada (cifra 22 px + barra verde). Se quedan: "Hecho", editar tarea, Agregar tarea, costo por hora y vida útil |
| 11 | Producción | Arriba en dos: panel En impresión + franja Impresiones · Correctas (%) · Fallidas (%) · Filamento (hoy lista "Imprimiéndose ahora" y frase con barra). Chips Todo · Existencias · Pedidos · Pruebas. Tabla Fecha · Pieza (destino debajo) · Impresora · Filamento (punto + g) · Horas · Resultado |
| 12 | Existencias | Chips de estado con contador; tabla Producto · Existencia · Apartadas · Disponibles · Estado, variantes debajo de su pieza en filas con sangría, **Sets** armables al pie del mismo panel. Se quedan: foto, Vender, ›, Precio de lista, orden por Disponibles, búsqueda; E1: Fichas \| Lista se queda (la maqueta no lo dibuja) |
| 13 | Compras | Dos columnas: Compras sugeridas por proveedor (bloque gris por proveedor con "Copiar…", líneas con cantidad y costo) · Proveedores (tabla con Editar) y Últimas compras. Hoy: frase arriba, proveedores y últimas compras abajo. Se quedan "Registrar compra" por línea y el texto "Copiar lista" (no está en §5) |
| 14 | Clientes | Franja Clientes · Con pedidos en curso · Compras · Saldo por cobrar; tabla Cliente (avatar gris) · Contacto · **Pedidos** · Compras · **Saldo** (rojo) · **Última actividad** (la lista ya trae `orders`, `activeOrders`, `lastActivity`) |
| 15 | Gastos | Franja Gastos del periodo · Fijos al mes · ~~Variables~~ (§3); tabla Fecha · Concepto (categoría) · Tipo (Fijo mensual / Variable) · Monto; panel **Por categoría** a la derecha con barras de un color. E1: el periodo sigue como hoy. Se queda Punto de equilibrio (debajo de Por categoría) |
| 16 | Reportes | 5 cifras: Ventas (Δ%) · Ganancia bruta (Δ%) · Gastos · Ganancia neta · Margen neto (D-10). Ventas por semana: gris claro con ganancia bruta verde dentro (hoy columnas apiladas costo/comisión/ganancia con eje y rejilla). De cada $100: barra de dos partes + lista ordenada. Productos con más ganancia (barras verdes). Por canal: tabla Ventas · Importe · Comisión · Ganancia con Total. Se quedan "Ver como tabla" (clase `.tcol`) y las secciones de abajo (colecciones, clientes, inversión, filamento) con el estilo nuevo |
| 17 | Ajustes | Índice a la izquierda (Costos del taller, Canales de venta, Documentos, Copias de seguridad, Exportar), `sticky`; en tableta pasa a fila desplazable. Canales en tabla (Canal · Comisión · Quitar). Copias con su lista (ya existe: `GET /backups`). "Guardar cambios" al pie. Las etiquetas de campos se quedan (solo §5) |

---

## 3. Revisión de §7 (contra `docs/12` y `packages/server`)
| Elemento | ¿Existe? | Evidencia | Qué se hace |
|---|---|---|---|
| Fecha bajo cada paso del pedido | **Parcial** | `order` guarda `created_on` (Cotizado), `production_on`, `ready_on`, `delivered_on` y `cancellation.on`; `GET /orders/:id` los manda (`usecases/sell/orders.ts:95`). **No hay `accepted_on`**; `production_on` queda nulo si el pedido pasa de Aceptado a Listo desde existencias | D-1: fecha bajo los pasos que la tienen; Aceptado sin fecha |
| Historial del pedido | **No completo** | Pagos sí tienen fecha (`payment.on`), pero falta la de Aceptado y los detalles que dibuja la maqueta (impresoras, existencias apartadas, cotización enviada) | **No se muestra** (regla de §7) |
| Gastos por categoría | Sí | `GET /expenses` devuelve `byCategory` (`reports.ts:36`); hoy ya hay un panel "Por categoría" | Se rehace como ranking |
| Entregas en 7 días · Ganancia estimada | Sí | La franja actual las calcula con `profitCents` y `dueOn` de `GET /orders?view=board` | Pasan a la franja |
| Valor del inventario | Sí | `valueCents` por filamento (`12`, `GET /filaments`); `FilamentList.tsx:30` lo suma | Pasa a la franja |
| Miniatura de producto | Sí | `photoUrl` (ficha técnica) y `hexes` (color del filamento) en la lista | Foto o **cubo** con el color (hoy `Piece3d` dibuja 3 formas según el id; se cambia por el cubo de la maqueta) |

**Otras cosas que la maqueta muestra y el sistema no tiene (quedan fuera):**
1. Alerta "Filamento insuficiente" en la tarjeta del tablero (la lista de pedidos no trae faltantes; solo el detalle, `material.shortfall`).
2. Cifra "Variables" en Gastos (la API da `periodTotalCents` y `fixedPerMonthCents`, no el total variable del periodo).
3. Gramos en la ficha de Productos ("45 g"): la lista no trae gramos.
4. "Registrar compra" a nivel de página en Insumos (existe por insumo).
5. Monograma «EZ» (E3).
6. Columna fija del filamento (E2).

Para la web de venta (§9): los puntos 1–6, los pasos sin fecha de Aceptado y el Historial difieren de las ilustraciones.

---

## 4. Vocabulario §5 (qué cambia)
| Llave en `es.ts` (o archivo) | Hoy | Ahora |
|---|---|---|
| `screens.home.attention.title` | Atención | Alertas |
| `status.stock` | Agotada · Todo apartado · Pocas · Disponible | Agotado · Apartado · Stock bajo · Disponible |
| `screens.stock.filter` | Pocas · Todo apartado · Agotadas | Stock bajo · Apartado · Agotado |
| `screens.stock.summary`, `.col.free`, `.card.free/.bar/.variantsFree`, `.sortFewFirst/.sortMostFirst`, drawer `free`, `counts`, `onlyFree`; `screens.products.variants.free`; `screens.builder.free/noFree/sxFree`; `screens.reports.inventoryLine`; `screens.csv.head.pieces[5]`; `screens.order.cancelFrees`, `freedToast`; `messages.ts` `INSUFFICIENT_STOCK.item`, `PRINT_RUN_LOCKED.pieces_unavailable` | libre(s) | disponible(s) |
| `screens.builder.soldOut` | Agotada | Agotado |
| `status.filament` `low` · `ending` | Poco · Se acaba | Stock bajo · Crítico |
| `status.supply` `low` · `ok` | Poco · Suficiente | Stock bajo · Normal |
| `status.maintenance` | Al corriente · Pronto · Toca ya | Al día · Próximo · Vencido |
| `screens.printers.idle`, `.free`; `screens.home.bayFree` | Libre | Disponible |
| `screens.sales.owes`, `screens.customers.colOwes`, `.phraseOwes`, `.hOwes` | Debe… | Saldo… (`phraseClear` "No debe nada." → "Sin saldo.") |
| `screens.orders.colDue`, `.due`; `screens.order.dueK`, `.due`; `screens.builder.dueOn`; `screens.documents.due` | Entrega | Fecha de entrega |
| `screens.production.ok` · `.fail` | Salió bien · Falló | Correcta · Fallida |
| `screens.calculator.floor`, `.belowFloor`; `screens.builder.refFloor`, `.belowFloor` | Piso / piso de margen | Precio mínimo |
| `screens.home.top`, `screens.reports.summary.top` | Piezas con más ganancia | Productos con más ganancia |

No cambian: `priceMode.value` "Precio libre", `Mercado Libre`, "libremente", `printerFree` "· libre" (impresora: pasa a "· disponible" por coherencia con Impresoras). D-5 para `settings.minMargin` "Piso de margen". Documentos: `docs/13 §1` (vocabulario fijo: Libres → Disponibles), `docs/13` l. 336–345 (estados y colores), `CLAUDE.md` (vocabulario), `docs/06` l. 11, 42, 232 (citas de textos).
**Pruebas que afirman texto:** `e2e/home-attention.spec.ts` (grupo "Atención"; la prueba de orden Atención/Piezas/Impresoras de l. 95–97 se **reescribe** por §6, no se debilita), `stock-families.spec.ts` (Pocas, Todo apartado, Agotadas, "Libres:", "libres por variante"), `customers.spec.ts` ("Debe $500" ×2, "Debe $300"), `ronda2-shortcuts.spec.ts` y `clicks/sales.spec.ts` (`/^Debe .*: registrar abono$/`, "N libres"), `flow-d-cancel-order.spec.ts` ("pasan a libres"), `production-stock.spec.ts` ("tantas libres"), `lib/errors.test.ts` ("hay 1 libres"). `i18n.test.ts` vigila que no falte ninguna llave.

---

## 5. Riesgos y decisiones
**Riesgos**
- **R1 · Un solo `mockup.css`.** Cuatro agentes editándolo chocan. Se parte en la fase B (B3) sin cambio visual, verificado con capturas idénticas.
- **R2 · Contraste.** `--ink-3 #9b9ba5` da 2.75:1 sobre blanco; `--green-d` sobre `--green-l` 4.09:1; `--amber #b4740a` 3.86:1 como texto; `--green` como texto 2.94:1. §8 pide axe sin errores serios → D-3, D-4 y "texto de estado siempre con el tono `-d`/`-ink`".
- **R3 · No hay axe en el repositorio.** Agregar `@axe-core/playwright` (dependencia nueva → `decisiones.md`) en la fase D; si la red no deja instalarla, se anota como bloqueo.
- **R4 · Corte de barra lateral a 1099.** Cambia lo que ven las pruebas a 820 (hoy barra fija); `smoke-all`, `desktop.spec` y las mediciones de clics a 820 deben abrir el menú.
- **R5 · Bordes de campo `#e9e9ee`.** Por debajo de 3:1 (WCAG 1.4.11). Se sigue la maqueta y se marca para revisión.
- **R6 · Clases que usan las pruebas.** `.chip` (flujos B–D, failure-states), `.ph`, `.frow`, `.pkr-*`, `.unit`, `.res-act`, `.res-top`, `.toast`, `.tcol`, `.atn-gh`, `.kc-h`, `.fb-t`, `.cli-s`, `.mt-l`, `.cparte`, `.irow`, `.pt-n`, `.auto-l`, `.dlg-t`, `.brand`, `.mascot`. Regla: **se cambia el estilo, no el nombre de la clase**; si un nombre cambia, se actualiza el selector en el mismo commit.
- **R7 · Inicio pierde secciones** (frase, de cada $100, Piezas con más ganancia) por §6; `home-reports-expenses.spec` y `home-attention.spec` cambian sus expectativas por documento.
- **R8 · Contadores del menú** (D-6) agregan dos consultas a todas las pantallas; vigilar `docs/15 §2` y `pnpm size`.
- **R9 · Desplazamiento.** La app desplaza `.main`, no el documento: las capturas de comparación deben quitar el límite de alto (`.app{height:auto}.main{overflow:visible}` inyectado solo en la captura).

**Decisiones** (anotadas en `docs/decisiones.md`)
- **E1–E3** (de la persona): segmentados actuales intactos, filamento en cajón, mascota.
- **D-1** Pasos del pedido: fecha debajo de Cotizado, En producción, Listo, Entregado y Cancelado cuando está guardada; Aceptado sin fecha. Historial no se muestra. *Para revisión.*
- **D-2** Se cambia el estilo, no los nombres de clase (R6); clases nuevas solo para estructuras nuevas (`kps`, `panel`, `meter`, `steps`, `al-list`, `cc`).
- **D-3** `--ink-3: #9b9ba5` solo para no-texto; texto gris claro con `--ink-3t: #777782`. *Para revisión.*
- **D-4** `--green-ink #067a30` se queda para texto sobre `--green-l`; `--green-d #00873a` para cifras sobre blanco.
- **D-5** "Piso de margen" en Ajustes → "Margen mínimo" (es el mismo "piso" de §5 y así lo dibuja `ajustes.html`). *Para revisión.*
- **D-6** Contadores del menú: Pedidos = pedidos en curso (consulta del tablero, la misma llave de Pedidos), Compras = artículos sugeridos (`GET /purchases`). *Para revisión* por R8.
- **D-7** Inicio sigue §6; los chips y grupos de alertas de la ronda 2 se quedan (comportamiento), con el estilo de `.al-list`.
- **D-8** Precio grande, barra de margen, "×" y vendidas salen de la ficha de Productos (la maqueta) y siguen en la vista Lista.
- **D-9** Pedido: pestañas (E1) en la columna principal; Cliente, Costo y ganancia y Documentos a la derecha; Pagos dentro de "Cobro".
- **D-10** Reportes "Margen neto" = ganancia neta ÷ ventas, el mismo cociente que ya muestra "de cada $100" (Ganancia real por cada $100); no es regla nueva.
- **D-11** Lo que la app tiene y la maqueta no dibuja se conserva con el estilo nuevo (Hecho en mantenimiento, Atajos, Ver como tabla, Punto de equilibrio, secciones extra de Reportes, Vender en Existencias).

---

## 6. Plan de la fase B (rama `ronda3-b-tokens`, en serie)
| Paso | Commit | Qué | Prueba que lo demuestra |
|---|---|---|---|
| B1 | `feat(web): ronda-3 design tokens` | `tokens.css` con la tabla §1.3 (renombres, nuevos, quitados, radios `--r-*`); reemplazo mecánico de `var(--…)` en CSS y TSX | `tokens.test`: valores nuevos (`--ink-3`, `--cost #4a4a53`, `--red #c8302a`…), **toda `var(--x)` usada está declarada**, ningún token quitado se usa, sin morado |
| B2 | `refactor(web): radii, shadows and data fallbacks from tokens` | Radios → `var(--r-*)` (o `50%`/`0`); sombras de paneles fuera (`--sh-up` solo en flotantes); 6 hex de `.tsx` → `var(--no-color)` | `tokens.test`: sin hex en `.tsx`; `border-radius` solo con token, `50%`, `0` o `99px`; `box-shadow` solo `none`, `var(--sh-up)` o anillo de foco |
| B3 | `refactor(web): split mockup.css by screen` | `styles/base.css` (reset, marco, botones, campos, `.seg*`, chips, estados, tablas, cajón, diálogo, aviso, documento) + `features/<f>/<f>.css` importado por su página. Sin cambio visual | Capturas de las 16 pantallas a 1440 y 390 **idénticas** antes/después (script de comparación píxel a píxel); `tokens.test`; `pnpm e2e` |
| B4 | `feat(web): base components in ronda-3 style` | Botón 30/7 (principal negro, "green" deja de ser verde en botones), campo 34/8, `Pill` (`.chip`, 22/6, punto, tonos ok/warn/bad/info), tabla (`.tbl`: cabecera 11.5 gris, filas `--line-soft`, `.r`, `hide-sm`), chips de filtro (`.tag`, `.atn-chip`, `.sk-f` → aspecto `.ui-chip`), cajón y diálogo sin sombra de panel. **`.seg`/`.seg2`/`.seg wide`/`.seg tabs` sin tocar** | `components.test` (Pill: texto + tono; Button: tamaños; Table: `hide-sm`); `tokens.test` nueva: las reglas `.seg`/`.seg2` son byte a byte las de hoy; `smoke-all` |
| B5 | `feat(web): shared panels, figures and charts` | En `components/`: `Panel` (+ cabecera con acción), `Kpis` (3–5, 2×2 en celular), `Meter` (6 px, tono), `WeekColumns` (ventas gris + ganancia verde, monto arriba, clase `.tcol` en cada columna), `Per100Bar` + lista, `HBarList`, `Steps` (fecha opcional), `AlertRow`, `PieceThumb` (foto o cubo; reemplaza `products/Piece3d`, que usan home y stock) | `components.test`: Kpis n3/n4; Meter limita 0–100; WeekColumns alturas proporcionales y `.tcol` por columna; Per100Bar suma 100; HBarList ordena de mayor a menor; Steps marca hecho/actual y pinta fecha solo si viene; PieceThumb usa foto o `hexes[0]` |
| B6 | `feat(web): ronda-3 vocabulary` | §4 completo en `es.ts` y `messages.ts`; `docs/13`, `docs/06`, `CLAUDE.md` | `i18n.test`, `t.test`, `errors.test`; e2e `stock-families`, `customers`, `ronda2-shortcuts`, `flow-d`, `production-stock`, `clicks/sales` |

**Archivos compartidos:** `tokens.css`, `base.css`, `components/*`, `es.ts`, `messages.ts`, `docs/13` **solo se tocan en B** (y en C1). En C, un agente puede **agregar** llaves dentro de su bloque `screens.<su pantalla>` de `es.ts` (releer antes, una edición chica), nunca renombrar ni tocar otro bloque; si necesita un cambio en un componente compartido, lo anota y lo hace la coordinación al integrar.

## 7. Plan de la fase C (rama `ronda3-c-pantallas`)
**C1 en serie, antes de repartir** (lo hace la coordinación): `feat(web): app frame in ronda-3 style` — `AppShell.tsx` (barra lateral, contadores D-6, corte 1099, barra de celular con título y «+», Esc/fuera cierra y devuelve el foco), `PageHead` (ruta, título 26/24/22, dato, acciones), `.app/.side/.main/.topbar` en `base.css`. Pruebas: `components.test` (menú abre, Esc cierra, foco vuelve), `no-purple.spec` (`.brand .mascot`), `smoke-all`, `desktop.spec`, `failure-states`.

Luego **cuatro agentes en paralelo**, archivos disjuntos. Cada paso: un commit, capturas 1440/820/390 contra su maqueta, e2e de su grupo.

| Grupo | Dueño de | Pasos (orden de §6) · commit | e2e que seleccionan sus clases o textos |
|---|---|---|---|
| **G1 · Vender** | `features/home/*`, `sales/*`, `expenses/*`, `reports/*` | C2 `feat(web): Inicio in ronda-3 style` · C5 `feat(web): Ventas in ronda-3 style` · C15 `feat(web): Gastos in ronda-3 style` · C16 `feat(web): Reportes in ronda-3 style` | `home-attention` (`.atn-gh`, `.spool(s)` ausentes), `home-reports-expenses` (`.tcol`, "Ver como tabla", "Ventas por semana"), `flow-a` (`.res-act`), `flow-e`, `ronda2-shortcuts`, `clicks/sales` |
| **G2 · Catálogo** | `features/products/*`, `stock/*`, `builder/*` (solo si su estilo lo pide) | C3 `feat(web): Productos in ronda-3 style` · C4 `feat(web): piece editor in ronda-3 style` · C12 `feat(web): Existencias in ronda-3 style` | `products-variants` (`.pt-n`, `.frow`, `.pkr-b`), `workshop` (`.big`, `.cparte`, `.res-top`, `.unit`, `.mt-l`*), `clicks/products` (`.irow`, `.cparte`), `ronda2-flows`, `stock-families`, `production-stock` (`.frow`) |
| **G3 · Pedidos y taller** | `features/orders/*`, `production/*`, `printers/*` | C6 `feat(web): Pedidos in ronda-3 style` · C7 `feat(web): order page in ronda-3 style` · C10 `feat(web): Impresoras in ronda-3 style` · C11 `feat(web): Producción in ronda-3 style` | `flow-b`, `flow-c`, `flow-d` (`.chip`, `.ph`), `clicks/orders` (`.kc-h`), `clicks/workshop` (`.fb-t`), `production-stock` |
| **G4 · Insumos y negocio** | `features/filament/*`, `supplies/*`, `purchases/*`, `customers/*`, `settings/*` | C8 `feat(web): Filamentos in ronda-3 style` (cajón E2) · C9 `feat(web): Insumos in ronda-3 style` · C13 `feat(web): Compras in ronda-3 style` · C14 `feat(web): Clientes in ronda-3 style` · C17 `feat(web): Ajustes in ronda-3 style` | `filaments`, `flow-f-purchases`, `customers` (`.cli-s`), `settings`, `backup` (`.auto-l`, `.dlg-t`, `.pill`), `clicks/admin`, `workshop` (`.mt-l` de `SpoolDialog`) |

\* `.mt-l` vive en `filament/SpoolDialog.tsx` (G4) pero la usa `workshop.spec` (G2): G4 no renombra esa clase.

**Cruces a vigilar:** `sales/rich` lo usan builder y customers (dueño G1; nadie más lo edita); `orders/parts` lo usa printers (mismo grupo); `reports/Brief` y `PERIODS` los usa expenses (mismo grupo); `Piece3d` sale de products en B5. Archivos que nadie de C toca: `tokens.css`, `base.css`, `components/*`, `app/*`, `messages.ts`, `docs/13`. Al final de C, la coordinación corre `pnpm test`, `pnpm e2e` completo, `pnpm lint`, `pnpm typecheck`, `pnpm security`, `pnpm size`.

**Fase D:** axe (R3) en las 16 pantallas, contraste (R2, R5), menú en 820/390 (§8), comparación final en tres anchos y la lista de §3 para la persona.

## Qué conviene que revise la persona
- D-1 (pasos sin fecha de Aceptado, sin Historial), D-5 (Margen mínimo), D-6 (contadores), D-3/D-4 (grises y verdes más oscuros que la maqueta por contraste).
- Las 6 cosas de §3 que quedan fuera, por si se quieren en otra ronda (la más útil: fecha de aceptación y alerta de filamento en el tablero).
