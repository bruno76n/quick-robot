# Informe de la ronda 3 · Fase D (revisión)

## Resumen
Se revisaron las 16 pantallas, el cajón del filamento, la página del pedido y los diálogos más usados contra `reference/ronda-3/` en 1440, 820 y 390, y se corrigió lo que no coincidía o se desbordaba. Se agregó axe (`@axe-core/playwright`) con una prueba sin hallazgos serios ni críticos en todas las pantallas, y una prueba que impide colores literales fuera de los tokens. Se limpiaron reglas CSS, tokens y un componente que ya nadie usaba, sin ningún cambio visible (capturas idénticas píxel a píxel). Ningún cambio de comportamiento, API ni datos.

## Pasos
| Paso | Estado | Commit | Notas |
|---|---|---|---|
| Pie del resultado de Pieza | hecho | `97679ee` fix(web): piece result footer no longer overlaps the channel table | El relleno inferior del panel dejaba ver las filas de «Ganancia por canal» debajo de «Descartar»; el pie fijo ahora llega al borde (≥ 1261); 820 y 390 sin cambio (panel debajo del formulario) |
| Pastilla junto a «Pedido #N» | hecho | `d5f1835` fix(web): state pill keeps normal letter-spacing inside titles | `.chip/.pill` con `letter-spacing: normal` y la letra del cuerpo, aunque estén dentro de un `h1` |
| Columna sin ventas | hecho | `e9b3d9f` fix(web): week column with no sales keeps its date aligned | El monto vacío ocupa lo mismo que uno con texto |
| Ventas | hecho | `7ed6aa7` fix(web): Ventas subtitle without period and item lines that wrap as text on mobile | «Últimos 60 días» sin punto; «2 × Llavero…» en un renglón de texto en el celular |
| Desglose por pieza del pedido | hecho | `2cbfedc` fix(web): order piece breakdown fits its column at 1440 | Ya no se corta la columna «Dónde está» |
| Pasos del pedido en celular | hecho | `8941581` fix(web): order steps show their dates and the piece breakdown fits on mobile | Las fechas caben a 390 (11 px); el desglose ya no se desborda |
| Existencias en celular | hecho | `2f76994` fix(web): Existencias search takes the full width on mobile | |
| Tablas en celular | hecho | `3f5acf5` fix(web): tighter table cells on phones so the text column keeps its width | Producción, Clientes, Insumos, Filamentos |
| Cifras en tableta | hecho | `9246ce9` fix(web): figure labels wrap instead of being cut on tablets | «Ganancia ne…» → dos renglones |
| Limpieza | hecho | `9862a43` refactor(web): remove unused CSS rules, cost-layer tokens and Piece3d | `.lay*`, `.rk*`, `.bay2`, `.sc`, `.set`, `.pvl`, `.gl`, `.prog.noz`, medias vacías; tokens `--c-*` y `--sand`; `Piece3d.tsx` (`MarginBar` → `products/MarginBar.tsx`). 48 capturas idénticas antes y después |
| Cliente | hecho | `c31d2a8` feat(web): customer page with head, summary and history in ronda-3 panels | Sin maqueta: `PageHead` con ruta y avatar, frase, contacto e historial en paneles; se fueron las últimas reglas `.brf*` |
| Armar venta/pedido | hecho | `26c3fc9` feat(web): Armar venta/pedido with PageHead and form blocks in panels | La barra del celular quedaba sin título; bloques en paneles como el editor de pieza |
| Textos en `docs/13` | hecho | `090ff04` docs(13): ronda-3 screen texts | «Ganancia estimada», «Imprimiendo ahora», «Cola vacía.» y el dato corto sin punto |
| axe | hecho | `bfa9466` test(e2e): axe on every screen, drawer and dialogs; fix contrast and structure | `e2e/a11y.spec.ts`; dependencia nueva anotada en `decisiones.md` |
| Colores literales | hecho | `aa68b21` test(web): no named, hsl or rgb literal colors outside tokens | Amplía `tokens.test.ts` (ya vigilaba hex y rgba) |

## Pruebas
- `pnpm test`: 630 pasan (7 omitidas); cobertura 93.6 % sentencias, 82.2 % ramas, 95.7 % líneas. `pnpm test:tz`: 167 pasan.
- `pnpm lint`: 0 errores (33 avisos, los mismos de antes: largo de funciones); fronteras sin violaciones. `pnpm typecheck` en verde.
- `pnpm e2e` completo: 122 pasan y 5 omitidas (escritorio, piden Electron), incluida `a11y.spec`. `pnpm security` en verde (153 pruebas). `pnpm size`: 214.7 KB de 350.
- **Menú en celular y tableta** (§8): `components.test.tsx` (C1) ya prueba que abre con el botón y el foco en la pantalla actual, que Esc y tocar fuera lo cierran y que el foco vuelve al botón; axe también revisa el menú abierto a 390.

