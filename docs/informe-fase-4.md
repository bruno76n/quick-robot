# Informe de la fase 4

## Resumen
La app de escritorio ya existe. Es una cáscara de Electron que arranca el mismo servidor dentro de la app (en `127.0.0.1`, con puerto aleatorio y un secreto por arranque) y abre la ventana con la web de siempre.

Lo que agrega esta fase:
- **Copias:** se descarga y se restaura una copia del negocio. La app hace sola una copia por día y conserva 7.
- **Importar el mockup:** la copia v7 del mockup se importa **sin diferencias** en rollos, existencias, ventas y por cobrar.
- **Actualizaciones:** antes de aplicar cambios de estructura se copia la carpeta de datos, y si una migración falla, la copia vuelve a su lugar.
- **Vaciar negocio**, con copia previa.
- **Pantallas de falla de escritorio:** servidor que no responde, migración fallida y archivo de datos ilegible.

Todo lo que se puede probar sin una Mac está hecho y en verde. Lo que falta necesita tu Mac (ver **Lo que tienes que hacer tú**).

## Pasos
| Paso | Estado | Commits | Notas |
|---|---|---|---|
| Importador del mockup v7 | hecho | `143a35c` | Mismo endpoint que restaurar; se valida con Zod y se aplica en **una** transacción; compara sumas y da `differences[]` y `notes[]`. También `pnpm import:mockup` |
| Exportar y restaurar | hecho | `143a35c`, `07516a9` | Formato propio versionado y con los archivos dentro; al importar, ids nuevos y referencias reescritas |
| Copias automáticas y migraciones locales con copia previa | hecho | `3805905` | Una copia por día por negocio, 7 guardadas; `before-update-*` antes de migrar |
| Vaciar negocio | hecho | `143a35c` | Copia antes y negocio limpio con sus valores de arranque |
| Ajustes › Copia de seguridad | hecho | `07516a9` | Descargar, restaurar desde archivo o copia automática, resumen, vaciar, "Mostrar archivo de registro" (solo escritorio) |
| Cáscara de Electron, pantallas de falla, menú, abrir al iniciar sesión | hecho | `f6e0e4c` | El `.dmg` se genera en la Mac (abajo) |
| Revisión pantalla por pantalla | hecho | — | `progreso.md`: todas las pantallas "igual al mockup" |

## Pruebas
- **Totales:**
  - `pnpm test` (con cobertura): 505 en verde.
  - `pnpm e2e`: 43 en verde.
  - `pnpm e2e:desktop`: 5 en verde, con la app empaquetada para Linux bajo Xvfb.
  - `pnpm lint` y `pnpm typecheck`: sin errores. `pnpm size`: 204.6 KB de 350 KB.
  - `pnpm security`: en verde. Ver la excepción de Electron en **Bloqueado o dudoso**.
- **Importar el mockup:**
  - `reference/mockup-backup-v7.json` importado da **0 diferencias**.
  - Las mismas cifras de la fase 3 salen a través de la API: ventas $13,170 y ganancia $10,575.23.
  - Las imágenes en *data URL* se suben revisando su firma. Un canal que ya no existe se crea con 0 %, y un pedido sin cliente queda con "Sin nombre"; ambos se anotan en el resumen.
- **Exportar → importar:**
  - Una copia de un negocio cargada en otro da los mismos totales, existencias y gramos, y conserva los archivos.
  - Errores probados: `CONFIRMATION_REQUIRED`, `IMPORT_INVALID_FILE` (JSON roto, tabla o columna desconocida, tipo incorrecto, id inválido), `IMPORT_UNSUPPORTED_VERSION` (versión mayor o mockup v6) y `FILE_TOO_LARGE`.
  - Una fila que rompe una regla a la mitad revierte todo.
- **Migraciones locales** (`packages/db/test/migrate-local.test.ts`):
  - Una versión nueva con una migración más copia la carpeta y conserva los datos.
  - Una migración que falla restaura la copia: mismos datos, versión anterior, y la app abre otra vez.
  - Una carpeta dañada se informa como ilegible.
