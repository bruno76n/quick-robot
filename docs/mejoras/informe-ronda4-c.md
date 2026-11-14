# Informe de la ronda 4 · Fase C · Pantallas de rollos

## Resumen
Las pantallas ya llevan el filamento **por rollo**: Filamentos muestra cada filamento con sus rollos numerados abajo (marca, fecha, lo que costó o «Sin costo», barra, «x g de y g», estado y menú), el costo por gramo con las compras que lo forman y la franja de cuatro cifras; al tocar un rollo se abre **su cajón** (Pesar en báscula con «Quedan» en vivo, Guardar peso, Terminar rollo con confirmación, Editar, movimientos). Agregar rollo crea N rollos con números consecutivos y enseña el costo para piezas antes → después; Registrar impresión y Poner en producción dejan elegir el rollo (y repartir entre dos); la calculadora dice de dónde sale cada costo por gramo y Ajustes fija las compras del promedio. En celular los diálogos de esta ronda son hojas desde abajo.

## Pasos
| # | Paso | Estado | Commit | Notas |
|---|---|---|---|---|
| C1 | Estilos de rollos, etiqueta de número, origen del costo, hoja en celular | hecho | `60e3ea4` | `features/filament/spools.css` + `spools.tsx`; `Dialog` acepta `className` (`sheet`); `format › money3d` ($0.250/g) con su prueba y `13 §2.1` |
| C2 + C3 | Filamentos con rollos + cajón del rollo | hecho | `04b1512` | Un solo commit: la lista abre el cajón y no compila sin él. `?r=` abre el rollo; `?f=` el filamento (encabezado) |
| C4 | Agregar rollo | hecho | `0d4ebbc` | Cantidad, envío del pedido, Sin costo, proveedor, resultado con `core`, precio de referencia y `REFERENCE_COST_REQUIRED`; aviso con número (`toast.spool.added`, `spool.addedMany`) |
| C5 | Registrar impresión | hecho | `220cdec` | `features/filament/SpoolUse.tsx` (lista con sugerido, antes → después, barra, repartir); E1 intacto |
| C6 | Poner en producción | hecho | `a6c609d` | `orders/StartSpools.tsx`: «Empezar con el rollo» por artículo y filamento y el reparto (caso 1.5c) |
| C7 | Pieza (calculadora): «i» y aviso sin referencia | hecho | `8b288bc` | `CostInfo`; «Sin costo de referencia para {filamento}» bajo el costo |
| C8 | Ajustes › Compras para el promedio del filamento | hecho | `4b8d19b` | 1–10, `fields.settings.costAvgPurchases.range` |
| C9 | Pruebas de pantalla, e2e, capturas, informe | hecho | `3467922` + este commit | `spools.test.tsx` (8), `e2e/spools.spec.ts` (6), `a11y.spec.ts` ampliado |

