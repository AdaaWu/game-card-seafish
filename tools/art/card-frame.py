#!/usr/bin/env python3
"""程序化產生卡面框架切片，輸出 1x 與 @2x 的 PNG、WebP

用法: python3 tools/art/card-frame.py --variant a|b|c [--seed 20261022] [--out <目錄>]
a 柔和水彩、b 邊緣高光、c 色鉛筆排線，同一變體內所有切片共用同一種筆觸
"""
import argparse
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DEFAULT_OUT = os.path.join(ROOT, "assets", "pending", "batch-20261022-card", "card-front", "slices")
S = 4

FACTION = {
    "leaf": {"main": "#9CC79A", "dark": "#5E9461", "light": "#E3F1DC", "accent": ["#D6E8A8", "#F2B6C6"]},
    "tide": {"main": "#86CCD6", "dark": "#3F8E9F", "light": "#DDF2F4", "accent": ["#F2FAFB", "#9EDBD2"]},
    "frost": {"main": "#C9C6EE", "dark": "#7F78C2", "light": "#F4F3FC", "accent": ["#EEF3FA", "#CFE6F5"]},
    "light": {"main": "#F3DA8C", "dark": "#C9A54A", "light": "#FCF4D9", "accent": ["#FCF4D9", "#F5C9A0"]},
    "neutral": {"main": "#D9CFC5", "dark": "#9C8F82", "light": "#F4EFEA", "accent": ["#F7F1E6", "#CFC4D9"]},
}
RARITY = {"common": "#EDE8E1", "rare": "#6FA8D6", "epic": "#A98BD4", "legendary": "#F0B45A"}
OUTLINE = "#6E5F80"
INK = "#3E3550"


def rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def mix(a, b, t):
    return tuple(round(a[i] * (1 - t) + b[i] * t) for i in range(3))


