# Informe de la fase 1

## Resumen
El monorepo está armado con sus fronteras vigiladas por el lint, y el recorrido mínimo funciona de punta a punta: en el navegador se agrega un rollo de filamento, aparece en la lista y sigue ahí después de reiniciar, guardado en un archivo local de PGlite. La pantalla de Filamentos (lista, cajón y diálogo "Agregar rollo") se ve igual que el mockup en los tres anchos, con los datos de ejemplo del mockup.

## Pasos
| Paso | Estado | Commit | Notas |
|---|---|---|---|
| Ajuste previo | hecho | `3304149` | Caso 1.3 agregado a la fase 1 en `10` y `prompts.md` |
| 1.0 Comprobación de PGlite | pasa | `acd9b07` | Los 5 criterios pasan; sin plan B (ver abajo) |
| 1.1 Monorepo y herramientas | hecho | `b9a9279` | Lint con fronteras y reglas de seguridad, `pnpm security`, `pnpm size`, CI, prueba negativa |
| 1.2 `core` | hecho | `90ad0c5` | `money.ts`, `filament.ts` (casos 1.1, 1.2, 1.3) |
| 1.3 `contract` | hecho | `c7565cf` | Los 45 códigos de error y 5 avisos de `12 §2`, esquemas de filamento |
| 1.4 `db` | hecho | `0d6f450` | Tablas, vista `spool_levels`, repositorios con `ctx`, aislamiento |
| 1.5 `server` | hecho | `b0199e3` | `createApp(deps)`, proveedores locales, `addSpool`, pruebas de seguridad |
| 1.6 `web` | hecho | `290cab5` | Marco de la app, textos, formatos, cliente, Filamentos |
| 1.7 Semilla y arranque | hecho | `02ab34d` | Semilla del mockup, `pnpm dev` / `pnpm start`, flujo E2E |

**Comprobación de PGlite** (Linux, 4 CPU; detalle en `decisiones.md` y `spikes/pglite/results/`):

| Criterio de `02 §4` | Resultado |
|---|---|
| Mismas migraciones en PGlite y Postgres 16 | Pasa |
| Ventas por pieza, 12 meses, 5 000 ventas (< 200 ms) | 17.7 ms (p95) |
| "Todo" con 25 000 ventas (< 1.5 s) | 53.5 ms (p95) |
| Cierre forzado (`kill -9`, 8 rondas) | 0 lotes a medias |
| PGlite dentro de Electron empaquetado | Pasa en Linux; la Mac se prueba en la fase 4 |
| RLS | Pasa en PGlite y Postgres |

## Pruebas
- **Reglas de core:** casos **1.1** ($0.54), **1.2** (47.6 g de consumo + 2.4 g de purga, inventario en 0, faltan 55 g) y **1.3** (Nuevo, Normal, Poco, Se acaba, Agotado; rollo de 250 g = Poco). Además, propiedades con `fast-check`: un rollo nunca queda en negativo, y redondear al guardar no mueve un total más de $0.01. También pasan con `TZ=UTC` (`pnpm test:tz`).
- **Casos de uso y rutas:** 155 pruebas en verde, más 1 que solo corre con Postgres (también pasa contra Postgres 16).

  | Proyecto | Pruebas |
  |---|---|
  | core | 23 |
  | contract | 5 |
  | db | 20 |
  | server | 53 |
  | web | 28 |
  | tools | 27 |

  Cobertura frente a `14 §4`: `core` 100 % de líneas y 95.5 % de ramas; los umbrales de casos de uso, `lib/` y `components/` se cumplen.
- **Aislamiento:** `tenancy.test.ts` recorre el esquema y exige que cada tabla tenga `workspace_id` y esté probada. Lecturas, búsquedas, sumas y escrituras con el negocio A nunca tocan B. Un repositorio sin `ctx` falla antes de ejecutar SQL.
- **Seguridad:** `pnpm security` en verde: lint de seguridad, `pnpm audit` sin altas ni críticas (2 moderadas en herramientas de desarrollo) y escaneo de secretos. Pruebas que pasan:
  - matriz de acceso: todas las rutas con ids de otro negocio → 404, sin sesión → 401, rol desconocido → 403;
  - cabeceras de seguridad;
  - inyección en cada campo de texto;
  - entradas no confiables;
  - configuración insegura que no arranca;
  - fallo a la mitad de cada escritura sin dejar nada escrito;
  - registro sin secretos;
  - archivos de registro rotativos.
