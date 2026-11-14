# Maquetas de la ronda 4 · Rollos

Cuatro pantallas que cambian con la ronda 4, más `index.html`. Usan el diseño de la ronda 3: leen `../ronda-3/ui.css`, `app.css` y `app.js`, y suman `rollos.css`. La barra lateral lleva a las pantallas de la ronda 3, salvo Filamentos. El plan está en `docs/mejoras/ronda-4.md`.

| Archivo | Qué es |
|---|---|
| `filamentos.html` | Reemplaza a `ronda-3/filamentos.html`: cada filamento con sus rollos numerados abajo, el costo por gramo con las compras que lo forman y, a la derecha, un rollo con Pesar y Terminar rollo |
| `rollo-nuevo.html` | Diálogo Agregar rollo: siempre crea rollos nuevos, cantidad, sin costo, y el costo para piezas antes y después |
| `impresion.html` | Diálogo Registrar impresión: el rollo que se usa (viene sugerido el abierto) y cuánto le queda después |
| `produccion-pedido.html` | Diálogo Poner en producción: el rollo con que empieza cada artículo y cómo se reparte entre rollos |
| `rollos.css` | Lo nuevo: número de rollo, filamento con rollos, selector de rollo, barra de antes y después, diálogos |

Los números (costo por gramo, valor del inventario, gramos después de imprimir) salen de las reglas de `ronda-4.md §2`, calculados por el generador; los casos con números exactos para las pruebas están en ese mismo documento. Los datos son de ejemplo (taller «Eje Z»). Anchos que se comparan: 1440, 820 y 390.
