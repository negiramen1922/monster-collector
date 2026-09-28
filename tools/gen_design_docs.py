#!/usr/bin/env python3
"""docs/design/*.json から、読む用の設計資料(md)を作り直す。

数値の正は docs/design/*.json のほう。mdは人が読むための出力で、
手で直すと必ずずれるので、必ずこのツールで作り直すこと。

使い方: python3 tools/gen_design_docs.py
"""
import json, io, os

D = 'docs/design/'
OUT = 'docs/'
EL = {'炎':'火','地':'土'}   # 資料の表記ゆれをゲーム側の言い方に寄せる
ROLE = {'attacker':'アタッカー','shooter':'シューター','support':'サポート',
        'tank':'タンク','trickster':'トリックスター'}

def load(name):
    return json.load(io.open(D + name, encoding='utf-8'))['data']

def monsters():
    mons = load('新規モンスター30体.json')
    atk = load('新規キャラの攻撃タイプ.json')
    smap = json.load(io.open('tools/sprite_map.json', encoding='utf-8'))
    L = ['# 新規モンスター設計資料', '',
         'このファイルは `docs/design/新規モンスター30体.json` から `tools/gen_design_docs.py` が',
         '作っています。**数値を直すときは json のほうを直してから作り直してください。**',
         '手でこのmdを書き換えても、次に作り直したときに消えます。', '',
         '全%d体。★5が%d体、★4が%d体、★3が%d体。' % (
             len(mons), *[sum(1 for m in mons if m['star'] == s) for s in (5, 4, 3)]), '']
    nostat = [m['n'] for m in mons if m.get('nostat')]
    noart = smap.get('missing', [])
    if nostat:
        L += ['> **ステータス未確定: %s** — 決めてから実装してください。' % '・'.join(nostat), '']
    if noart:
        L += ['> **立ち絵あり/なし** — %s は立ち絵が未収録です(他は sprite-data に収録ずみ)。' % '・'.join(noart), '']
    for star in (5, 4, 3):
        g = [m for m in mons if m['star'] == star]
        L += ['## ★%d (%d体)' % (star, len(g)), '']
        for m in g:
            sp = smap['map'].get(m['n'], {}).get('sprite')
            L += ['### %s (%s)' % (m['n'], m['key'])]
            head = ['%s属性' % EL.get(m['el'], m['el']), ROLE.get(m['role'], m['role']), m['sp']]
            if m.get('arch'): head.append(m['arch'])
            head.append('攻撃タイプ: %s' % atk.get(m['n'], '—'))
            head.append('立ち絵: %s' % ('sprite %s' % sp if sp else '**なし**'))
            if not m.get('ok'): head.append('**未承認**')
            L += ['- ' + ' / '.join(head)]
            st = m.get('st')
            if st:
                L += ['- HP%d / STR%d / 物防%d / 魔防%d / SPD%d / HATE%d'
                      % (st['hp'], st['str'], st['pdef'], st['mdef'], st['spd'], st['hate'])]
            else:
                L += ['- **ステータス未確定**']
            for row in m.get('k', []):
                L += ['- %s「%s」: %s' % (row[0], row[1], row[2])]
            if m.get('reqd'):
                L += ['- メモ: %s' % m['reqd']]
            L += ['']
    return '\n'.join(L)

def relics():
    rl = load('新規遺物56種.json')
    L = ['# 新規遺物設計資料', '',
         'このファイルは `docs/design/新規遺物56種.json` から `tools/gen_design_docs.py` が',
         '作っています。**数値を直すときは json のほうを直してから作り直してください。**', '',
         '全%d種。' % len(rl) +
         ' / '.join('★%d %d種' % (s, sum(1 for r in rl if r['star'] == s)) for s in (5, 4, 3, 2, 1)), '',
         '数値のルールは `docs/design/遺物スキル枠のルール.json` と',
         '`docs/design/遺物ステータスの星別上限.json` を見てください。', '']
    for star in (5, 4, 3, 2, 1):
        g = [r for r in rl if r['star'] == star]
        if not g: continue
        L += ['## ★%d (%d種)' % (star, len(g)), '']
        for r in g:
            L += ['### %s (%s)' % (r['n'], r['key'])]
            L += ['- 対象: %s' % r.get('tgt', '—')]
            if r.get('base'): L += ['- 基礎ステータス: %s (プリセット%s)' % (r['base'], r.get('preset', '—'))]
            for f in r.get('fx', []):
                L += ['- 効果[%s] %s %s → %s' % (f[0], f[1], f[2], f[3])]
            if r.get('lore'): L += ['- 由来: %s' % r['lore']]
            if r.get('reqd'): L += ['- メモ: %s' % r['reqd']]
            L += ['']
    return '\n'.join(L)

if __name__ == '__main__':
    for name, body in (('新規モンスター設計資料.md', monsters()), ('新規遺物設計資料.md', relics())):
        io.open(OUT + name, 'w', encoding='utf-8').write(body)
        print('%s を作り直しました (%d行)' % (name, body.count('\n') + 1))
