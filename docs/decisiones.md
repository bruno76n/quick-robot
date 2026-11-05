# Decisiones tomadas durante la construcción

Registro que llena Claude Code en modo autónomo. Una entrada por decisión. No se borra nada.

Formato:

```
## AAAA-MM-DD · Fase N · Paso N.N · Título corto
- Situación: qué no estaba claro o qué falló.
- Opciones consideradas.
- Decisión y por qué (qué regla de CLAUDE.md la respalda).
- Impacto: archivos o documentos afectados.
```

---

## 2026-11-01 · Planeación · Decisiones previas a la construcción
Ver `01-vision-y-decisiones.md` (D1–D21).

## 2026-11-01 · Planeación · Cierre de la planeación de las fases 1 a 4
Se agregan los documentos 12 al 15, `prompts.md`, `reference/mockup-textos.md`, `assets/` y los valores esperados del mockup. Decisiones D22–D29 en `01` (las D30–D35 vienen de la revisión de coherencia, más abajo). Cambios que se hicieron al revisar la coherencia de todo el conjunto:
- **Tablero de pedidos:** `06` solo describía Lista y Calendario; el mockup abre por defecto en **Tablero** (4 columnas). Se agregó a `06 §5` y a los pasos 3.4 de `10`.
- **Canales por id:** `05` guardaba el nombre del canal en ventas y pedidos; ahora `channel_id` (D27). Se agregó el caso de uso `updateChannel`.
- **Pedido siempre con cliente:** `order.customer_id` obligatorio (el mockup lo exige).
- **Foto de la pieza:** faltaba `product.photo_file_id` en `05`.
- **Última copia descargada:** `workspace_settings.last_backup_on` (alimenta la atención de Inicio).
- **Copias automáticas:** nueva dependencia inyectada `BackupStore` (una por día, últimas 7) en `02`, `08`, `10`.
- **Pantallas de falla de Electron:** `apps/desktop/src/fatal.html`, porque si el servidor cae la interfaz no se puede cargar.
- **Secreto local:** pasa de "lo lee la interfaz" a "lo agrega Electron como encabezado" (D29).
- **Valores internos en inglés** (estados, motivos, tipos de movimiento): tabla en `03`.
- **Acciones del mockup sin documentar:** `variante` e `imp-del` agregadas a `06`.
- **Filtros reales del mockup:** Productos (Fichas/Lista; Todas/Técnicas/Variantes) y Producción (sin filtro "Fallos") corregidos en `06`.
- **Informe de fase:** `docs/informe-fase-N.md` (antes `10` mencionaba otro nombre).
- Dependencias nuevas anotadas: `fast-check` (solo pruebas, `14`); ninguna en tiempo de ejecución.

## 2026-11-01 · Planeación · Revisión de coherencia del paquete completo
Claude Code leyó el zip entero y encontró contradicciones; todas se verificaron y se corrigieron (D30–D35 en `01`):
- **Logo con “Quick Robot”** contra la regla 6: la barra lateral y los documentos escriben el nombre y el giro de Ajustes; el logo con texto queda solo para uso externo.
- **Tablas hijas sin `workspace_id`** (`product_filament`, `product_supply`, `collection_part`, `print_run_filament`): ahora lo llevan, con clave foránea compuesta.
- **“Deshacer” sin operación:** se agregan `restoreSupply`, `restoreSupplier` y `restorePrinter`. Devolver una venta y cancelar un pedido dejan de ofrecer “Deshacer” (no había operación ni regla para revertir dinero y existencias).
- **Avisos con parámetros que la API no mandaba:** `FILAMENT_SHORTFALL` usa `{missingGrams}` y `{name}`; `ORDER_WAITING_OTHER_PRINTERS` manda `orderNumber` y `printerNames[]`. Regla de llenado en `13 §4`.
- **Estados sin regla:** el mockup calculaba “Se acaba”, “Nuevo”, “Todo apartado”, “Pocas”, etc. solo en código; ahora están en `04` (casos 1.3 y 5.2), `03` y `13 §8`. “Disponible” no es un estado de filamento.
- **Parámetros de los errores:** `PAYMENT_EXCEEDS_BALANCE`, `REFUND_EXCEEDS_PAID` y `PRINTER_ASSIGNMENT_REQUIRED` usaban parámetros que la API no mandaba; ahora el parámetro se llama igual que el campo de `details` y se formatea por su sufijo (`13 §2`).
- Menores: `FILE_TOO_LARGE` dice “archivo” (también sirve para copias), paquetes `@app/*`, rol `operator`, y la segunda persona queda como regla única en `13 §1`, `06` y `CLAUDE.md`.

