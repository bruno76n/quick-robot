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
- Pide: "Lee `docs/bitacora.md`, `docs/progreso.md`, `docs/informe-fase-4.md` y `docs/decisiones.md` y continúa".
- `pnpm desktop:dev` abre la app sin empaquetar contra el código.

---

## Pendientes
- **Electron:** a partir del **2026-11-03**, subir a ≥ 42.11.16 (`apps/desktop/package.json`). Luego quitar la excepción `GHSA-jr5w-w6x2-84p9` de `pnpm-workspace.yaml` y correr `pnpm security`.
- **Medir en la Mac:** `pnpm perf` y la apertura de la app. Aquí quedaron entre 1× y 2× del presupuesto:

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
- **Para revisar** (marcados en `decisiones.md`):
  - En "Últimas compras" de Compras, el primer movimiento de cada insumo cuenta como existencia inicial.
  - La búsqueda de ventas y pedidos distingue acentos.
  - Valores de arranque de un negocio nuevo.
  - Nombre de la app en el instalador ("Quick Robot", provisional).
- **Agregados que no están en el mockup** (los pide `06`): filtro de periodo en Gastos, "Inversión recuperada" en Reportes, columna "Total" en documentos, "Hacer copia ahora" y resumen al restaurar.
- **PR abiertos de Dependabot** (#1–#3, acciones de GitHub): revisar y unir cuando convenga.
- **Fase 5** (producto público): no iniciada. Requiere planeación (`16`, `17`, `legal/`).

---

## Registro de uso en la Mac
| Fecha | Qué pasó | Acción |
|---|---|---|
| | | |
