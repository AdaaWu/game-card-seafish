#!/usr/bin/env python3
"""把 assets/_source/ 的 PNG 母檔轉成 assets/ 底下的 webp

用法: python3 tools/to-webp.py [assets/_source/cards/xxx.png ...]
不帶參數時轉換 _source 底下的 cards、portraits、stickers 全部
"""
import argparse
import glob
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, "assets", "_source")
DIRS = ["cards", "portraits", "stickers"]
MAX_SIDE = 512
QUALITY = 83


def convert(src):
    rel = os.path.relpath(os.path.abspath(src), SOURCE)
    if rel.startswith(".."):
        raise SystemExit("不在 assets/_source 底下: %s" % src)
    dst = os.path.join(ROOT, "assets", os.path.splitext(rel)[0] + ".webp")
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with Image.open(src) as im:
        im = im.convert("RGBA")
        # 只縮不放，保持長寬比
        im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
        im.save(dst, "WEBP", quality=QUALITY, method=6)
    return dst


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="*")
    args = ap.parse_args()
    files = args.files or sorted(f for d in DIRS for f in glob.glob(os.path.join(SOURCE, d, "*.png")))
    for f in files:
        print("%s -> %s" % (os.path.relpath(f, ROOT), os.path.relpath(convert(f), ROOT)))
    print("共 %d 張" % len(files))


if __name__ == "__main__":
    main()
