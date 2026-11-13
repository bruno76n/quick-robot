# Informe de la ronda 2 · fase D (acortar los clics)

## Resumen
Se hicieron **las 16 mejoras “hacer”** de `informe-ronda2-c.md` (D1–D9 y T1), en su orden y con D1 primero. Lo más visible: las filas nuevas de filamento, insumo y pieza de colección **nacen con su lista abierta y el foco dentro** (un selector propio y accesible, con búsqueda y los filamentos de la pieza arriba); los diálogos enfocan el campo útil; “Vender”, “Debe $X”, “Registrar pago” y “Registrar compra” llevan directo a la acción. En la suma de los 35 flujos medidos: **131 → 117 clics** y **25 → 16 campos por tocar**, justo lo que C calculó (−14 y −9). No se quitó ninguna confirmación de dinero o existencias ni cambió ninguna regla. Rama `ronda2-d-mejoras`; todos los comandos de `ronda-2 §1.3.1` en verde en la punta.

## Pasos
| Mejora | Estado | Commit | Qué cambió | Presupuesto |
|---|---|---|---|---|
| D1 · P1 en filas nuevas (obligatoria) | hecha | `80273da` (+ `1d22356` ajuste visual) | `components/Picker.tsx`: botón + lista `role=listbox` con campo de búsqueda; Enter/Espacio/↓ abren, escribir una letra abre buscando, ↑ ↓ Inicio Fin, Enter o clic eligen, Esc cierra y devuelve el foco, Tab cierra. En filamentos (`.frow`), insumos (`.irow`) y piezas de colección (`.cparte`); “Agregar …” crea la fila con la lista abierta; al elegir, el foco pasa a gramos o cantidad; los filamentos ya usados en la pieza (o en su original) van primero (“En esta pieza” / “Los demás”). “Agregar rollo de otro filamento” se queda | `newPieceFull` 10 → 8, `addFilamentToPiece` 5 → 4 (campos 1 → 0), `addSupplyToPiece` 5 → 4, `newCollection` 7 → 6 |
| D2 · Foco en el nombre | hecha | `3e65100` | Pieza nueva y colección nueva abren con el foco en el nombre | campos `newPieceFull` 3 → 2, `newCollection` 1 → 0 |
| T1 · Foco inicial de los diálogos | hecha | `ff093cd` | `Dialog.tsx`: primero el campo marcado `data-autofocus` (o `autofocus`); si no hay, el primer campo visible que no sea radio, casilla, fecha, archivo ni color. Marcados: “Cantidad impresa” con la pieza elegida, “Costo” del rollo con filamento elegido (antes `autoFocus`, que el diálogo pisaba), “Cantidad” de Usar o ajustar, “Costo de piezas” de Mantenimiento hecho | campos de `printRunFromPiece`, `addSpoolExisting`, `supplyUse`, `maintenanceDone` 1 → 0 |
| D3 · Marca propuesta del rollo | hecha | `04e5816` | Con material y color que ya existen (o abierto desde el filamento), la marca propone la del último rollo (fecha de compra más reciente) hasta que la persona elige otra; se ve en el resumen | `addSpoolHeader` 8 → 6 |
| D4 · Vender desde Existencias | hecha | `55cf90f` (+ `1d22356` columnas en 820/390) | “Vender” en la fila de cada pieza simple o variante con libres (Lista) y en la ficha de una pieza simple con libres (Fichas); mismo destino que el cajón | `sellFromStock` 3 → 2 |
| D5 · Abono directo | hecha | `80ac4d8` | El chip “Debe $X” de Ventas es un botón que abre la venta con el abono abierto (`?v=<id>&abono=1`); Cancelar vuelve a la venta. “Registrar abono” de Inicio usa la misma dirección | `salePayment` 3 → 2, `salePaymentFromHome` 3 → 2 |
| D6 · Cliente nuevo a la vista | hecha | `83702ff` | Enlace “Nuevo cliente” bajo el selector de cliente (sin cliente elegido) en Armar venta o pedido y en Editar datos de la venta; la opción del selector se queda | `newOrderNewCustomer` 6 → 5 |
| D7 · Registrar pago a la vista | hecha | `6de6e8a` | “Registrar pago” bajo la cifra Saldo del pedido (activo y con saldo) en todas las pestañas menos Cobro, que conserva el suyo | `orderPayment` 4 → 3 |
| D8 · Motivo del ajuste segmentado | hecha | `581615f` | Los 4 motivos de Ajustar existencias como radios segmentados de dos en dos; el foco va a la cantidad | `adjustStock` 5 → 4 |
| D9 · Compra directa desde Compras | hecha | `18c8fc8` | “Registrar compra” de una línea de insumo abre la compra sobre su cajón (`/insumos?i=<id>&compra=1`); al guardar o cancelar queda el cajón | `supplyPurchaseFromPurchases` 3 → 2 |
| Pruebas extra | hecho | `cbb1154`, `048d81a` | Selector solo con teclado en el navegador real; foco en la cantidad del insumo nuevo | — |
| Informe, progreso, decisiones | hecho | este commit | Este archivo, `progreso.md`, `decisiones.md` | — |

