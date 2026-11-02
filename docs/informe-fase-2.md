# Informe · Fase 2 · Taller y catálogo

**Estado:** terminada, lista para fusionar. Todo en verde: `pnpm test` (160 pruebas), `pnpm lint` (incluye las fronteras), `pnpm typecheck` y `pnpm e2e` (9 flujos en el navegador).
**Rama:** `claude/wizardly-fermi-3ur0nk` (y `fase-2` local en el mismo commit).
**Criterio de terminado de `10`:** `golden.test.ts` pasa para **todas** las piezas (9) y colecciones (2) de ejemplo ✔ · las pantallas de la fase se ven y se comportan como el mockup ✔ (comparadas en 1440, 820 y 390 px).

---

## 1. Lo que se hizo (un commit por paso)

| Paso | Commit | Qué quedó |
|---|---|---|
| 2.1 | `test(golden): export mockup costs and prices…` | `tools/export-mockup-golden.mjs` saca del **propio código del mockup** (sin modificar `reference/`) los costos y precios de cada pieza y colección → `packages/core/test/golden/mockup-values.json` |
| 2.2 | `feat(core): piece cost, pricing, sets and printer rules…` | `costs.ts` (M, L, Q, E, fallos, promedio de impresoras), `pricing.ts` (sugerido, piso, lista, sets, reparto), `printers.ts` (mantenimiento, inversión recuperada), `golden.test.ts` |
| 2.3 | `feat(db): …tables…` y `feat(server): …` | 15 tablas nuevas con `workspace_id`, llaves compuestas y prueba de aislamiento; casos de uso por área: ajustes y canales, catálogo, proveedores, insumos, rollos (editar, eliminar, movimientos), impresoras y mantenimiento (crea gasto), piezas, variantes, colecciones y fotos; semilla completa del mockup; **golden del servidor** |
| 2.4 | `feat(web): Productos…, Insumos, Impresoras, Ajustes…` | Pantallas: Productos (fichas y lista, piezas y colecciones), **Calculadora** (desglose en vivo con `core`), Colección, Insumos (tarjetas, cajón, compra, uso/ajuste), Impresoras (mantenimiento, "Hecho"), Ajustes (costos, canales, documentos), Filamentos completo (editar/eliminar rollo con Deshacer, movimientos) |

Además, en `core`: `costing.ts` (`costProduct`, `costCollection`) es **la única función de costeo**; la usan el servidor (autoridad) y la calculadora en el navegador, así nunca pueden dar números distintos.

## 2. Los números coinciden con el mockup

| Pieza | Costo mockup | Precio de lista | ¿Igual en `core`? | ¿Igual en el servidor? |
|---|---|---|---|---|
| Llavero con nombre | $3.67 | $50 | ✔ | ✔ |
| Servilletero con logo | $26.75 | $120 | ✔ | ✔ |
| Spider-Man · salto | $38.96 | $250 | ✔ | ✔ |
| Spider-Man · trepando | $36.35 | $250 | ✔ | ✔ |
| Doctor Doom · busto | $41.56 | $250 | ✔ | ✔ |
| Hulk · puño | $37.90 | $250 | ✔ | ✔ |
| Soporte de celular PETG (fórmula) | $39.28 | $79 | ✔ | ✔ |
| Letrero de taquería | $68.89 | $450 | ✔ | ✔ |
| Spider-Man · salto (silk morado) | $43.01 | $250 | ✔ | ✔ |
| Colección Doomsday blanca | $179.78 | $1,000 (sueltas $1,000) | ✔ | ✔ |
| Spider-Man · 2 poses | $85.31 | $450 (sueltas $500) | ✔ | ✔ |

Se comparan M, L, Q, E, reserva de fallos, costo, precio de lista, piso y sugerido (también por cada canal), con tolerancia ±0.01. También coinciden el costo por gramo de los 7 filamentos y la existencia de los 4 insumos (incluido lo que gastó el historial de impresiones del mockup).

## 3. Pruebas

