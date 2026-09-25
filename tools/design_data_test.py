#!/usr/bin/env python3
"""docs/design/*.json が壊れていないか、md がずれていないかを見る。

前に「最新の数値は確認ツールにある」という状態で引き継いだら、
md が古いまま残っていて別のチャットが止まった。同じことを繰り返さないため、
json を正として md が追従しているかを機械で確かめる。

使い方: python3 tools/design_data_test.py
"""
import json, io, sys, importlib.util

bad = 0
def check(name, cond, info=''):
    global bad
    bad += 0 if cond else 1
    print(('✅' if cond else '❌') + ' ' + name + (('  %s' % (info,)) if info != '' else ''))

def load(name):
    return json.load(io.open('docs/design/' + name, encoding='utf-8'))['data']

mons = load('新規モンスター30体.json')
relics = load('新規遺物56種.json')
smap = json.load(io.open('tools/sprite_map.json', encoding='utf-8'))

print('--- 1. 件数 ---')
check('新キャラは30体', len(mons) == 30, len(mons))
check('★5/★4/★3 の内訳は 6/11/13',
      [sum(1 for m in mons if m['star'] == s) for s in (5, 4, 3)] == [6, 11, 13],
      [sum(1 for m in mons if m['star'] == s) for s in (5, 4, 3)])
check('新遺物は56種', len(relics) == 56, len(relics))
check('★5/★4/★3/★2/★1 の内訳は 13/18/15/5/5',
      [sum(1 for r in relics if r['star'] == s) for s in (5, 4, 3, 2, 1)] == [13, 18, 15, 5, 5],
      [sum(1 for r in relics if r['star'] == s) for s in (5, 4, 3, 2, 1)])

print('\n--- 2. キャラのデータがそろっているか ---')
nostat = [m['n'] for m in mons if m.get('nostat')]
noSt = [m['n'] for m in mons if not m.get('st') and not m.get('nostat')]
check('ステータスの抜けは nostat のものだけ', not noSt, noSt)
print('   ステータス未確定: %s' % (nostat or 'なし'))
need = ('hp', 'str', 'pdef', 'mdef', 'spd', 'hate')
lack = [m['n'] for m in mons if m.get('st') and any(k not in m['st'] for k in need)]
check('ステータスの項目がすべてそろっている', not lack, lack)
noKit = [m['n'] for m in mons if len(m.get('k', [])) < 5]
check('全員に通常・スキル1・スキル2・パッシブ・必殺技がある', not noKit, noKit)
dupKey = [m['key'] for m in mons if [x['key'] for x in mons].count(m['key']) > 1]
check('key の重複がない', not dupKey, dupKey)

print('\n--- 3. 立ち絵の対応 ---')
names = set(m['n'] for m in mons)
mapped = set(smap['map'])
missing = set(smap['missing'])
check('対応表のキャラはすべて実在する', mapped <= names, mapped - names)
check('立ち絵ありとなしで30体すべてを覆っている', mapped | missing == names,
      names - (mapped | missing))
check('立ち絵ありとなしが重複していない', not (mapped & missing), mapped & missing)
nums = [v['sprite'] for v in smap['map'].values()]
check('スプライト番号の重複がない', len(nums) == len(set(nums)))
print('   立ち絵なし: %s' % (sorted(missing) or 'なし'))

print('\n--- 4. 遺物のデータ ---')
noFx = [r['n'] for r in relics if not r.get('fx')]
check('全種に効果がある', not noFx, noFx)
noBase = [r['n'] for r in relics if not r.get('base')]
check('全種に基礎ステータスがある', not noBase, noBase)
dupR = [r['key'] for r in relics if [x['key'] for x in relics].count(r['key']) > 1]
check('key の重複がない', not dupR, dupR)

print('\n--- 5. md が json に追従しているか ---')
spec = importlib.util.spec_from_file_location('gd', 'tools/gen_design_docs.py')
gd = importlib.util.module_from_spec(spec); spec.loader.exec_module(gd)
for name, body in (('新規モンスター設計資料.md', gd.monsters()), ('新規遺物設計資料.md', gd.relics())):
    cur = io.open('docs/' + name, encoding='utf-8').read()
    check('%s が最新' % name, cur == body,
          '' if cur == body else 'python3 tools/gen_design_docs.py で作り直してください')

print('\n' + ('NG' if bad else 'すべて通過'))
sys.exit(1 if bad else 0)
