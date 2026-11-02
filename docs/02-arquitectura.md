# 02 · Arquitectura

Este es el documento que más pesa. Las pantallas y los flujos ya existen en el mockup (ver `06-pantallas-y-flujos.md`); lo que falta decidir es cómo se construye para que **un solo producto** sirva dos usos:

1. **Uso personal en Mac**: una app de escritorio (Electron) con los datos en la propia computadora.
2. **Producto público**: una aplicación web con cuentas y suscripción, donde cada negocio tiene sus datos separados.

La regla que ordena todo lo demás: **el producto es una aplicación web. Electron es una cáscara removible.**

---

## 1. La idea en un diagrama

```
                    ┌──────────────────────────────────────────┐
                    │   apps/web  (React, la única interfaz)   │
                    └──────────────────┬───────────────────────┘
                                       │  HTTP + JSON (contrato tipado)
                    ┌──────────────────▼───────────────────────┐
                    │ packages/server  (API + casos de uso)    │
                    │   usa: core (reglas) · db (datos)        │
                    │   recibe por inyección: auth, archivos,  │
                    │   planes, correo                         │
                    └───────┬──────────────────────┬───────────┘
                            │                      │
        ┌───────────────────▼──────┐    ┌──────────▼──────────────────┐
        │ MODO LOCAL (Mac)         │    │ MODO NUBE (público)         │
        │ apps/desktop (Electron)  │    │ apps/cloud (Node en hosting)│
        │ • arranca el servidor en │    │ • Postgres administrado     │
        │   127.0.0.1              │    │ • cuentas, planes, correo   │
        │ • PGlite en un archivo   │    │ • archivos en almacenamiento│
        │ • sin login, 1 negocio   │    │   de objetos                │
        │ • archivos en disco      │    │ • muchos negocios           │
        └──────────────────────────┘    └─────────────────────────────┘
```

Lo importante:

- **Hay una sola interfaz** (`apps/web`) y **un solo servidor** (`packages/server`). No existe "la versión de escritorio" del código de negocio.
- Lo que cambia entre local y nube es **lo que se le inyecta al servidor** al arrancar (de dónde salen los datos, quién es el usuario, qué plan tiene). Eso vive en un único lugar por modo: la *raíz de composición* (`apps/desktop` o `apps/cloud`).
- Quitar Electron = borrar `apps/desktop`. No se toca nada más.

---

## 2. Decisiones de arquitectura

| # | Decisión | Por qué | Costo que se acepta |
|---|---|---|---|
| A1 | Producto web-first: servidor + SPA | Es lo que se vende; evita escribir todo dos veces | En la Mac hay un servidor local corriendo dentro de la app |
| A2 | Electron como cáscara fina que arranca el **mismo** servidor en `127.0.0.1` | La app de escritorio y la web ejecutan exactamente el mismo código | Un puerto local y un secreto por sesión (ver §6) |
| A3 | Toda la lógica de negocio en `packages/core`, TypeScript puro | Se prueba sin base de datos ni pantalla; la usan cliente y servidor | Disciplina: `core` no puede importar nada de fuera |
| A4 | `workspace_id` en todas las tablas desde el primer día | Convertirlo en multi-negocio después es una reescritura | Un campo extra en cada consulta (se resuelve en la capa de datos) |
| A5 | El servidor es la autoridad: recalcula y guarda | El cliente nunca se puede fiar en la nube | Los cálculos de vista previa (calculadora) se hacen dos veces, con el mismo código |
| A6 | Operaciones de negocio = **casos de uso** que corren en una transacción | "Marcar listo" o "Entregar" tocan 5 tablas; no pueden quedar a medias | Más código en servidor que en el mockup, donde la UI modificaba el estado directo |
| A7 | Un solo dialecto de base de datos en ambos modos | Dos dialectos = dos esquemas y dos migraciones = el doble de trabajo | Depende de la comprobación de PGlite de la fase 1 (ver §4) |
| A8 | Cuentas, planes y correo detrás de interfaces; en local son versiones "de mentira" | La suscripción se agrega sin tocar la lógica de negocio | Hay que mantener las interfaces aunque en local casi no hagan nada |
| A9 | Los datos del negocio (nombre, teléfono, canales, comisiones) son **registros**, no código | Un negocio nuevo debe poder empezar de cero sin cambiar una línea | Hace falta un asistente de primera vez en la versión pública |