## 2026-11-01 · Planeación · Segunda lectura del paquete v2
Claude Code leyó la v2 completa: confirmó que las 9 contradicciones estaban resueltas y encontró 3 menores nuevas, que se corrigieron antes de empezar la fase 1:
- **Unidad repetida:** `SPOOL_INSUFFICIENT` escribía “g” después de `{availableGrams}`, que ya se formatea con su unidad. Regla nueva en `13 §2`: la unidad nunca va en el texto; `i18n.test.ts` lo comprueba.
- **Sintaxis de `t()`:** había plurales sin nombre (`{count} {pieza|piezas}`) y elecciones sin definir (`{entregado|cancelado}`). Ahora hay tres formas explícitas (valor, plural, elección) y todos los textos se reescribieron con ellas.
- **Referencia:** el límite de 100 MB de las copias está en `15 §4`, no en `§3` (corregido en `12` y `07`).

## 2026-11-02 · Fase 1 · Paso 1.0 · Comprobación de PGlite: pasa
- Situación: `02 §4` pide comprobar PGlite antes de construir (5 criterios). Carpeta `spikes/pglite/`, resultados en `spikes/pglite/results/`.
- Entorno: Linux x64, 4 CPU, Node 22.23. PGlite 0.5.10; Postgres 16 nativo para comparar.
- Resultados (p95, archivo en disco):
  1. Mismas migraciones en PGlite y Postgres 16: **pasa** (la misma carpeta generada por drizzle-kit se aplica en los dos sin cambios).
  2. Ventas por pieza, 12 meses, 5 000 ventas: **17.7 ms** (< 200 ms). "Todo" con 25 000 ventas / 48 973 artículos: **53.5 ms** (< 1.5 s). Al reabrir: 38.6 ms. Postgres nativo: 23.5 / 40.4 ms. **Pasa.**
  3. Cierre forzado: 8 rondas de `kill -9` en medio de transacciones de 100 filas (hasta 56 100 filas): 0 lotes a medias, todo lo confirmado está, conteo por índice = conteo por tabla. **Pasa.**
  4. PGlite dentro de Electron 38 empaquetado (electron-builder, asar): abre, crea, escribe; la segunda apertura relee los datos (1 → 2 filas). Primera apertura 8.6 s (crea la base), segunda 0.7 s. **Pasa en Linux**; el empaquetado para Mac no se puede probar aquí (sin macOS) y queda para la fase 4.
  5. RLS con `FORCE ROW LEVEL SECURITY`, rol sin privilegios y `set_config('app.workspace_id')`: A no ve, no modifica ni inserta en B; sin el ajuste no ve nada. **Pasa** en PGlite y en Postgres.
- Decisión: se mantiene Postgres en los dos modos (PGlite en local). No hace falta el plan B. El filtro por `workspace_id` en los repositorios es la barrera principal; RLS queda viable como segunda barrera y se activa en la fase 5 (en local hay un solo negocio).
- Impacto: crear la base por primera vez tarda 4–8 s (initdb en WASM): la fase 4 debe mostrar "Preparando datos…" o partir de una base creada.

## 2026-11-02 · Fase 1 · Paso 1.1 · Herramientas del monorepo
- Situación: `10 §1.1` pide `vitest.workspace.ts`; en Vitest 4 ese archivo ya no existe (se reemplazó por `test.projects`).
- Decisión: `vitest.config.ts` en la raíz con `projects: ['packages/*', 'apps/*', 'tools']` y los umbrales de cobertura de `14 §4` por carpeta. `pnpm test` corre con cobertura. Regla 3 de "cuando algo no está claro": la opción más simple.
- Versiones (A03): solo versiones con más de dos semanas publicadas al 2026-11-02, fijadas exactas. TypeScript 5.9.3, Vitest 4.1.12, Vite 7.3.7 (fijado con `overrides` porque Vitest pedía Vite 8, publicado hace menos de dos semanas), ESLint 9.39.5, typescript-eslint 8.71.2, dependency-cruiser 17.4.3, fast-check 4.10.2 (solo pruebas, `14 §5`), cross-env 10.1.0 (para `pnpm test:tz`), tsx 4.23.15. `@playwright/test` 1.63.0 para usar el navegador ya instalado en este entorno.
- Las pruebas de seguridad del servidor (`packages/server/test/security/`) se crean en el paso 1.5, cuando existe el servidor; `pnpm security` las incluye en cuanto la carpeta existe.
- Prueba negativa de fronteras: `packages/core/test/fixtures/forbidden-import.ts` (excluido del lint normal) y `tools/test/boundaries.test.ts`, que además comprueba 16 violaciones más (núcleo con Node o reloj, web con db/server/Node, servidor con SQL, `mode === 'cloud'`, `dangerouslySetInnerHTML`, texto en español en JSX, `eval`, `sql.raw`, SQL concatenado, exportación por defecto, `console.log`).
- `pnpm audit`: 2 avisos **moderados** (`minimatch` dentro de herramientas de desarrollo); ninguno alto ni crítico. Se revisan al actualizar esas herramientas.
- Impacto: `package.json`, `pnpm-workspace.yaml`, `vitest.config.ts`, `eslint.config.js`, `.dependency-cruiser.cjs`, `scripts/`, `.github/workflows/ci.yml`.

