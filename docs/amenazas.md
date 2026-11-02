# Amenazas por funcionalidad

`11 · A06`: cada funcionalidad anota en 3 renglones qué podría salir mal y cómo se evita. Se agrega una entrada por cada funcionalidad nueva.

| Funcionalidad | Qué podría salir mal | Cómo se evita | Prueba |
|---|---|---|---|
| Agregar / editar / eliminar rollo | Gramos o costos absurdos; colgar un rollo de un filamento de otro negocio; reescribir el historial | Topes en el contrato (montos ≤ $10 M, ≤ 1 000 kg); llaves compuestas `(workspace_id, id)`; editar gramos agrega un `adjustment` en lugar de reescribir | `inputs-abuse`, `tenancy*`, `spools` |
| Movimiento de filamento | Sacar más de lo que hay; dos movimientos simultáneos dejan el rollo en negativo | Se bloquea la fila del rollo (`FOR UPDATE`) antes de calcular; nunca bajo cero | `spools`, `concurrency-postgres` |
| Insumos (compra, uso, conteo) | Doble envío saca el doble; costo unitario manipulado; borrar un insumo que usa una pieza | Bloqueo de fila; el costo lo calcula el servidor (total ÷ cantidad); `SUPPLY_IN_USE` | `inputs-abuse`, `concurrency-postgres`, `supplies` |
| Ajustes y canales | Márgenes ≥ 100 % que dividen entre cero; quedarse sin canales; nombres duplicados | Márgenes ≤ 95 %, porcentajes < 100; `LAST_CHANNEL`; nombre único normalizado | `settings`, `inputs-abuse` |
| Impresoras y mantenimiento | "Hecho" repetido crea gastos duplicados; horas negativas | Topes en horas y costos; cada "Hecho" es una operación explícita con su gasto en la misma transacción | `printers`, `failure-injection` |
| Piezas y colecciones (calculadora) | El cliente manda un costo falso; referencias a filamentos, insumos o fotos de otro negocio; 1 000 líneas | El servidor recalcula con `core` e ignora campos extra; se valida que cada referencia sea del negocio; máximo 20 líneas / 50 partes | `products`, `inputs-abuse`, `routes-tenancy` |
| Fotos de piezas | Subir HTML o SVG con script disfrazado de imagen; archivos enormes; ver la foto de otro negocio | Solo PNG/JPEG/WebP/GIF verificados por su firma binaria; 2 MB; se sirven con `nosniff` y `CSP: sandbox`; la foto se busca por negocio | `http-hardening`, `routes-tenancy` |
| Servidor local (Mac) | Una página web abierta en el navegador manda peticiones a `127.0.0.1` (CSRF); otro programa de la Mac usa la API | Solo escrituras del mismo origen con JSON; escucha solo en `127.0.0.1`; secreto por arranque comparado en tiempo constante (fase 4 lo activa) | `http-hardening`, `logging-config` |
| Toda la API | Un id ajeno revela datos; una ruta nueva sin permiso; errores con detalle técnico | `guard(acción)` en cada ruta (negar por omisión); 404 para ids ajenos o inválidos; mensaje genérico con `errorId` | `routes-tenancy`, `http-hardening`, `logging-config` |
