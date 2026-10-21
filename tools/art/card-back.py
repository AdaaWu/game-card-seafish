#!/usr/bin/env python3
"""程序化產生卡背 card-back，輸出 2x 與 1x 的 PNG、WebP

用法: python3 tools/art/card-back.py --variant a|b|c [--seed 20261022] [--out <目錄>]
a 珍珠紋章、b 扇貝紋章、c 星芒放射紋章，整張點對稱
"""
import argparse
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DEFAULT_OUT = os.path.join(ROOT, "assets", "pending", "batch-20261022-card", "card-back")
W, H = 1024, 1432
SS = 2
RADIUS = 74
INSET_X, INSET_Y = 51, 72
FRAME_W = 6
OUTLINE_W = 3
CORE_R = 240
RING_W = 7

BASE_IN = (0x9B, 0x7F, 0xC0)
BASE_OUT = (0x6E, 0x4E, 0x9A)
CREAM = (0xF8, 0xF4, 0xEC)
WHITE = (0xFF, 0xFF, 0xFF)
OUTLINE = (0x6E, 0x5F, 0x80)
PEARL_BASE = (0xF7, 0xF1, 0xE6)
RINGS = [(0x9C, 0xC4, 0x8A), (0x9C, 0xCB, 0xE6), (0xB8, 0xC2, 0xE8), (0xF6, 0xDE, 0x8D)]


def hexa(c, a=255):
    return c + (a,)


def base_layer(rng):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    nx = (xx - W / 2) / (W / 2)
    ny = (yy - H / 2) / (H / 2)
    t = np.clip(np.sqrt(nx ** 2 + ny ** 2) / math.sqrt(2), 0, 1) ** 1.3
    inn, out = np.array(BASE_IN, np.float32), np.array(BASE_OUT, np.float32)
    rgb = inn[None, None] * (1 - t[..., None]) + out[None, None] * t[..., None]
    # 水彩顆粒：多尺度模糊雜訊，明度變化控制在正負 6% 內
    grain = np.zeros((H, W), np.float32)
    for scale, weight in ((3, 0.35), (14, 0.4), (60, 0.25)):
        n = rng.standard_normal((H // scale + 2, W // scale + 2)).astype(np.float32)
        img = Image.fromarray(((n * 40) + 128).clip(0, 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)
        g = (np.asarray(img, np.float32) - 128) / 128
        grain += g * weight
    grain = grain / max(np.abs(grain).max(), 1e-3)
    rgb = rgb * (1 + grain[..., None] * 0.06)
    return np.clip(rgb, 0, 255)


def field_pattern(variant, size):
    """內框以內的低對比底紋"""
    w, h = size
    lay = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    cx, cy = w / 2, h / 2
    if variant == "c":
        for i in range(32):
            a = math.pi * 2 * i / 32
            r0, r1 = 300 * SS, 900 * SS
            d.line([(cx + r0 * math.cos(a), cy + r0 * math.sin(a)), (cx + r1 * math.cos(a), cy + r1 * math.sin(a))],
                   fill=hexa(CREAM, 22), width=3 * SS)
    else:
        step = 34 if variant == "a" else 46
        for r in range(300, 900, step):
            rr = r * SS
            d.ellipse([cx - rr, cy - rr * 1.12, cx + rr, cy + rr * 1.12], outline=hexa(CREAM, 20), width=2 * SS)
    if variant == "b":
        # 扇貝變體四角內側的小扇形點綴
        for sx, sy in ((1, 1), (-1, -1), (1, -1), (-1, 1)):
            px, py = cx + sx * 330 * SS, cy + sy * 520 * SS
            for k in range(3):
                rr = (26 + k * 16) * SS
                d.arc([px - rr, py - rr, px + rr, py + rr], 0, 360, fill=hexa(CREAM, 34), width=2 * SS)
    return lay


def emblem_pearl(d, cx, cy):
    r = CORE_R * SS
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=hexa(PEARL_BASE), outline=hexa(OUTLINE), width=OUTLINE_W * SS)
    rr = 196 * SS
    d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], outline=hexa(OUTLINE, 150), width=2 * SS)
    for i in range(16):
        a = math.pi * 2 * i / 16
        px, py = cx + 218 * SS * math.cos(a), cy + 218 * SS * math.sin(a)
        pr = 13 * SS
        d.ellipse([px - pr, py - pr, px + pr, py + pr], fill=hexa(WHITE), outline=hexa(OUTLINE), width=2 * SS)
    for k, (rad, col) in enumerate(((120, CREAM), (96, WHITE))):
        q = rad * SS
        d.ellipse([cx - q, cy - q, cx + q, cy + q], fill=hexa(col), outline=hexa(OUTLINE) if k == 0 else None,
                  width=OUTLINE_W * SS)


def emblem_scallop(d, cx, cy):
    r = CORE_R * SS
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=hexa(CREAM), outline=hexa(OUTLINE), width=OUTLINE_W * SS)
    lobes = 16
    pts = []
    for i in range(lobes * 24):
        a = math.pi * 2 * i / (lobes * 24)
        bump = abs(math.sin(a * lobes / 2))
        rad = (178 + 26 * bump) * SS
        pts.append((cx + rad * math.cos(a), cy + rad * math.sin(a)))
    d.polygon(pts, fill=hexa(WHITE), outline=hexa(OUTLINE))
    d.line(pts + [pts[0]], fill=hexa(OUTLINE), width=OUTLINE_W * SS)
    for i in range(lobes):
        a = math.pi * 2 * (i + 0.5) / lobes
        d.line([(cx + 52 * SS * math.cos(a), cy + 52 * SS * math.sin(a)),
                (cx + 196 * SS * math.cos(a), cy + 196 * SS * math.sin(a))], fill=hexa(OUTLINE, 170), width=2 * SS)
    q = 52 * SS
    d.ellipse([cx - q, cy - q, cx + q, cy + q], fill=hexa(CREAM), outline=hexa(OUTLINE), width=OUTLINE_W * SS)


