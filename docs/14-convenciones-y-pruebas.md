# 14 · Convenciones y pruebas

Cómo se escribe el código y cómo se escribe una prueba, para que todo se vea hecho por la misma mano. Complementa `CLAUDE.md` (reglas) y `04` (casos numéricos).

---

## 1. Convenciones de código

### Nombres

| Qué | Convención | Ejemplo |
|---|---|---|
| Archivos y carpetas | `kebab-case`, en inglés | `mark-order-ready.ts`, `features/print-runs/` |
| Componentes React | `PascalCase`, un componente por archivo con el mismo nombre | `OrderPage.tsx` |
| Funciones y variables | `camelCase`, verbo para funciones | `markOrderReady`, `filamentCostPerGram` |
| Tipos y esquemas Zod | Tipo `PascalCase`; esquema `camelCase` + `Schema` | `Order` / `orderSchema` |
| Constantes | `UPPER_SNAKE` | `MAX_PAGE_SIZE` |
| Tablas y columnas (SQL) | `snake_case`, tabla en singular (`05`) | `spool_movement.spool_id` |
| JSON de la API | `camelCase` (Drizzle traduce `snake_case` ↔ `camelCase`) | `dueOn` |
| Casos de uso | verbo + objeto, igual que en `06 §16` y `12` | `deliverOrder` |
| Códigos de error | `UPPER_SNAKE`, estables, sin cambiar nunca (`12 §2`) | `INSUFFICIENT_STOCK` |
| Textos de interfaz | Claves en inglés `área.cosa`, valor en español (`13`) | `toast['order.accepted']` |
| Ramas | `fase-N` | `fase-3` |
| Commits | Conventional Commits en inglés: `tipo(alcance): resumen en minúscula` | `feat(core): weighted spool cost` |

Tipos de commit: `feat`, `fix`, `test`, `refactor`, `docs`, `chore`, `perf`. Alcance: `core`, `db`, `server`, `web`, `desktop`, `contract`, `security`, `docs`. Un commit = un paso del plan (`10`).

### Reglas de estilo (las verifica ESLint, no la memoria de nadie)

1. TypeScript `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`. Prohibido `any`; lo desconocido entra como `unknown` y se valida con Zod.
2. **Dinero:** tipo de marca `Cents` (entero) en `contract`/`db`/`server`; `core` calcula en pesos y convierte en los bordes con `money.ts`. Nunca `parseFloat` sobre dinero, nunca sumar pesos con decimales sin `round2` al guardar.
3. **Sin reloj ni azar en `core`:** "hoy", ids y aleatorios llegan como parámetros. En `server`, `deps.clock.now()` y `deps.ids.next()` (se sustituyen en las pruebas).
4. Sin exportaciones por defecto (salvo archivos de configuración). Importar tipos con `import type`.
5. Entre paquetes solo por su nombre (`@app/core`, `@app/contract`, `@app/db`, `@app/server`: alcance neutral a propósito, regla 6 de `CLAUDE.md`); dentro de un paquete, rutas relativas. Las flechas permitidas están en `03` y las revisa `dependency-cruiser`.
6. Errores de negocio: `throw new BusinessError('CODE', details)` con un código de `12 §2`. Nunca `throw new Error('texto')` en reglas ni casos de uso.
7. Sin `console.log` (lint). Registro con el `logger` estructurado de `server` (`08 › Observabilidad`).
8. Sin texto en español dentro de componentes (lint de literales, `13 §2`).
9. Comentarios: explican **por qué**, no qué; en inglés. Todo número "mágico" de negocio vive en una constante con el nombre de la regla (`DAYS_PER_MONTH = 30.4375`).
10. Tamaños de referencia (advertencia de lint, no error): archivo > 300 líneas, función > 60 líneas, componente > 200 líneas → partir.
11. **Un cambio de comportamiento actualiza su documento en el mismo commit:** reglas → `04`; pantallas → `06`; operaciones → `12`; textos → `13`. Una regla que cambia sin su caso numérico actualizado no pasa revisión.

### Estructura de un caso de uso (plantilla)

```ts
// packages/server/src/usecases/deliver-order.ts
export async function deliverOrder(deps: Deps, ctx: Ctx, input: DeliverOrderInput) {
  return deps.db.transaction(async (tx) => {
    const order = await orders.get(tx, ctx, input.orderId);        // 404 si es de otro negocio
    assertStatus(order, ['ready']);                                // ORDER_INVALID_STATE
    const plan = planDelivery(order, input, deps.clock.now());     // core: puro, sin I/O
    await payments.insert(tx, ctx, plan.finalPayment);
    const sale = await sales.insertFromOrder(tx, ctx, plan.sale);
    await stockMovements.insertMany(tx, ctx, plan.stockMovements);
    await orders.update(tx, ctx, order.id, plan.orderPatch);
    return { order: await orders.getDetailed(tx, ctx, order.id), sale };
  });
}
```
Cabecera obligatoria de cada archivo de caso de uso: una línea con qué hace y la sección de `04`/`06` que lo respalda.

