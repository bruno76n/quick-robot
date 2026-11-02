# 04 · Reglas de negocio

Todo esto vive en `packages/core` como funciones puras. Es la traducción fiel del mockup (`core.js`). Cada regla trae un **caso de prueba con números**: son las primeras pruebas automáticas que se escriben y los resultados deben coincidir al centavo (tolerancia ±0.01 por el redondeo a centavos).

Convenciones:
- `x%` en configuración se guarda como número (5 = 5 %).
- Los pesos se calculan en decimales y se redondean **al guardar**, nunca a la mitad de una fórmula.
- "Hoy" y los ids se **pasan** a las funciones; `core` no los inventa.

---

## 1. Filamento

**Costo por gramo de un rollo** = `(costo + envío) / gramos`.

**Costo por gramo de un filamento** (material + color) = promedio **ponderado por lo que queda** de sus rollos con material. Si ya no queda nada (≤ 0.5 g en total), se usa el costo por gramo de la última compra.

> Caso 1.1 — Rollo A: 600 g restantes a $0.50/g. Rollo B: 400 g restantes a $0.60/g.
> Costo por gramo del filamento = (600·0.50 + 400·0.60) / 1000 = **$0.54**.

**Orden en que se gastan los rollos**: primero el que ya está abierto (le falta algo), luego el más viejo por fecha; desempate por id.

**Lo que hay de un filamento** = suma de lo que queda en todos sus rollos, sean de la marca que sean. Un rollo nunca queda en negativo.

**Descontar un trabajo**: para `g` gramos de consumo con purga `p %`, se necesita `g·(1+p/100)`. Se toma lo que alcance; el consumo y la purga se registran por separado (tipo `consumo` y tipo `merma`), cada uno redondeado a 0.1 g.

> Caso 1.2 — Purga 5 %, quedan 50 g, el trabajo pide 100 g.
> Se toman 50 g en total: consumo = 50/1.05 = 47.6 g, purga = 2.4 g. El inventario queda en 0. El sistema avisa "faltaron 55 g" y deja continuar.

**Faltante**: antes de producir, para cada filamento `need = g·(1+purga/100)`; si `need > hay`, falta `need − hay`.

---

## 2. Costo de una pieza

Con la impresora asignada (o el promedio de las impresoras si es "cualquiera"):

```
M = Σ ( gramos_i × costo_por_gramo(filamento_i) × (1 + purga/100) )     material
L = horas × kW_impresora × precio_kWh                                    luz
Q = horas × ( costo_impresora / vida_en_horas + mantenimiento_por_hora ) máquina
E = extras + Σ ( cantidad_insumo × costo_insumo )                        extras e insumos
sub = M + L + Q + E
COSTO = sub / (1 − fallos/100)                                           reserva de fallos
```

El tiempo de trabajo de la persona **no entra**: el precio es libre.

> Caso 2.1 — Configuración: kWh $3, purga 5 %, fallos 5 %.
> Pieza: 50 g de un filamento a $0.50/g · 2 h · impresora ($6 000, vida 3 000 h, mant. $0.50/h, 0.15 kW) · extras $2.
> M = 50·0.5·1.05 = **26.25** · L = 2·0.15·3 = **0.90** · Q = 2·(6000/3000 + 0.5) = **5.00** · E = **2.00**
> sub = **34.15** · COSTO = 34.15 / 0.95 = **35.9474**

**Promedio de impresoras** (cuando la pieza no fija una): `costo/vida + mant` y `kW` son el promedio simple de todas; vida = 1, mant = 0. Si no hay impresoras: todo en 0.

---

## 3. Precios

```
sugerido(total, margen, comisión) = total / (1 − margen/100 − comisión/100)
piso(total)                       = total / (1 − margenMínimo/100)
precio de lista (modo "fórmula")  = ceil( sugerido(total, min(95, margen)) )
precio de lista (modo "valor")    = el precio que la persona escribió
```