## 2026-11-02 · Fase 1 · Paso 1.5 · Servidor
- **Pruebas de seguridad desde la fase 1** (`packages/server/test/security/`): `access-matrix` (recorre todas las rutas registradas: ids de otro negocio → 404, sin sesión → 401, rol desconocido → 403; una ruta con id que no esté en su tabla rompe la prueba), `headers`, `injection`, `import-untrusted` y `failure-midway` (una ruta de escritura sin caso rompe la prueba), más `logging`. `import-untrusted` cubre por ahora entradas no confiables (JSON roto, cuerpos grandes, escrituras de otro sitio, campos de más, configuración insegura); la importación de copias se suma en la fase 4.
- **Escrituras solo del mismo origen y en JSON:** el servidor local escucha en `127.0.0.1` y una página de otro sitio podría intentar escribirle. Se rechazan las escrituras con `Origin` ajeno o `Sec-Fetch-Site: cross-site` (403 `FORBIDDEN`) y las que no son `application/json` ni `multipart/form-data` (422). Respaldo: `11 › A01, A05`.
- **Ids que no son UUID → 404** antes de tocar la base (`12 §1`: "no existe").
- **Fallo a la mitad:** se prueba con un envoltorio de la conexión que hace fallar la escritura número N dentro de la transacción (`failOnWrite`), para cada N de cada caso de uso.
- **Pruebas rápidas:** cada archivo de pruebas carga una copia de una base PGlite ya migrada (0.6 s en lugar de 5 s de crearla).
- **Rol en local:** `owner`. `can()` niega por omisión; `admin` y `operator` quedan definidos de forma mínima hasta la fase 5.
- Dependencias nuevas: `hono` 4.13.13, `@hono/node-server` 1.19.17, `uuidv7` 1.2.1 (ids v7 de `05`), `zod` 4.6.7 (también en `contract`), `drizzle-orm` 0.45.4, `drizzle-kit` 0.31.11, `@electric-sql/pglite` 0.5.10, `postgres` 3.4.9.

## 2026-11-02 · Fase 1 · Paso 1.6 · Interfaz
- **Estilos del mockup tal cual:** las reglas CSS del mockup se copiaron a `apps/web/src/styles/mockup.css` y sus variables a `tokens.css` (sin tocar `reference/`). Las pantallas usan los mismos nombres de clase. Tailwind se carga solo con su tema y utilidades (sin su "preflight", porque el mockup trae su propio reinicio). Respaldo: "el mockup tiene la razón" (`CLAUDE.md › Diseño`). Nota: `07` dice radios de 20/10/18 px; el mockup usa 5–12 px y se siguió el mockup.
- **Diálogos con `<dialog>` nativo** (como el mockup) en lugar de Radix/shadcn: ya da captura de foco y cierre con Esc, y evita dependencias. Cajón y avisos son componentes propios con las clases del mockup. Es un cambio de herramienta respecto a `07` ("shadcn/ui"), por eso se registra aquí.
- **Geist empaquetada** (`@fontsource-variable/geist`) para funcionar sin internet; el mockup la pedía a Google Fonts.
- **Textos:** `apps/web/src/i18n/messages.ts` se generó una sola vez a partir de las tablas de `13` (errores, avisos, mensajes emergentes, campos, confirmaciones, pantallas de falla) y se mantiene a mano desde ahora. Los textos con partes condicionales ("*(si repone:)*") quedan como claves separadas (`sale.returned.restocked`).
- **`Intl.ListFormat` escribe "Impresora 1 e Impresora 2"** (la "y" cambia a "e" antes de un sonido "i"); `13 §4` pone de ejemplo "y". Se dejó lo que hace `Intl`, que es lo que pide `13`.
- **Catálogo inicial genérico** de materiales, colores (con su tono) y marcas en `core/catalog.ts` (los del mockup, que son genéricos de impresión 3D). En la fase 2 se vuelve `catalog_item` por negocio. El nombre del filamento ignora mayúsculas, acentos y espacios, como el mockup ("Café" = "cafe").
- **Lista de filamentos** devuelve además `activeSpools`, `brands[]`, `capacityGrams` y `valueCents` (lo que pinta el mockup). `12 §8` actualizado en el mismo commit.
- **Pantallas de fases siguientes:** el menú las muestra completas (como el mockup) y abren una página con su título y "Esta pantalla llega en una fase siguiente de la construcción.". Se quita al construir cada una.
- **"Nueva pieza"** queda deshabilitado hasta la fase 2; el giro bajo el nombre del negocio aparece cuando exista Ajustes (fase 2).
- Dependencias nuevas de la interfaz: `react`/`react-dom` 19.1.10, `@tanstack/react-router` 1.170.45, `@tanstack/react-query` 5.104.4, `zustand` 5.0.15, `@fontsource-variable/geist` 5.3.0, `tailwindcss` y `@tailwindcss/vite` 4.3.3, `@vitejs/plugin-react` 5.2.0; para pruebas `@testing-library/react` 16.3.3 y `jsdom` 27.4.0. `react-hook-form` se agregará cuando haya un formulario que lo necesite (fase 2).

