# Informe de la ronda 2 · Fase A (medir el rediseño)

## Resumen
Se leyó el código que toca variantes, Productos, Existencias e Inicio, se compararon las pantallas actuales con las cinco maquetas de `reference/ronda-2/` y se midió la línea base con el juego de carga de 500 piezas. **No se cambió código de producción**: la única prueba temporal de medición se borró al terminar. Lo más importante para la fase B: hoy siete pantallas usan `GET /products` como catálogo plano, y paginarlo por familias las rompe (riesgo R1); el morado ya casi no se ve, pero sigue vivo en el anillo de foco, las casillas, las sombras y la mascota (20 lugares); e Inicio manda 2 616 atenciones (464 KB) con el juego de carga.

## Pasos
| Paso | Estado | Commit | Notas |
|---|---|---|---|
| Leer `CLAUDE.md`, `ronda-2.md` y los documentos de la lista | hecho | — | Los parches de documentos ya estaban aplicados (`01` D36–D45, `04 §5`, `05`, `06`, `07`, `12`, `13 §9.1`) |
| Inventario del código | hecho | — | §1 |
| Capturas de las maquetas y de la app (1440, 820 y 390) | hecho | — | Con `pnpm dev` (semilla del mockup); servidor detenido por PID |
| Barrido de morado (fuentes y estilos calculados en 20 pantallas) | hecho | — | §3 |
| Medición con 500 piezas | hecho | — | Prueba temporal en `packages/server/test/perf/`, borrada al terminar |
| Informe | hecho | lo hace la coordinación | Este archivo |

---

## 1. Inventario

### 1.1 Variantes (`parentId` / `parent_id`)
| Archivo o componente | Qué hace hoy | Qué cambia en B | Qué prueba lo cubre hoy |
|---|---|---|---|
| `packages/db/src/schema/product.ts` | `parent_id uuid` nulo, FK compuesta `product_parent_fk (workspace_id, parent_id)`. No hay `variant_label` ni índice por `parent_id` | Se agregan `variant_label text` (1–60, obligatoria si hay `parent_id`) y el índice `(workspace_id, parent_id)`, en la migración aditiva `0007` | `db/test/migrations.test.ts`, `db/test/tenancy.test.ts` |
| `packages/db/src/repos/product-repo.ts` | `listProducts` trae **todas** las piezas vivas (3 consultas); no hay consulta por familia | `listProductFamilies(ctx, {q, filter, page, pageSize})`: originales de la página y luego `parent_id IN (…)`; conteos `families · technical · withVariants` | `tenancy.test.ts` (solo lo de hoy) |
| `packages/server/src/usecases/products.ts` · `productList` | Lista plana; filtro `all\|technical\|variant` en memoria; la búsqueda mira nombre y etiquetas; `extrasFor` vuelve a llamar `listProducts` (consultas repetidas) | Página de familias (`12 §5`); filtro `with_variants`; la búsqueda incluye `variant_label`; `displayName` | `server/test/usecases/catalog.test.ts` (filtro `variant`) |
| `usecases/products.ts` · `saveProductAsVariant` | Crea una copia con `parentId = :id` **sin subir a la raíz** (editar una variante y “Guardar como variante nueva” crea una **cadena**). No pide etiqueta | Sube a la original raíz; `variantLabel` obligatoria; devuelve `displayName` | `catalog.test.ts` (crear, borrar, restaurar), `security/failure-midway.test.ts` |
| `usecases/products.ts` · `deleteProduct` | Deja borrar una original con variantes vivas (quedan **huérfanas** apuntando a una fila borrada) | `PRODUCT_HAS_VARIANTS` (409, `count`) | `catalog.test.ts` (sin el código nuevo) |
| `packages/server/src/views/costing.ts` · `productListView` / `setPartsOf` | Manda `parentId` y `parentName` (solo si la original está viva); las partes de una colección usan `p.name` | Vista de familia y `displayName` en partes de colección | `catalog.test.ts`, `core/test/golden*.test.ts` |
| `packages/contract/src/schemas/products.ts` | `productListItem` con `parentId`, `parentName`; no hay esquema de familia | `productFamily`, `productFamilyPage`, `variantLabel` en `saveProductInput` (solo para la variante) | Validación en las pruebas de rutas |
| `packages/server/src/routes/products.ts` | `filter` = `all\|technical\|variant`; `page()` devuelve todo en la página 1 (sin paginar) | `with_variants`, `page`, `pageSize`; ruta nueva para selectores (ver R1) | `security/access-matrix.test.ts` |
| `usecases/sell/common.ts` (líneas 84 y 100) | La foto del artículo guarda `name: p.name`; las partes de un set, `p.name` | Guardar `displayName` del momento | `server/test/usecases/sell.test.ts` |
| `usecases/sell/sales.ts:74`, `orders.ts` | Los nombres de `INSUFFICIENT_STOCK` salen de `p.name` | `displayName` | `sell.test.ts` |
| `usecases/sell/reports.ts` · `report().topProducts` | Una fila por pieza (las variantes ya van separadas ✓), con el **nombre actual** | Nombre = `displayName` actual | `dev-seed-sell.test.ts`, `perf/budget.test.ts` |
| `usecases/sell/reports.ts` · `search` | Busca en nombre, nota y etiquetas de la pieza | También `variant_label`; devuelve `displayName` | `dev-seed-sell.test.ts`, `security/injection-sell.test.ts` |
| `usecases/workspace-data.ts` + `db/repos/workspace-data-repo.ts` | Exporta todas las columnas; al importar mete primero las piezas sin padre y luego las demás (una cadena funciona dentro del mismo bloque de 5 000) | Respaldos sin `variant_label`: normalizar igual que la migración (raíz, huérfanas, etiqueta) | `usecases/workspace-data.test.ts`, `security/import-untrusted.test.ts` |
| `packages/server/src/dev-seed.ts` · `setParents` | Copia `padre` tal cual (sin raíz ni etiqueta) | Usar la misma normalización (etiqueta `silk morado`) | `server/test/dev-seed.test.ts` |
| `apps/web/src/features/products/ProductsPage.tsx` | Lista plana; filtro `variante` = `p.parentId`; insignia “Variante”; subtítulo “Variante de {name}” | Familias, panel (fichas), filas desplegables (lista) | e2e `workshop.spec.ts`, `flow-a-quick-sale.spec.ts`, `smoke-all.spec.ts` |
| `features/products/ProductEditor.tsx` | `?de=<id>` copia la pieza con nombre `"{name} (variante)"`; “Guardar como variante nueva” al editar llama `variant(editId)` (cadena si se edita una variante); el aviso “Variante de {name}” solo sale al crear | Flujo único de `§3.4`: título “Nueva variante de {pieza}”, campo “Nombre de la variante” enfocado, vuelve con el panel abierto | Ninguna prueba del flujo de variante en la web |
| `features/products/costing.ts`, `PieceResult.tsx` | `Draft.parentId`; la comparación “contra la original” usa `parent` | `variantLabel` en el borrador | Ninguna directa |
| `features/builder/*`, `sales/SaleDialogs.tsx`, `orders/OrderDialogs.tsx`, `orders/OrderPage.tsx`, `production/PrintRunDialog.tsx`, `products/CollectionEditor.tsx`, `settings/CsvExport.tsx` | Los siete usan `useProducts()` / `api.products.list()` como **catálogo plano** con `name` | Lista plana con `displayName`, ordenada por familia (ver R1) | e2e de flujos A–F, `workshop.spec.ts`, `production-stock.spec.ts` |
| `components/DocumentSheet.tsx` | Pinta `it.name` (la foto del artículo) | Nada: hereda el `displayName` guardado | e2e `flow-a`, `flow-d` |

