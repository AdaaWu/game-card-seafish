#!/usr/bin/env python3
"""把 4x5 貼圖合集依透明連通區塊切成獨立貼圖

用法: python3 tools/slice-stickers.py [role1.png role2.png] [--out assets/stickers]
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

ROWS, COLS = 4, 5
CORE_ALPHA = 128   # 貼紙本體（白邊以內）的 alpha 門檻
SHADOW_PAD = 8     # 保留白邊外的淡陰影寬度（px）
MARGIN = 4         # 裁切後保留的透明邊


def row_bands(mask):
    """依整列無不透明像素的空白帶切出 ROWS 個橫向區段"""
    filled = mask.sum(1) > 0
    bands, start = [], None
    for y, v in enumerate(filled):
        if v and start is None:
            start = y
        elif not v and start is not None:
            bands.append((start, y))
            start = None
    if start is not None:
        bands.append((start, len(filled)))
    bands = [b for b in bands if b[1] - b[0] > 40]
    if len(bands) != ROWS:
        raise RuntimeError("偵測到 %d 列，預期 %d 列" % (len(bands), ROWS))
    return bands


def slice_sheet(path, out_dir, prefix):
    rgba = np.array(Image.open(path).convert("RGBA"))
    alpha = rgba[:, :, 3]
    core = ndimage.binary_fill_holes(ndimage.binary_closing(alpha > CORE_ALPHA, iterations=2))
    count = 0
    for y0, y1 in row_bands(core):
        labels, n = ndimage.label(core[y0:y1])
        sizes = ndimage.sum(np.ones_like(labels), labels, range(1, n + 1))
        order = np.argsort(sizes)[::-1]
        main = [int(i) + 1 for i in order[:COLS]]
        if len(main) < COLS:
            raise RuntimeError("%s 第 %d 列只找到 %d 個區塊" % (path, count // COLS + 1, len(main)))
        centers = sorted((ndimage.center_of_mass(labels == l)[1], l) for l in main)
        main = [l for _, l in centers]
        cuts = [(centers[i][0] + centers[i + 1][0]) / 2 for i in range(COLS - 1)]
        # 碎塊（效果線、彩帶）依重心落在哪一欄併入該欄主區塊
        owner = np.full(n + 1, -1)
        for i, l in enumerate(main):
            owner[l] = i
        for l in range(1, n + 1):
            if owner[l] < 0:
                cx = ndimage.center_of_mass(labels == l)[1]
                owner[l] = int(np.searchsorted(cuts, cx))
        assigned = owner[labels]
        nearest = np.argmin(np.stack(
            [ndimage.distance_transform_edt(assigned != i) for i in range(COLS)]), axis=0)
        for i, l in enumerate(main):
            region = assigned == i
            region = ndimage.binary_dilation(region, iterations=SHADOW_PAD)
            region &= nearest == i
            full = np.zeros(alpha.shape, bool)
            full[y0:y1] = region
            ys, xs = np.where(full & (alpha > 0))
            top, bottom = max(ys.min() - MARGIN, 0), min(ys.max() + MARGIN + 1, alpha.shape[0])
            left, right = max(xs.min() - MARGIN, 0), min(xs.max() + MARGIN + 1, alpha.shape[1])
            tile = rgba[top:bottom, left:right].copy()
            tile[:, :, 3] = np.where(full[top:bottom, left:right], tile[:, :, 3], 0)
            count += 1
            name = "%s-%02d.png" % (prefix, count)
            Image.fromarray(tile).save(os.path.join(out_dir, name), optimize=True)
    return count


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sheets", nargs="*", default=["role1.png", "role2.png"])
    ap.add_argument("--out", default="assets/stickers")
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    total = 0
    for sheet in args.sheets:
        prefix = os.path.splitext(os.path.basename(sheet))[0]
        n = slice_sheet(sheet, args.out, prefix)
        print("%s -> %d 張" % (sheet, n))
        total += n
    print("共 %d 張，輸出到 %s" % (total, args.out))
    return 0 if total == len(args.sheets) * ROWS * COLS else 1


if __name__ == "__main__":
    sys.exit(main())
