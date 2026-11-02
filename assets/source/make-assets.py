"""Regenerates every file in assets/ from the mascot drawn in the mockup.

Usage:  python3 assets/source/make-assets.py <path to Geist-SemiBold.ttf> <path to Geist-Regular.ttf>
Needs:  pip install pillow fonttools playwright   (Chromium is used only to rasterize SVG -> PNG)
Fonts:  `npm pack geist` -> package/dist/fonts/geist-sans/Geist-SemiBold.ttf and Geist-Regular.ttf (OFL license)

The mascot is the SVG of `mascot()` in reference/Quick Robot mockup.html (core.js). If the real R1 art
is different, replace MASCOT_PARTS below (or drop a new assets/mascot-r1.svg and skip this step) and run again.
"""
import io, os, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from PIL import Image
from playwright.sync_api import sync_playwright

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
INK, PURPLE, GREEN, INK2 = '#121214', '#6b3fd4', '#00ae42', '#6a6a73'

# viewBox 0 0 120 106  (copied from the mockup)
MASCOT_PARTS = f'''<line x1="60" y1="10" x2="60" y2="28" stroke="{INK}" stroke-width="3.5"/>
  <circle cx="60" cy="9" r="8" fill="{PURPLE}"/>
  <rect x="3" y="50" width="12" height="24" rx="4" fill="{PURPLE}"/><rect x="105" y="50" width="12" height="24" rx="4" fill="{PURPLE}"/>
  <rect x="12" y="27" width="96" height="74" rx="22" fill="{GREEN}"/>
  <circle cx="40" cy="60" r="15.5" fill="#fff"/><circle cx="80" cy="60" r="15.5" fill="#fff"/>
  <circle cx="35.5" cy="60" r="7.5" fill="{INK}"/><circle cx="84.5" cy="60" r="7.5" fill="{INK}"/>
  <rect x="47" y="83" width="26" height="5.5" rx="2.75" fill="{INK}"/>'''

def svg(w, h, body, vb=None):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="{vb or f"0 0 {w} {h}"}">\n{body}\n</svg>\n'

def text_path(font, text, size, x, y, tracking_em=-0.03):
    gs, cmap, upm = font.getGlyphSet(), font.getBestCmap(), font['head'].unitsPerEm
    sc, cur, d = size / upm, x, []
    for ch in text:
        name = cmap.get(ord(ch))
        if not name: continue
        pen = SVGPathPen(gs)
        gs[name].draw(TransformPen(pen, (sc, 0, 0, -sc, cur, y)))
        d.append(pen.getCommands())
        cur += gs[name].width * sc + tracking_em * size
    return ' '.join(d), cur

def main(semibold, regular):
    # 1) mascot alone
    open(f'{OUT}/mascot-r1.svg', 'w').write(svg(120, 106, f'  {MASCOT_PARTS}'))
    open(f'{OUT}/favicon.svg', 'w').write(svg(120, 106, f'  {MASCOT_PARTS}'))

    # 2) horizontal logo with the text converted to outlines (no font needed to display it)
    fb, fr = TTFont(semibold), TTFont(regular)
    mh = 96                                   # mascot height in the logo
    ms = mh / 106
    x0 = 120 * ms + 26
    t1, end1 = text_path(fb, 'Quick Robot', 62, x0, 52)
    t2, end2 = text_path(fr, 'Impresión 3D', 31, x0 + 3, 90, tracking_em=0.0)
    w = int(max(end1, end2)) + 4
    body = (f'  <g transform="scale({ms:.5f})">{MASCOT_PARTS}</g>\n'
            f'  <path d="{t1}" fill="{INK}"/>\n  <path d="{t2}" fill="{INK2}"/>')
    W, H = w + 12, mh + 12          # 6 px of breathing room on every side
    open(f'{OUT}/logo-horizontal.svg', 'w').write(svg(W, H, body, vb=f'-6 -6 {W} {H}'))

    # 3) app icon (macOS-style rounded square, 824 px body inside a 1024 canvas)
    s = 5.2
    tx, ty = 512 - s * 60, 512 - s * 51
    icon = f'''  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#ececf1"/></linearGradient>
    <filter id="sh" x="-10%" y="-10%" width="120%" height="125%"><feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#121214" flood-opacity=".22"/></filter>
  </defs>
  <rect x="100" y="100" width="824" height="824" rx="185" fill="url(#bg)" filter="url(#sh)"/>
  <rect x="101" y="101" width="822" height="822" rx="184" fill="none" stroke="#d2d2da" stroke-width="2"/>
  <g transform="translate({tx:.1f} {ty:.1f}) scale({s})">{MASCOT_PARTS}</g>'''
    open(f'{OUT}/app-icon.svg', 'w').write(svg(1024, 1024, icon))

    # 4) rasterize
    with sync_playwright() as p:
        b = p.chromium.launch()
        def png(src, width, height, dest, scale=1):
            pg = b.new_page(viewport={'width': width, 'height': height}, device_scale_factor=scale)
            pg.set_content(f'<body style="margin:0;background:transparent">{open(src).read()}</body>')
            pg.screenshot(path=dest, omit_background=True, clip={'x': 0, 'y': 0, 'width': width, 'height': height})
            pg.close()
        png(f'{OUT}/app-icon.svg', 1024, 1024, f'{OUT}/app-icon-1024.png')
        png(f'{OUT}/logo-horizontal.svg', W, H, f'{OUT}/logo-horizontal.png', scale=2)
        png(f'{OUT}/mascot-r1.svg', 120, 106, f'{OUT}/mascot-r1.png', scale=4)
        b.close()

    big = Image.open(f'{OUT}/app-icon-1024.png').convert('RGBA')
    for n in (512, 256):
        big.resize((n, n), Image.LANCZOS).save(f'{OUT}/icon-{n}.png')
    # favicons: mascot centered on a transparent square
    m = Image.open(f'{OUT}/mascot-r1.png').convert('RGBA')
    for n, name in ((32, 'favicon-32.png'), (180, 'apple-touch-icon.png')):
        pad = 0.08 if n == 32 else 0.14
        inner = int(n * (1 - 2 * pad))
        mm = m.resize((inner, int(inner * m.height / m.width)), Image.LANCZOS)
        canvas = Image.new('RGBA', (n, n), (255, 255, 255, 0) if n == 32 else (255, 255, 255, 255))
        canvas.alpha_composite(mm, ((n - mm.width) // 2, (n - mm.height) // 2))
        canvas.save(f'{OUT}/{name}')
    sizes = [16, 32, 64, 128, 256, 512, 1024]
    imgs = [big.resize((n, n), Image.LANCZOS) for n in sizes]
    imgs[-1].save(f'{OUT}/icon.icns', format='ICNS', append_images=imgs[:-1])
    big.resize((256, 256), Image.LANCZOS).save(f'{OUT}/icon.ico', sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