### 1.2 Listado de Productos
| Elemento | Hoy | Debe quedar (`§3`, `12 §5`) |
|---|---|---|
| Datos | `GET /products` sin paginar: **500 piezas, 201.5 KB** con la carga | Página de 50 familias, dos consultas por página |
| Filtros | `Todas · Técnicas · Variantes`, contados **en el navegador** sobre piezas | `Todas · Técnicas · Con variantes`, `counts` del servidor sobre familias |
| Contador “Piezas N” | `products.length` (cuenta variantes) | Cuenta familias |
| Búsqueda | En el navegador, solo nombre | En el servidor (`q`), nombre y etiqueta de cada miembro y etiquetas; si coincide solo una variante, el panel se abre |
| Vista | `?vista=lista` en la URL (no se recuerda) | Igual; sin cambios en Productos |
| Paginación | No hay | Por familias; en pantalla, “Ver más” (no hay hoy un componente de paginación en la web) |

### 1.3 Existencias
| Archivo | Hoy | Debe quedar (`§4`, `12 §8`) |
|---|---|---|
| `usecases/sell/stock.ts` · `stockList` | Una fila por pieza con `tracksStock`; filtra por nombre; devuelve `items`, `totals { physical, free, reserved }`, `untracked` (329 nombres con la carga) y `sets`. Sin estado de familia, sin `status`, `sort` ni `counts` | Filas por familia con `members[]`, `status` (`04 §5` caso 5.3), `counts`, `totals { units, pieces, free, reserved }`, `sort` `free_asc` |
| `core/src/stock.ts` · `stockStatus` | Estado de una pieza (caso 5.2) | Más `familyStockStatus` (caso 5.3) |
| `features/stock/StockPage.tsx` | Solo fichas con **cuadritos** (`Cubes`), orden alfabético, sin filtros ni selector | Lista (por defecto) y fichas simplificadas, filtros por estado, buscador, orden por libres |
| `features/stock/StockDialogs.tsx` | Ajustar y “Llevar existencias” (usa `untracked`) | Sin cambios de fondo |
| `features/stock/api.ts` | Tipos escritos a mano (no hay esquema en `contract`) | Esquema en `packages/contract` (`14 §4`, contrato) |
| Cajón (`StockDrawer`) | Por pieza; toma los colores de `useStock().items` | Sigue por pieza; se abre desde la pieza simple o el miembro |

### 1.4 Inicio
| Archivo | Hoy | Debe quedar (`§5`) |
|---|---|---|
| `usecases/sell/reports.ts` · `home()` | Atenciones con `severity` = `bad \| warn \| info`; **todas** se mandan (2 616 con la carga) | `severity` = `urgent \| soon \| review` desde `core › classifyAttention` |
| `features/home/HomePage.tsx` | Dos columnas: izquierda “Piezas con más ganancia” + **Filamento** (rollos, pide `GET /filaments?pageSize=200`); derecha Atención (las primeras 6 + “Y N avisos más.”) e Impresoras. Ícono de aviso igual para todas; ignora `severity` | Atención a la izquierda, agrupada, con chips y contador; un ícono por tipo; 5 por grupo + “Ver las N restantes”; sin rollos; ya no pide `/filaments` |
| `features/reports/api.ts` | Tipo `Attention.severity: 'bad'\|'warn'\|'info'` | Tipo nuevo |
| `attentionView()` | Texto, botón y destino por tipo | Se conserva (los textos no cambian) |

---

## 2. Hoy contra maqueta, pantalla por pantalla

Capturas de comparación (no se suben al repositorio): maquetas a 1440 y 390; la app a 1440, 820 y 390 con la semilla del mockup.

