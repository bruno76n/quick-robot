# Informe de la ronda 3 · Fase C (pantallas)

## Resumen
C1 dejó el **marco** con el aspecto de la maqueta (`reference/ronda-3/*.html`, `.ui-side`, `.ui-mtop`, `.ui-top`) y un encabezado de pantalla compartido (`PageHead`), para que los cuatro grupos rehagan sus pantallas sin tocar el marco. Después, cuatro agentes en paralelo rehicieron las 16 pantallas (C2–C17) por grupos con archivos separados: G1 Vender, G2 Catálogo, G3 Pedidos y taller, G4 Insumos y negocio. Ningún cambio de comportamiento, API ni datos.

## Pasos
| Paso | Estado | Commit | Notas |
|---|---|---|---|
| C1 · Marco | hecho | `9ead54b` feat(web): app frame in ronda-3 style | Barra lateral blanca de 232 px con mascota, nombre y giro (E3), Buscar ⌘K, «Nueva pieza» en negro, grupos, contadores grises (D-6), actual en gris y seminegrita; cajón en ≤ 1099 con barra fija (menú, título de la pantalla, «+»), Esc o tocar fuera cierra y devuelve el foco; fondo de trabajo `--soft`; cuerpo en 14 px con los segmentados fijos en 15 px (foto de la prueba con una línea nueva); `PageHead` en `components/` |
| C2 · Inicio | hecho | `939f4fb` | Ventas de 30 días con cifra grande y franja; ventas por semana (gris + verde); alertas con botón; en impresión; próximas entregas. Mascota en el título (E3) |
| C3 · Productos | hecho | `586f288` | Fichas con foto o cubo, precio, costo, ganancia y disponibles; panel de variantes, Vender y «+ Variante» siguen; segmentados sin cambio |
| C4 · Pieza (editor) | hecho | `04f9a1e` | Bloques a la izquierda, resultado fijo a la derecha con desglose y %, ganancia por canal (`profitAt` de `core`); también el editor de colección |
| C5 · Ventas | hecho | `dddad6a` | Franja de cifras; tabla con saldo o devuelta junto al total |
| C6 · Pedidos | hecho | `0657be3` | Franja; tablero con avance, fecha de entrega (ámbar si está cerca), total, saldo, ganancia y siguiente paso |
| C7 · Pedido | hecho | `27c3e56` | Pasos con fecha donde existe (D-1), 4 cifras, cliente a la derecha; conserva pestañas (D-9) y la tabla por pieza |
| C8 · Filamentos | hecho | `505506b` | Franja y tabla con barra; **el detalle sigue en el cajón** (E2), con el contenido de la maqueta |
| C9 · Insumos | hecho | `fc1ec0e` | Filtros por estado y tabla; su cajón con el mismo aspecto |
| C10 · Impresoras | hecho | `ce94b30` | Una tarjeta por impresora: trabajo actual, cola, mantenimiento con barra, inversión recuperada |
| C11 · Producción | hecho | `c867f1f` | En impresión y cifras arriba; filtros; registro |
| C12 · Existencias | hecho | `41a2264` | Panel con filtros por estado, variantes bajo su pieza, sets al pie |
| C13 · Compras | hecho | `142576d` | Sugeridas por proveedor; proveedores y últimas compras a la derecha |
| C14 · Clientes | hecho | `6424a22` | Franja; tabla con saldo en rojo y última actividad |
| C15 · Gastos | hecho | `20a9b53` | Periodo, franja, tabla y gastos por categoría (sigue el periodo de la lista) |
| C16 · Reportes | hecho | `4142275` | 5 cifras, ventas por semana, de cada $100, productos con más ganancia, por canal |
| C17 · Ajustes | hecho | `5d72174` | Secciones con índice, canales en tabla, copias con su lista |
| Arreglos de la coordinación | hecho | `e63da64`, `0bf7e31` | Pista del segmentado visible sobre el fondo gris (E1); Devolver venta espera el catálogo para que el aviso cuente las piezas (prueba intermitente de `flow-e`) |

## C1 · Marco
**Pruebas:** `components.test` (menú: abre con el foco en la pantalla actual, Esc cierra y el foco vuelve al botón, tocar fuera igual, Esc cerrado no hace nada; título en la barra; `short` y ruta; contadores), `tokens.test` (segmentados con la línea nueva), `pnpm vitest run --project web`, `pnpm typecheck`, `pnpm lint` (0 errores), e2e `smoke-all`, `no-purple`, `failure-states`, `desktop` (omitidas: piden Electron) y `pnpm e2e` completo: 120 pasan y 5 omitidas (escritorio).

**Comparación con la maqueta** (Pedidos, Pedido, Inicio y Productos contra `pedidos.html`, `pedido.html`, `inicio.html`, `productos.html`):
| Ancho | Resultado |
|---|---|
| 1440 | Barra lateral igual (ancho, ítems de 32 px, grupos, contadores, actual, Buscar ⌘K); diferencias aceptadas: mascota en lugar de «EZ» (E3) y «Nueva pieza» (D-11). Título 26 px, dato debajo, acciones abajo a la derecha |
| 820 | Barra fija de 54 px igual (menú, título, «+» negro); menú como cajón de 272 px con velo; título 24 px |
| 390 | Igual que 820 con márgenes de 14 px; título 22 px y acciones debajo del título |

