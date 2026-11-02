# 03 · Estructura de carpetas

Monorepo con **pnpm workspaces**. Todo el proyecto en un repositorio.

> Los nombres de archivos, carpetas y código van en **inglés**; los textos que ve la persona, en **español**. El glosario español ↔ inglés está al final de este documento y en `CLAUDE.md`.

```
quickrobot/
├─ CLAUDE.md                     reglas para quien programe (persona o IA)
├─ docs/                         estos documentos (+ decisiones.md y progreso.md)
├─ reference/                    mockup y copia de ejemplo (referencia, no se modifica)
├─ tools/                        scripts de apoyo (exportar valores del mockup, importar)
├─ e2e/                          pruebas de flujo (Playwright)
├─ spikes/                       comprobaciones desechables (PGlite); se puede borrar
├─ package.json
├─ pnpm-workspace.yaml
├─ tsconfig.base.json
├─ eslint.config.js              incluye las fronteras de 02 §7
│
├─ packages/
│  ├─ core/                      REGLAS PURAS (sin I/O)
│  │  ├─ src/
│  │  │  ├─ money.ts             centavos ↔ pesos, redondeo
│  │  │  ├─ costs.ts             M, L, Q, E, fallos → costo de una pieza
│  │  │  ├─ pricing.ts           sugerido, piso, precio de lista, sets
│  │  │  ├─ filament.ts          costo por gramo, orden de rollos, descontar
│  │  │  ├─ stock.ts             físicas / apartadas / libres, armables
│  │  │  ├─ line-items.ts        artículo de venta o pedido, desglose por pieza
│  │  │  ├─ sales.ts             ingreso, comisión, ganancia, cobro, devolución
│  │  │  ├─ orders.ts            estados, cobro, cancelación, siguiente paso
│  │  │  ├─ production.ts        cola de impresoras, tiempos, registros
│  │  │  ├─ expenses.ts          gastos únicos y recurrentes, prorrateo
│  │  │  ├─ printers.ts          mantenimiento, inversión recuperada
│  │  │  ├─ customers.ts         totales por cliente
│  │  │  ├─ reports.ts           totales y rankings por periodo
│  │  │  └─ index.ts
│  │  └─ test/                   una prueba por regla, con los casos de 04
│  │
│  ├─ contract/                  LO QUE SE DICEN CLIENTE Y SERVIDOR
│  │  └─ src/
│  │     ├─ schemas/             Zod por entidad y por caso de uso
│  │     ├─ errors.ts            códigos de error de negocio
│  │     └─ index.ts
│  │
│  ├─ db/                        DATOS (único que escribe SQL)
│  │  ├─ src/
│  │  │  ├─ schema/              tablas (Drizzle), una por archivo
│  │  │  ├─ repos/               un repositorio por entidad; todos reciben ctx
│  │  │  ├─ connect.ts           connectPglite(), connectPostgres()
│  │  │  └─ index.ts
│  │  ├─ migrations/             SQL generado; igual para local y nube
│  │  └─ test/
│  │
│  └─ server/                    API + CASOS DE USO (biblioteca)
│     └─ src/
│        ├─ app.ts               createApp(deps)
│        ├─ deps.ts              tipos: AuthProvider, FileStore, Entitlements, Mailer
│        ├─ middleware/          sesión → ctx, errores, registro
│        ├─ routes/              una carpeta por área (sales, orders, …)
│        ├─ usecases/            markOrderReady, deliverOrder, cancelOrder, …
│        ├─ providers/
│        │  └─ local/            auth fijo, archivos en disco, sin límites
│        └─ static.ts            sirve apps/web ya compilada (modo local)
│
└─ apps/
   ├─ web/                       LA INTERFAZ (React + Vite)
   │  └─ src/
   │     ├─ app/                 arranque, rutas, proveedores
   │     ├─ features/            una carpeta por pantalla (ver 06)
   │     │  ├─ home/ products/ sales/ orders/ filament/ supplies/
   │     │  ├─ printers/ production/ stock/ purchases/
   │     │  └─ customers/ expenses/ reports/ settings/
   │     ├─ components/          piezas reutilizables (tabla, cajón, diálogo, chips)
   │     ├─ lib/                 cliente de la API, formato de moneda y fechas
   │     ├─ i18n/es.ts           todos los textos en español
   │     └─ styles/              tokens de diseño
   │
   ├─ desktop/                   CÁSCARA ELECTRON (removible)
   │  ├─ src/
   │  │  ├─ main.ts             arranca servidor local y ventana
   │  │  ├─ preload.ts          puente mínimo: window.desktop
   │  │  ├─ local-deps.ts       arma las dependencias del modo local
   │  │  └─ menu.ts
   │  └─ electron-builder.yml   genera el .dmg
   │
   └─ cloud/                     RAÍZ DE LA NUBE (se crea en la fase 5)
      └─ src/
         ├─ main.ts
         └─ cloud-deps.ts        Postgres, cuentas, planes, correo, objetos
```

## Reglas de dependencia

```
web ──────────► contract, core
desktop ──────► server, db, web (solo el build)
cloud ────────► server, db, web (solo el build)
server ───────► contract, core, db
db ───────────► (nada del monorepo)
contract ─────► (nada del monorepo)
core ─────────► (nada)
```

Cualquier flecha que no esté aquí está prohibida y la revisión automática la rechaza.

## Cómo se ve "quitar Electron"

1. Borrar `apps/desktop/`.
2. Quitar su entrada de `pnpm-workspace.yaml`.

No debe fallar nada más. Si falla, hay una frontera rota.

## Convenciones

- **Una pantalla = una carpeta en `features/`**, con su ruta, sus componentes y sus llamadas a la API. Lo que se comparte entre dos pantallas sube a `components/` o `lib/`.
- **Una regla de negocio = una función en `core` con una prueba**. Si una regla aparece escrita en `web` o en `server`, se mueve a `core`.
- **Casos de uso con nombre de acción en inglés**: `markOrderReady`, `deliverOrder`, `cancelOrder`, `returnSale`, `recordPayment`. El mapa completo con los nombres del mockup está en `06`.
- **Pruebas junto a lo que prueban**; las de aislamiento entre negocios en `packages/db/test/tenancy.test.ts`.

## Glosario español ↔ inglés

| Español (lo que ve la persona) | Inglés (código y base de datos) |
|---|---|
| Negocio | `workspace` |
| Filamento (material + color) | `filament` |
| Rollo | `spool` |
| Movimiento de rollo | `spool_movement` |
| Insumo | `supply` |
| Movimiento de insumo | `supply_movement` |
| Proveedor | `supplier` |
| Pieza / producto | `product` |
| Variante | `product` con `parent_id` |
| Colección / set | `collection` |
| Existencias | `stock` |
| Movimiento de existencias | `stock_movement` |
| Impresora | `printer` |
| Cola de impresión | `print_queue_entry` |
| Mantenimiento | `maintenance_task` |
| Producción (registro) | `print_run` |
| Cliente | `customer` |
| Venta | `sale` |
| Artículo (de venta o pedido) | `line_item` |
| Pedido | `order` |
| Pago / abono | `payment` |
| Devolución | `sale_return` |
| Cancelación | `order_cancellation` |
| Gasto | `expense` |
| Canal de venta | `sales_channel` |
| Ajustes del negocio | `workspace_settings` |
| Compras (lista) | `purchases` (vista calculada, no tabla) |