---

## 2. Tipos de prueba

| Capa | Herramienta | Qué prueba | Base de datos | Dónde vive |
|---|---|---|---|---|
| **Reglas** (`core`) | Vitest | Cada fórmula y estado con los **casos numéricos de `04`**; propiedades de los libros de movimientos | — | `packages/core/test/` |
| **Valores del mockup** | Vitest | Costos y precios de las piezas y colecciones contra `mockup-values.json` (±0.01) | — | `packages/core/test/golden.test.ts` |
| **Datos** (`db`) | Vitest | Repositorios; **aislamiento entre negocios en cada tabla** | PGlite en memoria con las migraciones reales | `packages/db/test/` |
| **Casos de uso** (`server`) | Vitest | Camino feliz, cada error de su fila en `12`, y "falla a la mitad → no queda nada" | PGlite en memoria | `packages/server/test/usecases/` |
| **Rutas y contrato** (`server`) | Vitest + `app.request()` de Hono | Códigos HTTP, forma de las respuestas contra los esquemas Zod, **matriz de acceso**, cabeceras | PGlite en memoria | `packages/server/test/routes/`, `test/security/` |
| **Interfaz** (`web`) | Vitest + Testing Library | Formularios con validación, `t()` y formatos, componentes con lógica (armador, calculadora) | Servidor simulado (MSW) | `apps/web/src/**/*.test.tsx` |
| **Flujos** | Playwright | Flujos A–F de `06 §17`, humo de cada pantalla, tres anchos | Servidor real con la semilla | `e2e/` |
| **Comparación con el mockup** | Playwright (capturas) + revisión | Estructura, textos, colores y comportamiento por pantalla y ancho | Servidor real con la semilla | `e2e/visual/` → capturas en `docs/informe-fase-N/` |
| **Seguridad** | Vitest + script | `pnpm security` (`11`) | PGlite | `packages/server/test/security/` |

### Reglas de oro

1. **Primero la prueba del caso numérico, después la regla.** El número esperado sale de `04` (o de `mockup-values.json`); **nunca se cambia el esperado para que pase** (`CLAUDE.md`).
2. **Una prueba falla por una sola razón** y se nombra por el comportamiento: `it('case 7.2: delivering an order nets -4 in stock when 4 came from the shelf')`. Los nombres de las pruebas van en inglés y citan el caso de `04` cuando existe.
3. **Cada prueba arma sus propios datos** (sin depender de otras ni de un orden). Nada de estado compartido entre pruebas.
4. **El reloj se fija:** hoy es `2026-11-01` en todas las pruebas (coincide con `_today` del archivo de valores). La zona horaria se prueba en `America/Mexico_City` y, en CI, también en `UTC` para `core`.
5. **Sin pruebas que dependan de internet ni de servicios externos.** Pagos, correo y almacenamiento de objetos se prueban con dobles que implementan las interfaces de `08`.
6. **Las pruebas negativas valen tanto como las positivas:** pagar de más, entregar dos veces, cantidades enormes, estados inválidos, ids de otro negocio, cadenas de ataque (`11 › A05, A06`).
7. Sin pruebas de instantáneas de páginas completas ni de las piezas internas de shadcn/ui.

---

## 3. Datos de prueba

Tres capas, de lo más pequeño a lo más grande:

| Capa | Para qué | Dónde |
|---|---|---|
| **Constructores** (`aSpool()`, `anOrder({ status: 'ready' })`, `aProduct()`, `aWorkspace()`) | Cada prueba arma solo lo que necesita; los valores por defecto son los del **caso 2.1** (kWh $3, purga 5 %, fallos 5 %, impresora de $6 000) para que los números coincidan con `04` | `packages/*/test/builders.ts` |
| **Dos negocios** (`wsA`, `wsB`) con datos parecidos | Pruebas de aislamiento y matriz de acceso | `packages/db/test/fixtures.ts` |
| **Datos del mockup** | El estado completo del mockup (`reference/mockup-backup-v7.json`): lo carga el importador (fase 4) o, antes, la semilla (`packages/db/seed/quick-robot.ts`). Pruebas de flujo y comparación con el mockup | `reference/`, `packages/db/seed/` |
| **Valores esperados** | Costos y precios del mockup por pieza y colección, más totales de ventas, existencias y rollos | `packages/core/test/golden/mockup-values.json` |

Reglas: la semilla **no se usa** en pruebas unitarias; los constructores nunca llaman a la base ni al reloj; los datos del negocio de ejemplo (nombre, teléfono, canales) existen solo en la semilla (`CLAUDE.md`, regla 6).

---

## 4. Cobertura mínima (la exige CI)

