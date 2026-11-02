# Prompts para Claude Code

Un prompt listo para pegar por cada fase. Se pegan **uno a la vez**, en una sesión nueva de Claude Code abierta en la carpeta del proyecto. No hay que explicar nada más: todo lo que Claude necesita está en `CLAUDE.md` y en `docs/`.

**Cómo funciona:** Claude trabaja solo (modo autónomo, `CLAUDE.md`), una rama por fase, un commit por paso, y se detiene únicamente en los casos de parada. Al terminar deja un informe en `docs/informe-fase-N.md`. Tu parte entre fases está en §7.

---

## 0. Preparar la carpeta del proyecto (una sola vez)

Antes del primer prompt, la carpeta del proyecto debe tener exactamente esto (es lo que contiene el .zip):

```
CLAUDE.md
docs/                       los documentos (01 al 15, decisiones, progreso, prompts)
reference/                  el mockup, su copia de ejemplo y los textos extraídos
assets/                     íconos y logo (provisionales)
packages/core/test/golden/  valores esperados del mockup
```

Pasos: crear la carpeta, descomprimir el .zip dentro, abrir Claude Code en esa carpeta y pegar el prompt de §1.

---

## 1. Fase 1 · Cimientos y esqueleto que camina

```
Haz la fase 1 de docs/10-plan-de-construccion.md en modo autónomo.

Primero lee CLAUDE.md completo. Después lee solo estos documentos:
02, 03, 05 (reglas generales y tablas de filamento), 07, 08, 11, 12 (§1 a §3 y §8 filamentos), 14 y 15 (§3 y §4).
Revisa también reference/ y packages/core/test/golden/.

Empieza por el paso 1.0 (comprobación de PGlite, un día) y registra el resultado en
docs/decisiones.md con los números medidos. Si falla, aplica el plan B de docs/02 §4 y continúa.

Después, en orden: 1.1 monorepo y herramientas (incluye pnpm security y la prueba de que el lint
rechaza una frontera rota), 1.2 core, 1.3 contract, 1.4 db, 1.5 server, 1.6 web, 1.7 semilla.

Crea la rama fase-1. Un commit por paso, mensaje en inglés. Un paso solo se da por terminado
cuando pasan pruebas, lint, typecheck y pnpm security (docs/14 §6).

La fase termina cuando: agrego un rollo de filamento en el navegador y queda guardado en el
archivo local; los casos 1.1 y 1.2 de docs/04 pasan; la prueba de aislamiento entre negocios pasa;
y el lint rechaza una frontera rota.

No hagas nada fuera de la fase 1. No me hagas preguntas salvo los casos de parada de CLAUDE.md.
Al terminar escribe docs/informe-fase-1.md (plantilla en docs/prompts.md §6) y actualiza docs/progreso.md.
```

---

## 2. Fase 2 · Taller y catálogo

```
Haz la fase 2 de docs/10-plan-de-construccion.md en modo autónomo. Parte de la rama fase-1
ya fusionada en main; crea la rama fase-2.

Lee CLAUDE.md y docs/informe-fase-1.md. Después solo estos documentos:
04 (§1 a §3, §9 y §11), 05 (taller y catálogo), 06 (§3, §6 a §8 y §15), 12 (§4, §5 y §8),
13 (§3 y §6), 14 y 15 (§4).

Orden: 2.1 golden tests (usa packages/core/test/golden/mockup-values.json, ya existe; la
herramienta tools/export-mockup-golden.mjs es opcional y solo sirve para regenerarlo),
2.2 core, 2.3 datos y servidor por área, 2.4 pantallas.

Reglas: cada pantalla se compara con el mockup en tres anchos (1440, 820, 390) usando las
capturas de Playwright y se corrige hasta quedar igual en estructura, textos, colores y
comportamiento; los textos salen de reference/mockup-textos.md y docs/13.

La fase termina cuando packages/core/test/golden.test.ts pasa para todas las piezas y
colecciones de ejemplo (tolerancia ±0.01), todas las operaciones de docs/12 de esas áreas
tienen su prueba (camino feliz, cada error y fallo a la mitad), pnpm security está en verde y las
pantallas de la fase están "igual al mockup" en docs/progreso.md.

No hagas nada fuera de la fase 2. No me hagas preguntas salvo los casos de parada de CLAUDE.md.
Al terminar escribe docs/informe-fase-2.md y actualiza docs/progreso.md.
```