## 2026-11-02 · Fase 1 · Paso 1.7 · Semilla y arranque local
- **La semilla lee la copia del propio mockup** (`reference/mockup-backup-v7.json`) desde `packages/db/seed/quick-robot.ts`, y se aplica en `packages/server/src/dev-seed.ts` con el mismo caso de uso `addSpool`; los demás movimientos del libro se copian tal cual. Así los datos de ejemplo viven solo en la semilla y en `reference/`. La nota "Compra del rollo" la pone la interfaz (texto de `es.ts`), no el servidor.
- **Fechas:** las de la copia son fijas (hasta el 31 oct). El mockup, abierto hoy, genera las suyas relativas a la fecha actual, así que en las capturas sus fechas salen corridas un día respecto de la app. No es una diferencia de comportamiento.
- **`pnpm dev`** genera un secreto en cada arranque: el servidor lo exige y el proxy de Vite lo agrega (D29); una llamada directa al puerto del API sin él responde 401. `pnpm dev -- --file` guarda en `.data/`. **`pnpm start`** (compila y sirve en 8787 con los datos en `.data/`) corre sin secreto por ahora: la ventana de Electron lo agregará en la fase 4.
- **Pruebas E2E:** cada prueba arranca su propio servidor local en un puerto libre con su carpeta de datos, para poder reiniciarlo y comprobar que los datos siguen ahí.

## 2026-11-02 · Fase 2 · Pasos 2.1–2.4 · Taller y catálogo
- **Golden sin herramienta extra:** `mockup-values.json` ya venía en el repositorio; `golden.test.ts` lo compara contra `core` con los datos de `reference/mockup-backup-v7.json`, y `catalog.test.ts` repite la comparación a través del servidor (costo, lista y piso de las 9 piezas y las 2 colecciones). No hizo falta `tools/export-mockup-golden.mjs`.
- **Editar un rollo no reescribe el libro:** si cambian los gramos de la compra se registra un `adjustment` por la diferencia (el mockup modificaba el movimiento de compra). `12 §8` actualizado.
- **Movimiento de rollo con signo:** `grams` negativo saca material; consumo, fallo y merma siempre restan; el ajuste puede sumar o restar. `12 §8` actualizado.
- **Compra de insumo:** `costCents` es el **total pagado** y el costo por unidad pasa a ser total ÷ cantidad (como el mockup). `12 §8` actualizado.
- **Borrado suave con referencias:** una pieza que apunta a una impresora borrada se costea con el promedio; los insumos y rollos de un proveedor borrado lo muestran como "sin proveedor" y lo recuperan al restaurar (`12 §8`).
- **Catálogos por negocio** (`catalog_item`): material, color, marca, tipo de cliente y categoría de gasto; empiezan con valores genéricos (`core/catalog.ts`, `core/defaults.ts`) y crecen solos. `05` actualizado con los dos tipos nuevos.
- **Valores de arranque genéricos** de un negocio nuevo: kWh $3, fallos 5 %, purga 5 %, piso 30 %, fórmula 50 %, un canal "Efectivo" y las listas iniciales de `13 §8`. **Marcado para revisión:** son ajustes editables, no reglas de dinero, pero conviene confirmarlos.
- **Tabla `expense` creada en la fase 2** porque "Hecho" con costo registra un gasto; su pantalla y reglas son de la fase 3.
- **Ganchos para la fase 3:** existencias, ventas, colas y uso de canales se conectan a casos de uso de la fase 2 por funciones intercambiables (`productHooks`, `printerHooks`, `setChannelUsage`) para no escribir esas reglas antes de tiempo; mientras tanto devuelven 0. Las pruebas ya cubren los errores que dependen de ellos (`PRODUCT_IN_ACTIVE_ORDERS`, `PRODUCT_HAS_STOCK`, `STOCK_TRACKING_HAS_STOCK`, `PRINTER_HAS_QUEUE`, `CHANNEL_IN_USE`).
- **Listas de piezas y colecciones** devuelven además lo que pintan las fichas del mockup (impresora, pieza original, colecciones, vendidas, existencias, colores). `12 §5` actualizado.
- **Orden de piezas, colecciones e insumos:** el de creación, como el mockup (no alfabético).
- **Costo por gramo con precisión completa** en la API: redondearlo a 4 decimales movía un centavo en la vista previa de la calculadora.
- **Escrituras sin cuerpo:** el adaptador de Node da un cuerpo vacío a todo POST/DELETE; la regla "solo JSON" ahora mira `content-length` (el navegador siempre lo manda). Prueba con un servidor HTTP real.
- **"Deshacer" central** en `useWrite`: restaura, recarga lo que tocó la operación y avisa "Cambio deshecho.".
- **Fotos:** el navegador las reduce a 1 600 px en JPEG antes de subir; el servidor revisa la firma binaria y las sirve con `nosniff` y `CSP: sandbox`.
- **Textos con cifras en negritas** (`tb()`), como los resúmenes del mockup.
- **Textos del mockup que no estaban en `13`:** "Rollo guardado" / "Rollo guardado en {filamento}." al editar un rollo (el mockup manda; `13` no lo contradice).

