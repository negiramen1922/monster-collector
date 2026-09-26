#!/usr/bin/env python3
"""アイテム詳細の検証: スキル強化の素材・持ち物から開ける、入手手段と移動、閉じると元の画面に戻る。
使い方: CHROMIUM_PATH=/path/to/chrome python3 tools/item_detail_ui_test.py"""
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
            await pg.evaluate("""() => { clearGuideToast(); STATE.announceQueue = []; STATE.clearedStages = STAGES.filter(s => ['tu','q1','q2','q3','q4'].includes(s.tier)).map(s => s.id);
              STATE.owned.m54 = { star: 5, souls: 0, level: 120, exp: 0, skillLv: 7, skill2Lv: 1, ultLv: 1, passiveLv: 1 }; STATE.items = { el_earth_2: 3, box_sel_2: 1, exp2: 5 }; saveState();
              skillUpgradeModal = { id: 'm54', field: 'skillLv' }; renderSkillUpgradeModal(); }""")
            await pg.wait_for_timeout(200)
            key = await pg.evaluate("() => [...document.querySelectorAll('[data-cost-toggle]')].find(e => e.dataset.costToggle === 'el_earth_2').dataset.costToggle")
            await pg.evaluate("() => document.querySelector('[data-cost-toggle=\"el_earth_2\"]').click()"); await pg.wait_for_timeout(250)
            txt = await pg.locator('.item-detail').inner_text()
            check('スキル強化の素材を押すとアイテム詳細', key == 'el_earth_2' and '土の欠片 TierII' in txt and '所持数' in txt and '3' in txt, txt[:60])
            check('説明と入手手段(ステージ・錬金術・BOX)と移動ボタン', '入手手段' in txt and 'ドロップ' in txt and '錬金術' in txt and await pg.locator('[data-item-go]').count() >= 3)
            await pg.screenshot(path=str(OUT / 'item_detail.png'))
            await pg.evaluate("() => document.querySelector('.id-tiers [data-item-detail=\"el_earth_3\"]').click()"); await pg.wait_for_timeout(150)
            check('Tierを切り替えられる', await pg.evaluate("() => itemDetail.key") == 'el_earth_3')
            await pg.evaluate("() => document.querySelector('.id-tiers [data-item-detail=\"el_earth_2\"]').click()"); await pg.wait_for_timeout(150)
            n0 = await pg.evaluate("() => getItem('el_earth_2')")
            await pg.evaluate("() => { const i = itemSources(itemDetail.key).findIndex(s => s.go && s.go.type === 'usebox'); document.querySelectorAll('[data-item-go]')[i].click(); }"); await pg.wait_for_timeout(200)
            check('選択BOXを持っていればその場で使える', await pg.evaluate("() => getItem('el_earth_2')") == n0 + 5 and await pg.evaluate("() => !!itemDetail"))
            await pg.evaluate("() => document.querySelector('[data-item-detail-close]').click()"); await pg.wait_for_timeout(200)
            check('閉じるとスキル強化に戻る', await pg.locator('.skill-up-modal').count() == 1)
            await pg.evaluate("() => document.querySelector('[data-cost-toggle=\"el_earth_2\"]').click()"); await pg.wait_for_timeout(200)
            await pg.evaluate("() => document.querySelector('[data-item-go=\"0\"]').click()"); await pg.wait_for_timeout(400)
            st = await pg.evaluate("() => [currentScreen, stageSheet]")
            check('移動でそのステージの詳細が開く', st[0] == 'battle' and st[1] and await pg.evaluate("(id) => STAGE_BY_ID[id].drops.kinds.some(([f, k]) => f === 'el' && k === 'earth')", st[1]), st)
            await pg.evaluate("() => { closeModal(); stageSheet = null; bagTab = 'mat'; renderBag(); }"); await pg.wait_for_timeout(200)
            await pg.evaluate("() => document.querySelector('.bag-cell[data-item-detail^=\"el_earth\"]').click()"); await pg.wait_for_timeout(200)
            check('持ち物の素材からも開ける(持っているTier)', await pg.evaluate("() => itemDetail && itemDetail.key") == 'el_earth_2')
            await pg.evaluate("() => document.querySelector('[data-item-detail-close]').click()"); await pg.wait_for_timeout(200)
            check('閉じると持ち物に戻る', await pg.locator('.bag-modal').count() == 1)
            await pg.evaluate("() => { bagTab = 'grow'; renderBag(); document.querySelector('.bag-cell[data-item-detail=\"exp2\"]').click(); }"); await pg.wait_for_timeout(200)
            t2 = await pg.locator('.item-detail').inner_text()
            check('EXPポットも入手手段つきで開ける', 'EXPポット' in t2 and 'EXPダンジョン' in t2)
            check('JSエラーなし', not errs, errs[:3])
            await b.close()
    print('NG' if bad else 'すべて通過')
    return bad
sys.exit(asyncio.run(main()))
