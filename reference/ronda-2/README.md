# Maquetas de la ronda 2

Cinco archivos HTML que se abren con doble clic (no necesitan internet; sin la tipografía Geist usan una de sistema). Los despliegues y filtros funcionan. Son la referencia de **estructura, jerarquía y comportamiento** de las tres pantallas rediseñadas; el plan está en `docs/mejoras/ronda-2.md`.

| Archivo | Pantalla | Qué enseña | Sección del plan |
|---|---|---|---|
| `productos-fichas.html` | Productos · Fichas | Botón “N variantes” que despliega un panel debajo de la fila de tarjetas | §3.2 |
| `productos-lista.html` | Productos · Lista | Flecha que despliega las variantes bajo su pieza, “+ Agregar variante” | §3.3 |
| `existencias-lista.html` | Existencias · Lista (vista nueva) | Estado, libres, apartadas, total; filtros por estado; familias desplegables | §4.2 |
| `existencias-fichas.html` | Existencias · Fichas simplificadas | Número grande de libres y barra fina, sin cuadritos por unidad | §4.3 |
| `inicio.html` | Inicio | Atención por prioridad con filtros; sin rollos dibujados | §5 |

## Cómo leerlas

- **Los datos son de ejemplo** (nombres, cifras, clientes, fechas). No copiarlos; la semilla real es `reference/mockup-backup-v7.json`.
- **Los textos reales salen de `es.ts`.** Las maquetas solo definen los textos nuevos de `docs/mejoras/ronda-2.md §9`; los demás (por ejemplo los de cada atención de Inicio) se conservan como están.
- **Las cajas con borde punteado que dicen “Nota de diseño” no forman parte de la pantalla.**
- **Color:** solo neutros y de estado (verde, ámbar, rojo). No hay morado. El swatch del filamento “Silk morado” es un color de dato, no de interfaz.
- **Marca:** la barra lateral trae un monograma, “Mi negocio” y “Giro del negocio” de ejemplo; en el producto salen de Ajustes.
- **Radios, sombras y tamaños** de componentes que ya existen (tarjeta, chip, botón, tabla, cajón) son los del sistema, no los de la maqueta.
- **Existencias · Lista:** en la maqueta la fila de una familia no tiene la flecha “›” de abrir y sus miembros sí. Así debe ser en el producto: abre el cajón la fila que tiene movimientos propios.
- **Productos · Fichas:** el panel de variantes lista la original (marcada “Original”) además de las variantes; en la lista no se repite porque la fila de arriba ya es ella.
- **Inicio:** el resumen de arriba, “Piezas con más ganancia” e “Impresoras” ya existen y no cambian de contenido; lo nuevo es la columna de Atención, sus grupos y filtros, y que ya no están los rollos dibujados.
- Anchos que se comparan: 1440, 820 y 390. Las maquetas están dibujadas a 1440; en 820 y 390 se aplican las reglas de cada sección del plan.
