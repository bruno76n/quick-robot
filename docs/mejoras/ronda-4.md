# Ronda 4 · Rollos

El dueño pidió llevar el filamento **por rollo**, como en los talleres que tienen un contenedor por rollo con su número y sus gramos: saber cuántos rollos hay de cada color, cuánto le queda a cada uno y de cuál se imprime. Y corregir el costo: un rollo que llegó gratis con la impresora no debe abaratar las piezas.

**Material:** este documento y `reference/ronda-4/` (4 pantallas + `index.html`, `rollos.css`, `README.md`; usan el diseño de `reference/ronda-3/`). Va **después de la ronda 3**.

**Qué manda si hay conflicto:** 1) este documento; 2) las maquetas de la ronda 4; 3) `docs/04`, `05`, `06`, `12` y `13` tal como quedan después de aplicar §8.

**Decisión del dueño (cambio de regla de dinero):** el costo por gramo de un filamento deja de ser el promedio de lo que queda en sus rollos y pasa a ser el **promedio de sus últimas compras con costo** (§2.2). Es un cambio decidido, no un error que corregir para que pase una prueba: se actualizan `docs/04 §1`, sus casos y los valores de `packages/core/test/golden/mockup-values.json` que cambien, con su entrada en `decisiones.md`. Los costos de las piezas actuales pueden subir o bajar un poco: es lo esperado.

---

## 1. Qué cambia, en corto

