# Informe de la fase 3

## Resumen
Ya se puede vender y producir de punta a punta con los mismos números del mockup:
- **Ventas:** venta rápida, abonos, devoluciones (con o sin regreso a existencias), eliminar con "Deshacer".
- **Pedidos:** cotización → aceptado → producción con colas por impresora → listo → entrega, que crea la venta sola. También cancelación con reembolso.
- **Existencias, producción y compras:** libro de piezas terminadas, registros de producción con deshacer, lista de compras por proveedor.
- **Negocio:** clientes con ficha, gastos (únicos y mensuales), reportes, Inicio con atenciones, documentos para clientes, búsqueda (⌘K), atajos y exportar a Excel.

Con la copia del mockup, todas las cifras salen iguales que en el mockup (±$0.01), tanto en `core` como a través de la API:
- **Ventas:** ingreso $13,170, comisión $249.48, costo $2,345.29, ganancia $10,575.23, 94 piezas, margen 80.3 %.
- **Además:** cada venta, cada pedido, cada cliente, las existencias por pieza, el ranking de piezas, los fijos por mes ($1,600) y la inversión recuperada (34.5 %).

## Pasos
| Paso | Estado | Commits | Notas |
|---|---|---|---|
| Reglas de `core` | hecho | `e0953b8` | `stock`, `line-items`, `sales`, `orders`, `production`, `expenses`, `customers`, `reports`, `dates`; golden de la fase 3 |
| Datos | hecho | `76f50a3` | 9 tablas nuevas con `workspace_id` y llaves compuestas, vista `stock_levels`, aislamiento por tabla |
| Servidor | hecho | `aec1709`, `02de753` | Casos de uso de `12 §6–9`, semilla de la fase 3, ganchos de la fase 2 conectados |
| 3.1 Existencias · 3.5 Producción · 3.7 Compras (pantallas) | hecho | `d49650a` | |
| 3.4 Pedidos · Documentos · colas de Impresoras · 3.8 Inicio · 3.6 Gastos · 3.7 Reportes · búsqueda, atajos y CSV | hecho | `12c1dfd` | |
| 3.2 Clientes · 3.3 Ventas y armador | hecho | `b486199` | |
| Rendimiento | hecho | `af8bba3`, `810e939`, `109166c` | Sumas en SQL; ver abajo |
| Estados de falla y humo de pantallas | hecho | `b3061e2`, `b0bf9ea`, `9a3868e` | |

Las pantallas las construyeron cuatro agentes en paralelo, cada uno con su área y sus pruebas. La integración, los commits y las pruebas de conjunto las hice yo.

## Pruebas
- **Totales:** 461 pruebas unitarias y de integración en verde (`pnpm test`, con cobertura) y 37 de Playwright (`pnpm e2e`). También pasan `pnpm test:tz`, `pnpm lint` (0 errores), `pnpm typecheck`, `pnpm security` y `pnpm size` (JS inicial de 200 KB comprimido; límite 350 KB).
- **Casos de `04`:** 4.1, 5.1, 5.2, 6.1, 6.2, 7.1, 7.2, 9.1 y 10.1, más propiedades de los libros y el golden completo de la fase 3.
- **Operaciones de `12 §6–9`:** camino feliz y cada error, en `server/test/usecases/sell.test.ts`:
  - **Ventas:** `LINE_ITEMS_REQUIRED`, `INSUFFICIENT_STOCK`, `PAYMENT_EXCEEDS_BALANCE`, `SALE_ALREADY_RETURNED`, `REFUND_EXCEEDS_PAID`.
  - **Pedidos:** `CUSTOMER_REQUIRED`, `ORDER_INVALID_STATE` (con `expected[]`), `ORDER_NOT_ACTIVE`, `PRINTER_ASSIGNMENT_REQUIRED`, `NO_PRINTERS`.
  - **Producción y existencias:** `NO_SPOOLS`, `PRINT_RUN_LOCKED` (piezas ya vendidas, o registro de un pedido), `COUNT_UNCHANGED`.
  - **Clientes y canales:** `CUSTOMER_NAME_EXISTS`, `CUSTOMER_HAS_HISTORY`, `RESTORE_CONFLICT`, `CHANNEL_IN_USE`, `PRODUCT_IN_ACTIVE_ORDERS`, `PRODUCT_HAS_STOCK`.
  - **Avisos:** `STOCK_SHORT`, `FILAMENT_SHORTFALL`, `ORDER_WAITING_OTHER_PRINTERS` y `FILAMENT_NOT_RETURNED`.
