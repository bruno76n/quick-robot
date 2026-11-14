# 15 · Rendimiento, límites y qué se ve cuando algo falla

Tres cosas que hacen que un sistema se sienta confiable: que **no se ponga lento** con el uso, que **no admita datos absurdos**, y que cuando algo falla la persona **sepa qué pasó, qué quedó guardado y qué hacer**. Los textos exactos de cada aviso están en `13`; los códigos, en `12 §2`; la parte de seguridad de los fallos, en `11 › A10`.

---

## 1. Tamaño para el que se diseña

"Grande" para un taller significa **cinco años de uso**. Todo debe sentirse igual de ágil con estas cifras:

| Dato | Cantidad de diseño |
|---|---|
| Ventas | 25 000 (≈ 5 000 al año) |
| Artículos de venta y pedido | 80 000 |
| Pedidos | 5 000 |
| Piezas en el catálogo | 500 (máximo razonable: 1 000) |
| Clientes | 2 000 |
| Impresoras | 20 |
| Rollos / filamentos | 400 / 150 |
| Movimientos de rollo, existencias e insumos | 150 000 en total |
| Registros de producción | 20 000 |

Los datos de esta tabla se generan con `packages/db/seed/load-test.ts` (determinista, partiendo de la semilla del mockup) y son la base de las pruebas de §6.

## 2. Presupuestos de tiempo

Medidos en una Mac de uso diario con PGlite (percentil 95). En la nube se aplican los mismos números más la latencia de red.

| Acción | Presupuesto |
|---|---|
| Abrir la app de escritorio hasta ver Inicio | ≤ 3 s en frío · ≤ 1.5 s en las siguientes aperturas |
| Cambiar de pantalla con los datos ya en memoria | Inmediato (< 100 ms) |
| Cambiar de pantalla sin datos en memoria | ≤ 400 ms |
| Cualquier lista (página de 50) | ≤ 300 ms |
| Operación que escribe (cualquier caso de uso) | ≤ 500 ms |
| Las más pesadas: `startProduction`, `markOrderReady`, `deliverOrder`, `returnSale` | ≤ 800 ms |
| Reportes de 30 días | ≤ 400 ms |
| Reportes de "Todo" (25 000 ventas) | ≤ 1.5 s |
| Búsqueda (⌘K), contada desde la última tecla | ≤ 200 ms |
| Calculadora y armador: cada tecla actualiza el desglose | < 16 ms (sin red) |
| Importar una copia de tamaño mockup | ≤ 5 s |
| Importar una copia de 25 000 ventas | ≤ 30 s, con aviso "Importando…" que bloquea la pantalla |
| JavaScript inicial de la interfaz | ≤ 350 KB comprimido; Reportes, Calendario y Documentos se cargan bajo demanda |

Si una medición pasa de **dos veces** el presupuesto en CI, la prueba falla; si pasa de una vez pero no de dos, se anota en el informe de la fase.

## 3. Cómo se logra

1. **Todas las listas se paginan** en el servidor (`12 §1`: 50 por página, máximo 200). Nunca se trae "todo" salvo catálogos chicos que alimentan selectores (piezas, filamentos, impresoras, canales, insumos). El selector de **clientes** busca al escribir.
2. **Tablero de pedidos:** trae solo los pedidos activos y los 3 entregados más recientes; el resto llega por la Lista paginada.
3. **Índices** de `05 › Índices que importan`. Las 6 consultas más pesadas (reportes, existencias, lista de ventas, lista de pedidos, ficha de cliente, brief de Inicio) se revisan con `EXPLAIN` en la fase 3 y se anota el resultado en el informe.
4. **Existencias y saldos se calculan con una vista agrupada** (`stock_levels`, `spool_levels`, `supply_levels`), no sumando en la aplicación fila por fila.
5. **Reportes:** el servidor lee del periodo solo las columnas necesarias (cantidad, precio, costo, canal, partes del set) en una consulta y `core` acumula. Si el periodo "Todo" no cumple el presupuesto, el plan es una tabla `sale_summary` que se actualiza dentro de la misma transacción de cada venta (sin cambiar ninguna regla); se anota en `decisiones.md`.
6. **Caché del cliente** (TanStack Query): las listas se consideran vigentes 30 s; cada operación invalida solo lo que toca (`12`, "Invalidan"). Las peticiones de una búsqueda anterior se cancelan al escribir otra letra (con pausa de 150 ms).
7. **Listas largas en pantalla** (historial de un cliente, movimientos de un rollo): paginadas con "Ver más"; si una vista llega a mostrar más de 200 filas a la vez, se virtualiza.
8. **Imágenes:** el navegador las reduce **antes de subirlas** (lado mayor ≤ 1 600 px, JPEG o WebP) y el servidor solo valida tipo y tamaño. No se usa procesamiento de imágenes en el servidor, para no depender de módulos nativos dentro de Electron. Se sirven con caché larga por id (`Cache-Control: private, max-age=31536000, immutable`).
9. **Una conexión a la vez en local:** PGlite atiende una transacción por vez; el servidor local las pone en fila. Las operaciones largas (importar) muestran un aviso que bloquea la pantalla. En la nube se usa un conjunto de conexiones.
10. **Sin trabajo pesado al dibujar la pantalla:** los cálculos de `core` en la calculadora y el armador se memorizan por entradas; las tablas anchas no recalculan al escribir en un campo ajeno.

