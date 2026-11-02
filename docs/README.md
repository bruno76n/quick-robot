# Quick Robot · Documentación

Sistema para negocios de impresión 3D. Un solo producto: web con suscripción; la aplicación de escritorio es una cáscara removible para uso personal.

## Qué hay y para qué sirve

| Documento | Para qué sirve |
|---|---|
| [01 · Visión y decisiones](01-vision-y-decisiones.md) | Qué es, alcance, decisiones tomadas (D1–D35) y abiertas |
| [02 · Arquitectura](02-arquitectura.md) | **El centro del plan**: un producto, dos modos; fronteras que no se cruzan |
| [03 · Estructura de carpetas](03-estructura-de-carpetas.md) | Monorepo, dependencias permitidas, glosario español ↔ inglés y valores internos |
| [04 · Reglas de negocio](04-reglas-de-negocio.md) | Fórmulas y estados, con casos de prueba numéricos |
| [05 · Modelo de datos](05-modelo-de-datos.md) | Tablas, columnas, vistas, aislamiento, importación del mockup |
| [06 · Pantallas y flujos](06-pantallas-y-flujos.md) | Cada pantalla, botón → caso de uso → destino; flujos de punta a punta |
| [07 · Frontend](07-frontend.md) | Stack, principios, sistema de diseño, estados de carga y de falla |
| [08 · Backend](08-backend.md) | Capas, casos de uso, interfaces inyectadas, migraciones |
| [09 · Hoja de ruta](09-hoja-de-ruta.md) | Las 5 fases y su criterio de terminado |
| [10 · Plan de construcción](10-plan-de-construccion.md) | **Qué se hace en cada fase, paso a paso, y qué archivos se crean** |
| [11 · Seguridad](11-seguridad.md) | OWASP Top 10:2025 aplicado, decisiones y el chequeo `pnpm security` |
| [12 · API](12-api.md) | **Cada operación con su entrada, salida y errores**; catálogo de códigos |
| [13 · Textos y errores](13-textos-y-errores.md) | Todos los mensajes en español: errores, avisos, campos, confirmaciones, estados |
| [14 · Convenciones y pruebas](14-convenciones-y-pruebas.md) | Cómo se nombra y se escribe el código, cómo se escribe una prueba, datos de prueba y cobertura mínima |
| [15 · Rendimiento y errores](15-rendimiento-y-errores.md) | Presupuestos de tiempo, límites, y qué ve la persona cuando algo falla |
| [prompts](prompts.md) | **Un prompt listo para pegar por cada fase**, plantilla de informe y qué hacer entre fases |
| [decisiones](decisiones.md) · [progreso](progreso.md) | Registro de decisiones y estado de cada pantalla (los llena Claude Code) |

Además: `CLAUDE.md` en la raíz del proyecto resume las reglas para quien programe.

## Material de referencia (no son documentos)

| Carpeta o archivo | Qué es |
|---|---|
| `reference/Quick Robot mockup.html` | El comportamiento de referencia. Las pantallas y funciones ya están definidas ahí |
| `reference/mockup-backup-v7.json` | Copia de seguridad del mockup con datos de ejemplo (semilla y prueba del importador) |
| `reference/mockup-textos.md` | Texto visible de cada pantalla y diálogo del mockup (para llenar `es.ts`) |
| `packages/core/test/golden/mockup-values.json` | Costos y precios esperados de cada pieza y colección del mockup (±0.01) |
| `assets/` | Ícono de la app, logo y mascota (provisionales; ver su README) |

## Por dónde empezar

- **Para entender el plan:** `01` → `02` → `09` y `10`.
- **Para construir:** abrir Claude Code en la carpeta del proyecto y pegar el prompt de la fase 1 de [prompts](prompts.md).
- **Para consultar un tema:** reglas → `04` · datos → `05` · pantallas → `06` · operaciones → `12` · textos → `13` · pruebas → `14` · seguridad → `11` · fallos y rendimiento → `15`.

## Lo que todavía no está planeado

Fase 5 (producto público): cuentas y negocios, planes y cobro, lanzamiento y aspectos legales. Se escribirán como `16-nube-cuentas-y-planes.md`, `17-lanzamiento.md` y la carpeta `legal/` antes de empezar esa fase.
