# Informe de la ronda 3 · Fase B (tokens y componentes base)

## Resumen
Los tokens de la ronda 3 están en `styles/tokens.css` (renombres, valores nuevos, radios `--r-*`, sin sombras de panel); `mockup.css` se partió en `styles/base.css` y un archivo por pantalla en `features/<f>/<f>.css` **sin cambio visual** (capturas idénticas píxel a píxel); botones, campos, estados, tablas, filtros y diálogos tienen ya el aspecto de la maqueta, y hay componentes compartidos (paneles, cifras, barras, gráficas, pasos, alertas, miniatura) para que la fase C arme las pantallas sin tocar `components/`, `tokens.css` ni `base.css`. El vocabulario de §5 está en la interfaz y en los documentos. Los segmentados no cambiaron (excepción 1), y una prueba lo vigila byte a byte.

## Pasos
| Paso | Estado | Commit | Notas |
|---|---|---|---|
| B1 · Tokens | hecho | `b49239b` feat(web): ronda-3 design tokens | Renombres mecánicos; `--ink-3` de hoy → `--ink-3t` (mismo gris); `--blue` → gris |
| B2 · Radios, sombras y colores de dato | hecho | `6a0ffd0` refactor(web): radii, shadows and data fallbacks from tokens | `--r-xs` nuevo (3 px); paneles con anillo de `--line` en lugar de sombra |
| B3 · Partir `mockup.css` | hecho | `c5ee7aa` refactor(web): split mockup.css by screen | 26 vistas × 2 anchos idénticas píxel a píxel; e2e 120 pasan |
| B4 · Componentes base | hecho | `f54e5f0` feat(web): base components in ronda-3 style | Botón 30/7, campo 34/8, estado 22/6, tabla, filtros, diálogo; foto de los segmentados |
| Arreglo · doble % | hecho | `ba9898a` fix(web): double percent sign in price shortcuts | La plantilla y `t()` ponían cada uno su % |
| B5 · Componentes compartidos | hecho | `d03e27e` feat(web): shared panels, figures and charts | `PieceThumb` reemplaza a `Piece3d` en Inicio y Existencias |
| B6 · Vocabulario | hecho | `77fc178` feat(web): ronda-3 vocabulary | `es.ts`, `messages.ts`, `13 §9.3`, `06`, `CLAUDE.md` |
| Informe y progreso | hecho | este | |

## Pruebas
- **Web (vitest):** 14 archivos, 94 pruebas. Nuevas: `tokens.test` (valores de §2; toda `var(--x)` declarada; ningún token quitado en uso; sin hex en componentes; radios solo de token, `0`, `%` o `99px`; sombras solo `none`, `--sh-up`, `inset` o anillo; reglas de segmentados idénticas a `segmented.snapshot.json`), `components.test` (Pill: texto y tono, `ok` = `good`; Button: tamaños; Table: `Th`/`Td` con `.r` y `.hide-sm`, `fit`), `ronda3.test` (Kpis n3/n4, Meter 0–100, WeekColumns alturas y `.tcol`, Per100Bar suma 100, HBarList de mayor a menor, Steps hecho/actual/fecha, AlertRow, PieceThumb foto o `hexes[0]`), `t.test` (ningún `%` después de un parámetro de porcentaje).
- **`pnpm test`:** 56 archivos, 623 pruebas (7 omitidas, como antes); cobertura 93.5 % instrucciones, 82.2 % ramas, 91.9 % funciones, 95.6 % líneas. **`pnpm test:tz`:** 167. **`pnpm lint`:** 0 errores, sin violaciones de dependencias. **`pnpm typecheck`:** ok.
- **`pnpm security`:** pasa (lint de seguridad, audit, secretos, 153 pruebas de cabeceras, acceso, inyección, importación y falla a la mitad).
- **`pnpm size`:** JS inicial 213.7 KB de 350 KB.
- **`pnpm e2e` completo:** 120 pasan y 5 omitidas (las de escritorio, que piden Electron), tras B3 y otra vez tras B6. Antes de cerrar cada paso se corrieron las del paso (`smoke-all`, `no-purple` en B4; las 8 de textos en B6).
- Rendimiento: sin cambios de API ni consultas en esta fase.

