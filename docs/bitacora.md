# Bitácora

Registro cronológico de la construcción, para retomar en cualquier equipo. Lo detallado está en los informes de fase (`informe-fase-N.md`), las decisiones en `decisiones.md` y el estado por pantalla en `progreso.md`.

---

## 2026-11-02 · Fases 1 a 4 (sesión en la nube, modo autónomo)

### Punto de partida
- Documentación v3 cargada (`bd2bbb4`). Antes de eso, el código viejo quedó en el tag local `antes-del-reinicio`; el remoto no aceptó subir tags.
- Pedido: fases 1, 2, 3 y 4 de `10-plan-de-construccion.md`, una tras otra, en la rama de la sesión y sin crear ramas `fase-N`. Parar antes de lo que requiera la Mac. No hacer la fase 5.

### Fase 1 · Cimientos — terminada (`informe-fase-1.md`)
- **Comprobación de PGlite:** pasa.
- **Monorepo:** pnpm con fronteras vigiladas por el lint; contract, core, db, server y web.
- **Primer flujo:** Filamentos de punta a punta, igual al mockup. Semilla tomada de `reference/mockup-backup-v7.json`.

### Fase 2 · Taller y catálogo — terminada (`informe-fase-2.md`)
- **Pantallas:** costeo de piezas y colecciones, Calculadora, Insumos, Impresoras con mantenimiento, Ajustes (costos, canales, documentos) y Filamentos completo.
- **Golden:** las 9 piezas y las 2 colecciones dan el costo y precio del mockup (±$0.01).

### Fase 3 · Vender y producir — terminada (`informe-fase-3.md`)
- **Reglas de `core`:** casos 4.1–10.1 y golden de la fase 3: ventas $13,170, ganancia $10,575.23, pedidos, clientes, existencias, ranking e inversión recuperada.
- **Datos y servidor:** 9 tablas nuevas, todas las operaciones de `12 §6–9` con sus errores, matriz de acceso, fallo a la mitad, inyección y límites.
- **Pantallas:** Inicio, Ventas, Armar venta o pedido, Pedidos (tablero, lista, calendario), página de Pedido, documentos, colas de Impresoras, Producción, Existencias, Compras, Clientes, Gastos, Reportes, búsqueda ⌘K, atajos y exportar a Excel. Las construyeron 4 agentes en paralelo, cada uno con su área.
- **Flujos A–F de `06 §17`** y estados de falla de `15 §5` con Playwright. Prueba de humo de las 14 pantallas del menú y las 5 de detalle en 1440, 820 y 390 px.
- **Rendimiento con 25 000 ventas:**
  - **Primera medición:** lista de ventas 6.5 s, reporte de 30 días 17 s.
  - **Arreglo:** sumas en SQL, `grouping sets`, el ranking que abre los sets calculado en SQL, y paginación en la base.
  - **Resultado:** ninguna medición pasa de 2× su presupuesto.

### Fase 4 · Electron y uso diario — terminada salvo lo que requiere la Mac (`informe-fase-4.md`)
- **Copias:**
  - **Exportar:** formato propio versionado, con los archivos dentro.
  - **Importar:** acepta la exportación propia y **la copia v7 del mockup**. Siempre guarda antes una copia y aplica todo en una transacción. Asigna ids nuevos y reescribe las referencias. Compara sumas y da diferencias y notas.
  - **Copias automáticas:** una por día por negocio; se guardan 7.
  - **Herramientas:** restaurar, vaciar negocio y `pnpm import:mockup`.
- **Migraciones locales:** copia de la carpeta de datos antes de migrar, y restauración si la migración falla. Una carpeta ilegible se informa como tal.
- **Ajustes › Copia de seguridad:** descargar, restaurar (desde archivo o desde una copia automática), resumen, vaciar y "Mostrar archivo de registro".
- **App de escritorio `apps/desktop`:**
  - El servidor corre en un proceso aparte con puerto aleatorio y un secreto por arranque, que Electron agrega como encabezado.
  - Ventana endurecida.
  - Pantallas de falla: no responde (se reinicia solo una vez), migración fallida, archivo ilegible con restauración.
  - Menú, "Abrir al iniciar sesión", y empaquetado `.dmg` para Mac y `dir` para Linux.
  - Las 5 pruebas de la app empaquetada (Linux, Xvfb) pasan. Apertura: en frío 4.9 s, en caliente 1.8 s.
- **Importar el mockup** (`reference/mockup-backup-v7.json`): **0 diferencias**.
- **Ajustes de rendimiento:**
  - Índices para cada llave foránea, con una prueba que lo exige.
  - Carga en bloque con `json_populate_recordset`.
  - Importar 25 000 ventas bajó de ~130 s a ~43 s.
- **Agregado al final:**
  - Esqueleto de carga a los 300 ms (`15 §5`).
  - Reportes reutiliza catálogo y costos.
  - Ganancia histórica con una consulta ligera.
  - La búsqueda solo carga costos si hacen falta.

