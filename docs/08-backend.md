# 08 · Backend

`packages/server` (la API y los casos de uso), `packages/db` (datos) y `packages/contract` (lo que viaja). Se entregan como bibliotecas; quien las arranca es `apps/desktop` o, después, `apps/cloud`.

**El contrato detallado — cada operación con su entrada, salida y errores — está en `12-api.md`.** Este documento explica cómo está organizado el servidor; `12` es la lista completa.

## Stack

| Necesidad | Elección | Razón |
|---|---|---|
| Lenguaje | TypeScript estricto, Node 22 LTS | Mismo lenguaje que la interfaz y `core` |
| HTTP | Hono | Pequeño, tipado, corre en Node y se mueve a otros entornos si hiciera falta |
| Contrato | Zod en `packages/contract` | Un esquema valida entrada y salida y da los tipos |
| Cliente de API | Escrito a mano sobre el contrato | Sin generadores mágicos; un archivo por área |
| Datos | Drizzle ORM | Esquema en TypeScript, migraciones SQL revisables |
| Base de datos | Postgres (nube) / PGlite (local) — decidido, con comprobación en la fase 1 (`02 §4`) | Mismo dialecto |
| Pruebas | Vitest; la base de pruebas es PGlite en memoria | Rápidas y sin servicios externos |

## Capas

```
HTTP (routes)  →  caso de uso  →  repositorios (db)
                       │
                       └──────→  core (reglas puras)
```

- **Rutas**: validan con Zod, resuelven el contexto (`{ workspaceId, userId, role }`) y llaman un caso de uso. No contienen reglas.
- **Casos de uso**: una función por operación de negocio (`markOrderReady`, `deliverOrder`, …). Abren **una transacción**, cargan lo necesario, aplican las reglas de `core`, escriben, y devuelven el resultado. Si algo falla, se revierte todo.
- **Repositorios**: acceso a tablas. Siempre reciben `ctx` y filtran por `workspaceId`.
- **`core`**: calcula. No sabe que existe una base de datos.

### Ejemplo: `markOrderReady`

```ts
async function markOrderReady(ctx: Ctx, orderId: string) {
  return db.transaction(async (tx) => {
    const order = await orders.get(tx, ctx, orderId);              // filtra por workspace
    assertActive(order);                                           // regla de core
    await queue.removeOrder(tx, ctx, orderId);                     // sale de todas las colas
    const plan = planReady(order, await stock.snapshot(tx, ctx));  // core: qué runs, qué movimientos
    await runs.insertMany(tx, ctx, plan.printRuns);                // si descontó filamento
    await stockMovements.insertMany(tx, ctx, plan.stockMovements);
    await orders.update(tx, ctx, orderId, plan.orderPatch);        // estado listo, fecha, reservado
    return orders.getDetailed(tx, ctx, orderId);
  });
}
```

`planReady` es una función **pura** de `core`: recibe el pedido y la foto de existencias, y devuelve qué hay que escribir. Eso la hace probable sin base de datos.

## Casos de uso (lista completa)

Mismos nombres que `06 §16` y `12`. Agrupados:

- **Productos:** `saveProduct`, `saveProductAsVariant`, `deleteProduct`, `saveCollection`, `deleteCollection`
- **Ventas:** `createSale`, `updateSale`, `deleteSale`, `recordSalePayment`, `deleteSalePayment`, `returnSale`
- **Pedidos:** `createOrder`, `updateOrder`, `deleteOrder`, `acceptOrder`, `startProduction`, `reassignPrinters`, `markOrderReady`, `deliverOrder`, `cancelOrder`, `recordOrderPayment`, `deleteOrderPayment`
- **Taller:** `addSpool`, `updateSpool`, `deleteSpool`, `recordSpoolMovement`, `createSupply`, `updateSupply`, `deleteSupply`, `recordSupplyPurchase`, `recordSupplyMovement`, `createPrinter`, `updatePrinter`, `deletePrinter`, `finishQueueEntry`, mantenimiento (`createMaintenanceTask`, `updateMaintenanceTask`, `completeMaintenance`, `deleteMaintenanceTask`), `logPrintRun`, `deletePrintRun`, `enableStockTracking`, `adjustStock`
- **Negocio:** `createCustomer`, `updateCustomer`, `removeCustomerLogo`, `deleteCustomer`, `createExpense`, `updateExpense`, `deleteExpense`, `createSupplier`, `updateSupplier`, `deleteSupplier`, `updateSettings`, `addChannel`, `updateChannel`, `removeChannel`
- **Deshacer:** `restoreProduct`, `restoreCollection`, `restoreSale`, `restoreOrder`, `restoreCustomer`, `restoreExpense`, `restoreSpool`, `restoreSupply`, `restoreSupplier`, `restorePrinter` (y las demás entidades con borrado suave, `05`)
- **Datos:** `exportWorkspace`, `importWorkspace`, `clearWorkspace`, `createBackup`, `restoreBackup`

Consultas (sin escritura): listados con filtros y paginación, detalle de pedido/venta con desglose por pieza, brief de Inicio, compras calculadas, reportes por periodo, existencias (físicas/apartadas/libres), recuperación de inversión.

## Forma de la API

