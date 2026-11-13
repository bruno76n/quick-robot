# Ronda 2 · Mejoras tras una semana de uso

El sistema ya está construido (fases 1 a 4) y se usa con **datos reales** desde hace una semana. Esta ronda hace cuatro cosas, en cuatro fases seguidas y sin pedir aprobación entre una y otra:

| Fase | Qué es | Cambia código de producción |
|---|---|---|
| **A** | Medir el rediseño: qué hay que cambiar y a qué está ligado | No (solo informe) |
| **B** | Construir el rediseño: Productos, Existencias, Inicio y panel neutro | Sí |
| **C** | Medir los clics: cuántos cuesta hoy cada flujo y cuáles se pueden acortar | No (solo informe y pruebas de medición) |
| **D** | Acortar los clics que la fase C marque | Sí |

**Material de esta ronda**
- Maquetas: `reference/ronda-2/*.html` (cinco archivos que se abren con doble clic; ver `reference/ronda-2/README.md`).
- Este documento y los cambios en `01` (D36–D45), `04 §5`, `05`, `06 §1–3 y §10`, `07`, `12`, `13 §3 y §9.1`, `CLAUDE.md`.

**Qué manda si hay conflicto:** 1) este documento y los documentos actualizados; 2) las maquetas, en estructura, jerarquía y comportamiento; 3) el código actual. El mockup viejo (`reference/Quick Robot mockup.html`) **ya no manda** en Productos, Existencias, Inicio ni en el color: sigue mandando en todo lo demás.

**Las maquetas no son código.** Sus datos y cifras son de ejemplo. Los radios, sombras y tamaños de los componentes que ya existen (tarjeta, chip, botón, tabla, segmentado, cajón) se toman del sistema, no de la maqueta. Lo que sí se copia: qué elementos hay, en qué orden, qué se agrupa, qué se despliega y qué hace cada botón.

---

## 1. Cómo se trabaja (las cuatro fases)

Aplican las reglas de `CLAUDE.md › Modo autónomo` con estas diferencias:

0. **Paso previo: poner los documentos al día.** Esta ronda llega con `docs/mejoras/ronda-2.md`, `reference/ronda-2/` y el parche `docs/mejoras/parches-docs.diff`, que contiene los cambios a los documentos que ya existen (`CLAUDE.md`, `01`, `03`, `04`, `05`, `06`, `07`, `09`, `12`, `13`, `README`, `prompts`, `progreso`, `decisiones`). Se aplican a las versiones **actuales** (`git apply --3way` o `patch -p1`); si un bloque no encaja porque el documento cambió durante la construcción, se aplica el mismo cambio a mano **conservando lo que ya tenía** (en `decisiones.md` y `progreso.md` solo se agrega lo nuevo al final). **Nunca** se reemplaza un documento entero por una copia vieja. Un commit: `docs: ronda 2 planning`.
1. **Una rama por fase:** `ronda2-a-medicion`, `ronda2-b-rediseno`, `ronda2-c-clics`, `ronda2-d-mejoras`. Cada fase parte de la rama principal ya fusionada con la anterior.
2. **Un commit por paso**, en inglés, como siempre.
3. **Al cerrar cada fase con todo en verde se fusiona a la rama principal sin pedir permiso.** Orden exacto:
   1. Pasan: `pnpm test`, `pnpm test:tz`, `pnpm lint`, `pnpm typecheck`, `pnpm e2e`, `pnpm security`, `pnpm size`.
   2. Se crea la etiqueta `antes-ronda2-<a|b|c|d>` sobre la rama principal (punto de regreso).
   3. Se fusiona la rama de la fase a la principal y se publica.
   4. Si el entorno solo deja publicar la rama de trabajo, la fusión no se fuerza ni se salta: se deja la rama lista, se dice en el informe y la fase siguiente se apila encima de ella.
