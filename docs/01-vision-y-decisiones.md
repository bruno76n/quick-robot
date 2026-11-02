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
- Lo que falta es **arquitectura y construcción**. Las pantallas y los flujos solo se escriben (`06`).

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

## Principios de trabajo

1. El mockup es la referencia de comportamiento. Si algo se ve distinto en el producto, se revisa contra el mockup.
2. Primero la regla con su prueba, después la pantalla.
3. Cada fase termina con algo usable y verificable, no con "casi listo".
4. Lo que no está en el alcance no se agrega por el camino; se anota en "Después" de `09`.
