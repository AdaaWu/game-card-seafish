#!/usr/bin/env python3
"""檢查對戰背景：尺寸、檔案大小、全圖與中央、上下 12% 的亮度標準差，並輸出卡片模擬圖與參考圖並排

用法: python3 tools/art/check-battle-bg.py
"""
import glob
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DIR = os.path.join(ROOT, "assets", "pending", "batch-20261022-card", "battle-bg")
PREVIEW = os.path.join(DIR, "_preview")
FONT = "/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf"
INK = (0x3E, 0x35, 0x50)
REFS = ["assets/portraits/xiaoye.webp", "assets/cards/tide-003.webp", "assets/cards/frost-001.webp"]
CENTER = {"landscape": (0.20, 0.80, 0.25, 0.75), "portrait": (0.10, 0.90, 0.28, 0.72)}


def lum_rel(c):
    def ch(v):
        v = v / 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    return 0.2126 * ch(c[0]) + 0.7152 * ch(c[1]) + 0.0722 * ch(c[2])


def contrast(a, b):
    la, lb = sorted((lum_rel(a), lum_rel(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def card_slots(w, h, orient):
    """戰場位置的 6 張卡：中線上下兩排各 3 張"""
    if orient == "landscape":
        cw, ch, gap, dy = 120, 168, 40, 140
    else:
        cw, ch, gap, dy = 200, 280, 50, 200
    slots = []
    for row in (-1, 1):
        cy = h / 2 + row * dy
        for i in (-1, 0, 1):
            cx = w / 2 + i * (cw + gap)
            slots.append((round(cx - cw / 2), round(cy - ch / 2), cw, ch))
    return slots


def main():
    os.makedirs(PREVIEW, exist_ok=True)
    refs = [Image.open(os.path.join(ROOT, r)).convert("RGBA") for r in REFS]
    for path in sorted(glob.glob(os.path.join(DIR, "bg-battle-*.png"))):
        name = os.path.splitext(os.path.basename(path))[0]
        orient = name.split("-")[2]
        im = Image.open(path).convert("RGB")
        w, h = im.size
        L = np.asarray(im.convert("L"), np.float32)
        x0, x1, y0, y1 = CENTER[orient]
        full = L.std()
        center = L[round(h * y0):round(h * y1), round(w * x0):round(w * x1)].std()
        band = round(h * 0.12)
        top, bottom = L[:band].std(), L[h - band:].std()
        webp = os.path.join(DIR, name + ".webp")
        sizes = "png %dB webp %dB" % (os.path.getsize(path), os.path.getsize(webp) if os.path.exists(webp) else -1)
        sim = im.convert("RGBA")
        d = ImageDraw.Draw(sim)
        font = ImageFont.truetype(FONT, 44 if orient == "landscape" else 64)
        worst = 99.0
        arr = np.asarray(im, np.float32)
        for (x, y, cw, ch) in card_slots(w, h, orient):
            d.rounded_rectangle([x, y, x + cw, y + ch], radius=12, fill=(0xB5, 0xAE, 0xBD, 255), outline=(0xFF, 0xFD, 0xF7, 255), width=3)
            # 數字樣本直接疊在背景上，緊貼卡片上方
            tx, ty = x + cw // 2, y - 30
            bgc = arr[max(0, ty - 25):ty + 25, max(0, tx - 25):tx + 25].reshape(-1, 3).mean(axis=0)
            worst = min(worst, contrast(bgc, INK))
            d.text((tx, ty), "5", font=font, fill=INK + (255,), anchor="mm")
        sim.save(os.path.join(PREVIEW, "sim-%s.png" % name))
        print("%s %dx%d %s 亮度std 全圖=%.2f 中央=%.2f 比值=%.2f 上12%%=%.2f 下12%%=%.2f 數字#3E3550對背景最低對比=%.2f" % (
            name, w, h, sizes, full, center, center / full, top, bottom, worst))
        # 與 3 張參考角色圖並排
        th = 540
        thumb = im.resize((round(w * th / h), th), Image.LANCZOS).convert("RGBA")
        side = Image.new("RGBA", (thumb.width + 3 * (th // 2 + 10) + 10, th), (0xF8, 0xF4, 0xEC, 255))
        side.alpha_composite(thumb, (0, 0))
        for i, r in enumerate(refs):
            rr = r.resize((th // 2, th // 2), Image.LANCZOS)
            side.alpha_composite(rr, (thumb.width + 10 + i * (th // 2 + 10), th // 4))
        side.save(os.path.join(PREVIEW, "side-%s.png" % name))


if __name__ == "__main__":
    main()