## Pruebas
- **Web (unidad):** `features/filament/spools.test.tsx` — etiqueta y formatos, origen corto y largo del costo, caso 1.1a ($0.25/g) y 1.1b (#12 → $0.276667), la «i», casos 1.5a (100 → 47.5 g: consumo 50, purga 2.5), 1.5b (#7 30 g + resto del #5), `SpoolUse` (solo rollos con material, sugerido abierto, antes → después, elegir y repartir, `SPOOL_INSUFFICIENT` en la vista previa) y caso 1.5c de Poner en producción (#4 410 → 0, #13 −535). `format.test.ts` + `money3d`.
- `pnpm test`: **63 archivos, 750 pruebas** en verde (7 omitidas, las de siempre); cobertura total 95.8 % líneas. `pnpm typecheck` ok. `pnpm lint` **0 errores, 39 avisos** (los mismos de la fase B). `pnpm size`: **224.1 KB** de JS inicial comprimido (≤ 350). **`pnpm security` en verde** (155 pruebas).
- **e2e nuevo** `e2e/spools.spec.ts`: agregar 2 rollos de PLA Negro (#9 y #10, envío $10 → $5 c/u, $0.360/g → $0.363/g «promedio de #2, #9 y #10»); imprimir eligiendo el #9 en vez del sugerido (#9 947.5 g, #2 sin tocar); repartir #2 + #10 (#2 se termina, #10 885 g, «1 rollo vacío oculto»); pesar el #10 (1,100 − 248 → 852 g, ajuste −33 g; fuera de rango deshabilita; la tara de eSUN se propone en el #9) y terminarlo con su confirmación; Poner en producción empezando con el #8 (960.1 g); rollo sin costo de un filamento sin costo → pide precio de referencia ($0.300/g, «precio de referencia»).
- **e2e actualizados** (solo selectores o textos que cambiaron de verdad): `filaments.spec` (resultado `$0.450/g`, botón «Agregar rollo #9», avisos con número, «ya existe»), `clicks/workshop` (aviso con número; el resumen plegado ya no existe, la marca propuesta se sigue comprobando en el campo), `production-stock`, `ronda2-flows`, `clicks/workshop` (`.frow.ro` → `spool-use`), `a11y` (encabezado del filamento en vez de fila de tabla; + cajón del rollo, menú, Terminar rollo, repartir, Poner en producción). Ningún presupuesto de clics cambió.
- **`pnpm e2e` completa: 128 pasan, 5 omitidas** (las de siempre; antes 122 + las 6 nuevas de `spools.spec.ts`), incluida `a11y.spec.ts` (axe sin violaciones serias ni críticas a 1440 y 390).

## Comparación con la maqueta
Capturas de la app (semilla de desarrollo) y de `reference/ronda-4/` a 1440, 820 y 390, revisadas una por una.

| Pantalla | 1440 | 820 | 390 |
|---|---|---|---|
| Filamentos (lista con rollos, franja) | igual (lista a todo el ancho, ver E2) | igual | igual |
| Cajón del rollo (Pesar, Terminar, Editar, movimientos) | diferencia aceptada: cajón, no columna fija (E2) | ídem | ídem (cajón a pantalla completa) |
| Menú ··· del rollo | igual (la maqueta solo dibuja «···») | igual | igual |
| Agregar rollo | igual (con diferencias de diálogo abajo) | igual | hoja desde abajo, igual |
| Registrar impresión | diferencia aceptada: Motivo y Resultado son los segmentados de siempre a todo lo ancho, sin «Pedido» (E1); gramos editables en el encabezado del filamento | ídem | hoja, ídem |
| Poner en producción | diferencia aceptada: conserva asignación, plan y material de antes; el bloque de rollo va bajo cada artículo | ídem | hoja, ídem |
| Pieza (calculadora) «i» | sin maqueta: sigue `ronda-4.md §5` | — | — |
| Ajustes › Costos del taller | sin maqueta: un campo más en la rejilla | igual | igual |

Diferencias de diálogo aceptadas (todas las pantallas): sin la × del encabezado (el `Dialog` compartido cierra con Cancelar o Esc); radio de la hoja 12 px (`--r-panel`) en vez de 18; los campos con unidad ponen `$` a la derecha (`UnitInput` de siempre); la fecha es el selector nativo.

## Decisiones tomadas
`docs/decisiones.md` › **2026-11-14 · Ronda 4 · Fase C · Pantallas de rollos**: cajón del rollo y del filamento (E2) y URLs `?r=`/`?f=`/`&a=`; lista a todo el ancho; qué cuenta la franja; Terminar rollo con confirmación; costo por gramo con tres decimales; hoja en celular con `Dialog className` *(se tocó `components/Dialog.tsx`: una prop opcional)*; números de la vista previa de Agregar rollo sin los borrados; texto «ya existe» de la maqueta; campos a la vista en vez del selector plegable; aviso con número; Registrar impresión solo manda `spools` si se elige; Poner en producción con detalles de piezas para los gramos de cada artículo y el reparto bajo el último artículo de cada filamento.

## Bloqueado o dudoso
- Nada bloqueado.
- **Aviso de Registrar impresión:** «Se descontaron 50 g» sigue contando los gramos de la pieza sin purga (como antes de la ronda); el rollo baja 52.5 g. No se cambió (no es de esta fase); conviene decidir en D si el aviso debe incluir la purga.
- **Número en la vista previa:** si el rollo de número más alto se borró, la vista previa propone un número que el servidor no usará (da el siguiente); el aviso dice el real.
- Las rejillas de la calculadora y Ajustes no tienen maqueta de la ronda 4; se siguió el texto de `ronda-4.md §5`.

## Qué conviene que revise la persona
- Filamentos con sus rollos reales: los números para rotular los contenedores y que «Rollos sin costo» cuente los regalos.
- Pesar un rollo real con su carrete vacío y ver que la tara quede para la marca.
- Registrar una impresión eligiendo el rollo y, en Poner en producción, «Empezar con el rollo» con dos artículos del mismo filamento (el reparto se ve una vez, bajo el último).
- La «i» de la calculadora en 3 o 4 piezas.

## Cómo probarlo
```
pnpm vitest run --project web apps/web/src/features/filament/spools.test.tsx
pnpm e2e e2e/spools.spec.ts e2e/filaments.spec.ts e2e/a11y.spec.ts
pnpm dev   # /filamentos, /produccion › Registrar impresión, /pedidos › Poner en producción, /ajustes
```
