# 07 · Frontend

`apps/web`: la única interfaz del producto. Corre igual dentro de Electron y en un navegador.

## Stack

| Necesidad | Elección | Razón |
|---|---|---|
| Lenguaje | TypeScript estricto | Los contratos con el servidor se verifican al compilar |
| Framework | React 18+ con Vite | Estándar, rápido en desarrollo |
| Estilos | Tailwind CSS con los tokens de diseño del mockup | Los valores del mockup se vuelven variables del tema |
| Componentes base | shadcn/ui (Radix debajo) | Accesibilidad resuelta (diálogos, cajones, menús) y el código es nuestro, se adapta |
| Rutas | TanStack Router | Rutas tipadas; una pantalla = una ruta |
| Datos del servidor | TanStack Query | Caché, recarga e invalidación después de cada operación |
| Estado de interfaz | Zustand (poco) | Solo lo que no es dato: borrador del armador, filtros, vista de lista/cuadrícula |
| Formularios | react-hook-form + Zod | Los mismos esquemas de `packages/contract` validan en cliente y servidor |
| Íconos | Un solo juego (los del mockup se redibujan o se reemplazan por uno equivalente) | Coherencia |
| Pruebas | Vitest + Testing Library; Playwright para flujos | Ver `14` |

## Principios

1. **El cliente muestra; el servidor decide.** La interfaz usa `core` para vistas previas (calculadora, armador) pero guarda lo que devuelve el servidor.
2. **Una operación = una llamada.** "Marcar listo" es un POST; la interfaz no encadena escrituras sueltas.
3. **Después de una operación se invalida lo que tocó.** Cada caso de uso declara qué consultas afecta (`orders`, `stock`, `printers`, …) y la interfaz las recarga.
4. **Los textos viven en `i18n/es.ts`.** Nada de strings sueltos en componentes (facilita revisar el vocabulario y, si hace falta, traducir).
5. **Sin funciones nativas obligatorias.** Descargas, elegir archivo e imprimir pasan por `lib/platform.ts`, que usa `window.desktop` si existe y el navegador si no.
6. **Atajos y paleta de comandos** son parte del producto, no un extra: ⌘/Ctrl+K, `?`, `g`+letra.

## Estructura

Ver `03`. Cada carpeta de `features/` contiene:

```
features/orders/
  routes.tsx          rutas de la pantalla (lista, detalle)
  OrdersList.tsx
  OrderPage.tsx
  components/         piezas propias (OrderStepper, PaymentsTab, …)
  api.ts              hooks de TanStack Query para esta área
  schemas.ts          reexporta lo de contract que usa
```

## Sistema de diseño (tomado del mockup)

**Una sola apariencia: modo claro. Una sola tipografía: Geist.** Se conservan los valores del mockup como tokens de Tailwind/CSS:

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#ffffff` | Fondo |
| `--panel`, `--panel-2` | `#f6f6f8`, `#ececf1` | Paneles, chips neutros, pastillas |
| `--ink`, `--ink-2`, `--ink-3` | `#121214`, `#6a6a73`, `#777782` | Texto: principal, secundario, terciario |
| `--line`, `--line-2` | `#e7e7ec`, `#d2d2da` | Bordes |
| `--purple` | `#6b3fd4` | Acción principal y **Costo** |
| `--purple-soft` | `#efe9fd` | Fondo de costo |
| `--green`, `--green-ink`, `--green-soft` | `#00ae42`, `#067a30`, `#e3f5e9` | **Ganancia**, estados buenos |
| `--amber`, `--amber-ink`, `--amber-soft` | `#e9a817`, `#86500a`, `#fff1d3` | Avisos |
| `--red`, `--red-ink`, `--red-soft` | `#d6334f`, `#b3223f`, `#fde8ec` | Errores, cancelado |
| `--blue` | `#3f86c9` | Informativo |
| `--c-m … --c-f` | morados y gris | Capas de la barra de desglose del costo |
| Radio | tarjetas 20 px, botones/campos 10 px, diálogos 18 px, pastillas 99 px | |
| Texto base | 15 px / 1.45; títulos con espaciado negativo | |

