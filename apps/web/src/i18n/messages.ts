// Every text the person reads, in Spanish (docs/13). Sources: docs/13 (errors, warnings, toasts, fields,
// confirmations) and reference/mockup-textos.md (screens). Syntax for t(): {name}, {count|singular|plural},
// {status|value=text|…} (docs/13 §2). Never write a unit after a …Cents/…Grams/…Hours/…Pct parameter.

export const errors = {
  "VALIDATION_ERROR": "Revisar los campos marcados.",
  "UNAUTHENTICATED": "No se pudo conectar con la aplicación. Cerrarla y volver a abrirla.",
  "FORBIDDEN": "Sin permiso para hacer esto.",
  "PLAN_LIMIT": "El plan actual no permite agregar más.",
  "NOT_FOUND": "No se encontró. Puede que ya se haya eliminado.",
  "PAYLOAD_TOO_LARGE": "Los datos son demasiado grandes.",
  "FILE_TOO_LARGE": "El archivo supera {maxMb} MB.",
  "UNSUPPORTED_IMAGE": "No se pudo leer la imagen. Formatos admitidos: JPG, PNG o WebP.",
  "RATE_LIMITED": "Demasiados intentos. Esperar {retryAfterSec} segundos.",
  "INTERNAL_ERROR": "Algo salió mal y no se guardó nada. Intentar de nuevo; si se repite, avisar con este código: {errorId}.",
  "SERVICE_UNAVAILABLE": "La aplicación se está iniciando. Intentar de nuevo en unos segundos.",
  "STORAGE_FULL": "No hay espacio en el disco. Liberar espacio e intentar de nuevo. No se perdió nada de lo anterior.",
  "RESTORE_CONFLICT": "No se pudo deshacer: ya existe otro registro con ese nombre.",
  "CONFIRMATION_REQUIRED": "Falta confirmar la operación.",
  "PRODUCT_IN_ACTIVE_ORDERS": "Esta pieza está en {count} {count|pedido sin entregar|pedidos sin entregar} ({folios}). Primero deben entregarse o eliminarse.",
  "PRODUCT_HAS_STOCK": "No se puede eliminar: quedan {onHand} {onHand|pieza|piezas} en Existencias. Primero ajustar el conteo a 0.",
  "STOCK_TRACKING_HAS_STOCK": "Hay {onHand} en existencias: ajústalas a 0 en Existencias antes de desactivarlo.",
  "COLLECTION_EMPTY": "La colección necesita al menos una pieza.",
  "NO_PRODUCTS": "Primero crea una pieza en Productos.",
  "LINE_ITEMS_REQUIRED": "Agrega al menos un artículo.",
  "CUSTOMER_REQUIRED": "Falta elegir el cliente del pedido.",
  "INSUFFICIENT_STOCK": "Existencias insuficientes. Reduce la cantidad o convierte la venta en pedido.",
  "PAYMENT_EXCEEDS_BALANCE": "El monto no puede ser mayor al saldo ({balanceCents}).",
  "REFUND_EXCEEDS_PAID": "El reembolso no puede ser mayor a lo pagado ({paidCents}).",
  "SALE_ALREADY_RETURNED": "Esta venta ya se devolvió.",
  "ORDER_INVALID_STATE": "El pedido ya no está en ese paso. Se actualizó la pantalla.",
  "ORDER_NOT_ACTIVE": "Este pedido ya está {status|delivered=entregado|cancelled=cancelado} y no se puede modificar.",
  "PRINTER_ASSIGNMENT_REQUIRED": "Falta asignar impresora a {count} {count|artículo|artículos}.",
  "NO_PRINTERS": "Primero registra una impresora.",
  "NO_SPOOL_FOR_FILAMENT": "Primero agrega un rollo de este filamento.",
  "NO_SPOOLS": "Primero agrega un rollo en Filamentos.",
  "SPOOL_INSUFFICIENT": "Ese rollo solo tiene {availableGrams}.",
  "SUPPLY_NAME_EXISTS": "Ya existe “{name}”.",
  "SUPPLY_IN_USE": "Está en {products} {products|pieza|piezas}. Quítalo de ellas primero.",
  "SUPPLY_INSUFFICIENT": "Solo hay {available} disponibles.",
  "COUNT_UNCHANGED": "El conteo coincide con el total actual.",
  "PRINTER_HAS_QUEUE": "No se puede eliminar: {name} tiene {jobs} {jobs|trabajo|trabajos} en cola. Primero terminarlos o reasignarlos.",
  "PRINT_RUN_LOCKED": "Este registro se creó solo al terminar un pedido. Se conserva como historial.",
  "CUSTOMER_NAME_EXISTS": "Ya existe un cliente llamado “{name}”. Cambiar el nombre o editar el cliente existente.",
  "CUSTOMER_HAS_HISTORY": "Ese cliente tiene pedidos o ventas y no se puede eliminar.",
  "CHANNEL_NAME_EXISTS": "Ya existe un canal llamado “{name}”.",
  "CHANNEL_IN_USE": "“{name}” tiene {sales} {sales|venta|ventas} y {orders} {orders|pedido|pedidos}. No se puede quitar; se puede renombrar.",
  "LAST_CHANNEL": "Debe quedar al menos un canal de venta.",
  "IMPORT_INVALID_FILE": "No se pudo leer la copia. No se cambió ningún dato.",
  "IMPORT_UNSUPPORTED_VERSION": "Esta copia es de una versión que esta aplicación no entiende ({found}). Actualizar la aplicación e intentar de nuevo."
} as const;

