# CLAUDE.md — Quick Robot

Sistema para negocios de impresión 3D: costeo, ventas, pedidos, producción, inventarios y reportes. Es **un solo producto**: aplicación web con cuentas y suscripción; la app de escritorio (Electron) es solo una cáscara para uso personal en Mac. Documentación completa en `docs/` (empieza por `docs/README.md`).

## Lo que no se negocia

1. **El producto es la web.** `apps/desktop` (Electron, fase 4) solo arranca el mismo servidor dentro de la app, en `127.0.0.1`, y abre una ventana. No contiene pantallas ni reglas. Debe poder borrarse sin romper nada.
2. **`workspace_id` en toda tabla de negocio y en toda consulta.** Los repositorios reciben `ctx = { workspaceId, userId }`; no existe consulta sin él.
3. **Reglas de negocio solo en `packages/core`**: funciones puras, sin I/O, sin hora ni ids propios. Cada regla con prueba usando los casos numéricos de `docs/04-reglas-de-negocio.md`.
4. **El servidor es la autoridad.** Recalcula con `core` y guarda su resultado; nunca el que mandó el cliente.
5. **Una operación de negocio = un caso de uso en una transacción** (`markOrderReady`, `deliverOrder`, …). La interfaz no encadena escrituras sueltas.
6. **Nada específico de "Quick Robot" en el código.** Nombre, teléfono, canales, comisiones, márgenes y textos de documentos son registros del negocio (`workspace_settings`). Los datos de ejemplo viven solo en la semilla de desarrollo.
7. **Ningún `if (mode === 'cloud')` en reglas ni casos de uso.** Las diferencias entre local y nube se resuelven eligiendo dependencias (`AuthProvider`, `FileStore`, `Entitlements`, `Mailer`) en `apps/desktop` / `apps/cloud`.
8. **Cada pantalla funciona sin funciones nativas.** Lo nativo (`window.desktop`) mejora; nunca habilita.
9. **Inventarios = libros de movimientos** (filamento, piezas terminadas, insumos). Nunca se escribe "hay 7": se suma.
10. **Los artículos vendidos guardan la foto del momento** (precio, lista, costo). Cambiar un precio hoy no reescribe el historial.

## Stack (decidido)

TypeScript estricto · pnpm workspaces · **React + Vite (sin Next.js)** · Tailwind + shadcn/ui · TanStack Router y Query · Zustand (poco) · react-hook-form + Zod · **Hono** · **Drizzle** · **Postgres: PGlite en la Mac, Postgres administrado en la nube** · Electron (se agrega en la fase 4) · Vitest + Playwright. Detalle en `docs/07-frontend.md` y `docs/08-backend.md`. No cambiar de herramienta sin registrarlo en `docs/decisiones.md`.

## Dependencias permitidas

```
web → contract, core
desktop, cloud → server, db, (build de web)
server → contract, core, db
db, contract, core → (nada del monorepo)
```

Cualquier otra flecha está prohibida (lo verifica ESLint/dependency-cruiser).

## Idioma

- **Código, nombres de archivos, tablas, funciones, comentarios técnicos y mensajes de commit: inglés.**
- **Todo texto que ve la persona: español**, siempre en `apps/web/src/i18n/es.ts`. Nunca strings sueltos en componentes.
- Glosario español ↔ inglés en `docs/03-estructura-de-carpetas.md`.

## Vocabulario de la interfaz (fijo)

Total, Costo, Ganancia, Ventas, Saldo, Pagado, Por cobrar, Disponible, Libres, Apartadas, Artículos. Tuteo evitado en la interfaz ("Registrar venta", no "Registra tu venta"); los documentos para clientes sí pueden hablar directo. Color con significado: **morado = costo, verde = ganancia**.

## Diseño

Solo modo claro. Solo tipografía Geist. Tokens en `docs/07-frontend.md`. Si algo se ve distinto del mockup (`Quick Robot mockup.html`), el mockup tiene la razón hasta que se decida lo contrario.

## Datos

- Dinero: centavos enteros en base de datos (`*_cents`); `core` calcula en pesos y redondea en los bordes (`money.ts`).
- Fechas de calendario como `date`; momentos como `timestamptz`.
- Borrado suave (`deleted_at`) en lo que la interfaz puede borrar; "Deshacer" = restaurar.
- Migraciones con Drizzle; una migración nunca borra datos de negocio sin copia previa.

