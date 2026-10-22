#!/usr/bin/env python3
"""batch-20261023-ui 後製與程序化切片

用法: python3 tools/art/ui-kit.py [--only 前綴1,前綴2]
- Codex 原圖（_raw）：裁透明邊、校色、縮成 1x 與 @2x，按鈕另外導出 hover、pressed、disabled
- 程序化切片：滑桿、開關、地圖路徑、分隔線拼接、場上生物框與狀態層
輸出 PNG 與 WebP（品質 85，含 alpha）
"""
import argparse
import importlib.util
import math
import os

import numpy as np
from scipy import ndimage
from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BATCH = os.path.join(ROOT, "assets", "pending", "batch-20261023-ui")
RAW = os.path.join(BATCH, "_raw")

_spec = importlib.util.spec_from_file_location("card_frame", os.path.join(ROOT, "tools", "art", "card-frame.py"))
cf = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(cf)
S = cf.S
rgb = cf.rgb

OUTLINE = "#6E5F80"
PRIMARY = "#7A64B0"
DANGER = "#B04A6A"
DISABLED_MIX = "#E4DFEA"

# Codex 原圖：名稱 → (群組, 1x 寬, 1x 高, 九宮格左右保留比例或 None, 目標主色或 None)
CODEX = {
    "btn-primary": ("buttons", 240, 64, 0.5, PRIMARY),
    "btn-secondary": ("buttons", 240, 64, 0.5, None),
    "btn-danger": ("buttons", 240, 64, 0.5, DANGER),
    "btn-icon": ("buttons", 64, 64, None, None),
    "menu-item": ("buttons", 440, 96, 0.9, None),
    "panel": ("panels", 480, 480, None, None),
    "nameplate": ("labels", 200, 52, 0.5, None),
    "ribbon": ("labels", 400, 84, 0.9, None),
    "title-underlay-lg": ("title", 560, 96, 1.2, None),
    "title-underlay-sm": ("title", 280, 60, 0.5, None),
    "node-locked": ("map", 112, 112, None, None),
    "node-available": ("map", 112, 112, None, None),
    "node-cleared": ("map", 112, 112, None, None),
    "node-boss": ("map", 136, 136, None, None),
    "lock": ("icons", 32, 32, None, None),
    "knob": ("settings", 32, 32, None, None),
    "ov-bubble": ("minion", 288, 352, None, None),
    "ov-frozen": ("minion", 288, 352, None, None),
    "ov-stealth": ("minion", 288, 352, None, None),
}
BUTTONS = {"btn-primary", "btn-secondary", "btn-danger", "btn-icon", "menu-item"}
STRETCH = {"ov-frozen", "ov-stealth"}
FACTIONS = ["leaf", "tide", "frost", "light", "neutral"]


def grow(mask, px):
    """mask 外擴 px（距離轉換，比 MaxFilter 快）"""
    m = np.asarray(mask, np.float32) > 127
    dist = ndimage.distance_transform_edt(~m)
    return Image.fromarray(((dist <= px) * 255).astype(np.uint8))


def outline(mask, px):
    return np.clip(np.asarray(grow(mask, px), np.float32) - np.asarray(mask, np.float32), 0, 255)