1. **Un rollo = una compra, siempre** (ya es así en los datos: `spool`). «Agregar rollo» nunca suma gramos a un rollo que existe; con cantidad 2 crea dos rollos.
2. **Cada rollo tiene número** (#1, #2…), correlativo por negocio y que nunca se reutiliza: el que el taller escribe en el contenedor.
3. **Filamentos muestra los rollos** debajo de su filamento (material + color), cada uno con marca, fecha, precio o «Sin costo», barra, gramos y estado.
4. **Costo por gramo del filamento = promedio de las últimas 3 compras con costo** (ponderado por gramos, con envío). No depende de qué rollo se usa ni de cuánto le queda.
5. **Rollos «Sin costo»** (regalo o incluidos con la impresora): cuentan en gramos y en el inventario, no en el costo.
6. **Al imprimir se elige el rollo** (Registrar impresión y Poner en producción); viene sugerido el abierto, se ve cuánto le queda después y se puede repartir entre dos rollos.
7. **Pesar** un rollo con báscula y **Terminar rollo**.
8. **El valor del inventario** usa lo que costó cada rollo (el sin costo vale $0).

## 2. Reglas (`docs/04 §1`, reemplazan a las de costo por gramo y se suman a las demás)

### 2.1 Costo por gramo de un rollo
Igual que hoy: `(costo + envío) / gramos`. Un rollo **sin costo** tiene costo 0 y `no_cost = true`.

### 2.2 Costo por gramo de un filamento (para piezas, ventas y reportes)
`= Σ (costo + envío) / Σ gramos` de las **últimas N compras con costo** de ese filamento (material + color), N = `cost_avg_purchases` de Ajustes (por defecto **3**, de 1 a 10). «Últimas» = por `purchased_on` descendente, desempate por número de rollo descendente. Cuentan los rollos con costo **aunque ya estén vacíos** (es el precio de compra, no lo que queda). No cuentan los rollos sin costo ni los borrados.

Si el filamento no tiene ninguna compra con costo:
1. se usa el mismo cálculo con las últimas N compras con costo **del mismo material** (cualquier color);
2. si tampoco hay, el **precio de referencia** del filamento (`reference_cents_per_kg`, se pide al registrar un rollo sin costo cuando 1 no da resultado);
3. si tampoco hay, 0, y la pieza muestra el aviso «Sin costo de referencia para {filamento}».

> **Caso 2.2a** — PLA Gris: #3 $200 (1,000 g, 20 sep), #5 $250 (1,000 g, 10 oct), #9 $300 (1,000 g, 5 nov), #7 sin costo (1,000 g, 15 sep). N = 3.
> Costo = (200 + 250 + 300) / 3,000 = **$0.25/g**. Una pieza de 50 g: material sin purga = **$12.50**, imprima del #3, del #7 o del #9.
>
> **Caso 2.2b** — Se compra el #12 a $280 (1,000 g, 20 nov). Últimas 3: #12, #9, #5 → (280 + 300 + 250) / 3,000 = **$0.276667/g** (la pieza de 50 g: $13.83).
>
> **Caso 2.2c** — Rollos de distinto tamaño: TPU #20 $430 (500 g) y #21 $800 (1,000 g) → (430 + 800) / 1,500 = **$0.82/g**.
>
> **Caso 2.2d** — PLA Blanco solo tiene #1 sin costo; PLA Gris es el del caso 2.2a → PLA Blanco usa el material PLA: **$0.25/g**.
>
> **Caso 2.2e** — PETG Naranja solo tiene un rollo sin costo y no hay compras de PETG; precio de referencia $300 por kg → **$0.30/g**.
>
> **Caso 2.2f** — Con N = 1, PLA Gris del caso 2.2a = el #9 = **$0.30/g**.
>
> **Caso 2.2g** — Envío: #30 $250 + $50 de envío (1,000 g) y #31 $250 sin envío → (300 + 250) / 2,000 = **$0.275/g**.

### 2.3 Valor del inventario
`Σ restante de cada rollo × costo por gramo de ese rollo` (los sin costo valen 0). Es lo único que usa el precio de cada rollo.

> **Caso 2.3** — PLA Gris del caso 2.2a con #3 vacío, #5 640 g, #7 100 g, #9 1,000 g → 640·0.25 + 100·0 + 1,000·0.30 = **$460.00**.

### 2.4 Número de rollo
Correlativo por negocio, empieza en 1, **nunca se reutiliza** (un rollo borrado conserva su número). Al crear: `max(number) + 1` del negocio dentro de la transacción, con índice único `(workspace_id, number)`. Con cantidad N, números consecutivos.

### 2.5 Qué rollo se gasta
- **Sin elección** (como hoy): primero el abierto (le falta algo), luego el más viejo por fecha; desempate por número.
- **Con elección**: el usuario da, por filamento, una lista de `{ rollo, gramos }` (gramos con purga). Cada parte ≤ lo que le queda a ese rollo (si no, `SPOOL_INSUFFICIENT`). Si la suma no cubre lo necesario, lo que falta se toma de los demás rollos en el orden de arriba; si tampoco alcanza, aviso `FILAMENT_SHORTFALL` como hoy.
- **Rollo sugerido** en los diálogos = el primero del orden de arriba.
- En cada rollo, consumo y purga por separado: `consumo = parte / (1 + purga%)`, `purga = parte − consumo`, cada uno a 0.1 g (como el caso 1.2 actual).

> **Caso 2.5a** — Purga 5 %, pieza de 50 g, rollo #7 con 100 g → necesita 52.5 g. #7: **100 → 47.5 g** (consumo 50.0, purga 2.5). PLA Gris baja 52.5 g.
>
> **Caso 2.5b** — Igual, pero el #7 tiene 30 g y se elige «#7 lo que tenga + el resto del #5». #7: 30 → 0 (consumo 28.6, purga 1.4); #5: 640 → 617.5 (22.5 g: consumo 21.4, purga 1.1).
>
> **Caso 2.5c** — Pedido de 20 piezas de 45 g, purga 5 % → 945 g. Empieza con el #4 (410 g) → #4: 410 → 0; sigue el #13 (1,000 g) → 1,000 → 465 g.

### 2.6 Terminar rollo
Registra un movimiento `waste` (merma) por todo lo que le queda, con nota «Rollo terminado»; el rollo queda `Vacío` y deja de salir en los selectores. Si ya está vacío (≤ 0.5 g): `SPOOL_ALREADY_EMPTY`.

### 2.7 Pesar
`queda = peso en báscula − peso del carrete vacío`. Se registra un movimiento `adjustment` por `queda − restante` (si es 0, no se registra nada). El peso del carrete vacío se guarda **por marca** (se propone el último usado con esa marca; se puede cambiar). Válido si `0 ≤ queda ≤ gramos del rollo × 1.05`; si no, `WEIGHT_OUT_OF_RANGE`.

> **Caso 2.7** — Rollo #7 de 1,000 g con 100 g en el sistema; báscula 348 g, carrete Bambu Lab 248 g → queda 100 g, sin movimiento. Báscula 330 g → queda 82 g, ajuste de −18 g.

### 2.8 Lo que no cambia
Estado del filamento y del rollo (con las palabras de la ronda 3: Stock bajo, Crítico…), faltante, compras sugeridas (siguen usando el último rollo para cantidad, marca y proveedor), y las ventas ya hechas (guardan su costo del momento).

## 3. Datos (`docs/05`) y migración

| Tabla | Cambio |
|---|---|
| `spool` | + `number` (int, no nulo; único con `workspace_id`) · + `no_cost` (bool, falso) |
| `filament` | + `reference_cents_per_kg` (int, nulo) |
| `catalog_item` (marcas) | + `spool_tare_grams` (int, nulo): peso del carrete vacío de esa marca |
| `workspace_settings` | + `cost_avg_purchases` (int, 3; de 1 a 10) |

**Migración** (sin borrar nada; copia de seguridad antes, como siempre): `number` por negocio en orden de `purchased_on`, desempate por id; `no_cost = true` donde `cost_cents + shipping_cents = 0`. Probada con `reference/mockup-backup-v7.json`.

## 4. Operaciones (`docs/12`)

| Operación | Cambio |
|---|---|
| `addSpool` | + `quantity` (1–20; crea N rollos iguales con números consecutivos; el envío se reparte entre ellos, el residuo de centavos al primero) · + `noCost` · + `referenceCentsPerKg?`. Si `noCost` y §2.2 no da costo sin referencia → `REFERENCE_COST_REQUIRED` (422). Respuesta: los rollos creados |
| `updateSpool` | + `noCost` |
| `finishSpool` · `POST /spools/:id/finish` | §2.6 · `SPOOL_ALREADY_EMPTY` (409) |
| `weighSpool` · `POST /spools/:id/weigh` | `{ scaleGrams, tareGrams }` → §2.7; guarda `tareGrams` en la marca · `WEIGHT_OUT_OF_RANGE` (422, `maxGrams`) |
| `logPrintRun` | `filaments[]` acepta `spools?: [{ spoolId, grams }]` por filamento (§2.5) · `SPOOL_INSUFFICIENT`, `SPOOL_NOT_IN_FILAMENT` (422) |
| `startProduction` | `assignments[]` acepta `startSpools?: [{ filamentId, spoolId }]`: el rollo con que empieza cada artículo; lo demás en el orden de §2.5 |
| `GET /filaments` | + `spools[]` (número, marca, gramos, restante, precio o `noCost`, fecha, estado) y `costSource` (`purchases` \| `material` \| `reference` \| `none`) con los números que formaron el promedio |
| `GET /settings`, `updateSettings` | + `costAvgPurchases` |

Textos de los códigos nuevos en `13`: `REFERENCE_COST_REQUIRED` «Escribir un precio de referencia por kilo para calcular piezas con este filamento.» · `SPOOL_ALREADY_EMPTY` «Este rollo ya está vacío.» · `WEIGHT_OUT_OF_RANGE` «El peso no cuadra con el rollo. Revisar el peso de la báscula y el del carrete vacío.» · `SPOOL_NOT_IN_FILAMENT` «Ese rollo es de otro filamento.»

## 5. Pantallas (`docs/06`)

| Pantalla | Maqueta | Qué cambia |
|---|---|---|
| Filamentos | `filamentos.html` | Cada filamento (material + color) con sus rollos abajo: número, marca, fecha, precio o «Sin costo», barra, «x g de y g», estado y menú (Pesar, Terminar rollo, Editar, Movimientos). Los vacíos se ocultan («1 rollo vacío oculto», se muestran al tocarlo). El filamento dice su costo por gramo y de qué compras sale. Franja: disponible, valor del inventario, stock bajo o crítico, rollos sin costo. A la derecha (abajo en tableta y celular) el rollo elegido con Pesar |
| Agregar rollo | `rollo-nuevo.html` | Material, color, marca; gramos por rollo, **cantidad**, fecha; precio por rollo, envío del pedido, proveedor; **Sin costo**. Si el filamento ya existe lo dice («se agrega como uno nuevo»). Abajo, el resultado: números que se crean, rollos del filamento y costo para piezas antes → después. Con Sin costo y sin forma de calcular (§2.2), aparece «Precio de referencia por kilo» |
| Registrar impresión | `impresion.html` | Por cada filamento de la pieza: lo que necesita (con purga), la lista de rollos con el sugerido marcado y «antes → después» de cada uno, la barra del elegido (lo que se va en gris claro) y «Repartir entre dos rollos». Abajo el total del filamento y que el costo no cambia con el rollo |
| Poner en producción | `produccion-pedido.html` | Por artículo, además de la impresora: «Empezar con el rollo» por filamento y el reparto que resulta (qué rollo se termina y con cuál sigue) |
| Pieza (calculadora) | — | El costo por gramo de cada filamento con un «i» que dice de qué compras sale (o «promedio del material», «precio de referencia») |
| Ajustes › Costos del taller | — | «Compras para el promedio del filamento» (1–10) |

En celular, los diálogos son hojas desde abajo (`rollos.css`).

## 6. Cómo se trabaja

Mismas reglas que las rondas anteriores (`ronda-2.md §1`). Fases:

| Fase | Qué es |
|---|---|
| **A** | Reglas en `core` con los casos de §2 (primero las pruebas) y actualizar `04`, sus casos y el golden (con su entrada en `decisiones.md`) |
| **B** | Migración y datos (§3); operaciones y errores (§4) con sus pruebas (camino feliz, cada error, fallo a la mitad) |
| **C** | Pantallas (§5), comparadas con las maquetas en 1440, 820 y 390 |
| **D** | Revisión: flujos A–F de `06 §17` y uno nuevo (agregar 2 rollos → imprimir eligiendo rollo → repartir entre dos → pesar → terminar), seguridad y textos |

## 7. Pruebas obligatorias

- Los casos 2.2a–g, 2.3, 2.5a–c y 2.7 en `core`.
- `addSpool` con cantidad 2 crea dos rollos con números consecutivos; con un número borrado en medio, no lo reutiliza.
- Dos negocios: cada uno con su numeración desde 1; un rollo de otro negocio responde 404.
- `logPrintRun` con un rollo de otro filamento → `SPOOL_NOT_IN_FILAMENT`; con más de lo que tiene → `SPOOL_INSUFFICIENT`; sin `spools` → orden automático (igual que hoy).
- La migración con `mockup-backup-v7.json`: números en orden de compra, los de costo 0 quedan sin costo, ningún gramo cambia.

## 8. Documentos que se actualizan

`04 §1` (costo por gramo, valor del inventario, número, qué rollo se gasta, terminar, pesar, con sus casos) · `05` (§3) · `06` (§5) · `12` (§4) · `13` (textos y errores) · `decisiones.md` (el cambio de regla, por decisión del dueño) · `progreso.md`.

## 9. La web

La página de venta (web de Quick Robot) muestra Filamentos con «rollos» por filamento y dice «Costo por gramo: promedio de tus rollos». Cuando esta ronda esté en el sistema, se ajusta ese texto a «promedio de tus últimas compras; los rollos sin costo no cuentan» (pendiente para `docs/25 §13`).

## 10. Qué debe revisar la persona al terminar

- Filamentos con sus rollos reales y sus números (para rotular los contenedores).
- El costo de 3 o 4 piezas antes y después del cambio de regla.
- Registrar una impresión eligiendo el rollo y ver que los gramos de ese rollo bajen.