### Estado al cerrar la sesión
- **Pruebas:** `pnpm test` 506 en verde; `pnpm e2e` 43; `pnpm e2e:desktop` 5 en la app empaquetada para Linux.
- **Revisiones:** `pnpm lint` 0 errores, `pnpm typecheck` y `pnpm security` en verde, `pnpm size` 204.6 KB de 350 KB.
- **Pantallas:** todas "igual al mockup" en `progreso.md`, salvo la marca (provisional).
- **Ramas:** el trabajo está en `claude/wizardly-fermi-3ur0nk` y se unió a `main` con un merge commit para seguir desde ahí.

---

## 2026-11-13 · Ronda 2 (sesión en la nube, modo autónomo)
Pedido: las cuatro fases de `docs/mejoras/ronda-2.md`, cada una en su rama desde `main` y fusionada al cerrar en verde.
- **A · Medición** (`mejoras/informe-ronda2-a.md`): inventario, morado y marca, casos raros de datos, línea base y plan de la B.
- **B · Rediseño** (`informe-ronda2-b.md`): variantes agrupadas por familia (migración aditiva 0007, `variant_label`), Productos y Existencias por familias, Inicio con atención por prioridad, panel neutro sin morado. **La mascota se quedó** por decisión de la persona.
- **C · Clics** (`informe-ronda2-c.md`): 35 flujos medidos en `e2e/clicks/`.
- **D · Menos clics** (`informe-ronda2-d.md`): selector propio con búsqueda (`components/Picker.tsx`; la fila nueva de filamento nace abierta), "Vender" en Existencias, abono directo desde "Debe", y más. 131 → 117 clics y 25 → 16 campos.

## 2026-11-14 · Ronda 3 · Diseño visual (sesión en la nube, modo autónomo)
Pedido: adoptar el diseño de `reference/ronda-3/` (`docs/mejoras/ronda-3.md`), con **tres excepciones de la persona**: los interruptores (segmentados) se quedan como estaban, el detalle del filamento sigue en el cajón, y la mascota se queda.
- **A · Inventario** (`mejoras/informe-ronda3-a.md`), **B · Tokens y componentes** (`informe-ronda3-b.md`; también el arreglo del "%%" en los atajos de precio), **C · Pantallas** (`informe-ronda3-c.md`; marco nuevo y 16 pantallas, cuatro agentes en paralelo), **D · Revisión** (`informe-ronda3-d.md`; tres anchos, axe sin errores serios, limpieza; **resumen final de la ronda ahí**).
- **Vocabulario nuevo:** Alertas, Disponibles, Stock bajo, Crítico, Al día, Próximo, Vencido, Saldo, Fecha de entrega, Correcta, Fallida, Precio mínimo.
- **Después del cierre:** "Prueba de material" en una línea en el celular (pedido de la persona); las pruebas e2e borran su carpeta temporal al terminar (llenaban el disco); Electron 42.11.18 sin la excepción de seguridad.

### Estado al cerrar
- `pnpm test` 630, `pnpm e2e` 122 (5 de escritorio aparte, que pasan con `pnpm e2e:desktop`), lint 0 errores, typecheck y `pnpm security` en verde, `pnpm size` 214.7 KB de 350.
- Todo en `main`. Las etiquetas `antes-ronda2-*` y `antes-ronda3-*` existen solo en la sesión de la nube (el remoto no acepta etiquetas).

## 2026-11-14 · Ronda 4 · Rollos (sesión en la nube, modo autónomo)
Pedido: llevar el filamento **por rollo** (`docs/mejoras/ronda-4.md`, maquetas en `reference/ronda-4/`) y el cambio de regla del dueño: el costo por gramo es el promedio de las **últimas 3 compras con costo**; los rollos sin costo no abaratan las piezas.
- **A · Reglas** (`mejoras/informe-ronda4-a.md`): reglas en `core` con los casos de `04 §1` (1.1a–g, 1.4, 1.5a–c, 1.6); golden: solo PLA Blanco 0.3784 → 0.38 y sus 5 piezas y 2 colecciones.
- **B · Datos** (`informe-ronda4-b.md`): migración `0008` aditiva (número de rollo, sin costo, precio de referencia, tara por marca, compras para el promedio) y las operaciones nuevas (agregar varios, terminar, pesar, elegir rollo al imprimir y al producir).
- **C · Pantallas** (`informe-ronda4-c.md`): Filamentos con rollos numerados y su cajón, Agregar rollo, Registrar impresión y Poner en producción eligiendo rollo, la «i» del costo y Ajustes.
- **D · Revisión** (`informe-ronda4-d.md`; **resumen final de la ronda ahí**): una carga fallida ya no se ve como lista vacía, aviso «Se descontaron» exacto, número real en la vista previa, flujo G, seguridad y textos.
- **Pendiente fuera del sistema:** el texto de la web de venta sobre el costo por gramo (`ronda-4.md §9`).

### Estado al cerrar
- `pnpm test` 764, `pnpm e2e` 130 (5 de escritorio aparte), lint 0 errores, typecheck y `pnpm security` en verde, `pnpm size` 224.5 KB de 350.

---

## Cómo seguir en la Mac

