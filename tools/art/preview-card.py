#!/usr/bin/env python3
"""把框架切片、現有插畫、四角圖示合成新版面預覽卡，另出九宮格拉伸測試與手牌縮圖

用法: python3 tools/art/preview-card.py --variant a|b|c
數字與名稱以灰色色塊代替，不畫文字
"""
import argparse
import json
import os

import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FRONT = os.path.join(ROOT, "assets", "pending", "batch-20261022-card", "card-front")
SLICES = os.path.join(FRONT, "slices")
ICONS = os.path.join(FRONT, "icons")
OUT = os.path.join(FRONT, "_preview")
K = 512 / 500
W1, H1 = 512, 716
# 每陣營 1 張生物卡加 1 張法術卡
SAMPLES = ["leaf-001", "tide-001", "frost-012", "light-001", "neutral-001", "tide-003"]


def px(v):
    return round(v * K)


def load(path):
    return Image.open(path).convert("RGBA")


def nine(img, size, left, right, top=0, bottom=0):
    """九宮格拉伸，邊角維持原尺寸"""
    w, h = img.size
    tw, th = size
    out = Image.new("RGBA", size, (0, 0, 0, 0))
    xs = [(0, left, 0, left), (left, w - right, left, tw - right), (w - right, w, tw - right, tw)]
    ys = [(0, top, 0, top), (top, h - bottom, top, th - bottom), (h - bottom, h, th - bottom, th)]
    for sx0, sx1, dx0, dx1 in xs:
        for sy0, sy1, dy0, dy1 in ys:
            if sx1 <= sx0 or sy1 <= sy0 or dx1 <= dx0 or dy1 <= dy0:
                continue
            piece = img.crop((sx0, sy0, sx1, sy1)).resize((dx1 - dx0, dy1 - dy0), Image.LANCZOS)
            out.alpha_composite(piece, (dx0, dy0))
    return out


def icon(name, variant):
    for v in (variant, "a"):
        p = os.path.join(ICONS, "%s-%s.png" % (name, v))
        if os.path.exists(p):
            return load(p), v
    return None, None


def crop_art(card_id, aw, ah):
    """插畫裁切規則：只裁下方與左右，頭部完整"""
    src = os.path.join(ROOT, "assets", "_source", "cards", card_id + ".png")
    im = load(src)
    box = im.getchannel("A").point(lambda v: 255 if v > 16 else 0).getbbox()
    char = im.crop(box)
    bw, bh = char.size
    scale = min(ah * 0.86 / bh, aw * 1.08 / bw)
    char = char.resize((max(1, round(bw * scale)), max(1, round(bh * scale))), Image.LANCZOS)
    x = round((aw - char.width) / 2)
    y = round(ah * 0.10)
    layer = Image.new("RGBA", (aw, ah), (0, 0, 0, 0))
    layer.paste(char, (x, y))
    clip = {"left": max(0, -x), "right": max(0, char.width + x - aw), "bottom": max(0, y + char.height - ah), "top": 0}
    return layer, clip, (char.width, char.height)