| Área | Mínimo | Cómo se mide |
|---|---|---|
| `core` | **100 %** de los casos numéricos de `04` implementados; 95 % de líneas y 90 % de ramas | Lista de casos en §5 + umbral de Vitest |
| Casos de uso | Cada uno con: 1 camino feliz + **1 prueba por cada error** de su fila en `12` + 1 de fallo a la mitad. 85 % de líneas | Prueba que lee `12` (tabla de operaciones) y falla si hay un caso de uso sin su archivo |
| `db` | **Toda tabla de negocio tiene `workspace_id` y aparece en `tenancy.test.ts`** (todas menos `workspace` y `user`) | La prueba recorre el esquema de Drizzle y falla si una tabla no lo tiene o no está cubierta |
| Rutas | **100 % de las rutas** en la matriz de acceso (otro negocio → 404) | La matriz sale de las rutas registradas; una ruta nueva sin entrada rompe la prueba |
| Contrato | Toda respuesta de prueba valida contra su esquema de salida | Helper que valida en cada `app.request()` |
| Errores y textos | Cada código de `12 §2` tiene texto en `13` | `i18n.test.ts` |
| `web` | 60 % de líneas en `lib/` y `components/`; los formularios con reglas de negocio tienen prueba | Umbral de Vitest |
| Flujos | Los 6 flujos de `06 §17` + 1 prueba de humo por pantalla (carga sin errores en consola) en 3 anchos | Playwright |

Bajar un umbral requiere anotarlo en `docs/decisiones.md` con la razón.

---

## 5. Qué prueba cubre cada caso de `04`

| Caso | Regla | Archivo de prueba | Fase |
|---|---|---|---|
| 1.1a–g · 1.2 · 1.3 · 1.4 · 1.5a–c · 1.6 | Costo por gramo de las últimas compras; descontar con purga, rollo elegido y faltante; estado; valor del inventario; pesar y terminar rollo (ronda 4) | `core/test/filament.test.ts`, `spool-use.test.ts` | 1 · ronda 4 |
| 2.1 | Costo de una pieza (M, L, Q, E, fallos) | `core/test/costs.test.ts` | 2 |
| 3.1 · 3.2 · 3.3 | Sugerido, piso, lista; sets; reparto | `core/test/pricing.test.ts` | 2 |
| 11.1 · 11.2 | Mantenimiento; inversión recuperada | `core/test/printers.test.ts` | 2 |
| 9.1 | Compras de insumos | `core/test/stock.test.ts` (compras) | 3 |
| — | Todas las piezas y colecciones de ejemplo | `core/test/golden.test.ts` | 2 |
| 4.1 · 5.1 · 5.2 | Artículos con existencias; físicas/apartadas/libres | `core/test/line-items.test.ts`, `stock.test.ts` | 3 |
| 6.1 · 6.2 | Ganancia de venta; cobro | `core/test/sales.test.ts` | 3 |
| 7.1 · 7.2 | Pedido: cobro, cancelación; existencias al entregar | `core/test/orders.test.ts` | 3 |
| 10.1 | Gastos recurrentes | `core/test/expenses.test.ts` | 3 |
| §8 · §12 · §13 | Registros de producción; clientes; reportes | `core/test/production.test.ts`, `customers.test.ts`, `reports.test.ts` | 3 |

**Propiedades que se prueban con datos aleatorios** (`fast-check`, dependencia solo de pruebas; se anota en `decisiones.md`):
- El libro de un rollo nunca da un restante negativo, sin importar el orden de los movimientos.
- `libres = max(0, físicas − apartadas)` y `libres ≤ físicas`.
- Redondear al guardar y volver a calcular no cambia el total en más de $0.01.
- Entregar un pedido y devolver la venta deja las existencias como estaban cuando `restock = true`.

---

## 6. Qué se corre y cuándo

| Comando | Qué hace | Cuándo |
|---|---|---|
| `pnpm test` | `core`, `db`, `server`, `web` | En cada paso |
| `pnpm lint` | ESLint + fronteras (`dependency-cruiser`) + textos literales | En cada paso |
| `pnpm typecheck` | `tsc --noEmit` en todo el monorepo | En cada paso |
| `pnpm security` | Seguridad (`11`) | En cada paso |
| `pnpm e2e` | Playwright | Al cerrar cada paso con pantalla y cada fase |
| `pnpm test:tz` | `core` con `TZ=UTC` | En CI |

**Un paso está terminado** solo si pasan `test`, `lint`, `typecheck`, `security` y, si hay pantalla, `e2e` y su comparación visual (`CLAUDE.md › Modo autónomo`). CI (`.github/workflows/ci.yml`) corre todo lo anterior en cada subida, con `pnpm install --frozen-lockfile`.

## 7. Prueba negativa de las fronteras

Hay un archivo de ejemplo (`packages/core/test/fixtures/forbidden-import.ts`, excluido del lint normal con `ignores`) que viola una regla de dependencias. Una prueba corre el lint sobre él y exige que **falle**. Si algún día pasa, las fronteras dejaron de vigilar.
