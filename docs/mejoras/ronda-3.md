# Ronda 3 · Diseño visual

El dueño aprobó un diseño nuevo para las pantallas del sistema: el mismo que aparece en la página de venta (Para talleres, en la web de Quick Robot). Esta ronda lo lleva al sistema. **No agrega funciones**: cambia cómo se ve cada pantalla y algunas palabras de la interfaz.

**Material de esta ronda**
- Maquetas: `reference/ronda-3/` (16 pantallas + `index.html`, `ui.css`, `app.css`, `app.js`; se abren con doble clic; ver `reference/ronda-3/README.md`).
- Este documento.

**Qué manda si hay conflicto:** 1) este documento; 2) las maquetas, **en lo visual** (colores, tipografía, tamaños, radios, espacios, gráficas, tablas, estados) y en estructura; 3) el código actual en comportamiento. A diferencia de la ronda 2, **aquí la maqueta sí manda en radios, sombras y tamaños**: ese es el cambio.

**Lo que no cambia:** reglas de negocio (`04`), casos de uso y API (`12`), datos (`05`), flujos (`06 §17`). Si una maqueta muestra algo que el sistema no tiene, **no se agrega**: se deja fuera y se anota (§7).

---

## 1. Cómo se trabaja

Mismas reglas que la ronda 2 (`ronda-2.md §1`: una rama por fase, un commit por paso, fusionar solo en verde con etiqueta `antes-ronda3-<fase>`, informe por fase, datos reales intocables, no preguntar y anotar en `decisiones.md`).

| Fase | Qué es | Cambia código |
|---|---|---|
| **A** | Inventario: cada pantalla y componente actual contra la maqueta; lista de diferencias y de lo que la maqueta muestra y el sistema no tiene (§7) | No (solo informe) |
| **B** | Tokens y componentes base (§2, §3) en un solo archivo de tokens y en los componentes compartidos | Sí |
| **C** | Pantallas, una por paso, en el orden de §6 | Sí |
| **D** | Revisión visual en 1440, 820 y 390 contra las maquetas, accesibilidad y textos | Sí (correcciones) |

## 2. Tokens

Todo el color sale de tokens en **un solo archivo** (regla de la ronda 2). Valores (`reference/ronda-3/app.css` y `ui.css`):

| Token | Valor | Uso |
|---|---|---|
| `--ink` | `#121214` | Texto, botón principal, selección, foco |
| `--ink-2` | `#6a6a73` | Texto secundario, etiquetas |
| `--ink-3` | `#9b9ba5` | Grupos del menú, pasos pendientes, deshabilitado |
| `--soft` / `--u-app` | `#f6f6f8` | Fondo de la aplicación y de bloques internos |
| `--u-line` | `#e9e9ee` | Bordes de paneles y tablas |
| `--u-line-2` | `#f0f0f3` | Separadores entre filas |
| `--u-track` | `#ebebf0` | Fondo de barras |
| `--u-bar` / `--cost` | `#4a4a53` | Barras de costo y de avance |
| `--u-soft` | `#dedee5` | Ventas en las columnas, interruptor apagado |
| `--green` / `--green-d` / `--green-l` | `#00ae42` / `#00873a` / `#e3f5e9` | **Solo ganancia** (barras, cifras) y estado correcto |
| `--amber` / `--amber-d` / `--amber-l` | `#b4740a` / `#8a5a06` / `#fdf3e1` | Stock bajo, próximo, fecha de entrega cercana |
| `--red` / `--red-l` | `#c8302a` / `#fbeaea` | Crítico, vencido, fallida, saldo, urgente |

**Sin morado** (sigue la ronda 2). Los colores de **datos** (el círculo del filamento) no son de interfaz.

**Tipografía:** Geist. Títulos de pantalla 26 px (24 en tableta, 22 en celular), título de panel 14 px seminegrita, texto 14 px, tablas 13 px, etiquetas 12–12.5 px, cifras grandes 22–40 px con `letter-spacing` negativo. **Números tabulares** en todo lo que es dinero, gramos, horas y conteos.

**Formas:** botón 30 px de alto y radio 7; campo 34 px y radio 8; panel radio 12 con borde y **sin sombra**; estado (`pill`) 22 px, radio 6, con punto del color; segmentado con fondo `--u-app`.