---

## 3. Fase 3 · Vender y producir

```
Haz la fase 3 de docs/10-plan-de-construccion.md en modo autónomo. Parte de main con la fase 2
fusionada; crea la rama fase-3.

Lee CLAUDE.md y docs/informe-fase-2.md. Después solo estos documentos:
04 (§4 a §8, §10, §12 y §13), 05 (existencias, ventas, pedidos, producción), 06 completo,
12 (§6 a §9), 13 completo, 14 (§2 a §5) y 15 (§2 a §5).

Sigue el orden interno 3.1 a 3.8 de docs/10: existencias, clientes, ventas, pedidos, producción y
colas, gastos, reportes y compras, inicio/documentos/búsqueda/atajos. Cada paso depende del
anterior; en cada uno: regla en core con su prueba → tablas → caso de uso con prueba de
transacción y de abuso → ruta → pantalla comparada con el mockup.

Escribe los seis flujos A a F de docs/06 §17 como pruebas de Playwright en e2e/ y las pruebas de
rendimiento y de estados de falla de docs/15 §7.

La fase termina cuando pasan los seis flujos, los casos 4.1 a 10.1 de docs/04, los presupuestos de
docs/15 §2 y pnpm security; y las 14 pantallas del menú más las 5 de detalle están "igual al
mockup" en docs/progreso.md.

Esta fase es larga: si el contexto se llena, termina el paso en curso con sus pruebas, haz commit,
anota en docs/progreso.md en qué paso quedaste y continúa desde ahí.

No hagas nada fuera de la fase 3. No me hagas preguntas salvo los casos de parada de CLAUDE.md.
Al terminar escribe docs/informe-fase-3.md y actualiza docs/progreso.md.
```

**Para correr un solo paso de la fase 3** (por ejemplo, si se interrumpió):

```
Continúa la fase 3 de docs/10-plan-de-construccion.md en modo autónomo, en la rama fase-3.
Lee docs/progreso.md para ver en qué paso quedó y haz solo el paso 3.N. Mismo protocolo y misma
definición de "terminado" que la fase completa. Al terminar, actualiza docs/progreso.md.
```

---

## 4. Fase 4 · Electron y uso diario

```
Haz la fase 4 de docs/10-plan-de-construccion.md en modo autónomo. Parte de main con la fase 3
fusionada; crea la rama fase-4.

Lee CLAUDE.md y docs/informe-fase-3.md. Después solo estos documentos:
02 (§6), 05 (importar el mockup), 08 (migraciones y seguridad), 11, 12 (§10), 15 (§5 y §6).

Orden: cáscara de Electron (apps/desktop) con el servidor dentro de la misma app, en 127.0.0.1,
puerto aleatorio y secreto por arranque que Electron agrega a cada petición de la ventana;
importador del mockup v7 con reference/mockup-backup-v7.json; exportar y restaurar;
copias automáticas (BackupStore: una por día, las últimas 7) y migraciones locales con copia
previa; vaciar negocio; pulido (menú, ícono de assets/, abrir al iniciar sesión).
Sin actualización automática ni firma de Apple: se instala la versión nueva a mano.

IMPORTANTE: nunca toques mis datos reales. Todas las pruebas usan reference/mockup-backup-v7.json
o datos generados. La importación de MIS datos la hago yo al final, con la app ya instalada.

El importador debe imprimir un resumen y comparar sumas antes y después (rollos, existencias,
totales de ventas, por cobrar) y no dar ninguna diferencia con la copia de ejemplo.

La fase termina cuando: el .dmg abre en esta Mac; la importación del mockup no da diferencias;
una actualización de prueba (versión nueva sobre la anterior) conserva los datos; una migración
que falla restaura la copia; los estados de falla de docs/15 §5 se ven como se describen;
pnpm security está en verde con el endurecimiento de Electron de docs/11 (A02).

No hagas nada fuera de la fase 4. No me hagas preguntas salvo los casos de parada de CLAUDE.md.
Al terminar escribe docs/informe-fase-4.md con los pasos exactos para instalar el .dmg y para
importar mis datos, y actualiza docs/progreso.md.
```

---

## 5. Fase 5 · Producto público

> **No usar todavía.** La planeación de la fase 5 no está terminada: faltan `docs/16-nube-cuentas-y-planes.md`, `docs/17-lanzamiento.md` y `legal/`. Cuando existan, este prompt queda listo.

