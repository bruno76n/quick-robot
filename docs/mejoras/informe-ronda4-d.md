# Informe de la ronda 4 · Fase D · Revisión

## Resumen
Se investigó la «primera carga vacía» que vio el coordinador (no era un negocio vacío: era un error dibujado como lista vacía) y se corrigió para todas las pantallas; se cerraron los dos pendientes de la fase C (el aviso «Se descontaron» y el número de la vista previa de Agregar rollo); se agregó el **flujo G** de punta a punta con los números en cada paso; se reforzó la seguridad de lo nuevo (rollos de otro negocio en el cuerpo, fallo a la mitad y límites de cada entrada nueva); todos los textos nuevos quedaron en `docs/13` sin segunda persona, y la comparación visual con datos de aspecto real dejó dos ajustes del menú del rollo.

## Pasos
| # | Paso | Estado | Commit | Notas |
|---|---|---|---|---|
| D1 | Primera carga vacía | hecho | `ee455b0` | Causa y arreglo abajo (§ Primera carga vacía) |
| D2a | «Se descontaron N g» | hecho | `10ad3b0` | Lo que bajan los rollos: con purga y sin el faltante (impresión: `returnGrams` de la respuesta; pedido: material con purga − `FILAMENT_SHORTFALL`) |
| D2b | Número de la vista previa | hecho | `5d39ac6` | `GET /filaments › nextSpoolNumber` (cuenta los borrados); `docs/12 §8` |
| D3 | Flujos A–F y flujo G | hecho | `92a090d` | `e2e/flow-g-spools.spec.ts`; `06 §17 › G` |
| D4 | Seguridad | hecho | `1bf3e9b`, `419a7c4` | Matriz, fallo a la mitad, límites e inyección de lo nuevo |
| D5 | Textos y comparación visual | hecho | `6a22fba`, `f24d07c` | 110 textos de pantalla en `13 §9.4`; «los que ya hay»; «···» como la maqueta y oculto en celular |
| D6 | Puerta completa | hecho | `2a402b8` | Ajuste de largo de funciones (lint sin avisos nuevos) |
| D7 | Informe, progreso y bitácora | hecho | este commit | |

## Primera carga vacía (observación del coordinador)
- **Qué pasaba:** `pnpm dev` arrancaba Vite y la API a la vez. Vite queda listo en ~0.3 s; la API tarda ~1.5 s (migraciones y semilla) y solo después escucha. Una página abierta en ese hueco recibía del *proxy* de Vite un **500 sin cuerpo** (`ECONNREFUSED`) en `/me`, `/settings`, `/filaments`…; la interfaz lo tomaba como `INTERNAL_ERROR` (sin reintento) y **dibujaba el error como estado vacío** («Sin rollos registrados») con la barra lateral en sus textos de ejemplo («Mi negocio / Giro del negocio»). Reproducido con Playwright y la bitácora de Vite.
- **Qué no pasaba:** no se creó ni se mostró otro negocio. El local tiene ids fijos, `ensureWorkspace` corre antes de escuchar, y sin el secreto la API responde 401; ninguna petición crea un negocio.
- **Escritorio:** al arrancar no puede pasar (Electron abre la ventana solo tras `listening` y la misma API sirve la página). **Pero** el error-como-vacío sí podía verse en uso normal con un 500 real o el servidor caído, en cualquier lista.
- **Arreglo:** tarjeta «No se pudieron cargar los datos de esta pantalla. No se cambió ningún dato.» con **Reintentar** (y el código si lo hay) en lugar de la pantalla cuando una consulta activa falla en su primera carga por el servidor (`components/LoadFailed.tsx`, fila nueva en `15 §5`, texto en `13`); la barra lateral no escribe los textos de ejemplo hasta que llega Ajustes; Filamentos solo dibuja su vacío con datos; `pnpm dev` arranca Vite cuando la API ya escucha. Pruebas: `phase3.test.tsx` y `e2e/failure-states.spec.ts` (todas las peticiones con 500 sin cuerpo).