4. **Nunca** se fusiona con pruebas rojas, nunca se fuerza un push, nunca se reescribe la historia.
5. **Informe al cerrar cada fase:** `docs/mejoras/informe-ronda2-<a|b|c|d>.md` con el formato de `docs/prompts.md §6` (hecho, pruebas, decisiones, bloqueado o dudoso, qué conviene que revise la persona, cómo probarlo). Se actualiza `docs/progreso.md`.
6. **Datos reales:** el sistema tiene datos de verdad. Las pruebas usan `reference/mockup-backup-v7.json` o datos generados, nunca la base real. Toda migración es **solo aditiva** (agrega columnas o índices, rellena valores; no borra ni renombra), va precedida de la copia automática de `BackupStore` y se prueba contra una base de prueba que incluya los casos raros de `§3.1`.
7. **Cuando algo no está claro no se pregunta:** se decide por este documento, luego `04` y `06`, luego la opción más simple que respete `CLAUDE.md`, y se anota en `docs/decisiones.md`. Los casos de parada son los de `CLAUDE.md`.
8. **Documentos al día:** cada cambio de comportamiento actualiza `04`, `06`, `12` o `13` en el mismo commit.

---

## 2. Panel neutro (decisiones D36–D37)

El panel es un producto que se va a distribuir a otros negocios. **No lleva la marca Quick Robot ni su color.** La empresa Quick Robot lo fabrica; la interfaz es neutra y cada negocio pone su nombre.

**Color**
- Se elimina el morado de toda la interfaz (no solo de las tres pantallas): `--purple`, `--purple-soft` y las capas moradas del desglose (`--c-*`).
- Se agregan tokens neutros: `--accent` (valor inicial = `--ink`, `#121214`) para acción principal, selección y anillo de foco; `--cost` (`#5a5a65`) y `--cost-soft` (`#f1f1f4`) para Costo.
- **Regla de color con significado nueva: gris oscuro = costo, verde = ganancia.** Sustituye a “morado = costo”. Ámbar, rojo y gris quedan para estados; el azul solo informativo.
- Todo el color de la interfaz sale de tokens, en **un solo archivo**. Cambiar el color de acento de un negocio en el futuro debe ser cambiar una variable. (Configurarlo por negocio no se hace ahora.)
- Los colores de **datos** no cambian: el swatch de un filamento morado sigue siendo morado.
- Capas del desglose de costo: grises (ver la barra “De cada $100 vendidos” en `reference/ronda-2/inicio.html`).

**Marca**
- La barra lateral deja de mostrar la mascota. Arriba va un **monograma** (las iniciales del nombre del negocio, en una caja gris `--panel-2`) con el **nombre** y el **giro** que vienen de Ajustes (`06 §1`). Si el negocio no ha puesto nombre, “Mi negocio” y “Giro del negocio” en gris.
- No se agrega subir logo del negocio (fuera de alcance).
- `assets/` sigue existiendo: la mascota y el ícono son de la app de escritorio personal y de uso externo. No aparecen en pantallas ni en documentos del panel.
- Ningún texto de la interfaz dice “Quick Robot” (ya lo exigía la regla 6 de `CLAUDE.md`; la fase A verifica que se cumple).

---

## 3. Productos: variantes agrupadas (D38)

### 3.1 Reglas

