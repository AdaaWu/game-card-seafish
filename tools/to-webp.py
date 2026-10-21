#!/usr/bin/env python3
"""把 assets/_source/ 的 PNG 母檔轉成 assets/ 底下的 webp

用法: python3 tools/to-webp.py [--max-side N] [assets/_source/cards/xxx.png ...]
不帶檔案時轉換 _source 底下的 cards、portraits、stickers 全部
最大邊預設 portraits 與 cards 1024、其餘 512，帶 --max-side 時一律用指定值
"""
import argparse
import glob
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, "assets", "_source")
DIRS = ["cards", "portraits", "stickers"]
DEFAULT_MAX_SIDE = 512
MAX_SIDE_BY_DIR = {"portraits": 1024, "cards": 1024}
QUALITY = 83


def convert(src, max_side=None):
    rel = os.path.relpath(os.path.abspath(src), SOURCE)
    if rel.startswith(".."):
        raise SystemExit("不在 assets/_source 底下: %s" % src)
    if max_side is None:
        max_side = MAX_SIDE_BY_DIR.get(rel.split(os.sep)[0], DEFAULT_MAX_SIDE)
    dst = os.path.join(ROOT, "assets", os.path.splitext(rel)[0] + ".webp")
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with Image.open(src) as im:
        im = im.convert("RGBA")
        # 只縮不放，保持長寬比
        im.thumbnail((max_side, max_side), Image.LANCZOS)
        im.save(dst, "WEBP", quality=QUALITY, method=6)
    return dst


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="*")
    ap.add_argument("--max-side", type=int, help="最大邊 px，只縮不放；不帶時依目錄決定")
    args = ap.parse_args()
    files = args.files or sorted(f for d in DIRS for f in glob.glob(os.path.join(SOURCE, d, "*.png")))
    for f in files:
        print("%s -> %s" % (os.path.relpath(f, ROOT), os.path.relpath(convert(f, args.max_side), ROOT)))
    print("共 %d 張" % len(files))


if __name__ == "__main__":
    main()
