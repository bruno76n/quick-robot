# 09 · Hoja de ruta

Orden de trabajo (el detalle paso a paso y los archivos de cada fase están en `10-plan-de-construccion.md`). No hay fechas porque dependen de cuánto tiempo se le dedique; cada fase tiene un **criterio de terminado** que se puede comprobar.

**Orden de la idea:** primero la versión web funcionando en tu computadora con tus datos locales; después se envuelve en Electron para usarla a diario sin internet; al final se abre al público con cuentas y suscripción. Es el mismo producto en las tres etapas.

## Fase 1 · Cimientos y esqueleto que camina

- Comprobación de un día de PGlite (criterios en `02 §4`).
- Monorepo, herramientas, fronteras automáticas, pruebas.
- Un recorrido completo mínimo (crear un filamento con un rollo y verlo en la lista) en el navegador, con datos guardados en un archivo local.

**Terminado cuando:** el recorrido funciona en el navegador, las pruebas y las fronteras pasan, y PGlite superó la comprobación (o se anotó el plan B).

## Fase 2 · Taller y catálogo

Filamentos, Insumos, Impresoras, Productos (Calculadora), Colecciones, Ajustes de costos y canales.

**Terminado cuando:** las piezas de ejemplo del mockup dan **los mismos costos y precios** en el producto (comparación automática con valores exportados del mockup).

## Fase 3 · Vender y producir

Existencias, Clientes, Ventas, Pedidos, Producción, Gastos, Reportes, Compras, documentos, Inicio, búsqueda y atajos.

**Terminado cuando:** los seis flujos de `06 §17` pasan de punta a punta y los casos 4.1–10.1 de `04` pasan en `core`.

## Fase 4 · Electron y uso diario

- Envolver la web en Electron (servidor dentro de la misma app), generar el `.dmg`.
- Copia de seguridad en un solo archivo, migraciones locales con copia previa.
- Importador del mockup, exportar y restaurar.
- Revisión pantalla por pantalla contra el mockup.

**Terminado cuando:** tus datos se importan sin diferencias y la app de escritorio se usa a diario en lugar del mockup.

## Fase 5 · Producto público (nube)

Cuentas, negocios separados, planes y suscripción, correo, archivos en la nube, sitio público aparte, revisión de seguridad.

**Terminado cuando:** una persona nueva se registra, crea su negocio vacío, paga el plan, completa el flujo B de `06 §17`, y no puede ver nada de otro negocio.

## Después

Roles y varios usuarios por negocio, catálogo público para clientes, recordatorios de cobro, etiquetas con QR, archivos 3MF/STL adjuntos, aplicación móvil. Nada de esto condiciona las fases anteriores.

## Cómo medir el avance

`docs/progreso.md`: una línea por pantalla con su estado (*no iniciada · en curso · igual al mockup · verificada*). Cada fase termina cuando sus filas llegan a "igual al mockup" y sus pruebas pasan.
