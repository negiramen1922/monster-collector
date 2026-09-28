#!/usr/bin/env python3
"""立ち絵のファイル名(連番)と、どのモンスターの絵かを突き合わせる。

アップロードされた立ち絵は sprite_1308.png のような連番で、名前が分からない。
確認ツール側のサムネイル(scratchpad/thumbs.json、名前がキー)と、画像の指紋
(16x16に潰した明暗パターン)で照合して対応を確定する。拡大縮小やwebp圧縮では
変わらない指紋なので、別経路で作られたサムネイルとも一致する。

結果は tools/sprite_map.json に書く。距離が離れている組は当てにならないので
除外し、missing に落とす(= まだ絵が無いキャラ)。

使い方: python3 tools/match_sprites.py [thumbs.json のパス]
"""
import json, io, base64, glob, os, sys
from PIL import Image

def sig(im, n=16):
    """縦横n分割の明暗パターン。平均より明るいマスを1にしたもの。"""
    im = im.convert('RGBA')
    bg = Image.new('RGBA', im.size, (0, 0, 0, 255))
    im = Image.alpha_composite(bg, im).convert('L').resize((n, n), Image.LANCZOS)
    px = list(im.tobytes())
    m = sum(px) / len(px)
    return [1 if v > m else 0 for v in px]

def dist(a, b):
    return sum(x != y for x, y in zip(a, b))

# mn01..mn30 の順。ここに並べた順でスプライト番号を振る(既存の最後が135)
ORDER = ['バハムート','リヴァイアサン','グリーンマン','アバドン','タロース','フェニクス','メデューサ',
 'セルキー','ブロック','ヘパイストス','アイオロス','ドラウグル','ペルセウス','アヌビス','ロキ','アグニ',
 'メリュジーヌ','ドリュアス','シームルグ','アルヴィス','土蜘蛛','雷獣','ゼピュロス','エオス','サキュバス',
 'バンシー','オルペウス','のっぺらぼう','コカトリス','死神']
FIRST_SPRITE = 136
MAX_DIST = 10   # これより離れていたら別の絵とみなす

def main(thumbs_path):
    thumbs = json.load(io.open(thumbs_path, encoding='utf-8'))
    T = {n: sig(Image.open(io.BytesIO(base64.b64decode(u.split(',', 1)[1]))))
         for n, u in thumbs.items()}
    F = {os.path.basename(f): sig(Image.open(f)) for f in sorted(glob.glob('sprite_*.png') + glob.glob('dreamina-*.png'))}
    print('サムネイル %d件 / 立ち絵 %d件' % (len(T), len(F)))

    hit = {}
    for name, t in T.items():
        cand = sorted((dist(t, s), f) for f, s in F.items())
        d, f = cand[0]
        gap = cand[1][0] - d if len(cand) > 1 else 99
        if d <= MAX_DIST and gap >= 15:
            hit[name] = f
            print('  %-12s %-18s 距離%2d (2位まで+%d)' % (name, f, d, gap))
        else:
            print('  %-12s 一致なし(最も近くて距離%d)' % (name, d))

    # 既に番号を振ったキャラは番号を変えない(index.html 側の sprite-data がずれるため)。
    # 新しく見つかったキャラだけ、いまの最大番号の次から振る
    try:
        prev = json.load(io.open('tools/sprite_map.json', encoding='utf-8'))['map']
    except (OSError, ValueError, KeyError):
        prev = {}
    n = max([FIRST_SPRITE - 1] + [int(v['sprite']) for v in prev.values()])
    out, missing = {}, []
    for name in ORDER:
        # 手で決めた対応(sprite_map.json に書いたもの)を照合結果より優先する
        f = (prev.get(name) or {}).get('file') or hit.get(name)
        if not f:
            missing.append(name); continue
        if name in prev:
            out[name] = {'file': f, 'sprite': prev[name]['sprite']}
        else:
            n += 1
            out[name] = {'file': f, 'sprite': str(n)}
    json.dump({'note': '新モンスターの立ち絵と、index.html の sprite-data に入れる番号の対応。'
                       'ファイル名が連番で中身が分からないため、確認ツールのサムネイルと'
                       '画像の指紋で突き合わせて確定した(tools/match_sprites.py)。',
               'map': out, 'missing': missing},
              io.open('tools/sprite_map.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('\n確定 %d件 / 立ち絵なし %s' % (len(out), missing))
    used = set(v['file'] for v in out.values())
    rest = [f for f in F if f not in used]
    if rest:
        print('どのキャラにも割り当たらなかった立ち絵:', rest)

if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'tools/thumbs.json')
