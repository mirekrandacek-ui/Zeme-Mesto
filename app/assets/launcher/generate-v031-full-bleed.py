#!/usr/bin/env python3
"""Build the v031 full-bleed Android adaptive-icon foregrounds and preview.

Requires Pillow (``python3 -m pip install Pillow``).  The approved 124% globe and
STOP render is read from generated-v031-adaptive; only the previously transparent
area is filled with a lit, textured ocean extension.
"""

from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "generated-v031-adaptive"
OUTPUT = ROOT / "generated-v031-full-bleed"
ANDROID_RES = ROOT.parents[1] / "android/app/src/main/res"
PREVIEW = ROOT / "v031-adaptive-full-bleed-preview.png"
SCALES = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}


def ocean_extension(size: int) -> Image.Image:
    """Create a globe-like ocean field that continues beyond the source globe."""
    rng = random.Random(31031)
    image = Image.new("RGB", (size, size))
    pixels = image.load()
    for y in range(size):
        ny = y / max(1, size - 1)
        for x in range(size):
            nx = (x - size * 0.48) / size
            # Broad top-left illumination follows the existing 3D globe lighting.
            glow = math.exp(-((nx / 0.44) ** 2 + ((ny - 0.08) / 0.35) ** 2))
            edge = min(1.0, abs(nx) * 1.05 + max(0.0, ny - 0.55) * 0.52)
            ripple = math.sin(nx * 15.0 + ny * 7.0) * 2.2
            noise = rng.uniform(-1.7, 1.7)
            r = 3 + 12 * glow - 2 * edge + noise
            g = 73 + 111 * glow - 28 * edge + ripple + noise
            b = 174 + 74 * glow - 18 * edge + ripple * 0.5 + noise
            pixels[x, y] = tuple(max(0, min(255, round(c))) for c in (r, g, b))

    # Large, soft reflected-light bands prevent the extension looking like a flat fill.
    bands = Image.new("RGBA", (size, size))
    draw = ImageDraw.Draw(bands)
    width = max(1, round(size * 0.018))
    draw.arc((-size * 0.34, size * 0.12, size * 1.34, size * 1.42), 196, 344,
             fill=(50, 180, 255, 28), width=width)
    draw.arc((-size * 0.18, size * 0.25, size * 1.18, size * 1.50), 198, 342,
             fill=(0, 28, 128, 25), width=width)
    bands = bands.filter(ImageFilter.GaussianBlur(max(1, size * 0.025)))
    return Image.alpha_composite(image.convert("RGBA"), bands)


def build_foreground(density: str, size: int) -> Image.Image:
    approved = Image.open(SOURCE / f"ic_launcher_foreground-{density}.png").convert("RGBA")
    if approved.size != (size, size):
        raise ValueError(f"Unexpected {density} source size: {approved.size}")
    # Alpha-compositing preserves every non-transparent source pixel and therefore
    # the exact approved STOP scale and position.
    return Image.alpha_composite(ocean_extension(size), approved)


def adaptive_mask(kind: str, size: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    inset = round(size * 0.035)
    box = (inset, inset, size - inset - 1, size - inset - 1)
    if kind == "circle":
        draw.ellipse(box, fill=255)
    elif kind == "rounded square":
        draw.rounded_rectangle(box, radius=round(size * 0.22), fill=255)
    elif kind == "squircle":
        points = []
        radius = (size - 2 * inset) / 2
        center = (size - 1) / 2
        for degree in range(361):
            angle = math.radians(degree)
            c, s = math.cos(angle), math.sin(angle)
            points.append((center + radius * math.copysign(abs(c) ** 0.5, c),
                           center + radius * math.copysign(abs(s) ** 0.5, s)))
        draw.polygon(points, fill=255)
    return mask


def build_preview(foreground: Image.Image) -> None:
    panel = 432
    gutter = 28
    header = 62
    board = Image.new("RGB", (panel * 3 + gutter * 4, panel + header + gutter), "#eef3f8")
    font = ImageFont.load_default(size=22)
    draw = ImageDraw.Draw(board)
    for index, kind in enumerate(("circle", "squircle", "rounded square")):
        x = gutter + index * (panel + gutter)
        icon = foreground.copy()
        icon.putalpha(adaptive_mask(kind, panel))
        board.paste(icon, (x, header), icon)
        label_box = draw.textbbox((0, 0), kind, font=font)
        label_width = label_box[2] - label_box[0]
        draw.text((x + (panel - label_width) / 2, 20), kind, font=font, fill="#17324d")
    board.save(PREVIEW, optimize=True)


def main() -> None:
    OUTPUT.mkdir(exist_ok=True)
    rendered = {}
    for density, size in SCALES.items():
        foreground = build_foreground(density, size)
        rendered[density] = foreground
        name = f"ic_launcher_foreground-{density}.png"
        foreground.save(OUTPUT / name, optimize=True)
        foreground.save(ANDROID_RES / f"mipmap-{density}" / "ic_launcher_foreground.png", optimize=True)
    build_preview(rendered["xxxhdpi"])


if __name__ == "__main__":
    main()
