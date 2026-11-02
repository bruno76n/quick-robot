# Informe · Seguridad aplicada a las fases 1 y 2

**Estándar:** `11-seguridad.md` (OWASP Top 10:2025).
**Estado:** todo lo que `11` pide para la fase 1 está aplicado a lo ya construido (fases 1 y 2). `pnpm security` pasa, igual que `pnpm test` (255 pruebas), `pnpm lint`, `pnpm typecheck` y `pnpm e2e` (9 flujos con la CSP estricta activa).

---

## 1. Lo que estaba mal y se corrigió

| # | Categoría | Hallazgo | Corrección | Cómo se comprobó |
|---|---|---|---|---|
| 1 | A03 | `pnpm audit`: **4 críticas y 5 altas** (vitest/tinypool, shell-quote, vite, zod) y una moderada en el servidor estático | Actualizadas a versiones corregidas | `pnpm audit --audit-level high` en verde |
| 2 | A06 | **Carrera en inventario**: en Postgres, 10 retiros simultáneos de 4 sobre 10 piezas → pasaban **9** (existencia −26) | Bloqueo de fila (`FOR UPDATE`) en compras, usos y conteos de insumos y en movimientos de rollo | Prueba contra Postgres 16: pasan exactamente 2; sin el bloqueo la prueba falla |
| 3 | A01 | Una página web podía mandar escrituras al servidor local (`text/plain` a `127.0.0.1`) | Solo escrituras del mismo origen y con JSON | Pruebas con `Origin` ajeno, `Sec-Fetch-Site: cross-site`, `text/plain` y cuerpo sin tipo (servidor Node real) |
| 4 | A05 | `dangerouslySetInnerHTML` en los íconos | Íconos como JSX; regla de lint que lo prohíbe | Prueba negativa del lint |
| 5 | A10 | Un id inválido (`/products/abc`) llegaba a la base → error 500 | Todo id que no es UUID → 404 antes de tocar la base | Prueba con ids de inyección y rutas relativas |
| 6 | A09 | Los mensajes de error repetían el id recibido | Mensajes sin datos de entrada; validación solo con campo y código | La prueba de acceso entre negocios busca cualquier id ajeno en la respuesta |
| 7 | A10 | Cerrar PGlite con consultas en cola se colgaba (por ejemplo, al apagar después de un error) | Se espera a que la cola se vacíe antes de cerrar | Prueba de error inesperado + cierre |

## 2. Lo que se agregó

- **A01**: `guard(acción)` en **todas** las rutas con `can(ctx, acción)` y negación por omisión (roles owner, admin y operator; el detalle llega en la fase 5). Un id de otro negocio o inválido responde 404.
- **A02**: cabeceras de seguridad (CSP con `script-src 'self'`, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `no-store` en la API; HSTS cuando la raíz de la nube lo pida). Configuración del arranque validada con Zod: solo escucha en `127.0.0.1`/`localhost` y un secreto débil no arranca. `/health` ya no dice el modo.
- **A03**: auditoría y escaneo de secretos en el CI; Dependabot; lista de dependencias en `decisiones.md`.
- **A04**: escaneo de secretos (con prueba negativa); `.env` ignorado; secreto local de 256 bits comparado en tiempo constante.
- **A05**: lint contra `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, `sql.raw` y SQL en cadenas; imágenes verificadas por su firma binaria (un HTML que dice ser PNG se rechaza) y servidas aisladas (`CSP: sandbox`); escape de fórmulas en CSV (`core/csv.ts`, listo para las exportaciones).
- **A06**: topes en montos (≤ $10 M), gramos (≤ 1 000 kg), cantidades y horas; 64 KB por JSON, 2 MB por imagen; límite de escrituras por minuto; `docs/amenazas.md` con las amenazas de cada funcionalidad.
- **A09**: un registro estructurado por petición (`requestId`, negocio, usuario, acción, estado, duración); accesos negados, borrados y errores como avisos; redacción automática de contraseñas, secretos y tokens; archivo rotativo local con permisos solo del usuario.
- **A10**: manejador global con mensaje genérico y `errorId`; promesas no capturadas registradas y excepciones no capturadas detienen el proceso; tiempos de espera del servidor; límite de errores en la interfaz (mensaje en vez de pantalla en blanco).

## 3. `pnpm security`

```
pnpm lint                         fronteras + reglas de seguridad
pnpm audit --audit-level high     falla con vulnerabilidades altas o críticas
node tools/security/scan-secrets.mjs
vitest: tools (lint negativo, escáner) + packages/server/test/security
```

| Prueba (`packages/server/test/security/`) | Qué demuestra |
|---|---|
| `routes-tenancy` | **Todas** las rutas con id (más de 30), llamadas por A con ids de B → 404, sin filtrar ids de B, y los datos de B quedan idénticos; las listas de A no contienen nada de B. Una ruta nueva con id hace fallar la prueba hasta que se agregue |
| `http-hardening` | Un rol desconocido recibe 403 en **todas** las rutas; operador limitado; sin sesión → 401; cabeceras en API y páginas; escrituras de otro sitio, `text/plain`, cuerpos grandes, demasiadas escrituras, ids inválidos; subidas falsas o grandes; foto de otro negocio |
| `inputs-abuse` | Cadenas de ataque (`'; DROP TABLE`, `<script>`, `=HYPERLINK`, rutas relativas) se guardan y devuelven como texto; 11 casos de abuso → 422; doble envío; campos extra ignorados; errores sin eco |
| `failure-injection` | En los **30 casos de uso de escritura**, la escritura principal se hace y luego se fuerza un error: no queda nada escrito |
| `concurrency-postgres` | Con Postgres real, retiros simultáneos nunca pasan de lo que hay (necesita `PG_URL`; el CI lo levanta) |
| `logging-config` | Qué se registra y qué nunca (secreto, contraseñas); error inesperado sin detalle técnico; rotación del archivo; configuración inválida no arranca |

## 4. Riesgos aceptados

- **3 vulnerabilidades moderadas** en herramientas de desarrollo que no se empaquetan (esbuild dentro de drizzle-kit; minimatch dentro de eslint). Se revisarán cuando esas herramientas publiquen versiones corregidas.
- **CSP `style-src 'unsafe-inline'`** para estilos (Radix inserta un `<style>` pequeño); los scripts quedan estrictos.

## 5. Lo que corresponde a fases siguientes (sin cambios aquí)

- **Fase 4**: Electron endurecido (`contextIsolation`, `sandbox`, sin `nodeIntegration`, navegación solo a su dirección); activar el secreto por arranque (el servidor ya lo exige si se configura); aviso de la copia sin cifrar (S3); importar copias como archivo no confiable (S4, A08).
- **Fase 5**: cuentas y sesiones (A07: Argon2id, cookies `HttpOnly`/`Secure`/`SameSite`, límite de intentos), CSRF por cookie, HSTS activado, respaldos y alertas, aviso de privacidad, revisión externa.

## 6. Lo que conviene que revises

1. **Roles**: hoy hay owner, admin y operator. El operator puede registrar movimientos de filamento e insumos, pero no cambiar precios, ajustes ni borrar. ¿Es el reparto que quieres para la fase 5?
2. **Límites**: montos hasta $10,000,000, rollos hasta 1,000 kg, 300 escrituras y 20 fotos por minuto, fotos de hasta 2 MB. ¿Alguno se queda corto para tu negocio?
3. Los **riesgos aceptados** de la sección 4.
