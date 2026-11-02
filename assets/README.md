# assets/ · Marca e íconos

**Estado: provisionales.** Todo se generó a partir de la **mascota que dibuja el mockup** (`mascot()` en `reference/Quick Robot mockup.html`: cabeza verde, antena y orejas moradas, ojos grandes). No es un arte oficial de R1: es lo que el mockup ya usa en la barra lateral y en los estados vacíos, ajustado a un ícono de aplicación. Sirven para construir y usar la app; si después hay un arte final de R1, se reemplaza **sin cambiar nombres de archivo** y no hay que tocar código.

## Archivos

| Archivo | Para qué | Dónde se usa |
|---|---|---|
| `app-icon.svg` · `app-icon-1024.png` | Ícono de la app: cuadrado redondeado de estilo macOS con la mascota | Fuente de todos los demás |
| `icon.icns` | Ícono de macOS (16 a 1024 px) | `apps/desktop` → `electron-builder.yml` (`mac.icon`) — fase 4 |
| `icon.ico` | Ícono de Windows (16 a 256 px) | Solo si algún día hay versión Windows |
| `icon-512.png` · `icon-256.png` | Ícono para Linux y para la ventana | `apps/desktop/src/main.ts` (`BrowserWindow.icon`) |
| `favicon.svg` · `favicon-32.png` | Pestaña del navegador | `apps/web/index.html` |
| `apple-touch-icon.png` | Acceso directo en iPhone o iPad | `apps/web/index.html` |
| `mascot-r1.svg` · `mascot-r1.png` | La mascota sola, fondo transparente | Estados vacíos, pantalla de carga y encabezado de la barra lateral (junto al nombre del negocio que haya en Ajustes) |
| `logo-horizontal.svg` · `logo-horizontal.png` | Mascota + "Quick Robot" + "Impresión 3D" (texto convertido a trazos: no necesita la tipografía) | **Solo uso externo de la marca Quick Robot** (redes, presentaciones, README del repositorio). La interfaz y los documentos **no** lo usan |
| `source/make-assets.py` | Regenera todo lo anterior | Cuando cambie la mascota |

## Colores de la marca

| Uso | Valor |
|---|---|
| Verde (cabeza, **ganancia**) | `#00ae42` |
| Morado (antena, orejas, **costo**) | `#6b3fd4` |
| Tinta | `#121214` |
| Tinta secundaria (subtítulo del logo) | `#6a6a73` |

Tipografía: **Geist** (semibold para el nombre, regular para "Impresión 3D").

## Reglas de uso

- Fondo claro siempre (el producto es solo modo claro). Margen libre alrededor del logo: al menos la altura del ojo de la mascota.
- **Marca del producto ≠ marca del negocio.** La mascota es la marca visual del producto. El texto “Quick Robot” es el nombre de *un* negocio (el de Bruno), así que la barra lateral y los documentos escriben el nombre y el giro que haya en Ajustes (`06 §1` y `§14`) y el logo con texto no se usa dentro de la app. El nombre comercial del producto público se decide en la fase 5 (`17`).
- No recolorear ni deformar la mascota; no agregar "Guadalajara" al logo (no es parte del nombre).
- La interfaz **no** hace nada con la mascota fuera de los lugares de la tabla; si se necesita en otro sitio, se usa el SVG, nunca se vuelve a dibujar.

## Cómo regenerar

```
npm pack geist                      # tipografía (licencia OFL); extraer package/dist/fonts/geist-sans/
pip install pillow fonttools playwright
python3 assets/source/make-assets.py <Geist-SemiBold.ttf> <Geist-Regular.ttf>
```
