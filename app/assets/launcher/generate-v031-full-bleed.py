#!/usr/bin/env python3
"""Build and preview the full-bleed Android adaptive launcher foreground.

The approved v031 render supplies both the globe and STOP artwork.  The globe is
intentionally larger than the launcher canvas: Android's launcher mask is
allowed to crop it, while STOP is placed separately in the central safe area.
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "generated-v031-adaptive"
OUTPUT = ROOT / "generated-v031-full-bleed"
ANDROID_RES = ROOT.parents[1] / "android/app/src/main/res"
PREVIEW = ROOT / "v031-adaptive-full-bleed-preview.png"
SCALES = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}
REFERENCE_SIZE = 432

# Geometry in xxxhdpi reference pixels.  The globe deliberately overflows the
# canvas; only the independently scaled STOP must fit every launcher mask.
GLOBE_SCALE = 1.22
GLOBE_CENTER = (216, 226)
STOP_SOURCE_CROP = (28, 233, 406, 386)
STOP_SCALE = 0.68
STOP_TARGET_CENTER = (216, 248)
VISIBLE_ALPHA_THRESHOLD = 8
STOP_TILE_POLYGONS = (
    ((33, 272), (48, 244), (113, 238), (139, 259), (135, 334), (116, 361), (57, 352), (37, 326)),
    ((124, 280), (145, 266), (203, 270), (222, 286), (219, 352), (204, 375), (145, 369), (126, 349)),
    ((211, 286), (231, 269), (286, 268), (307, 287), (307, 352), (287, 378), (231, 374), (213, 353)),
    ((294, 263), (313, 242), (377, 238), (397, 258), (400, 326), (380, 350), (319, 361), (298, 341)),
)


def scale_point(point: tuple[int, int], size: int) -> tuple[int, int]:
    return tuple(round(value * size / REFERENCE_SIZE) for value in point)


def stop_mask(size: int) -> Image.Image:
    """Mask the approved STOP tiles, excluding the surrounding globe."""
    mask = Image.new("L", (size, size))
    draw = ImageDraw.Draw(mask)
    for polygon in STOP_TILE_POLYGONS:
        draw.polygon([scale_point(point, size) for point in polygon], fill=255)
    return mask.filter(ImageFilter.GaussianBlur(max(0.5, size / REFERENCE_SIZE)))


def ocean_fill(size: int) -> Image.Image:
    """Return an opaque blue field behind the oversized globe."""
    image = Image.new("RGBA", (size, size))
    pixels = image.load()
    for y in range(size):
        position = y / max(1, size - 1)
        for x in range(size):
            highlight = max(0.0, 1.0 - math.hypot((x / size - 0.43) * 0.8, position - 0.05))
            pixels[x, y] = (
                round(3 + 8 * highlight),
                round(66 + 99 * highlight - 20 * position),
                round(164 + 78 * highlight - 24 * position),
                255,
            )
    return image


def resize_about_center(image: Image.Image, scale: float, center: tuple[int, int]) -> Image.Image:
    """Scale an image and paste its centre at ``center``, cropping overflow."""
    size = image.width
    scaled_size = round(size * scale)
    scaled = image.resize((scaled_size, scaled_size), Image.Resampling.LANCZOS)
    result = Image.new(image.mode, image.size)
    origin = (center[0] - scaled_size // 2, center[1] - scaled_size // 2)
    result.paste(scaled, origin)
    return result


def build_foreground(density: str, size: int) -> tuple[Image.Image, Image.Image]:
    approved = Image.open(SOURCE / f"ic_launcher_foreground-{density}.png").convert("RGBA")
    if approved.size != (size, size):
        raise ValueError(f"Unexpected {density} source size: {approved.size}")

    ocean = ocean_fill(size)
    center = scale_point(GLOBE_CENTER, size)
    globe = resize_about_center(approved, GLOBE_SCALE, center)
    foreground = Image.alpha_composite(ocean, globe)

    # Remove the source STOP with one simple feathered rectangle.  There is no
    # edge reconstruction: this area is ocean and will be covered by the safely
    # positioned approved STOP immediately below.
    crop = tuple(round(value * size / REFERENCE_SIZE) for value in STOP_SOURCE_CROP)
    erase = Image.new("L", (size, size))
    ImageDraw.Draw(erase).rectangle(crop, fill=255)
    erase = resize_about_center(erase, GLOBE_SCALE, center).filter(
        ImageFilter.GaussianBlur(max(1, round(5 * size / REFERENCE_SIZE))))
    foreground = Image.composite(ocean, foreground, erase)

    source_stop = approved.crop(crop)
    source_alpha = stop_mask(size).crop(crop)
    target_size = tuple(round(value * STOP_SCALE) for value in source_stop.size)
    source_stop = source_stop.resize(target_size, Image.Resampling.LANCZOS)
    source_alpha = source_alpha.resize(target_size, Image.Resampling.LANCZOS)
    target_center = scale_point(STOP_TARGET_CENTER, size)
    origin = (target_center[0] - target_size[0] // 2, target_center[1] - target_size[1] // 2)
    stop_layer = Image.new("RGBA", (size, size))
    stop_layer.paste(source_stop, origin, source_alpha)
    return Image.alpha_composite(foreground, stop_layer), stop_layer.getchannel("A")


def adaptive_mask(kind: str, size: int) -> Image.Image:
    mask = Image.new("L", (size, size))
    draw = ImageDraw.Draw(mask)
    inset = round(size * 0.035)
    box = (inset, inset, size - inset - 1, size - inset - 1)
    if kind == "circle":
        draw.ellipse(box, fill=255)
    elif kind == "rounded square":
        draw.rounded_rectangle(box, radius=round(size * 0.22), fill=255)
    elif kind == "squircle":
        radius, center = (size - 2 * inset) / 2, (size - 1) / 2
        points = []
        for degree in range(361):
            angle = math.radians(degree)
            cosine, sine = math.cos(angle), math.sin(angle)
            points.append((center + radius * math.copysign(abs(cosine) ** 0.5, cosine),
                           center + radius * math.copysign(abs(sine) ** 0.5, sine)))
        draw.polygon(points, fill=255)
    else:
        raise ValueError(f"Unknown mask: {kind}")
    return mask


def visible_bbox(alpha: Image.Image) -> tuple[int, int, int, int]:
    bbox = alpha.point(lambda value: 255 if value > VISIBLE_ALPHA_THRESHOLD else 0).getbbox()
    if bbox is None:
        raise ValueError("STOP mask is empty")
    return bbox[0], bbox[1], bbox[2] - 1, bbox[3] - 1


def check_stop(alpha: Image.Image, kind: str) -> None:
    visible = alpha.point(lambda value: 255 if value > VISIBLE_ALPHA_THRESHOLD else 0)
    if ImageChops.subtract(visible, adaptive_mask(kind, alpha.width)).getbbox() is not None:
        raise ValueError(f"STOP extends outside the {kind} mask")


def build_preview(foreground: Image.Image) -> None:
    panel, gutter, header = 432, 28, 62
    board = Image.new("RGB", (panel * 3 + gutter * 4, panel + header + gutter), "#eef3f8")
    font = ImageFont.load_default(size=22)
    draw = ImageDraw.Draw(board)
    for index, kind in enumerate(("circle", "squircle", "rounded square")):
        x = gutter + index * (panel + gutter)
        icon = foreground.copy()
        icon.putalpha(adaptive_mask(kind, panel))
        board.paste(icon, (x, header), icon)
        label_width = draw.textbbox((0, 0), kind, font=font)[2]
        draw.text((x + (panel - label_width) / 2, 20), kind, font=font, fill="#17324d")
    board.save(PREVIEW, optimize=True)


def main() -> None:
    OUTPUT.mkdir(exist_ok=True)
    rendered: dict[str, Image.Image] = {}
    measured_alpha = None
    for density, size in SCALES.items():
        foreground, stop_alpha = build_foreground(density, size)
        rendered[density] = foreground
        filename = "ic_launcher_foreground.png"
        foreground.save(OUTPUT / f"ic_launcher_foreground-{density}.png", optimize=True)
        foreground.save(ANDROID_RES / f"mipmap-{density}" / filename, optimize=True)
        if density == "xxxhdpi":
            measured_alpha = stop_alpha

    if measured_alpha is None:
        raise ValueError("xxxhdpi output is required")
    build_preview(rendered["xxxhdpi"])
    print(f"Globe scale: {GLOBE_SCALE:.2f}x; center xxxhdpi: {GLOBE_CENTER}")
    print(f"STOP visible bbox xxxhdpi: {visible_bbox(measured_alpha)}")
    for kind in ("circle", "squircle", "rounded square"):
        check_stop(measured_alpha, kind)
        print(f"STOP fully visible in {kind}: yes")


if __name__ == "__main__":
    main()
