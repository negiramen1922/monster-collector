#!/usr/bin/env python3
"""バベルの塔(本番側)の画面。いまは index.html?babel=1 のときだけ探索メニューに出る。

使い方: CHROMIUM_PATH=/path/to/chrome python3 tools/babel_live_ui_test.py
"""
import asyncio, os, pathlib, sys
from playwright.async_api import async_playwright
from _serve import game_url, use_mock_auth, start_as_guest

OUT = pathlib.Path(os.environ.get('SHOT_DIR', '/tmp'))
LAUNCH = {'executable_path': os.environ['CHROMIUM_PATH']} if os.environ.get('CHROMIUM_PATH') else {}
bad = 0
def check(name, cond, info=''):
    global bad
    bad += 0 if cond else 1
    print(('✅' if cond else '❌') + f' {name}' + (f'  {info}' if info != '' else ''))

SETUP = """() => {
  STATE.crystals = 0; STATE.stamina = 200; STATE.announceQueue = [];
  STATE.guidesSeen = { welcome: true, monsterDetail: true };
  STATE.clearedStages = ['tu1','tu2','tu3','tu4','tu5'];
  for(const m of MONSTERS) if(!STATE.owned[m.id]) grantMonster(m);
  clearGuideToast(true); closeModal();
}"""