- Una **familia** = una pieza **original** (sin `parent_id`) + sus **variantes** (`parent_id` = la original). **Un solo nivel.** Al crear una variante desde otra variante, su `parent_id` es la original raíz. Si hay datos viejos con cadenas (variante de variante), se resuelven a la raíz al leer y la migración las normaliza.
- “N variantes” **no cuenta la original**.
- **Etiqueta de variante** (`variant_label`, texto 1–60, obligatoria si hay `parent_id`): “Silk morado”, “Negro mate”. Fuera de las listas agrupadas, una variante se muestra como **`<original> · <etiqueta>`** (`displayName`): selectores de venta y pedido, colecciones, paleta ⌘K, documentos, Reportes, Inicio. La API siempre manda `displayName`. Ventas y pedidos guardan en su foto el `displayName` del momento (como ya guardan el nombre).
- **Migración de nombres:** para cada variante existente, la etiqueta sale de su nombre quitando el nombre de la original (con su separador) y el texto “(variante)”; si queda vacía, “Variante”. No se pierde ni se cambia ningún nombre guardado.
- **Eliminar una original con variantes vivas** se bloquea con `PRODUCT_HAS_VARIANTS` (código nuevo, `12`). Una variante sí se puede eliminar sola (borrado suave y Deshacer, como hoy).
- **Casos raros que la prueba de migración debe incluir:** variante de variante; variante cuya original está eliminada (queda como pieza independiente y su `parent_id` se limpia); variante sin “(variante)” en el nombre; dos variantes con la misma etiqueta (se permite, se distinguen por su material).
- **Contadores:** “Piezas N” cuenta **familias** (una original con sus variantes cuenta 1; una pieza sin variantes cuenta 1). Filtros: **Todas · Técnicas · Con variantes** (el último reemplaza a “Variantes”: ahora son las familias que tienen al menos una variante). Una familia cumple una etiqueta o “Técnica” si **cualquiera** de sus miembros la tiene; se dibuja la tarjeta o fila de la original.
- **Búsqueda:** cuenta el nombre y la etiqueta de cada miembro y las etiquetas de la pieza. Si el texto solo coincide con una variante, la familia aparece **con su panel abierto**. (Si abrirlo solo en ese caso complica el componente, es aceptable dejarlo cerrado; se anota en `decisiones.md`.)
- **Paginación por familias**, no por piezas. Dos consultas por página (originales y luego sus variantes con `parent_id IN (…)`); nada de una consulta por tarjeta.

### 3.2 Fichas (`reference/ronda-2/productos-fichas.html`)

- La tarjeta de una original con variantes lleva el botón-píldora **“N variantes ⌄”** (`aria-expanded`). Al abrirlo, la tarjeta se marca con borde de acento y aparece **un panel a todo el ancho debajo de su fila de tarjetas**, con una muesca que apunta a la tarjeta.
- Solo **un** panel abierto a la vez; abrir otro cierra el actual. El estado abierto no se guarda entre sesiones.
- El panel: título “Variantes de {pieza}”, botón **“+ Nueva variante”**, y una fila por miembro: la **original primero, marcada “Original”**, y luego las variantes. Columnas: Variante · Material · Costo · Precio · Ganancia · En existencia · Vendidas; acciones **Vender** y **Editar**. (Es el único lugar de Productos donde la original sale como fila; permite venderla o editarla sin cerrar el panel.)
- Pantallas pequeñas: 4 columnas de tarjetas → 2 (820) → 1 (390); en 390 las filas del panel se apilan (nombre y material arriba; costo, precio y ganancia en una línea).

### 3.3 Lista (`reference/ronda-2/productos-lista.html`)

- Las originales con variantes tienen a la izquierda un botón-flecha que despliega, **debajo de su fila**, una fila por variante con una guía que las une a su pieza, y al final **“+ Agregar variante de {pieza}”**. Aquí **no** se repite la original (la fila de arriba ya es ella).
- Cada fila de original tiene además **“+ Variante”**. Una original sin variantes no tiene flecha.
- Escritorio y tableta: tabla con desplazamiento horizontal y la columna de la pieza fija. Móvil: la tabla pasa a tarjetas de una columna.

### 3.4 Crear una variante (pocos clics)

“+ Variante”, “+ Nueva variante”, “+ Agregar variante de …” y “Guardar como variante nueva” (calculadora) llevan al **mismo** flujo: la calculadora con una copia de la original, con título **“Nueva variante de {pieza}”**, el campo **“Nombre de la variante”** vacío y con el foco, y los materiales de la original ya puestos. Guardar la deja ligada y devuelve a Productos con **su panel abierto**. Ya no se escribe “(variante)” en el nombre.