## 2026-11-02 · Fase 3 · Pasos 3.1–3.8 · Vender y producir (servidor)
- **Golden de la fase 3:** `core/test/golden-sell.test.ts` compara ventas, totales, ranking, pedidos, clientes, existencias, fijos por mes e inversión con `mockup-values.json` (±0.01); `server/test/dev-seed-sell.test.ts` repite la comparación a través de la API con la semilla.
- **Costo unitario de un artículo con precisión completa** (`line_item.cost_cents` es `numeric(14,4)` en centavos, igual que las partes congeladas): con centavos enteros la suma de 33 llaveros se movía más de un centavo frente al mockup. Lo cobrado (`price_cents`, `list_cents`, pagos) sigue en centavos enteros. `05` actualizado.
- **`sale.tracks_payments`:** distingue "sin lista de pagos = pagada completa" (`04 §6`) de "con abonos"; sin esta columna, borrar el último abono convertía una venta a crédito en pagada. `05` actualizado.
- **Cola de impresión en tabla propia** (`print_queue_entry`: impresora, pedido, texto, minutos, posición, inicio), como en `04 §7`; `05` actualizado.
- **Editar un pedido** solo en Cotizado o Aceptado (el mockup solo muestra "Editar" ahí); en otro estado responde `ORDER_NOT_ACTIVE` con el estado.
- **Ajustar existencias:** el conteo no puede quedar por debajo de lo apartado (`VALIDATION_ERROR` en `value`, regla `too_small` con `min`), y una salida no puede ser mayor que las libres (`INSUFFICIENT_STOCK`), como el diálogo del mockup. El motivo va en la nota ("Regalo o muestra: …"). `12 §8` actualizado.
- **Registro de producción con `filamentId`** (no `spoolId`): el mockup registra gramos por filamento y el servidor descuenta rollo por rollo con la purga (`planDeduction`). `12 §8` actualizado.
- **Borrar una venta** devuelve a existencias lo que salió por ella (movimiento `return` con nota "Venta eliminada"); restaurarla lo vuelve a sacar y falla con `INSUFFICIENT_STOCK` si ya no hay.
- **Borrar un pedido** lo saca de las colas; restaurarlo vuelve a apartar lo planeado y, si estaba en producción, lo regresa a las colas de las impresoras que tenía cada artículo.
- **Entrega:** la venta creada copia los artículos sin impresora ni origen y se considera pagada (el cobro vive en el pedido), igual que el mockup.
- **Ganchos de la fase 2 conectados** en `server/src/usecases/sell/wire.ts`: existencias, folios activos, vendidas, colas, ganancia/gastos y uso de canales ya son reales.
- **Semilla de la fase 3:** clientes, pedidos, ventas, libro de existencias, registros de producción, gastos y colas se copian de la copia del mockup tal cual (con su foto del momento), directo a los repositorios; los movimientos de rollo e insumo conservan su referencia al registro que los creó.
- **Puertos de `pnpm dev` configurables** (`WEB_PORT`, `API_PORT`) y carpeta de compilación de las E2E (`E2E_WEB_DIST`), para correr varias instancias a la vez.
- **Pruebas de rendimiento aparte** (`pnpm perf`, `PERF=1`): generar el conjunto de `15 §1` tarda minutos, así que no corren en cada `pnpm test`.
- **Registro "para existencias" de una pieza sin existencias** activa "llevar existencias" y suma las piezas (como el mockup y `04 §8`); antes se perdían.
- **Compras · "Últimas compras":** el primer movimiento de cada insumo se toma como su existencia inicial, no como compra. **Marcado para revisión.**
- **Compras ordenadas por urgencia** dentro de cada proveedor, y los proveedores en el orden en que se agregaron (sin proveedor al final), como el mockup.
- **Gastos:** se queda el resumen de 30 días, categorías y punto de equilibrio del mockup; el filtro de periodo de `06` (7/30/90/Todo, por omisión Todo) va solo en "Todos los gastos". La fecha final solo aplica a gastos mensuales; en uno único se descarta, como el mockup.
- **Reportes** agrega el bloque "Inversión recuperada" (lo pide `06`, el mockup no lo tiene) con el texto de Impresoras; `report()` devuelve además taller, inventario y pedidos en curso para los bloques del mockup.
- **Atajos:** ⌘/Ctrl+Z ejecuta el "Deshacer" del aviso visible; "Rehacer" queda fuera (`06 §1`). La paleta busca también colecciones e insumos.
- **CSV:** celdas protegidas contra fórmulas (= + - @), archivo nombrado con el nombre del negocio de Ajustes, estado del pedido con su texto en español.
- **Búsqueda en la dirección:** los parámetros son texto plano (`?periodo=30`), sin comillas JSON.
- **Pedidos:** la lista de pedidos devuelve también `items[]` y `jobs[]` (tarjetas del tablero) y el cliente trae `hasLogo`/`logoUrl`; `12 §7` actualizado. En "Datos", entrega, canal y nota se cambian con "Editar" (no hay edición en línea: `PUT /orders/:id` volvería a tomar la foto de los artículos).
- **Documentos:** la columna es "Total" y no "Importe" (vocabulario fijo de `13`).
- **Armador al editar un pedido:** sin "Precio aceptado" ni anticipo (`PUT /orders/:id` no los lleva); se acepta en la página del pedido. Un pedido nuevo toma el primer canal (el mockup fijaba "WhatsApp", que sería un dato del negocio en el código).
- **`CUSTOMER_NAME_EXISTS`** devuelve el nombre del cliente que ya existe, como el mockup.
- **`#root` a altura completa** para que solo `.main` haga scroll (paneles divididos y barra fija del armador), igual que el mockup.
- **Rendimiento (`15 §2`):** con el conjunto de `15 §1` (25 000 ventas) las listas, Reportes, Inicio y la búsqueda se calculan con sumas en SQL (`saleFacts`, `saleTotals` con `grouping sets`, `productLines` que abre los sets por precio de lista, `orderTotalsByCustomer`, `printRunTotals`) y paginan en la base; la app solo aplica las reglas de `core` a una fila por venta o pedido. Los números siguen iguales al mockup (golden por la API). El conjunto generado se guarda como copia en la carpeta temporal para no rehacerlo en cada corrida.
- **Búsqueda de ventas y pedidos en SQL** (`ilike`): distingue acentos ("cafe" no encuentra "café"), a diferencia de piezas y clientes que se filtran sin acentos. **Marcado para revisión.**

