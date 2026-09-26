#!/usr/bin/env python3
"""錬金術の画面: 拠点はボタンだけ、押すと作りたい素材の一覧、選ぶと必要な素材・ゴールドと個数、作れる。
使い方: CHROMIUM_PATH=/path/to/chrome python3 tools/alchemy_ui_test.py"""
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

async def main():
    with game_url() as url:
        async with async_playwright() as p:
            b = await p.chromium.launch(**LAUNCH)
            pg = await b.new_page(viewport={'width': 390, 'height': 820})
            await use_mock_auth(pg)
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(url); await pg.wait_for_timeout(900)
            await start_as_guest(pg)
            await pg.evaluate("""() => { clearGuideToast(); STATE.announceQueue = []; STATE.clearedStages = STAGES.filter(s => ['tu','q1','q2'].includes(s.tier)).map(s => s.id);
              STATE.items = { el_fire_1: 23, el_fire_2: 16 }; STATE.gold = 100000; saveState(); goto('base'); }""")
            await pg.wait_for_timeout(300)
            check('拠点の錬金術はボタンだけ(一覧は出さない)', await pg.locator('[data-open-alchemy]').count() == 1 and await pg.locator('[data-craft]').count() == 0)
            await pg.evaluate("() => document.querySelector('[data-open-alchemy]').click()"); await pg.wait_for_timeout(250)
            check('押すと錬金術の画面(作れる素材の一覧)', await pg.locator('.alchemy-modal [data-alc-pick]').count() == 27)
            await pg.evaluate("() => document.querySelector('[data-alc-pick=\"el_fire_2\"]').click()"); await pg.wait_for_timeout(200)
            r = await pg.locator('.alc-recipe').inner_text()
            check('選ぶと必要な素材とゴールドが出る(5個→1個)', '火の欠片 TierI' in r and '23 / 5' in r and '200' in r, r.replace('\n', ' ')[:120])
            await pg.screenshot(path=str(OUT / 'alchemy_recipe.png'))
            await pg.evaluate("() => document.querySelector('[data-alc-qty=\"max\"]').click()"); await pg.wait_for_timeout(150)
            await pg.evaluate("() => document.querySelector('[data-alc-make]').click()"); await pg.wait_for_timeout(200)
            check('最大(4個)作れる', await pg.evaluate("() => [getItem('el_fire_2'), getItem('el_fire_1')]") == [20, 3])
            await pg.evaluate("() => document.querySelector('[data-alc-pick=\"el_fire_3\"]').click()"); await pg.wait_for_timeout(150)
            r3 = await pg.locator('.alc-recipe').inner_text()
            check('まだ落ちないTierは15個→1個と表示', '15個 → 1個' in r3 and '20 / 15' in r3, r3.replace('\n', ' ')[:140])
            await pg.evaluate("() => document.querySelector('[data-alc-tier=\"4\"]').click()"); await pg.wait_for_timeout(150)
            check('Tierで絞り込める', await pg.locator('.alchemy-modal [data-alc-pick]').count() == 9)
            await pg.evaluate("() => document.querySelector('[data-alc-fam2=\"ro\"]').click()"); await pg.wait_for_timeout(150)
            check('種類(欠片・魂・証)を切り替えられる', await pg.locator('.alchemy-modal [data-alc-pick]').count() == 5)
            tops = []
            for fam in ['el', 'ro', 'sp']:
                await pg.evaluate(f"() => document.querySelector('[data-alc-fam2=\"{fam}\"]').click()"); await pg.wait_for_timeout(120)
                tops.append(await pg.evaluate("() => Math.round(document.querySelector('.alchemy-modal').getBoundingClientRect().top)"))
            check('種類を切り替えても画面の上の位置が動かない(上揃い)', len(set(tops)) == 1, tops)
            await pg.evaluate("() => document.querySelector('[data-alc-close]').click()"); await pg.wait_for_timeout(150)
            check('戻ると拠点', await pg.evaluate("() => !alchemyUI && currentScreen === 'base'"))
            check('JSエラーなし', not errs, errs[:3])
            await b.close()
    print('NG' if bad else 'すべて通過')
    return bad
sys.exit(asyncio.run(main()))