## Antes y después de cada flujo
“Antes” = presupuesto de la fase C (`ebcd971`); “después” = `e2e/clicks/budget.ts` ahora. En negritas lo que bajó. Cada número es exacto: si un cambio lo sube (o lo baja sin bajar el presupuesto), su prueba falla y muestra los pasos contados.

| # | Flujo | Prueba | Clics antes → después | Campos antes → después | Mínimo de C (clics / campos) | Mejora |
|---|---|---|---|---|---|---|
| 1 | Agregar rollo desde el encabezado (material, color y marca) | `addSpoolHeader` | 8 → **6** | 1 → 1 | 6 / 1 | D3 |
| 2 | Nueva pieza completa (2 filamentos, 1 insumo, tiempo, precio) | `newPieceFull` | 10 → **8** | 5 → **2** | 8 / 2 | D1 + D2 |
| 3 | Vender una pieza de existencias | `sellFromStock` | 3 → **2** | 0 → 0 | 2 / 0 | D4 |
| 4 | Registrar abono de una venta (Ventas) | `salePayment` | 3 → **2** | 0 → 0 | 2 / 0 | D5 |
| 5 | Registrar abono desde Inicio | `salePaymentFromHome` | 3 → **2** | 0 → 0 | 2 / 0 | D5 |
| 6 | Nuevo pedido con cliente nuevo | `newOrderNewCustomer` | 6 → **5** | 1 → 1 | 5 / 1 | D6 |
| 7 | Registrar pago de un pedido | `orderPayment` | 4 → **3** | 0 → 0 | 3 / 0 | D7 |
| 8 | Ajustar existencias (una dañada, con nota) | `adjustStock` | 5 → **4** | 1 → 1 | 4 / 1 | D8 (+ T1) |
| 9 | Agregar filamento a una pieza | `addFilamentToPiece` | 5 → **4** | 1 → **0** | 4 / 0 | D1 |
| 10 | Agregar insumo a una pieza | `addSupplyToPiece` | 5 → **4** | 0 → 0 | 4 / 0 | D1 |
| 11 | Nueva colección (2 piezas) | `newCollection` | 7 → **6** | 1 → **0** | 6 / 0 | D1 + D2 |
| 12 | Registrar compra desde Compras | `supplyPurchaseFromPurchases` | 3 → **2** | 1 → 1 | 2 / 1 | D9 |
| 13 | Registrar movimiento de filamento | `filamentMovement` | 5 → 5 | 1 → 1 | 4 / 0 | — |
| 14 | Nuevo cliente (Clientes) | `newCustomer` | 4 → 4 | 1 → 1 | 3 / 1 | — |
| 15 | Cotizar a cliente | `quote` | 3 → 3 | 0 → 0 | 2 / 0 | — |
| 16 | Registrar compra de un insumo (Insumos) | `supplyPurchase` | 3 → 3 | 1 → 1 | 2 / 1 | — |
| 17 | Registrar impresión desde el cajón (pieza ya elegida) | `printRunFromPiece` | 3 → 3 | 1 → **0** | 3 / 0 | T1 |
| 18 | Agregar rollo de un filamento que existe | `addSpoolExisting` | 3 → 3 | 1 → **0** | 3 / 0 | T1 |
| 19 | Usar o ajustar un insumo | `supplyUse` | 3 → 3 | 1 → **0** | 3 / 0 | T1 |
| 20 | Mantenimiento hecho (con costo) | `maintenanceDone` | 2 → 2 | 1 → **0** | 2 / 0 | T1 |
| 21 | Registrar venta con varios artículos | `saleSeveralItems` | 7 → 7 | 1 → 1 | 7 / 1 | — |
| 22 | Registrar impresión desde Existencias | `printRun` | 4 → 4 | 1 → 1 | 4 / 1 | — |
| 23 | Vender desde Productos | `sellFromProducts` | 2 → 2 | 0 → 0 | 2 / 0 | — |
| 24 | Poner en producción | `startProduction` | 2 → 2 | 0 → 0 | 2 / 0 | — |
| 25 | Entregar y cobrar | `deliverAndCharge` | 2 → 2 | 0 → 0 | 2 / 0 | — |
| 26 | Cliente aceptó | `acceptOrder` | 1 → 1 | 0 → 0 | 1 / 0 | — |
| 27 | Marcar listo | `markReady` | 1 → 1 | 0 → 0 | 1 / 0 | — |
| 28 | Terminó este trabajo (Impresoras) | `finishJob` | 1 → 1 | 0 → 0 | 1 / 0 | — |
| 29 | Nueva variante | `newVariant` | 2 → 2 | 0 → 0 | 2 / 0 | — |
| 30 | Llevar existencias a una pieza | `enableStock` | 4 → 4 | 1 → 1 | 4 / 1 | — |
| 31 | Venta desde la ficha de un cliente | `saleFromCustomer` | 4 → 4 | 0 → 0 | 4 / 0 | — |
| 32 | Registrar gasto | `newExpense` | 4 → 4 | 1 → 1 | 4 / 1 | — |
| 33 | Nuevo insumo | `newSupply` | 4 → 4 | 2 → 2 | 4 / 2 | — |
| 34 | Nueva impresora | `newPrinter` | 2 → 2 | 1 → 1 | 2 / 1 | — |
| 35 | Devolver una venta | `returnSale` | 3 → 3 | 0 → 0 | 3 / 0 | — |
| | **Total de los 35 flujos** | | **131 → 117** (−14) | **25 → 16** (−9) | | |

