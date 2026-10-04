#!/usr/bin/env python3
"""バベル試験場(index.html?lab=babel): 本番のセーブに触れず、全モンスターを好きな育ちで組んで
バベルの各階と戦える(観戦・連続テスト)。
使い方: CHROMIUM_PATH=/path/to/chrome python3 tools/babel_lab_ui_test.py"""
import asyncio, os, pathlib
from playwright.async_api import async_playwright
from _serve import game_url

OUT = pathlib.Path(os.environ.get('SHOT_DIR', '/tmp'))
LAUNCH = {'executable_path': os.environ['CHROMIUM_PATH']} if os.environ.get('CHROMIUM_PATH') else {}
bad = 0
def check(name, cond, info=''):
    global bad
    bad += 0 if cond else 1
    print(('✅' if cond else '❌') + f' {name}' + (f'  {info}' if info != '' else ''))

async def main():
    with game_url() as url:
        async with async_playwright() as p:
            b = await p.chromium.launch(**LAUNCH)
            pg = await b.new_page(viewport={'width': 390, 'height': 844})
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(url + '?lab=babel'); await pg.wait_for_timeout(1200)
            r = await pg.evaluate("""() => ({ screen: currentScreen, lab: !!document.querySelector('.lab'), acct: ACCOUNT, saved: localStorage.getItem('monster-game-state'),
              owned: Object.keys(STATE.owned).length, all: MONSTERS.length, slots: document.querySelectorAll('.lab-slot img').length,
              enemies: document.querySelectorAll('.lab-en').length, nav: getComputedStyle(document.getElementById('nav')).display })""")
            check('ログインなしで試験場が開き、全モンスターが使える', r['lab'] and r['screen'] == 'lab' and r['acct'] is None and r['owned'] == r['all'], r)
            check('1階の敵と、勝てる想定の編成が最初から入っている', r['enemies'] == 10 and r['slots'] == 5, r)
            check('下のメニューは出さない', r['nav'] == 'none', r)
            await pg.screenshot(path=str(OUT / 'lab_top.png'), full_page=True)
            # 連続テスト
            await pg.click('[data-lab="sim:20"]')
            await pg.wait_for_function("() => lab.sim && lab.sim.done === 20 && !labSimming", timeout=60000)
            r = await pg.evaluate("() => ({ wins: lab.sim.rows.filter(x => x.win).length, err: lab.sim.rows.flatMap(x => x.parts).filter(p => p.error).map(p => p.error), rate: (document.querySelector('.lab-rate b') || {}).textContent, screen: currentScreen, saved: localStorage.getItem('monster-game-state') })")
            check('20回まわすと勝率が出る(エラーなし)', not r['err'] and r['rate'] and r['screen'] == 'lab', r)
            check('本番のセーブには何も書かない', r['saved'] is None, r)
            await pg.screenshot(path=str(OUT / 'lab_sim.png'), full_page=True)
            # 陽の塔: 使えないモンスターは選べない・編成にいたら警告
            await pg.click('[data-lab="tower:yo"]'); await pg.wait_for_timeout(200)
            await pg.click('[data-lab="hint:win"]'); await pg.wait_for_timeout(200)
            await pg.click('[data-lab="pick:0:0"]'); await pg.wait_for_timeout(200)
            r = await pg.evaluate("""() => ({ dis: document.querySelector('[data-lab="set:m61"]').disabled, ok: document.querySelector('[data-lab="set:m15"]').disabled,
              editor: !!document.querySelector('.lab-editor') })""")
            check('陽の塔では水属性(イエティ)は選べず、無属性(グリズリー)は選べる', r['editor'] and r['dis'] and not r['ok'], r)
            await pg.click('[data-lab="set:m15"]'); await pg.wait_for_timeout(150)
            await pg.click('[data-lab="adj:star:1"]'); await pg.click('[data-lab="adj:sk:1"]'); await pg.click('[data-lab="adj:rune:1"]'); await pg.wait_for_timeout(150)
            r = await pg.evaluate("() => lab.parties[0][0]")
            check('モンスターを入れ替えて、★・スキルLv・ルーンを1つずつ変えられる', r['id'] == 'm15' and r['star'] >= 4 and r['sk'] >= 2 and r['rune'] >= 1, r)
            await pg.screenshot(path=str(OUT / 'lab_editor.png'), full_page=True)
            # 超上級: ★10・スキルLv12・ルーンⅩ・遺物カンスト(合う遺物を自動で)
            await pg.click('[data-lab="grow:3"]'); await pg.wait_for_timeout(200)
            r = await pg.evaluate("() => lab.parties[0].filter(Boolean).map(s => [s.star, s.sk, s.rune, !!s.relic, s.rlv])")
            check('超上級にすると全員 ★10・スキルLv12・ルーンⅩ・遺物Lv200(遺物つき)', len(r) > 0 and all(x == [10, 12, 10, True, 200] for x in r), r)
            await pg.evaluate("() => { lab.pick = { p: 0, i: 0 }; render(); }"); await pg.wait_for_timeout(200)
            r = await pg.evaluate("() => ({ sel: document.getElementById('lab-relic').value, note: document.querySelector('.lab-relic-note').textContent })")
            check('編集欄で遺物を選べて、カンスト(スキルLv10・4凸)と出る', r['sel'] != '' and 'スキルLv10' in r['note'] and '4凸' in r['note'], r)
            await pg.screenshot(path=str(OUT / 'lab_ultra.png'), full_page=True)
            await pg.select_option('#lab-relic', '')
            await pg.wait_for_timeout(200)
            check('遺物を「なし」にできる', await pg.evaluate("() => lab.parties[0][0].relic === null && lab.parties[0][0].rlv === 0"))
            await pg.click('[data-lab="sim:20"]')
            await pg.wait_for_function("() => lab.sim && lab.sim.done === 20 && !labSimming", timeout=90000)
            r = await pg.evaluate("() => lab.sim.rows.flatMap(x => x.parts).filter(p => p.error).length")
            check('超上級でも連続テストが動く', r == 0, r)
            await pg.click('[data-lab="close"]')
            # 2パーティ戦: 前半と後半に同じ子がいると戦えない
            await pg.click('[data-lab="tower:ten"]'); await pg.click('[data-lab="floor:5"]'); await pg.wait_for_timeout(150)
            await pg.click('[data-lab="hint:win"]'); await pg.wait_for_timeout(150)
            r = await pg.evaluate("() => ({ halves: document.querySelectorAll('.lab-party').length, ok: labProblem(0) + '|' + labProblem(1), en: document.querySelectorAll('.lab-half').length })")
            check('5階は前半・後半の2つの編成と、それぞれの敵が出る', r['halves'] == 2 and r['en'] == 2 and r['ok'] == '|', r)
            dup = await pg.evaluate("() => { lab.parties[1][0] = { ...lab.parties[0][0] }; return labProblem(1); }")
            check('前半と後半に同じモンスターがいると戦えない', '同じモンスター' in dup, dup)
            await pg.evaluate("() => { labHint('win'); render(); }")
            await pg.click('[data-lab="sim:20"]')
            await pg.wait_for_function("() => lab.sim && lab.sim.done === 20 && !labSimming", timeout=90000)
            r = await pg.evaluate("() => ({ parts: lab.sim.rows.map(x => x.parts.length), err: lab.sim.rows.flatMap(x => x.parts).filter(p => p.error).length })")
            check('2パーティ戦の連続テストは、前半に勝ったら後半も戦う', r['err'] == 0 and max(r['parts']) <= 2, r)
            await pg.screenshot(path=str(OUT / 'lab_2p.png'), full_page=True)
            # 観戦: 戦闘画面になり、終わると結果 → 試験場に戻る
            await pg.click('[data-lab="floor:1"]'); await pg.wait_for_timeout(150)
            await pg.click('[data-lab="hint:win"]'); await pg.wait_for_timeout(150)
            await pg.evaluate("() => { STATE.battleSpeed = 4; }")
            await pg.click('[data-lab="watch:0"]'); await pg.wait_for_timeout(1500)
            r = await pg.evaluate("() => ({ screen: currentScreen, lv: battleUI && battleUI.party.map(u => u.level), elv: battleUI && battleUI.enemies.map(u => u.level) })")
            check('観戦すると戦闘画面になり、味方も敵もLv200', r['screen'] == 'battle-fight' and set(r['lv']) == {200} and set(r['elv']) == {200}, r)
            await pg.screenshot(path=str(OUT / 'lab_battle.png'))
            await pg.wait_for_selector('.lab-result', timeout=120000)
            await pg.screenshot(path=str(OUT / 'lab_result.png'))
            await pg.click('[data-lab="back"]'); await pg.wait_for_timeout(300)
            r = await pg.evaluate("() => ({ screen: currentScreen, lab: !!document.querySelector('.lab'), saved: localStorage.getItem('monster-game-state'), mem: !!localStorage.getItem('monster-game-lab-babel') })")
            check('結果から試験場に戻れる。編成は試験場用にだけ覚える', r['screen'] == 'lab' and r['lab'] and r['saved'] is None and r['mem'], r)
            # ふつうに開いたときは試験場にならない
            pg2 = await b.new_page(viewport={'width': 390, 'height': 844})
            await pg2.goto(url); await pg2.wait_for_timeout(900)
            r = await pg2.evaluate("() => ({ lab: LAB_MODE, el: !!document.querySelector('.lab') })")
            check('ふつうに開いたときは試験場にならない', not r['lab'] and not r['el'], r)
            await b.close()
    real = [e for e in errs if 'favicon' not in e]
    check('JSエラーなし', not real, real[:3])
    print('すべて通過' if bad == 0 else f'{bad}件 失敗')

asyncio.run(main())
