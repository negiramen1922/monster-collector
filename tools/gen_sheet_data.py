#!/usr/bin/env python3
"""決定シート(Artifact)のデータファイルを docs/design/*.json から作り直す。
正はリポジトリのJSON。シート側を手で直さず、JSONを直してこれを走らせる。
出力: tools/sheet/chars4.js / perks.js / relics.js / burn.js
"""
import json, os, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
D = ROOT / 'docs' / 'design'
OUT = ROOT / 'tools' / 'sheet'
OUT.mkdir(exist_ok=True)

def load(name): return json.load(open(D / name, encoding='utf-8'))
def dump(path, var, obj, head):
    txt = f'/* {head} */\nconst {var} = ' + json.dumps(obj, ensure_ascii=False) + ';\n'
    (OUT / path).write_text(txt, encoding='utf-8')
    print(f'{path}  {len(txt)} bytes')

# ---- 05 ★4の相棒 ----
c4 = load('次回イベントの★4.json')
looks = {c['n']: c for c in load('次回イベントの★4_立ち絵設定.json')['chars']}
for c in c4['chars']:
    lk = looks.get(c['n'])
    if lk: c['look'] = lk
dump('chars4.js', 'C4', c4, 'docs/design/次回イベントの★4.json + 次回イベントの★4_立ち絵設定.json から。tools/gen_sheet_data.py が生成。')

# ---- 08 凸ボーナス ----
pk = load('凸ボーナス_ピックアップ4体.json')
dump('perks.js', 'PERKS', pk, 'docs/design/凸ボーナス_ピックアップ4体.json から。tools/gen_sheet_data.py が生成。')

# ---- 06 配布遺物 ----
dump('relics.js', 'RELIC2', load('配布遺物_風と闇.json'), 'docs/design/配布遺物_風と闇.json から。tools/gen_sheet_data.py が生成。')

# ---- 10 タイタンの必殺技 ----
dump('titan.js', 'TITAN', load('タイタンの必殺技_粗調整.json'), 'docs/design/タイタンの必殺技_粗調整.json から。tools/gen_sheet_data.py が生成。')

# ---- 09 やけどの重ねがけ ----
dump('burn.js', 'BURN', load('やけどの重ねがけ.json'), 'docs/design/やけどの重ねがけ.json から。tools/gen_sheet_data.py が生成。')
