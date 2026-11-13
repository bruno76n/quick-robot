# Informe de la ronda 2 · fase B (rediseño)

## Resumen
Productos agrupa las variantes en familias (panel en Fichas, filas que se despliegan en Lista, un solo flujo para crear una variante); Existencias tiene Lista (por defecto) y Fichas sin cubitos, filtros por estado y familias que suman a sus miembros; Inicio ordena la atención por prioridad (Urgente, Esta semana, Para revisar) y ya no muestra rollos. La interfaz quedó sin morado, con todo el color en `tokens.css`. **Por decisión de la persona (2026-11-13) la mascota se conserva**: lo que se quitó fue el morado, no el logo. Rama `ronda2-b-rediseno`; todos los comandos de `ronda-2 §1.3.1` en verde en la punta.

## Pasos
| Paso | Estado | Commit | Notas |
|---|---|---|---|
| B1.1 | hecho | `6665dd6` | Tokens en un solo archivo; `--accent`, `--cost`, `--cost-soft` |
| B1.2 | hecho | `a6737cd` | Foco y casillas con `--accent` |
| B1.3 | hecho, luego cambiado | `6ee4f85` | Monograma en la barra lateral; **sustituido por la mascota en `086821c`** |
| B1.4 | hecho, luego deshecho | `ad0dbce`, `9f4b690` | Quitaba la mascota; **deshecho en `086821c`** por decisión de la persona |
| B2.1 | hecho | `6e7794e` | `displayName` y etiqueta desde un nombre viejo |
| B2.2 | hecho | `fb96b9a` | Estado de familia (caso 5.3) |
| B2.3 | hecho | `ff18f5e` | `classifyAttention` |
| B2.4 | hecho | `150630d` | Migración aditiva 0007 |
| B2.5 | hecho | `8ee37a1` | Consultas de página de familias |
| B2.6 + B2.7 | hecho | `2721f2a` | Un commit: comparten caso de uso y rutas |
| B2.8 | hecho | `9d13e04` | `PRODUCT_HAS_VARIANTS` |
| B2.9 | hecho | `0d12bb8` | `displayName` en fotos de venta, búsqueda, reportes |
| B2.10 | hecho | `d816925`, `3018f38` | `GET /stock` por familias (ver “Bloqueado o dudoso”) |
| B2.11 | hecho | `5be9ba9` | `severity` urgente / pronto / revisar |
| B2.12 | hecho | `6f93974` | Importar y semilla normalizan variantes |
| B2.13 | hecho | `a0bf049` | Carga con 50 familias |
| B3.1 | hecho | `6e30535` | Selectores con `/products/options` |
| B3.2 | hecho | dentro de `2f6d4ec` | Ver “Bloqueado o dudoso” |
| B3.3 | hecho | `76e3c28` | Lista con filas de variantes |
| B3.4 | hecho | `ef92420`, `7db0907` | Filtro “Con variantes”, contadores, búsqueda del servidor, “Ver más” |
| B3.5 | hecho | `7db0907` | Un solo flujo de variante nueva |
| B4.1–B4.4 | hecho | `2f6d4ec`, `962c53d` | Un commit para los cuatro pasos de Existencias (el cuerpo del commit los enumera) y su e2e |
| B5.1 | hecho | `5b21e20` | Atención por prioridad |
| B5.2 | hecho | `a892bb3` | Sin rollos en Inicio |
| B6.1 | hecho | `2ef0cea` | Los textos ya estaban; se borró el CSS sin uso |
| — | hecho | `086821c` | `feat(web): restore the mascot and brand marks (person's decision)` |
| B6.2 | hecho | `d1fe82d` | Flujo de punta a punta de la variante, 1440 y 390 |
| B6.3 | hecho | `5c18471` | Barrido de morado y “Quick Robot”; CSS compilado |
| B6.4 | hecho | este commit | Informe, progreso, rendimiento y comparación |