/** Texts that depend on where the app runs (docs/13 §3). */
export const errorVariants = {
  "UNAUTHENTICATED": {
    "desktop": "No se pudo conectar con la aplicación. Cerrarla y volver a abrirla.",
    "cloud": "La sesión terminó. Iniciar sesión de nuevo."
  },
  "NETWORK_ERROR": {
    "desktop": "La aplicación no responde. Cerrarla y volver a abrirla.",
    "cloud": "No hay conexión. Revisar el internet e intentar de nuevo."
  }
} as const;

/** Extra lines of some errors: per item, per reason, or a gray detail. */
export const errorParts = {
  "INSUFFICIENT_STOCK": {
    "item": "{name}: se piden {requested}, hay {free} libres."
  },
  "PRINT_RUN_LOCKED": {
    "order_history": "Este registro se creó solo al terminar un pedido. Se conserva como historial.",
    "pieces_unavailable": "Esta impresión sumó {pieces} {pieces|pieza|piezas} a Existencias y ya no hay {pieces|esa pieza libre|tantas libres}: se vendieron o están apartadas. Primero debe corregirse Existencias."
  },
  "IMPORT_INVALID_FILE": {
    "detail": "{reason}"
  }
} as const;

export const warnings = {
  "STOCK_SHORT": "Faltaron {missing} {missing|pieza|piezas} en existencias; esas se imprimen.",
  "FILAMENT_SHORTFALL": "Faltaron {missingGrams} de {name}; se descontó lo que había.",
  "ORDER_WAITING_OTHER_PRINTERS": "Trabajo terminado. El pedido #{orderNumber} aún tiene trabajos en {printerNames}.",
  "PRODUCTS_MISSING": "Algunas piezas ya no existen en el catálogo y no se cargaron.",
  "FILAMENT_NOT_RETURNED": "El filamento descontado no se devuelve (registro anterior); se puede ajustar en Filamentos."
} as const;