**Regla de color con significado:** *morado = costo*, *verde = ganancia*. Se mantiene en toda la interfaz.

**Componentes que ya existen en el mockup y se reconstruyen como componentes reales:**
`Button` (primary / default / sm / link), `Field` (etiqueta + ayuda), `UnitInput` ($, g, h, %), `Segmented`, `Tag`, `Pill`/`Chip` (con punto de color), `Table` ancha (`xlist`, con columnas y fila clicable), `Drawer` (cajón), `Dialog`, `Toast` (con acción), `Stepper` del pedido, `Tabs`, `Details` plegable, `StatBand` (cifras), `KV` (listas de datos), `Calendar` (mes), `CommandPalette`, `DocumentSheet` (cotización/nota con estilos de impresión).

**Responsivo:** tres anchos probados en el mockup (escritorio, tableta, móvil). La barra lateral se oculta tras un botón en pantallas pequeñas. Sin desbordes horizontales.

**Accesibilidad mínima:** foco visible (anillo morado de 2 px), diálogos y cajones con captura de foco y cierre con Esc, `prefers-reduced-motion` respetado, contraste suficiente en texto terciario.

## Cómo hablar con el servidor

`lib/api.ts` es un cliente tipado escrito a mano a partir de `packages/contract`:

```ts
const order = await api.orders.markReady({ orderId });   // POST /orders/:id/ready
```

- Errores de negocio llegan con un `code` estable (`INSUFFICIENT_STOCK`, `ORDER_NOT_ACTIVE`, …) y la interfaz los traduce a un texto en español desde `es.ts` (`13 §3`); el `message` técnico del servidor nunca se muestra.
- Todas las llamadas van al mismo origen (`/api/v1`). En modo local el secreto de sesión **no lo maneja la interfaz**: la ventana de Electron lo agrega como encabezado a cada petición (en desarrollo, lo agrega el proxy de Vite); en la nube viaja la cookie.
- Contrato completo de operaciones, entradas y errores: `12`.

## Estados de carga y de falla

La interfaz nunca queda en blanco ni muestra errores técnicos (`15 §5`):
- Un **límite de errores por ruta** muestra la tarjeta "Esta pantalla no se pudo mostrar" sin tumbar el menú.
- Banner fijo para "la aplicación no responde" (escritorio) o "sin conexión" (nube).
- Esqueletos de carga a los 300 ms; "Tarda más de lo normal" a los 8 s.
- Todo botón que escribe se deshabilita mientras la petición está en curso ("Guardando…").
- Los mensajes de campo salen de `VALIDATION_ERROR.details.fields` y aparecen bajo el campo (`13 §6`).

## Imágenes

Logos y fotos se reducen **en el navegador** (lado mayor ≤ 1 600 px, JPEG o WebP) antes de subirlas con `POST /files`; el servidor solo valida tipo y tamaño (`15 §4`). Los CSV de Ajustes se generan en `lib/csv.ts`, que neutraliza celdas que empiezan con `=`, `+`, `-` o `@`.

## Textos, formatos y accesibilidad de textos

Todo texto sale de `i18n/es.ts` con el ayudante `t()` (parámetros y plural); formatos de moneda, fechas y duraciones en `lib/format.ts` (`13 §1–2`). Un lint prohíbe texto literal en español dentro de los componentes.

## Desarrollo sin servidor completo

Un servidor de desarrollo (`pnpm dev`) levanta `packages/server` en modo local con PGlite en memoria y la semilla de "Quick Robot" (los datos de ejemplo del mockup), y Vite sirve la interfaz con proxy. Así la interfaz se prueba con datos reales sin Electron.
