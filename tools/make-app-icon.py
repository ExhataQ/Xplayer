#!/usr/bin/env python3
"""Xplayer app icon (task PA-12, brief 10.3): the approved X mark (src/ui-next/startup/logo.js) on a dark rounded tile, like the old icon.

Writes src/assets/app-icon/: xplayer.svg, xplayer-<size>.png and xplayer.ico (16, 24, 32, 48, 64, 128, 256 px, each drawn for its size).
Needs Pillow:  python -m pip install pillow     Run:  python tools/make-app-icon.py

The colors are the warm-graphite theme's (src/ui-next/tokens.css): ground #0e1013, ink #ece9e3, accent #eba43a. Change them here if
the logo changes; the mark is the same two strokes as logo.js (48 x 48 grid, round caps).
"""
import io
import os
import struct
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'assets', 'app-icon')
GROUND, GROUND_TOP, INK, ACCENT = (14, 16, 19), (24, 27, 33), (236, 233, 227), (235, 164, 58)
TILE_RADIUS = 0.224  # of the side, like the old icon
SIZES_PNG = [16, 24, 32, 48, 64, 128, 256, 512, 1024]
SIZES_ICO = [16, 24, 32, 48, 64, 128, 256]
# the mark on the 48 grid: two white pieces with a gap for the amber stroke to cross, and the amber stroke
WHITE = [((11, 11), (20, 20)), ((28, 28), (37, 37))]
AMBER = [((37, 11), (11, 37))]


def tile(size, ss=8):
    """The tile at size x size, drawn at ss times the size and shrunk."""
    big = size * ss
    mask = Image.new('L', (big, big), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, big - 1, big - 1), radius=big * TILE_RADIUS, fill=255)
    base = Image.new('RGB', (big, big), GROUND)
    top = Image.new('RGB', (big, big), GROUND_TOP)
    fade = Image.linear_gradient('L').resize((big, big))  # black at the top, white at the bottom
    base = Image.composite(base, top, fade)
    # the mark: bolder at small sizes, where a thin stroke would blur away
    small = size <= 32
    unit = big * (0.0215 if small else 0.0195)
    width = unit * (8.2 if small else 6)
    d = ImageDraw.Draw(base)

    def stroke(a, b, color):
        pts = [(big / 2 + (p[0] - 24) * unit, big / 2 + (p[1] - 24) * unit) for p in (a, b)]
        d.line(pts, fill=color, width=round(width))
        for x, y in pts:
            d.ellipse((x - width / 2, y - width / 2, x + width / 2, y + width / 2), fill=color)

    for a, b in WHITE:
        stroke(a, b, INK)
    for a, b in AMBER:
        stroke(a, b, ACCENT)
    img = base.convert('RGBA')
    img.putalpha(mask)
    return img.resize((size, size), Image.LANCZOS)


def png_bytes(img):
    buf = io.BytesIO()
    img.save(buf, 'PNG', optimize=True)
    return buf.getvalue()


def ico(images):
    """A Windows .ico made of PNG images (supported since Vista); each size is its own drawing."""
    head = struct.pack('<HHH', 0, 1, len(images))
    entries, data, offset = b'', b'', 6 + 16 * len(images)
    for size, blob in images:
        entries += struct.pack('<BBBBHHII', size % 256, size % 256, 0, 0, 1, 32, len(blob), offset)
        data += blob
        offset += len(blob)
    return head + entries + data


SVG = """<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#181b21"/><stop offset="1" stop-color="#0e1013"/></linearGradient></defs>
  <rect width="1024" height="1024" rx="229" fill="url(#g)"/>
  <g transform="translate(512 512) scale(19.97)" fill="none" stroke-width="6" stroke-linecap="round">
    <path d="M-13 -13 L-4 -4 M4 4 L13 13" stroke="#ece9e3"/>
    <path d="M13 -13 L-13 13" stroke="#eba43a"/>
  </g>
</svg>
"""

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for size in SIZES_PNG:
        open(os.path.join(OUT, f'xplayer-{size}.png'), 'wb').write(png_bytes(tile(size)))
    open(os.path.join(OUT, 'xplayer.ico'), 'wb').write(ico([(s, png_bytes(tile(s))) for s in SIZES_ICO]))
    open(os.path.join(OUT, 'xplayer.svg'), 'w', encoding='utf8', newline='\n').write(SVG)
    print('wrote', OUT)