El margen de una pieza es el suyo o, si no tiene, el margen de fórmula global.

> Caso 3.1 — Con el costo del 2.1 (35.9474) y margen 50 %:
> sugerido = 35.9474 / 0.5 = 71.89 → precio de lista (fórmula) = **$72**.
> Piso con margen mínimo 30 % = 35.9474 / 0.7 = **$51.35**.
> Sugerido para vender por un canal con 17 % de comisión = 35.9474 / (1 − 0.5 − 0.17) = **$108.93**.

**Colecciones (sets)**
- *Sueltas* = Σ precio de lista de cada pieza × su cantidad.
- Precio del set = el que se escribió; si está vacío o 0, es el de *sueltas*.
- Costo del set = Σ (costo de cada pieza × cantidad) + extras del set.

> Caso 3.2 — Set con 2 × pieza A ($72) + 1 × pieza B ($50): sueltas = **$194**. Con precio escrito $170, el precio es $170; sin precio, $194.

**Reparto de un set entre sus piezas** (para rankings y desglose): cada pieza recibe `precio_del_set × (lista_pieza × cantidad) / Σ(lista × cantidad)`; el costo de los extras se reparte igual.

> Caso 3.3 — Mismo set vendido en $170: pieza A recibe 170·144/194 = **$126.19**; pieza B, 170·50/194 = **$43.81**.

---

## 4. Artículos de venta y de pedido

Un artículo es una **pieza** (`k:'p'`) o un **set** (`k:'c'`). Al crearse guarda una **foto del momento**: `precio` cobrado, `lista` (precio de lista), `costo`, y para sets las `partes` que traía. Cambiar precios después **no** modifica lo ya vendido.

- Piezas del artículo = cantidad (o Σ partes × cantidad si es set).
- En un pedido, un artículo puede surtirse en parte de Existencias: `uso = { pieza: cuántas salen de la repisa }`. **Solo lo demás se imprime**, y solo eso cuenta para material, tiempo e impresoras.

> Caso 4.1 — Artículo: 10 llaveros, `uso = {llavero: 4}` → se imprimen 6, salen 4 de Existencias, material y horas de **6**.

---

## 5. Existencias (piezas terminadas)

Solo las piezas con "llevar existencias" activado tienen libro de movimientos. **Nunca se escribe "tengo 7"; se suma.** Tipos de movimiento: `inicial`, `impresion` (para existencias), `pedido` (impresa para un pedido), `venta`, `devolucion`, `entrega` (de pedido), `ajuste`.

```
físicas   = max(0, Σ movimientos)
apartadas = Σ sobre pedidos:
              aceptado | en producción → lo que ese pedido eligió sacar de existencias (uso)
              listo                    → lo que quedó apartado (stk)
              (cotizado, entregado y cancelado no cuentan)
libres    = max(0, físicas − apartadas)
```

> Caso 5.1 — Físicas 10. Pedido A (aceptado) con `uso = 3`. Pedido B (listo) con `stk = 2`. Pedido C (cancelado) con `uso = 4`.
> Apartadas = 3 + 2 = **5** · Libres = **5**.

**Sets armables hoy** = mínimo, entre las piezas del set, de `floor(libres / cantidad requerida)`; si alguna pieza no lleva existencias, 0.

**Al aceptar un pedido** se apartan las piezas planeadas; si ya no alcanzan, se aparta lo que haya y **el resto se imprime**. El sistema regresa cuántas faltaron para avisar.

---

## 6. Ventas

```
bruto    = Σ precio × cantidad de cada artículo
ingreso  = 0 si la venta se devolvió, si no bruto
comisión = ingreso × comisión_del_canal/100
costo    = 0 si se devolvió Y la pieza regresó a existencias; si no, costo bruto
ganancia = ingreso − comisión − costo
```