## Pruebas
- **Reglas de core:** nombre y etiqueta de variante (los casos de `informe-ronda2-a §4.3`), estado de familia (los cuatro del caso 5.3 y el mixto), `classifyAttention` por tipo y por frontera de fecha. `pnpm test:tz`: 167 pruebas en verde.
- **Casos de uso y rutas:** `pnpm test` 597 pruebas en verde (7 omitidas: las de rendimiento, que corren con `PERF=1`), con migración sobre variantes en cadena, huérfanas y con “(variante)”, aislamiento entre negocios en las consultas nuevas y `PRODUCT_HAS_VARIANTS` (camino feliz, error y fallo a la mitad).
- **Seguridad:** `pnpm security` en verde (153 pruebas, audit, secretos, cabeceras, acceso entre negocios).
- **Playwright:** `pnpm e2e` 77 en verde, 5 omitidas (las de la app de escritorio, que necesitan Electron). Nuevas de la ronda 2: `products-variants`, `stock-families`, `home-attention`, `ronda2-flows` (crear una variante en Productos → su panel → Existencias con la suma de la familia → selector de venta → venderla, en 1440 y 390) y `no-purple` (ver abajo).
- **Sin morado ni marca escrita (B6.3):** después de renombrar el negocio en Ajustes, recorre las 14 pantallas del menú en 1440 y 390 y revisa el color calculado (texto, fondo, bordes, contorno, sombra, relleno, `accent-color`) de cada elemento, también con foco de teclado; excluye la mascota y lo que se pinta con color de dato (estilo en línea). Ningún texto ni el título dice “Quick Robot”. Revisa también el CSS compilado de `dist/assets`. La prueba se comprobó al revés (con el gris de la tinta en la lista, falla). No exige que falte la mascota.
- **Otros:** `pnpm lint` 0 errores (29 avisos, de antes), `pnpm typecheck` en verde, `pnpm size` 211.0 KB de 350 KB.

### Rendimiento
`pnpm perf` (`PERF=1`, base de carga guardada: 500 piezas, 50 familias con variantes, 25 000 ventas), en el contenedor con la máquina libre; p95 en ms, rango de 4 corridas. Para separar el ruido se corrió también `main` (sin la ronda 2) en un árbol aparte, dos veces, en la misma sesión.

| Ruta | Línea base (`informe-ronda2-a §5`) | `main` hoy | Rama hoy | Presupuesto `15 §2` | Peor / presupuesto |
|---|---|---|---|---|---|
| `GET /products` | 329 | 292–341 | 266–331 | 300 | 1.10× |
| `GET /products?filter=with_variants` | — | — | 269–373 | 300 | 1.24× |
| `GET /products?q=Variante 12` | — | — | 146–174 | 300 | 0.58× |
| `GET /products/options` | — | — | 245–333 | 300 | 1.11× |
| `GET /stock` | 143 | 108–148 | 108–158 | 300 | 0.53× |
| `GET /stock?status=few` | — | — | 111–148 | 300 | 0.49× |
| `GET /stock?sort=free_desc&q=carga` | — | — | 127–148 | 300 | 0.49× |
| `GET /home` | 423 | 444–471 | 447–579 | 400 | 1.45× |
| `GET /search?q=spider` | 197 (`q=pieza`) | 248–279 | 196–271 | 200 | 1.36× |
| `GET /reports?period=30` | 502 | 431–499 | 474–594 | 400 | 1.49× |

Ninguna pasa de 2× y `pnpm perf` queda en verde. `/products`, `/stock` y `/search` están en el mismo rango que `main`. `/home` está en promedio ~10 % arriba de `main` (mediana de la rama ≈ 514 contra ≈ 458): la consulta no cambió; se agrega `classifyAttention` y `displayName` en memoria sobre 2 616 atenciones. Queda marcado para revisión (ver abajo). `/reports?period=30` no se tocó en la ronda 2 y varía igual.

## Comparación con las maquetas
Capturas de `reference/ronda-2/*.html` contra la app (`pnpm dev`, semilla del mockup) en 1440, 820 y 390.