Las 16 mejoras “hacer” llegaron a su **mínimo** de C. Los cuatro flujos que aún tienen ahorro posible (`quote`, `newCustomer`, `supplyPurchase`, `filamentMovement`) son “no hacer” de C, con su razón (más botones en las fichas o algo poco frecuente).

## Pruebas
- **Selector (D1):** `apps/web/src/components/Picker.test.tsx`, 7 pruebas: cerrado con su texto de “Elige…”, abre con ↓ y con Enter/Espacio (clic), flechas/Inicio/Fin, Enter elige y el foco va a los gramos, escribir busca (sin acentos ni mayúsculas) y “Sin resultados.”, Esc cierra, devuelve el foco y no llega al diálogo o cajón de atrás, la fila nueva nace abierta con el foco dentro y un clic elige, Tab o salir cierran sin elegir. En el navegador real: `e2e/ronda2-shortcuts.spec.ts` › “D1 … keyboard alone” (foco visible, buscar, elegir, Esc).
- **Diálogos (T1):** `components.test.tsx` › “Dialog initial focus”: salta radio, fecha y campo oculto; el marcado gana a un selector.
- **Medición:** `e2e/clicks` 35 pruebas en verde con los números nuevos; cada mejora asegura además lo que la hace posible (lista abierta y foco en su búsqueda, foco en gramos/cantidad, campo marcado enfocado, marca propuesta visible, dirección `&abono=1` / `&compra=1`).
- **Comportamiento alrededor:** `e2e/ronda2-shortcuts.spec.ts` (nuevo): Cancelar del abono vuelve a la venta y Cerrar a la lista; `?abono=1` en una venta sin saldo muestra la venta; “Nuevo cliente” en Editar datos; “Registrar pago” en Piezas y Datos pero no repetido en Cobro; Cancelar de la compra deja el cajón y no la vuelve a abrir. `e2e/stock-families.spec.ts`: “Vender” solo con libres, en miembros y en Fichas, en 1440 y 390.
- **Pruebas ajustadas al selector nuevo** (sin quitar ninguna aserción): `e2e/workshop.spec.ts`, `e2e/products-variants.spec.ts` (“tiene valor” pasa a “el botón no está vacío y su nombre trae el filamento”), `e2e/clicks/products.spec.ts`; ayudante `e2e/support/picker.ts`. Al motivo segmentado: `e2e/production-stock.spec.ts` (ahora además comprueba el foco en la cantidad). A las direcciones nuevas: `home-attention`, `home-reports-expenses` y `flow-f-purchases` exigen ahora `&abono=1` / `&compra=1` (más estrictas).
- **Comandos:** `pnpm test` (605 pruebas), `pnpm test:tz` (167), `pnpm lint` (0 errores; avisos de longitud como antes), `pnpm typecheck`, `pnpm e2e` (120 en verde, 5 de escritorio omitidas como siempre), `pnpm security` (153 pruebas), `pnpm size` (213.4 KB de 350 KB) en verde.

