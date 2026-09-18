#!/usr/bin/env python3
"""図鑑の絞り込み・並び替えと、モンスター詳細の操作性の検証。

使い方: CHROMIUM_PATH=/path/to/chrome python3 ux_test.py
"""
import asyncio, os, pathlib
from playwright.async_api import async_playwright
from _serve import game_url, use_mock_auth, start_as_guest

OUT = pathlib.Path(__file__).resolve().parent
LAUNCH = {'executable_path': os.environ['CHROMIUM_PATH']} if os.environ.get('CHROMIUM_PATH') else {}
SETUP = """() => {
  MONSTERS.slice(0, 40).forEach((m, i) => STATE.owned[m.id] = { ...newOwned(m), star: m.rarity, level: 5 + i });
  STATE.owned['m128'] = { ...newOwned(MON_BY_ID['m128']), star: 3, level: 1, wall: 0 };
  STATE.items.exp3 = 900; STATE.gold = 500000;
  ['el_fire_1','ro_attacker_1','sp_draconia_1'].forEach(k => STATE.items[k] = 30);
  goto('dex'); render();
}"""

bad = 0
def check(name, cond, info=''):
    global bad
    bad += 0 if cond else 1
    print(('✅' if cond else '❌') + f' {name}' + (f'  {info}' if info != '' else ''))


async def main():
    with game_url() as url:
        async with async_playwright() as p:
            b = await p.chromium.launch(**LAUNCH)
            pg = await b.new_page(viewport={'width': 375, 'height': 667})
            await use_mock_auth(pg)
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(url)
            await pg.wait_for_timeout(1000)
            await start_as_guest(pg)
            await pg.evaluate(SETUP)
            await pg.wait_for_timeout(300)

            # ---- 図鑑: 並び替えと絞り込み ----
            keys = await pg.evaluate("() => [...document.querySelectorAll('[data-sort]')].map(b => b.dataset.sort)")
            check('図鑑に並び替えがある', keys == ['dex:no', 'dex:rarity', 'dex:level', 'dex:bp'], str(keys))
            first = lambda: pg.evaluate("() => [...document.querySelectorAll('.mon-cell .name')].slice(0,1)[0].textContent")
            before = await first()
            await pg.click('[data-sort="dex:bp"]')
            await pg.wait_for_timeout(300)
            check('並び替えが効く', await first() != before, f'{before} → {await first()}')
            await pg.click('[data-sort="dex:bp"]')
            await pg.wait_for_timeout(300)
            check('もう一度押すと逆順', '▲' in await pg.inner_text('[data-sort="dex:bp"]'))

            await pg.click('[data-rf-open="dex"]')
            await pg.wait_for_timeout(300)
            await pg.click('[data-rf-chip="elem:fire"]')
            await pg.wait_for_timeout(200)
            await pg.click('[data-rf-apply]')
            await pg.wait_for_timeout(400)
            shown = await pg.evaluate("() => document.querySelectorAll('.mon-cell').length")
            fire = await pg.evaluate("() => MONSTERS.filter(m => m.element === 'fire').length")
            check('属性で絞り込める', shown == fire, f'{shown} / 火属性{fire}体')
            check('絞り込み中だと分かる', '絞り込み(1)' in await pg.inner_text('[data-rf-open="dex"]'))
            await pg.click('[data-owned-toggle]')
            await pg.wait_for_timeout(300)
            owned_fire = await pg.evaluate("() => MONSTERS.filter(m => m.element === 'fire' && STATE.owned[m.id]).length")
            check('所持のみと併用できる', await pg.evaluate("() => document.querySelectorAll('.mon-cell').length") == owned_fire)
            await pg.click('[data-rf-clear="dex"]')
            await pg.click('[data-owned-toggle]')
            await pg.wait_for_timeout(300)
            check('解除で全部に戻る', await pg.evaluate("() => document.querySelectorAll('.mon-cell').length") == await pg.evaluate("() => MONSTERS.length"))

            # ---- モンスター詳細 ----
            await pg.evaluate("() => showMonsterDetail('m128')")
            await pg.wait_for_timeout(400)
            order = await pg.evaluate("() => [...document.querySelectorAll('.detail-modal > div')].map(d => d.className)")
            check('レベルアップが詳細の一番上にある', order[:3] == ['detail-head', 'upgrade-section-title', 'detail-level-box'], str(order[:4]))
            check('レベルで変わる数字が色つき', await pg.evaluate("() => document.querySelectorAll('.detail-stats .lv-stat').length") == 5)
            check('スキル説明の下に強化ボタンがある',
                  await pg.evaluate("() => document.querySelectorAll('.detail-skill-box .skill-upgrade [data-skill-up]').length") == 3)

            lv = lambda: pg.evaluate("() => STATE.owned.m128.level")
            await pg.click('[data-times="1"]')
            await pg.wait_for_timeout(300)
            check('タップで1レベル上がる', await lv() == 2, str(await lv()))
            await pg.evaluate("() => { document.querySelector('.detail-modal').scrollTop = 220; }")
            await pg.click('[data-times="1"]')
            await pg.wait_for_timeout(300)
            check('レベルアップしてもスクロール位置が戻らない',
                  await pg.evaluate("() => document.querySelector('.detail-modal').scrollTop") == 220)
            check('上がった数字が光る', await pg.evaluate("() => document.querySelectorAll('.detail-stats b.up').length") > 0)

            await pg.evaluate("() => { document.querySelector('.detail-modal').scrollTop = 0; }")
            box = await pg.locator('[data-times="1"]').bounding_box()
            await pg.mouse.move(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
            await pg.mouse.down()
            await pg.wait_for_timeout(1500)
            await pg.mouse.up()
            await pg.wait_for_timeout(400)
            check('長押しで連続レベルアップ', await lv() >= 6, f'Lv{await lv()}')
            check('壁で止まる', await lv() == 10, f'Lv{await lv()}')
            await pg.screenshot(path=str(OUT / 'ux_detail.png'))
            check('JSエラーなし', not errs, f'{len(errs)}件 {errs[:3]}')
            await b.close()
    raise SystemExit(1 if bad else 0)

asyncio.run(main())