## 4. Límites de entrada

Se validan en el borde con Zod (`contract`) **y** en la base cuando aplica. Un valor fuera de rango es `VALIDATION_ERROR` con regla `too_small` / `too_big` / `too_long` (mensajes en `13 §6`). Son límites generosos para un taller real y cierran la puerta a abusos (`11 › A06`).

| Campo | Límite |
|---|---|
| Nombres y conceptos | 120 caracteres |
| Notas y motivos | 2 000 caracteres |
| Teléfono, unidad, marca | 40 caracteres |
| Etiquetas por pieza | 12 (de 40 caracteres) |
| Artículos por venta o pedido | 100 |
| Cantidad por artículo | 100 000 |
| Partes por colección · insumos por pieza · filamentos por pieza o registro | 50 · 30 · 12 |
| Precio unitario | $1 000 000 |
| Monto de pago, abono o gasto | $10 000 000 |
| Gramos de un rollo · de un movimiento | 100 000 g · 100 000 g |
| Horas de una pieza · de un registro | 1 000 h |
| Porcentajes (comisión, margen mínimo, fallos, purga) | 0 – 99 |
| Pagos por pedido o venta | 200 |
| Tareas de mantenimiento por impresora | 30 |
| Trabajos en la cola de una impresora | 200 |
| Cuerpo de una petición JSON | 1 MB |
| Imagen (logos 8 MB, fotos 12 MB, **antes** de reducirla) | 8 / 12 MB |
| Archivo de copia al importar | 100 MB (local) · 50 MB (nube) |
| Tiempo de espera de una petición | 15 s · importar: 120 s |

**Frecuencia (solo nube, fase 5):** 120 peticiones por minuto por sesión, 30 escrituras por minuto, 5 intentos de inicio de sesión cada 15 minutos por correo y por dirección. En local no hay límite de frecuencia, solo los tamaños.

## 5. Qué ve la persona cuando algo falla

Principio: **nunca una pantalla en blanco, nunca un error técnico, y siempre decir si algo quedó guardado.** Una operación o se hizo completa o no se hizo (`11 › A10`).

