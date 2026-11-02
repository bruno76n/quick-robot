# Amenazas por funcionalidad

Tres renglones por funcionalidad: qué podría salir mal y qué lo impide (`CLAUDE.md`, `11 › A06`).

## Agregar rollo (`addSpool`)
- Otro negocio adjunta un rollo a un filamento ajeno o lee sus movimientos → el filtro por `workspace_id` y las llaves foráneas compuestas lo impiden; prueba `access-matrix` y `tenancy`.
- Una página de otro sitio manda la escritura al servidor local → solo escrituras del mismo origen en JSON.
- Montos o gramos absurdos (negativos, 1 000 kg, decimales de más) → Zod con topes de `15 §4` y gramos con un decimal.
