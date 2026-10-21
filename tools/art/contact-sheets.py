#!/usr/bin/env python3
"""batch-20261022-card 各組變體拼成 contact sheet，存到批次根目錄

用法: python3 tools/art/contact-sheets.py
"""
import os

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BATCH = os.path.join(ROOT, "assets", "pending", "batch-20261022-card")
BG = (0x8C, 0x7F, 0x9C, 255)
LIGHT = (0xF8, 0xF4, 0xEC, 255)


def load(rel):
    p = os.path.join(BATCH, rel)
    return Image.open(p).convert("RGBA") if os.path.exists(p) else None


def label_bar(sheet, x, y, w, idx):
    # 以小色塊數量標示變體 a b c，不寫字
    d = ImageDraw.Draw(sheet)
    for k in range(idx + 1):
        d.ellipse([x + w // 2 - 8 + (k - idx / 2) * 22, y, x + w // 2 + 8 + (k - idx / 2) * 22, y + 16], fill=(255, 255, 255, 255))


def grid(rows, cell, pad=16, bg=BG):
    cols = max(len(r) for r in rows)
    sheet = Image.new("RGBA", (cols * (cell[0] + pad) + pad, len(rows) * (cell[1] + pad + 24) + pad), bg)
    for j, row in enumerate(rows):
        for i, im in enumerate(row):
            if im is None:
                continue
            im = im.copy()
            im.thumbnail(cell, Image.LANCZOS)
            x = pad + i * (cell[0] + pad)
            y = pad + j * (cell[1] + pad + 24)
            sheet.alpha_composite(im, (x + (cell[0] - im.width) // 2, y + 24 + (cell[1] - im.height) // 2))
    return sheet


def main():
    v3 = "abc"
    # 卡背：1x 全圖加 52x72、44x60 縮圖
    rows = [[load("card-back/card-back-%s.png" % v) for v in v3]]
    sheet = grid(rows, (512, 716))
    for i, v in enumerate(v3):
        x = 16 + i * 528
        for k, s in enumerate(("52x72", "44x60")):
            t = load("card-back/_thumbs/card-back-%s-%s.png" % (v, s))
            if t:
                sheet.alpha_composite(t, (x + 20 + k * 70, 40))
        label_bar(sheet, x, 4, 512, i)
    sheet.save(os.path.join(BATCH, "contact-card-back.png"))

    # 框架切片：三套各一列預覽卡
    rows = [[load("card-front/_preview/preview-%s-%s.png" % (v, c)) for c in
             ["leaf-001", "tide-001", "frost-012", "light-001", "neutral-001", "tide-003"]] for v in v3]
    sheet = grid(rows, (256, 358))
    for j in range(3):
        label_bar(sheet, 16, 16 + j * (358 + 40), 60, j)
    sheet.save(os.path.join(BATCH, "contact-card-frame.png"))

    # 四角圖示：費用、攻擊、生命各一列
    rows = [[load("card-front/icons/icon-%s-%s@2x.png" % (k, v)) for v in v3] for k in ("cost", "attack", "health")]
    grid(rows, (144, 144), bg=LIGHT).save(os.path.join(BATCH, "contact-icons-stat.png"))
    rows = [[load("card-front/icons/icon-faction-%s-%s@2x.png" % (f, v)) for v in "ab"] for f in
            ("leaf", "tide", "frost", "light", "neutral")]
    rows = [list(r) for r in zip(*rows)]
    grid(rows, (144, 144), bg=LIGHT).save(os.path.join(BATCH, "contact-icons-faction.png"))

    # 對戰背景：橫式一列、直式一列
    rows = [[load("battle-bg/bg-battle-landscape-%s.png" % v) for v in v3],
            [load("battle-bg/bg-battle-portrait-%s.png" % v) for v in v3]]
    grid(rows, (640, 640)).save(os.path.join(BATCH, "contact-battle-bg.png"))
    print("done")


if __name__ == "__main__":
    main()
