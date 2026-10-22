#!/usr/bin/env python3
"""batch-20261023-screens contact sheet：每畫面變體並排對戰背景 b，以及 6 個畫面選用圖總覽

用法: python3 tools/art/contact-screen-bg.py [--pick title=a,b menu=b,a ...]
--pick 依序為 landscape、portrait 選用的變體；未給時總覽只輸出變體頁
"""
import os
import sys

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BATCH = os.path.join(ROOT, "assets", "pending", "batch-20261023-screens")
BATTLE = os.path.join(ROOT, "assets", "pending", "batch-20261022-card", "battle-bg")
SCREENS = ["title", "menu", "story", "deck", "picker"]
BG = (0x8C, 0x7F, 0x9C)
PAD = 16
LW, LH = 640, 360
PW, PH = 270, 480
# 中央區框線，與 check-screen-bg.py 一致
CENTER = {"landscape": (0.20, 0.80, 0.25, 0.75), "portrait": (0.10, 0.90, 0.28, 0.72)}
CENTER_BY_SCREEN = {
    "story": {"landscape": (0.15, 0.85, 0.20, 0.80), "portrait": (0.10, 0.90, 0.18, 0.82)},
    "deck": {"landscape": (0.15, 0.85, 0.18, 0.85), "portrait": (0.08, 0.92, 0.15, 0.85)},
}
TITLE = {"landscape": (0.25, 0.75, 0.12, 0.45), "portrait": (0.10, 0.90, 0.12, 0.40)}


def thumb(path, size, screen=None, orient=None, guides=False):
    im = Image.open(path).convert("RGB").resize(size, Image.LANCZOS)
    if guides:
        d = ImageDraw.Draw(im)
        w, h = size
        boxes = [CENTER_BY_SCREEN.get(screen, CENTER)[orient]]
        if screen == "title":
            boxes.append(TITLE[orient])
        for (x0, x1, y0, y1) in boxes:
            d.rectangle([w * x0, h * y0, w * x1, h * y1], outline=(255, 255, 255), width=1)
        for y in (h * 0.12, h * 0.88):
            d.line([0, y, w, y], fill=(255, 220, 120), width=1)
    return im


def battle(orient):
    return os.path.join(BATTLE, "bg-battle-%s-b.png" % orient)


def variant(screen, orient, v):
    return os.path.join(BATCH, screen, "bg-%s-%s-%s.png" % (screen, orient, v))


def screen_sheet(screen):
    # 上列橫式：對戰 b、a、b；下列直式：對戰 b、a、b；白框為中央區，黃線為上下 12%
    w = PAD + 3 * (LW + PAD)
    h = PAD + LH + PAD + PH + PAD
    sheet = Image.new("RGB", (w, h), BG)
    for i, p in enumerate([battle("landscape"), variant(screen, "landscape", "a"), variant(screen, "landscape", "b")]):
        if os.path.exists(p):
            sheet.paste(thumb(p, (LW, LH), screen, "landscape", i > 0), (PAD + i * (LW + PAD), PAD))
    for i, p in enumerate([battle("portrait"), variant(screen, "portrait", "a"), variant(screen, "portrait", "b")]):
        if os.path.exists(p):
            x = PAD + i * (LW + PAD) + (LW - PW) // 2
            sheet.paste(thumb(p, (PW, PH), screen, "portrait", i > 0), (x, PAD + LH + PAD))
    out = os.path.join(BATCH, "contact-%s.png" % screen)
    sheet.save(out, optimize=True)
    return out


def overview(picks):
    names = ["battle"] + SCREENS
    w = PAD + 3 * (LW + PAD)
    lw_rows = 2
    h = PAD + lw_rows * (LH + PAD) + PH + PAD
    sheet = Image.new("RGB", (max(w, PAD + 6 * (PW + PAD)), h), BG)
    for i, n in enumerate(names):
        p = battle("landscape") if n == "battle" else variant(n, "landscape", picks[n][0])
        sheet.paste(thumb(p, (LW, LH)), (PAD + (i % 3) * (LW + PAD), PAD + (i // 3) * (LH + PAD)))
    for i, n in enumerate(names):
        p = battle("portrait") if n == "battle" else variant(n, "portrait", picks[n][1])
        sheet.paste(thumb(p, (PW, PH)), (PAD + i * (PW + PAD), PAD + lw_rows * (LH + PAD)))
    out = os.path.join(BATCH, "contact-overview.png")
    sheet.save(out, optimize=True)
    return out


def main():
    for s in SCREENS:
        print(screen_sheet(s))
    if "--pick" in sys.argv:
        picks = {}
        for kv in sys.argv[sys.argv.index("--pick") + 1:]:
            k, v = kv.split("=")
            picks[k] = v.split(",")
        print(overview(picks))


if __name__ == "__main__":
    main()
