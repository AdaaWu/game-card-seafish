#!/usr/bin/env python3
"""batch-20261023-ui contact sheet：棋盤格底顯示透明，每格標檔名

用法: python3 tools/art/contact-ui-kit.py <輸出.png> <檔案或 glob ...> [--cell 220] [--cols 6] [--bg checker|dark|light]
"""
import argparse
import glob
import os

from PIL import Image, ImageDraw, ImageFont

FONT = "/System/Library/Fonts/STHeiti Medium.ttc"


def checker(w, h, s=12):
    im = Image.new("RGB", (w, h), (236, 236, 240))
    d = ImageDraw.Draw(im)
    for y in range(0, h, s):
        for x in range(0, w, s):
            if (x // s + y // s) % 2:
                d.rectangle([x, y, x + s - 1, y + s - 1], fill=(212, 212, 220))
    return im


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("files", nargs="+")
    ap.add_argument("--cell", type=int, default=220)
    ap.add_argument("--cols", type=int, default=6)
    ap.add_argument("--bg", default="checker")
    ap.add_argument("--title", default="")
    a = ap.parse_args()
    files = []
    for f in a.files:
        files += sorted(glob.glob(f)) if any(c in f for c in "*?[") else [f]
    files = [f for f in files if ".prev-" not in f]
    cw, ch = a.cell, a.cell + 26
    rows = (len(files) + a.cols - 1) // a.cols
    top = 40 if a.title else 0
    sheet = Image.new("RGB", (cw * a.cols, ch * rows + top), (250, 248, 244))
    font = ImageFont.truetype(FONT, 13)
    d = ImageDraw.Draw(sheet)
    if a.title:
        d.text((10, 8), a.title, fill=(62, 53, 80), font=ImageFont.truetype(FONT, 22))
    for i, f in enumerate(files):
        x, y = (i % a.cols) * cw, (i // a.cols) * ch + top
        bg = {"checker": checker(cw - 8, a.cell - 8), "dark": Image.new("RGB", (cw - 8, a.cell - 8), (70, 64, 90)),
              "light": Image.new("RGB", (cw - 8, a.cell - 8), (207, 227, 238))}[a.bg]
        im = Image.open(f).convert("RGBA")
        im.thumbnail((cw - 16, a.cell - 16), Image.LANCZOS)
        bg = bg.convert("RGBA")
        bg.alpha_composite(im, ((bg.width - im.width) // 2, (bg.height - im.height) // 2))
        sheet.paste(bg.convert("RGB"), (x + 4, y + 4))
        d.text((x + 6, y + a.cell - 2), os.path.basename(f)[:34], fill=(62, 53, 80), font=font)
    sheet.save(a.out)
    print(a.out, len(files))


if __name__ == "__main__":
    main()
