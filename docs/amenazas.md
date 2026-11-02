# Amenazas por funcionalidad

Tres renglones por funcionalidad: qué podría salir mal y qué lo impide (`CLAUDE.md`, `11 › A06`).

## Agregar rollo (`addSpool`)
- Otro negocio adjunta un rollo a un filamento ajeno o lee sus movimientos → el filtro por `workspace_id` y las llaves foráneas compuestas lo impiden; prueba `access-matrix` y `tenancy`.
- Una página de otro sitio manda la escritura al servidor local → solo escrituras del mismo origen en JSON.
- Montos o gramos absurdos (negativos, 1 000 kg, decimales de más) → Zod con topes de `15 §4` y gramos con un decimal.

## Ajustes y canales
- Un canal con ventas o pedidos se borra y deja registros sin canal → `CHANNEL_IN_USE`; se renombra en una sola fila (`channel_id`).
- Porcentajes absurdos (comisión de 150 %) hacen precios negativos → Zod limita 0–99.
- Un negocio cambia los ajustes de otro → la fila se busca siempre por `ctx.workspaceId`; prueba `tenancy` y matriz de acceso.

## Insumos y proveedores
- Usar más de lo que hay deja existencia negativa → `SUPPLY_INSUFFICIENT` con bloqueo de fila (`FOR UPDATE`).
- Dos insumos con el mismo nombre escrito distinto ("Imán"/"iman") → clave normalizada y `SUPPLY_NAME_EXISTS`; restaurar choca con `RESTORE_CONFLICT`.
- Borrar un insumo que usan piezas cambia sus costos sin aviso → `SUPPLY_IN_USE`.

## Rollos (editar, eliminar, movimientos)
- Editar un rollo reescribe el historial → nunca se modifica un movimiento: la diferencia entra como `adjustment`.
- Sacar más gramos de los que tiene un rollo → `SPOOL_INSUFFICIENT` con bloqueo de fila.
- Borrar un rollo pierde sus movimientos → borrado suave; los movimientos se conservan y vuelven al restaurar.

## Impresoras y mantenimiento
- Borrar una impresora con trabajos en cola deja pedidos sin máquina → `PRINTER_HAS_QUEUE`.
- "Hecho" con costo duplicado por doble clic → el botón se deshabilita mientras escribe; cada clic es un gasto visible que se puede borrar.
- Una pieza apunta a una impresora borrada y su costo queda en 0 → se costea con el promedio de las demás.

## Piezas, colecciones y fotos
- El cliente manda un costo o un precio inventado → el servidor recalcula con `core` y descarta lo recibido (prueba "ignores client costs").
- Un HTML disfrazado de PNG se sirve como página → se revisa la firma binaria, solo JPG/PNG/WebP, y se sirve con `nosniff` y `CSP: sandbox`.
- Una pieza apunta a filamentos, insumos o fotos de otro negocio → cada referencia se busca con `ctx` (404) y las llaves foráneas son compuestas.
