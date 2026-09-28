#!/usr/bin/env python3
"""docs/提案資料/凸ボーナス案_★5キャラ.md を、確認ツールで使える形(JSON)にする。

md のほうが正。ここは読み取り専用で、md を書き換えたら流し直す。

使い方: python3 tools/gen_perkdata.py > perks.js
"""
import io, re, json, sys, os

os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
SRC = 'docs/提案資料/凸ボーナス案_★5キャラ.md'
s = io.open(SRC, encoding='utf-8').read()

# 段ごとの役割の表
frame = []
m = re.search(r'\*\*段ごとの役割\*\*\s*\n\s*\n\|[^\n]*\n\|[^\n]*\n((?:\|[^\n]*\n)+)', s)
for row in re.findall(r'\|([^|\n]+)\|([^|\n]+)\|([^|\n]+)\|', m.group(1)):
    frame.append([c.strip() for c in row])

# 方針の箇条書き
rules = re.findall(r'^- (.+)$', s[s.index('**スキルLvとかぶらないように**'):s.index('## ★5キャラの案')], re.M)
kabu = re.search(r'\*\*スキルLvとかぶらないように\*\*: (.+)', s).group(1).strip()
rules.insert(0, kabu)

# キャラごと
chars = []
for blk in re.split(r'\n### ', s)[1:]:
    head, rest = blk.split('\n', 1)
    mh = re.match(r'(.+?)（(.+?)・(.+?)）', head.strip())
    if not mh:
        continue
    lead = ''
    ml = re.search(r'^\s*\n(.+?)\n', rest)
    if ml:
        lead = ml.group(1).strip()
    perks = [[a.strip(), b.strip()] for a, b in re.findall(r'\|\s*(★\d+)\s*\|([^|\n]+)\|', rest)]
    if len(perks) == 5:
        chars.append({'n': mh.group(1), 'el': mh.group(2), 'role': mh.group(3),
                      'lead': lead, 'perks': perks})

check = re.findall(r'^- \[ \] (.+)$', s, re.M)
out = {'source': SRC, 'frame': frame, 'rules': rules, 'chars': chars, 'check': check}
sys.stdout.write('/* ' + SRC + ' から tools/gen_perkdata.py が生成。数値の正は md のほう。 */\n'
                 'const PERKS = ' + json.dumps(out, ensure_ascii=False) + ';\n')