---

## 4. Existencias: lista y fichas simplificadas (D39–D40)

### 4.1 Lo común

- Selector **Fichas | Lista** como en Productos; se guarda por pantalla (`view.stock`). **Vista por defecto: Lista** (cuando no hay preferencia guardada).
- Encabezado: “Total: {unidades} unidades de {piezas} piezas · Libres: {n} · Apartadas: {n}”. **{piezas} cuenta familias con existencias.**
- Filtros por estado, con contador: **Todas · Pocas · Todo apartado · Disponible · Agotadas**. Una familia cuenta **una vez**. Buscador por nombre (incluye etiquetas de variante). Botones del encabezado: “Registrar impresión” y “Llevar existencias de otra pieza”, como hoy.
- Solo aparecen piezas con existencias activadas (`tracksStock`). Una familia se agrupa con sus miembros que lleven existencias; si solo uno lleva, sale como fila o ficha **simple**, sin flecha.
- **Orden por defecto: menos libres primero** (lo de arriba es lo que conviene imprimir); a igualdad, por nombre. El encabezado “Libres” alterna el orden.
- **Estado de una familia** (`04 §5`): `out` si todos sus miembros están agotados; `all_reserved` si sus libres sumados son 0; `few` si **algún** miembro tiene 2 libres o menos; `ok` en otro caso. En palabras: una pieza con variantes está en “Pocas” si alguna de sus variantes está baja. Sus números (libres, apartadas, total) son la **suma** de sus miembros.
- Los estados nunca van solo en color: siempre llevan el texto del chip.

### 4.2 Lista (`reference/ronda-2/existencias-lista.html`)

- Columnas: Pieza · Estado · Libres · Apartadas · Total · Precio de lista. “Libres” va en grande y con el color del estado.
- Una familia es una fila con flecha a la izquierda; al desplegarla salen sus miembros (la **original primero, marcada “Original”**), con las mismas columnas.
- **Quién abre el cajón de movimientos:** la fila que tiene movimientos propios. Una pieza simple, o cada miembro de una familia (con la flecha “›” a la derecha). La fila de la familia **no** abre cajón (la maqueta ya lo dibuja así).

### 4.3 Fichas (`reference/ronda-2/existencias-fichas.html`)

- **Se quitan los cuadritos de colores.** Cada ficha: foto, nombre, impresora, chip de estado, **un número grande de libres** con “de {total} en total”, una **barra fina** (libres en el color del estado, apartadas en gris) y “{n} apartadas” con el precio de lista.
- Una familia es **una** ficha con el bloque “{n} variantes · libres por variante” (original primero). Tocar la ficha o una línea de variante abre el cajón de esa pieza.
- Cuadrícula de `minmax(250px, 1fr)`; 1 columna en móvil.

---

## 5. Inicio: atención por prioridad (D41)

Referencia: `reference/ronda-2/inicio.html`. **Lo que no cambia:** el resumen de arriba (frase, cambios contra el periodo anterior y “De cada $100 vendidos, a dónde se va”), “Piezas con más ganancia”, “Impresoras”, los botones de la cabecera y **todos los textos de las atenciones**, que se quedan como están en `es.ts`.

**Lo que cambia**
1. **Se quita la sección “Filamento”** con los rollos dibujados. El estado de cada filamento sigue en Filamentos, y un filamento bajo sale como atención.
2. **“Atención” pasa a ser la columna principal** (izquierda); a la derecha quedan “Piezas con más ganancia” e “Impresoras”. En pantallas pequeñas: Atención, Piezas, Impresoras.
3. **Las atenciones se agrupan por prioridad**, con un punto y un título de grupo, y se pueden **filtrar** con chips con contador: **Todas · Urgente · Esta semana · Para revisar**. El filtro no se guarda.
4. Cada atención: un **ícono por tipo** (filamento, pedido, cobro, mantenimiento, precio) con el color del grupo, el texto de siempre con lo importante en negrita, y **su botón de siempre** (Agregar rollo, Abrir pedido, Registrar abono, Ver filamento, Ver impresoras, Abrir pieza…).
5. Se muestran todas; si un grupo pasa de 5, se muestran 5 y un enlace “Ver las {n} restantes” despliega el resto en el mismo lugar (reemplaza el “Y 3 avisos más” de hoy).