## 3. Componentes y reglas

| Componente | Regla | Maqueta (clase) |
|---|---|---|
| Barra lateral | Monograma, nombre y giro (de Ajustes); Buscar ⌘K; Inicio y los grupos Vender, Taller y Negocio; contadores en gris; la actual con fondo gris y seminegrita | `.ui-side` |
| Menú en celular y tableta (≤ 1099) | La barra lateral pasa a cajón; arriba una barra fija con el menú, el título y «+» | `.ui-mtop`, `app.js` |
| Encabezado de pantalla | Ruta (si es detalle), título, dato corto debajo y acciones a la derecha (principal en negro) | `.ui-top` |
| Cifras del periodo | Una franja de 3 a 5 cifras con divisiones, no tarjetas sueltas; en celular 2 × 2 | `.kps-row` |
| Panel | Fondo blanco, borde, radio 12; título del panel a la izquierda y su acción o dato a la derecha | `.ui-panel`, `.ui-ph` |
| Tabla | Encabezados de 11.5 px en gris, filas de 12 px de alto interno, separadores claros, números a la derecha; en celular se esconden las columnas secundarias (`hide-sm`) | `.ui-tbl` |
| Estado | Texto siempre; el color solo refuerza (verde, ámbar, rojo, gris) | `.ui-pill` |
| Barra de avance | 6 px, fondo `--u-track`, valor en `--u-bar`; ámbar o rojo solo si el estado lo es | `.ui-meter` |
| Alertas | Ícono en cuadro del color del estado, título, detalle y botón de la acción | `.al-list` |
| Pasos de un pedido | 5 estados con punto; hechos en negro con palomita, actual con anillo; fecha debajo | `.ui-steps` |

## 4. Gráficas

- **Una gráfica, un color.** Costos y ventas en gris; **verde solo para ganancia**. Nada de barras de 8 colores.
- **Ventas por semana:** columna gris clara con las ventas y, dentro, verde con la ganancia bruta; el monto arriba de cada columna; leyenda de dos entradas.
- **De cada $100 vendidos:** una barra de dos partes (costos y gastos en gris oscuro, ganancia neta en verde) y debajo la lista ordenada de mayor a menor con su barra gris.
- **Rankings** (productos con más ganancia, gastos por categoría): barras horizontales de un color con el monto a la derecha.
- Etiquetas directas en lugar de ejes; sin cuadrícula.

## 5. Vocabulario (cambios en `es.ts`)

El dueño pidió las palabras de un sistema, no frases coloquiales. Cambian estas (el resto de `13` sigue igual):

| Dónde | Antes | Ahora |
|---|---|---|
| Inicio | Atención | **Alertas** |
| Existencias | Libres | **Disponibles** |
| Existencias (estado) | Todo apartado · Pocas · Agotada | **Apartado** · **Stock bajo** · **Agotado** |
| Filamentos (estado) | Poco · Se acaba | **Stock bajo** · **Crítico** |
| Insumos (estado) | Poco · Suficiente | **Stock bajo** · **Normal** |
| Mantenimiento | Al corriente · Pronto · Toca ya | **Al día** · **Próximo** · **Vencido** |
| Impresoras (estado) | Libre | **Disponible** |
| Clientes, ventas | Debe | **Saldo** |
| Pedidos, Inicio | Entrega | **Fecha de entrega** |
| Producción (resultado) | Salió bien · Falló | **Correcta** · **Fallida** |
| Precios | Piso | **Precio mínimo** |
| Reportes | Piezas con más ganancia | **Productos con más ganancia** |

Actualizar el vocabulario fijo de `CLAUDE.md` (Libres → Disponibles) y `13`. Los valores internos (`free`, `reserved`, …) no cambian. Un texto que quede sin traducir rompe `i18n.test.ts`, como siempre.

## 6. Pantallas (orden de la fase C)

