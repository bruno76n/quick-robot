# Informe de la fase 2

## Resumen
El taller y el catálogo funcionan con los mismos números del mockup:
- **Costeo:** piezas y colecciones (material, luz, máquina, extras, reserva de fallos), precios (sugerido, piso, lista, sets), impresoras con mantenimiento, e insumos con compras y movimientos.
- **Ajustes:** costos del taller, canales y datos de documentos.
- **Filamentos:** completos, con editar y eliminar rollo, movimientos y "Deshacer".

Las 9 piezas y las 2 colecciones de ejemplo dan el mismo costo y precio que el mockup (±$0.01), en `core` y a través del servidor.

## Pasos
| Paso | Estado | Commit | Notas |
|---|---|---|---|
| 2.1 Golden | hecho | `a5ba7bf` | `golden.test.ts` con `mockup-values.json` (ya incluido) y la copia del mockup |
| 2.2 `core` | hecho | `09d60dd`, `9b42df8` | `costs.ts`, `pricing.ts`, `printers.ts`, `supplies.ts`, `catalog.ts`, `defaults.ts` |
| 2.3 Datos | hecho | `3fd8bcf` | 15 tablas nuevas con `workspace_id` y llaves compuestas, vista `supply_levels`, aislamiento por tabla |
| 2.3 Servidor | hecho | `8435215` | Casos de uso, rutas, archivos y pruebas por área |
| 2.4 Pantallas | hecho | `e384447` | Productos, Calculadora, Colección, Insumos, Impresoras, Ajustes, Filamentos completo |

## Pruebas
- **Reglas de core:** casos **2.1** (35.9474), **3.1** ($72; piso $51.35; canal 17 % $108.93), **3.2** (sueltas $194), **3.3** ($126.19 / $43.81), **11.1** (Pronto / Toca ya), **11.2** (16.7 % / 50 %). También el estado de insumos (`04 §9`) y el golden de las 9 piezas, las 2 colecciones, los 7 filamentos, los 4 insumos y las 6 tareas de mantenimiento.
- **Casos de uso y rutas:** 290 pruebas en verde.

  | Proyecto | Pruebas |
  |---|---|
  | core | 56 |
  | contract | 5 |
  | db | 40 |
  | server | 125 |
  | web | 38 |
  | tools | 27 |

  - Cada operación de `12 §4, §5, §8 y §10` tiene camino feliz y cada uno de sus errores: `CHANNEL_NAME_EXISTS`, `LAST_CHANNEL`, `CHANNEL_IN_USE`, `SUPPLY_NAME_EXISTS`, `SUPPLY_IN_USE`, `SUPPLY_INSUFFICIENT`, `COUNT_UNCHANGED`, `RESTORE_CONFLICT`, `SPOOL_INSUFFICIENT`, `PRINTER_HAS_QUEUE`, `COLLECTION_EMPTY`, `NO_PRODUCTS`, `PRODUCT_IN_ACTIVE_ORDERS`, `PRODUCT_HAS_STOCK`, `STOCK_TRACKING_HAS_STOCK`, `FILE_TOO_LARGE` y `UNSUPPORTED_IMAGE`.
  - El servidor **ignora los costos que manda el cliente**.
  - Cobertura frente a `14 §4`: `core` 100 % de líneas; casos de uso y `web/lib` y `components` sobre su mínimo.
- **Seguridad:** `pnpm security` en verde.
  - **Matriz de acceso:** las 33 rutas con id, llamadas por A con ids de B, responden 404. También las escrituras que apuntan a B desde el cuerpo (filamento, insumo, impresora, foto, pieza). B queda intacto.
  - **Fallo a la mitad:** en las 37 rutas de escritura, cada escritura posible falla por turno y el negocio queda igual.
  - **Inyección:** en todos los campos de texto nuevos.
  - **Límites de `15 §4`:** el valor justo pasa y uno más falla.
  - **Fotos:** un HTML disfrazado de PNG se rechaza.
  - **Servidor HTTP real:** DELETE y POST sin cuerpo pasan; `text/plain` se rechaza.
- **Flujos de Playwright (7):**
  1. Catálogo con los costos del mockup.
  2. La calculadora guarda el costo que muestra.
  3. Insumo: alta, compra, uso de más (se rechaza), eliminar y Deshacer.
  4. Impresora nueva con 3 tareas, y "Hecho" con costo.
  5. Colección nueva.
  6. Rollo: movimiento, editar gramos (agrega un ajuste) y eliminar con Deshacer.
  7. Las 9 vistas de la fase cargan en 1440, 820 y 390 px sin errores de consola ni desborde.

  Además pasa el flujo de la fase 1.
- **Rendimiento:** JS inicial de 135.6 KB comprimido (límite 350 KB). Los presupuestos de tiempo se miden en la fase 3.

## Comparación con el mockup
| Pantalla | 1440 | 820 | 390 |
|---|---|---|---|
| Productos (fichas y lista) | igual | igual | igual |
| Calculadora | igual | igual | igual |
| Colección | igual | igual | igual |
| Insumos (tarjetas, cajón, diálogos) | igual | igual | igual |
| Impresoras | igual | igual | igual |
| Ajustes (costos, canales, documentos) | igual | igual | igual |
| Filamentos (completo) | igual | igual | igual |

Diferencias aceptadas, todas por datos de la fase 3:
- Las cifras "vendidas" en 0.
- "Sin existencias" en lugar de libres y apartadas.
- Sin trabajos en cola en Impresoras.
- Inversión recuperada en 0 %.
- Los botones "Vender" y "Pedido" deshabilitados.

Otras diferencias aceptadas:
- La forma dibujada de cada pieza depende de su id, que no es el del mockup.
- En Ajustes faltan "Copia de seguridad" (fase 4) y "Exportar a Excel" (fase 3).

## Decisiones tomadas
`docs/decisiones.md`, entrada "Fase 2 · Pasos 2.1–2.4". Lo principal:
- **Editar un rollo** agrega un movimiento de ajuste en vez de reescribir la compra.
- **Movimiento de rollo con signo:** negativo saca material.
- **Compra de insumo:** `costCents` es el total pagado y actualiza el costo por unidad.
- **Borrado suave con referencias:** una pieza con impresora borrada se costea con el promedio.
- **Catálogos por negocio** y valores de arranque genéricos.
- **Ganchos para la fase 3:** existencias, ventas, colas y uso de canales.
- **Precisión del costo por gramo:** completa en la API.
- **Regla de "solo JSON":** corregida para escrituras sin cuerpo en el servidor real.

## Bloqueado o dudoso
- **Nada bloqueado.**
- **Para revisar:** los valores de arranque de un negocio nuevo (kWh $3, fallos 5 %, purga 5 %, piso 30 %, fórmula 50 %, canal "Efectivo"). Son ajustes editables, no reglas.
- **Pendiente de la fase 3:** vender, pedidos y existencias. Mientras tanto, los errores que dependen de ellos están probados con ganchos.

## Qué conviene que revises
1. **La calculadora** con una pieza tuya: el desglose, los atajos de precio y "Por cantidad".
2. **Editar un rollo:** si corriges los gramos aparece un "Ajuste" en los movimientos; la compra original no cambia.
3. **Compra de insumo:** el "Total pagado" cambia el costo por unidad de ahí en adelante.
4. **Los valores de arranque** de un negocio nuevo (sección anterior).

## Cómo probarlo
```bash
pnpm install
pnpm dev     # http://127.0.0.1:5173/productos — datos del mockup en memoria
pnpm test && pnpm lint && pnpm typecheck && pnpm security && pnpm e2e
```
