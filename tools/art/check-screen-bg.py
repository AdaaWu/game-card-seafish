#!/usr/bin/env python3
"""檢查畫面背景：尺寸、檔案大小、中央區與標題區的亮度標準差、上下 12% 的細節與波光，以及與對戰背景 b 的色調差

用法: python3 tools/art/check-screen-bg.py [--json out.json] [檔案 png ...]
不帶檔案時檢查 batch-20261023-screens 全部變體，並以對戰背景 b 為基準列在最前
"""
import glob
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BATCH = os.path.join(ROOT, "assets", "pending", "batch-20261023-screens")
BATTLE = os.path.join(ROOT, "assets", "pending", "batch-20261022-card", "battle-bg")
# 中央區 (x0, x1, y0, y1)
CENTER = {
    "landscape": (0.20, 0.80, 0.25, 0.75),
    "portrait": (0.10, 0.90, 0.28, 0.72),
}
CENTER_BY_SCREEN = {
    "story": {"landscape": (0.15, 0.85, 0.20, 0.80), "portrait": (0.10, 0.90, 0.18, 0.82)},
    "deck": {"landscape": (0.15, 0.85, 0.18, 0.85), "portrait": (0.08, 0.92, 0.15, 0.85)},
}
TITLE = {"landscape": (0.25, 0.75, 0.12, 0.45), "portrait": (0.10, 0.90, 0.12, 0.40)}
GLINT_DELTA = 12


def region(L, box):
    h, w = L.shape
    x0, x1, y0, y1 = box
    return L[round(h * y0):round(h * y1), round(w * x0):round(w * x1)]


def measure(path):
    name = os.path.splitext(os.path.basename(path))[0]
    parts = name.split("-")
    screen, orient = parts[1], parts[2]
    im = Image.open(path).convert("RGB")
    w, h = im.size
    gray = im.convert("L")
    L = np.asarray(gray, np.float32)
    # 波光：比局部模糊亮 GLINT_DELTA 以上的小亮點
    blur = np.asarray(gray.filter(ImageFilter.GaussianBlur(12)), np.float32)
    glint = (L - blur) > GLINT_DELTA
    band = round(h * 0.12)
    box = CENTER_BY_SCREEN.get(screen, CENTER)[orient]
    hsv = np.asarray(im.convert("HSV"), np.float32)
    rgb = np.asarray(im, np.float32)
    webp = os.path.splitext(path)[0] + ".webp"
    r = {
        "name": name, "screen": screen, "orient": orient, "size": "%dx%d" % (w, h),
        "webp_kb": round(os.path.getsize(webp) / 1024) if os.path.exists(webp) else -1,
        "full": float(L.std()),
        "center": float(region(L, box).std()),
        "top": float(L[:band].std()), "bottom": float(L[h - band:].std()),
        "glint_top": float(glint[:band].mean() * 100), "glint_bottom": float(glint[h - band:].mean() * 100),
        # 上 12% 中段 x 25% 到 75%，水面波光最容易出現的位置
        "glint_top_mid": float(glint[:band, round(w * 0.25):round(w * 0.75)].mean() * 100),
        "mean_l": float(L.mean()), "sat": float(hsv[..., 1].mean()),
        "warm": float((rgb[..., 0] - rgb[..., 2]).mean()),
    }
    r["ratio"] = r["center"] / r["full"]
    if screen == "title":
        r["title"] = float(region(L, TITLE[orient]).std())
        r["title_ratio"] = r["title"] / r["full"]
    return r


def main():
    argv = sys.argv[1:]
    out = None
    if "--json" in argv:
        i = argv.index("--json")
        out = argv[i + 1]
        argv = argv[:i] + argv[i + 2:]
    paths = argv or ([os.path.join(BATTLE, "bg-battle-landscape-b.png"), os.path.join(BATTLE, "bg-battle-portrait-b.png")]
                     + sorted(p for p in glob.glob(os.path.join(BATCH, "*", "bg-*-?.png")) if "/_raw/" not in p))
    rows = [measure(p) for p in paths]
    base = {r["orient"]: r for r in rows if r["screen"] == "battle"}
    for r in rows:
        b = base.get(r["orient"])
        d = ""
        if b:
            d = " 色差 亮度%+.1f 飽和%+.1f 冷暖%+.1f" % (r["mean_l"] - b["mean_l"], r["sat"] - b["sat"], r["warm"] - b["warm"])
        t = " 標題區=%.2f(%.2f)" % (r["title"], r["title_ratio"]) if "title" in r else ""
        print("%-24s %s webp%5dKB std 全=%.1f 中央=%.1f 比=%.2f%s 上12%%=%.1f 下12%%=%.1f 波光 上=%.2f%%(中段%.2f%%) 下=%.2f%%%s" % (
            r["name"], r["size"], r["webp_kb"], r["full"], r["center"], r["ratio"], t,
            r["top"], r["bottom"], r["glint_top"], r["glint_top_mid"], r["glint_bottom"], d))
    if out:
        with open(out, "w") as f:
            json.dump(rows, f, indent=2)


if __name__ == "__main__":
    main()