def save(img2x, group, name, size1x=None):
    out = os.path.join(BATCH, group)
    os.makedirs(out, exist_ok=True)
    img2x = img2x.convert("RGBA")
    if size1x is None:
        size1x = (img2x.width // 2, img2x.height // 2)
    img1x = img2x.resize(size1x, Image.LANCZOS)
    for im, suf in ((img2x, "@2x"), (img1x, "")):
        im.save(os.path.join(out, f"{name}{suf}.png"), optimize=True)
        im.save(os.path.join(out, f"{name}{suf}.webp"), "WEBP", quality=85, method=6, exact=True)


def crop_alpha(im, thr=10):
    a = im.getchannel("A").point(lambda v: 255 if v > thr else 0)
    box = a.getbbox()
    return im.crop(box) if box else im


def nine_resize(im, W, H, cap_ratio):
    """先等比縮到高度 H，再保留左右端蓋、只拉伸中段到寬度 W"""
    w = round(im.width * H / im.height)
    im = im.resize((w, H), Image.LANCZOS)
    cap = min(round(H * cap_ratio), w // 2 - 2, W // 2 - 2)
    if w == W:
        return im
    mid_src = im.crop((cap, 0, w - cap, H))
    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    out.paste(im.crop((0, 0, cap, H)), (0, 0))
    out.paste(mid_src.resize((W - 2 * cap, H), Image.LANCZOS), (cap, 0))
    out.paste(im.crop((w - cap, 0, w, H)), (W - cap, 0))
    return out


def fit_center(im, W, H, margin=0.0):
    s = min(W * (1 - margin) / im.width, H * (1 - margin) / im.height)
    im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    out.alpha_composite(im, ((W - im.width) // 2, (H - im.height) // 2))
    return out


def recolor_fill(im, target):
    """把飽和度高的填色區平均色校到目標色，白邊與描邊不動"""
    arr = np.asarray(im, np.float32)
    rgbv, a = arr[..., :3], arr[..., 3]
    mx, mn = rgbv.max(2), rgbv.min(2)
    sat = (mx - mn) / np.maximum(mx, 1)
    mask = (sat > 0.18) & (a > 200)
    if mask.sum() < 100:
        return im
    cur = np.median(rgbv[mask], axis=0)
    gain = np.array(rgb(target), np.float32) / np.maximum(cur, 1)
    w = np.clip((sat - 0.10) / 0.12, 0, 1)[..., None]
    rgbv = rgbv * (1 - w) + np.clip(rgbv * gain, 0, 255) * w
    arr[..., :3] = rgbv
    return Image.fromarray(arr.clip(0, 255).astype(np.uint8))


def states(im):
    """hover 提亮、pressed 變暗並下沉 2px（1x）、disabled 去飽和並混入淡灰紫"""
    hover = ImageEnhance.Brightness(im).enhance(1.07)
    hover.putalpha(im.getchannel("A"))
    dark = ImageEnhance.Brightness(im).enhance(0.92)
    dark.putalpha(im.getchannel("A"))
    pressed = Image.new("RGBA", im.size, (0, 0, 0, 0))
    pressed.alpha_composite(dark, (0, 4))
    g = ImageEnhance.Color(im).enhance(0.15)
    mixc = Image.new("RGBA", im.size, rgb(DISABLED_MIX) + (255,))
    dis = Image.blend(g, mixc, 0.42)
    dis.putalpha(im.getchannel("A").point(lambda v: int(v * 0.9)))
    return {"hover": hover, "pressed": pressed, "disabled": dis}


def post_codex(only):
    for raw in sorted(os.listdir(RAW)):
        if not raw.endswith(".png") or ".prev-" in raw:
            continue
        stem = raw[:-4]
        base, var = stem.rsplit("-", 1)
        if only and not any(stem.startswith(o) for o in only):
            continue
        im = crop_alpha(Image.open(os.path.join(RAW, raw)).convert("RGBA"))
        if base.startswith("title-prefix-"):
            save(fit_center(im, 128, 128, 0.04), "title", f"{base}-{var}")
            continue
        if base.startswith("divider-"):
            divider_tile(im, base, var)
            continue
        if base not in CODEX:
            continue
        group, w1, h1, cap, color = CODEX[base]
        W, H = w1 * 2, h1 * 2
        if color:
            im = recolor_fill(im, color)
        if cap is not None:
            out = nine_resize(im, W, H, cap)
        elif base in STRETCH:
            out = im.resize((W, H), Image.LANCZOS)
        else:
            out = fit_center(im, W, H, 0.02)
        name = f"{base}-{var}"
        save(out, group, name)
        if base in BUTTONS:
            for st, sim in states(out).items():
                save(sim, group, f"{name}-{st}")
        print("post", name)


# ---------- 分隔線：Codex 單元 + 程序化底線，週期等於寬度保證無縫 ----------

def divider_tile(motif, base, var):
    W, H = 96 * 2 * S, 24 * 2 * S
    brush = cf.Brush("a", 20261023)
    line = Image.new("L", (W, H), 0)
    ImageDraw.Draw(line).line([(0, H // 2), (W, H // 2)], fill=255, width=int(1.6 * 2 * S))
    la = np.asarray(cf.soften(line, brush), np.float32) * 0.7
    img = cf.compose((W, H), [(brush.paint(H, W, rgb("#CFC4D9"), 7), la)])
    m = fit_center(motif, int(W * 0.62), int(H * 0.92))
    img.alpha_composite(m, ((W - m.width) // 2, (H - m.height) // 2))
    img = img.resize((W // S, H // S), Image.LANCZOS)
    save(img, "title", f"{base}-{var}")
    print("divider", base, var)


# ---------- 程序化：滑桿、開關、地圖路徑 ----------

def pill_mask(size, box):
    m = Image.new("L", size, 0)
    x0, y0, x1, y1 = box
    ImageDraw.Draw(m).rounded_rectangle(box, radius=(y1 - y0) / 2, fill=255)
    return m


def track(var, fill_hex, name, w1=240, h1=16):
    brush = cf.Brush(var, 20261023 + ord(var))
    W, H = w1 * 2 * S, h1 * 2 * S
    size = (W, H)
    m = pill_mask(size, [S, S, W - S, H - S])
    layers = cf.shape_layers(brush, size, m, rgb(fill_hex), 11, stroke_px=2.2, stroke_alpha=0.75)
    # 內凹陰影：上緣暗、下緣亮
    yy = np.mgrid[0:H, 0:W][0].astype(np.float32) / H
    ma = np.asarray(m, np.float32)
    layers.append((cf.solid(size, rgb("#5A4E6A")), ma * np.clip(0.35 - yy, 0, 1) * 0.5))
    img = cf.compose(size, layers).resize((W // S, H // S), Image.LANCZOS)
    save(img, "settings", f"{name}-{var}")


def toggle(var, on):
    brush = cf.Brush(var, 20261023 + ord(var))
    w1, h1 = 64, 36
    W, H = w1 * 2 * S, h1 * 2 * S
    size = (W, H)
    m = pill_mask(size, [2 * S, 2 * S, W - 2 * S, H - 2 * S])
    fill = rgb(PRIMARY) if on else rgb("#E4DFEA")
    layers = [(cf.solid(size, (255, 255, 255)), outline(m, 3 * S))]
    layers += cf.shape_layers(brush, size, m, fill, 21, stroke_px=2.2, stroke_alpha=0.8)
    img = cf.compose(size, layers).resize((W // S, H // S), Image.LANCZOS)
    knob_path = os.path.join(BATCH, "settings", f"knob-{var}@2x.png")
    if os.path.exists(knob_path):
        k = Image.open(knob_path).convert("RGBA").resize((60, 60), Image.LANCZOS)
        x = img.width - 66 if on else 6
        img.alpha_composite(k, (x, (img.height - 60) // 2))
    save(img, "settings", f"toggle-{'on' if on else 'off'}-{var}")


def path_tile(var, locked):
    """章節地圖節點連線：珍珠與沙點，週期 32px（1x），寬 64 可無縫平鋪"""
    brush = cf.Brush(var, 20261023 + ord(var))
    w1, h1 = 64, 24
    W, H = w1 * 2 * S, h1 * 2 * S
    size = (W, H)
    pearl = rgb("#E4DFEA") if locked else rgb("#F8F4EC")
    shade = rgb("#B8B2BF") if locked else rgb("#CFC4D9")
    sand = rgb("#CFC4D9") if locked else rgb("#F2B6C6")
    layers = []
    cy = H / 2
    for k in range(2):
        cx = (16 + 32 * k) * 2 * S
        r = 6.5 * 2 * S
        mm = Image.new("L", size, 0)
        ImageDraw.Draw(mm).ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
        layers.append((cf.solid(size, (255, 255, 255)), outline(mm, 2 * S)))
        layers += cf.shape_layers(brush, size, mm, pearl, 31 + k, stroke_px=1.6, stroke_alpha=0.7)
        sh = Image.new("L", size, 0)
        ImageDraw.Draw(sh).ellipse([cx - r * 0.2, cy - r * 0.2, cx + r * 1.0, cy + r * 1.0], fill=255)
        sa = np.minimum(np.asarray(sh.filter(ImageFilter.GaussianBlur(2 * S)), np.float32), np.asarray(mm, np.float32))
        layers.append((cf.solid(size, shade), sa * 0.55))
        for j in (-1, 1):
            dx = cx + j * 16 * S * 2 * 0.5
            d = Image.new("L", size, 0)
            ImageDraw.Draw(d).ellipse([dx - 1.8 * 2 * S, cy - 1.8 * 2 * S, dx + 1.8 * 2 * S, cy + 1.8 * 2 * S], fill=255)
            layers.append((cf.solid(size, sand), np.asarray(cf.soften(d, brush), np.float32) * 0.85))
    img = cf.compose(size, layers).resize((W // S, H // S), Image.LANCZOS)
    save(img, "map", f"path-{'locked' if locked else 'open'}-{var}")


# ---------- 程序化：場上生物「拱窗小卡」 ----------

MW, MH = 288, 352          # 1x 畫布
FX, FY, FW, FH = 16, 16, 256, 320   # 框在畫布中的位置
RT, RB = 118, 30           # 上方拱形半徑、下方圓角
BAND = 12


def arch_mask(size, box, rt, rb, scale):
    x0, y0, x1, y1 = [v * scale for v in box]
    top = Image.new("L", size, 0)
    ImageDraw.Draw(top).rounded_rectangle([x0, y0, x1, y1], radius=rt * scale, fill=255)
    bot = Image.new("L", size, 0)
    ImageDraw.Draw(bot).rounded_rectangle([x0, y0, x1, y1], radius=rb * scale, fill=255)
    mid = int((y0 + y1) / 2)
    out = Image.new("L", size, 0)
    out.paste(top.crop((0, 0, size[0], mid)), (0, 0))
    out.paste(bot.crop((0, mid, size[0], size[1])), (0, mid))
    return out


def minion_masks(sc):
    size = (MW * sc, MH * sc)
    outer = arch_mask(size, (FX, FY, FX + FW, FY + FH), RT, RB, sc)
    inner = arch_mask(size, (FX + BAND, FY + BAND, FX + FW - BAND, FY + FH - BAND), RT - BAND, RB - BAND * 0.6, sc)
    return size, outer, inner


def minion_frame(var, faction):
    f = cf.FACTION[faction]
    brush = cf.Brush(var, 20261023 + ord(var) + FACTIONS.index(faction))
    sc = 4
    size, outer, inner = minion_masks(sc)
    W, H = size
    oa = np.asarray(outer, np.float32)
    ia = np.asarray(inner, np.float32)
    band = np.clip(oa - ia, 0, 255)
    layers = []
    # 白色 die-cut 邊與投影
    shadow = np.asarray(outer.filter(ImageFilter.GaussianBlur(6 * sc)), np.float32)
    sh = np.zeros_like(shadow)
    sh[4 * sc:, :] = shadow[:-4 * sc, :]
    layers.append((cf.solid(size, rgb("#5A4E6A")), sh * 0.22 * (1 - oa / 255)))
    layers.append((cf.solid(size, (255, 255, 255)), outline(outer, 5 * sc)))
    layers.append((brush.paint(H, W, rgb(f["main"]), 3), band))
    edge = np.clip(oa - np.asarray(outer.filter(ImageFilter.MinFilter(2 * sc + 1)), np.float32), 0, 255)
    layers.append((cf.solid(size, rgb(f["dark"])), edge * 0.6))
    ie = outline(inner, 1.2 * sc)
    layers.append((cf.solid(size, rgb(OUTLINE)), ie * 0.45))
    # 外框邊上的陣營花紋：沿拱形中線點綴
    pat = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(pat)
    mid = arch_mask(size, (FX + BAND / 2, FY + BAND / 2, FX + FW - BAND / 2, FY + FH - BAND / 2), RT - BAND / 2, RB - BAND / 2, sc)
    ring = np.asarray(mid, np.float32) - np.asarray(mid.filter(ImageFilter.MinFilter(3)), np.float32)
    ys, xs = np.nonzero(ring > 0)
    cxm, cym = W / 2, H / 2
    ang = np.arctan2(ys - cym, xs - cxm)
    order = np.argsort(ang)
    pts = list(zip(xs[order], ys[order]))
    step = {"leaf": 34, "tide": 30, "frost": 44, "light": 30, "neutral": 40}[faction]
    picked = pts[:: max(1, len(pts) // max(1, int((2 * (FW + FH) * sc) / (step * sc))))]
    for i, (x, y) in enumerate(picked):
        a = math.atan2(y - cym, x - cxm) + math.pi / 2
        if faction == "tide":
            r = 1.6 * sc
            d.ellipse([x - r, y - r, x + r, y + r], fill=rgb(f["accent"][0]) + (230,))
        else:
            cf.motif(d, faction, x, y, a, sc * 0.9, f["accent"], i)
    pa = np.asarray(pat, np.float32)
    layers.append((pa[..., :3], pa[..., 3] * band / 255))
    if brush.highlight:
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        tl = np.clip(1.3 - (xx / W + yy / H), 0, 1)
        hl = np.clip(oa - np.asarray(outer.filter(ImageFilter.MinFilter(3 * sc + 1)), np.float32), 0, 255) * tl
        layers.append((cf.solid(size, (255, 255, 255)), hl * brush.highlight))
    img = cf.compose(size, layers).resize((MW * 2, MH * 2), Image.LANCZOS)
    save(img, "minion", f"minion-frame-{faction}-{var}")
    # 插畫窗底色：中心偏上亮、外圍帶陣營色
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    dist = np.sqrt(((xx - W * 0.5) / (W * 0.48)) ** 2 + ((yy - H * 0.4) / (H * 0.6)) ** 2)
    t = np.clip(dist, 0, 1)[..., None]
    col = np.array(rgb("#FFFFFF"), np.float32) * (1 - t) * 0.4 + np.array(rgb(f["light"]), np.float32) * (1 - t) * 0.6 + np.array(rgb(f["main"]), np.float32) * t
    col = col * (1 + brush.grain(H, W, 41)[..., None] * 0.03)
    wimg = cf.compose(size, [(np.clip(col, 0, 255), ia)]).resize((MW * 2, MH * 2), Image.LANCZOS)
    save(wimg, "minion", f"minion-window-{faction}-{var}")


def minion_taunt(var):
    """守護：拱窗外圍一圈貝殼扇形邊，只畫外環"""
    brush = cf.Brush(var, 20261023 + ord(var) + 50)
    sc = 4
    size, outer, inner = minion_masks(sc)
    W, H = size
    shell = Image.new("L", size, 0)
    grown = grow(outer, 9 * sc)
    shell.paste(grown)
    d = ImageDraw.Draw(shell)
    # 沿拱形上半部外緣等距加一排扇貝凸起
    edge = np.asarray(outer, np.float32) - np.asarray(outer.filter(ImageFilter.MinFilter(3)), np.float32)
    ys, xs = np.nonzero(edge > 0)
    cx, cy = W / 2, (FY + FH * 0.5) * sc
    order = np.argsort(np.arctan2(ys - cy, xs - cx))
    xs, ys = xs[order], ys[order]
    seg = np.hypot(np.diff(xs), np.diff(ys))
    dist = np.concatenate([[0], np.cumsum(seg)])
    rr = 8.5 * sc
    for t in np.arange(0, dist[-1] - rr, rr * 1.7):
        i = int(np.searchsorted(dist, t))
        x, y = xs[min(i, len(xs) - 1)], ys[min(i, len(ys) - 1)]
        vx, vy = x - cx, y - cy
        n = max(math.hypot(vx, vy), 1)
        bx, by = x + vx / n * 4 * sc, y + vy / n * 4 * sc
        d.ellipse([bx - rr, by - rr, bx + rr, by + rr], fill=255)
    sa = np.asarray(shell, np.float32)
    ring = np.clip(sa - np.asarray(outer, np.float32), 0, 255)
    ringm = Image.fromarray(ring.astype(np.uint8))
    layers = [(cf.solid(size, (255, 255, 255)), outline(shell, 3 * sc))]
    layers += cf.shape_layers(brush, size, ringm, rgb("#F1DDD3"), 61, stroke_px=1.6, stroke_alpha=0.8)
    # 扇貝放射紋
    rid = Image.new("L", size, 0)
    dr = ImageDraw.Draw(rid)
    for k in range(72):
        a = 2 * math.pi * k / 72
        dr.line([(cx, (FY + FH / 2) * sc), (cx + 4000 * math.cos(a), (FY + FH / 2) * sc + 4000 * math.sin(a))], fill=255, width=int(0.8 * sc))
    ra = np.minimum(np.asarray(rid, np.float32), ring)
    layers.append((cf.solid(size, rgb("#B8A9C9")), ra * 0.45))
    img = cf.compose(size, layers).resize((MW * 2, MH * 2), Image.LANCZOS)
    save(img, "minion", f"minion-taunt-{var}")


def minion_glow(var, kind):
    """可攻擊：外框柔和綠光；已攻擊：插畫窗灰紫薄紗"""
    sc = 2
    size, outer, inner = minion_masks(sc)
    if kind == "ready":
        g = grow(outer, 8 * sc).filter(ImageFilter.GaussianBlur(7 * sc if var == "a" else 5 * sc))
        a = np.clip(np.asarray(g, np.float32) - np.asarray(outer, np.float32) * 0.9, 0, 255) * (1.0 if var == "a" else 1.15)
        col = rgb("#7FD88F") if var == "a" else rgb("#A6E3B0")
        img = Image.fromarray(np.dstack([cf.solid(size, col), np.clip(a, 0, 255)]).astype(np.uint8))
        save(img, "minion", f"minion-ready-{var}")
    else:
        ia = np.asarray(inner, np.float32)
        H, W = ia.shape
        alpha = ia * 0.38
        if var == "b":
            yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
            hatch = (np.sin((xx + yy) / 5.0) > 0.7).astype(np.float32)
            alpha = ia * (0.28 + hatch * 0.12)
        img = Image.fromarray(np.dstack([cf.solid(size, rgb("#8F879A")), alpha]).astype(np.uint8))
        save(img, "minion", f"minion-exhausted-{var}")


def stat_plate(var):
    """攻血數字底座：插畫窗下緣的奶白橫條，左右兩端放既有攻擊與生命圖示"""
    brush = cf.Brush(var, 20261023 + ord(var) + 70)
    w1, h1 = 232, 44
    sc = 4
    W, H = w1 * sc, h1 * sc
    size = (W, H)
    m = pill_mask(size, [6 * sc, 6 * sc, W - 6 * sc, H - 6 * sc])
    layers = [(cf.solid(size, (255, 255, 255)), outline(m, 3 * sc))]
    layers += cf.shape_layers(brush, size, m, rgb("#FFFDF7"), 81, stroke_px=1.4, stroke_alpha=0.7)
    img = cf.compose(size, layers).resize((w1 * 2, h1 * 2), Image.LANCZOS)
    save(img, "minion", f"minion-statplate-{var}")


def procedural(only):
    want = lambda p: not only or any(p.startswith(o) for o in only)
    for v in ("a", "b"):
        if want("slider"):
            track(v, "#FBF6EC", "slider-track")
            track(v, PRIMARY, "slider-fill")
        if want("toggle"):
            toggle(v, False)
            toggle(v, True)
        if want("path"):
            path_tile(v, False)
            path_tile(v, True)
        if want("minion"):
            for fa in FACTIONS:
                minion_frame(v, fa)
            minion_taunt(v)
            minion_glow(v, "ready")
            minion_glow(v, "exhausted")
            stat_plate(v)
        print("procedural", v)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--skip-codex", action="store_true")
    ap.add_argument("--skip-proc", action="store_true")
    args = ap.parse_args()
    only = [o for o in args.only.split(",") if o]
    if not args.skip_codex:
        post_codex(only)
    if not args.skip_proc:
        procedural(only)


if __name__ == "__main__":
    main()