## Modo autónomo

La construcción la hace Claude Code **sin pedir aprobación paso a paso**. Todo lo necesario está en estos archivos.

**Antes de empezar una fase:** leer este archivo, la fase en `docs/10-plan-de-construccion.md` y solo los documentos de su lista "Leer". Crear una rama `fase-N`.

**Mientras trabaja**
1. Un paso a la vez, en el orden del plan: regla con su prueba → tablas → caso de uso con su prueba → ruta → pantalla.
2. **Un commit por paso**, con mensaje en inglés (`feat(core): filament cost per gram`).
3. Un paso **no está terminado** hasta que pasan: pruebas con los números de `docs/04`, las reglas de dependencias entre paquetes (lint), el typecheck y, si hay pantalla, su comparación visual.
4. **Comparación visual:** abrir el mockup (`reference/`) y la pantalla nueva con Playwright en tres anchos (escritorio 1440, tableta 820, móvil 390), tomar capturas, verlas y corregir diferencias de estructura, textos, colores y comportamiento antes de marcar la fila de `docs/progreso.md` como "igual al mockup".
5. **Valores del mockup:** los costos y precios deben coincidir con `packages/core/test/golden/mockup-values.json` (tolerancia ±0.01).

**Cuando algo no está claro, NO preguntar. Decidir así:**
1. Lo que dice el mockup.
2. Lo que dicen `docs/04` (reglas) y `docs/06` (pantallas y flujos).
3. Si nada lo cubre: la opción más simple que respete las reglas de este archivo.
Anotar siempre la decisión en `docs/decisiones.md` (formato en ese archivo). Nunca inventar reglas de negocio de dinero o inventario: si `04` no las cubre, aplicar el paso 3 y marcarlo para revisión.

**Casos de parada (los únicos):**
- Necesita algo que no puede obtener solo: credenciales, cuentas de pago, hosting, firma de Apple.
- Va a modificar o borrar **datos reales** del negocio de forma que no se pueda deshacer (siempre hacer antes la copia de seguridad).
- Dos documentos se contradicen y la contradicción cambia el comportamiento.
- La misma prueba falla tres veces seguidas con enfoques distintos. En ese caso: anotar el bloqueo en `docs/decisiones.md`, dejar el paso marcado como bloqueado y **seguir con los pasos que no dependan de él**.

**Al cerrar cada fase:** escribir `docs/informe-fase-N.md` con lo hecho, qué pasó las pruebas, las decisiones tomadas, lo que quedó bloqueado o dudoso y qué conviene que revise la persona; actualizar `docs/progreso.md`; dejar la rama lista para fusionar. **Ninguna fase se fusiona con pruebas rojas.**

**Nunca:** agregar funciones fuera del alcance de `docs/01`; saltarse una prueba para "avanzar"; cambiar un número esperado de `docs/04` para que la prueba pase; tocar archivos en `reference/`; escribir textos de interfaz fuera de `i18n/es.ts`.

## Cómo trabajar

- El orden de trabajo y los archivos de cada fase están en `docs/10-plan-de-construccion.md`; se trabaja una fase a la vez, en modo autónomo (sección anterior).
- Primero la regla con su prueba, después el caso de uso, después la pantalla.
- No agregar funciones fuera del alcance (`docs/01`): sin facturación/IVA, sin etiquetas QR, sin adjuntos 3MF/STL, sin recordatorios de cobro.
- Antes de decidir algo de producto o de comportamiento, revisar `docs/06-pantallas-y-flujos.md` y el mockup.
- Pruebas obligatorias: reglas de `core` (casos de `04`), aislamiento entre negocios (`packages/db/test/tenancy.test.ts`), y los flujos A–F de `docs/06 §17` con Playwright.
- Decisiones abiertas y su resolución: `docs/01-vision-y-decisiones.md`.

## Comandos (se completan al crear el monorepo)

```
pnpm install
pnpm dev          # servidor local (PGlite en memoria + semilla) y web
pnpm test         # core, db, server
pnpm lint         # incluye las fronteras entre paquetes
pnpm e2e          # flujos con Playwright
pnpm desktop:dev  # Electron (desde la fase 4)
pnpm desktop:dist # genera el .dmg (desde la fase 4)
```