| Suite | Pruebas | Qué cubre |
|---|---|---|
| `core` | 71 | Casos **2.1** (35.9474), **3.1** ($72, piso $51.35, canal 17 % $108.93), **3.2** (sueltas $194), **3.3** ($126.19 / $43.81), **11.1** (Pronto / Toca ya), **11.2** (16.7 % / 50 %), insumos (§9 estado, compra, uso/ajuste), golden (18) |
| `db` | 22 | Aislamiento de **todas** las tablas nuevas: listas, búsquedas por id, sumas, actualizaciones y borrados con la sesión de A nunca tocan B; las llaves compuestas rechazan referencias cruzadas; migraciones en PGlite y Postgres 16 |
| `server` | 53 | Golden del servidor (14), ajustes y canales (duplicados, último canal, restaurar), catálogo que crece, insumos (compra actualiza costo, uso, conteo, sin pasar de lo que hay, proveedor borrado, atomicidad), rollos (ajuste al editar gramos, mover de filamento, eliminar/restaurar), impresoras (tareas base, caso 11.1 por el servidor, "Hecho" crea gasto), piezas (caso 2.1/3.1 por el servidor, **ignora costos enviados por el cliente**, validaciones, variante, colecciones, atomicidad, fotos) |
| `contract` | 3 | Validación de entradas |
| `tools` | 11 | Prueba negativa de fronteras (se mantiene) |
| `e2e` | 9 | Catálogo con los números del mockup · calculadora: **el costo en vivo es el que se guarda** · subir el kWh sube el costo · insumo: alta, compra, uso (rechaza pasar de lo que hay), eliminar y Deshacer · movimiento de filamento · colección nueva ($79.46, $500) · impresora nueva con 3 tareas y "Hecho" con gasto · editar gramos de un rollo y eliminar con Deshacer · (fase 1) agregar rollo y reinicio |

## 4. Decisiones tomadas (detalle en `docs/decisiones.md`)

1. **Golden sin tocar `reference/`**: se sirve una copia en memoria del mockup con un gancho a sus funciones.
2. **Editar un rollo** agrega un movimiento `adjustment` por la diferencia (el libro no se reescribe; el mockup sí lo hacía).
3. **Borrado suave + restaurar en todo**, sin reescribir referencias (pieza → impresora borrada se costea con el promedio; colección ignora piezas borradas).
4. **Tiempo en minutos enteros** (`print_minutes`) para no perder centavos al redondear horas.
5. **Fotos** con `FileStore` y `product.photo_file_id` (no estaba en `05`), guardadas en la misma operación que la pieza.
6. **Tabla `expense`** creada ahora porque "Hecho" con costo crea un gasto; su pantalla es de la fase 3.
7. **El servidor no inventa textos**: notas por omisión las pone la interfaz desde `es.ts`; los valores genéricos (catálogo inicial, tareas base, categorías) viven en `core` como datos editables.
8. **Colores del costo en grises** (valores finales del mockup) en vez del morado de `07`.
9. Partes que dependen de ventas, pedidos y existencias **se ven pero no actúan** hasta la fase 3.

## 5. Bloqueado o dudoso

- **Nada bloqueado.**
- Pendiente de la fase 3 (se ve en las pantallas como 0 / deshabilitado): existencias y "vendidas" en Productos, Vender/Pedido, sets armables, cola de impresión, inversión recuperada (necesita ventas), prorrateo de gastos recurrentes, renombrar el canal en ventas y pedidos, bloquear el borrado de piezas con pedidos activos o existencias.
- Pendiente de la fase 4: secciones "Copia de seguridad" y "Datos de ejemplo" de Ajustes.
- Proveedores: hay casos de uso y API, pero su pantalla (en Compras) es de la fase 3.

## 6. Lo que conviene que revises

1. **La calculadora** con una pieza tuya: que el desglose (material, luz, máquina, extras, fallos) y los atajos de precio se sientan como en el mockup.
2. **Colores del costo**: el mockup final los pinta en grises; CLAUDE.md y `07` dicen morado. Hoy se ve como el mockup. Si prefieres morado, es cambiar 5 tokens.
3. **Editar un rollo** ya no reescribe la compra: si corriges los gramos aparece un "Ajuste" en los movimientos. ¿Te parece bien así?
4. **Al borrar** una impresora, insumo, pieza o colección, las referencias se conservan para poder deshacer; una pieza con impresora borrada se costea con el promedio de las demás.
5. **Ajustes se guarda al salir de cada campo**, no mientras se escribe.

## 7. Cómo verlo

```bash
pnpm install
pnpm dev          # http://127.0.0.1:5173 — datos del mockup en memoria
pnpm start        # http://127.0.0.1:8787 — compila y guarda en .data/pgdata
```

Pantallas nuevas: `/productos`, `/productos/pieza/nueva`, `/insumos`, `/impresoras`, `/ajustes` (y Filamentos completo).
