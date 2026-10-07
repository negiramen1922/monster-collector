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
            check('3つの塔と10階ぶんのボタンが出る',
                  r['towers'] == ['tower:bal', 'tower:order', 'tower:chaos'] and r['floors'] == 10, r)
            check('まだ1階しか開いていない(2〜10階はロック)', r['locked'] == 9, r['locked'])
            check('1階の敵とステージ効果が出る', r['enemies'] >= 3 and r['start'], r)
            await pg.screenshot(path=str(OUT / 'babel_live.png'), full_page=True)

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

            # ---- 5. 2パーティ戦の表示 ----
            await pg.evaluate("""() => { STATE.clearedStages.push('bb_order_3', 'bb_order_4'); babelPickFloor = 5; render(); }""")
            await pg.wait_for_timeout(300)
            r = await pg.evaluate("""() => ({ head: document.querySelector('.bb-head').innerText,
                id: (document.querySelector('[data-start-stage^="bb_"]') || {}).dataset.startStage })""")
            check('5階は「2パーティ戦・前半」から', '前半' in r['head'] and r['id'] == 'bb_order_5_0', r)
            await pg.evaluate("""() => { STATE.clearedStages.push('bb_order_5_0');
                STATE.babelUsed = { stage: 'bb_order_5_0', ids: ['m05', 'm56', 'm148'] }; render(); }""")
            await pg.wait_for_timeout(300)
            r = await pg.evaluate("""() => ({ head: document.querySelector('.bb-head').innerText,
                id: (document.querySelector('[data-start-stage^="bb_"]') || {}).dataset.startStage,
                warn: (document.querySelector('.bb-problem') || {}).textContent || '',
                used: document.querySelectorAll('.bb-used img').length })""")
            check('前半に勝つと後半になり、前半で出した子が使えないと出る',
                  '後半' in r['head'] and r['id'] == 'bb_order_5_1' and '前半で出した' in r['warn'] and r['used'] == 3, r)
            await pg.screenshot(path=str(OUT / 'babel_live_two.png'), full_page=True)

            check('JSエラーなし', not errs, errs[:3])
            await b.close()
    print('NG' if bad else 'すべて通過')
    return bad

sys.exit(asyncio.run(main()))