> Caso 6.1 — Venta de 1 pieza a $72, costo 35.9474, canal Mercado Libre 17 %:
> comisión = **12.24** · ganancia = 72 − 12.24 − 35.9474 = **23.81**.

**Devolución**
- Con "regresa a existencias": ingreso 0, comisión 0, costo 0 → ganancia **0**; las piezas vuelven al libro (`devolucion`).
- Sin regresar (se perdió o se tiró): ingreso 0, comisión 0, costo se mantiene → ganancia **−costo**.
- Se puede registrar un reembolso con nota. Una venta devuelta no cuenta en rankings ni en "vendidas".

**Cobro de una venta**
- Sin lista de pagos: se considera **pagada completa**.
- Con pagos (abonos): `pagado = Σ pagos`; `debe = max(0, bruto − pagado)` (0 si se devolvió).

> Caso 6.2 — Venta de $300 con un abono de $100 → debe **$200**. Venta de $300 sin lista de pagos → debe **$0**.

---

## 7. Pedidos

**Estados**: `cotizado → aceptado → produccion → listo → entregado`, y `cancelado` desde cualquiera que siga activo.

```
total  = Σ artículos
pagado = Σ pagos (los reembolsos son pagos negativos)
debe   = 0 si cancelado; si no max(0, total − pagado)
activo = no entregado y no cancelado
```

| Paso | Qué ocurre |
|---|---|
| Cotizado → Aceptado ("Cliente aceptó") | Se aparta lo planeado de Existencias; si no alcanza, el resto se imprime y se avisa |
| Aceptado → En producción ("Poner en producción") | Se asigna cada artículo a una impresora (se propone la distribución más rápida); se crea una entrada en la cola por impresora con su duración (`horas × 60`, mínimo 1 min). Opcional: **descontar el filamento** ahora (marca `descontado`) |
| En producción → Listo ("Marcar listo") | Se sale de las colas (y empieza el siguiente trabajo); si ya se descontó y aún no se registró, se crean los **registros de producción** (`motivo: pedido`) y se suman horas a la impresora; las piezas necesarias quedan **apartadas** (`stk`) y las impresas para el pedido entran a Existencias (`pedido`) |
| Listo → Entregado ("Entregar y cobrar") | Se registra el cobro final como pago "Al entregar"; **se crea la venta** copiando los artículos (sin impresora ni uso); salen de Existencias las piezas apartadas (`entrega`) |
| Cualquiera activo → Cancelado | Se quita de las colas; las piezas apartadas pasan a libres; se anota motivo y reembolso (pago negativo, nunca mayor a lo pagado); **el filamento ya descontado no se devuelve** (se ajusta a mano); no cuenta como venta |

**Terminar un trabajo de la cola** (botón en Impresoras): saca la entrada de esa impresora y arranca la siguiente. Si el pedido ya **no tiene nada pendiente en ninguna impresora**, se ejecuta *Marcar listo* automáticamente; si aún le falta otra impresora, solo se avisa.

Atajo: si **todo** el pedido sale de Existencias (nada por imprimir), "Aceptado" pasa directo a "Listo".

> Caso 7.1 — Pedido de $500 con anticipo de $200 → debe **$300**. Al cancelar con reembolso de $200 → pagado **$0**, debe **$0**, estado cancelado.
> Caso 7.2 — Pedido de 10 piezas, 4 de Existencias. Al marcar listo: `stk = 10` (apartadas), movimiento `pedido` de **+6** (las impresas). Al entregar: movimiento `entrega` de **−10**. Neto en Existencias: −4.

**Tiempo de cola**: lo que falta del primero (según su `inicio`) + la duración de los anteriores; el que sigue empieza solo cuando sale el actual.

---

## 8. Producción (registros)

Un registro dice: pieza, cantidad, impresora, resultado (`bien` / `fallo`), horas, filamento gastado por rollo, y **motivo**: `inventario` (para existencias), `pedido`, `prueba`.

