# 01 · Visión y decisiones

## Qué es

Un sistema para llevar un negocio de impresión 3D: calcular lo que cuesta cada pieza, fijar precios, vender, tomar pedidos, producir en las impresoras, controlar filamento e insumos y ver cuánto se gana.

Nace para **Quick Robot** (Guadalajara) y está pensado desde el inicio para convertirse en un **producto que se vende por suscripción** a otros negocios del mismo tipo.

## Una sola base de código, dos usos

| | Uso personal | Producto público |
|---|---|---|
| Quién | Quick Robot, en una Mac | Cualquier negocio de impresión 3D |
| Dónde corre | Aplicación de escritorio (Electron) | Aplicación web con cuentas |
| Datos | En la Mac | En la nube, separados por negocio |
| Pago | — | Suscripción |

**El producto es la aplicación web.** La aplicación de escritorio es una cáscara que se puede quitar sin tocar el resto (`02`).

## Alcance

**Dentro:** costeo con fórmula, calculadora de piezas y colecciones, ventas y pedidos con abonos, devoluciones y cancelaciones, existencias con piezas apartadas, producción con colas por impresora, filamento por rollos, insumos y proveedores, compras sugeridas, clientes, gastos, reportes, cotizaciones y notas de venta, búsqueda y atajos, copias de seguridad.

**Fuera (a propósito):** facturación fiscal (CFDI) e IVA; etiquetas con QR; archivos 3MF/STL adjuntos; recordatorios de cobro automáticos. El tiempo de trabajo de la persona no entra al costo: el precio es libre ("precio por valor").

## Estado actual

- El **diseño y las funciones están completos** en el mockup (`Quick Robot mockup.html`): 14 pantallas en el menú y 5 de detalle (calculadora, colección, armador de venta o pedido, pedido y ficha de cliente).
- La **planeación del producto está completa hasta la fase 4** (documentos 01 al 15, prompts por fase, datos y textos extraídos del mockup, íconos provisionales). Lo que falta planear es la **fase 5** (cuentas, planes y cobro, lanzamiento, legal): documentos `16`, `17` y `legal/`.
- Lo que falta es **construir**, empezando por el prompt de la fase 1 en `prompts.md`.

## Decisiones tomadas