El contenido de cada pantalla sigue como en la fase B: lo rehace su grupo.

## Cómo usar el marco (para los agentes de C2–C17)
- **Encabezado:** `import { PageHead } from '../../components/PageHead';` (el de `AppShell` es el mismo, reexportado).
  ```tsx
  <PageHead title={L.title} sub={t('screens.orders.inProgress', { count })} actions={<><Button>{L.other}</Button><Button variant="primary" icon="plus">{L.main}</Button></>} />
  // detalle: ruta arriba y nombre corto para la barra del celular
  <PageHead crumbs={[{ label: es.screens.orders.title, to: '/pedidos' }]} title={t('screens.order.crumb', { folio })} short={t('screens.order.crumb', { folio })} sub={customer} actions={…} />
  ```
  - `title`: texto (pasa solo a la barra de tableta y celular) o un nodo (entonces dar `short`). Inicio puede seguir con `<Mascot />` en el título (E3).
  - `sub`: **un dato corto** (la maqueta: «6 en curso», «Taquería Los Compadres», «Viernes 13 de noviembre»), no una frase larga.
  - `crumbs`: reemplaza los `<nav className="crumbs">` escritos a mano (Pedido, Cliente, armador, editor de pieza y de colección); cada paso termina en «/» como la maqueta.
  - `actions`: la principal al final y `variant="primary"` (negra); las demás blancas.
- **No** volver a dar estilo a `.ph`, `h1`, `.ph-a`, `.crumbs`, `.app`, `.side`, `.main`, `.page`, `.topbar` en el CSS de una pantalla: viven en `styles/base.css`.
- **Medidas que ya pone el marco:** fondo `--soft` (los paneles van blancos con borde, sin sombra), cuerpo 14 px, `.page` con 28/32 px de margen (18/24 en tableta, 14/14 en celular) y hasta 1320 px de ancho, 18 px entre el encabezado y lo demás. El corte del menú es **1099 px**: entre 900 y 1099 la pantalla ya tiene todo el ancho (antes le quitaba 248 px la barra lateral).
- **Segmentados:** no cambian (E1), siguen en 15 px aunque el cuerpo sea de 14. Sobre el fondo gris su pista no se distingue (decisión C1, para revisión); si en una pantalla conviene ver la pista, ponerlos dentro de un panel blanco, sin tocar `.seg`.

## Cierre de la fase C
**Pruebas del conjunto** (después de unir los cuatro grupos): `pnpm test` 629 pasan (7 omitidas), `pnpm test:tz`, `pnpm lint` 0 errores, `pnpm typecheck`, `pnpm security` y `pnpm size` (214.7 KB de 350) en verde; `pnpm e2e` 120 pasan y 5 omitidas (escritorio). Una corrida mostró `flow-e` intermitente (el aviso de devolución sin el número de piezas cuando el catálogo aún no cargaba); se arregló en `0bf7e31` y la corrida completa siguiente quedó en verde.

**Comparación visual:** cada grupo comparó sus pantallas con la maqueta en 1440, 820 y 390 (estructura, tamaños, colores y jerarquía de textos). Diferencias aceptadas: mascota en lugar de «EZ» (E3); segmentados en su lugar y aspecto de siempre (E1), por ejemplo Tablero | Lista | Calendario debajo de las cifras y no en el encabezado; detalle de filamento en el cajón (E2); datos de la semilla en lugar de los de «Eje Z»; Ajustes con nombres de canal editables y «Guardar cambios» fijo abajo; en Ventas, «Total» en lugar de «Importe» (vocabulario fijo). La revisión fina pantalla por pantalla, accesibilidad (axe) y textos es la fase D.

**Lo que la maqueta muestra y el sistema no tiene (§7, no se agregó):**
- Pedido: Historial y fecha de Aceptado (D-1); «Fin estimado de producción» (pediría un cálculo nuevo); botones extra de documentos (solo el de Cotización o Nota de venta).
- Tablero de pedidos: aviso «Filamento insuficiente» en la tarjeta.
- Producción: «Últimos 30 días» (la pantalla muestra todos los registros).
- Gastos: la cifra «Variables» (la API no la da).
- Inicio: alertas con título y detalle separados (el servidor manda una frase).
- Productos: gramos en la ficha. Pieza: la línea de fórmula bajo cada costo. Existencias: «Falta: …» en sets; interruptor de «Llevar existencias» (sigue la casilla).
- Insumos: «Registrar compra» a nivel de pantalla. Ajustes: íconos en los botones de exportar (no hay ícono de documento).

**Pendiente para la fase D:**
- Textos nuevos de G3 («Ganancia estimada», «Imprimiendo ahora», «Cola vacía.») que faltan en `docs/13`.
- Limpieza de reglas y tokens que ya nadie usa: `.brf*`, `.lay*`, `.set`, viejas `.tcol`/`.rk-*`, `--c-*`, `--sand`, `--tg-*`; `products/Piece3d.tsx` (solo queda `shapeOf` para Inicio).
- `WeekColumns`: una columna con $0 de ventas sube unos píxeles su fecha. `Steps` oculta las fechas en celular.
- Todo el CSS de pantallas se carga global: vigilar choques de nombres (G3 usó prefijo `prn-` porque `.pp` ya existía).
- axe en las 16 pantallas; menú en celular (Esc, tocar fuera, foco) ya probado en C1.