```
Haz la fase 5 de docs/10-plan-de-construccion.md en modo autónomo. Parte de main con la fase 4
fusionada y con al menos una semana de uso diario real; crea la rama fase-5.

Antes de empezar comprueba que existen docs/16-nube-cuentas-y-planes.md, docs/17-lanzamiento.md y
la carpeta legal/. Si falta alguno, detente y dímelo.

Lee CLAUDE.md y docs/informe-fase-4.md. Después solo: 02 (§5), 08, 11, 12 (los códigos reservados
de §2), 15 (§4 frecuencia), 16, 17 y legal/.

Orden: raíz de la nube (apps/cloud), cuentas y sesiones, asistente de primera vez, planes y cobro,
archivos en la nube, correo, aislamiento reforzado (RLS y prueba con dos negocios), importar desde
escritorio, y las partes de docs/11 marcadas para la fase 5.

Necesito darte credenciales (hosting, base administrada, proveedor de pagos, correo): cuando
llegues a ese punto, detente, dime exactamente qué necesitas y en qué formato, y sigue con lo
que no dependa de ellas (CLAUDE.md, casos de parada).

La fase termina cuando una persona nueva se registra, crea su negocio vacío, paga, completa el
flujo B de docs/06 §17 y no puede ver nada de otro negocio, y la revisión de seguridad de
docs/11 está hecha.

Al terminar escribe docs/informe-fase-5.md y actualiza docs/progreso.md.
```

---

## 6. Plantilla de `docs/informe-fase-N.md`

Claude la usa al cerrar cada fase. Debe poder leerse en cinco minutos.

```
# Informe de la fase N

## Resumen
Dos o tres frases: qué quedó funcionando.

## Pasos
| Paso | Estado | Commit | Notas |

## Pruebas
- Reglas de core: casos de docs/04 que pasan (lista).
- Casos de uso y rutas: cantidad de pruebas y cobertura frente a docs/14 §4.
- Seguridad: resultado de pnpm security.
- Flujos de Playwright: cuáles pasan.
- Rendimiento: tiempos medidos frente a docs/15 §2.

## Comparación con el mockup
Tabla pantalla × (1440 / 820 / 390): igual / diferencia aceptada (con motivo) / pendiente.

## Decisiones tomadas
Enlaces a las entradas de docs/decisiones.md.

## Bloqueado o dudoso
Qué quedó sin hacer y por qué; qué necesita mi decisión.

## Qué conviene que revise la persona
Lista corta y concreta.

## Cómo probarlo
Comandos o pasos exactos.
```

---

## 7. Tu parte entre fases

1. **Lee el informe** de la fase (`docs/informe-fase-N.md`): empieza por "Bloqueado o dudoso" y "Qué conviene que revise la persona".
2. **Pruébalo tú:** abre la app (`pnpm dev`, o el `.dmg` en la fase 4) y compárala con el mockup usando tus propios casos.
3. **Si algo está mal**, dilo en lenguaje normal ("el costo de esta pieza no coincide con el del mockup"); Claude lo corrige en la misma rama y lo registra.
4. **Cuando estés conforme**, fusiona la rama a `main` y abre una sesión nueva para la fase siguiente.
5. **Nunca** fusiones una fase con pruebas en rojo.
6. Antes de la fase 4, haz una copia de seguridad del mockup actual (Ajustes › Descargar copia) y guárdala aparte: es tu respaldo.

## 8. Si algo sale mal

| Situación | Qué pegar |
|---|---|
| Claude se detuvo y no entiendo por qué | `Resume en lenguaje sencillo por qué te detuviste, qué ya está hecho y qué necesitas de mí.` |
| Quedó una prueba en rojo | `Corrige la prueba que falla sin cambiar el número esperado de docs/04 ni los valores de golden/. Si el número esperado está mal, dímelo antes de tocarlo.` |
| Algo no se ve igual al mockup | `Compara la pantalla X con el mockup en 1440, 820 y 390, lista las diferencias y corrígelas. Textos: reference/mockup-textos.md.` |
| Quiero ver cómo va todo | `Resume docs/progreso.md: qué pantallas están igual al mockup, cuáles no y qué sigue.` |
| Se interrumpió una sesión | `Continúa donde quedaste: lee docs/progreso.md y el último commit de la rama actual.` |