### Productos (`productos-fichas.html`, `productos-lista.html`)
| Componente | Acción | Nota |
|---|---|---|
| `ProductTile` | **cambia** | Botón-píldora “N variantes ⌄” (`aria-expanded`); borde de acento cuando está abierta; se quita la insignia “Variante” y el botón “Variante” fantasma pasa a ser la acción “+ Variante” |
| `VariantsPanel` (fichas) | **se crea** | A todo el ancho bajo la fila de tarjetas, con muesca; original primero (“Original”); columnas Variante · Material · Costo · Precio · Ganancia · En existencia · Vendidas; Vender y Editar; uno abierto a la vez. Necesita saber cuántas tarjetas caben por fila (4 → 2 → 1) |
| `ProductTable` | **cambia** | Flecha a la izquierda solo en originales con variantes; filas hijas con guía; “+ Agregar variante de {pieza}” al final; columna de la pieza fija y desplazamiento horizontal; en 390 pasa a tarjetas |
| `VariantRow` / `VariantRowsBlock` | **se crea** | Compartido entre panel (con “Original”) y lista (sin repetirla) |
| Filtros y contadores | **cambia** | `Con variantes`; conteos del servidor |
| Barra de herramientas | **cambia** | En la app el buscador y “Fichas/Lista” se apilan en dos renglones a 1440; en la maqueta van en uno |
| Estados vacíos con `Mascot` | **cambia** | Sin mascota (§3) |
| Paginación “Ver más” | **se crea** | Nada parecido existe hoy |

### Existencias (`existencias-lista.html`, `existencias-fichas.html`)
| Componente | Acción | Nota |
|---|---|---|
| `Cubes` | **se borra** | Y sus estilos `.cubes`, `.cube`, `.cube.ap` |
| Ficha `.xc` | **cambia** | Foto, nombre, **impresora** (hoy `/stock` no la manda), chip, número grande de libres, “de {total} en total”, barra fina, “{n} apartadas” y precio; bloque “{n} variantes · libres por variante” |
| `StockTable` (lista) | **se crea** | Pieza · Estado · Libres (grande, color del estado) · Apartadas · Total · Precio de lista; flecha de familia; “›” solo en filas con movimientos propios |
| Selector Fichas \| Lista | **se crea** | Preferencia `view.stock`, por defecto Lista |
| Chips de estado con contador y buscador | **se crea** | Una familia cuenta una vez |
| Encabezado | **cambia** | `{piezas}` cuenta familias; hoy cuenta piezas (7 con la semilla; la maqueta enseña 6) |
| `StockDrawer` | igual | Sigue por pieza |

### Inicio (`inicio.html`)
| Componente | Acción | Nota |
|---|---|---|
| `Spools` (sección Filamento) | **se borra** | Y la petición `GET /filaments?pageSize=200` de Inicio |
| Columnas | **cambia** | Atención a la izquierda; Piezas e Impresoras a la derecha; en pantallas pequeñas: Atención, Piezas, Impresoras |
| `AttentionGroups` + chips `Todas · Urgente · Esta semana · Para revisar` | **se crea** | Punto y nota por grupo; 5 por grupo y “Ver las {n} restantes” |
| Ícono por tipo de atención | **cambia** | Hoy todas usan `warn`. `Icon` ya tiene `spool` (filamento), `list` (pedido), `coin` (cobro), `gear` (mantenimiento) y `box` (insumo); falta uno para precio y uno para copia de seguridad |
| Título con `Mascot` y “Todo en orden” con `Mascot` | **cambia** | Sin mascota |
| Resumen (“brief”), Piezas, Impresoras | igual | Mismo contenido |

### Barra lateral (todas las pantallas)
| Componente | Acción |
|---|---|
| `AppShell` (`.brand` y `.topbar`) | **cambia**: monograma (iniciales en caja `--panel-2`) + nombre y giro de Ajustes; “Mi negocio” / “Giro del negocio” en gris si faltan |
| `Monogram` | **se crea** |
| `Mascot` | **se borra** del panel (ver §3.2) |

### Estado de cada fila de `§6`
| Lugar | Estado | Dónde |
|---|---|---|
| Productos (fichas y lista) | **falta** | §2 Productos |
| Calculadora | **riesgo** | Hoy crea cadenas al guardar como variante desde una variante, escribe “(variante)” y no pide etiqueta; el aviso “Variante de…” no sale al editar una variante |
| Existencias (lista, fichas, cajón, encabezado) | **falta** (el cajón por pieza **ya cumple**) | §1.3 |
| Armar venta o pedido, selector | **falta** | Lista plana por `name`, orden de creación |
| Colecciones | **falta** (nombres); “sets armables” por pieza **ya cumple** | `setPartsOf` usa `p.name` |
| Producción (registrar impresión) | **falta** | `PrintRunDialog` usa `name` |
| Reportes e Inicio (“Piezas con más ganancia”) | **parcial**: cada variante ya va por separado ✓; falta `displayName` | `report().topProducts` |
| Buscar (⌘K) | **falta** | No mira `variant_label` (no existe) |
| Documentos y Ventas | **falta** | La foto guarda `p.name` |
| Importar y copia de seguridad | **falta** + **riesgo** | Sin normalización; los respaldos de esta semana pueden traer cadenas y huérfanas |
| Compras (`04 §9`) | **ya cumple** | Calcula por filamento e insumo; no usa familias |
| Panel neutro | **falta** + **riesgo** | Morado aún vivo en foco y casillas, mascota en 20 lugares; ninguna prueba lo vigila (§3) |

---

## 3. Morado y marca

### 3.1 Dónde hay morado
**Tokens (`apps/web/src/styles/tokens.css`)**
| Línea | Token | Valor | ¿Se ve hoy? |
|---|---|---|---|
| 7 | `--purple` | `#6b3fd4` | **Sí** (foco y casillas, abajo) |
| 7 | `--purple-soft` | `#efe9fd` | No: `mockup.css:990` lo redefine a `#eeeef2` |
| 11 | `--c-m`, `--c-l`, `--c-q`, `--c-t`, `--c-e` | `#4c28a8`, `#6b3fd4`, `#9b7de6`, `#c4b2f2`, `#e0d7f8` | No: `mockup.css:990` los redefine en grises (`#2d2d35`, `#5a5a65`, `#8b8b97`, `#b9b9c3`, `#dcdce3`) |
| 3 | comentario “lo morado es costo… morado #6b3fd4” | — | Texto que hay que corregir |