## Accesibilidad (axe)
`e2e/a11y.spec.ts` corre axe (WCAG 2.0/2.1 A y AA) a 1440 y 390 en las 14 pantallas del menú, Pieza, Colección, Pedido, Cliente, Armar venta, el cajón del filamento, Agregar rollo, Registrar impresión y (a 390) el menú abierto. Falla con cualquier hallazgo serio o crítico.

| Hallazgo de la primera corrida | Dónde | Arreglo |
|---|---|---|
| Contraste de texto gris pequeño (`--ink-3t` 4.43:1 en blanco, 4.1 en `--soft`; `--ink-2` 4.43 en `--soft-2`; `--green-d` 4.3 en `--soft`) | Grupos del menú, pistas, unidades de campo, desglose, avatares | `--ink-2` #66666f, `--ink-3t` #6e6e78, `--green-d` #008238 (un tono más oscuros; para revisión) |
| `label-content-name-mismatch` | Buscar ⌘K | El atajo se dibuja con CSS; el nombre sigue «Buscar en todo» |
| `list` | Próximas entregas (Inicio) | Filas con `role="link"` fuera de una `ul` |
| `definition-list` | Cifras del pedido, costos de cada impresora | El texto de apoyo y el botón van dentro de un `dd` |

**Resultado final: 0 hallazgos serios o críticos** en las dos corridas.

## Comparación con la maqueta
Capturas de la app (semilla de desarrollo) y de `reference/ronda-3/*.html` lado a lado en los tres anchos. «Igual» = misma estructura, tamaños, colores y jerarquía; los datos difieren (la maqueta usa «Eje Z»).

| Pantalla | 1440 | 820 | 390 |
|---|---|---|---|
| Marco (barra, menú, encabezado) | igual (mascota E3) | igual | igual |
| Inicio | igual (alertas con chips D-7) | igual (corregido el corte de «Ganancia neta») | igual; botón de cada alerta debajo del texto (aceptado en C) |
| Productos | igual (segmentados E1) | igual | igual; Vender/Variante visibles (no hay hover en el celular) |
| Pieza (editor) | igual (corregido el pie fijo) | igual | igual |
| Ventas | igual | igual | igual (corregido el renglón del artículo); el segmentado de canales se parte en dos renglones (E1) |
| Pedidos | igual (Tablero/Lista/Calendario bajo la franja, E1) | igual | igual |
| Pedido | igual (corregido el desglose y la pastilla); pestañas (D-9) | igual | igual (fechas bajo los pasos ahora visibles) |
| Filamentos | igual; detalle en el cajón (E2) | igual | igual |
| Insumos | igual | igual | igual |
| Impresoras | igual | igual | igual |
| Producción | igual | igual | igual (corregida la columna Pieza) |
| Existencias | igual | igual | igual (corregida la búsqueda); filas en tarjeta (ronda 2) |
| Compras | igual | igual | igual |
| Clientes | igual | igual | igual |
| Gastos | igual (segmentado E1) | igual | igual |
| Reportes | igual (secciones extra D-11) | igual | igual |
| Ajustes | igual (Guardar cambios fijo abajo) | igual | igual |
| Cajón del filamento, Agregar rollo, Registrar impresión | igual al estilo nuevo | igual | igual; en Registrar impresión «Prueba de material» se parte y sobresale de la pista (E1, para revisión) |
| Sin maqueta: Colección, Cliente, Armar venta, Copia de seguridad | coherentes (Cliente y Armar venta corregidos en D) | coherentes | coherentes |

## Decisiones tomadas
`docs/decisiones.md` → «2026-11-14 · Ronda 3 · Fase D»: dependencia `@axe-core/playwright` 4.14.0, contraste (tres tokens), Buscar ⌘K, correcciones visuales, Cliente y Armar venta, limpieza, choques de clases (ninguno: solo `.ed` con alcance por `.pz`/`.bd` y `.fdr` compartido a propósito con Insumos), segmentado de Registrar impresión.

## Bloqueado o dudoso
- Nada bloqueado.
- Segmentado de Registrar impresión a 390: no se toca por E1.