- **Escritorio** (`e2e/desktop.spec.ts`):
  - Abre en Inicio.
  - El secreto nunca llega a la página (documento, `localStorage`, `sessionStorage`, cookies, `window.desktop`).
  - Una llamada sin el secreto recibe 401, y la navegación a otros sitios está bloqueada.
  - Los datos sobreviven cerrar y abrir.
  - Si el servidor muere, se reinicia solo una vez; si vuelve a caer, aparece "La aplicación no responde…" con Reintentar.
  - Con el archivo de datos dañado aparece la lista de copias, y restaurar la más reciente devuelve los datos. La carpeta dañada se guarda aparte, nunca se borra.
  - Una migración que falla muestra su pantalla, y los datos quedan intactos.
- **Seguridad (A02 de Electron):**
  - La ventana usa `contextIsolation`, `sandbox`, sin `nodeIntegration` y con `webSecurity`.
  - Solo navega a su propia dirección; los enlaces externos se abren en el navegador.
  - El secreto se agrega solo a peticiones a su propio origen, y los canales de IPC revisan quién llama.
  - Cubierto por 24 pruebas unitarias de `apps/desktop`.
- **Copias por negocio:** la copia de un negocio no se encuentra desde otro (matriz de acceso). La prueba de fallo a la mitad cubre importar, restaurar, vaciar y la importación del mockup.

## Rendimiento
| Qué | Medido | Presupuesto | |
|---|---|---|---|
| Abrir la app empaquetada (Linux, Xvfb), en frío / en caliente | 4.9 s / 1.8 s | 3 s / 1.5 s | entre 1× y 2× (la primera apertura crea la base) |
| Importar el mockup | ~2 s (más ~4 s al crear la base la primera vez) | 5 s | ✓ |
| Importar una copia de 25 000 ventas | 47.6 s | 30 s | entre 1× y 2× |

- **Mejoras en esta fase:** restaurar sobre datos existentes tardaba 130 s. Bajó con índices para cada llave foránea (con una prueba que lo exige) y carga en bloque con `json_populate_recordset`.
- **Hay que medir en la Mac:** estas cifras son de Linux. Conviene repetirlas allí con `pnpm perf` y la app instalada.

## Decisiones tomadas
`docs/decisiones.md`, entradas "Fase 4 · Copias, importación y migraciones locales" y "Fase 4 · Cáscara de Electron". Lo principal:
- **Un solo camino para copias:** la copia del mockup y la de la app se importan por el mismo camino. La importación siempre guarda antes una copia y aplica todo en una transacción.
- **Copias automáticas por negocio**, en `datos/backups/<negocio>/`.
- **Pantallas de falla dentro de la web:** se construyen como parte de la web (`apps/web/fatal.html`), para que sus textos sigan en `es.ts`. El menú nativo también toma sus textos de `es.ts`, por un `desktop-texts.json` que genera la compilación de la web.
- **Ajustes de prueba solo en desarrollo:** `DESKTOP_USER_DATA` y `DESKTOP_TEST_MIGRATIONS` solo funcionan en compilaciones de prueba. El `.dmg` de entrega los ignora.
- **El registro de errores** ya no guarda los valores de las consultas.

## Rendimiento de lectura después de la fase 4
Corrida completa de `pnpm perf` (25 000 ventas, Linux, p95), después de reutilizar catálogo y costos en Reportes, calcular la ganancia histórica con una consulta ligera y no cargar costos en la búsqueda si no hacen falta:

| Acción | p95 | Presupuesto |
|---|---|---|
| Ventas (página) / Pedidos (lista, tablero) | 323 / 72 / 263 ms | 300 ms |
| Clientes / Productos | 526 / 408 ms | 300 ms |
| Reportes 30 días / Todo | 699 ms / 1.9 s | 400 ms / 1.5 s |
| Inicio / Búsqueda | 637 / 305 ms | 400 / 200 ms |
| Importar 25 000 ventas | 43 s | 30 s |
| Escrituras (todas) | 89–423 ms | 500–800 ms |

Ninguna pasa de 2× (la prueba falla solo ahí). Entre corridas varían ±30 % en este contenedor (medidas aisladas: Reportes 30 días 530 ms, búsqueda 243 ms). En la Mac conviene repetir `pnpm perf`; si alguna sigue arriba de 1×, lo siguiente sería guardar sumas por día en una tabla de resumen.