**A qué grupo va cada atención** (la clasificación vive en `core`, `classifyAttention`, con pruebas por caso; `GET /home` manda `severity` = `urgent` | `soon` | `review`)

| Grupo | Atenciones |
|---|---|
| **Urgente** (bloquea una impresión o vence hoy o mañana) | Pedido aceptado sin descontar filamento y con faltante · Pedido activo con entrega vencida, hoy o mañana |
| **Esta semana** | Pedido activo con entrega en 2 días · Venta con saldo por cobrar · Filamento con 150 g o menos disponibles · Insumo agotado o en su mínimo |
| **Para revisar** | Mantenimiento pendiente (“Pronto” o “Toca ya”) · Pieza o colección con precio fijo bajo el piso · Sin copia de seguridad descargada o la última con más de 7 días |

Si hoy `severity` usa otros valores, la fase A los lista y la B los reemplaza sin reutilizar un valor con otro sentido. Dentro de un grupo se conserva el orden de hoy. Sin atenciones: se usa el estado vacío actual.

---

## 6. Qué debe quedar ligado (lista de comprobación)

La fase A confirma cada fila con el archivo y la prueba que la cubre; la fase B la cumple. Todo lo que muestre piezas debe entender las familias:

| Lugar | Qué debe pasar |
|---|---|
| Productos (fichas y lista) | Familias, contador “Piezas N”, filtros, búsqueda y paginación por familias (`§3`) |
| Calculadora | “Guardar como variante nueva” y los demás accesos usan el flujo de `§3.4`; editar una variante muestra su original (“Variante de {pieza}”) |
| Existencias (lista, fichas, cajón, encabezado) | Familias y estado de familia (`§4`); el cajón sigue por pieza |
| Armar venta o pedido, selector de piezas | Lista plana con `displayName`, ordenada por familia (la original primero) |
| Colecciones | Las partes pueden ser originales o variantes; se muestran con `displayName`; “sets armables” sigue por pieza |
| Producción (registrar impresión) | Selector de pieza con `displayName` |
| Reportes e Inicio (“Piezas con más ganancia”) | Cada variante cuenta por separado, con `displayName` (no se funden en la familia) |
| Buscar (⌘K) | `displayName`; una variante se encuentra por su etiqueta |
| Documentos (cotización y nota) y Ventas | Nombre del artículo = `displayName` del momento |
| Importar y copia de seguridad | Los respaldos viejos (sin `variant_label`) se importan y se normalizan igual que la migración; los nuevos salen con el campo |
| Compras (`04 §9`) | Sin cambios; si calcula por pieza, usa piezas, no familias |
| Panel neutro (`§2`) | Cero morado y cero “Quick Robot” en la interfaz; verificable con una prueba que busca los valores viejos en el CSS compilado |

**Fuera de alcance (no hacer):** agrupar variantes en los selectores de venta o pedido; subir logo del negocio; elegir el color de acento por negocio; fundir variantes en Reportes; cambiar fórmulas de costo o precio.

---

## 7. Fase A · Medir el rediseño

Solo se **lee** y se **mide**; no se cambia código de producción. Se escribe `docs/mejoras/informe-ronda2-a.md` con:

