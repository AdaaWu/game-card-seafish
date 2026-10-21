#!/usr/bin/env python3
"""檢查四角圖示：尺寸、檔案大小、中央 60% 數字區平均色與描邊色對比，並輸出灰階對照與疊數字預覽

用法: python3 tools/art/check-card-front.py
"""
import glob
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FRONT = os.path.join(ROOT, "assets", "pending", "batch-20261022-card", "card-front")
ICONS = os.path.join(FRONT, "icons")
PREVIEW = os.path.join(FRONT, "_preview")
FONT = "/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf"
STROKE = {"cost": (0x23, 0x4A, 0x6E)}
INK = (0x3E, 0x35, 0x50)
FIT = 0.92


def lum(c):
    def ch(v):
        v = v / 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = (ch(x) for x in c[:3])
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def number_area(im):
    """以圖示外框中心為圓心、外框長邊 60% 為直徑的圓形區域"""
    a = np.asarray(im.convert("RGBA")).astype(np.float32)
    box = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
    r = max(box[2] - box[0], box[3] - box[1]) * 0.3
    yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    m = (xx - cx) ** 2 + (yy - cy) ** 2 <= r * r
    px = a[m]
    alpha = px[:, 3:4] / 255
    over_white = px[:, :3] * alpha + 255 * (1 - alpha)
    return over_white.mean(axis=0), float(over_white.mean(axis=1).std()), float(px[:, 3].min()), float(px[:, 3].mean())


def kind_of(name):
    return name.split("-")[1]


SLICE_SIZE = {"card-frame": (512, 716), "card-artwash": (476, 564), "card-scrim": (476, 112), "card-ribbon": (316, 56),
              "card-textbox": (476, 160), "card-gem": (28, 28), "card-crown": (204, 60), "card-keyword-ring": (52, 52)}


def check_slices():
    """切片 1x 與 2x 尺寸、四種檔案齊全、整卡底框圓角外 alpha"""
    slices = os.path.join(FRONT, "slices")
    bad = 0
    names = sorted({os.path.basename(p).split("@")[0].rsplit(".", 1)[0] for p in glob.glob(os.path.join(slices, "card-*.png"))})
    for name in names:
        fam = next(k for k in sorted(SLICE_SIZE, key=len, reverse=True) if name.startswith(k + "-"))
        w, h = SLICE_SIZE[fam]
        files = [os.path.join(slices, name + e) for e in (".png", ".webp", "@2x.png", "@2x.webp")]
        ok = all(os.path.exists(f) for f in files)
        s1 = Image.open(files[0]).size
        s2 = Image.open(files[2]).size
        ok = ok and s1 == (w, h) and s2 == (w * 2, h * 2)
        extra = ""
        if fam == "card-frame":
            a = np.asarray(Image.open(files[2]).convert("RGBA"))[:, :, 3]
            extra = " 四角alpha=%s" % [int(a[0, 0]), int(a[0, -1]), int(a[-1, 0]), int(a[-1, -1])]
        if not ok:
            bad += 1
        print("SLICE %s 1x=%s 2x=%s 齊全=%s%s" % (name, s1, s2, ok, extra))
    print("SLICE 共 %d 個切片，不符 %d 個" % (len(names), bad))


def main():
    os.makedirs(PREVIEW, exist_ok=True)
    check_slices()
    rows = []
    for path in sorted(glob.glob(os.path.join(ICONS, "icon-*@2x.png"))):
        name = os.path.basename(path).replace("@2x.png", "")
        im = Image.open(path).convert("RGBA")
        one = Image.open(os.path.join(ICONS, name + ".png"))
        sizes = []
        for ext in ("@2x.png", "@2x.webp", ".png", ".webp"):
            f = os.path.join(ICONS, name + ext)
            sizes.append("%s %dB" % (ext, os.path.getsize(f)) if os.path.exists(f) else "%s 缺" % ext)
        mean, std, amin, amean = number_area(im)
        k = kind_of(name)
        stroke = STROKE.get(k, INK)
        c = contrast(mean, stroke)
        corner = max(np.asarray(im)[[0, 0, -1, -1], [0, -1, 0, -1], 3])
        rows.append((name, im, k))
        print("%s 2x=%s 1x=%s %s 四角alpha最大=%d 數字區平均色=#%02X%02X%02X 數字區亮度std=%.1f 數字區alpha最小=%d 平均=%.0f 對描邊#%02X%02X%02X對比=%.2f" % (
            name, im.size, one.size, " ".join(sizes), corner, *[int(x) for x in mean], std, amin, amean, *stroke, c))
    font = ImageFont.truetype(FONT, 64)
    small_font = ImageFont.truetype(FONT, 26)
    groups = [("stat", [r for r in rows if r[2] in ("cost", "attack", "health")]),
              ("faction", [r for r in rows if r[2] == "faction"])]
    for gname, items in groups:
        if not items:
            continue
        cols = 3 if gname == "stat" else 2
        n = len(items)
        rws = (n + cols - 1) // cols
        cell = 160
        sheet = Image.new("RGBA", (cols * cell * 2, rws * cell), (0xF8, 0xF4, 0xEC, 255))
        for i, (name, im, k) in enumerate(items):
            x, y = (i % cols) * cell * 2, (i // cols) * cell
            sheet.alpha_composite(im, (x + 8, y + 8))
            g = im.convert("LA").convert("RGBA")
            sheet.alpha_composite(g, (x + cell + 8, y + 8))
        sheet.save(os.path.join(PREVIEW, "icons-%s-gray.png" % gname))
    stats = [r for r in rows if r[2] in ("cost", "attack", "health")]
    if stats:
        cell = 160
        sheet = Image.new("RGBA", (3 * cell + 3 * 80, len(stats) // 3 * cell), (0x8C, 0x7F, 0x9C, 255))
        for i, (name, im, k) in enumerate(stats):
            x, y = (i % 3) * (cell + 80), (i // 3) * cell
            tile = im.copy()
            d = ImageDraw.Draw(tile)
            box = tile.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
            cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
            d.text((cx, cy), "5", font=font, fill=(255, 255, 255, 255), anchor="mm",
                   stroke_width=5, stroke_fill=STROKE.get(k, INK) + (255,))
            sheet.alpha_composite(tile, (x + 8, y + 8))
            # 手牌 150 px 寬卡面上的實際大小：圖示約 21 px
            hand = tile.resize((21, 21), Image.LANCZOS).resize((63, 63), Image.NEAREST)
            sheet.alpha_composite(hand, (x + cell + 4, y + 48))
        sheet.save(os.path.join(PREVIEW, "icons-digit5.png"))


if __name__ == "__main__":
    main()