def build(card, variant):
    fac = card["faction"]
    spell = card["type"] == "spell"
    text_h = 110 if spell else 132
    art_h = 548 if spell else 504
    canvas = Image.new("RGBA", (W1, H1), (0, 0, 0, 0))
    canvas.alpha_composite(load(os.path.join(SLICES, "card-frame-%s-%s.png" % (fac, variant))))
    ax, ay, aw, ah = px(18), px(18), px(464), px(art_h)
    art = Image.new("RGBA", (aw, ah), (0, 0, 0, 0))
    wash = load(os.path.join(SLICES, "card-artwash-%s-%s.png" % (fac, variant)))
    art.alpha_composite(wash.crop((0, 0, aw, ah)) if wash.height >= ah else wash.resize((aw, ah)))
    sh = ImageDraw.Draw(art)
    sy = ah - px(28)
    sh.ellipse([aw * 0.3, sy - px(10), aw * 0.7, sy + px(10)], fill=(0x5A, 0x4E, 0x6A, 40))
    char, clip, csize = crop_art(card["id"], aw, ah)
    art.alpha_composite(char)
    scrim = load(os.path.join(SLICES, "card-scrim-%s.png" % variant))
    scrim = nine(scrim, (aw, scrim.height), 28, 28)
    art.alpha_composite(scrim, (0, 0))
    art.alpha_composite(scrim.transpose(Image.FLIP_TOP_BOTTOM), (0, ah - scrim.height))
    mask = Image.new("L", (aw, ah), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, aw - 1, ah - 1], radius=px(26), fill=255)
    art.putalpha(Image.fromarray(np.minimum(np.asarray(art.getchannel("A")), np.asarray(mask))))
    canvas.alpha_composite(art, (ax, ay))

    tb = load(os.path.join(SLICES, "card-textbox-%s.png" % variant))
    th = px(text_h)
    canvas.alpha_composite(nine(tb, (px(464), th), 20, 20, 20, 20), (px(18), px(682) - th))
    d = ImageDraw.Draw(canvas)
    for i in range(2 if spell else 3):
        y = px(682) - th + px(22) + i * px(30)
        d.rounded_rectangle([px(42), y, px(458) - (i == 2) * px(120), y + px(14)], radius=px(6), fill=(0xB5, 0xAE, 0xBD, 255))

    art_bottom = 18 + art_h
    rb = load(os.path.join(SLICES, "card-ribbon-%s.png" % variant))
    rx, rw = (50, 400) if spell else (96, 308)
    rib = nine(rb, (px(rw) if spell else rb.width, rb.height), 32, 32)
    ry = px(art_bottom - 4 - 52)
    canvas.alpha_composite(rib, (px(rx) + (px(rw) - rib.width) // 2, ry))
    d.rounded_rectangle([px(250) - px(70), ry + px(18), px(250) + px(70), ry + px(34)], radius=px(6), fill=(0x9A, 0x92, 0xA6, 255))
    gem = load(os.path.join(SLICES, "card-gem-%s-%s.png" % (card.get("rarity", "common"), variant)))
    canvas.alpha_composite(gem, (px(250) - gem.width // 2, ry + rib.height - gem.height // 2))
    if card.get("rarity") == "legendary":
        cr = load(os.path.join(SLICES, "card-crown-%s.png" % variant))
        canvas.alpha_composite(cr, ((W1 - cr.width) // 2, 0))
    for i, _ in enumerate(card.get("keywords") or []):
        ring = load(os.path.join(SLICES, "card-keyword-ring-%s.png" % variant)).resize((px(48), px(48)), Image.LANCZOS)
        cx = px(130 + 56 * i)
        canvas.alpha_composite(ring, (cx - ring.width // 2, px(45) - ring.height // 2))
    used = {}
    d70 = px(70)

    def put(name, x, y, digit):
        im, v = icon(name, variant)
        used[name] = v
        if im is None:
            return
        im = im.resize((d70, d70), Image.LANCZOS)
        canvas.alpha_composite(im, (x, y))
        if digit:
            c = (x + d70 // 2, y + d70 // 2)
            ImageDraw.Draw(canvas).rounded_rectangle([c[0] - px(12), c[1] - px(16), c[0] + px(12), c[1] + px(16)], radius=px(5),
                                                     fill=(0x8E, 0x86, 0x99, 255), outline=(0x3E, 0x35, 0x50, 255), width=2)

    put("icon-cost", px(10), px(10), True)
    put("icon-faction-" + fac, px(420), px(10), False)
    if not spell:
        stat_y = px(art_bottom - 2) - d70
        put("icon-attack", px(14), stat_y, True)
        put("icon-health", px(416), stat_y, True)
    return canvas, clip, csize, used


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--variant", required=True, choices=["a", "b", "c"])
    args = ap.parse_args()
    v = args.variant
    os.makedirs(OUT, exist_ok=True)
    data = json.load(open(os.path.join(ROOT, "content", "cards.phase1.json")))
    cards = {c["id"]: c for c in data["cards"]}
    row = []
    for cid in SAMPLES:
        img, clip, csize, used = build(cards[cid], v)
        img.save(os.path.join(OUT, "preview-%s-%s.png" % (v, cid)))
        hand = img.resize((150, round(150 * H1 / W1)), Image.LANCZOS)
        hand.save(os.path.join(OUT, "hand-%s-%s.png" % (v, cid)))
        row.append(img)
        print("%s %s 角色縮放後 %s 裁切 上=%d 左=%d 右=%d 下=%d 圖示變體=%s" % (
            v, cid, csize, clip["top"], clip["left"], clip["right"], clip["bottom"], used))
    sheet = Image.new("RGBA", (len(row) * (W1 + 16), H1), (0x8C, 0x7F, 0x9C, 255))
    for i, im in enumerate(row):
        sheet.alpha_composite(im, (i * (W1 + 16), 0))
    sheet.save(os.path.join(OUT, "preview-%s-sheet.png" % v))
    hands = Image.new("RGBA", (len(row) * 160, 220), (0x8C, 0x7F, 0x9C, 255))
    for i, cid in enumerate(SAMPLES):
        hands.alpha_composite(load(os.path.join(OUT, "hand-%s-%s.png" % (v, cid))), (i * 160 + 5, 4))
    hands.save(os.path.join(OUT, "hand-%s-sheet.png" % v))
    # 九宮格拉伸測試：緞帶 412 寬、文字框 112 與 160 高
    rb = load(os.path.join(SLICES, "card-ribbon-%s.png" % v))
    tb = load(os.path.join(SLICES, "card-textbox-%s.png" % v))
    sc = load(os.path.join(SLICES, "card-scrim-%s.png" % v))
    test = Image.new("RGBA", (1000, 560), (0x8C, 0x7F, 0x9C, 255))
    test.alpha_composite(rb, (10, 10))
    test.alpha_composite(nine(rb, (412, rb.height), 32, 32), (10, 80))
    test.alpha_composite(nine(tb, (476, 112), 20, 20, 20, 20), (10, 150))
    test.alpha_composite(nine(tb, (476, 160), 20, 20, 20, 20), (500, 150))
    test.alpha_composite(tb, (10, 330))
    test.alpha_composite(nine(sc, (476, sc.height), 28, 28), (500, 330))
    test.save(os.path.join(OUT, "stretch-%s.png" % v))


if __name__ == "__main__":
    main()