## Comparación con la maqueta
B no rehace pantallas (eso es C), así que la comparación es de **componentes base** y de que nada se rompa.

| Qué | 1440 | 820 | 390 |
|---|---|---|---|
| B3 (partir CSS): 26 vistas | idéntico (píxel a píxel) | — | idéntico (píxel a píxel) |
| Botones, campos, estados, tablas, filtros, diálogo y cajón en las 26 vistas | igual a `ui.css` en tamaños, radios y colores | igual | igual |
| Panel, Kpis, Meter, WeekColumns, Per100Bar, HBarList, Steps, AlertRow, PieceThumb (página de prueba, fuera del repositorio) | igual a `.ui-panel`, `.kps-row`, `.ui-meter`, `.cc`, `.sp-bar`, `.tp`, `.ui-steps`, `.al-list`, `.prod-ph` | — | igual (2 × 2, alerta sin botón, pasos sin fecha ≤ 480) |
| Segmentados (`.seg`, `.seg2`, `.seg wide`, `.seg tabs`) | sin cambio (E1) | sin cambio | sin cambio |

Diferencias aceptadas: el cuerpo sigue en 15 px (los segmentados heredan ese tamaño; ver decisiones), el borde de campo sigue en `--line-2` (contraste), y el marco (barra lateral, encabezado) es de C1.

## Decisiones tomadas
`docs/decisiones.md`: «Ronda 3 · Fase B · B1–B4» y «Ronda 3 · Fase B · B5–B6». Las principales: `--ink-3t` para el texto gris claro de hoy; `--r-xs`; reglas de partición del CSS; borde de campo `--line-2` (*para revisión*); foto de los segmentados y cuerpo en 15 px; filtros neutros; `Pill tone="ok"`; "Stock bajo" como única excepción a "sin Stock"; "Cobro · saldo", "Impresoras disponibles" y "Disponibles" del CSS del armador por coherencia.

## Bloqueado o dudoso
- Nada bloqueado.
- **Cuerpo de 14 px (§2):** si C1 lo baja, los segmentados se achican; antes hay que fijar su tamaño, y eso cambia `segmented.snapshot.json` (es una decisión de C1, no un cambio libre).
- **`--c-*`, `--sand` y `--tg-*`** siguen (las gráficas viejas los nombran); C los quita al rehacer Reportes, Ventas, Gastos y la Pieza. Después conviene agregarlos a la lista de quitados de `tokens.test`.
- Reglas viejas que quedan en archivos de pantalla y que C debe quitar al rehacer: `.tcol`/`.rk-*` (Reportes), `.lay*`/`Piece3d` (Productos), `.lay-img` (Existencias, ya sin uso), `.brf*` (en `base.css` porque la usan 9 pantallas: cada grupo deja de usarla y la coordinación la borra al final de C).

## Qué conviene que revise la persona
- Botones de 30 px y estados de 22 px en el celular (la maqueta los dibuja así; son más chicos que antes).
- Los filtros (chips) ya no tienen color (antes ámbar/rojo/verde): el color queda para los estados.
- Las palabras nuevas con datos reales: «Stock bajo», «Apartado», «Saldo $500», «Fecha de entrega», «Margen mínimo».

## Cómo probarlo
```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:tz
pnpm e2e
pnpm security && pnpm size
pnpm dev   # y abrir /existencias, /pedidos/pedido?id=…, /filamentos?f=… a 1440, 820 y 390
```

## Cómo usar los componentes (para los agentes de la fase C)
Todo se importa de `apps/web/src/components/` y ya tiene su estilo en `styles/base.css`: **no hace falta CSS nuevo para estas piezas** y no se toca `components/`, `tokens.css` ni `base.css`. Los textos salen de `es.ts` (de su bloque `screens.<pantalla>`); los montos llegan ya formateados (`centsTotal`, `grams`, …) en `display`, y el número para el tamaño en `value`. Si un componente no alcanza, se anota y lo resuelve la coordinación.