- Un registro `bien` con motivo `inventario` suma piezas a Existencias (`impresion`).
- Un registro `bien` que no sea `prueba` gasta los insumos de la pieza (`uso`, negativo).
- **Se puede deshacer** un registro (devuelve filamento e insumos, quita las piezas que sumó, resta las horas) **salvo** que esas piezas ya se vendieron o apartaron, o que sea de motivo `pedido` (se conserva como historial).

---

## 9. Insumos y compras

- `stock = Σ movimientos` (`compra`, `uso`, `ajuste`, `merma`).
- Estado: `Agotado` si ≤ 0; `Poco` si ≤ mínimo; si no `Suficiente`.
- **Compras** es una lista calculada (no una tabla), agrupada por proveedor y copiable como texto para mandar por mensaje:
  - **Filamento** entra si (a) un pedido **aceptado** que aún no descontó filamento necesita más de lo que hay (se pide lo que falta), o (b) tiene rollos y quedan **300 g o menos**. Cantidad = `ceil(faltante / gramos del último rollo)`, mínimo 1 rollo. Costo estimado = costo + envío del último rollo × cantidad. Proveedor = el que tenga la marca del último rollo.
  - **Insumo** entra si `stock ≤ mínimo`. Cantidad = `ceil(2 × mínimo − stock)`, mínimo 1. Costo estimado = cantidad × costo. Proveedor = el asignado al insumo.

> Caso 9.1 — Insumo con mínimo 30 y stock 12 → entra a Compras, cantidad = ceil(60 − 12) = **48**. Con costo $0.50 → estimado **$24**. Si el stock fuera 31, no entra.

---

## 10. Gastos

- Un gasto único cuenta en el rango si su fecha cae dentro.
- Un gasto **recurrente** (mensual) se prorratea: `monto × días_en_el_rango / 30.4375`, respetando fecha de inicio y de fin.
- *Fijos al mes* = Σ montos recurrentes vigentes.

> Caso 10.1 — $1 000 al mes recurrente, rango de 30 días completos → **$985.63** (1 000 × 30 / 30.4375).

---

## 11. Impresoras

**Mantenimiento** por tarea: cada `cadaH` horas desde `ultH`.
`falta = ultH + cadaH − horas_actuales`; `uso = clamp((horas − ultH)/cadaH, 0, 1.2)`.
Estado: `falta ≤ 0` → "Toca ya"; `uso ≥ 0.8` → "Pronto"; si no "Al corriente". Tareas base: boquilla cada 300 h, ejes cada 200 h, cama cada 100 h.

> Caso 11.1 — Boquilla (cada 300 h, última vez a las 0 h): a 240 h → uso 0.8, falta 60 → **Pronto**. A 300 h → falta 0 → **Toca ya**.

**Inversión recuperada**: `neta = max(0, ganancia bruta − gastos)` desde siempre, repartida entre las impresoras **según sus horas**; `% recuperado = min(100, aporte / costo × 100)`.

> Caso 11.2 — Ganancia bruta $5 000, gastos $1 000 → neta **$4 000**. Impresora 1 (100 h) y 2 (300 h), cada una de $6 000: aportes **$1 000** y **$3 000** → **16.7 %** y **50 %**.

---

## 12. Clientes

Por cliente: pedidos, pedidos activos, ventas, ingreso y ganancia (sin ventas devueltas), **por cobrar** = Σ deuda de pedidos activos + Σ deuda de ventas, y fecha de la última actividad.

---

## 13. Reportes

Mismos totales y rankings que las ventas: por periodo, por canal, por pieza (los sets se abren en sus piezas con el reparto de §3), margen = ganancia / ingreso. Las ventas devueltas no cuentan en rankings.

---

## 14. Lo que no existe a propósito

Facturación (CFDI) e IVA; etiquetas con QR; adjuntar archivos 3MF/STL; recordatorios de cobro automáticos. Son opcionales y quedan fuera de la primera versión.