export const toast = {
  "product.saved": "Guardado en el catálogo",
  "product.variantSaved": "Variante guardada en el catálogo",
  "product.deleted": "Pieza eliminada.",
  "collection.saved": "Colección guardada",
  "collection.deleted": "Colección eliminada. Las piezas siguen en el catálogo y las ventas anteriores se conservan.",
  "builder.split": "Colección separada en piezas. El precio del set se repartió entre ellas; se pueden quitar o cambiar.",
  "builder.toOrder": "Convertido en pedido: lo disponible en existencias se aparta y el resto se imprime. Falta elegir cliente y fecha de entrega.",
  "sale.created": "Venta registrada. {count} {count|pieza salió|piezas salieron} de Existencias.",
  "sale.updated": "Venta actualizada.",
  "sale.deleted": "Venta eliminada.",
  "sale.paymentRemoved": "Pago quitado de la venta.",
  "sale.returned": "Venta devuelta.",
  "sale.returned.restocked": "{count} {count|pieza regresó|piezas regresaron} a Existencias.",
  "order.created": "Pedido #{folio} creado. Está en Pendientes.",
  "order.created.reserved": "Se apartaron {count} {count|pieza|piezas} de existencias.",
  "order.updated": "Pedido #{folio} actualizado",
  "order.accepted": "Pedido #{folio} aceptado.",
  "order.readyFromStock": "Pedido #{folio} listo para entregar: todo salió de existencias.",
  "order.ready": "Pedido #{folio} listo para entregar. Impresoras libres.",
  "order.delivered": "Pedido #{folio} entregado. La venta se registró sola.",
  "order.cancelled": "Pedido #{folio} cancelado.",
  "order.deleted": "Pedido #{folio} eliminado.",
  "order.paymentRecorded": "Pago registrado",
  "order.paymentRemoved": "Pago de {amount} quitado. Saldo del pedido: {balance}.",
  "order.printersUpdated": "Impresoras actualizadas",
  "spool.added": "Rollo agregado a {filament}. Disponible: {available}.",
  "spool.deleted": "Rollo eliminado",
  "spool.deleted.withMovements": "junto con sus {count} {count|movimiento|movimientos}.",
  "spool.movementRecorded": "Movimiento registrado",
  "supply.saved": "Insumo guardado",
  "supply.deleted": "Insumo eliminado",
  "supply.purchaseRecorded": "Compra registrada",
  "supply.movementRecorded": "Movimiento guardado",
  "supplier.deleted": "Proveedor eliminado. Los insumos que tenía quedaron sin proveedor.",
  "printer.saved": "Impresora guardada",
  "printer.deleted": "Impresora “{name}” eliminada.",
  "maintenance.saved": "Tarea guardada",
  "maintenance.removed": "Tarea quitada",
  "maintenance.done": "Mantenimiento registrado",
  "printRun.recorded": "Impresión registrada. Se descontaron {grams}.",
  "printRun.testRecorded": "Prueba registrada. Se descontaron {grams}.",
  "printRun.deleted": "Registro eliminado.",
  "printRun.deleted.filamentReturned": "Se devolvieron {grams} al inventario de filamento.",
  "printRun.deleted.piecesRemoved": "Se quitaron {count} {count|pieza|piezas} de Existencias.",
  "stock.trackingEnabled": "{name} ahora lleva existencias",
  "stock.summary": "Existencias de {name}: total {physical}.",
  "stock.allTracked": "Todas las piezas ya llevan existencias.",
  "customer.saved": "Cliente guardado",
  "customer.deleted": "Cliente “{name}” eliminado.",
  "customer.logoRemoved": "Imagen quitada",
  "expense.saved": "Gasto guardado",
  "expense.deleted": "Gasto eliminado",
  "channel.renamed": "Canal renombrado.",
  "channel.renamed.records": "Se actualizaron {count} {count|registro|registros}.",
  "channel.removed": "Canal “{name}” quitado.",
  "data.exported": "Copia lista. Quedó guardada en la carpeta elegida.",
  "data.restored": "Copia restaurada.",
  "data.cleared": "Datos vaciados. Agregar rollos e impresoras para comenzar.",
  "csv.ready": "{entity}: archivo listo para abrir en Excel.",
  "copy.done": "{what} copiado.",
  "copy.failed": "No se pudo copiar. Selecciona el texto y cópialo.",
  "print.hint": "En la ventana de impresión, elegir “Guardar como PDF”.",
  "undo.done": "Cambio deshecho."
} as const;