class Brush:
    """同一變體共用的筆觸：雜訊顆粒、排線、高光強度"""

    def __init__(self, variant, seed):
        self.v = variant
        self.seed = seed
        self.grain_amp = {"a": 0.035, "b": 0.03, "c": 0.04}[variant]
        self.hatch_amp = {"a": 0.0, "b": 0.0, "c": 0.05}[variant]
        self.highlight = {"a": 0.0, "b": 0.7, "c": 0.25}[variant]
        self.blur = {"a": 1.6, "b": 1.0, "c": 0.6}[variant]

    def grain(self, h, w, salt):
        rng = np.random.default_rng(self.seed + salt)
        out = np.zeros((h, w), np.float32)
        for scale, weight in ((2 * S, 0.4), (10 * S, 0.35), (40 * S, 0.25)):
            n = rng.standard_normal((h // scale + 2, w // scale + 2)).astype(np.float32)
            im = Image.fromarray(((n * 40) + 128).clip(0, 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
            out += (np.asarray(im, np.float32) - 128) / 128 * weight
        out /= max(np.abs(out).max(), 1e-3)
        if self.hatch_amp:
            yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
            hatch = (np.sin((xx + yy) / (1.6 * S) * math.pi) > 0.6).astype(np.float32)
            gate = (out > -0.2).astype(np.float32)
            out = out * 0.6 - hatch * gate * 0.8
        return out

    def paint(self, h, w, color, salt, amp=None):
        g = self.grain(h, w, salt)
        a = self.grain_amp if amp is None else amp
        base = np.array(color, np.float32)[None, None]
        arr = base * (1 + g[..., None] * (a + self.hatch_amp))
        return np.clip(arr, 0, 255)


def mask_rrect(size, box, r):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle(box, radius=r, fill=255)
    return m


def outline_of(mask, px):
    """mask 外擴 px 的描邊環"""
    k = max(3, int(px) * 2 + 1)
    grown = mask.filter(ImageFilter.MaxFilter(k if k % 2 else k + 1))
    return np.clip(np.asarray(grown, np.float32) - np.asarray(mask, np.float32), 0, 255)


def compose(size, layers):
    """layers: [(rgb array HxWx3, alpha array HxW 0..255)]，由下往上疊"""
    w, h = size
    out = np.zeros((h, w, 4), np.float32)
    for col, alpha in layers:
        a = (alpha / 255.0)[..., None]
        oa = out[..., 3:4] / 255.0
        na = a + oa * (1 - a)
        out[..., :3] = np.where(na > 0, (col * a + out[..., :3] * oa * (1 - a)) / np.maximum(na, 1e-6), 0)
        out[..., 3:4] = na * 255
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def solid(size, color):
    w, h = size
    return np.broadcast_to(np.array(color, np.float32), (h, w, 3)).copy()


def soften(mask, brush):
    return mask.filter(ImageFilter.GaussianBlur(brush.blur * S / 2))


def finish(img, size1x):
    w, h = size1x
    return img.resize((w * 2, h * 2), Image.LANCZOS), img.resize((w, h), Image.LANCZOS)


# 外框邊上的陣營花紋
def perimeter(w, h, inset, r, step):
    pts = []
    x0, y0, x1, y1 = inset, inset, w - inset, h - inset
    rr = r - inset
    seg = []
    n = 200
    for k in range(n + 1):
        seg.append((x0 + rr + (x1 - x0 - 2 * rr) * k / n, y0))
    for k in range(n + 1):
        a = -math.pi / 2 + math.pi / 2 * k / n
        seg.append((x1 - rr + rr * math.cos(a), y0 + rr + rr * math.sin(a)))
    for k in range(n + 1):
        seg.append((x1, y0 + rr + (y1 - y0 - 2 * rr) * k / n))
    for k in range(n + 1):
        a = math.pi / 2 * k / n
        seg.append((x1 - rr + rr * math.cos(a), y1 - rr + rr * math.sin(a)))
    for k in range(n + 1):
        seg.append((x1 - rr - (x1 - x0 - 2 * rr) * k / n, y1))
    for k in range(n + 1):
        a = math.pi / 2 + math.pi / 2 * k / n
        seg.append((x0 + rr + rr * math.cos(a), y1 - rr + rr * math.sin(a)))
    for k in range(n + 1):
        seg.append((x0, y1 - rr - (y1 - y0 - 2 * rr) * k / n))
    for k in range(n + 1):
        a = math.pi + math.pi / 2 * k / n
        seg.append((x0 + rr + rr * math.cos(a), y0 + rr + rr * math.sin(a)))
    dist = 0.0
    nxt = 0.0
    for i in range(1, len(seg)):
        (ax, ay), (bx, by) = seg[i - 1], seg[i]
        d = math.hypot(bx - ax, by - ay)
        while d > 0 and nxt <= dist + d:
            t = (nxt - dist) / d
            pts.append((ax + (bx - ax) * t, ay + (by - ay) * t, math.atan2(by - ay, bx - ax), nxt))
            nxt += step
        dist += d
    return pts


def motif(d, faction, x, y, ang, s, cols, idx):
    c1 = rgb(cols[0]) + (235,)
    c2 = rgb(cols[1]) + (220,)
    if faction == "leaf":
        nx, ny = -math.sin(ang), math.cos(ang)
        side = 1 if idx % 2 else -1
        lx, ly = x + nx * side * 1.6 * s, y + ny * side * 1.6 * s
        pts = []
        for k in range(16):
            t = math.pi * 2 * k / 16
            px, py = 3.2 * s * math.cos(t), 1.3 * s * math.sin(t)
            rot = ang + side * 0.6
            pts.append((lx + px * math.cos(rot) - py * math.sin(rot), ly + px * math.sin(rot) + py * math.cos(rot)))
        d.polygon(pts, fill=c1)
        if idx % 5 == 0:
            d.ellipse([x - 1.2 * s, y - 1.2 * s, x + 1.2 * s, y + 1.2 * s], fill=c2)
    elif faction == "frost":
        for k in range(3):
            a = ang + math.pi / 3 * k
            dx, dy = 3.2 * s * math.cos(a), 3.2 * s * math.sin(a)
            d.line([(x - dx, y - dy), (x + dx, y + dy)], fill=c1, width=max(1, int(0.9 * s)))
        d.ellipse([x - 0.9 * s, y - 0.9 * s, x + 0.9 * s, y + 0.9 * s], fill=c2)
    elif faction == "light":
        if idx % 2 == 0:
            r1, r2 = 3.4 * s, 1.0 * s
            pts = []
            for k in range(8):
                a = math.pi / 4 * k
                rr = r1 if k % 2 == 0 else r2
                pts.append((x + rr * math.cos(a), y + rr * math.sin(a)))
            d.polygon(pts, fill=c1)
        else:
            d.ellipse([x - 1.1 * s, y - 1.1 * s, x + 1.1 * s, y + 1.1 * s], fill=c2)
    elif faction == "neutral":
        nx, ny = -math.sin(ang), math.cos(ang)
        cx, cy = x + nx * 1.6 * s, y + ny * 1.6 * s
        rr = 3.4 * s
        base = math.degrees(ang) + 180
        d.pieslice([cx - rr, cy - rr, cx + rr, cy + rr], base, base + 180, fill=c1)
        for k in range(1, 4):
            a = math.radians(base + 45 * k)
            d.line([(cx, cy), (cx + rr * math.cos(a), cy + rr * math.sin(a))], fill=c2, width=max(1, int(0.5 * s)))


def card_frame(brush, faction, salt):
    f = FACTION[faction]
    w1, h1 = 512, 716
    W, H = w1 * S, h1 * S
    size = (W, H)
    outer = mask_rrect(size, [0, 0, W - 1, H - 1], 37 * S)
    inner = mask_rrect(size, [12 * S, 12 * S, W - 12 * S, H - 12 * S], 25 * S)
    border_col = brush.paint(H, W, rgb(f["main"]), salt)
    paper_col = brush.paint(H, W, rgb(f["light"]), salt + 1, amp=brush.grain_amp * 0.8)
    oa = np.asarray(outer, np.float32)
    ia = np.asarray(soften(inner, brush), np.float32)
    layers = [(border_col, oa), (paper_col, np.minimum(ia, oa))]
    # 外緣深色細線與內緣淡描邊
    edge = np.clip(oa - np.asarray(outer.filter(ImageFilter.MinFilter(2 * S + 1)), np.float32), 0, 255)
    layers.append((solid(size, rgb(f["dark"])), edge * 0.55))
    inner_edge = outline_of(inner, 1.2 * S)
    layers.append((solid(size, rgb(OUTLINE)), np.asarray(soften(Image.fromarray(inner_edge.astype(np.uint8)), brush), np.float32) * 0.35))
    pat = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(pat)
    if faction == "tide":
        pts = perimeter(W, H, 6 * S, 37 * S, 1.0 * S)
        line = []
        for (x, y, ang, dist) in pts:
            off = math.sin(dist / (9 * S) * math.pi) * 2.2 * S
            line.append((x - math.sin(ang) * off, y + math.cos(ang) * off))
        d.line(line, fill=rgb(f["accent"][0]) + (230,), width=int(1.4 * S), joint="curve")
        for (x, y, ang, dist) in perimeter(W, H, 6 * S, 37 * S, 46 * S):
            d.ellipse([x - 1.1 * S, y - 1.1 * S, x + 1.1 * S, y + 1.1 * S], fill=rgb(f["accent"][1]) + (230,))
    else:
        if faction == "leaf":
            vine = [(x, y) for (x, y, a, dd) in perimeter(W, H, 6 * S, 37 * S, 1.0 * S)]
            d.line(vine, fill=rgb(f["dark"]) + (120,), width=int(0.8 * S))
        step = {"leaf": 14, "frost": 30, "light": 18, "neutral": 26}[faction]
        for i, (x, y, ang, dist) in enumerate(perimeter(W, H, 6 * S, 37 * S, step * S)):
            motif(d, faction, x, y, ang, S, f["accent"], i)
    pa = np.asarray(pat, np.float32)
    band = np.clip(oa - np.asarray(inner, np.float32), 0, 255) / 255
    layers.append((pa[..., :3], pa[..., 3] * band))
    if brush.highlight:
        hl = np.zeros((H, W), np.float32)
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        tl = np.clip(1.4 - (xx / W + yy / H), 0, 1)
        hl = np.clip(np.asarray(outer, np.float32) - np.asarray(outer.filter(ImageFilter.MinFilter(3 * S + 1)), np.float32), 0, 255) * tl
        layers.append((solid(size, (255, 255, 255)), hl * brush.highlight))
    img = compose(size, layers)
    return finish(img, (w1, h1))


def card_artwash(brush, faction, salt):
    f = FACTION[faction]
    w1, h1 = 476, 564
    W, H = w1 * S, h1 * S
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    dx, dy = (xx - W * 0.5) / (W * 0.62), (yy - H * 0.32) / (H * 0.75)
    t = np.clip(np.sqrt(dx ** 2 + dy ** 2), 0, 1) ** 1.4
    hi = np.array(mix(rgb(f["light"]), (255, 253, 247), 0.55), np.float32)
    lo = np.array(mix(rgb(f["main"]), rgb(f["light"]), 0.25), np.float32)
    col = hi[None, None] * (1 - t[..., None]) + lo[None, None] * t[..., None]
    # 水彩暈染：低頻雜訊推動明暗，邊緣略深
    g = brush.grain(H, W, salt)
    blot = np.asarray(Image.fromarray(((g * 60) + 128).clip(0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(14 * S)), np.float32)
    blot = (blot - 128) / 60
    col = col * (1 + g[..., None] * (brush.grain_amp + brush.hatch_amp) + blot[..., None] * 0.04)
    alpha = np.full((H, W), 255, np.float32)
    img = compose((W, H), [(np.clip(col, 0, 255), alpha)])
    return finish(img, (w1, h1))


def card_scrim(brush, salt):
    w1, h1 = 476, 112
    W, H = w1 * S, h1 * S
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    g = brush.grain(H, W, salt)
    wave = np.asarray(Image.fromarray(((brush.grain(16, W, salt + 7)[0] * 60) + 128).clip(0, 255).astype(np.uint8)[None].repeat(1, 0)).resize((W, 1)), np.float32)[0]
    wave = (wave - 128) / 60
    edge = H * (0.92 + 0.06 * wave)[None, :]
    t = np.clip(yy / edge, 0, 1)
    a = (1 - t) ** 1.3 * 0.35 * 255 * (1 + g * 0.12)
    img = compose((W, H), [(solid((W, H), rgb(INK)), np.clip(a, 0, 255))])
    return finish(img, (w1, h1))


def shape_layers(brush, size, shape_mask, fill, salt, stroke=OUTLINE, stroke_px=1.2, stroke_alpha=0.7, white_rim=0.0):
    W, H = size
    layers = []
    if white_rim:
        rim = outline_of(shape_mask, white_rim * S)
        layers.append((solid(size, (255, 255, 255)), rim))
    sm = np.asarray(soften(shape_mask, brush), np.float32)
    layers.append((brush.paint(H, W, fill if isinstance(fill, tuple) else rgb(fill), salt), sm * (fill_alpha_of(fill))))
    ring = np.asarray(shape_mask, np.float32) - np.asarray(shape_mask.filter(ImageFilter.MinFilter(int(stroke_px * S) * 2 + 1)), np.float32)
    layers.append((solid(size, rgb(stroke)), np.clip(ring, 0, 255) * stroke_alpha))
    if brush.highlight:
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        tl = np.clip(1.25 - (xx / W + yy / H), 0, 1)
        inner = np.asarray(shape_mask.filter(ImageFilter.MinFilter(int(stroke_px * S) * 2 + 1)), np.float32)
        hl = np.clip(inner - np.asarray(shape_mask.filter(ImageFilter.MinFilter(int(stroke_px * S + 2 * S) * 2 + 1)), np.float32), 0, 255) * tl
        layers.append((solid(size, (255, 255, 255)), hl * brush.highlight))
    return layers


_FILL_ALPHA = {}


def fill_alpha_of(fill):
    return _FILL_ALPHA.get(fill if isinstance(fill, str) else None, 1.0)


def card_ribbon(brush, salt):
    w1, h1 = 316, 56
    W, H = w1 * S, h1 * S
    m = Image.new("L", (W, H), 0)
    notch = 20 * S
    top, bot = 2 * S, H - 2 * S
    ImageDraw.Draw(m).polygon([(2 * S, top), (W - 2 * S, top), (W - 2 * S - notch, H / 2), (W - 2 * S, bot),
                               (2 * S, bot), (2 * S + notch, H / 2)], fill=255)
    _FILL_ALPHA["#FFFDF7"] = 0.88
    img = compose((W, H), shape_layers(brush, (W, H), m, "#FFFDF7", salt, stroke_alpha=0.45))
    return finish(img, (w1, h1))


def card_textbox(brush, salt):
    w1, h1 = 476, 160
    W, H = w1 * S, h1 * S
    m = mask_rrect((W, H), [1 * S, 1 * S, W - 1 * S, H - 1 * S], 16 * S)
    _FILL_ALPHA["#FBF6EC"] = 0.90
    layers = shape_layers(brush, (W, H), m, "#FBF6EC", salt, stroke_px=0.9, stroke_alpha=0.5)
    # 色鉛筆細邊：沿內側再描一道斷續細線
    pen = Image.new("L", (W, H), 0)
    ImageDraw.Draw(pen).rounded_rectangle([4 * S, 4 * S, W - 4 * S, H - 4 * S], radius=13 * S, outline=255, width=int(0.6 * S))
    g = brush.grain(H, W, salt + 3)
    pa = np.asarray(pen, np.float32) * np.clip(0.55 + g * 0.6, 0, 1)
    layers.append((solid((W, H), rgb(OUTLINE)), pa * (0.35 if brush.v != "c" else 0.5)))
    img = compose((W, H), layers)
    return finish(img, (w1, h1))


def poly_star(cx, cy, r1, r2, n, rot=-math.pi / 2):
    pts = []
    for k in range(n * 2):
        a = rot + math.pi * k / n
        rr = r1 if k % 2 == 0 else r2
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return pts


def card_gem(brush, rarity, salt):
    w1 = h1 = 28
    W, H = w1 * S, h1 * S
    m = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(m)
    c, r = W / 2, 11 * S
    if rarity == "common":
        d.ellipse([c - r, c - r, c + r, c + r], fill=255)
    elif rarity == "rare":
        d.polygon([(c, c - r), (c + r * 0.85, c), (c, c + r), (c - r * 0.85, c)], fill=255)
    elif rarity == "epic":
        d.polygon([(c + r * math.cos(math.pi / 3 * k + math.pi / 6), c + r * math.sin(math.pi / 3 * k + math.pi / 6)) for k in range(6)], fill=255)
    else:
        d.polygon(poly_star(c, c, r * 1.05, r * 0.5, 5), fill=255)
    col = rgb(RARITY[rarity])
    layers = shape_layers(brush, (W, H), m, col, salt, stroke=OUTLINE, stroke_px=0.8, stroke_alpha=0.8, white_rim=1.0)
    # 左上白色小高光
    hl = Image.new("L", (W, H), 0)
    ImageDraw.Draw(hl).ellipse([c - r * 0.55, c - r * 0.6, c - r * 0.1, c - r * 0.2], fill=200)
    hl = hl.filter(ImageFilter.GaussianBlur(S))
    layers.append((solid((W, H), (255, 255, 255)), np.asarray(hl, np.float32) * np.asarray(m, np.float32) / 255))
    img = compose((W, H), layers)
    return finish(img, (w1, h1))


def card_crown(brush, salt):
    w1, h1 = 204, 60
    W, H = w1 * S, h1 * S
    m = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(m)
    base_y = 46 * S
    d.rounded_rectangle([28 * S, 38 * S, W - 28 * S, 54 * S], radius=8 * S, fill=255)
    prongs = [(-66, 24, 8), (-36, 16, 9), (0, 10, 10.5), (36, 16, 9), (66, 24, 8)]
    for dx, ty, rr in prongs:
        x = W / 2 + dx * S
        d.polygon([(x - 13 * S, base_y), (x + 13 * S, base_y), (x + 6 * S, ty * S), (x - 6 * S, ty * S)], fill=255)
        d.ellipse([x - rr * S, ty * S - rr * S, x + rr * S, ty * S + rr * S], fill=255)
    layers = shape_layers(brush, (W, H), m, rgb("#F0B45A"), salt, stroke="#C98A2E", stroke_px=1.4, stroke_alpha=0.95)
    img = compose((W, H), layers)
    return finish(img, (w1, h1))


def card_keyword_ring(brush, salt):
    w1 = h1 = 52
    W, H = w1 * S, h1 * S
    m = Image.new("L", (W, H), 0)
    c, r = W / 2, 24.5 * S
    ImageDraw.Draw(m).ellipse([c - r, c - r, c + r, c + r], fill=255)
    layers = shape_layers(brush, (W, H), m, rgb("#FFFDF7"), salt, stroke_px=0.6, stroke_alpha=0.25)
    # 中央 60% 留空，只在外圈 62% 到 82% 半徑畫一圈淡色細環
    deco = Image.new("L", (W, H), 0)
    rr = r * 0.74
    ImageDraw.Draw(deco).ellipse([c - rr, c - rr, c + rr, c + rr], outline=255, width=int(0.7 * S))
    layers.append((solid((W, H), rgb(OUTLINE)), np.asarray(deco, np.float32) * 0.22))
    img = compose((W, H), layers)
    return finish(img, (w1, h1))


def save(pair, out, name):
    big, small = pair
    for im, suffix in ((big, "@2x"), (small, "")):
        im.save(os.path.join(out, name + suffix + ".png"), optimize=True)
        im.save(os.path.join(out, name + suffix + ".webp"), "WEBP", quality=85, method=6, exact=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--variant", required=True, choices=["a", "b", "c"])
    ap.add_argument("--seed", type=int, default=20261022)
    ap.add_argument("--out", default=DEFAULT_OUT)
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    v = args.variant
    brush = Brush(v, args.seed + ord(v))
    names = []
    for i, fac in enumerate(FACTION):
        save(card_frame(brush, fac, 10 + i), args.out, "card-frame-%s-%s" % (fac, v))
        save(card_artwash(brush, fac, 20 + i), args.out, "card-artwash-%s-%s" % (fac, v))
        names += ["card-frame-%s-%s" % (fac, v), "card-artwash-%s-%s" % (fac, v)]
    save(card_scrim(brush, 30), args.out, "card-scrim-" + v)
    save(card_ribbon(brush, 31), args.out, "card-ribbon-" + v)
    save(card_textbox(brush, 32), args.out, "card-textbox-" + v)
    for i, rar in enumerate(RARITY):
        save(card_gem(brush, rar, 40 + i), args.out, "card-gem-%s-%s" % (rar, v))
    save(card_crown(brush, 50), args.out, "card-crown-" + v)
    save(card_keyword_ring(brush, 51), args.out, "card-keyword-ring-" + v)
    print("變體 %s 完成，種子 %d -> %s" % (v, args.seed + ord(v), args.out))


if __name__ == "__main__":
    main()