### 1. Preparar el equipo (una vez)
```bash
# Node 22 (por ejemplo con nvm) y pnpm 10.28.0
nvm install 22 && nvm use 22
corepack enable && corepack prepare pnpm@10.28.0 --activate
```
```bash
git clone https://github.com/bruno76n/quick-robot.git
cd quick-robot
git checkout main
pnpm install --frozen-lockfile
```
Si ya tienes el repositorio:
```bash
git fetch origin && git checkout main && git pull
pnpm install --frozen-lockfile
```

### 2. Revisar que todo esté en verde en la Mac
```bash
pnpm test && pnpm lint && pnpm typecheck && pnpm security
pnpm e2e        # la primera vez: pnpm exec playwright install chromium
pnpm perf       # presupuestos de 15 §2 con 25 000 ventas; anotar los números en esta bitácora
```

### 3. Generar e instalar la app
```bash
pnpm desktop:dist
open "apps/desktop/out/Quick Robot-0.4.0-arm64.dmg"     # Intel: ...-x64.dmg
```
- Arrastra la app a Aplicaciones. Como no está firmada, la primera vez haz clic derecho → **Abrir** → **Abrir**.
- Si macOS no deja abrirla: `xattr -dr com.apple.quarantine "/Applications/Quick Robot.app"`.
- Anota cuánto tarda en abrir la primera vez y la segunda (presupuesto: 3 s y 1.5 s).

### 4. Pasar tus datos del mockup
1. **En el mockup:** Ajustes → Copia de seguridad → **Descargar copia**. Guarda el `.json` en USB o en la nube.
2. **En la app:** Ajustes → Copia de seguridad → **Restaurar desde archivo** → elige ese `.json` → confirma.
3. **Si el resumen dice "Sin diferencias":** listo. **Si hay diferencias o notas:** guarda una captura y no la uses todavía.
4. Revisa filamentos, piezas, pedidos activos y ventas contra el mockup.
5. **En la app:** **Descargar copia** (tu primera copia propia).

Para probar la importación sin tocar la app instalada:
```bash
pnpm import:mockup --data /tmp/prueba-import ~/Descargas/<tu-copia>.json --yes
```

### 5. Usarla una semana
Es la última condición de la fase 4. Anota aquí, con fecha, lo que no se sienta igual al mockup o falle, y el `errorId` si aparece uno.

**Dónde están los datos:** `~/Library/Application Support/Quick Robot/data`. Ahí están la base, `backups/` y `logs/`. Reemplazar la app por una versión nueva no los toca.

### 6. Para continuar con Claude Code en la Mac
- Pide: "Lee `docs/bitacora.md`, `docs/progreso.md`, `docs/mejoras/informe-ronda3-d.md` y el final de `docs/decisiones.md` y continúa".
- `pnpm desktop:dev` abre la app sin empaquetar contra el código.

---

## Pendientes
- **Seguridad:** desde el **2026-11-16**, subir `hono` (≥ 4.13.16) y `@hono/node-server` (≥ 1.19.18) en `packages/server` y `apps/desktop`; correr `pnpm security`, `pnpm test` y `pnpm e2e` (`decisiones.md`, 2026-11-14). Electron ya está en 42.11.18 y sin excepción.
- **En la Mac:** generar e instalar la app, pasar los datos del mockup y usarla una semana (última condición de la fase 4); medir `pnpm perf` y la apertura de la app. Aquí quedaron entre 1× y 2× del presupuesto:

  | Qué | Medido aquí | Presupuesto |
  |---|---|---|
  | Clientes | 526 ms | 300 ms |
  | Productos | 408 ms | 300 ms |
  | Reportes 30 días | 699 ms | 400 ms |
  | Reportes "Todo" | 1.9 s | 1.5 s |
  | Inicio | 637 ms | 400 ms |
  | Búsqueda | 305 ms | 200 ms |
  | Importar 25 000 ventas | 43 s | 30 s |

  Si en la Mac siguen arriba de 1×, lo siguiente es una tabla de sumas por día.
- **Revisar la ronda 3** (`mejoras/informe-ronda3-d.md` › Qué debe revisar la persona): pantallas y palabras nuevas con datos reales; lo que la maqueta muestra y el sistema no tiene (lo más útil: fecha de aceptación del pedido y aviso de filamento en el tablero); decisiones "para revisión" (grises y verde más oscuros por contraste, contadores del menú, pasos del pedido sin fecha de Aceptado).
- **Para revisar** (de fases anteriores, en `decisiones.md`):
  - En "Últimas compras" de Compras, el primer movimiento de cada insumo cuenta como existencia inicial.
  - La búsqueda de ventas y pedidos distingue acentos.
  - Valores de arranque de un negocio nuevo.
  - Nombre de la app en el instalador ("Quick Robot", provisional).
- **PR abiertos de Dependabot** (acciones de GitHub): revisar y unir cuando convenga.
- **Fase 5** (producto público): no iniciada. Requiere planeación (`16`, `17`, `legal/`).

---

## Registro de uso en la Mac
| Fecha | Qué pasó | Acción |
|---|---|---|
| | | |