- **Seguridad:**
  - **Matriz de acceso:** las 66 rutas con id, llamadas por A con ids de B, responden 404; también 16 escrituras que apuntan a B desde el cuerpo. B queda intacto.
  - **Fallo a la mitad:** en las 70 rutas de escritura, cualquier falla deja el negocio igual.
  - **Inyección:** en todos los campos de texto nuevos.
  - **Límites:** 100 artículos y 100 000 piezas pasan; uno más falla.
  - **Aislamiento:** de las 9 tablas nuevas.
- **Flujos A–F de `06 §17`** (Playwright, contra el servidor con la semilla): venta rápida; pedido largo con colas, "Terminó este trabajo" y entrega; pedido todo de existencias; cancelación con reembolso; devolución con y sin regreso; compras. Además: clientes, producción y existencias, Inicio, Reportes, Gastos, búsqueda, CSV y documentos.
- **Estados de falla de `15 §5`** (`e2e/failure-states.spec.ts`): error inesperado con código y nada guardado, regla de negocio, disco lleno, botón "Guardando…", "el pedido ya no está en ese paso" con recarga, servidor que no responde, carga lenta con "Reintentar", y Deshacer imposible.
- **Humo:** las 14 pantallas del menú y las 5 de detalle cargan en 1440, 820 y 390 px sin errores de consola, sin pantalla rota y sin desborde horizontal.

## Rendimiento (`15 §2`, conjunto de `15 §1`: 25 000 ventas, 80 000 artículos)
`pnpm perf`, PGlite en Linux con 4 CPU, p95:

| Acción | p95 | Presupuesto | |
|---|---|---|---|
| Lista de ventas (página de 50) | 284 ms | 300 ms | ✓ |
| Pedidos (lista / tablero) | 92 / 235 ms | 300 ms | ✓ |
| Existencias, Producción, Impresoras, Compras, Filamentos | 54–220 ms | 300 ms | ✓ |
| Clientes | ~400 ms | 300 ms | entre 1× y 2× |
| Productos | ~400 ms | 300 ms | entre 1× y 2× |
| Reportes 30 días | ~750 ms | 400 ms | entre 1× y 2× |
| Reportes "Todo" | ~1.9 s | 1.5 s | entre 1× y 2× |
| Inicio | ~580 ms | 400 ms | entre 1× y 2× |
| Búsqueda | ~400 ms | 200 ms | justo en 2× |
| Escrituras (venta, pedido) | 280–360 ms | 500 ms | ✓ |
| `startProduction`, `markOrderReady`, `deliverOrder`, `returnSale` | 62–434 ms | 800 ms | ✓ |

- **Primera medición:** con la primera versión, la lista de ventas tardaba 6.5 s y el reporte de 30 días 17 s.
- **Qué cambió:** se pasaron las sumas a SQL (con `grouping sets`), el ranking que abre los sets se calcula en SQL, y las listas paginan en la base.
- **Resultado:** ninguna medición pasa de 2× (lo que haría fallar la prueba). Las marcadas "entre 1× y 2×" se anotan aquí, como pide `15 §2`.
- **`EXPLAIN` de las 6 consultas pesadas:** página de ventas, artículos de una página, ficha de cliente, existencias de una pieza, reporte de 30 días y pedidos activos. Ninguna recorre completa una tabla grande.
- **Medido en Linux, no en una Mac:** en la Mac del taller conviene volver a medir con `pnpm perf`.