- REST con JSON, bajo `/api/v1`. Recursos en plural: `/orders`, `/sales`, `/products`, …
- Operaciones de negocio como **verbos sobre el recurso**: `POST /orders/:id/ready`, `POST /orders/:id/deliver`, `POST /sales/:id/return`.
- Listas: `?status=…&from=…&to=…&q=…&page=…`.
- Éxito: `{ data, warnings? }`. Error: `{ code, message, details?, errorId? }` con el estado HTTP que corresponda (401, 403, 404, 409, 413, 415, 422, 429, 500, 503, 507). El `message` es para quien depura (inglés); la persona ve el texto en español que `apps/web` busca por `code` (`13`).
- Todo requiere sesión (salvo `GET /health`); el modo local usa la sesión fija más el secreto de arranque, que Electron agrega como encabezado a cada petición de la ventana.
- Formato completo, tipos comunes y catálogo de errores: `12 §1–3`.

## Interfaces que se inyectan

```ts
interface AuthProvider {
  resolve(req: Request): Promise<Session | null>;          // { userId, workspaceId, role }
}
interface FileStore {
  put(ctx: Ctx, file: Upload): Promise<FileRef>;
  url(ctx: Ctx, ref: FileRef): Promise<string>;
  delete(ctx: Ctx, ref: FileRef): Promise<void>;
}
interface Entitlements {
  assert(ctx: Ctx, capability: string, delta?: number): Promise<void>;   // lanza PLAN_LIMIT
}
interface Mailer {
  send(to: string, template: string, data: unknown): Promise<void>;
}
interface BackupStore {
  list(ctx: Ctx): Promise<BackupInfo[]>;                     // { id, on, sizeKb }
  create(ctx: Ctx, data: Uint8Array): Promise<BackupInfo>;   // una por día; conserva las últimas 7
  read(ctx: Ctx, id: string): Promise<Uint8Array>;
}
```

`clock` (`now()`) e `ids` (`next()`) también se reciben en `deps`, pero no cambian entre local y nube: existen para que las pruebas fijen la hora y los ids (`14`).

| | Local | Nube |
|---|---|---|
| `AuthProvider` | Sesión fija | Sesiones por cookie `HttpOnly`; correo + contraseña o enlace mágico |
| `FileStore` | Carpeta en `userData` | Almacenamiento de objetos (S3 compatible), URL firmadas |
| `Entitlements` | Siempre permite | Lee el plan de `subscription` |
| `Mailer` | No hace nada | Proveedor de correo transaccional |
| `BackupStore` | Carpeta `backups/` junto a los datos, una copia por día, las últimas 7 | Sin copias propias: el respaldo de la base lo hace la plataforma; la persona puede exportar |

## Cuentas y suscripción (fase de nube)

- Registro → crea `user`, `workspace`, `membership(owner)`, `workspace_settings` con valores por defecto genéricos y un **asistente de primera vez** (nombre del negocio, canales, costo de luz).
- Suscripción: proveedor de pagos recurrentes (Stripe es el candidato; evaluar Mercado Pago por tarjetas locales). Webhooks actualizan `subscription.status`; `Entitlements` solo lee esa tabla.
- Límites por plan: número de impresoras, pedidos al mes, usuarios, tamaño de archivos. Se definen en una tabla de planes, no en código.
- Facturación fiscal (CFDI/IVA) **excluida** de este alcance.

## Seguridad

El detalle completo (OWASP Top 10:2025, decisiones y pruebas) está en `11-seguridad.md`. Resumen:

- Aislamiento por negocio: filtro en repositorios + RLS si la comprobación de PGlite lo permite + **pruebas de aislamiento** obligatorias.
- Entradas validadas con Zod en el borde; el servidor recalcula montos con `core`.
- Contraseñas con Argon2id; sesiones con rotación; limitación de intentos en login.
- Cabeceras de seguridad y CSRF para peticiones con cookie.
- Datos locales: servidor solo en `127.0.0.1`, puerto aleatorio, secreto por arranque.
- Archivos subidos: tipo y tamaño limitados; nunca se sirven desde una ruta que ejecute contenido.
- Copias: en nube, respaldo automático de la base; en local, copia automática a una carpeta y exportación manual.

## Migraciones

- Las genera Drizzle desde el esquema y se revisan a mano.
- **Local:** al arrancar la app, el servidor compara la versión y aplica las pendientes **después de hacer una copia automática del archivo de datos**.
- **Nube:** se aplican en el despliegue, antes de levantar la nueva versión.
- Regla: una migración nunca borra datos de negocio sin un paso previo de copia y una versión intermedia que ya no los use.

## Observabilidad

Registro estructurado (JSON) con `requestId`, `workspaceId`, `useCase`, duración y código de respuesta. En local se guarda en `logs/` junto a los datos (7 archivos rotativos de hasta 5 MB); en nube va a la plataforma de logs. Los errores no esperados llevan un `errorId` que la persona ve en pantalla y que sirve para encontrar la traza (`15 §6`).

## Rendimiento y límites

Paginación, presupuestos de tiempo, límites de entrada y el tratamiento de fallos están en `15`. Las pruebas y la cobertura mínima, en `14`.