| Pantalla | 1440 | 820 | 390 |
|---|---|---|---|
| Productos · Fichas | igual | igual | igual |
| Productos · Lista | igual | igual (la tabla se desplaza dentro de su caja, como la maqueta) | igual (tarjetas) |
| Existencias · Lista | igual | igual | diferencia aceptada: cada fila es tarjeta (`decisiones.md` B4) |
| Existencias · Fichas | igual | diferencia aceptada: 3 columnas porque en 820 la app usa barra superior y no lateral; un nombre largo se parte dentro de la palabra (“trepan-do”) | igual (una columna) |
| Inicio | igual | igual | igual |

Diferencias aceptadas en todas: la **mascota** junto al nombre del negocio, en el título de Inicio y en los estados vacíos (decisión de la persona; la maqueta dibuja un monograma); el panel de variantes empieza cerrado (la maqueta lo dibuja abierto para mostrarlo); el subtítulo “Las variantes viven dentro de su pieza” no se agregó (no está en `ronda-2 §9`).

## Decisiones tomadas
En `docs/decisiones.md`, al final, bajo “2026-11-13 · Ronda 2 · Fase B”: B1.1–B1.4, B2.1–B2.13, B3.1–B3.5, B4.1–B4.4, B5.1–B5.2, B6.1–B6.4 y **“decisión de la persona: la mascota se queda”** (cambia `ronda-2 §2 Marca`, D36, `CLAUDE.md` Diseño, `06 §1` y `07`).

## Bloqueado o dudoso
Dicho con honestidad, para que no sorprenda al leer la historia:
1. **Commits en rojo a la mitad:** B2.4–B2.7 (`150630d`, `8ee37a1`, `2721f2a`) y B2.12 (`6f93974`) dejaron **2 pruebas del servidor en rojo** hasta B2.8 `9d13e04`; `d816925` (B2.10) **no pasaba `typecheck`** hasta `3018f38`.
2. **B3.2 dentro de otro commit:** el trabajo de B3.2 (fichas por familia con el panel, `material` de la original, `products.css`, su e2e) quedó dentro del commit de B4 `2f6d4ec` porque otro paso hizo commit con lo que estaba preparado (carrera de `git add`).
3. **Lint:** `ef92420` tenía un error de lint, corregido en `7db0907`.
4. La historia **no se reescribió** (`CLAUDE.md` y el plan lo prohíben). La punta de la rama está en verde.
5. **Etiqueta `antes-ronda2-a`:** existe solo en local; este entorno no deja subir etiquetas. El coordinador volverá a intentarlo con `antes-ronda2-b`.
6. **`/home` ~10 % más lento que `main`** con la carga (dentro de 2×, ya pasaba de 1× antes de la ronda). Si se quiere bajar: mandar menos atenciones (por ejemplo, 50 por grupo con su total) en lugar de las 2 616.
7. **Existencias · Fichas en 820:** un nombre largo puede partirse dentro de la palabra en tarjetas de 250 px.

## Qué conviene que revise la persona
- Que la mascota se vea donde la quería (barra lateral, barra superior en móvil, título de Inicio, estados vacíos, página de falla, ícono de la pestaña) y que el resto se vea neutro.
- Productos: abrir el panel de variantes, crear una variante desde “+ Variante” y desde “Guardar como variante nueva”.
- Existencias: Lista contra Fichas, filtros por estado, que una familia sume a sus variantes.
- Inicio: si los tres grupos de atención ordenan bien lo de su negocio real.
- El punto 6 de arriba (si `/home` se siente lento con muchos cobros pendientes).

## Cómo probarlo
```
pnpm install
pnpm dev                 # abre /productos, /existencias, /inicio
pnpm test && pnpm test:tz && pnpm lint && pnpm typecheck
pnpm e2e                 # incluye ronda2-flows y no-purple
pnpm exec playwright test e2e/ronda2-flows.spec.ts e2e/no-purple.spec.ts
pnpm security && pnpm size
pnpm perf                # PERF=1, base de carga guardada en el directorio temporal del sistema
```
