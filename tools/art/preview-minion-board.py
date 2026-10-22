#!/usr/bin/env python3
"""場上生物新外觀預覽：6 格戰場擺滿不同陣營與狀態，桌機 1440x900 與手機 844x390

用法: python3 tools/art/preview-minion-board.py [--set a|b]
另輸出三個設計方向的對照圖 minion-directions.png
"""
import argparse
import os

import numpy as np

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
B = os.path.join(ROOT, "assets", "pending", "batch-20261023-ui")
M = os.path.join(B, "minion")
OUT = os.path.join(B, "_preview")
NUM_FONT = "/System/Library/Fonts/SFNSRounded.ttf"
CJK = "/System/Library/Fonts/STHeiti Medium.ttc"
INK = (62, 53, 80)
TONE = {"same": (255, 255, 255), "up": (126, 226, 154), "down": (255, 143, 139)}
CW, CH = 288, 352          # 1x 畫布
FX, FY, FW, FH = 16, 16, 256, 320


def load(p, size=None):
    im = Image.open(p).convert("RGBA")
    return im.resize(size, Image.LANCZOS) if size else im


def num_font(px):
    f = ImageFont.truetype(NUM_FONT, px)
    try:
        f.set_variation_by_name("Heavy")
    except Exception:
        pass
    return f


