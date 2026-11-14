# Progreso

Estados: `no iniciada` · `en curso` · `igual al mockup` · `verificada con datos reales`.

| Pantalla | Fase | Estado | Notas |
|---|---|---|---|
| Inicio | 3 | igual al mockup | Brief, imprimiendo ahora, atenciones con su botón |
| Productos (lista) | 2–3 | igual al mockup | Vendidas, existencias y Vender/Pedido ya con datos reales |
| Calculadora | 2 | igual al mockup | Desglose en vivo con `core`; "Registrar venta" se activa en la fase 3 |
| Colección | 2 | igual al mockup | Sets armables se llenan con Existencias (fase 3) |
| Ventas | 3 | igual al mockup | Lista, detalle con desglose, abono, devolver, editar, eliminar con Deshacer |
| Armador de venta o pedido | 3 | igual al mockup | Venta, pedido nuevo y editar pedido; reparto de existencias como `bAlloc` |
| Pedidos (tablero, lista y calendario) | 3 | igual al mockup | Calendario comparado en 1440 y 390 |
| Pedido (página) | 3 | igual al mockup | Cuatro pestañas y diálogos de pago, producción, entrega y cancelación |
| Filamentos | 1–2 | igual al mockup | Lista, cajón, agregar/editar/eliminar rollo con Deshacer y movimientos |
| Insumos | 2 | igual al mockup | Tarjetas, cajón, compra, uso/ajuste, editar/eliminar con Deshacer |
| Impresoras | 2–3 | igual al mockup | Cola con avance y "Terminó este trabajo"; inversión recuperada real |
| Producción | 3 | igual al mockup | Lista, registrar impresión, detalle y deshacer |
| Existencias | 3 | igual al mockup | Cubos, cajón, ajustar y llevar existencias |
| Compras | 3 | igual al mockup | Lista por proveedor, copiar, proveedores |
| Clientes (lista) | 3 | igual al mockup | |
| Ficha de cliente | 3 | igual al mockup | Totales, historial y logo |
| Gastos | 3 | igual al mockup | Más el filtro de periodo de `06` en "Todos los gastos" |
| Reportes | 3 | igual al mockup | Más el bloque "Inversión recuperada" de `06` |
| Ajustes | 2–4 | igual al mockup | Costos, canales, documentos, Copia de seguridad (descargar, restaurar, copias automáticas, vaciar) y Exportar a Excel |
| Documentos (cotización y nota) | 3 | igual al mockup | Columna "Total" (vocabulario de `13`) |
| Buscar y atajos | 3 | igual al mockup | ⌘K, "?", G + letra, ⌘Z |
| Estados de falla (`15 §5`) | 3–4 | igual al mockup | Web (`e2e/failure-states.spec.ts`) y escritorio: no responde, migración fallida, archivo ilegible (`e2e/desktop.spec.ts`) |
| Marca: ícono, logo, mascota | 4 | provisional | `assets/`; reemplazable con el arte final de R1 |

## Fases

| Fase | Estado | Informe |
|---|---|---|
| 1 | terminada | `docs/informe-fase-1.md` |
| 2 | terminada | `docs/informe-fase-2.md` |
| 3 | terminada | `docs/informe-fase-3.md` |
| 4 | terminada en lo que no requiere la Mac (falta: .dmg en tu Mac y una semana de uso con tus datos) | `docs/informe-fase-4.md` |
| 5 | planeación pendiente (`16`, `17`, `legal/`) | `docs/informe-fase-5.md` |

## Ronda 2 (`mejoras/ronda-2.md`)

Estados: `no iniciada` · `en curso` · `igual a la maqueta de la ronda 2` · `terminada`.

| Parte | Fase | Estado | Notas |
|---|---|---|---|
| Medición del rediseño | A | terminada | `docs/mejoras/informe-ronda2-a.md`: inventario, morado y marca, datos, línea base de rendimiento y plan de la B (24 pasos) |
| Panel neutro (sin morado; la mascota se queda) | B | terminada | Tokens en un solo archivo, `--accent`, `--cost`; sin morado en pantalla (`e2e/no-purple.spec.ts`). La mascota volvió por decisión de la persona (2026-11-13, `086821c`) |
| Datos y API (familias, `variant_label`, `severity`) | B | terminada | Migración aditiva 0007; `GET /products` y `/stock` por familias, `/products/options`, `severity`, `PRODUCT_HAS_VARIANTS`; `pnpm perf` en verde (`informe-ronda2-b.md`) |
| Productos (fichas y lista con variantes agrupadas) | B | igual a la maqueta de la ronda 2 | 1440, 820 y 390; diferencias aceptadas en `informe-ronda2-b.md` |
| Existencias (lista y fichas simplificadas) | B | igual a la maqueta de la ronda 2 | Móvil: filas en tarjeta; 820: fichas en 3 columnas (aceptado) |
| Inicio (atención por prioridad, sin rollos) | B | igual a la maqueta de la ronda 2 | Fase B cerrada: `docs/mejoras/informe-ronda2-b.md`; sigue la fase C (medir clics) |
| Medición de clics | C | terminada | `docs/mejoras/informe-ronda2-c.md`: 35 flujos medidos en `e2e/clicks/` (presupuestos en `e2e/clicks/budget.ts`), 16 “hacer” ordenados (D1 = P1 en filas nuevas, primero); sigue la fase D |
| Mejoras de clics | D | terminada | `docs/mejoras/informe-ronda2-d.md`: las 16 “hacer” de C hechas (D1–D9, T1), selector accesible `components/Picker.tsx`; 35 flujos: 131 → 117 clics y 25 → 16 campos (`e2e/clicks/budget.ts`). **Ronda 2 terminada** (resumen final en ese informe); lo siguiente es la fase 5 |


## Ronda 3 (`mejoras/ronda-3.md`)

Estados: `no iniciada` · `en curso` · `igual a la maqueta de la ronda 3` · `terminada`.

| Parte | Fase | Estado | Notas |
|---|---|---|---|
| Inventario contra la maqueta | A | en curso | Excepciones de la persona: interruptores y cajón de filamento como hoy; la mascota se queda (`decisiones.md`, 2026-11-14) |
| Tokens y componentes base | B | no iniciada | |
| Pantallas (17 pasos de §6) | C | no iniciada | |
| Revisión visual, accesibilidad y textos | D | no iniciada | |