## Pruebas
- **Unidad e integración:** `pnpm test` **64 archivos (1 omitido), 764 pruebas** en verde (7 omitidas, las de siempre); cobertura 93.8 % sentencias, 83.2 % ramas, 95.8 % líneas. `pnpm test:tz` 196 en verde.
- **Nuevas:** tarjeta de carga fallida (con código, sin lista vacía, Reintentar trae los datos, `NOT_FOUND` no la muestra); `shortfallGrams`; `GET /filaments › nextSpoolNumber` (borrar el último no cambia el siguiente, otro negocio empieza en 1); matriz: rollo de B en `spools[]` de Registrar impresión y en `startSpools[]` de Poner en producción (con pedido, artículo e impresora propios) → 404 de `spool` y nada cambia; fallo a la mitad con cantidad 3 y envío, sin costo con referencia, impresión repartida entre dos rollos elegidos, pedido con rollo de inicio y compras para el promedio (y los casos que reemplazan el negocio ahora corren al final); límites: cantidad 20/21/0, referencia $1,000,000/kg y uno más, tara 10,000/10,001, báscula 100,000.1 y clave de más, 10/11 rollos elegidos, gramos 0 o con dos decimales, ids que no son ids, compras 10/11/0/2.5.
- **Flujo G** (`e2e/flow-g-spools.spec.ts`), con la semilla (PLA Negro #2 410 g a $360; 4,855 g y $2,043.55 en total):

| Paso | PLA Negro | Rollos | Disponible | Valor del inventario | Costo para piezas |
|---|---|---|---|---|---|
| Inicio | 410 g | #2 410 | 4.9 kg | $2,044 | $0.360/g |
| 2 rollos de $360 + $10 de envío | 2,410 g | #9 1,000 · #10 1,000 | 6.9 kg | $2,774 | $0.363/g (#2, #9, #10) |
| Prueba de 50 g del #9 (no el sugerido) | 2,357.5 g | #9 947.5 | 6.8 kg | $2,754 | $0.363/g con cualquier rollo |
| 500 g repartidos #2 + #10 | 1,832.5 g | #2 0 (oculto) · #10 885 | 6.3 kg | $2,565 | $0.363/g |
| Pesar #10 (1,100 − 248) | 1,799.5 g | #10 852 (ajuste −33) | 6.2 kg | $2,553 | $0.363/g |
| Terminar #10 | 947.5 g | #9 947.5 | 5.4 kg | $2,242 | $0.363/g (los vacíos siguen siendo compras) |

  Los avisos dicen «Se descontaron 52.5 g» y «525 g». Al final se borra el #10 y Agregar rollo propone **#11** (antes habría propuesto #10).
- **`pnpm e2e` completa:** **130 pasan, 5 omitidas** (las de escritorio, como siempre): las 128 de la fase C + el flujo G + la carga fallida en `failure-states`; flujos A–F (`flow-a`…`flow-f`) en verde, igual que `spools.spec`, `filaments.spec` y `a11y.spec` (axe a 1440 y 390, ahora con Terminar rollo desde el cajón en celular).
- `pnpm lint` **0 errores, 39 avisos** (los mismos de la fase C); fronteras sin violaciones. `pnpm typecheck` ok. **`pnpm security` en verde** (165 pruebas de seguridad; `pnpm audit` sin altas ni críticas: 1 baja y 9 moderadas, las de antes). `pnpm size` **224.5 KB** de 350.
- `pnpm perf` (solo listas y escrituras: `GET /filaments`, `logPrintRun`, `startProduction`): `PERF=1 vitest run packages/server/test/perf -t "lists|writes"` (25 000 ventas, ~2 min): `GET /filaments` p95 **78 ms** (presupuesto 300), `GET /print-runs` 79 ms, `startProduction` **251 ms** (800). `logPrintRun` no tiene medición propia en `budget.test.ts`; no se agregó. Fuera de lo de esta ronda, `GET /products` dio 324 ms (300; la prueba falla solo sobre 2×).

## Comparación con la maqueta
Capturas de la app con datos de aspecto real (dos rollos nuevos de PLA Negro, PLA Gris con un rollo sin costo pesado a 100 g y dos con costo, un rollo terminado) y de `reference/ronda-4/` a 1440, 820 y 390.

| Pantalla | 1440 | 820 | 390 |
|---|---|---|---|
| Filamentos (franja, filamentos, rollos, «Sin costo», vacío oculto) | igual (lista a todo el ancho, E2) | igual | igual (sin «···», como la maqueta) |
| Cajón del rollo | diferencia aceptada E2 | ídem | ídem |
| Agregar rollo | igual (diferencias de diálogo de la fase C) | igual | hoja, igual |
| Registrar impresión | diferencia aceptada E1 | ídem | ídem |
| Poner en producción | diferencia aceptada (fase C) | ídem | ídem |

Corregido en esta fase: los «···» van en negrita con su espaciado (`rollos.css`) y en celular no se dibujan (la maqueta los oculta; el cajón tiene las mismas acciones).

## Decisiones tomadas
`docs/decisiones.md › 2026-11-14 · Ronda 4 · Fase D · Revisión`: causa y arreglo de la primera carga vacía; «Se descontaron» con purga y sin faltante; `nextSpoolNumber`; seguridad de lo nuevo; textos en `13 §9.4` y «los que ya hay» *(para revisión)*; menú del rollo en celular.

## Bloqueado o dudoso
- Nada bloqueado.
- **«no se suma a los que ya hay»** reemplaza el «que tienes» de la maqueta por la regla de `13 §1` (sin segunda persona en textos nuevos). Si la persona prefiere el de la maqueta, es una línea de `es.ts` y dos de las pruebas.
- Las dudas de A y B siguen para la persona: un rollo de $0 cuenta siempre como sin costo; con rollos elegidos que no alcanzan, lo que falta sale de los demás y luego de lo que les quede a los elegidos; con varios artículos que empiezan con rollos distintos, el descuento es uno por filamento.

---

## Resumen final de la ronda 4

### Qué cambió
- **A · Reglas** (`informe-ronda4-a.md`): en `core`, el costo por gramo de un filamento = promedio de sus **últimas N compras con costo** (N = 3, de 1 a 10 en Ajustes), con respaldo del mismo material → precio de referencia → 0 y su origen; rollos sin costo; valor del inventario rollo por rollo; números de rollo que nunca se reutilizan; reparto del envío; qué rollo se gasta (sugerido, elegido, repartido; consumo y purga por rollo); terminar y pesar. `docs/04 §1` reescrito con los casos 1.1a–g, 1.4, 1.5a–c y 1.6.
- **B · Datos y operaciones** (`informe-ronda4-b.md`): migración `0008` aditiva (número de rollo en orden de compra, sin costo, precio de referencia, tara por marca, compras para el promedio), probada con el respaldo v7 y con copia antes de migrar; `addSpool` con cantidad, sin costo y referencia; `updateSpool` + sin costo; `finishSpool`; `weighSpool`; rollos elegidos en `logPrintRun` y rollo de inicio en `startProduction`; `GET /filaments` con rollos y origen del costo; copias viejas numeradas igual que la migración; 4 códigos nuevos.
- **C · Pantallas** (`informe-ronda4-c.md`): Filamentos con rollos numerados y el cajón del rollo (Pesar, Terminar rollo, Editar, Movimientos); Agregar rollo con cantidad, sin costo y costo para piezas antes → después; Registrar impresión y Poner en producción eligiendo y repartiendo rollos; la «i» del costo en la calculadora; Ajustes › compras para el promedio; hojas desde abajo en celular.
- **D · Revisión** (este informe): una carga fallida ya no se ve como lista vacía; aviso «Se descontaron» exacto; número de la vista previa real; flujo G; seguridad y textos de lo nuevo; ajustes del menú del rollo.

### El cambio de regla del dueño (costo por gramo) y el golden
Antes: promedio de lo que queda en los rollos, ponderado por gramos. Ahora: promedio de las últimas 3 compras con costo, sin importar cuánto les queda ni de cuál se imprime. Con los datos del mockup solo cambia **PLA Blanco** (único filamento con dos rollos: $390 y $370 de 1,000 g):

| Golden | Antes | Ahora |
|---|---|---|
| PLA Blanco · costo por gramo | 0.3784 | **0.38** |
| Spider-Man · salto · costo / precio mínimo | 38.9596 / 55.6566 | 39.0316 / 55.7594 |
| Spider-Man · trepando | 36.3548 / 51.9354 | 36.4232 / 52.0331 |
| Doctor Doom · busto | 41.5644 / 59.3778 | 41.64 / 59.4857 |
| Hulk · puño | 37.8986 / 54.1408 | 37.9705 / 54.2436 |
| Letrero de taquería | 68.8908 / 98.4154 | 68.9447 / 98.4925 |
| Colección Doomsday blanca | 179.7774 / 256.8248 | 180.0653 / 257.2361 |
| Spider-Man · 2 poses | 85.3144 / 121.8777 | 85.4547 / 122.0782 |

Sin cambio: los otros 6 filamentos, las demás piezas, todos los precios y el golden de ventas (cada venta guarda su costo del momento). Detalle (M, sub, F) en `decisiones.md › Ronda 4 · Fase A`.

### Decisiones para revisar
- Un rollo de $0 cuenta siempre como «Sin costo» (no entra al promedio).
- Rollos elegidos que no alcanzan: lo que falta sale de los demás rollos en orden y luego de lo que les quede a los elegidos.
- «Empezar con el rollo» con varios artículos del mismo filamento: un descuento por filamento; cada artículo toma de su rollo lo que necesita.
- `REFERENCE_COST_REQUIRED` solo con la marca «Sin costo» explícita (un rollo de $0 sin la marca no lo pide).
- «… no se suma a los que ya hay» en lugar del «que tienes» de la maqueta.
- En celular el rollo no tiene menú «···»: todo está en su cajón.

### Qué debe revisar la persona (`ronda-4.md §10`)
- **Filamentos con sus rollos reales y sus números** (para rotular los contenedores): los números salieron en orden de compra; dos del mismo día, por orden de alta.
- **El costo de 3 o 4 piezas antes y después** del cambio de regla (tabla de arriba; en sus datos reales cambian solo los filamentos con más de un rollo o con rollos de distinto precio).
- **Registrar una impresión eligiendo el rollo** y ver que bajen los gramos de ese rollo; el aviso dice lo que bajó (con purga).
- Además: pesar un rollo con su carrete vacío (la tara queda por marca) y que «Rollos sin costo» cuente los regalos.

### Pendiente fuera del sistema (`ronda-4.md §9`)
La página de venta (web de Quick Robot) dice «Costo por gramo: promedio de tus rollos». Con esta ronda en el sistema hay que cambiarla a «promedio de tus últimas compras; los rollos sin costo no cuentan» (pendiente para `docs/25 §13`; no se tocó aquí).

### Estado al cerrar
`pnpm test` 764 · `pnpm e2e` 130 (5 de escritorio aparte) · lint 0 errores · typecheck y `pnpm security` en verde · `pnpm size` 224.5 KB de 350. Rama `ronda4-d-revision` lista para fusionar (sin publicar ni etiquetar).

## Cómo probarlo
```
pnpm vitest run --project web apps/web/src/components/phase3.test.tsx
pnpm vitest run --project server packages/server/test/routes/filament.test.ts packages/server/test/security
pnpm e2e e2e/flow-g-spools.spec.ts e2e/failure-states.spec.ts e2e/spools.spec.ts
pnpm dev   # /filamentos: la página ya no abre antes que la API
```