Hay **tres bloques `:root` fuera de `tokens.css`** (`mockup.css:990`, `:1027` `--sand`, `:1036` `--c-f: #d6a2ab`): incumple “todo el color en un solo archivo” (`07`). Además hay 37 colores hex escritos en `mockup.css`, `app.css` y `fatal.css`, y 7 en `.tsx` (`SpoolDialog` 2, `Piece3d` 1, `PurchasesPage` 1, `ReportsPage` 2, `StockPage` 1).

**Usos de `var(--purple*)` en `mockup.css`: 36 líneas.** La mayoría ya está tapada por el bloque “interfaz neutra” (`mockup.css:987–1033`). **Siguen morados en pantalla:**
| Línea | Regla | Efecto |
|---|---|---|
| 16 | `:focus-visible { outline: 2px solid var(--purple) }` | Anillo de foco de todo el panel (medido: `rgb(107, 63, 212)`) |
| 76 | `.unit:focus-within` | Foco de los campos con unidad |
| 97 | `.rad input:focus-visible + span` | Foco de los radios |
| 204 | `.title-f input:focus-visible` (borde) | Foco del nombre en la calculadora |
| 39 | `.switch input { accent-color }` | Interruptores |
| 330 | `.chk input { accent-color }` | Casillas (medido en `/productos/pieza`) |
| 464 | `.queue { --c: #b9a8ee }` (lavanda) | Etiquetas “en cola” de la línea de tiempo de impresoras |

Tapadas pero todavía escritas (se borran en B1): 11, 34, 67, 105, 121, 137, 194, 210, 235, 247, 268, 275, 312, 350, 396, 405, 407, 438, 463, 512, 666, 678, 723 (con `rgba(107, 63, 212, .12)`), 729, 781, 815, 846, 959, 962, 969.

**Sombras con tinte violeta** (casi negras, pero no neutras): `rgba(32, 26, 54, …)` en `mockup.css:133, 136, 672, 685, 728, 760, 761`; `rgba(20, 12, 40, …)` en `302, 562`; `rgba(25, 12, 60, .35)` en `300` (sombra de los diálogos y de la paleta ⌘K, medida en las 20 pantallas). Pasan a `rgba(18, 18, 20, …)`.

**Capas del desglose (`--c-*`), ya grises en pantalla:** `SalesBrief.tsx:16–17`, `PieceResult.tsx:17`, `CollectionEditor.tsx:108, 109, 116, 117`, `reports/Brief.tsx:69–70` (barra “De cada $100” de Inicio y Reportes), `ReportsPage.tsx:118, 212`, y en CSS `mockup.css:160, 182, 196, 545, 802, 1000, 1003, 1008, 1011, 1017, 1030, 1041, 1056, 1138, 1154, 1157`. En B1 basta con que `tokens.css` tenga los grises y se borren los morados: el dibujo no cambia. `--c-f` (fallos, `#d6a2ab` rosado), `--sand` (gastos) y `--blue` (comisiones) se quedan: la maqueta de Inicio los conserva.

**Documentos (`DocumentSheet.tsx`, `.doc*` en `mockup.css:1107–1130`):** sin morado; colores escritos a mano (`#121214`, `#6a6a73`, `#d2d2da`, `#ececf1`, `#44444c`). Conviene pasarlos a tokens.

**Página de falla (`apps/web/src/fatal`):** `fatal.css` usa solo tokens (hereda `--purple` si algo enfoca); `main.ts:62` pone la **mascota**.

**Colores de dato (no se tocan):** `core/src/catalog.ts:7` `Morado #7b4bd0`; el swatch del filamento “PLA Silk Morado” (medido en Productos, Filamentos, Producción, Reportes, Armar y Compras con estilo en línea); los `Piece3d` y cuadritos que pintan el color del filamento. **Dudoso:** `SpoolDialog.tsx:71` arranca el color de un filamento nuevo en `#6b3fd4` (el morado de la marca); se propone empezar en el primer color de la lista (D-6).

**Pruebas:** ninguna prueba busca morado hoy. `components.test.tsx:44–48` renderiza `Mascot` y comprueba su alto (se actualiza en B1).

### 3.2 Dónde aparece la marca
| Lugar | Qué | Qué hacer |
|---|---|---|
| `components/AppShell.tsx:46` y `:50` | `Mascot` en la barra superior (28 px) y en la barra lateral (40 px), en **todas** las pantallas | Monograma |
| `features/home/HomePage.tsx:69, 78, 95, 104` | Título de Inicio, “sin ventas”, “Todo en orden”, “sin impresoras” | Quitar (ícono neutro en “Todo en orden”) |
| `features/products/ProductsPage.tsx:62, 70, 129, 178` | Cuatro estados vacíos | Quitar |
| Un estado vacío en `BuilderPage:182`, `CustomersPage:48`, `ExpensesPage:46`, `FilamentList:41`, `OrdersPage:38`, `PrintersPage:44`, `ProductionPage:80`, `SalesPage:91`, `StockPage:79`, `SuppliesPage:52` | `Mascot` | Quitar |
| `fatal/main.ts:62` (solo escritorio) | Mascota | Quitar (D-5) |
| `apps/web/public/favicon.svg`, `favicon-32.png`, `apple-touch-icon.png` | Ícono de la pestaña = **mascota** con antenas `#6b3fd4` (igual a `assets/favicon.svg`) | Ícono neutro (D-4) |
| `styles/mascot.svg` | Copia de la mascota (antenas moradas) | Se borra con el componente |

**Total: 20 lugares que dibujan la mascota** (2 en el marco, 18 en pantallas) + página de falla + ícono de la pestaña.