def stat_badge(canvas, icon, n, tone, cx, cy, d):
    ic = load(icon, (d, d))
    canvas.alpha_composite(ic, (int(cx - d / 2), int(cy - d / 2)))
    dr = ImageDraw.Draw(canvas)
    f = num_font(int(d * (0.5 if n < 10 else 0.42)))
    dr.text((cx, cy + d * 0.02), str(n), font=f, fill=TONE[tone], anchor="mm", stroke_width=max(3, d // 14), stroke_fill=INK)


def minion(card_id, faction, atk, hp, st, v="a"):
    """st: set of taunt, stealth, bubble, frozen, ready, exhausted；atk、hp 為 (數值, tone)"""
    c = Image.new("RGBA", (CW * 2, CH * 2), (0, 0, 0, 0))
    if "ready" in st:
        glow = load(os.path.join(M, f"minion-ready-{v}@2x.png"))
        c.alpha_composite(glow)
        c.alpha_composite(glow)
    if "taunt" in st:
        c.alpha_composite(load(os.path.join(M, f"minion-taunt-{v}@2x.png")))
    win = load(os.path.join(M, f"minion-window-{faction}-{v}@2x.png"))
    c.alpha_composite(win)
    art = load(os.path.join(ROOT, "assets", "_source", "cards", f"{card_id}.png"))
    bbox = art.getchannel("A").point(lambda x: 255 if x > 16 else 0).getbbox()
    art = art.crop(bbox)
    ww, wh = (FW - 24) * 2, (FH - 24) * 2
    s = min(ww * 1.04 / art.width, wh * 0.80 / art.height)
    art = art.resize((int(art.width * s), int(art.height * s)), Image.LANCZOS)
    layer = Image.new("RGBA", c.size, (0, 0, 0, 0))
    layer.alpha_composite(art, ((c.width - art.width) // 2, int((FY + 12 + 18) * 2)))
    if "stealth" in st:
        layer.putalpha(layer.getchannel("A").point(lambda x: int(x * 0.55)))
    if "exhausted" in st:
        g = ImageEnhance.Color(layer).enhance(0.35)
        layer = ImageEnhance.Brightness(g).enhance(0.92)
    mask = win.getchannel("A")
    layer.putalpha(Image.fromarray(np.minimum(np.asarray(layer.getchannel("A")), np.asarray(mask))))
    c.alpha_composite(layer)
    if "exhausted" in st:
        c.alpha_composite(load(os.path.join(M, f"minion-exhausted-{v}@2x.png")))
    if "stealth" in st:
        mist = load(os.path.join(M, f"ov-stealth-{v}@2x.png"))
        mist.putalpha(mist.getchannel("A").point(lambda x: int(x * 0.85)))
        c.alpha_composite(mist)
    c.alpha_composite(load(os.path.join(M, f"minion-frame-{faction}-{v}@2x.png")))
    if "frozen" in st:
        c.alpha_composite(load(os.path.join(M, f"ov-frozen-{v}@2x.png")))
    if "bubble" in st:
        c.alpha_composite(load(os.path.join(M, f"ov-bubble-{v}@2x.png")))
    # 攻血底座與數字（疊在泡泡盾之上，數字永遠清楚）
    plate = load(os.path.join(M, f"minion-statplate-{v}@2x.png"))
    py = (FY + FH - 52) * 2
    c.alpha_composite(plate, ((c.width - plate.width) // 2, py))
    stat_badge(c, os.path.join(ROOT, "assets/ui/icons/icon-attack@2x.webp"), atk[0], atk[1], (FX + 44) * 2, (FY + FH - 34) * 2, 112 * 2)
    stat_badge(c, os.path.join(ROOT, "assets/ui/icons/icon-health@2x.webp"), hp[0], hp[1], (FX + FW - 44) * 2, (FY + FH - 34) * 2, 112 * 2)
    return c


ENEMY = [
    ("tide-005", "tide", (3, "same"), (2, "same"), {"exhausted"}, "已攻擊"),
    ("frost-006", "frost", (3, "same"), (5, "same"), {"taunt"}, "守護"),
    ("tide-007", "tide", (2, "same"), (1, "same"), {"bubble"}, "泡泡盾"),
    ("frost-002", "frost", (1, "same"), (2, "down"), {"taunt", "frozen"}, "守護＋冰凍＋受傷"),
    ("light-002", "light", (2, "same"), (2, "same"), {"stealth"}, "潛藏"),
    ("neutral-005", "neutral", (5, "same"), (7, "same"), set(), "一般"),
]
PLAYER = [
    ("leaf-001", "leaf", (1, "same"), (2, "same"), {"ready"}, "可攻擊"),
    ("leaf-003", "leaf", (4, "up"), (4, "up"), {"ready"}, "增益＋可攻擊"),
    ("leaf-004", "leaf", (2, "same"), (3, "down"), {"taunt", "ready"}, "守護＋受傷"),
    ("light-007", "light", (3, "same"), (2, "same"), {"bubble", "ready"}, "泡泡盾＋可攻擊"),
    ("neutral-002", "neutral", (2, "same"), (3, "same"), {"frozen"}, "冰凍"),
    ("tide-006", "tide", (3, "same"), (4, "same"), {"exhausted", "taunt", "bubble"}, "已攻擊＋守護＋泡泡"),
]


def board(W, H, minion_w, label_font, v, labels=True, name="board"):
    bg = load(os.path.join(ROOT, "assets", "backgrounds", "bg-battle-landscape.webp"))
    s = max(W / bg.width, H / bg.height)
    bg = bg.resize((int(bg.width * s), int(bg.height * s)), Image.LANCZOS).crop((0, 0, W, H)).convert("RGBA")
    mh = int(minion_w * CH / CW)
    gap = int(minion_w * 0.16)
    total = 6 * minion_w + 5 * gap
    x0 = (W - total) // 2
    rows = [(ENEMY, int(H * 0.30)), (PLAYER, int(H * 0.62))]
    d = ImageDraw.Draw(bg)
    f = ImageFont.truetype(CJK, label_font)
    for lst, cy in rows:
        for i, (cid, fa, atk, hp, st, lab) in enumerate(lst):
            im = minion(cid, fa, atk, hp, st, v).resize((minion_w, mh), Image.LANCZOS)
            x = x0 + i * (minion_w + gap)
            bg.alpha_composite(im, (x, cy - mh // 2))
            if labels:
                d.text((x + minion_w // 2, cy + mh // 2 + 2), lab, font=f, fill=INK, anchor="ma", stroke_width=3, stroke_fill=(255, 253, 247))
    # 中線
    d.line([(int(W * 0.12), int(H * 0.46)), (int(W * 0.88), int(H * 0.46))], fill=(255, 255, 255, 150), width=2)
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, f"{name}-{v}-{W}x{H}.png")
    bg.convert("RGB").save(p)
    print(p)


def directions():
    """三個方向對照：A 拱窗小卡、B 圓形徽章、C 貼紙加底座（B、C 為快速示意）"""
    W, H = 1200, 520
    im = Image.new("RGBA", (W, H), (214, 232, 240, 255))
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype(CJK, 26)
    fs = ImageFont.truetype(CJK, 18)
    a = minion("leaf-004", "leaf", (2, "same"), (5, "same"), {"taunt"}).resize((230, 281), Image.LANCZOS)
    im.alpha_composite(a, (85, 110))
    # B 圓形徽章
    art = load(os.path.join(ROOT, "assets", "_source", "cards", "leaf-004.png"), (220, 220))
    circ = Image.new("L", (220, 220), 0)
    ImageDraw.Draw(circ).ellipse([0, 0, 219, 219], fill=255)
    badge = Image.new("RGBA", (240, 240), (0, 0, 0, 0))
    ImageDraw.Draw(badge).ellipse([0, 0, 239, 239], fill=(255, 255, 255, 255))
    ImageDraw.Draw(badge).ellipse([6, 6, 233, 233], fill=(156, 199, 154, 255))
    inner = Image.new("RGBA", (220, 220), (227, 241, 220, 255))
    inner.alpha_composite(art)
    badge.paste(inner, (10, 10), circ)
    im.alpha_composite(badge, (480, 120))
    stat_badge(im, os.path.join(ROOT, "assets/ui/icons/icon-attack@2x.webp"), 2, "same", 495, 350, 76)
    stat_badge(im, os.path.join(ROOT, "assets/ui/icons/icon-health@2x.webp"), 5, "same", 705, 350, 76)
    # C 貼紙加底座
    st = load(os.path.join(ROOT, "assets", "_source", "cards", "leaf-004.png"), (250, 250))
    ped = Image.new("RGBA", (260, 70), (0, 0, 0, 0))
    ImageDraw.Draw(ped).ellipse([0, 0, 259, 69], fill=(232, 220, 200, 255), outline=(110, 95, 128, 255), width=3)
    im.alpha_composite(ped, (875, 320))
    im.alpha_composite(st, (880, 100))
    stat_badge(im, os.path.join(ROOT, "assets/ui/icons/icon-attack@2x.webp"), 2, "same", 890, 375, 70)
    stat_badge(im, os.path.join(ROOT, "assets/ui/icons/icon-health@2x.webp"), 5, "same", 1120, 375, 70)
    for x, t, sub in ((200, "A 拱窗小卡（選定）", "與手牌卡框同語言，狀態有固定外框可疊"), (600, "B 圓形徽章", "最省空間，插畫裁切最多"), (1000, "C 貼紙加底座", "最可愛，但守護與冰凍沒有外框可依附")):
        d.text((x, 30), t, font=f, fill=INK, anchor="ma")
        d.text((x, 70), sub, font=fs, fill=(110, 101, 128), anchor="ma")
    p = os.path.join(OUT, "minion-directions.png")
    im.convert("RGB").save(p)
    print(p)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--set", default="a")
    a = ap.parse_args()
    # 建議尺寸：桌機 1440 下約 120px，手機 844x390 下約 80px
    board(1440, 900, 120, 15, a.set)
    board(844, 390, 80, 11, a.set, labels=False)
    if a.set == "a":
        directions()
        # 現行尺寸對照：1440 下約 90px
        board(1440, 900, 92, 13, a.set, name="board-current-size")


if __name__ == "__main__":
    main()