/** Toasts that carry "Deshacer" (they call restore…). */
export const toastWithUndo = ["product.deleted", "collection.deleted", "sale.deleted", "order.deleted", "spool.deleted", "supply.deleted", "supplier.deleted", "printer.deleted", "customer.deleted", "expense.deleted"] as const;

export const fields = {
  "required": "Falta este dato.",
  "too_long": "Es demasiado largo (máximo {max} caracteres).",
  "too_small": "Debe ser al menos {min}.",
  "too_big": "Debe ser como máximo {max}.",
  "not_integer": "Debe ser un número entero.",
  "invalid_format": "El formato no es válido.",
  "invalid_date": "La fecha no es válida.",
  "invalid_email": "El correo no es válido.",
  "product.name.required": "Ponle un nombre a la pieza.",
  "product.price.required": "Escribe el precio de venta.",
  "collection.name.required": "Ponle un nombre a la colección.",
  "sale.on.required": "Falta la fecha de la venta.",
  "salePayment.amount.required": "Falta el monto del abono.",
  "orderPayment.amount.required": "Falta el monto del pago.",
  "spool.filament.required": "Elige el material y el color del rollo.",
  "spool.cost.required": "Falta el costo del rollo.",
  "spoolMovement.grams.required": "Falta la cantidad en gramos.",
  "printRun.text.required": "Falta describir la prueba.",
  "customer.name.required": "Falta el nombre del cliente.",
  "channel.name.required": "Falta el nombre del canal.",
  "expense.concept.required": "Falta el concepto del gasto.",
  "expense.amount.required": "Escribe el monto del gasto.",
  "expense.endsOn.before_start": "La fecha final no puede ser anterior al inicio.",
  "supply.name.required": "Falta el nombre del insumo.",
  "supplyPurchase.qty.required": "Escribe la cantidad comprada.",
  "supplyMovement.value.required": "Escribe la cantidad.",
  "maintenance.task.required": "Falta el nombre de la tarea.",
  "supplier.name.required": "Falta el nombre del proveedor."
} as const;

export const confirm = {
  "tapAgainDelete": "Toca de nuevo para eliminar",
  "removeQuestion": "¿Quitar?",
  "deleteQuestion": "¿Eliminar?",
  "tapAgainClear": "Toca de nuevo para borrar todo"
} as const;

export const fatal = {
  "serverDown": {
    "text": "La aplicación no responde. Cerrarla y volver a abrirla.",
    "buttons": [
      "Reintentar"
    ]
  },
  "migrationFailed": {
    "text": "No se pudo actualizar los datos. Se restauró la copia anterior; los datos están intactos.",
    "buttons": [
      "Abrir de nuevo",
      "Mostrar archivo de registro"
    ]
  },
  "dataFileUnreadable": {
    "text": "No se pudo abrir el archivo de datos.",
    "buttons": [
      "Restaurar la copia más reciente",
      "Elegir otra copia"
    ]
  },
  "screenCrashed": {
    "text": "Esta pantalla no se pudo mostrar.",
    "detail": "Código: {errorId}",
    "buttons": [
      "Volver al Inicio"
    ]
  },
  "offline": {
    "text": "Sin conexión. Lo escrito sigue aquí; se puede guardar cuando vuelva.",
    "buttons": []
  },
  "slow": {
    "text": "Tarda más de lo normal.",
    "buttons": [
      "Reintentar"
    ]
  },
  "importing": {
    "text": "Importando… No cerrar la aplicación.",
    "buttons": []
  }
} as const;