**Texto “Quick Robot”:** **ninguno** en la interfaz escrita en código (se cumple la regla 6). Aparece solo como **dato**: el nombre del negocio de la semilla (Ajustes), que se ve en la barra lateral y en `document.title` (`app/Root.tsx:33`). En comentarios: `tokens.css:3`, `mockup.css:1`, `mockup.css:451`. Permitido (empaque y datos de ejemplo): `apps/desktop/package.json` (`author`), `apps/desktop/electron-builder.yml` (`appId mx.quickrobot.desktop`, `productName`, `executableName`), `packages/db/seed/quick-robot.ts` y su `exports` en `packages/db/package.json`, `packages/core/test/golden/mockup-values.json`. `phase3.test.tsx:106` ya comprueba que un texto no diga “Quick Robot”.

---

## 4. Datos

### 4.1 Base de desarrollo (`reference/mockup-backup-v7.json`)
| Dato | Valor |
|---|---|
| Piezas | 9 |
| Variantes (`padre`) | **1**: `pr10` “Spider-Man · salto (silk morado)” → `pr3` “Spider-Man · salto” |
| Familias | 1 (original + 1 variante; las dos llevan existencias) |
| Cadenas | 0 |
| Huérfanas | 0 |
| Nombres con “(variante)” | 0 |
| Etiqueta que da la regla de `§3.1` | `silk morado` → `displayName` “Spider-Man · salto · silk morado” |

La regla cubre este caso **solo si** al quitar el nombre de la original se quitan también los paréntesis que envuelven el resto; si no, la etiqueta queda “(silk morado)”. Se propone `variantLabelFromName` en `core` (R5).

### 4.2 Base real (no se leyó; se infiere del código)
Lo que la app de hoy pudo producir en la semana de uso, y por lo tanto la migración debe esperar:
| Caso | Cómo se produce hoy |
|---|---|
| Nombre “{original} (variante)” | El botón “Variante” (`?de=`) prellena `variantName = '{name} (variante)'` |
| **Cadena** (variante de variante) | Editar una variante y pulsar “Guardar como variante nueva” llama `POST /products/{idDeLaVariante}/variant` |
| **Huérfana** | Eliminar una original con variantes está permitido |
| Nombre que no empieza con el de la original | La persona cambió el nombre prellenado |
| Dos variantes con la misma etiqueta | Dos copias sin renombrar (“X (variante)” dos veces → las dos quedan “Variante”) |

### 4.3 Casos raros para la prueba de migración (y de importación)
1. Variante de variante (cadena de 2 y de 3 niveles) → `parent_id` = raíz.
2. Variante cuya original está borrada (`deleted_at`) → `parent_id` nulo, etiqueta vacía, pieza independiente.
3. Cadena cuya raíz está borrada pero el eslabón intermedio no → el intermedio pasa a ser la original.
4. Nombre con “(variante)” y sin más texto → etiqueta “Variante”.
5. Nombre sin “(variante)” y con texto propio (“Spider-Man · salto (silk morado)”) → “silk morado”.
6. Nombre que no empieza con el de la original → etiqueta = nombre completo sin “(variante)” (se marca para revisión).
7. Original cuyo nombre contiene “·” (“Spider-Man · salto”): no se parte el nombre por “·”.
8. Mayúsculas y acentos distintos entre los dos nombres (comparación con `normalizeName`).
9. Etiqueta resultante de más de 60 caracteres → se recorta a 60.
10. Dos variantes con la misma etiqueta → se permite.
11. Variante borrada (`deleted_at`) de una original viva → también recibe etiqueta (por si se restaura).
12. Dos negocios con los mismos nombres → cada uno se normaliza solo con sus filas.
13. Ningún `name` cambia (se compara antes y después).

### 4.4 `severity` de Inicio
Hoy `home()` usa `bad | warn | info`. Los valores nuevos no repiten ninguno de los viejos, así que no hay riesgo de que uno quede con otro sentido.
| Atención (`kind`) | Hoy | Nuevo (`§5`) |
|---|---|---|
| `order_filament_short` | `bad` | `urgent` |
| `order_due` vencido (`days < 0`) | `bad` | `urgent` |
| `order_due` hoy o mañana (`days` 0–1) | `warn` | `urgent` |
| `order_due` en 2 días | `warn` | `soon` |
| `sale_owed` | `info` | `soon` |
| `filament_low` (≤ 150 g; `bad` si ≤ 0.5 g) | `warn` / `bad` | `soon` |
| `supply_low` (`bad` si agotado) | `warn` / `bad` | `soon` |
| `maintenance` (`bad` si “Toca ya”) | `warn` / `bad` | `review` |
| `price_below_floor` (pieza o colección) | `warn` | `review` |
| `backup` | `warn` | `review` |

Hoy la web **no usa** `severity` (todas llevan el mismo ícono), así que el cambio de valores solo toca `features/reports/api.ts` y la pantalla nueva.

---

## 5. Rendimiento de hoy (línea base)

**Cómo se midió:** la carga de `packages/db/seed/load-test.ts` (semilla del mockup + 500 piezas, 25 000 ventas…), la misma base guardada que usa `pnpm perf`; una prueba temporal llamó cada ruta 1 + 1 + 9 veces y contó las consultas SQL envolviendo `query`/`exec` del cliente PGlite. Medido en el contenedor de trabajo (Linux), no en una Mac: sirve para comparar antes y después, no como cifra absoluta. Con 9 corridas, el p95 es la más lenta. La prueba se borró.

| Ruta | p95 | Mediana | Consultas SQL | Respuesta | Elementos | Presupuesto (`15 §2`) |
|---|---|---|---|---|---|---|
| `GET /products` | **329 ms** | 254 ms | 24 | **201.5 KB** | 500 piezas (1 variante) | 300 ms → **1.10×** |
| `GET /collections` | 261 ms | 221 ms | 20 | 0.8 KB | 2 | 300 ms → 0.87× |
| `GET /stock` | 143 ms | 115 ms | 14 | 58.2 KB | 171 filas (+ 329 en `untracked`, 2 sets) | 300 ms → 0.48× |
| `GET /home` | **423 ms** | 385 ms | 33 | **464.2 KB** | **2 616 atenciones** | 400 ms → **1.06×** |
| `GET /reports?period=30` | **502 ms** | 392 ms | 32 | 120.1 KB | — | 400 ms → **1.26×** |
| `GET /printers` | 123 ms | 99 ms | 6 | 7.3 KB | 22 | 300 ms → 0.41× |
| `GET /filaments?pageSize=200` | 46 ms | 39 ms | 3 | 37.3 KB | 157 | 300 ms → 0.15× |
| `GET /search?q=pieza` | 197 ms | 187 ms | 15 | 3.4 KB | — | 200 ms → 0.99× |