async def main():
    with game_url() as url:
        async with async_playwright() as p:
            b = await p.chromium.launch(**LAUNCH)

            # ---- 1. ふつうに開いたときは出さない ----
            pg = await b.new_page(viewport={'width': 390, 'height': 900})
            await use_mock_auth(pg)
            await pg.goto(url); await pg.wait_for_timeout(900)
            await start_as_guest(pg)
            await pg.evaluate(SETUP); await pg.wait_for_timeout(300)
            await pg.evaluate("() => { stageTab = 'menu'; goto('battle', { nav: true }); }")
            await pg.wait_for_timeout(400)
            check('ふつうに開くと探索メニューにバベルが出ない',
                  await pg.locator('[data-stage-tab="babel"]').count() == 0)
            await pg.close()

            # ---- 2. ?babel=1 のとき ----
            pg = await b.new_page(viewport={'width': 390, 'height': 1100})
            await use_mock_auth(pg)
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(url + '?babel=1'); await pg.wait_for_timeout(900)
            await start_as_guest(pg)
            await pg.evaluate(SETUP); await pg.wait_for_timeout(300)
            await pg.evaluate("() => { stageTab = 'menu'; goto('battle', { nav: true }); }")
            await pg.wait_for_timeout(400)
            check('?babel=1 だと探索メニューに出る', await pg.locator('[data-stage-tab="babel"]').count() == 1)
            await pg.click('[data-stage-tab="babel"]'); await pg.wait_for_timeout(500)

            r = await pg.evaluate("""() => ({
                towers: [...document.querySelectorAll('[data-babel^="tower:"]')].map(e => e.dataset.babel),
                floors: document.querySelectorAll('[data-babel^="floor:"]').length,
                locked: document.querySelectorAll('.lab-fl.locked').length,
                start: (document.querySelector('[data-start-stage^="bb_"]') || {}).dataset,
                enemies: document.querySelectorAll('.bb-en').length,
                rules: document.querySelectorAll('.bb-rule').length })""")
            check('3つの塔と、均衡の塔は10階ずつ(1〜10階)のボタンが出る',
                  r['towers'] == ['tower:bal', 'tower:order', 'tower:chaos'] and r['floors'] == 10, r)
            check('まだ1階しか開いていない(2〜10階はロック)', r['locked'] == 9, r['locked'])
            # ◀ ▶ で10階ずつ切り替える。最初のページは ◀ が押せない
            pg_ = await pg.evaluate("""() => ({ prev: document.querySelector('[data-babel="page:-1"]').disabled, label: document.querySelector('.bb-fl-pager span').textContent })""")
            check('最初は「1〜10階」で、◀ は押せない', pg_['prev'] is True and pg_['label'] == '1〜10階', pg_)
            await pg.click('[data-babel="page:1"]'); await pg.wait_for_timeout(250)
            pg_ = await pg.evaluate("""() => ({ label: document.querySelector('.bb-fl-pager span').textContent, first: document.querySelector('[data-babel^="floor:"]').dataset.babel, n: document.querySelectorAll('[data-babel^="floor:"]').length })""")
            check('▶ で「11〜20階」に切り替わる', pg_['label'] == '11〜20階' and pg_['first'] == 'floor:11' and pg_['n'] == 10, pg_)
            await pg.evaluate("() => { babelPage = 5; render(); }"); await pg.wait_for_timeout(200)
            check('最後のページ(51〜60階)は ▶ が押せない', await pg.evaluate("() => document.querySelector('[data-babel=\"page:6\"]').disabled"))
            await pg.evaluate("() => { babelPage = null; render(); }"); await pg.wait_for_timeout(200)
            check('メニューに出てくる敵の顔ぶれは出さない', r['enemies'] == 0 and r['start'], r)
            await pg.screenshot(path=str(OUT / 'babel_live.png'), full_page=True)
            # 均衡の塔: 前の10階のころのクリアは新しい1〜10階のクリアとして数え、11階から。ボスの階は「ボス戦」
            await pg.evaluate("""() => { for(let f = 1; f <= 10; f++) STATE.clearedStages.push('bb_bal_' + f); babelPickFloor = 0; render(); }""")
            await pg.wait_for_timeout(300)
            r = await pg.evaluate("""() => ({ id: (document.querySelector('[data-start-stage^="bb_"]') || {}).dataset.startStage,
                done: document.querySelectorAll('.lab-fl.done').length, boss: document.querySelectorAll('.lab-fl.boss').length,
                tab: document.querySelector('[data-babel="tower:bal"]').innerText })""")
            check('前の均衡の塔10階をクリアしたセーブは11階から挑める(10/60)。ページは11〜20階', r['id'] == 'bb_bal_11' and r['done'] == 0 and r['boss'] == 2 and '10/60' in r['tab'], r)
            await pg.evaluate("() => { babelPickFloor = 10; render(); }"); await pg.wait_for_timeout(250)
            r = await pg.evaluate("""() => ({ head: document.querySelector('.bb-head').innerText, boss: document.querySelectorAll('.bb-en.boss').length,
                reward: document.querySelector('.ab-reward').innerText })""")
            check('均衡の塔の10階は「ボス戦」と出る(敵の顔ぶれは出さない)', 'ボス戦' in r['head'] and r['boss'] == 0, r)
            await pg.evaluate("() => { STATE.clearedStages = STATE.clearedStages.filter(id => !id.startsWith('bb_bal_')); babelPickFloor = 0; render(); }")

            # ---- 3. 編成のしばり ----
            await pg.click('[data-babel="tower:order"]'); await pg.wait_for_timeout(300)
            await pg.evaluate("""() => { STATE.slots = ['m15', 'm61', null, null, null, null]; render(); }""")
            await pg.wait_for_timeout(300)
            r = await pg.evaluate("""() => ({ warn: (document.querySelector('.bb-problem') || {}).textContent || '',
                dis: (document.querySelector('[data-start-stage^="bb_"]') || {}).disabled })""")
            check('秩序の塔に混沌の種族を入れると出撃ボタンが押せない',
                  '使えない' in r['warn'] and r['dis'] is True, r)
            await pg.evaluate("""() => { STATE.slots = ['m05', 'm56', 'm148', null, null, null]; render(); }""")
            await pg.wait_for_timeout(300)
            r = await pg.evaluate("""() => ({ warn: (document.querySelector('.bb-problem') || {}).textContent || '',
                dis: (document.querySelector('[data-start-stage^="bb_"]') || {}).disabled })""")
            check('秩序の種族だけなら出撃できる', r['warn'] == '' and r['dis'] is False, r)

            # ---- 4. 塔と階の切り替え ----
            await pg.evaluate("""() => { STATE.clearedStages.push('bb_order_1', 'bb_order_2'); render(); }""")
            await pg.wait_for_timeout(300)
            r = await pg.evaluate("""() => ({ done: document.querySelectorAll('.lab-fl.done').length,
                locked: document.querySelectorAll('.lab-fl.locked').length,
                open: babelOpenFloor('order') })""")
            check('クリアした階に印が付き、次の階が開く', r['done'] == 2 and r['open'] == 3 and r['locked'] == 7, r)
            await pg.click('[data-babel="floor:5"]'); await pg.wait_for_timeout(300)
            check('まだ開いていない階は「◯階をクリアすると開きます」',
                  '開きます' in await pg.evaluate("() => document.querySelector('.bb-card').innerText"))
            await pg.click('[data-babel="floor:3"]'); await pg.wait_for_timeout(300)
            r = await pg.evaluate("""() => ({ id: (document.querySelector('[data-start-stage^="bb_"]') || {}).dataset,
                txt: document.querySelector('.bb-head').innerText })""")
            check('開いている階は出撃できる', r['id'] and r['id']['startStage'] == 'bb_order_3', r)

            # ---- 5. 5階(ステージ効果)と10階(特殊ステージ) ----
            await pg.evaluate("""() => { STATE.clearedStages.push('bb_order_3', 'bb_order_4'); babelPickFloor = 5; render(); }""")
            await pg.wait_for_timeout(300)
            r = await pg.evaluate("""() => ({ head: document.querySelector('.bb-head').innerText,
                id: (document.querySelector('[data-start-stage^="bb_"]') || {}).dataset.startStage,
                rules: document.querySelectorAll('.bb-rule').length })""")
            check('5階は「ステージ効果」と出て、効果が並ぶ',
                  'ステージ効果' in r['head'] and r['id'] == 'bb_order_5' and r['rules'] >= 3, r)
            await pg.evaluate("() => { babelPickFloor = 3; render(); }"); await pg.wait_for_timeout(250)
            r = await pg.evaluate("""() => ({ head: document.querySelector('.bb-head').innerText,
                rules: document.querySelectorAll('.bb-rule').length })""")
            check('ふつうの階は印なし・ステージ効果は塔の底上げだけ',
                  'ステージ効果' not in r['head'] and '特殊' not in r['head'] and r['rules'] <= 1, r)
            await pg.evaluate("""() => { for(let f = 5; f <= 9; f++) STATE.clearedStages.push('bb_order_' + f);
                babelPickFloor = 10; render(); }""")
            await pg.wait_for_timeout(300)
            r = await pg.evaluate("""() => ({ head: document.querySelector('.bb-head').innerText,
                id: (document.querySelector('[data-start-stage^="bb_"]') || {}).dataset.startStage,
                boss: document.querySelectorAll('.bb-en.boss').length })""")
            check('10階は「特殊ステージ」と出る(敵の顔ぶれは出さない)',
                  '特殊ステージ' in r['head'] and r['id'] == 'bb_order_10' and r['boss'] == 0, r)
            check('ステージIDに _0 / _1 が付かない',
                  await pg.evaluate("() => !document.querySelector('[data-start-stage$=\\'_0\\']')"))
            await pg.screenshot(path=str(OUT / 'babel_live_boss.png'), full_page=True)

            check('JSエラーなし', not errs, errs[:3])
            await pg.close()

            # ---- 3. ?babel=all(テスト用): 全部の階が最初から開いている ----
            pg = await b.new_page(viewport={'width': 390, 'height': 1100})
            await use_mock_auth(pg)
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(url + '?babel=all'); await pg.wait_for_timeout(900)
            await start_as_guest(pg)
            await pg.evaluate(SETUP); await pg.wait_for_timeout(300)
            await pg.evaluate("() => { stageTab = 'menu'; goto('battle', { nav: true }); }"); await pg.wait_for_timeout(400)
            await pg.click('[data-stage-tab="babel"]'); await pg.wait_for_timeout(500)
            r = await pg.evaluate("""() => ({ locked: document.querySelectorAll('.lab-fl.locked').length, note: (document.querySelector('.bb-floors .bb-problem') || {}).textContent || '' })""")
            check('?babel=all だと、まだクリアしていない階もロックされない', r['locked'] == 0 and '全部の階が開いています' in r['note'], r)
            await pg.evaluate("() => { babelPage = 5; babelPickFloor = 55; render(); }"); await pg.wait_for_timeout(300)
            r = await pg.evaluate("""() => ({ id: (document.querySelector('[data-start-stage^="bb_"]') || {}).dataset, unl: stageUnlocked(findStage('bb_bal_55')) })""")
            check('?babel=all だと、いきなり55階に挑戦できる', r['id'] and r['id']['startStage'] == 'bb_bal_55' and r['unl'] is True, r)
            check('JSエラーなし(?babel=all)', not errs, errs[:3])
            await b.close()
    print('NG' if bad else 'すべて通過')
    return bad

sys.exit(asyncio.run(main()))
