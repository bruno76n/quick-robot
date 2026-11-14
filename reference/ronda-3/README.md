# Maquetas de la ronda 3 · Diseño visual

Las 16 pantallas del sistema con el diseño nuevo, más `index.html` con la lista. Se abren con doble clic (sin internet usan una tipografía del sistema en lugar de Geist). La barra lateral lleva de una pantalla a otra; en celular y tableta se abre con el botón de menú. Lo demás es estático. El plan está en `docs/mejoras/ronda-3.md`.

| Archivo | Qué es |
|---|---|
| `index.html` | Lista de las pantallas |
| `inicio.html` … `ajustes.html` | Una pantalla cada uno (la lista completa y qué cambia en cada una: `ronda-3.md §6`) |
| `ui.css` | Componentes: paneles, tablas, estados, barras, gráficas, pasos, alertas. **Es el mismo archivo que usa la web** en sus ilustraciones del sistema |
| `app.css` | Tokens (todo el color en un lugar), marco de la aplicación (barra lateral fija, menú en celular) y lo propio de cada pantalla |
| `app.js` | Solo el menú en celular y tableta |

## Cómo leerlas

- **En esta ronda la maqueta manda en lo visual:** colores, tipografía, tamaños, radios, espacios, bordes, gráficas, tablas y estados. Las clases (`.ui-panel`, `.ui-pill`, `.kps-row`…) no se copian tal cual: se llevan a los tokens y componentes del sistema (Tailwind y shadcn/ui) con los mismos valores.
- **Los datos son de ejemplo** (taller «Eje Z», 13 de noviembre de 2026). Cuadran entre sí, pero no se copian; la semilla sigue siendo `reference/mockup-backup-v7.json`.
- **Los textos salen de `es.ts`.** Lo único que cambia es el vocabulario de `ronda-3.md §5` (Alertas, Disponibles, Stock bajo, Crítico, Al día, Próximo, Vencido, Saldo, Fecha de entrega, Correcta, Fallida, Precio mínimo).
- **Botones y campos dibujados:** en las maquetas no hacen nada; su comportamiento es el de `06`.
- **No se agrega nada** que el sistema no tenga: lo que hay que revisar está en `ronda-3.md §7`.
- Anchos que se comparan: 1440, 820 y 390.