Atenciones de `/home` con la carga: `sale_owed` 2 536 · `order_due` 65 (59 vencidos) · `price_below_floor` 8 · `maintenance` 2 · `supply_low` 2 · `order_filament_short` 1 · `filament_low` 1 · `backup` 1.

**Por pantalla** (PGlite atiende una consulta a la vez, así que el tiempo de la pantalla se acerca a la suma):
| Pantalla | Peticiones al abrir | Suma de p95 | Transferido |
|---|---|---|---|
| Productos | `/products` + `/collections` | ≈ 590 ms | ≈ 202 KB |
| Existencias | `/stock` (la pide dos veces: la página y el cajón comparten la clave, pero se vio repetida al navegar) | ≈ 143 ms | ≈ 58 KB |
| Inicio | `/home` + `/reports?period=30` + `/printers` + `/filaments?pageSize=200` | ≈ 1 090 ms | ≈ 629 KB |

Con la semilla pequeña del mockup en el navegador (`pnpm dev`), las tres pantallas muestran su contenido en unos 90–115 ms (mediana de 5 navegaciones).

**Lo que ya pasa de 1× antes de tocar nada:** `/products` (1.10×), `/home` (1.06×), `/reports?period=30` (1.26×). Ninguno pasa de 2×, así que `pnpm perf` sigue en verde; se anota aquí como dice `15 §2`.

**El juego de carga no tiene familias** (solo la variante de la semilla). Se propone que B2 agregue a `load-test.ts`, sin subir el total de 500 piezas: 50 de las “Pieza de carga” pasan a ser originales y 125 a ser variantes suyas (de 1 a 4 por familia, ~1/3 con existencias, etiquetas “Variante {n}”), con lo que quedan ≈ 375 familias. Cambiar `load-test.ts` cambia la llave de la base guardada y la regenera sola (unos minutos). Los casos raros de §4.3 van en la prueba de migración, no en la carga.

---

## 6. Riesgos y decisiones propuestas

| # | Riesgo | Decisión propuesta | Regla que la respalda |
|---|---|---|---|
| R1 | Siete pantallas (armar venta, diálogos de venta y pedido, pedido, registrar impresión, colección, exportar CSV) usan `GET /products` como catálogo plano. Paginar por familias (máx. 200 por página) los deja sin piezas | **D-1:** operación nueva `GET /products/options` (lista plana completa: `id`, `displayName`, `parentId`, `listCents`, `costCents`, `free`, `tracksStock`, `hours`, `hexes`, `collections`, ordenada por familia con la original primero). Se agrega a `12 §5` antes de programarla, con su fila en la matriz de acceso | `15 §3.1` (los selectores sí traen el catálogo completo); `CLAUDE.md` › “una operación nueva se agrega a 12”; `§6` fila “Armar venta” |
| R2 | `/home` manda todas las atenciones (2 616, 464 KB con la carga) y “Ver las N restantes” las pintaría todas | **D-2:** el servidor sigue mandando todas (`§5.5` “se muestran todas”); la web pinta 5 por grupo y al expandir pinta en tandas de 50 con “Ver las N restantes” hasta acabar; nunca más de 200 filas sin virtualizar. Se marca para revisión si la carga real lo pide | `ronda-2 §5.5`, `15 §3.7` |
| R3 | La base real puede tener cadenas, huérfanas y “(variante)” (§4.2) | Migración `0007` aditiva: columna, índice, raíz, huérfanas y etiquetas; probada con los 13 casos de §4.3; la copia previa ya la hace `migrate-local` (`server/src/local.ts:23`) | `ronda-2 §1.6`, `§3.1`, D44 |
| R4 | Limpiar el `parent_id` de una huérfana hace que, si después se restaura su original, las variantes **no** vuelvan a ligarse | Aceptarlo (lo pide `§3.1`) y anotarlo en `decisiones.md`; marcar para revisión | `ronda-2 §3.1` |
| R5 | La etiqueta sale de un texto libre: paréntesis, “·” en el nombre de la original, acentos, más de 60 letras | **D-3:** función pura `variantLabelFromName(name, originalName)` en `core` (quita el nombre de la original al inicio comparando con `normalizeName`, los separadores ` ·-–—:/,`, los paréntesis que envuelven el resto y “(variante)”; recorta a 60; vacío → “Variante”). La importación y la semilla la usan; la migración hace lo mismo en SQL y una prueba compara las dos salidas con los casos de §4.3 | `CLAUDE.md` regla 3; `ronda-2 §3.1` |
| R6 | La semilla de desarrollo se llama “Quick Robot” (dato de Ajustes): la prueba “que no exista ‘Quick Robot’ en pantalla” (`§10`) fallaría por un dato legítimo | La prueba e2e cambia primero el nombre del negocio en Ajustes y después revisa que ningún texto ni `img` diga “Quick Robot” o sea la mascota | `CLAUDE.md` regla 6; `§2` |
| R7 | Tokens repartidos (3 bloques `:root` en `mockup.css`, 37 hex en CSS y 7 en `.tsx`); al moverlos puede cambiar el dibujo de otras pantallas | B1 mueve todos los valores a `tokens.css` **con los valores que hoy se ven** (los grises del bloque neutro) y compara en tres anchos **todas** las pantallas del menú, no solo las tres | `07`, D37; `CLAUDE.md` › comparación visual |
| R8 | Nadie vigila el morado | Dos pruebas: (a) unitaria sobre los estilos fuente y los `.tsx` (ningún valor viejo de §3.1 ni `--purple`); (b) e2e que recorre las pantallas y revisa los colores calculados (como el barrido de esta fase), dejando fuera los colores de dato | `ronda-2 §6` última fila |
| R9 | `/stock` y `/home` no tienen esquema de salida en `packages/contract` (los tipos viven en la web) | Crear `stockPage` y `homeOutput` en `contract` en B2 | `14 §4` (contrato) |
| R10 | `GET /stock` de hoy no trae la impresora (la maqueta la pinta) | Agregar `printerName` a cada fila y miembro (dato que ya existe; no es regla nueva) | Maqueta `existencias-*.html`; `ronda-2 §4.3` |
| R11 | Preferencia `view.stock`: no hay mecanismo de preferencias (Productos usa `?vista=` en la URL) | **D-7:** `?vista=` en la URL y, sin ella, `localStorage['view.stock']` (con `try/catch`); por defecto Lista | `06 §10`; la opción más simple |
| R12 | Inicio pasa de 1× hoy (`/home` 1.06×, `/reports?period=30` 1.26×) | No empeorar: quitar `/filaments` de Inicio; `classifyAttention` no agrega consultas; medir en B6 | `15 §2`, `ronda-2 §8` “Terminado cuando” |
| R13 | `/products` ya pasa de 1× y hace 24 consultas (`extrasFor` vuelve a cargar todas las piezas y `sold` recorre todas las ventas) | En B2 la página de familias carga costeo, existencias y vendidas solo de los ids de la página | `ronda-2 §3.1` “dos consultas por página”; `15 §3` |
| R14 | Estado “Pocas” de una familia (D40) | Se implementa como dice `04 §5` caso 5.3; ya está marcado para revisión de la persona | D40 |
| R15 | **D-4:** el ícono de la pestaña es la mascota morada | Ícono neutro (cuadro `--ink` sin letras) en `apps/web/public`; `assets/` no se toca | `§2` “Marca” |
| R16 | **D-5:** la página de falla del escritorio muestra la mascota | Quitarla (la página la construye `apps/web`) | `§2` “no aparecen en pantallas” |
| R17 | **D-6:** `SpoolDialog` arranca en `#6b3fd4` | Arrancar en el primer color de `DEFAULT_COLORS` | `§2` (ningún valor de la marca en la interfaz) |
| R18 | Las pruebas e2e que hoy dependen de lo que se va: `home-reports-expenses.spec.ts:18` (“Y 3 avisos más.”), `production-stock.spec.ts` (`stock-card`), `components.test.tsx:48` (alto de la mascota) | Se actualizan en el mismo paso que cambia cada pantalla; ninguna se salta | `CLAUDE.md` › “Nunca: saltarse una prueba” |
| R19 | “Buscar” con un solo panel abierto en Fichas cuando el texto solo coincide con una variante | Hacerlo; si complica el componente, dejar cerrado y anotarlo (lo permite `§3.1`) | `ronda-2 §3.1` |