## 2026-11-02 · Fase 4 · Copias, importación y migraciones locales
- **Formato de exportación propio** (`format: "workspace-export"`, `schemaVersion`, todas las tablas del negocio sin `workspace_id`, y los archivos en base64). Al importar se valida fila por fila contra las columnas del esquema (tipos, nulos, ids UUID) antes de escribir; tabla o columna desconocida, tipo incorrecto o JSON roto → `IMPORT_INVALID_FILE` con `reason`; versión mayor → `IMPORT_UNSUPPORTED_VERSION`.
- **Ids nuevos al importar:** cada fila recibe un UUID nuevo y se reescriben todas las referencias (columnas e ids dentro de JSON: partes, `fromStock`, `stockReserved`). Así una copia se puede restaurar en el mismo negocio o cargar en otro de la misma base sin choques de llave.
- **La copia del mockup v7 se importa por el mismo endpoint** (`POST /workspace/import`): se detecta por `v`, se valida con Zod y se aplica con la misma conversión que la semilla (casos de uso y repositorios) dentro de **una** transacción; luego se comparan sumas (gramos por filamento, físicas por pieza, ingreso y ganancia de ventas, por cobrar) y se devuelven `differences[]` y `notes[]` (canal creado, cliente "Sin nombre", imagen no importada). Las imágenes en *data URL* pasan por `uploadFile`, que revisa su firma. `pref.copia` → `lastBackupOn`.
- **Copias automáticas por negocio:** `BackupStore` guarda en una carpeta por `workspaceId`; una por día (al abrir y cada hora se revisa si cambió el día) y se conservan 7. Antes de importar, restaurar o vaciar se guarda una copia.
- **Migraciones locales:** `openLocalDatabase` copia la carpeta de datos a `backups/before-update-<fecha>` antes de migrar; si una migración falla, la copia vuelve a su lugar y se informa `MIGRATION_FAILED`; una carpeta ilegible se informa `DATA_UNREADABLE` (pantallas de falla de escritorio).
- **Límite de importación** por dependencia (`importLimitMb`: 100 MB local), sin `if` por modo; pasarlo responde `FILE_TOO_LARGE`.
- **Registro:** los errores de consulta ya no llevan los parámetros (podían incluir notas o datos del negocio); se guarda `params: [redacted]` (`11 › A09`).
- **Herramienta** `pnpm import:mockup --data <carpeta> <copia.json> --yes`: importa en una carpeta de datos local e imprime filas por tabla y diferencias; sin `--data` no hace nada.
- **Índices de llaves foráneas** (`0006_fk_indexes`, a mano como las vistas): restaurar sobre un negocio con datos borraba las filas revisando tablas hijas completas (100 s con 25 000 ventas). Una prueba exige que toda llave foránea tenga su índice.
- **Carga masiva al importar** con `json_populate_recordset` (un solo parámetro JSON por bloque de 5 000 filas): la importación de 330 000 filas bajó de ~42 s a ~19 s.
- **Ajustes › Copia de seguridad:** "Hacer copia ahora" (y su aviso "Copia automática guardada.") y el resumen de importación (filas, diferencias, notas) son textos nuevos que no estaban en `13`; viven en `es.screens.backup`. "Copiar respaldo como texto" y "Restaurar pegando texto" del mockup quedan fuera (`13`).