## Comparación con el mockup
| Pantalla | 1440 | 820 | 390 |
|---|---|---|---|
| Inicio | igual | igual | igual |
| Ventas (lista y detalle) | igual | igual | igual |
| Armar venta / Armar pedido | igual | igual | igual |
| Pedidos (tablero y lista) | igual | igual | igual |
| Calendario | igual | sin captura | igual |
| Pedido (4 pestañas; cotizado, aceptado, en producción, listo) | igual | sin captura | igual |
| Diálogos de producción, entrega y cancelación; cotización | igual | producción igual; resto sin captura | igual |
| Impresoras con cola | igual | igual | igual |
| Producción, Existencias, Compras | igual | igual | igual |
| Clientes, ficha, diálogo de cliente | igual | igual | igual |
| Gastos, Reportes, búsqueda, atajos, exportar | igual | igual | igual |

En los anchos sin captura, la prueba de humo comprueba que carga sin errores ni desborde.

Diferencias aceptadas:
- **Fechas:** salen corridas un día, porque el mockup calcula las suyas desde hoy. Algunas semanas de Reportes se mueven un día por eso.
- **Avance de colas** e "Imprimiéndose ahora" dependen de la hora.
- **"Total" en lugar de "Importe"** en los documentos (vocabulario fijo de `13`).
- **Pedido nuevo:** toma el primer canal (el mockup fijaba "WhatsApp").
- **Historial del cliente:** los artículos van separados con ", ".
- **En "Datos" del pedido,** la entrega, el canal y la nota se cambian con "Editar"; el mockup permitía cambiarlos en línea.
- **Extras que pide `06`:** "Foto (opcional)" al registrar una impresión, el filtro de periodo en Gastos y el bloque "Inversión recuperada" en Reportes.

## Decisiones tomadas
`docs/decisiones.md`, entrada "Fase 3 · Pasos 3.1–3.8". Lo principal:
- **Precisión de costos:** el costo unitario de un artículo se guarda con precisión completa (`numeric(14,4)` en centavos) para que las sumas coincidan con el mockup.
- **Pagos:** `sale.tracks_payments` distingue "pagada completa" de "con abonos".
- **Editar un pedido:** solo en Cotizado o Aceptado. Al ajustar existencias, el conteo nunca baja de lo apartado.
- **Registros de producción:** se hacen por filamento (no por rollo) y descuentan rollo por rollo con purga. Uno "para existencias" activa "llevar existencias".
- **Eliminar:** borrar una venta devuelve sus piezas. Borrar un pedido lo saca de las colas; restaurarlo lo regresa.
- **Rendimiento:** sumas en SQL; las pruebas de rendimiento van aparte (`pnpm perf`).

## Bloqueado o dudoso
- **Nada bloqueado.**
- **Para revisar** (marcados en `decisiones.md`):
  1. En "Últimas compras" de Compras, el primer movimiento de cada insumo cuenta como existencia inicial, no como compra.
  2. La búsqueda de ventas y pedidos distingue acentos ("cafe" no encuentra "café"); la de piezas y clientes no.
  3. Los valores de arranque de un negocio nuevo (ya anotados en la fase 2).
- **Pendiente para la fase 4:** las pantallas de falla de escritorio (servidor caído, migración fallida, archivo dañado) y "Copia de seguridad" en Ajustes. El "esqueleto a los 300 ms" de `15 §5` se agregó después del cierre (ver `informe-fase-4.md`).

## Qué conviene que revises
1. **Un pedido completo:** créalo en Armar pedido, acéptalo, ponlo en producción con "Descontar filamento", termina los trabajos en Impresoras y entrégalo. Revisa que la venta aparezca en Ventas y que Existencias y Filamentos bajen.
2. **Devolver una venta,** con y sin "regresa a existencias", y cómo cambian la ganancia y Existencias.
3. **Reportes y Gastos** con tus categorías: el filtro de periodo agregado en "Todos los gastos" y el bloque "Inversión recuperada".
4. **Los tres puntos "para revisar"** de arriba.

## Cómo probarlo
```bash
pnpm install
pnpm dev     # http://127.0.0.1:5173/inicio — negocio del mockup en memoria
pnpm test && pnpm lint && pnpm typecheck && pnpm security && pnpm e2e
pnpm perf    # presupuestos de 15 §2 con 25 000 ventas (la primera vez tarda ~5 min en generar el conjunto)
```
