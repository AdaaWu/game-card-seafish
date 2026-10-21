#!/usr/bin/env python3
"""對戰背景後處理：cover 裁切到 16:9 或 9:16，縮到 1920x1080 或 1080x1920，存 PNG 與 WebP

用法: python3 tools/art/post-battle-bg.py
"""
import glob
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BATCH = os.path.join(ROOT, "assets", "pending", "batch-20261022-card")
RAW = os.path.join(BATCH, "_raw")
OUT = os.path.join(BATCH, "battle-bg")
TARGET = {"landscape": (1920, 1080), "portrait": (1080, 1920)}
LIMIT = 2 * 1024 * 1024


def cover(im, size):
    tw, th = size
    scale = max(tw / im.width, th / im.height)
    im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    x, y = (im.width - tw) // 2, (im.height - th) // 2
    return im.crop((x, y, x + tw, y + th))


def main():
    os.makedirs(OUT, exist_ok=True)
    for src in sorted(glob.glob(os.path.join(RAW, "bg-battle-*.png"))):
        name = os.path.splitext(os.path.basename(src))[0]
        orient = name.split("-")[2]
        raw = Image.open(src).convert("RGB")
        im = cover(raw, TARGET[orient])
        png = os.path.join(OUT, name + ".png")
        webp = os.path.join(OUT, name + ".webp")
        im.save(png, optimize=True)
        quality = 85
        im.save(webp, "WEBP", quality=quality, method=6)
        if os.path.getsize(webp) > LIMIT:
            quality = 80
            im.save(webp, "WEBP", quality=quality, method=6)
        print("%s 原圖 %dx%d -> %dx%d webp q%d %dB png %dB" % (
            name, raw.width, raw.height, im.width, im.height, quality, os.path.getsize(webp), os.path.getsize(png)))


if __name__ == "__main__":
    main()
