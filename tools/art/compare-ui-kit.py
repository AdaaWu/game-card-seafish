#!/usr/bin/env python3
"""前後對照圖：左為現況截圖、右為套上新素材的預覽

用法: python3 tools/art/compare-ui-kit.py <現況截圖目錄> [--set a]
"""
import argparse
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PRE = os.path.join(ROOT, "assets", "pending", "batch-20261023-ui", "_preview")
FONT = "/System/Library/Fonts/STHeiti Medium.ttc"
PAIRS = [
    ("menu", "02a-menu-locked", "menu"),
    ("map", "03b-storymap", "map"),
    ("popup", "03c-storypopup", "popup"),
    ("picker", "05-free-picker", "picker"),
    ("settings", "02d-settings", "settings"),
    ("result-win", "04b-result-win", "result"),
    ("result-lose", "04c-result-lose", "result-lose"),
    ("deck", "06-deck", "deck"),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("shots")
    ap.add_argument("--set", default="a")
    a = ap.parse_args()
    f = ImageFont.truetype(FONT, 22)
    for name, before, after in PAIRS:
        for size in ("1440x900", "844x390"):
            b = os.path.join(a.shots, f"{before}-{size}.png")
            af = os.path.join(PRE, f"after-{after}-{a.set}-{size}.png")
            if not (os.path.exists(b) and os.path.exists(af)):
                continue
            bi, ai = Image.open(b).convert("RGB"), Image.open(af).convert("RGB")
            w, h = bi.size
            out = Image.new("RGB", (w * 2 + 24, h + 44), (250, 248, 244))
            out.paste(bi, (0, 44))
            out.paste(ai, (w + 24, 44))
            d = ImageDraw.Draw(out)
            d.text((10, 10), f"現況 before | {name} | {size}", font=f, fill=(62, 53, 80))
            d.text((w + 34, 10), f"套用後 after | 變體 {a.set}", font=f, fill=(62, 53, 80))
            p = os.path.join(PRE, f"compare-{name}-{a.set}-{size}.png")
            out.save(p)
            print(p)
    # 生物外觀前後
    g = os.path.join(a.shots, "04f-board-mid-1440x900.png")
    nb = os.path.join(PRE, f"board-{a.set}-1440x900.png")
    if os.path.exists(g) and os.path.exists(nb):
        bi, ai = Image.open(g).convert("RGB"), Image.open(nb).convert("RGB")
        out = Image.new("RGB", (bi.width * 2 + 24, bi.height + 44), (250, 248, 244))
        out.paste(bi, (0, 44))
        out.paste(ai, (bi.width + 24, 44))
        d = ImageDraw.Draw(out)
        d.text((10, 10), "現況 before | 對戰場上生物", font=f, fill=(62, 53, 80))
        d.text((bi.width + 34, 10), f"套用後 after | 拱窗小卡 變體 {a.set}", font=f, fill=(62, 53, 80))
        out.save(os.path.join(PRE, f"compare-minion-{a.set}-1440x900.png"))


if __name__ == "__main__":
    main()
