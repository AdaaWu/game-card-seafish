#!/usr/bin/env python3
"""batch-20261022-card 四角圖示後處理：去背置中成 144 的 @2x，再縮出 72 的 1x，各存 PNG 與 WebP

用法: python3 tools/art/post-card-icons.py
"""
import glob
import os
import subprocess

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BATCH = os.path.join(ROOT, "assets", "pending", "batch-20261022-card")
RAW = os.path.join(BATCH, "_raw")
OUT = os.path.join(BATCH, "card-front", "icons")


def main():
    os.makedirs(OUT, exist_ok=True)
    for src in sorted(glob.glob(os.path.join(RAW, "icon-*.png"))):
        name = os.path.splitext(os.path.basename(src))[0]
        big = os.path.join(OUT, name + "@2x.png")
        subprocess.run(["python3", os.path.join(ROOT, "tools", "remove-bg.py"), src, big, "--fit", "0.92", "--size", "144"],
                       check=True, capture_output=True)
        im = Image.open(big).convert("RGBA")
        im.save(os.path.join(OUT, name + "@2x.webp"), "WEBP", quality=85, method=6, exact=True)
        small = im.resize((72, 72), Image.LANCZOS)
        small.save(os.path.join(OUT, name + ".png"), optimize=True)
        small.save(os.path.join(OUT, name + ".webp"), "WEBP", quality=85, method=6, exact=True)
        print(name)


if __name__ == "__main__":
    main()