## 2026-11-02 · Fase 4 · Cáscara de Electron
- **Versiones fijadas** (dependencias nuevas de `apps/desktop`): **Electron 42.11.15** (no la 38.8.6 del spike: `pnpm audit` marca altas en toda versión < 42.11.16; 42.11.15 es la más nueva con dos semanas publicadas). Queda una sola alta, GHSA-jr5w-w6x2-84p9 (certificados intermedios de eMudhra), ignorada en `pnpm-workspace.yaml › auditConfig` porque la ventana solo habla con `http://127.0.0.1` y los enlaces externos abren en el navegador del sistema. **Subir a ≥ 42.11.16 desde el 2026-11-03 y quitar la excepción.** electron-builder 26.17.0 (el del spike) y esbuild 0.28.2 (ya estaba en el lockfile por Vite). `electron` se agrega a `onlyBuiltDependencies` para que su instalación descargue el binario. Electron 42 pide `@types/node` 24 y eso partía Vite en dos instancias (falla el typecheck de `vite.config.ts`): `overrides` fija `@types/node` en 22.20.5, la que ya usaba el monorepo.
- **Servidor en un `utilityProcess`** (`src/server-entry.ts`): misma composición que `scripts/local-server.ts` (`localDeps` + `createApp`), en `127.0.0.1`, puerto 0. El secreto de cada arranque (32 bytes) viaja en el primer mensaje, no en variables de entorno ni argumentos. El proceso principal lo agrega con `session.webRequest.onBeforeSendHeaders` solo a peticiones a su propio origen (reemplaza cualquier `Authorization` que mande la página). Si el servidor se cae, se reinicia una vez en el **mismo puerto** (la ventana conserva su origen); si vuelve a caer en menos de 5 min, pantalla "no responde". Un arranque que tarda más de 90 s cuenta como caída. Al salir, el servidor cierra la base antes de terminar.
- **Pantallas de falla en el build de la web** (no `apps/desktop/src/fatal.html` como decía la entrada de la fase 0): los textos deben vivir en `es.ts` y `desktop` solo puede depender del build de la web. Segunda entrada de Vite (`apps/web/fatal.html` + `src/fatal/main.ts`, sin React ni router, Geist y tokens), con rutas relativas porque Electron la abre del disco (`loadFile`). Restaurar con el archivo de datos ilegible: `pgdata` se mueve a `pgdata-unreadable-<fecha>` (nunca se borra), el servidor arranca con un archivo nuevo y aplica la copia elegida con `importWorkspace` (sin "copia previa", que reemplazaría la copia automática de hoy) antes de escuchar y antes de la copia diaria; si falla, ese archivo nuevo se aparta como `pgdata-restore-failed-<fecha>` y la pantalla lo dice.
- **Textos del menú y de los diálogos** en `es.screens.desktop`; el build de la web los emite como `desktop-texts.json` (plugin en `apps/web/vite.config.ts`) y el proceso principal los lee al arrancar.
- **Empaquetado:** esbuild junta `main.mjs` y `server-entry.mjs` (ESM, con `createRequire` para dependencias CommonJS) y `preload.cjs` (CommonJS: los preload con `sandbox` no pueden ser ESM) en `apps/desktop/dist/app`; las migraciones se copian a `dist/migrations`, que es donde `@app/db` las busca desde el bundle (`../migrations`) y lo que `localDeps` recibe en la opción nueva `migrationsFolder`. `@electric-sql/pglite` se queda como dependencia real (no se junta: carga su `.wasm` y `.data` de junto a su código) y va en `asarUnpack`. La web compilada va en `Resources/web` (`extraResources`) y el ícono en `Resources/icon-512.png`. Mac: `dmg` arm64 + x64, `identity: null` (sin firma), sin actualización automática.
- **Nombre del paquete:** `productName: Quick Robot` en `electron-builder.yml` (solo el nombre de la app en la Mac de Bruno; el nombre comercial se decide en la fase 5). **Marcado para revisión.**
- **Variables solo de prueba** (las lee `main.ts` solo si el bundle se hizo sin `--release`, `__TEST_HOOKS__`; el `.dmg` de `pnpm desktop:dist` las ignora): `DESKTOP_USER_DATA` (otra carpeta de datos), `DESKTOP_TEST_MIGRATIONS` (otra carpeta de migraciones, para la prueba de migración fallida) y `globalThis.__desktopTest` (pid del servidor, origen y secreto, para las E2E). `DESKTOP_WEB_DIST` cambia la web en desarrollo (sin empaquetar).
- **Permisos de la ventana:** solo se conceden `clipboard-sanitized-write` y `fullscreen`; todo lo demás se niega. Navegación solo a su origen; `window.open` se niega y los enlaces http(s) externos abren en el navegador del sistema; `<webview>` bloqueado. Los manejadores IPC revisan qué página llama (la app en su origen o el `fatal.html` del paquete).
- **Esqueleto de carga lenta** (`15 §5`): genérico en el marco de la app (`components/LoadingSkeleton.tsx`), solo para cargas iniciales que pasan de 300 ms; el mockup no tiene uno.
- **Lecturas más rápidas:** Reportes reutiliza catálogo y costos ya cargados; la ganancia "desde siempre" (inversión recuperada) usa una consulta ligera (`grossProfitAllTime`); la búsqueda solo carga costos si alguna pieza encontrada tiene precio por fórmula o un set no tiene precio.

## 2026-11-05 · E2E con reloj congelado
- **Problema:** la semilla del mockup está fijada al 2026-11-01 y las E2E usaban el reloj real; al pasar los días, la ventana de 30 días dejaba fuera ventas y fallaban Inicio, Reportes y Gastos.
- **Decisión:** `scripts/local-server.ts` usa `fixedClock()` si existe `E2E_FIXED_CLOCK` (lo pone `e2e/support/server.ts`); los specs importan `test` de `e2e/support/test.ts`, que congela también el reloj del navegador (`page.clock.setFixedTime`). `desktop.spec.ts` no cambia (app empaquetada, reloj real). Sin cambios en producción.

## 2026-11-05 · Ajustes guarda con botón
- **Decisión de Bruno:** Ajustes deja de guardar campo por campo al salir; los cambios se acumulan en un formulario y se guardan juntos con **Guardar cambios** (deshabilitado sin cambios; "Hay cambios sin guardar." mientras hay). Cubre costos, nombre y comisión de canales y datos del negocio. Agregar y quitar canal siguen siendo acciones inmediatas. Es un cambio respecto al mockup, pedido por la persona. Usa `updateSettings` y `updateChannel` existentes; sin cambios en `12`.
