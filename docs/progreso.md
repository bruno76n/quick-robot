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
| Panel neutro (sin morado ni marca) | B | no iniciada | |
| Datos y API (familias, `variant_label`, `severity`) | B | no iniciada | Migración aditiva con copia previa |
| Productos (fichas y lista con variantes agrupadas) | B | no iniciada | |
| Existencias (lista y fichas simplificadas) | B | no iniciada | |
| Inicio (atención por prioridad, sin rollos) | B | no iniciada | |
| Medición de clics | C | no iniciada | `docs/mejoras/informe-ronda2-c.md` |
| Mejoras de clics | D | no iniciada | “Agregar filamento” va primero; `docs/mejoras/informe-ronda2-d.md` |