## Comparación con las pantallas
Capturas en 1440, 820 y 390 (sin errores de consola ni desborde horizontal):

| Pantalla | 1440 | 820 | 390 |
|---|---|---|---|
| Calculadora: fila nueva con la lista abierta, grupos “En esta pieza / Los demás” | bien | bien | bien (la lista se desplaza a la vista al abrir) |
| Colección: “Agregar pieza” con la lista abierta | bien | bien | bien |
| Existencias · Lista con “Vender” | bien | bien tras ajustar columnas (`1d22356`) | bien tras ajustar la rejilla (`1d22356`) |
| Existencias · Fichas con “Vender” | bien | bien | bien |
| Ajustar existencias (motivo segmentado 2 × 2) | bien | bien | bien |
| Ventas (chip “Debe” botón) y abono abierto | bien | bien | bien |
| Pedido (“Registrar pago” bajo Saldo) | bien | bien | bien |
| Armar pedido (“Nuevo cliente”) | bien | bien | bien |
| Compras → compra abierta sobre el cajón | bien | bien | bien |

Diferencias aceptadas con las maquetas de la ronda 2: el botón “Vender” en las filas y fichas de Existencias y el chip “Debe” como botón no están en la maqueta (son las mejoras de esta fase); la columna de acciones de la Lista pasó de 36 a 118 px (104 px en tableta).

## Decisiones tomadas
En `docs/decisiones.md`, al final, bajo “2026-11-13 · Ronda 2 · Fase D”: selector propio con campo de búsqueda (y no el patrón de solo teclear), prefijo `pkr-`, qué cuenta como “usado en la pieza”, `data-autofocus` en lugar de `autoFocus`, de dónde sale “el último rollo”, “Vender” solo en filas sin familia, `?abono=1` / `?compra=1`, “Registrar pago” no repetido en la pestaña Cobro, motivos de dos en dos.

## Bloqueado o dudoso
- **Nada bloqueado.** Las 16 mejoras están hechas.
- **Selector propio en vez del nativo (D1):** es el único control nuevo con riesgo de accesibilidad; tiene pruebas de teclado en jsdom y en el navegador. En móvil ya no abre la lista del sistema sino la propia (con búsqueda); se ve bien en 390, pero conviene probarlo con el dedo.
- **Lista dentro de la calculadora:** el formulario de la calculadora es un área con desplazamiento propio; una lista abierta muy abajo se desplaza a la vista, no se voltea hacia arriba.
- **Medido solo en 1440** como en C; en móvil los números de los selectores nativos que quedan pueden diferir.

## Qué conviene que revise la persona
- Agregar un filamento a una pieza nueva y contar: “Agregar otro filamento” → elegir → escribir gramos (sin tocar el campo).
- Que la marca propuesta del rollo sea la que suele comprar (si alterna marcas, se cambia en el mismo diálogo).
- Ventas: tocar “Debe $X” y registrar un abono; Pedidos: “Registrar pago” desde la pestaña Piezas.
- Existencias: “Vender” en la fila; Compras: “Registrar compra” de un insumo.

## Cómo probarlo
```
pnpm dev                                         # /productos/pieza, /existencias, /ventas, /pedidos, /compras
pnpm exec playwright test e2e/clicks             # 35 mediciones con los números de budget.ts
pnpm exec playwright test e2e/ronda2-shortcuts.spec.ts
pnpm --filter @app/web exec vitest run src/components/Picker.test.tsx
pnpm test && pnpm test:tz && pnpm lint && pnpm typecheck && pnpm e2e && pnpm security && pnpm size
```

---

## Resumen final de la ronda 2
La ronda 2 (`docs/mejoras/ronda-2.md`) tuvo cuatro fases, cada una en su rama con su informe:

