#!/usr/bin/env python3
"""畫面背景後處理：cover 裁切到 16:9 或 9:16，縮到 1920x1080 或 1080x1920，存 PNG 與 WebP

用法: python3 tools/art/post-screen-bg.py [--only id1,id2]
"""
import glob
import os
import re
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BATCH = os.path.join(ROOT, "assets", "pending", "batch-20261023-screens")
RAW = os.path.join(BATCH, "_raw")
TARGET = {"landscape": (1920, 1080), "portrait": (1080, 1920)}
LIMIT = 2 * 1024 * 1024


def cover(im, size):
    tw, th = size
    scale = max(tw / im.width, th / im.height)
    im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    x, y = (im.width - tw) // 2, (im.height - th) // 2
    return im.crop((x, y, x + tw, y + th))


def main():
    only = None
    if "--only" in sys.argv:
        only = set(sys.argv[sys.argv.index("--only") + 1].split(","))
    for src in sorted(p for p in glob.glob(os.path.join(RAW, "bg-*.png")) if re.fullmatch(r"bg-[a-z]+-(landscape|portrait)-[a-z]\.png", os.path.basename(p))):
        name = os.path.splitext(os.path.basename(src))[0]
        if only and name not in only:
            continue
        screen, orient = name.split("-")[1], name.split("-")[2]
        out = os.path.join(BATCH, screen)
        os.makedirs(out, exist_ok=True)
        raw = Image.open(src).convert("RGB")
        im = cover(raw, TARGET[orient])
        png = os.path.join(out, name + ".png")
        webp = os.path.join(out, name + ".webp")
        im.save(png, optimize=True)
        quality = 85
        im.save(webp, "WEBP", quality=quality, method=6)
        if os.path.getsize(webp) > LIMIT:
            quality = 80
            im.save(webp, "WEBP", quality=quality, method=6)
        print("%s 原圖 %dx%d -> %dx%d webp q%d %dB" % (name, raw.width, raw.height, im.width, im.height, quality, os.path.getsize(webp)))


if __name__ == "__main__":
    main()