| Componente | Uso | Notas |
|---|---|---|
| `Panel` (`Panel.tsx`) | `<Panel title={L.alerts} aside={<Count n={5} />}>…</Panel>` | Blanco, borde, radio 12, sin sombra. `aside`: botón, `Count` o `<span className="meta">`. `flush` para un panel que solo tiene una tabla |
| `Count` | `<Count n={3} />`, `<Count n={3} light />` | Contador negro o gris claro |
| `Kpis` (`Kpis.tsx`) | `<Kpis label={…} items={[{ label: L.sales, value: centsTotal(x), sub: '▲ 14.6%', tone: 'up' }, …]} />` | 3–5 cifras en una franja; 2 × 2 en celular. `tone`: `net` (verde), `bad` (rojo), `up`/`down` (solo la línea de abajo). `inline` dentro de un panel (solo borde de arriba) |
| `Meter` (`Meter.tsx`) | `<Meter value={62} />`, `<Meter value={g} max={total} tone="warn" label={…} />` | 6 px; gris; `ok`/`warn`/`bad` solo si el estado lo es. Sin `label` es decorativa: escribir el número al lado |
| `WeekColumns` (`charts.tsx`) | `<WeekColumns label={…} legend={{ sales: L.sales, profit: L.grossProfit }} testId="chart-cols" columns={buckets.map((b) => ({ key, label, sales: b.incomeCents, profit: b.profitCents, display: centsTotal(b.incomeCents), title }))} />` | Gris claro con la ganancia verde dentro; `.tcol` en cada columna; sin `display` no escribe monto (para muchas columnas) |
| `Per100Bar` (`charts.tsx`) | `<Per100Bar label={…} cost={{ label, value, display }} net={{ label, value, display }} items={[…]} />` | Las dos partes suman 100; una pérdida es todo costo. `items` se ordenan solos |
| `HBarList` (`charts.tsx`) | `<HBarList tone="green" items={[{ key, label, meta, value, display, onClick, actionLabel }]} limit={5} />` | Ranking de un color (`green` ganancia, `ink` gastos); se ordena solo; `onClick` vuelve la fila botón (Enter/Espacio) |
| `Steps` (`Steps.tsx`) | `<Steps label={…} current={i} steps={[{ key: 'quoted', label: L.quoted, date: o.createdOn ? date(o.createdOn) : undefined }, …]} />` | Hechos en negro con palomita, actual con anillo; fecha solo si viene (D-1) |
| `AlertList` + `AlertRow` (`AlertRow.tsx`) | `<AlertList label={…}><AlertRow tone="bad" icon="warn" title={…} detail={…} action={<Button size="sm">…</Button>} /></AlertList>` | Ícono en cuadro del color; en celular se oculta el botón (`.btn`), así que la fila debe poder abrirse de otro modo si hace falta |
| `PieceThumb` (`PieceThumb.tsx`) | `<PieceThumb photoUrl={p.photoUrl} hexes={p.hexes} size={44} />`, `<PieceThumb … shape="wide" />` | Foto o cubo del color del primer filamento; `wide` para la ficha de Productos (160 × 84) |
| `Pill` (`Pill.tsx`) | `<Pill tone="ok">{status.stock.ok}</Pill>` | 22 px con punto; `ok`/`good` verde, `warn` ámbar, `bad` rojo, `info` gris con tinta, sin tono gris |
| `Button` (`Button.tsx`) | `<Button variant="primary">`, `size="sm"` | 30 px (26 `sm`); `green` se ve como `primary` (el verde es solo ganancia) |
| `Table`, `Th`, `Td` (`Table.tsx`) | `<Table fit head={<><Th>…</Th><Th r hideSm>…</Th></>}><tr className="click"><Td>…</Td><Td r hideSm>…</Td></tr></Table>` | Encabezado gris 11.5, filas con línea suave; `r` números a la derecha; `hideSm` se oculta ≤ 760; `fit` sin ancho mínimo |
| Clases sueltas | `.tag` (filtro), `.meta` (línea gris 12.5), `.num` (números tabulares), `.hide-sm` | Los filtros tipo chip ya tienen el aspecto de `.ui-chip`; **los segmentados `.seg`/`.seg2` no se tocan** |

Reglas para C: el CSS propio de cada pantalla va en `features/<f>/<f>.css` (ya importado por su página); colores solo con tokens (`var(--…)`, ningún hex); radios con `--r-*`; paneles sin sombra; no cambiar nombres de clases que usan las pruebas (D-2). Si una regla vieja de `base.css` estorba, se sobrescribe en el archivo de la pantalla y se anota para que la coordinación la quite.
