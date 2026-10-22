#!/usr/bin/env python3
"""把粉圓與 Baloo 2 子集化成 web/public/fonts/ 底下的 woff2

用法: python3 tools/fonts/subset.py --huninn 粉圓.ttf --baloo Baloo2.ttf
粉圓收錄 content/*.json 與 web/src 介面字串用到的字、ASCII 可見字元、常用全形標點
粉圓子集改名為 SeafishRound，授權的保留字型名稱不可用於修改版本
Baloo 2 只收數字與 +-/x%:
需要 fonttools 與 brotli（pip3 install --user fonttools brotli）
"""
import argparse
import glob
import json
import os
import re

from fontTools import subset

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "web", "public", "fonts")
ASCII = "".join(chr(c) for c in range(0x20, 0x7F))
PUNCT = "，。、；：？！「」『』（）《》〈〉【】…—～・‧／％＋－×←→↑↓"
DIGITS = "0123456789+-/x%:"
COMMENT = re.compile(r"/\*.*?\*/|<!--.*?-->|(?<![:'\"])//[^\n]*", re.S)


def walk(node, chars):
    if isinstance(node, str):
        chars.update(node)
    elif isinstance(node, dict):
        for v in node.values():
            walk(v, chars)
    elif isinstance(node, list):
        for v in node:
            walk(v, chars)


def game_chars():
    chars = set(ASCII + PUNCT)
    for path in glob.glob(os.path.join(ROOT, "content", "*.json")):
        with open(path, encoding="utf-8") as f:
            walk(json.load(f), chars)
    for ext in ("vue", "ts"):
        for path in glob.glob(os.path.join(ROOT, "web", "src", "**", "*." + ext), recursive=True):
            with open(path, encoding="utf-8") as f:
                chars.update(c for c in COMMENT.sub("", f.read()) if ord(c) > 0x7E)
    return "".join(sorted(c for c in chars if c.isprintable()))


def rename(font, family):
    name = font["name"]
    name.names = [n for n in name.names if n.nameID not in (1, 3, 4, 6, 16, 17, 18, 21, 22)]
    for nid, value in ((1, family), (3, family + "-Regular"), (4, family), (6, family + "-Regular")):
        name.setName(value, nid, 3, 1, 0x409)
        name.setName(value, nid, 1, 0, 0)


def make(src, dst, text, family=None):
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["*"]
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    font = subset.load_font(src, opts)
    sub = subset.Subsetter(opts)
    sub.populate(text=text)
    sub.subset(font)
    if family:
        rename(font, family)
    subset.save_font(font, dst, opts)
    print("%s  %d 字  %.1f KB" % (os.path.relpath(dst, ROOT), len(text), os.path.getsize(dst) / 1024))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--huninn", required=True, help="jf-openhuninn-2.1.ttf")
    ap.add_argument("--baloo", required=True, help="Baloo 2 ttf")
    args = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    make(args.huninn, os.path.join(OUT, "huninn-2.1-subset.woff2"), game_chars(), "SeafishRound")
    make(args.baloo, os.path.join(OUT, "baloo2-digits.woff2"), DIGITS)


if __name__ == "__main__":
    main()
