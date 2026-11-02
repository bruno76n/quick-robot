# 11 · Seguridad

**Estándar:** [OWASP Top 10:2025](https://top10.owasp.org/2025/0x00_2025-Introduction/). Todo lo que corre en la parte web (la interfaz y la API, que son las mismas en tu Mac y en la nube) se construye cumpliéndolo **desde la fase 1**. Lo que solo existe en la nube (cuentas, hosting, cobro) se implementa en la fase 5, pero el código ya deja el lugar preparado (`AuthProvider`, `Entitlements`, `Mailer`).

## Decisiones propias

| # | Decisión |
|---|---|
| S1 | OWASP Top 10:2025 es el estándar para todo lo web. Ningún paso se da por terminado si rompe el chequeo de seguridad (`pnpm security`) |
| S2 | La app de escritorio **no** pide contraseña propia: la protección local es el inicio de sesión de macOS y FileVault |
| S3 | La copia de seguridad es un archivo normal, **sin cifrar** (riesgo aceptado). La app muestra el aviso: *"Esta copia contiene todos los datos del negocio. Guárdala en un lugar seguro."* |
| S4 | Todo archivo que se importa (copia o datos) se trata como **no confiable** y se valida antes de aplicarlo |

## Las diez categorías aplicadas

| # | Categoría | Qué significa aquí | Medidas | Fase | Cómo se verifica |
|---|---|---|---|---|---|
| A01 | **Control de acceso roto** | Que un negocio (o usuario) vea o toque datos que no son suyos | `workspace_id` en toda tabla y consulta; los repositorios exigen `ctx` y no existe consulta sin él; cada ruta resuelve `ctx` antes de actuar; negar por defecto; cada operación pasa por `can(ctx, acción)`; un id ajeno responde 404, nunca 403 con datos; CORS restringido; en local, secreto por arranque | 1 (completo en 5 con roles) | Prueba automática que recorre **todas** las rutas registradas con ids de otro negocio y exige 404; `tenancy.test.ts` por tabla |
| A02 | **Configuración de seguridad incorrecta** | Valores por defecto inseguros, información de más | Cabeceras: CSP estricta, `X-Content-Type-Options`, `frame-ancestors 'none'`, `Referrer-Policy`, HSTS en la nube; sin errores con detalle técnico; configuración validada con Zod al arrancar (falla si falta algo); Electron endurecido: `contextIsolation`, sin `nodeIntegration`, `sandbox`, navegación solo a su dirección | 1 (web) · 4 (Electron) · 5 (hosting) | Prueba que pide la app y revisa cabeceras; prueba de arranque con configuración incompleta; revisión de opciones de `BrowserWindow` |
| A03 | **Fallas en la cadena de suministro de software** | Dependencias o compilaciones comprometidas | `pnpm-lock.yaml` obligatorio; instalar con `--frozen-lockfile`; `pnpm audit` en CI; pocas dependencias, cada una nueva se anota en `docs/decisiones.md`; scripts de instalación de terceros desactivados salvo lista permitida; actualización automática de dependencias revisada | 1 | `pnpm security` falla con vulnerabilidades altas o críticas |
| A04 | **Fallas criptográficas** | Datos sensibles sin proteger | HTTPS + HSTS en la nube; contraseñas con Argon2id; tokens aleatorios de 256 bits; ningún secreto en el repositorio (`.env` ignorado, escaneo de secretos en CI); datos sensibles fuera de URLs y de logs; cifrado en reposo de la base administrada. En local, FileVault; la copia sin cifrar es la decisión S3 | 1 (secretos) · 5 (el resto) | Escaneo de secretos; prueba de que los logs no contienen contraseñas ni tokens |
| A05 | **Inyección** | SQL, XSS, comandos, fórmulas en CSV | Solo `packages/db` escribe SQL y siempre parametrizado (Drizzle); regla de lint que prohíbe SQL por concatenación; Zod valida toda entrada en el borde; React escapa la salida; prohibido `dangerouslySetInnerHTML` (lint); nombres de archivo saneados y sin rutas relativas en `FileStore`; exportaciones CSV (`apps/web/src/lib/csv.ts`) neutralizan celdas que empiezan con `=`, `+`, `-`, `@`; los archivos subidos se sirven con `X-Content-Type-Options: nosniff` y solo tipos de imagen (`12 §10`) | 1 | Pruebas con cadenas de ataque (`'; DROP`, `<script>`, `=HYPERLINK`) en cada campo de texto; lint |
| A06 | **Diseño inseguro** | Reglas de negocio que se pueden abusar | Invariantes en `core` y en el servidor: sin montos negativos salvo reembolsos; reembolso ≤ lo pagado; cantidades y precios con tope; un pedido no puede entregarse dos veces; `Entitlements` para límites; límites de tamaño y de frecuencia en operaciones costosas; cada funcionalidad nueva anota en 3 renglones qué podría salir mal | 1 en adelante | Casos de abuso por caso de uso (pagar de más, doble clic en entregar, cantidades enormes, estados inválidos) |
| A07 | **Fallas de autenticación** | Quién eres y cómo lo demuestras | Local: sesión fija + secreto por arranque. Nube: Argon2id; límite de intentos y bloqueo temporal; cookies `HttpOnly`, `Secure`, `SameSite=Lax`; rotación de sesión al iniciar; restablecimiento con token de un solo uso y corta vida; respuestas que no revelan si un correo existe; MFA como mejora posterior | 5 | Pruebas de fuerza bruta, sesión caducada, token reutilizado |
| A08 | **Fallas de integridad de software o datos** | Datos o código que cambian sin control | Migraciones con suma de verificación y copia previa; **importar copia = archivo no confiable**: validar formato, versión de esquema y tipos con Zod antes de tocar nada, y aplicarlo en una transacción; sin `eval` ni código remoto; tipografías y recursos incluidos localmente (nada cargado de terceros); protección CSRF en la nube (cookies) | 1 · 4 | Importar archivos corruptos, truncados y malintencionados y comprobar que no se aplica nada |
| A09 | **Fallas de registro y alertas** | No enterarse de lo que pasa | Registro estructurado con `requestId`, `workspaceId`, operación y duración; se registran: acceso denegado, importar/restaurar, borrados, errores; sin datos sensibles (redacción automática); en local, archivos rotativos (7 de hasta 5 MB, `15 §6`); en nube, alertas ante picos de 401, 403 y 5xx | 1 (registro) · 5 (alertas) | Prueba de que un acceso denegado deja registro y de que no se registran contraseñas |
| A10 | **Mal manejo de condiciones excepcionales** | Qué pasa cuando algo falla | Manejador global: mensaje genérico + `errorId`, nunca la traza; **si falla, se cierra** (se niega); todo caso de uso en una transacción que revierte entero; límites de tamaño de petición, de campos y tiempos de espera (`15 §4`); manejo de promesas no capturadas; límite de errores en la interfaz que muestra un mensaje en vez de pantalla en blanco | 1 | Pruebas que inyectan un fallo a mitad de cada caso de uso y comprueban que no quedó nada escrito |

## Seguridad específica de tu Mac

- El servidor local solo escucha en `127.0.0.1`, con puerto aleatorio y un secreto distinto en cada arranque, que Electron agrega como encabezado a cada petición de su ventana. Sin el secreto, otro programa de la Mac no puede usarlo.
- Los datos viven en la carpeta de datos de la app (`userData`), con permisos solo para tu usuario.
- Importar una copia de otra persona siempre pide confirmación y valida el archivo (S4).
- Las versiones nuevas que instalas a mano deben venir de tu propio empaquetado; no se ejecutan scripts descargados.

## Lo que se hace en la fase 5 (nube), además de lo anterior

- Cuentas y sesiones completas (A07), recuperación de contraseña, verificación de correo.
- Aviso de privacidad y términos de uso (aplica la Ley Federal de Protección de Datos Personales en Posesión de los Particulares), y qué datos se guardan, por cuánto tiempo y cómo se borran.
- Respaldos de la base con restauración probada; secretos en el gestor del hosting.
- Pagos solo a través del proveedor; nunca se guardan datos de tarjeta.
- Prueba externa de penetración o revisión de seguridad antes de abrir al público.

## El chequeo `pnpm security`

Un solo comando que corre en cada paso y en CI:

1. Reglas de lint de seguridad (sin SQL concatenado, sin `dangerouslySetInnerHTML`, sin `eval`, sin imports prohibidos).
2. `pnpm audit` (falla con vulnerabilidades altas o críticas).
3. Escaneo de secretos.
4. Prueba de cabeceras de seguridad.
5. Prueba de acceso entre negocios sobre todas las rutas.
6. Pruebas de entradas maliciosas, de importación de archivos y de fallos a mitad de operación.

Un paso **no se cierra** si `pnpm security` falla.