| Situación | Qué se muestra | Qué puede hacer | Qué quedó guardado |
|---|---|---|---|
| Un campo está mal (`VALIDATION_ERROR`) | Mensaje bajo el campo y foco en el primero inválido; el formulario no se cierra | Corregir y repetir | Nada |
| Regla de negocio (`409` / `422` con código de `12`) | Aviso emergente con el texto de `13 §3`; el diálogo sigue abierto si venía de un formulario | Lo que el texto indica (ajustar cantidad, asignar impresora…) | Nada |
| El estado cambió mientras se miraba (`ORDER_INVALID_STATE`) | Aviso "El pedido ya no está en ese paso. Se actualizó la pantalla." y la pantalla se recarga | Continuar con el paso que corresponda | Lo que ya estaba |
| Éxito con aviso (`warnings`) | Aviso emergente de éxito + el aviso en el mismo texto (`13 §4`) | Revisar el faltante | Todo lo pedido |
| Falla inesperada (`500`) | Aviso rojo: "Algo salió mal y no se guardó nada… código: {errorId}" con **Intentar de nuevo** | Repetir; si persiste, dar el código | Nada (transacción revertida) |
| Botón en curso | Botón deshabilitado con "Guardando…" (evita doble clic) | Esperar | — |
| Carga lenta | Esqueleto a los 300 ms; a los 8 s "Tarda más de lo normal" con **Reintentar** | Reintentar | — |
| Los datos de una pantalla no llegan (el servidor falla o no responde al cargarla) | Tarjeta "No se pudieron cargar los datos de esta pantalla. No se cambió ningún dato." con **Reintentar** (y el código si lo hay) en lugar de la pantalla; **nunca una lista vacía** ni "Sin … registrados" | Reintentar | Todo |
| Una pantalla se rompe al dibujarse | Tarjeta "Esta pantalla no se pudo mostrar" con **Volver al Inicio** y el código; el menú y el resto siguen funcionando | Volver, o seguir en otra pantalla | Todo |
| **Escritorio:** el servidor local no responde | Banner fijo: "La aplicación no responde. Cerrarla y volver a abrirla." con **Reintentar**. Electron intenta reiniciar el servidor una vez solo | Reintentar o reabrir | Todo hasta la última operación completa |
| **Escritorio:** falla al aplicar una migración al abrir | Pantalla: "No se pudo actualizar los datos. Se restauró la copia anterior; los datos están intactos." con **Abrir de nuevo** y **Mostrar archivo de registro** | Seguir con la versión anterior de la app | Todo (copia previa) |
| **Escritorio:** el archivo de datos no se puede abrir | Pantalla: "No se pudo abrir el archivo de datos." con **Restaurar la copia más reciente** (lista de las 7 copias automáticas) y **Elegir otra copia** | Restaurar | Las copias automáticas |
| Disco lleno (`STORAGE_FULL`) | Aviso: "No hay espacio en el disco. Liberar espacio e intentar de nuevo." | Liberar espacio y repetir | Todo lo anterior |
| Importar un archivo inválido o de otra versión | Aviso con el texto de `IMPORT_INVALID_FILE` / `IMPORT_UNSUPPORTED_VERSION` y "No se cambió ningún dato" | Elegir otro archivo | Todo (no se tocó nada) |
| **Nube:** sin conexión | Banner "Sin conexión"; lo escrito en formularios se conserva en pantalla; al volver la conexión se puede repetir. No hay escritura diferida | Esperar la conexión | Lo anterior |
| **Nube:** la sesión venció | Se guarda el borrador del formulario en la pestaña y se pide iniciar sesión; al volver se restaura | Iniciar sesión | Lo anterior |
| La app se cierra a media operación (corte de luz, cierre forzado) | Al reabrir, todo está como antes de la operación o completo, nunca a medias | Repetir la operación | Hasta la última operación completa |
| Deshacer ya no es posible (`RESTORE_CONFLICT`) | Aviso con el texto de `13` | Crear el registro de nuevo | — |
| Copia automática atrasada | Atención en Inicio: "Sin copia de seguridad descargada" / "Última copia hace N días" (`06 §2`) | Descargar copia | — |

Los textos de las filas de escritorio y de nube que no son un código de `12` viven en `13 §3` bajo `NETWORK_ERROR` y en `es.ts › screens.fatal`.

## 6. Registro y diagnóstico

- **Qué se registra** (`08 › Observabilidad`, `11 › A09`): cada petición (`requestId`, negocio, operación, duración, código de respuesta), accesos denegados, importaciones, borrados y todo error. **Nunca** contraseñas, tokens, ni contenido de notas.
- **Dónde:** en local, archivos rotativos en la carpeta de datos (`logs/`, 7 archivos de hasta 5 MB); en la nube, la plataforma de registros.
- **Cómo se usa el `errorId`:** la persona lo ve en pantalla; quien depura lo busca en el registro y encuentra la traza completa, que nunca se mostró.
- **Ajustes › Copia de seguridad** tiene "Mostrar archivo de registro" (solo escritorio) para mandarlo al soporte.

## 7. Cómo se prueba

| Qué | Prueba | Fase |
|---|---|---|
| Presupuestos de tiempo de §2 | `packages/server/test/perf/budget.test.ts`: corre las consultas y casos de uso pesados sobre el conjunto de §1; falla si pasa de 2 × el presupuesto | 3 |
| Consultas con índice | Prueba que ejecuta `EXPLAIN` de las 6 consultas pesadas y falla si aparece un recorrido completo de tabla grande | 3 |
| Tamaño del paquete | `pnpm size` (script que suma el JS inicial comprimido); falla sobre 350 KB | 1 en adelante |
| Límites de §4 | Una prueba por límite: el valor justo pasa, uno más falla con la regla correcta | 2 en adelante |
| Cada fila de §5 | `e2e/failure-states.spec.ts` simula: servidor caído, respuesta 500, respuesta lenta, sesión vencida (nube), error de dibujo | 3 y 4 |
| Cortes a media operación | `failure-midway.test.ts` (`11 › A10`): cada caso de uso con un fallo inyectado a la mitad | 1 en adelante |
| Apertura de la app | Medición en la fase 4 con el `.dmg` real, en frío y en caliente | 4 |
| Migración fallida y archivo ilegible | Pruebas con una base dañada a propósito y una migración que falla | 4 |
