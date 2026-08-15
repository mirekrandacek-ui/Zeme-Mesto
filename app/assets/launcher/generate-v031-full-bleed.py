#!/usr/bin/env python3
"""Build the v031 full-bleed Android adaptive-icon foregrounds and preview.

Requires Pillow (``python3 -m pip install Pillow``).  The approved 124% globe and
STOP render is read from generated-v031-adaptive.  The globe stays full-size, while
STOP is independently inset into the adaptive-icon safe zone.
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
REFERENCE_SIZE = 432
# The crop includes padding for the feathered tile edges. It is deliberately not
# reported as the visible STOP bbox; that is measured from the alpha mask below.
STOP_SOURCE_CROP = (28, 233, 405, 385)
STOP_SCALE = 0.65
STOP_TARGET_CENTER = (215, 226)
VISIBLE_ALPHA_THRESHOLD = 8
STOP_TILE_POLYGONS = (
    ((33, 272), (48, 244), (113, 238), (139, 259), (135, 334), (116, 361), (57, 352), (37, 326)),
    ((124, 280), (145, 266), (203, 270), (222, 286), (219, 352), (204, 375), (145, 369), (126, 349)),
    ((211, 286), (231, 269), (286, 268), (307, 287), (307, 352), (287, 378), (231, 374), (213, 353)),
    ((294, 263), (313, 242), (377, 238), (397, 258), (400, 326), (380, 350), (319, 361), (298, 341)),
)


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


def scaled_point(point: tuple[int, int], size: int) -> tuple[int, int]:
    return tuple(round(value * size / REFERENCE_SIZE) for value in point)


def stop_mask(size: int) -> Image.Image:
    """Return a feathered mask covering only the four STOP tile renders."""
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    for polygon in STOP_TILE_POLYGONS:
        draw.polygon([scaled_point(point, size) for point in polygon], fill=255)
    return mask.filter(ImageFilter.GaussianBlur(max(0.5, size / REFERENCE_SIZE)))


def visible_bbox(mask: Image.Image) -> tuple[int, int, int, int]:
    """Measure inclusive bounds of pixels that are visibly part of STOP."""
    thresholded = mask.point(lambda alpha: 255 if alpha > VISIBLE_ALPHA_THRESHOLD else 0)
    bbox = thresholded.getbbox()
    if bbox is None:
        raise ValueError("STOP mask is empty")
    left, top, right, bottom = bbox
    return left, top, right - 1, bottom - 1


def inset_stop(approved: Image.Image, ocean: Image.Image, size: int) -> tuple[Image.Image, Image.Image]:
    """Move STOP without scaling the globe, and restore ocean below its old pixels."""
    mask = stop_mask(size)
    # A broad feather avoids leaving four tile-shaped seams where the old STOP was.
    # The replacement is deliberately ocean: the globe artwork itself remains at
    # its approved scale and is allowed to run beyond every launcher mask.
    spread = max(3, round(101 * size / REFERENCE_SIZE)) | 1
    restore_mask = mask.filter(ImageFilter.MaxFilter(spread)).filter(
        ImageFilter.GaussianBlur(max(2, 28 * size / REFERENCE_SIZE)))
    globe = Image.composite(ocean, approved, restore_mask)

    left, top, right, bottom = (round(value * size / REFERENCE_SIZE)
                                for value in STOP_SOURCE_CROP)
    # PIL crop's right/bottom are exclusive; this configured crop is inclusive.
    source_box = (left, top, right + 1, bottom + 1)
    stop = approved.crop(source_box)
    stop_alpha = mask.crop(source_box)
    target_size = tuple(round(value * STOP_SCALE) for value in stop.size)
    stop = stop.resize(target_size, Image.Resampling.LANCZOS)
    stop_alpha = stop_alpha.resize(target_size, Image.Resampling.LANCZOS)
    center = scaled_point(STOP_TARGET_CENTER, size)
    target_origin = (center[0] - target_size[0] // 2,
                     center[1] - target_size[1] // 2)
    # Suppress the crop's rectangular ocean pixels and retain only the
    # independently transformed STOP.
    clean = Image.new("RGBA", (size, size))
    clean.paste(stop, target_origin, stop_alpha)
    return Image.alpha_composite(globe, clean), clean.getchannel("A")


def build_foreground(density: str, size: int) -> tuple[Image.Image, Image.Image, Image.Image]:
    approved = Image.open(SOURCE / f"ic_launcher_foreground-{density}.png").convert("RGBA")
    if approved.size != (size, size):
        raise ValueError(f"Unexpected {density} source size: {approved.size}")
    ocean = ocean_extension(size)
    approved_full_bleed = Image.alpha_composite(ocean, approved)
    foreground, transformed_mask = inset_stop(approved_full_bleed, ocean, size)
    return foreground, stop_mask(size), transformed_mask


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
    measured = None
    for density, size in SCALES.items():
        foreground, source_mask, transformed_mask = build_foreground(density, size)
        rendered[density] = foreground
        name = f"ic_launcher_foreground-{density}.png"
        foreground.save(OUTPUT / name, optimize=True)
        foreground.save(ANDROID_RES / f"mipmap-{density}" / "ic_launcher_foreground.png", optimize=True)
        if density == "xxxhdpi":
            measured = visible_bbox(source_mask), visible_bbox(transformed_mask)
    build_preview(rendered["xxxhdpi"])
    if measured is None:
        raise ValueError("xxxhdpi output is required for STOP geometry reporting")
    before, after = measured
    before_size = (before[2] - before[0] + 1, before[3] - before[1] + 1)
    after_size = (after[2] - after[0] + 1, after[3] - after[1] + 1)
    before_center = ((before[0] + before[2]) / 2, (before[1] + before[3]) / 2)
    after_center = ((after[0] + after[2]) / 2, (after[1] + after[3]) / 2)
    reduction = tuple(100 * (1 - new / old) for old, new in zip(before_size, after_size))
    movement = tuple(new - old for old, new in zip(before_center, after_center))
    print(f"STOP visible bbox xxxhdpi: {before} ({before_size[0]}x{before_size[1]})")
    print(f"STOP target bbox xxxhdpi:  {after} ({after_size[0]}x{after_size[1]})")
    print(f"STOP linear reduction: width {reduction[0]:.1f}%, height {reduction[1]:.1f}%")
    print(f"STOP center movement: dx {movement[0]:+.1f}px, dy {movement[1]:+.1f}px")


if __name__ == "__main__":
    main()