---

## 3. Piezas y responsabilidades

### `packages/core` — las reglas
Funciones puras: reciben datos, devuelven datos. Costos, precios, comisiones, existencias, estados de pedido, cobros, devoluciones, mantenimiento, inversión, gastos recurrentes. No lee la hora ni genera ids por su cuenta (se los pasan). Es la traducción directa de `core.js` del mockup. Detalle en `04-reglas-de-negocio.md`.

### `packages/contract` — el idioma entre cliente y servidor
Esquemas Zod de cada entrada y salida de la API, más los tipos que de ahí salen y los códigos de error. Cliente y servidor lo importan; si cambia, el compilador avisa a ambos lados.

### `packages/db` — datos
Esquema (Drizzle), migraciones y repositorios. **Es el único paquete que escribe SQL.** Todo repositorio recibe un contexto `{ workspaceId, userId }` y no existe forma de consultar sin él.

### `packages/server` — la API y los casos de uso
Una biblioteca que exporta `createApp(deps)`. No sabe si corre dentro de Electron o en un hosting. Recibe sus dependencias ya armadas:

```ts
createApp({
  db,            // conexión (PGlite en local, Postgres en nube)
  auth,          // AuthProvider
  files,         // FileStore
  entitlements,  // límites del plan
  mailer,        // correo (en local: no hace nada)
  mode,          // 'local' | 'cloud'  (solo para diagnóstico, nunca para decidir reglas)
});
```

### `apps/web` — la interfaz
React. Habla solo con la API. No importa `db`, ni `electron`, ni nada de Node. Detalle en `07-frontend.md`.

### `apps/desktop` — la cáscara (removible)
Electron. Su trabajo completo:
1. Elegir la carpeta de datos (`userData` de la Mac).
2. Armar las dependencias **locales** y llamar a `createApp`.
3. Escuchar en `127.0.0.1` en un puerto libre.
4. Abrir una ventana que carga esa dirección.
5. Cosas nativas opcionales: menú, diálogos de archivo, copia de seguridad automática, actualizaciones, abrir al iniciar sesión.

No tiene pantallas ni reglas de negocio.

### `apps/cloud` — la raíz de la nube (después)
Lo mismo que `apps/desktop`, con las dependencias **de nube**: Postgres administrado, cuentas reales, planes, correo, almacenamiento de objetos. Se escribe en la fase de producto público.

---

## 4. Base de datos: Postgres en las dos versiones

**Decidido (2026-11-01): Postgres en ambos lados.** En la Mac corre **PGlite** (Postgres guardado en un archivo, sin instalar nada); en la nube, un Postgres administrado. Es el mismo dialecto, así que hay un solo esquema y un solo juego de migraciones. Se construye primero la versión local.

Al empezar la fase 1 se hace una **comprobación de un día**. Criterios de aprobado:

1. Las mismas migraciones de Drizzle corren en PGlite y en un Postgres normal sin cambios.
2. Una consulta de reportes (ventas por pieza, 12 meses, ~5 000 ventas de prueba) responde en menos de 200 ms.
3. Cerrar el proceso a la fuerza y reabrir no corrompe datos.
4. PGlite funciona dentro de una app de Electron empaquetada (prueba de humo; la app real se arma en la fase 4).
5. La seguridad por filas (RLS) funciona; si no, se vive con el filtro por `workspace_id` en los repositorios.

Si algo falla, se ajusta **solo el código de la base local** (`packages/db/src/connect.ts` y lo que dependa de PGlite) y el resto no cambia. Si PGlite resultara inviable, el plan B es SQLite solo en la versión local con el mismo esquema; se registra en `docs/decisiones.md`.

Reglas de datos que no dependen de A o B:

- **Libros de movimientos, no saldos.** Filamento (`spool_movement`), piezas terminadas (`stock_movement`) e insumos (`supply_movement`) son tablas de movimientos que solo se agregan. "Cuánto hay" se calcula sumando. Es la regla del mockup y es lo que hace auditable el inventario.
- **Dinero en centavos enteros** en la base; el núcleo trabaja en pesos con redondeo explícito en los bordes (ver `04`).
- **Borrado suave** (`deleted_at`) en lo que se puede borrar desde la interfaz; así "Deshacer" es restaurar.
- **Fotos de partida** (precio, lista y costo del momento) guardadas en cada artículo vendido, para que cambiar un precio hoy no reescriba el historial.

---

## 5. Un negocio ≠ un usuario: el modelo de cuentas

```
user ──< membership >── workspace ──< (todos los datos del negocio)
                          │
                          └── subscription (solo en nube)
```

- `workspace` = un negocio. **Todo** dato de negocio lleva `workspace_id`.
- `membership` = qué usuario entra a qué negocio y con qué rol (`owner` primero; `admin`, `operador` después).
- `subscription` = plan, estado, fechas. Solo existe en nube; en local el servicio de planes responde "sin límites".

**En modo local** hay un único usuario y un único negocio con ids fijos; el `AuthProvider` local siempre devuelve esa sesión. No hay pantalla de login. Los mismos repositorios, los mismos filtros.

**En modo nube** el `AuthProvider` real emite sesiones (cookie `HttpOnly`), y cada petición resuelve `{ userId, workspaceId, rol }` antes de tocar nada.

### Planes sin `if (esNube)`

El código de negocio nunca pregunta "¿estoy en la nube?". Pregunta al servicio de planes:

```ts
await entitlements.assert(ctx, 'impresoras.crear');   // en local: siempre permite
```

Así los límites (número de impresoras, de pedidos al mes, de usuarios) viven en una tabla de planes y se cambian sin tocar los casos de uso.

---

## 6. Escritorio vs. web: qué cambia y qué no

| Tema | Escritorio (Mac) | Web pública |
|---|---|---|
| Código de la interfaz | `apps/web` | `apps/web` (idéntico) |
| Código del servidor | `packages/server` | `packages/server` (idéntico) |
| Reglas de negocio | `packages/core` | `packages/core` (idéntico) |
| Arranque | Electron lanza el servidor y abre la ventana | El hosting lanza el servidor; el navegador abre la dirección |
| Dirección | `http://127.0.0.1:<puerto>` | `https://<dominio>` |
| Base de datos | PGlite en un archivo en la Mac | Postgres administrado |
| Archivos (logos, fotos) | Carpeta en `userData` | Almacenamiento de objetos |
| Identidad | Usuario único implícito | Cuentas, correo + contraseña o enlace mágico |
| Negocios | Uno | Muchos, aislados |
| Planes y cobro | No aplica | Suscripción |
| Copias de seguridad | **Un solo archivo de copia** que la app guarda sola; se puede mover a donde se quiera | Responsabilidad del servicio; el usuario puede exportar |
| Actualizaciones | Se instala la versión nueva a mano (se empaqueta, se pasa al equipo y se reemplaza la app); los datos viven en otra carpeta y se conservan | Se despliega y listo |
| Sin internet | Funciona completo | No funciona (es web) |
| Funciones nativas | Menú, diálogos de archivo, abrir al iniciar sesión | Equivalentes del navegador (descargar, elegir archivo) |

**Regla de oro de lo nativo:** toda función de escritorio tiene un equivalente web. La interfaz pregunta `if (window.desktop?.guardarArchivo)` y, si no existe, usa la descarga normal del navegador. **Ninguna pantalla puede depender de Electron para funcionar.**

### Actualizaciones sin perder datos
Los datos viven en una carpeta aparte de la app (`userData`), así que reemplazar la app no los toca. Al abrir una versión nueva:
1. La app compara la versión de la base con la que espera.
2. Si hay cambios de estructura, **guarda primero el archivo de copia**.
3. Aplica las migraciones pendientes.
4. Si algo falla, restaura la copia y avisa; nunca deja la base a medias.