---

## 7. Plan de la fase B

Un commit por paso; cada paso con su prueba en verde antes de seguir. Los documentos (`04`, `06`, `12`, `13`) se tocan en el mismo commit que el cambio de comportamiento.

### B1 · Panel neutro
| Paso | Commit | Prueba |
|---|---|---|
| B1.1 | `refactor(web): every interface color in tokens.css; add --accent, --cost, --cost-soft; drop purple tokens and tinted shadows` | Nueva `apps/web/src/styles/tokens.test.ts`: ningún `--purple`, `#6b3fd4`, `#efe9fd`, `#4c28a8`, `#9b7de6`, `#c4b2f2`, `#e0d7f8`, `#b9a8ee`, `rgba(107,63,212`, `rgba(32,26,54`, `rgba(20,12,40`, `rgba(25,12,60` en `styles/`, `fatal/` ni `.tsx`; ningún `:root` fuera de `tokens.css`. Comparación visual de todas las pantallas del menú en 1440, 820 y 390 |
| B1.2 | `feat(web): focus ring and checkbox accent use --accent` | Unitaria: `:focus-visible` usa `--accent`; e2e: foco calculado = `--accent` |
| B1.3 | `feat(web): neutral sidebar with business monogram` (`Monogram`, `initialsOf` en `web/lib`, textos `sidebar.*`) | `lib.test.tsx` (iniciales: una palabra, dos, acentos, vacío); `components.test.tsx` (marcador “Mi negocio” en gris) |
| B1.4 | `feat(web): remove the mascot from screens, empty states, fatal page and favicon` | `components.test.tsx` y `fatal.test.ts` actualizados; `smoke-all.spec.ts`: ninguna `img.mascot` |