| # | Pantalla | Maqueta | Qué cambia |
|---|---|---|---|
| 1 | Marco (barra lateral, encabezado, menú en celular) | todas | §3 |
| 2 | Inicio | `inicio.html` | Ventas de 30 días con cifra grande y franja (ganancia bruta, gastos, ganancia neta, por cobrar); ventas por semana; alertas con botón; en impresión; próximas entregas |
| 3 | Productos | `productos.html` | Fichas con foto (o el cubo con el color del filamento si no hay foto), precio, costo, ganancia y disponibles |
| 4 | Pieza (editor) | `pieza.html` | Formulario por bloques a la izquierda; a la derecha, fijo, el desglose del costo con barra y %, precio por valor o por fórmula, ganancia, margen, veces el costo, precio mínimo y ganancia por canal |
| 5 | Ventas | `ventas.html` | Franja de cifras; tabla con saldo o devuelta junto al total |
| 6 | Pedidos | `pedidos.html` | Franja; tablero con tarjetas: avance por impresora, alerta de filamento, fecha de entrega (ámbar si está cerca), total, saldo, ganancia y siguiente paso |
| 7 | Pedido | `pedido.html` | Pasos con fecha, 4 cifras, artículos con origen, impresora y avance, fin estimado; a la derecha cliente, costo y ganancia, documentos e historial |
| 8 | Filamentos | `filamentos.html` | Franja; tabla con barra de disponible; el cajón del filamento a la derecha (rollos y movimientos) |
| 9 | Insumos | `insumos.html` | Filtros por estado; tabla |
| 10 | Impresoras | `impresoras.html` | Una tarjeta por impresora: trabajo actual con Terminar, cola, mantenimiento por tarea con barra, inversión recuperada |
| 11 | Producción | `produccion.html` | En impresión y cifras de 30 días arriba; filtros; registro |
| 12 | Existencias | `existencias.html` | Filtros por estado; variantes bajo su pieza; sets armables |
| 13 | Compras | `compras.html` | Sugeridas por proveedor con «Copiar pedido»; proveedores y últimas compras a la derecha |
| 14 | Clientes | `clientes.html` | Franja; tabla con saldo en rojo y última actividad |
| 15 | Gastos | `gastos.html` | Periodo; franja (del periodo, fijos al mes, variables); tabla; gastos por categoría |
| 16 | Reportes | `reportes.html` | 5 cifras; ventas por semana; de cada $100; productos con más ganancia; por canal |
| 17 | Ajustes | `ajustes.html` | Secciones con índice a la izquierda; canales en tabla; copias con su lista |

## 7. Lo que la maqueta muestra y hay que revisar

La fase A confirma cada uno contra el sistema. Lo que no exista **no se agrega** en esta ronda: se omite y se anota en el informe.

- **Fecha bajo cada paso del pedido** y **Historial** del pedido: solo si el sistema guarda la fecha de cada cambio de estado y de cada pago. Si no, los pasos van sin fecha y el panel Historial no se muestra.
- **Gastos por categoría** (panel de Gastos): sale de las categorías que ya existen; es solo una suma.
- **Entregas en 7 días** y **Ganancia estimada** (franja de Pedidos): la franja de resumen de Pedidos ya los tiene (`06 §5`).
- **Valor del inventario** (Filamentos): el encabezado de Filamentos ya lo calcula.
- **Miniatura de producto:** la foto de la ficha técnica; sin foto, el cubo con el color del filamento.

## 8. Pruebas

- Todas las pruebas actuales pasan (las de textos se actualizan solo por el vocabulario de §5).
- Comparación visual de cada pantalla contra su maqueta en 1440, 820 y 390 (capturas de Playwright), como en las rondas anteriores.
- Ningún color fuera de los tokens (`git grep` de colores literales en componentes); ningún morado.
- axe sin errores serios en las 16 pantallas.
- El menú en celular y tableta abre con el botón, cierra con Esc y tocando fuera, y devuelve el foco.

## 9. La web

Las mismas pantallas, con estos mismos datos de ejemplo, están dibujadas en la página de venta del sistema (web de Quick Robot, `docs/25 §6.3`). Si en esta ronda algo cambia respecto a la maqueta (por §7), se anota en el informe para ajustar las ilustraciones de la web cuando se encienda.

## 10. Qué debe revisar la persona al terminar

- Las 16 pantallas en la computadora y en el celular contra `reference/ronda-3/`.
- Que las palabras nuevas (§5) se lean bien con datos reales.
- La lista de §7: qué quedó fuera y si conviene agregarlo en otra ronda.