## Cierre
Todo en verde con el último commit: `pnpm test`, `pnpm test:tz`, `pnpm lint` (0 errores), `pnpm typecheck`, `pnpm e2e` (122 pasan, 5 omitidas), `pnpm security`, `pnpm size` (214.7 KB). La rama `ronda3-d-revision` queda lista para fusionar.

---

# Resumen final de la ronda 3

## Qué cambió (A–D)
- **A · Inventario:** cada pantalla y componente contra la maqueta, riesgos (contraste, un solo `mockup.css`, corte del menú, clases que usan las pruebas) y el plan de B y C (`informe-ronda3-a.md`).
- **B · Tokens y componentes:** un solo archivo de tokens con los valores de §2 (sin morado), radios y sombras de la maqueta (paneles sin sombra), CSS partido por pantalla sin cambio visual, componentes base (botón 30/7, campo 34/8, `Pill`, tabla, chips de filtro) y compartidos (`Panel`, `Kpis`, `Meter`, `WeekColumns`, `Per100Bar`, `HBarList`, `Steps`, `AlertRow`, `PieceThumb`), vocabulario de §5 (`informe-ronda3-b.md`).
- **C · Pantallas:** marco nuevo (barra lateral blanca con mascota, menú en cajón ≤ 1099 con barra fija, `PageHead`) y las 16 pantallas con el diseño de la maqueta (`informe-ronda3-c.md`).
- **D · Revisión:** comparación final en tres anchos con 12 correcciones, Cliente y Armar venta llevados al mismo estilo, axe en verde, prueba de colores literales, limpieza de CSS y tokens, textos nuevos en `docs/13`.

## Excepciones de la persona (2026-11-14)
- **E1:** los segmentados de siempre (`.seg`) se quedan iguales (blanco sobre gris, mismo tamaño y lugar); la pista usa `--track` por decisión de la coordinación para que se vea sobre el fondo gris. Los chips de filtro sí tomaron el diseño nuevo.
- **E2:** el detalle del filamento sigue en el cajón; su contenido tomó el diseño nuevo.
- **E3:** la mascota se queda (barra lateral, título de Inicio, estados vacíos); no se usa el monograma «EZ».

## Lo que la maqueta muestra y el sistema no tiene (§7, no se agregó)
- Pedido: Historial, fecha de Aceptado (D-1), «Fin estimado de producción» y los botones extra de documentos.
- Tablero de pedidos: aviso «Filamento insuficiente» en la tarjeta.
- Producción: «Últimos 30 días» (la pantalla muestra todos los registros).
- Gastos: la cifra «Variables» (la API no la da).
- Ventas: «▲ %» en Ganancia bruta (la lista no trae el periodo anterior).
- Inicio: alertas con título y detalle separados (el servidor manda una frase).
- Productos: gramos en la ficha. Pieza: la línea de cálculo bajo cada costo. Existencias: «Falta: …» en sets; interruptor de «Llevar existencias» (sigue la casilla).
- Insumos: «Registrar compra» a nivel de pantalla. Ajustes: íconos en los botones de exportar.
Para la página de venta (§9): las ilustraciones de la web deben omitir lo anterior o esperar a que se agregue.

## Qué debe revisar la persona (ronda-3 §10)
1. Las 16 pantallas en la computadora y en el celular contra `reference/ronda-3/` (`pnpm dev`).
2. Que las palabras nuevas (§5: Alertas, Disponibles, Stock bajo, Crítico, Normal, Al día, Próximo, Vencido, Saldo, Fecha de entrega, Correcta, Fallida, Precio mínimo, Productos con más ganancia) se lean bien con datos reales.
3. La lista de §7 de arriba: qué conviene agregar en otra ronda (lo más útil: fecha de aceptación del pedido y alerta de filamento en el tablero).
4. Decisiones marcadas «para revisión» en `decisiones.md`:
   - D-1 pasos del pedido sin fecha de Aceptado y sin Historial.
   - D-3/D-4 y D (fase D): grises y verde un tono más oscuros que la maqueta por contraste (`--ink-2`, `--ink-3t`, `--green-d`).
   - D-5 «Margen mínimo» en Ajustes.
   - D-6 contadores del menú (dos consultas más por pantalla).
   - B4 borde de campo `--line-2` en lugar del de la maqueta (contraste de no-texto).
   - C1 fondo gris y pista de los segmentados.
   - Inicio: el botón de cada alerta se ve también en el celular.
   - Registrar impresión a 390: el segmentado «Para existencias | Prueba de material» se parte en dos renglones (E1).