1. **Inventario** (tabla: archivo o componente → qué hace → qué cambia → qué prueba lo cubre) de todo lo que toca variantes (`parentId`), el listado de Productos (filtros, contadores, búsqueda, paginación), Existencias, Inicio (atenciones y rollos) y cada lugar de `§6`.
2. **Hoy contra maqueta, pantalla por pantalla:** componentes que se crean, cambian o se borran, y el estado de cada fila de `§6` (ya cumple / falta / riesgo).
3. **Morado y marca:** lista exacta de dónde se usa morado (tokens, componentes, gráficas, documentos, pruebas) y dónde aparece “Quick Robot” o la mascota en la interfaz.
4. **Datos:** cuántas variantes hay en la base de desarrollo y de qué tipo (cadenas, huérfanas, nombres con “(variante)”); confirmar que la migración de `§3.1` las cubre.
5. **Rendimiento de hoy** de Productos, Existencias e Inicio con la semilla de 500 piezas (tiempo de carga, consultas por pantalla, tamaño de la respuesta), como línea base para comparar después con los presupuestos de `15 §1`.
6. **Riesgos** y las decisiones que se proponen, cada una con la regla que la respalda.
7. **Plan de la fase B:** pasos en orden, cada uno con su commit y su prueba.

**Cierre de A:** el informe, commit y fusión (es solo documentación).

---

## 8. Fase B · Construir el rediseño

Orden de los pasos (un commit por paso; cada uno con su prueba antes de seguir):

| Paso | Qué |
|---|---|
| B1 | **Panel neutro:** tokens (`§2`), barra lateral con monograma, quitar morado y mascota; prueba que busca los valores viejos |
| B2 | **Datos y API:** `variant_label` y normalización a la raíz (migración aditiva), `displayName`, `PRODUCT_HAS_VARIANTS`, `GET /products` por familias, `GET /stock` por familias, `severity` de `GET /home` y `classifyAttention` en `core`. Pruebas de `core` (estado de familia, clasificación) y de cada operación de `12` |
| B3 | **Productos:** fichas, lista, panel de variantes, filtros, búsqueda, flujo de `§3.4` |
| B4 | **Existencias:** lista, fichas simplificadas, selector de vista, filtros por estado, cajón por miembro |
| B5 | **Inicio:** atención por prioridad, quitar rollos, reacomodo de columnas |
| B6 | **Textos** (`§9`), **pruebas de punta a punta** de los flujos de `§10`, comparación visual y documentos al día |

**Terminado cuando:** pasan todos los comandos de `§1.3.1`; cada fila de `§6` está cumplida con prueba; las tres pantallas se comparan con `reference/ronda-2/*.html` en 1440, 820 y 390 (estructura, textos, jerarquía y comportamiento; los radios y sombras son los del sistema) y se corrigen las diferencias; los tiempos no empeoran frente a la línea base de la fase A y siguen dentro de `15 §1`; `docs/progreso.md` marca las tres pantallas como “igual a la maqueta de la ronda 2”.

---

## 9. Textos nuevos (`es.ts`)

Van en `screens.*` y respetan `13 §1` (sin segunda persona en botones ni títulos). Los demás textos de estas pantallas **no cambian**.

