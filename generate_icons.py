"""Generates the PNG icons for the Chrome extension."""
import os
from PIL import Image, ImageDraw

SIZES = [16, 32, 48, 128]
OUT_DIR = os.path.join(os.path.dirname(__file__), 'icons')
AMBER   = (245, 166, 35, 255)
DARK    = (26, 26, 46, 255)


def draw_note(draw, size, color):
    """Draws a simplified musical note."""
    cx = size // 2
    # Note head (tilted ellipse)
    head_rx = max(2, size // 6)
    head_ry = max(1, size // 9)
    head_cx = cx - size // 8
    head_cy = size * 3 // 5
    draw.ellipse(
        [head_cx - head_rx, head_cy - head_ry,
         head_cx + head_rx, head_cy + head_ry],
        fill=color
    )
    # Vertical stem
    stem_x = head_cx + head_rx - max(1, size // 20)
    stem_top = head_cy - head_ry - size // 3
    stem_w = max(1, size // 16)
    draw.rectangle([stem_x, stem_top, stem_x + stem_w, head_cy - head_ry], fill=color)
    # Flag
    if size >= 32:
        flag_len = size // 4
        for i in range(2):
            y = stem_top + i * (size // 8)
            draw.line(
                [(stem_x + stem_w, y), (stem_x + stem_w + flag_len, y + flag_len // 2)],
                fill=color, width=max(1, stem_w)
            )


def make_icon(size):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Background with simulated rounded corners (full fill for simplicity)
    r = max(2, size // 7)
    # Draw the rounded rectangle manually
    draw.rectangle([r, 0, size - r, size], fill=AMBER)
    draw.rectangle([0, r, size, size - r], fill=AMBER)
    draw.ellipse([0, 0, r * 2, r * 2], fill=AMBER)
    draw.ellipse([size - r * 2, 0, size, r * 2], fill=AMBER)
    draw.ellipse([0, size - r * 2, r * 2, size], fill=AMBER)
    draw.ellipse([size - r * 2, size - r * 2, size, size], fill=AMBER)

    draw_note(draw, size, DARK)
    return img


os.makedirs(OUT_DIR, exist_ok=True)
for s in SIZES:
    path = os.path.join(OUT_DIR, f'icon{s}.png')
    make_icon(s).save(path)
    print(f'  Created {path}')

print('Icons generated.')