En la nube, las migraciones corren antes de levantar la versión nueva. Una migración nunca borra datos de negocio sin un paso intermedio que ya no los use. La app no se firma con cuenta de Apple por ahora: la primera apertura de cada versión descargada pide clic derecho → Abrir.

### Seguridad del servidor local
Aunque escuche solo en `127.0.0.1`, otros programas de la Mac podrían intentar hablarle. Por eso:
- Puerto aleatorio en cada arranque.
- Un secreto generado en cada arranque que Electron le pasa a la ventana y que el servidor exige en cada petición.
- La ventana de Electron con `contextIsolation: true`, sin `nodeIntegration`, y solo permitiendo navegar a su propia dirección.

### Mover los datos de la Mac a la nube
Hay un **formato de exportación del negocio** (JSON versionado, el mismo que ya usan las copias de seguridad del mockup, esquema v7 como punto de partida). Es el puente: se exporta desde la app de escritorio y se importa en un negocio de la nube. También sirve para respaldos y para que el mockup actual alimente la primera versión real.

---

## 7. Fronteras que no se cruzan

Estas reglas se verifican automáticamente (ESLint `no-restricted-imports` o `dependency-cruiser`) y rompen la compilación si se violan.

1. **`core` no importa nada**: ni Node, ni DOM, ni `db`, ni librerías de red. Solo TypeScript y, como mucho, utilidades puras.
2. **`apps/web` no importa `db`, `server` ni `electron`.** Solo `contract` y `core`.
3. **`apps/desktop` no contiene reglas de negocio ni pantallas.** Si hay un `if` sobre un pedido, está en el lugar equivocado.
4. **Solo `db` escribe SQL.** Los casos de uso llaman repositorios.
5. **Ningún repositorio acepta consultas sin `{ workspaceId }`.** No existe una variante "global" salvo para tareas de mantenimiento marcadas explícitamente.
6. **Ningún `if (mode === 'cloud')` en reglas o casos de uso.** El modo solo se usa para elegir dependencias en `apps/desktop` / `apps/cloud`. Las diferencias de comportamiento se expresan con `entitlements` o con una dependencia distinta.
7. **El servidor no confía en lo que calculó el cliente.** Recalcula con `core` y guarda su resultado.
8. **Nada específico de "Quick Robot" en el código.** Nombre, teléfono, canales, comisiones, márgenes, textos de documentos: todo sale de registros del negocio (`workspace_settings`). Los datos de ejemplo de "Quick Robot" viven solo en el archivo de semilla de desarrollo.
9. **Cada pantalla funciona sin funciones nativas.** Lo nativo mejora, nunca habilita.
10. **El idioma de la interfaz es español; el código, los nombres y los comentarios técnicos, inglés.** Los textos van en un solo lugar (`apps/web/src/i18n/es.ts`) para no regarlos.

---

## 8. Riesgos y qué se hace con cada uno

| Riesgo | Señal temprana | Plan |
|---|---|---|
| PGlite no cumple | Falla la comprobación de la fase 1 | Ajustar solo la base local; plan B: SQLite en local con el mismo esquema |
| Cálculos distintos entre cliente y servidor | Diferencia de centavos en pantalla vs. guardado | Mismo paquete `core` en ambos + pruebas con los casos de `04` |
| Se cuela lógica en la interfaz o en Electron | Revisión de código, reglas de lint | Las fronteras de §7 como verificación automática |
| La nube exige cosas que el diseño local no previó (correo, límites) | Primeras pruebas de registro | Ya están las interfaces `AuthProvider`, `entitlements`, `mailer` desde el inicio |
| Fuga de datos entre negocios | Cualquier prueba que lo muestre | Pruebas de aislamiento obligatorias + RLS si la comprobación de PGlite lo permite |
| El mockup y el producto se desvían | Diferencias al comparar flujos | El mockup se queda como referencia de comportamiento; `06` lista cada pantalla y acción |
