# Decisiones tomadas durante la construcción

Registro que llena Claude Code en modo autónomo. Una entrada por decisión. No se borra nada.

Formato:

```
## AAAA-MM-DD · Fase N · Paso N.N · Título corto
- Situación: qué no estaba claro o qué falló.
- Opciones consideradas.
- Decisión y por qué (qué regla de CLAUDE.md la respalda).
- Impacto: archivos o documentos afectados.
```

---

## 2026-11-01 · Planeación · Decisiones previas a la construcción
Ver `01-vision-y-decisiones.md` (D1–D21).

## 2026-11-01 · Planeación · Cierre de la planeación de las fases 1 a 4
Se agregan los documentos 12 al 15, `prompts.md`, `reference/mockup-textos.md`, `assets/` y los valores esperados del mockup. Decisiones D22–D29 en `01` (las D30–D35 vienen de la revisión de coherencia, más abajo). Cambios que se hicieron al revisar la coherencia de todo el conjunto:
- **Tablero de pedidos:** `06` solo describía Lista y Calendario; el mockup abre por defecto en **Tablero** (4 columnas). Se agregó a `06 §5` y a los pasos 3.4 de `10`.
- **Canales por id:** `05` guardaba el nombre del canal en ventas y pedidos; ahora `channel_id` (D27). Se agregó el caso de uso `updateChannel`.
- **Pedido siempre con cliente:** `order.customer_id` obligatorio (el mockup lo exige).
- **Foto de la pieza:** faltaba `product.photo_file_id` en `05`.
- **Última copia descargada:** `workspace_settings.last_backup_on` (alimenta la atención de Inicio).
- **Copias automáticas:** nueva dependencia inyectada `BackupStore` (una por día, últimas 7) en `02`, `08`, `10`.
- **Pantallas de falla de Electron:** `apps/desktop/src/fatal.html`, porque si el servidor cae la interfaz no se puede cargar.
- **Secreto local:** pasa de "lo lee la interfaz" a "lo agrega Electron como encabezado" (D29).
- **Valores internos en inglés** (estados, motivos, tipos de movimiento): tabla en `03`.
- **Acciones del mockup sin documentar:** `variante` e `imp-del` agregadas a `06`.
- **Filtros reales del mockup:** Productos (Fichas/Lista; Todas/Técnicas/Variantes) y Producción (sin filtro "Fallos") corregidos en `06`.
- **Informe de fase:** `docs/informe-fase-N.md` (antes `10` mencionaba otro nombre).
- Dependencias nuevas anotadas: `fast-check` (solo pruebas, `14`); ninguna en tiempo de ejecución.

## 2026-11-01 · Planeación · Revisión de coherencia del paquete completo
Claude Code leyó el zip entero y encontró contradicciones; todas se verificaron y se corrigieron (D30–D35 en `01`):
- **Logo con “Quick Robot”** contra la regla 6: la barra lateral y los documentos escriben el nombre y el giro de Ajustes; el logo con texto queda solo para uso externo.
- **Tablas hijas sin `workspace_id`** (`product_filament`, `product_supply`, `collection_part`, `print_run_filament`): ahora lo llevan, con clave foránea compuesta.
- **“Deshacer” sin operación:** se agregan `restoreSupply`, `restoreSupplier` y `restorePrinter`. Devolver una venta y cancelar un pedido dejan de ofrecer “Deshacer” (no había operación ni regla para revertir dinero y existencias).
- **Avisos con parámetros que la API no mandaba:** `FILAMENT_SHORTFALL` usa `{missingGrams}` y `{name}`; `ORDER_WAITING_OTHER_PRINTERS` manda `orderNumber` y `printerNames[]`. Regla de llenado en `13 §4`.
- **Estados sin regla:** el mockup calculaba “Se acaba”, “Nuevo”, “Todo apartado”, “Pocas”, etc. solo en código; ahora están en `04` (casos 1.3 y 5.2), `03` y `13 §8`. “Disponible” no es un estado de filamento.
- **Parámetros de los errores:** `PAYMENT_EXCEEDS_BALANCE`, `REFUND_EXCEEDS_PAID` y `PRINTER_ASSIGNMENT_REQUIRED` usaban parámetros que la API no mandaba; ahora el parámetro se llama igual que el campo de `details` y se formatea por su sufijo (`13 §2`).
- Menores: `FILE_TOO_LARGE` dice “archivo” (también sirve para copias), paquetes `@app/*`, rol `operator`, y la segunda persona queda como regla única en `13 §1`, `06` y `CLAUDE.md`.

## 2026-11-01 · Planeación · Segunda lectura del paquete v2
Claude Code leyó la v2 completa: confirmó que las 9 contradicciones estaban resueltas y encontró 3 menores nuevas, que se corrigieron antes de empezar la fase 1:
- **Unidad repetida:** `SPOOL_INSUFFICIENT` escribía “g” después de `{availableGrams}`, que ya se formatea con su unidad. Regla nueva en `13 §2`: la unidad nunca va en el texto; `i18n.test.ts` lo comprueba.
- **Sintaxis de `t()`:** había plurales sin nombre (`{count} {pieza|piezas}`) y elecciones sin definir (`{entregado|cancelado}`). Ahora hay tres formas explícitas (valor, plural, elección) y todos los textos se reescribieron con ellas.
- **Referencia:** el límite de 100 MB de las copias está en `15 §4`, no en `§3` (corregido en `12` y `07`).
