#!/usr/bin/env python3
"""立ち絵PNGを index.html の sprite-data に取り込む。

既存105体と同じ形(256x256のwebp・透明背景・余白5px前後)に揃える。
透明部分を切り落としてから長辺246pxに収め、256x256の中央に置く。
どれが誰かの対応は tools/sprite_map.json(tools/match_sprites.py が作る)。

使い方: python3 tools/add_sprites.py [--dry]
"""
import json, io, base64, sys, re
from PIL import Image

SIZE, INNER = 256, 246
TARGET_KB = 26          # 1体あたりの目安。既存は8〜22KB

def fit(path):
    im = Image.open(path).convert('RGBA')
    bb = im.getbbox()                      # 透明な縁を落とす
    if bb: im = im.crop(bb)
    im.thumbnail((INNER, INNER), Image.LANCZOS)
    out = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    out.alpha_composite(im, ((SIZE - im.width) // 2, (SIZE - im.height) // 2))
    return out

def encode(im):
    """既存と同じくらいの容量に収まる最大の品質を選ぶ。"""
    for q in (82, 74, 66, 58, 50, 42):
        buf = io.BytesIO()
        im.save(buf, 'WEBP', quality=q, method=6)
        if len(buf.getvalue()) <= TARGET_KB * 1024 or q == 42:
            return buf.getvalue(), q
    raise AssertionError

def main(dry=False):
    m = json.load(io.open('tools/sprite_map.json', encoding='utf-8'))
    s = io.open('index.html', encoding='utf-8').read()
    i = s.find('id="sprite-data"'); j = s.find('>', i) + 1; k = s.find('</script>', j)
    data = json.loads(s[j:k])
    before = len(data)

    total = 0
    for name, v in m['map'].items():
        raw, q = encode(fit(v['file']))
        data[v['sprite']] = 'data:image/webp;base64,' + base64.b64encode(raw).decode()
        total += len(raw)
        print('  %-12s %-18s → sprite %s  %4dKB (品質%d)' % (name, v['file'], v['sprite'], len(raw) // 1024, q))
    print('%d体 → %d体 (+%d)  追加ぶん %dKB' % (before, len(data), len(data) - before, total // 1024))
    if m['missing']:
        print('立ち絵がまだ無い:', m['missing'])
    if dry: return
    s = s[:j] + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + s[k:]
    io.open('index.html', 'w', encoding='utf-8').write(s)
    print('index.html を更新しました')

if __name__ == '__main__':
    main('--dry' in sys.argv)
