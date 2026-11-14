# Informe de la ronda 3 · Fase C (pantallas)

## Resumen
C1 dejó el **marco** con el aspecto de la maqueta (`reference/ronda-3/*.html`, `.ui-side`, `.ui-mtop`, `.ui-top`) y un encabezado de pantalla compartido (`PageHead`), para que los cuatro grupos rehagan sus pantallas sin tocar el marco. Las pantallas (C2–C17) se agregan a este informe al cerrar cada grupo.

## Pasos
| Paso | Estado | Commit | Notas |
|---|---|---|---|
| C1 · Marco | hecho | `9ead54b` feat(web): app frame in ronda-3 style | Barra lateral blanca de 232 px con mascota, nombre y giro (E3), Buscar ⌘K, «Nueva pieza» en negro, grupos, contadores grises (D-6), actual en gris y seminegrita; cajón en ≤ 1099 con barra fija (menú, título de la pantalla, «+»), Esc o tocar fuera cierra y devuelve el foco; fondo de trabajo `--soft`; cuerpo en 14 px con los segmentados fijos en 15 px (foto de la prueba con una línea nueva); `PageHead` en `components/` |

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
