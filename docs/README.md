# Quick Robot · Documentación

Sistema para negocios de impresión 3D. Un solo producto: web con suscripción; la aplicación de escritorio es una cáscara removible para uso personal.

| Documento | Para qué sirve |
|---|---|
| [01 · Visión y decisiones](01-vision-y-decisiones.md) | Qué es, alcance, decisiones tomadas y abiertas |
| [02 · Arquitectura](02-arquitectura.md) | **El centro del plan**: un producto, dos modos; fronteras que no se cruzan |
| [03 · Estructura de carpetas](03-estructura-de-carpetas.md) | Monorepo, dependencias permitidas, glosario español ↔ inglés |
| [04 · Reglas de negocio](04-reglas-de-negocio.md) | Fórmulas y estados, con casos de prueba numéricos |
| [05 · Modelo de datos](05-modelo-de-datos.md) | Tablas, columnas, aislamiento, importación del mockup |
| [06 · Pantallas y flujos](06-pantallas-y-flujos.md) | Cada pantalla, botón → caso de uso → destino; flujos de punta a punta |
| [07 · Frontend](07-frontend.md) | Stack, principios, sistema de diseño |
| [08 · Backend](08-backend.md) | Capas, casos de uso, API, interfaces inyectadas, seguridad |
| [09 · Hoja de ruta](09-hoja-de-ruta.md) | Fases, pruebas de riesgo primero, criterios de terminado |
| [10 · Plan de construcción](10-plan-de-construccion.md) | **Qué se hace en cada fase, paso a paso, y qué archivos se crean** |
| [11 · Seguridad](11-seguridad.md) | OWASP Top 10:2025 aplicado; el chequeo `pnpm security` |

| [decisiones](decisiones.md) · [progreso](progreso.md) · [amenazas](amenazas.md) | Registro de decisiones tomadas al construir y estado de cada pantalla (los llena Claude Code) |

Además, `CLAUDE.md` en la raíz del proyecto resume las reglas para quien programe.

**Referencia de comportamiento:** `Quick Robot mockup.html`. Las pantallas y funciones ya están definidas ahí; estos documentos las describen y planean cómo construirlas.

**Por dónde empezar:** `02` (arquitectura) → `09` y `10` (fases) → `04` (primeras pruebas automáticas).
