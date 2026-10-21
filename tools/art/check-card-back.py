#!/usr/bin/env python3
"""檢查卡背輸出：尺寸、檔案大小、四角 alpha、旋轉 180 度差、安全邊界、色環面積，並輸出縮圖

用法: python3 tools/art/check-card-back.py [目錄]
"""
import glob
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DIR = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "assets", "pending", "batch-20261022-card", "card-back")
RINGS = {"leaf": (0x9C, 0xC4, 0x8A), "tide": (0x9C, 0xCB, 0xE6), "frost": (0xB8, 0xC2, 0xE8), "light": (0xF6, 0xDE, 0x8D)}


def luma(rgb):
    return rgb[..., 0] * 0.299 + rgb[..., 1] * 0.587 + rgb[..., 2] * 0.114


def check(path):
    im = Image.open(path).convert("RGBA")
    a = np.asarray(im).astype(np.float32)
    w, h = im.size
    corners = [int(a[0, 0, 3]), int(a[0, -1, 3]), int(a[-1, 0, 3]), int(a[-1, -1, 3])]
    rot = np.rot90(a, 2)
    diff = np.abs(a - rot).mean(axis=(0, 1))
    # 安全邊界帶：上下各 5%、左右各 5%，扣掉圓角與內框線附近 6 px
    bx, by = round(w * 0.05), round(h * 0.05)
    lw = max(2, round(w * 6 / 1024)) + 2
    band = np.zeros((h, w), bool)
    band[: by - lw] = True
    band[h - by + lw:] = True
    band[:, : bx - lw] = True
    band[:, w - bx + lw:] = True
    band &= a[..., 3] == 255
    lum = luma(a[..., :3])
    band_std = float(lum[band].std())
    center = lum[h // 2 - h // 10: h // 2 + h // 10, w // 2 - w // 10: w // 2 + w // 10]
    rings = {}
    for k, c in RINGS.items():
        rings[k] = int((np.abs(a[..., :3] - np.array(c, np.float32)).max(axis=2) < 10).sum())
    vals = list(rings.values())
    ratio = max(vals) / max(min(vals), 1)
    return {
        "file": os.path.basename(path), "size": (w, h), "bytes": os.path.getsize(path),
        "corners": corners, "rot_diff": [round(float(x), 3) for x in diff], "rot_mean": round(float(diff[:3].mean()), 3),
        "band_std": round(band_std, 2), "band_mean": round(float(lum[band].mean()), 1),
        "rings": rings, "ring_ratio": round(ratio, 3), "center_std": round(float(center.std()), 2),
    }


def main():
    thumbs = os.path.join(DIR, "_thumbs")
    os.makedirs(thumbs, exist_ok=True)
    for path in sorted(glob.glob(os.path.join(DIR, "card-back-*.*"))):
        if not path.endswith((".png", ".webp")):
            continue
        r = check(path)
        print("%s %dx%d %d bytes 四角alpha=%s 旋轉差RGBA=%s 平均RGB=%.3f 邊界帶亮度std=%.2f 色環像素=%s 最大最小比=%.3f" % (
            r["file"], r["size"][0], r["size"][1], r["bytes"], r["corners"], r["rot_diff"], r["rot_mean"],
            r["band_std"], r["rings"], r["ring_ratio"]))
        if path.endswith("@2x.png"):
            im = Image.open(path).convert("RGBA")
            stem = os.path.basename(path).replace("@2x.png", "")
            for tw, th in ((52, 72), (44, 60)):
                im.resize((tw, th), Image.LANCZOS).save(os.path.join(thumbs, "%s-%dx%d.png" % (stem, tw, th)))


if __name__ == "__main__":
    main()