## Agregado después del cierre de la fase 3
- **Esqueleto de carga lenta** (`15 §5`): si la primera carga de una pantalla tarda más de 300 ms aparece un esqueleto gris; a los 8 s, "Tarda más de lo normal" con Reintentar. Probado en `e2e/failure-states.spec.ts` y con una prueba unitaria. El mockup no tiene uno; usa sus colores y radios.

## Bloqueado o dudoso
- **No se pudo probar aquí** (no hay macOS): el `.dmg`, el menú de Mac, "Abrir al iniciar sesión" y "Mostrar archivo de registro" en Finder.
- **Electron 42.11.15:** `pnpm audit` marca problemas altos en todas las versiones anteriores a 42.11.16. Se usó la más nueva con dos semanas publicada, y queda **una** advertencia ignorada a propósito: GHSA-jr5w-w6x2-84p9, certificados intermedios de eMudhra. Es poco relevante porque la ventana solo habla con `127.0.0.1`. **A partir del 2026-11-03 hay que subir a ≥ 42.11.16 y quitar la excepción** de `pnpm-workspace.yaml`.
- **Nombre de la app:** `productName: Quick Robot` en `apps/desktop/electron-builder.yml` es provisional hasta decidir el nombre comercial (fase 5). La app no muestra ese nombre dentro de las pantallas; ahí sale el de Ajustes.
- **Para revisar** (fases anteriores): "Últimas compras" en Compras, acentos en la búsqueda de ventas y pedidos, y los valores de arranque.

## Lo que tienes que hacer tú (en tu Mac)
**1. Generar el `.dmg`** (necesita Node 22 y pnpm):
```bash
cd quick-robot
git pull
pnpm install --frozen-lockfile
pnpm desktop:dist
```
Queda en `apps/desktop/out/`: `Quick Robot-0.4.0-arm64.dmg` (Apple Silicon) y `Quick Robot-0.4.0-x64.dmg` (Intel).

**2. Instalar.** Abre el `.dmg` de tu Mac y arrastra la app a Aplicaciones. Como no está firmada, la primera vez haz clic derecho sobre la app → **Abrir** → **Abrir**. Si macOS no lo permite, en Terminal:
```bash
xattr -dr com.apple.quarantine "/Applications/Quick Robot.app"
```
Abre la app y revisa que aparezca Inicio, vacío (o con los valores de arranque). Anota cuánto tarda en abrir la primera vez y la segunda.

**3. Guardar tu copia actual del mockup** (antes de tocar nada): en el mockup, Ajustes → Copia de seguridad → **Descargar copia**. Guarda ese `.json` en un lugar seguro (USB o nube). Es tu respaldo y la fuente de la importación.

**4. Importar tus datos:** en la app, Ajustes → Copia de seguridad → **Restaurar desde archivo** → elige ese `.json` → confirma.
- **Si el resumen dice "Sin diferencias":** los rollos, existencias, ventas y por cobrar coinciden con el mockup.
- **Si muestra diferencias o notas:** no sigas usándola. Guarda una captura del resumen y mándamela.

**5. Revisar** que tus filamentos, piezas, pedidos activos y ventas se vean como en el mockup. Después descarga una copia desde la app: Ajustes → Copia de seguridad → **Descargar copia**.

**6. Usarla una semana** en lugar del mockup (es la última condición de la fase en `10`). Deja el mockup y tu `.json` guardados por si hay que volver.

**Dónde están tus datos:** `~/Library/Application Support/Quick Robot/data` (base, copias automáticas y registros). Reemplazar la app por una versión nueva no los toca.

## Cómo probarlo aquí
```bash
pnpm install
pnpm test && pnpm lint && pnpm typecheck && pnpm security && pnpm e2e
pnpm desktop:dist:linux && pnpm e2e:desktop    # app empaquetada para Linux, bajo Xvfb
pnpm import:mockup --data /tmp/prueba reference/mockup-backup-v7.json --yes
pnpm perf
```
