#!/usr/bin/env python3
"""純色底去背：從四邊洪水填充背景色，邊緣做 alpha 漸層與去色溢

用法: python3 tools/remove-bg.py <in.png> [out.png] [--tol 60] [--soft 40] [--fit 0.7 --size 1024]
未給 out 時覆寫原檔；背景色取四角中位數
已有透明角落的圖略過去背
--fit 給定時把主體等比縮放置中到 size 畫布，長邊佔 fit 比例
"""
import argparse
import sys

import numpy as np
from PIL import Image
from scipy import ndimage


def remove_bg(img, tol, soft):
    rgba = np.array(img.convert("RGBA")).astype(np.float32)
    rgb, alpha = rgba[:, :, :3], rgba[:, :, 3]
    h, w = alpha.shape
    corners = np.array([rgb[0, 0], rgb[0, w - 1], rgb[h - 1, 0], rgb[h - 1, w - 1]])
    bg = np.median(corners, axis=0)
    dist = np.sqrt(((rgb - bg) ** 2).sum(2))

    # 只移除與邊框相連的背景，角色內部同色區不受影響
    candidate = dist < tol + soft
    labels, _ = ndimage.label(candidate)
    border = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    border = border[border > 0]
    connected = np.isin(labels, border)

    ramp = np.clip((dist - tol) / max(soft, 1), 0, 1)
    new_alpha = np.where(connected, ramp * 255, 255)
    new_alpha = np.minimum(new_alpha, alpha)

    # 半透明邊緣去掉背景色溢
    a = new_alpha[:, :, None] / 255.0
    edge = connected[:, :, None] & (a > 0) & (a < 1)
    unmixed = np.clip((rgb - bg * (1 - a)) / np.maximum(a, 1e-3), 0, 255)
    rgb = np.where(edge, unmixed, rgb)

    # 綠底時把貼邊幾圈像素的綠色壓回 r、b 的上限
    if bg[1] > bg[0] + 80 and bg[1] > bg[2] + 80:
        band = ndimage.binary_dilation(new_alpha == 0, iterations=4)
        g_cap = np.maximum(rgb[:, :, 0], rgb[:, :, 2])
        rgb[:, :, 1] = np.where(band, np.minimum(rgb[:, :, 1], g_cap), rgb[:, :, 1])

    out = np.dstack([rgb, new_alpha]).astype(np.uint8)
    return Image.fromarray(out), bg


def has_transparent_corners(img):
    a = np.array(img.convert("RGBA"))[:, :, 3]
    return max(a[0, 0], a[0, -1], a[-1, 0], a[-1, -1]) < 10


def fit_canvas(img, size, ratio):
    img = img.convert("RGBA")
    box = img.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    if box:
        img = img.crop(box)
    scale = size * ratio / max(img.size)
    img = img.resize((max(1, round(img.width * scale)), max(1, round(img.height * scale))), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(img, ((size - img.width) // 2, (size - img.height) // 2))
    return canvas


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst", nargs="?")
    ap.add_argument("--tol", type=float, default=60, help="此距離內視為背景")
    ap.add_argument("--soft", type=float, default=40, help="邊緣漸層寬度")
    ap.add_argument("--fit", type=float, help="主體長邊佔畫布比例，例如 0.7")
    ap.add_argument("--size", type=int, default=1024, help="--fit 的輸出邊長")
    args = ap.parse_args()
    img = Image.open(args.src)
    dst = args.dst or args.src
    if has_transparent_corners(img):
        out = img.convert("RGBA")
        print("已是透明背景，略過去背")
    else:
        out, bg = remove_bg(img, args.tol, args.soft)
        clear = (np.array(out)[:, :, 3] == 0).mean()
        print("背景色 %s，透明比例 %.1f%%" % (bg.astype(int).tolist(), clear * 100))
    if args.fit:
        out = fit_canvas(out, args.size, args.fit)
    out.save(dst, optimize=True)
    print("-> %s" % dst)
    return 0


if __name__ == "__main__":
    sys.exit(main())