| # | Decisión | Dónde se explica |
|---|---|---|
| D1 | Un solo producto web-first; Electron como cáscara removible | `02` |
| D2 | Todo dato de negocio lleva `workspace_id` desde el primer día | `02 §5`, `05` |
| D3 | Reglas de negocio en un paquete puro (`core`), probado con los casos numéricos de `04` | `04` |
| D4 | El servidor es la autoridad: recalcula y guarda; casos de uso en una transacción | `08` |
| D5 | Inventarios como libros de movimientos, no saldos | `04`, `05` |
| D6 | Nada específico de Quick Robot en el código: los datos del negocio son registros | `02 §7` |
| D7 | Monorepo pnpm; React + TypeScript + Vite; Tailwind + shadcn/ui; TanStack Query/Router; Zustand; react-hook-form + Zod | `07` |
| D8 | API escrita a mano sobre contratos Zod; Hono; Drizzle | `08` |
| D9 | Código, nombres y comentarios técnicos en inglés; interfaz en español | `CLAUDE.md` |
| D10 | Solo modo claro, solo Geist, vocabulario fijo del mockup | `07` |
| D11 | La simplificación del menú (14 → 9 pantallas con pestañas) queda **pospuesta**; el menú actual funcionó | — |
| D12 | Mac como plataforma de escritorio por ahora | `09` |
| D13 | Postgres en las dos versiones: PGlite en la Mac, Postgres administrado en la nube | `02 §4` |
| D14 | Pantallas con React + Vite, **sin** framework tipo Next.js; servidor Hono. El sitio público, si se hace, es un proyecto aparte | `07`, `08` |
| D15 | Orden: primero la web con datos locales; luego Electron; al final la nube | `09` |
| D16 | Servidor dentro de la misma app de Electron, en un solo proceso (se separa solo si la ventana se traba) | `02` |
| D17 | Copia de seguridad: un solo archivo que la app guarda sola | `02 §6` |
| D18 | Actualizar en la Mac = instalar la versión nueva a mano; sin firma de Apple por ahora; datos en carpeta aparte | `02` |
| D19 | La construcción es **autónoma** con protocolo, pruebas y rastro (commits por paso, informe por fase) | `CLAUDE.md`, `10` |
| D20 | OWASP Top 10:2025 como estándar de seguridad para todo lo web, con chequeo `pnpm security` obligatorio | `11` |
| D21 | La app de escritorio no pide contraseña propia; la copia de seguridad va sin cifrar con aviso en pantalla | `11` |
| D22 | Contrato de API detallado: éxito `{ data, warnings? }`, error `{ code, message, details?, errorId? }`; códigos estables; el texto en español lo pone la interfaz | `12` |
| D23 | Todo texto sale de `es.ts`, construido a partir del mockup; las eliminaciones se confirman con un segundo toque en el botón, no con cuadros de diálogo | `13` |
| D24 | Convenciones de código, Conventional Commits, pruebas por capa, umbrales de cobertura y `fast-check` solo en pruebas | `14` |
| D25 | Se diseña para cinco años de uso (25 000 ventas); presupuestos de tiempo, límites de entrada, imágenes reducidas en el navegador | `15` |
| D26 | Nunca pantalla en blanco ni error técnico; pantallas de falla propias de Electron; copias automáticas diarias (últimas 7) mediante `BackupStore` | `15`, `08` |
| D27 | Ventas y pedidos apuntan al canal por id (renombrar toca una fila); todo pedido tiene cliente | `05` |
| D28 | Íconos, logo y mascota provisionales, generados de la mascota del mockup; reemplazables sin tocar código | `assets/README.md` |
| D29 | El secreto del servidor local lo agrega Electron como encabezado a cada petición de su ventana; la interfaz nunca lo maneja | `12 §1`, `11` |
| D30 | La marca del producto (mascota, íconos) vive en `assets/`; el nombre y el giro que se ven en pantalla y en documentos son datos del negocio (Ajustes). El logo con el texto “Quick Robot” es solo para uso externo | `06 §1` y `§14`, `assets/README.md` |
| D31 | Toda tabla de negocio, también las hijas, lleva `workspace_id` (clave foránea compuesta con su padre); solo `workspace` y `user` no | `05` |
| D32 | “Deshacer” existe solo para eliminaciones (borrado suave). Devolver una venta y cancelar un pedido no se deshacen: mueven dinero y existencias | `06 §1`, `12`, `13 §5` |
| D33 | Segunda persona: nunca en botones ni títulos; los mensajes heredados del mockup conservan su imperativo y los nuevos van en infinitivo o impersonales | `13 §1` |
| D34 | Los paquetes internos usan el alcance neutral `@app/*` | `14 §1` |
| D35 | Los estados de filamento, rollo, insumo y pieza en Existencias se definen en `04` con sus valores internos en `03` (el mockup los tenía solo en código) | `04 §1` y `§5`, `03`, `13 §8` |
| D36 | Panel neutro: sin la marca de Quick Robot (mascota, nombre) y sin su color. La barra lateral muestra un monograma con el nombre y el giro de Ajustes. Motivo: el panel se va a distribuir a otros negocios | `mejoras/ronda-2.md §2`, `06 §1`, `07` |
| D37 | Regla de color: **gris oscuro = costo, verde = ganancia** (reemplaza “morado = costo”); todo el color sale de tokens en un solo archivo, con `--accent` neutro | `07`, `CLAUDE.md` |
| D38 | Variantes agrupadas: una familia = original + variantes (un solo nivel, `parent_id` siempre a la raíz), con `variant_label` y `displayName`; “Piezas N” cuenta familias; eliminar una original con variantes se bloquea (`PRODUCT_HAS_VARIANTS`) | `mejoras/ronda-2.md §3`, `05`, `12` |
| D39 | Existencias: vista Lista (por defecto) además de Fichas; fichas sin cuadritos por unidad (número grande y barra); familias como una fila o ficha con sus miembros | `mejoras/ronda-2.md §4`, `06 §10` |
| D40 | Estado de una familia en Existencias: suma de sus miembros; “Pocas” si algún miembro tiene 2 libres o menos (marcado para revisión por la persona) | `04 §5` caso 5.3 |
| D41 | Inicio: “Atención” es la columna principal, agrupada en Urgente · Esta semana · Para revisar (`severity` = `urgent` \| `soon` \| `review`); se quita la cuadrícula de rollos | `mejoras/ronda-2.md §5`, `06 §2`, `12` |
| D42 | Regla de pocos clics: patrones P1–P9, medición por flujo y presupuesto de clics fijado en pruebas; no se quitan confirmaciones de acciones que mueven dinero o existencias | `mejoras/ronda-2.md §11–§12` |
| D43 | Ronda 2 en cuatro fases seguidas (medir, construir, medir clics, acortar clics) con fusión a la rama principal sin pedir permiso al cerrar cada una en verde (excepción a “dejar la rama lista”) | `CLAUDE.md`, `mejoras/ronda-2.md §1` |
| D44 | Con datos reales en uso, toda migración de la ronda 2 es solo aditiva, con copia previa y probada contra casos raros (cadenas, huérfanas, nombres con “(variante)”) | `mejoras/ronda-2.md §1.6` |
| D45 | Las maquetas de `reference/ronda-2/` mandan en estructura y comportamiento; los radios y sombras de componentes existentes son los del sistema | `mejoras/ronda-2.md` |

## Decisiones abiertas

| # | Pregunta | Cómo se resuelve |
|---|---|---|
| O1 | ~~PGlite o SQLite~~ **Decidido: Postgres en ambos** (ver D13). Queda la comprobación de un día de PGlite | Paso 1.0 de la fase 1 |
| O2 | ~~Servidor dentro del proceso de Electron o aparte~~ **Decidido: dentro, en un solo proceso** (ver D16) | — |
| O3 | Proveedor de pagos (Stripe o Mercado Pago) | Fase 5 |
| O4 | Hosting de la nube y base administrada | Fase 5 |
| O5 | Método de acceso: correo + contraseña o enlace mágico | Fase 5 |
| O6 | Manejo exacto de redondeo de dinero (centavos enteros en base, pesos en `core`) | Primeras pruebas de la fase 1; se fija en `money.ts` |
| O7 | Nombre comercial y dominio del producto público | Antes de la fase 5 |
| O8 | Arte final de R1 (la mascota actual sale del mockup) | Opcional, cuando exista; se reemplazan los archivos de `assets/` |
| O9 | Planeación de la fase 5: cuentas y negocios, planes y cobro, lanzamiento, legal (`16`, `17`, `legal/`) | Antes de empezar la fase 5 |

## Principios de trabajo

1. El mockup es la referencia de comportamiento. Si algo se ve distinto en el producto, se revisa contra el mockup.
2. Primero la regla con su prueba, después la pantalla.
3. Cada fase termina con algo usable y verificable, no con "casi listo".
4. Lo que no está en el alcance no se agrega por el camino; se anota en "Después" de `09`.