| Clave | Texto |
|---|---|
| `products.variants.count` | `{count} {count\|variante\|variantes}` |
| `products.variants.panelTitle` | Variantes de {name} |
| `products.variants.original` | Original |
| `products.variants.new` | Nueva variante |
| `products.variants.addTo` | Agregar variante de {name} |
| `products.variants.add` | Variante |
| `products.variants.editorTitle` | Nueva variante de {name} |
| `products.variants.labelField` | Nombre de la variante |
| `products.variants.show` / `hide` | Ver variantes / Ocultar variantes (etiqueta accesible de la flecha) |
| `products.filter.withVariants` | Con variantes |
| `stock.view.cards` / `list` | Fichas / Lista |
| `stock.summary` | Total: {units} unidades de {pieces} {pieces\|pieza\|piezas} · Libres: {free} · Apartadas: {reserved} |
| `stock.filter.all` / `few` / `allReserved` / `ok` / `out` | Todas · Pocas · Todo apartado · Disponible · Agotadas |
| `stock.col.piece` / `state` / `free` / `reserved` / `total` / `listPrice` | Pieza · Estado · Libres · Apartadas · Total · Precio de lista |
| `stock.card.ofTotal` | de {total} en total |
| `stock.card.reserved` | {count} {count\|apartada\|apartadas} |
| `stock.card.variantsFree` | {count} {count\|variante\|variantes} · libres por variante |
| `home.attention.title` | Atención |
| `home.attention.group.urgent` / `soon` / `review` | Urgente · Esta semana · Para revisar |
| `home.attention.groupNote.urgent` | Bloquea una impresión o vence hoy o mañana |
| `home.attention.groupNote.soon` | Conviene resolverlo pronto |
| `home.attention.groupNote.review` | Sin prisa |
| `home.attention.filterAll` | Todas |
| `home.attention.showMore` | Ver las {count} restantes |
| `errors.PRODUCT_HAS_VARIANTS` | Esta pieza tiene {count} {count\|variante\|variantes}. Primero hay que eliminarlas. |
| `sidebar.businessPlaceholder` / `industryPlaceholder` | Mi negocio · Giro del negocio |

Se quitan de `es.ts` los textos que solo usaba la sección de rollos de Inicio, el “(variante)” del nombre y el filtro “Variantes”. `i18n.test.ts` debe seguir en verde (todo código de error nuevo tiene texto).

---

## 10. Pruebas de la fase B

Además de las de cada paso:
- **`core`:** estado de familia (los cuatro estados y el caso mixto de `04 §5`), `classifyAttention` (una prueba por tipo de atención y por frontera de fecha: vencido, hoy, mañana, en 2 días, en 3), nombre completo de variante.
- **Base de datos:** migración sobre una base con variantes en cadena, huérfanas y con “(variante)”; aislamiento entre negocios en las consultas nuevas.
- **API:** `GET /products` (familias, filtros, búsqueda en variante, paginación), `GET /stock` (familias, orden, estados), `GET /home` (`severity`), `PRODUCT_HAS_VARIANTS`; camino feliz, cada error y fallo a la mitad.
- **Punta a punta (Playwright, 1440 y 390):** crear una variante desde Productos y verla en su panel, en Existencias (suma de la familia) y en el selector de venta; vender una variante; abrir y cerrar el panel de variantes; cambiar entre Fichas y Lista en Existencias y que se recuerde; filtrar por estado; filtrar la atención de Inicio; que Inicio no muestre rollos; que no exista morado ni “Quick Robot” en pantalla.
- **Rendimiento:** con 500 piezas (50 familias con variantes), las tres pantallas dentro de `15 §1`.

---

## 11. Fase C · Medir los clics (D42)

**Meta:** todo flujo que se hace seguido debe costar el mínimo de clics. Esta fase **mide**; no cambia el producto. Entregables: `docs/mejoras/informe-ronda2-c.md` y las pruebas de medición en `apps/web/e2e/clicks/`.

### 11.1 Cómo se mide
- **Un clic** = un clic o toque. Abrir un selector cuenta 1. Teclear no cuenta, pero se anota cuántos campos hay que tocar con el mouse para enfocarlos.
- Cada flujo se recorre **por el camino normal** con un ayudante (`countedPage`) que cuenta los clics, y se anota el **mínimo posible** (lo que costaría si cada paso inútil desapareciera).
- Se mide en 1440 con la semilla normal. Cada medición queda como una prueba que **fija el número actual**.

### 11.2 Flujos que se miden (mínimo)
Nueva pieza completa (con filamentos e insumos) · agregar filamento a una pieza · agregar insumo · nueva variante · vender una pieza de existencias · registrar venta con varios artículos · nuevo pedido con cliente nuevo · poner en producción · marcar listo · entregar y cobrar · registrar abono · registrar impresión · agregar rollo · ajustar existencias · llevar existencias a una pieza · nuevo cliente · registrar gasto · registrar compra · cotizar. **Además**, la fase **busca por su cuenta** otros flujos con pasos de más (todo botón que abre un diálogo o una fila que luego pide otro clic) y los agrega a la tabla.