### B2 · Datos y API
| Paso | Commit | Prueba |
|---|---|---|
| B2.1 | `feat(core): variant display name and label from a legacy name` | `core/test/catalog.test.ts`: los 13 casos de §4.3 que aplican a nombres |
| B2.2 | `feat(core): family stock status (case 5.3)` | `core/test/sell.test.ts`: los cuatro estados del caso 5.3 y el mixto |
| B2.3 | `feat(core): classifyAttention by kind and due date` | Una prueba por tipo y por frontera: vencido, hoy, mañana, 2 y 3 días |
| B2.4 | `feat(db): variant_label and variants normalized to the root (additive migration 0007)` | Nueva `db/test/migration-variants.test.ts` (aplica 0000–0006, siembra §4.3, aplica 0007); paridad SQL ↔ `variantLabelFromName`; `migrations.test.ts`, `migrate-local.test.ts` |
| B2.5 | `feat(db): product family page queries` | `tenancy.test.ts` con las consultas nuevas; prueba de que la página usa 2 consultas de piezas |
| B2.6 | `feat(server): GET /products by families with counts, filters and search in variants` (+ `12 §5` y `contract`) | `catalog.test.ts`: familias, `with_variants`, búsqueda que solo coincide con una etiqueta, paginación; `access-matrix.test.ts` |
| B2.7 | `feat(server): GET /products/options flat list for pickers` (D-1, primero en `12`) | `catalog.test.ts` (orden por familia, `displayName`); `access-matrix.test.ts` |
| B2.8 | `feat(server): saveProductAsVariant goes to the root and requires variantLabel; PRODUCT_HAS_VARIANTS` (+ `12`, `13`) | Camino feliz, desde una variante (sube a la raíz), cada error, `failure-midway.test.ts`; `i18n.test.ts` |
| B2.9 | `feat(server): displayName in item snapshots, collections, search, reports and stock errors` | `sell.test.ts` (la venta guarda `displayName`; cambiar la etiqueta no reescribe la venta), búsqueda por etiqueta, `topProducts` |
| B2.10 | `feat(server): GET /stock by families with status filter, sort, counts and printer` (+ `contract`) | `sell.test.ts`: familias, orden por libres, cada estado, `pieces` cuenta familias; `access-matrix.test.ts` |
| B2.11 | `feat(server): home severity urgent, soon and review` (+ `contract`) | `dev-seed-sell.test.ts` y prueba nueva de `severity` por tipo |
| B2.12 | `feat(server): import and dev seed normalize variants like the migration` | `workspace-data.test.ts` (respaldo viejo sin `variant_label` con cadena y huérfana), `import-untrusted.test.ts`, `dev-seed.test.ts` (etiqueta `silk morado`) |
| B2.13 | `test(perf): load set with 50 variant families; budgets for /products, /stock, /home` | `perf/budget.test.ts` con `PERF=1` contra la línea base de §5 |

### B3 · Productos
| Paso | Commit | Prueba |
|---|---|---|
| B3.1 | `feat(web): pickers use /products/options with displayName` (armar, diálogos, pedido, registrar impresión, colección, CSV) | e2e de flujos A–F y `workshop.spec.ts` |
| B3.2 | `feat(web): product tiles grouped by family with the variants panel` | e2e: abrir y cerrar el panel, uno a la vez, 1440 y 390 |
| B3.3 | `feat(web): product list with expandable variant rows` | e2e: flecha, “+ Agregar variante de …”, tarjetas en 390 |
| B3.4 | `feat(web): Con variantes filter, family counters, server search and Ver más` | e2e: buscar por etiqueta abre el panel; contador “Piezas N” |
| B3.5 | `feat(web): one new-variant flow from every entry point` (`?variante=<id>`, título, campo enfocado, vuelve con el panel abierto) | e2e: crear una variante y verla en su panel |

### B4 · Existencias
| Paso | Commit | Prueba |
|---|---|---|
| B4.1 | `feat(web): stock list view with families and the view selector` | e2e: Lista por defecto, cambiar a Fichas y que se recuerde |
| B4.2 | `feat(web): simplified stock cards without cubes` | e2e: número grande y barra; comparación visual |
| B4.3 | `feat(web): stock status filters, search and free-first order` | e2e: filtrar por estado, una familia cuenta una vez |
| B4.4 | `feat(web): drawer opens from a simple piece or a family member` | `production-stock.spec.ts` actualizado |

### B5 · Inicio
| Paso | Commit | Prueba |
|---|---|---|
| B5.1 | `feat(web): attention grouped by priority with filters and show more` (+ íconos de precio y copia en `Icon`) | e2e: filtrar, “Ver las N restantes”; `home-reports-expenses.spec.ts` actualizado |
| B5.2 | `feat(web): remove the filament rolls from Inicio and reorder columns` | e2e: Inicio no muestra rollos ni pide `/filaments` |

### B6 · Textos, pruebas de punta a punta y cierre
| Paso | Commit | Prueba |
|---|---|---|
| B6.1 | `feat(web): ronda 2 texts in es.ts; remove the roll, "(variante)" and "Variantes" texts` | `i18n.test.ts` |
| B6.2 | `test(e2e): ronda 2 flows` (los de `§10`) | Playwright en 1440 y 390 |
| B6.3 | `test(e2e): no purple and no brand on screen` (R6, R8) | Barrido de colores calculados en todas las pantallas |
| B6.4 | `docs: ronda 2 phase B report and progress` | Comparación visual de las tres pantallas (1440, 820, 390), tiempos contra §5, todos los comandos de `§1.3.1` |

---

## Pruebas
- Esta fase no cambió pruebas ni código de producción.
- Medición: una prueba temporal (`PERF=1`) sobre la base guardada de `pnpm perf`; resultados en §5; el archivo se borró.
- No se corrieron `pnpm test`, `lint`, `typecheck`, `e2e` ni `security`: no hay cambios que verificar.

## Decisiones tomadas
Ninguna se aplicó. Se **proponen** D-1 a D-7 y las de §6; la fase B las anota en `docs/decisiones.md` cuando las aplique.

## Bloqueado o dudoso
- No se leyó la base real (no se debe): la cantidad de cadenas, huérfanas y nombres con “(variante)” es una inferencia del código (§4.2).
- R2 (cuántas atenciones se pintan al expandir) y R4 (variantes que no se vuelven a ligar al restaurar una original) conviene que los vea la persona.
- `/reports?period=30`, `/home` y `/products` ya pasan de 1× su presupuesto antes del rediseño (sin llegar a 2×).

## Qué conviene que revise la persona
1. **Ajustes › Descargar copia** antes de abrir la versión con la migración.
2. Si está de acuerdo con D-1 (selector con su propia ruta) y D-4 (ícono de pestaña neutro).
3. Si le sirve que “Pocas” marque la familia cuando **una** variante está baja (D40).
4. Si en su base hay variantes cuyo nombre no empieza con el de la original: su etiqueta será el nombre completo y conviene renombrarlas después.

## Cómo probarlo
```
git switch ronda2-a-medicion
less docs/mejoras/informe-ronda2-a.md
pnpm perf          # línea base con la carga (los tiempos de §5 salen de la misma base)
pnpm dev           # abrir /productos, /existencias e /inicio y compararlas con reference/ronda-2/*.html
```