- **Prueba negativa de fronteras:** el lint rechaza 17 violaciones (por ejemplo `core`→`db`, `web`→`server`, `mode === 'cloud'` o texto en español en un componente). dependency-cruiser rechaza `packages/core/test/fixtures/forbidden-import.ts`.
- **Flujos de Playwright:** "agregar rollo → aparece en la lista → sigue ahí después de reiniciar", con el error "Elige el material y el color del rollo.", un filamento nuevo y un segundo rollo que se suma a PLA Blanco. Además, la pantalla carga sin errores de consola y sin desborde horizontal en 1440, 820 y 390 px.
- **Rendimiento:** JS inicial de 110.7 KB comprimido (límite 350 KB). Los presupuestos de `15 §2` se miden en la fase 3; las consultas de reportes ya se midieron en la comprobación de PGlite.

## Comparación con el mockup
| Pantalla | 1440 | 820 | 390 |
|---|---|---|---|
| Filamentos (lista) | igual | igual | igual |
| Diálogo "Agregar rollo" | igual | igual | igual |
| Cajón de filamento | igual, con diferencias aceptadas | igual | igual |

Diferencias aceptadas:
- **Botones del cajón:** "Movimiento", "Editar" y "Registrar movimiento" llegan en la fase 2.
- **Fechas:** el mockup genera sus fechas a partir de hoy, así que en las capturas salen corridas un día.
- **Barra lateral:** el giro bajo el nombre del negocio aparece con Ajustes, y "Nueva pieza" queda deshabilitado hasta la fase 2.

Por eso la fila de Filamentos en `progreso.md` queda **en curso** y no "igual al mockup".

## Decisiones tomadas
En `docs/decisiones.md`, entradas del 2026-11-02 (pasos 1.0, 1.1, 1.5, 1.6 y 1.7). Las principales:
- **PGlite pasa:** se queda Postgres en los dos modos. RLS queda como segunda barrera para la fase 5.
- **Vitest 4:** `vitest.config.ts` con `projects`, porque `vitest.workspace.ts` ya no existe. Las versiones se fijan exactas, con al menos dos semanas publicadas.
- **Escrituras:** solo del mismo origen y en JSON. Un id que no es UUID responde 404.
- **Estilos:** CSS del mockup copiado tal cual, y `<dialog>` nativo en lugar de shadcn/Radix. Es un cambio de herramienta registrado.
- **Catálogo inicial:** materiales, colores y marcas genéricos en `core/catalog.ts`. El nombre del filamento ignora mayúsculas, acentos y espacios.
- **Lista de filamentos:** suma `activeSpools`, `brands`, `capacityGrams` y `valueCents`; `12 §8` está actualizado.
- **Semilla:** se lee de `reference/mockup-backup-v7.json` y se aplica con `addSpool`.

## Bloqueado o dudoso
- **Nada bloqueado.**
- **Electron empaquetado para Mac** sin probar, porque aquí no hay macOS. En Linux funciona y se vuelve a probar en la fase 4.
- **`pnpm start`** (sin Electron) no exige secreto. Escucha solo en `127.0.0.1` y rechaza escrituras de otros sitios. El secreto por arranque lo agrega la ventana de Electron en la fase 4; con `pnpm dev` ya se exige.
- **Primera creación de la base:** tarda 4–8 s (initdb dentro de WASM). En la fase 4 conviene un "Preparando datos…".
- **CI** (`.github/workflows/ci.yml`): está escrito, pero no lo he visto correr en GitHub.

## Qué conviene que revise la persona
1. **Filamentos en el navegador** (comandos abajo): que la lista, el cajón y "Agregar rollo" se sientan como el mockup.
2. **Tipografía y esquinas:** se siguió el mockup (radios de 5–12 px), no los 20/10/18 px que dice `07`. Si `07` es el bueno, hay que corregirlo allí.
3. **Pantallas de fases siguientes:** el menú ya las muestra, con un aviso de que llegan en otra fase.

## Cómo probarlo
```bash
pnpm install
pnpm dev            # http://127.0.0.1:5173/filamentos — datos del mockup en memoria
pnpm dev -- --file  # igual, guardando en .data/
pnpm start          # compila y sirve en http://127.0.0.1:8787 con los datos en .data/
pnpm test && pnpm lint && pnpm typecheck && pnpm security && pnpm e2e
```