def emblem_star(d, cx, cy):
    r = CORE_R * SS
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=hexa(CREAM), outline=hexa(OUTLINE), width=OUTLINE_W * SS)
    pts = []
    n = 16
    for i in range(n * 2):
        a = math.pi * 2 * i / (n * 2) - math.pi / 2
        if i % 2:
            rad = 92
        else:
            rad = 214 if (i // 2) % 2 == 0 else 160
        pts.append((cx + rad * SS * math.cos(a), cy + rad * SS * math.sin(a)))
    d.polygon(pts, fill=hexa(WHITE))
    d.line(pts + [pts[0]], fill=hexa(OUTLINE), width=OUTLINE_W * SS, joint="curve")
    q = 64 * SS
    d.ellipse([cx - q, cy - q, cx + q, cy + q], fill=hexa(CREAM), outline=hexa(OUTLINE), width=OUTLINE_W * SS)


EMBLEMS = {"a": emblem_pearl, "b": emblem_scallop, "c": emblem_star}


def build(variant, seed):
    rng = np.random.default_rng(seed)
    base = base_layer(rng)
    img = Image.fromarray(base.astype(np.uint8)).convert("RGBA")
    big = (W * SS, H * SS)

    # 底紋只畫在內框內，外圍 5% 只留底色與內框
    pattern = field_pattern(variant, big)
    inner = Image.new("L", big, 0)
    ImageDraw.Draw(inner).rounded_rectangle(
        [(INSET_X + FRAME_W) * SS, (INSET_Y + FRAME_W) * SS, (W - INSET_X - FRAME_W) * SS, (H - INSET_Y - FRAME_W) * SS],
        radius=(RADIUS - INSET_X) * SS, fill=255)
    pa = np.asarray(pattern.getchannel("A"), np.float32) * (np.asarray(inner, np.float32) / 255)
    pattern.putalpha(Image.fromarray(pa.astype(np.uint8)))

    top = Image.new("RGBA", big, (0, 0, 0, 0))
    d = ImageDraw.Draw(top)
    cx, cy = W * SS / 2, H * SS / 2
    # 同心四陣營色環，由內到外等寬
    for k in range(len(RINGS) - 1, -1, -1):
        r = (CORE_R + RING_W * (k + 1)) * SS
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=hexa(RINGS[k]))
    ro = (CORE_R + RING_W * 4 + OUTLINE_W) * SS
    d.ellipse([cx - ro, cy - ro, cx + ro, cy + ro], outline=hexa(OUTLINE), width=OUTLINE_W * SS)
    EMBLEMS[variant](d, cx, cy)
    # 紋章輕微水彩暈染：外圍一圈柔和亮邊
    glow = Image.new("RGBA", big, (0, 0, 0, 0))
    gr = (CORE_R + RING_W * 4 + 18) * SS
    ImageDraw.Draw(glow).ellipse([cx - gr, cy - gr, cx + gr, cy + gr], fill=hexa(CREAM, 40))
    glow = glow.filter(ImageFilter.GaussianBlur(16 * SS))

    frame = Image.new("RGBA", big, (0, 0, 0, 0))
    ImageDraw.Draw(frame).rounded_rectangle(
        [INSET_X * SS, INSET_Y * SS, (W - INSET_X) * SS, (H - INSET_Y) * SS],
        radius=(RADIUS - INSET_X + FRAME_W) * SS, outline=hexa(CREAM), width=FRAME_W * SS)

    over = Image.new("RGBA", big, (0, 0, 0, 0))
    for layer in (pattern, glow, top, frame):
        over.alpha_composite(layer)
    over = over.resize((W, H), Image.LANCZOS)
    img.alpha_composite(over)

    # 下半張改為上半張旋轉 180 度，保證整張點對稱
    arr = np.array(img)
    half = H // 2
    arr[half:] = np.rot90(arr[:half], 2)
    img = Image.fromarray(arr)

    mask = Image.new("L", big, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, W * SS - 1, H * SS - 1], radius=RADIUS * SS, fill=255)
    mask = mask.resize((W, H), Image.LANCZOS)
    m = np.minimum(np.asarray(mask), np.rot90(np.asarray(mask), 2))
    img.putalpha(Image.fromarray(m))
    band_pattern = int((pa[: INSET_Y * SS] > 0).sum() + (pa[:, : INSET_X * SS] > 0).sum())
    return img, band_pattern


def save(img, out_dir, name):
    img.save(os.path.join(out_dir, name + ".png"), optimize=True)
    img.save(os.path.join(out_dir, name + ".webp"), "WEBP", quality=85, method=6, exact=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--variant", required=True, choices=list(EMBLEMS))
    ap.add_argument("--seed", type=int, default=20261022)
    ap.add_argument("--out", default=DEFAULT_OUT)
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    img, band_pattern = build(args.variant, args.seed)
    name = "card-back-%s" % args.variant
    save(img, args.out, name + "@2x")
    save(img.resize((W // 2, H // 2), Image.LANCZOS), args.out, name)
    print("%s seed=%d 安全邊界內底紋像素=%d -> %s" % (name, args.seed, band_pattern, args.out))


if __name__ == "__main__":
    main()