| Fase | Rama | Informe | Resultado |
|---|---|---|---|
| A · Medir el rediseño | `ronda2-a-medicion` | `informe-ronda2-a.md` | Inventario del código de variantes, Productos, Existencias e Inicio; barrido de morado (20 lugares); línea base de rendimiento con 500 piezas; plan de 24 pasos para B. Sin cambios de producto |
| B · Construir el rediseño | `ronda2-b-rediseno` | `informe-ronda2-b.md` | Productos agrupa variantes en familias (panel, filas desplegables, un solo flujo de “Nueva variante”); Existencias en Lista y Fichas con familias que suman; Inicio con atención por prioridad y sin rollos; interfaz sin morado, color solo en `tokens.css`; migración aditiva 0007 |
| C · Medir los clics | `ronda2-c-clics` | `informe-ronda2-c.md` | 35 flujos medidos con `countedPage` (`e2e/clicks/`), presupuestos fijos en `budget.ts`, 16 “hacer” ordenados por puntaje |
| D · Acortar los clics | `ronda2-d-mejoras` | este archivo | Las 16 mejoras hechas; 131 → 117 clics y 25 → 16 campos en los 35 flujos |

**Decisión de la persona sobre la marca (fase B):** la mascota **se queda** (barra lateral, barra superior en móvil, título de Inicio, estados vacíos, página de falla e ícono de la pestaña). Lo que se quitó fue el morado de la interfaz, no el logo. Está en `decisiones.md` (“decisión de la persona: la mascota se queda”) y cambió `ronda-2 §2`, D36, `CLAUDE.md` › Diseño, `06 §1` y `07`.

**Notas de historia (de `informe-ronda2-b.md`), para que no sorprendan:** en B hubo commits intermedios en rojo (B2.4–B2.7 y B2.12 con 2 pruebas del servidor hasta `9d13e04`; `d816925` sin `typecheck` hasta `3018f38`; `ef92420` con un error de lint hasta `7db0907`), y el trabajo de B3.2 quedó dentro del commit de B4 `2f6d4ec`. La historia **no se reescribió**; cada punta de rama quedó en verde. En D no hubo commits en rojo de pruebas; el único error de lint (una variable sin uso en una prueba) se corrigió en `048d81a` antes de cerrar.

**Etiquetas:** `antes-ronda2-a`, `antes-ronda2-b` y `antes-ronda2-c` existen **solo en el repositorio local**: este entorno rechaza subir etiquetas. Los puntos de regreso equivalentes en el remoto son los merges de cada fase en la rama principal.

**Pendiente de revisar de rondas anteriores:** `/home` ~10 % más lento que antes de la ronda con el juego de carga (dentro de 2×; propuesta en `informe-ronda2-b.md`); en Fichas de Existencias a 820 un nombre largo puede partirse.

**Clics de la ronda (los 35 flujos de C):**

| Flujo | Antes de D | Después de D |
|---|---|---|
| Nueva pieza completa | 10 clics · 5 campos | 8 · 2 |
| Agregar filamento a una pieza | 5 · 1 | 4 · 0 |
| Agregar insumo a una pieza | 5 · 0 | 4 · 0 |
| Nueva colección (2 piezas) | 7 · 1 | 6 · 0 |
| Vender una pieza de existencias | 3 · 0 | 2 · 0 |
| Registrar abono (Ventas) | 3 · 0 | 2 · 0 |
| Registrar abono desde Inicio | 3 · 0 | 2 · 0 |
| Nuevo pedido con cliente nuevo | 6 · 1 | 5 · 1 |
| Registrar pago de un pedido | 4 · 0 | 3 · 0 |
| Ajustar existencias | 5 · 1 | 4 · 1 |
| Agregar rollo desde el encabezado | 8 · 1 | 6 · 1 |
| Registrar compra desde Compras | 3 · 1 | 2 · 1 |
| Registrar impresión desde el cajón | 3 · 1 | 3 · 0 |
| Agregar rollo de un filamento que existe | 3 · 1 | 3 · 0 |
| Usar o ajustar un insumo | 3 · 1 | 3 · 0 |
| Mantenimiento hecho | 2 · 1 | 2 · 0 |
| Los otros 19 flujos | 58 · 10 | 58 · 10 (sin cambio: ya mínimos o “no hacer”) |
| **Total** | **131 clics · 25 campos** | **117 clics · 16 campos** |

**Para seguir:** la ronda 2 está terminada. Antes de abrir la versión nueva con los datos reales: Ajustes › Descargar copia (`ronda-2 §13`). Lo que sigue en el plan general es la fase 5 (`docs/progreso.md`).