### 11.3 Qué patrones se buscan
| # | Patrón | Ejemplo y mejora |
|---|---|---|
| P1 | **Agregar y luego elegir** | “Agregar filamento” crea una fila vacía y hay que hacer otro clic para abrir su selector. **Debe crear la fila con el selector abierto y el foco dentro.** Igual en insumos, partes de colección, artículos de venta y pedido, rollos de un registro de impresión |
| P2 | **Sin foco inicial** | Al abrir un diálogo o página, el primer campo útil tiene el foco |
| P3 | **Teclado** | Enter envía el formulario; Esc cierra; Tab sigue el orden visual |
| P4 | **Valores por omisión** | Cantidad 1, fecha de hoy, el último canal usado, la impresora de la pieza, “Cobrado ahora” = total |
| P5 | **Pasos que son uno** | Diálogos intermedios que no deciden nada; acciones con “Deshacer” que además piden confirmar |
| P6 | **Seguir después de guardar** | “Guardar y vender”, “Guardar y agregar otra”; volver a donde se estaba |
| P7 | **Selectores** | Que abran al enfocar o al escribir, con búsqueda en los largos y lo reciente primero |
| P8 | **Zona de clic chica** | Que toda la fila o tarjeta abra el detalle, no solo un botón pequeño |
| P9 | **Crear sobre la marcha** | Si falta un cliente, filamento o color, crearlo desde el mismo selector sin salir |

### 11.4 Qué entra en el informe
Una tabla por flujo: **clics hoy · mínimo posible · ahorro · frecuencia (alta, media, baja) · riesgo (bajo, medio, alto) · decisión (hacer / no hacer) y por qué**. Se ordena por `ahorro × frecuencia ÷ riesgo`. **La mejora de P1 en “Agregar filamento” de la pieza nueva es obligatoria** y va marcada “hacer” aunque su puntaje sea bajo.

### 11.5 Límites (no se hace)
- No se quitan confirmaciones de acciones que mueven dinero o existencias (devolver una venta, cancelar un pedido, eliminar). La confirmación en dos toques de `13 §7` se queda.
- No se cambia ninguna regla de negocio ni se oculta información para ahorrar un clic.
- Todo debe seguir funcionando con teclado, sin depender de pasar el mouse, y con el foco visible.
- Nada de atajos secretos: lo que se acorta se acorta en la interfaz visible.

**Cierre de C:** informe y pruebas de medición, commit y fusión.

---

## 12. Fase D · Acortar los clics

Se hace **todo lo marcado “hacer”** en el informe de C, empezando por el mayor puntaje y llevando P1 primero. Por cada mejora:
1. Un commit con su cambio.
2. Su prueba de punta a punta, que **baja el número fijado** en la medición de C (el presupuesto de clics del flujo queda en `apps/web/e2e/clicks/budget.ts`; una regresión lo rompe).
3. El documento de pantallas (`06`) actualizado con el comportamiento nuevo.

**Terminado cuando:** pasan todos los comandos de `§1.3.1`; cada mejora “hacer” está hecha o marcada como bloqueada con razón; el informe `informe-ronda2-d.md` trae la tabla **antes y después** de cada flujo y lo que quedó pendiente; `docs/progreso.md` al día. Se fusiona como en `§1`.

---

## 13. Qué debe revisar la persona al terminar

Antes de abrir la versión nueva con los datos reales: **Ajustes › Descargar copia** y guardarla aparte (la migración agrega columnas y rellena etiquetas de variante; no borra nada). Después: abrir Productos, Existencias e Inicio y comprobar con las maquetas; crear una variante; agregar un filamento a una pieza nueva y contar los clics.
