#!/usr/bin/env python3
"""HTMLからテスト用のJSとモンスターデータを取り出す。
使い方: python3 extract.py [path/to/index.html]   (省略時はリポジトリ直下の index.html)"""
import sys, re, json, pathlib
default = pathlib.Path(__file__).resolve().parent.parent / 'index.html'
src = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else default).read_text(encoding='utf-8')
js = src.split('<script>\n', 1)[1].rsplit('</script>', 1)[0].replace('boot();', '')
out = pathlib.Path(__file__).resolve().parent
(out / 'game.js').write_text(js, encoding='utf-8')
mons = re.search(r'<script id="monster-data" type="application/json">(.*?)</script>', src, re.S).group(1)
(out / 'mons.json').write_text(mons, encoding='utf-8')
print('game.js と mons.json を書き出しました')
