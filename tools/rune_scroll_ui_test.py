#!/usr/bin/env python3
"""ルーンの合成画面: 材料を選ぶ・合成するたびに描き直しても、画面が一番上に戻らない(閉じもしない)。
詳細 ⇄ 合成の切り替えのときだけ上から。
使い方: CHROMIUM_PATH=/path/to/chrome python3 tools/rune_scroll_ui_test.py"""
import asyncio, os, pathlib
from playwright.async_api import async_playwright
from _serve import game_url, use_mock_auth, start_as_guest

OUT = pathlib.Path(os.environ.get('SHOT_DIR', '/tmp'))
LAUNCH = {'executable_path': os.environ['CHROMIUM_PATH']} if os.environ.get('CHROMIUM_PATH') else {}
bad = 0
def check(name, cond, info=''):
    global bad
    bad += 0 if cond else 1
    print(('✅' if cond else '❌') + f' {name}' + (f'  {info}' if info != '' else ''))

ST = "() => ({ fuse: !!document.querySelector('.rf-cands'), main: !!document.querySelector('.rd-vbtns'), top: (document.querySelector('.rune-detail-modal') || {}).scrollTop })"

async def main():
    with game_url() as url:
        async with async_playwright() as p:
            b = await p.chromium.launch(**LAUNCH)
            pg = await b.new_page(viewport={'width': 390, 'height': 700})
            await use_mock_auth(pg)
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(url); await pg.wait_for_timeout(900)
            await start_as_guest(pg)
            uid = await pg.evaluate("""() => { clearGuideToast(); STATE.announceQueue = [];
              const a = addRune(makeRune(3, 4, 'mdef')); for(let i = 0; i < 45; i++) addRune(makeRune(1 + i % 3, i % 4, ['hp','pdef','mdef'][i % 3]));
              STATE.runeDust = 99999; addGold(9999999); saveState(); goto('runes'); render(); return a.uid; }""")
            await pg.wait_for_timeout(300)
            await pg.click(f'[data-rune-open="{uid}"]'); await pg.wait_for_timeout(250)
            await pg.click('[data-rune-view="fuse"]'); await pg.wait_for_timeout(250)
            await pg.evaluate("() => [...document.querySelectorAll('.rf-cand')].pop().scrollIntoView()")
            s0 = await pg.evaluate(ST)
            await pg.evaluate("() => [...document.querySelectorAll('.rf-cand')].pop().click()"); await pg.wait_for_timeout(250)
            s1 = await pg.evaluate(ST)
            check('材料を選んでも閉じず、見ていた場所のまま', s0['top'] > 100 and s1['fuse'] and abs(s1['top'] - s0['top']) < 5, [s0, s1])
            await pg.evaluate("() => { document.querySelectorAll('.rf-cand.on').forEach(b => b.click()); }"); await pg.wait_for_timeout(150)
            await pg.evaluate("() => document.querySelector('[data-rune-fuse-auto]').click()"); await pg.wait_for_timeout(200)
            await pg.evaluate("() => document.querySelector('[data-rune-fuse-go]').scrollIntoView()")
            s2 = await pg.evaluate(ST)
            tier0 = await pg.evaluate(f"() => runeByUid('{uid}').tier")
            await pg.evaluate("() => document.querySelector('[data-rune-fuse-go]').click()"); await pg.wait_for_timeout(300)
            s3 = await pg.evaluate(ST)
            check('合成しても閉じず(合成画面のまま)、一番上に戻らない', await pg.evaluate(f"() => runeByUid('{uid}').tier") > tier0 and s3['fuse'] and s3['top'] > 100, [tier0, s2, s3])
            await pg.click('[data-rune-view="main"]'); await pg.wait_for_timeout(200)
            check('詳細に戻ると上から', (await pg.evaluate(ST))['main'])
            await b.close()
    real = [e for e in errs if 'favicon' not in e]
    check('JSエラーなし', not real, real[:3])
    print('すべて通過' if bad == 0 else f'{bad}件 失敗')

asyncio.run(main())
