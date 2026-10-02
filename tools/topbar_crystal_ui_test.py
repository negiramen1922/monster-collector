#!/usr/bin/env python3
"""右上のバーに、ゴールドの右隣で星結晶の数がいつも出る(ホーム・ガチャほか)。狭い画面でもはみ出さない。
使い方: CHROMIUM_PATH=/path/to/chrome python3 tools/topbar_crystal_ui_test.py"""
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

BAR = """() => { const bar = document.querySelector('#statusbar');
  const pills = [...bar.querySelectorAll('.tb-pill')].map(p => p.className.replace('tb-pill ', ''));
  const gem = bar.querySelector('.tb-pill.gem');
  const over = [...bar.children].some(el => el.getBoundingClientRect().right > window.innerWidth + 0.5);
  return { pills, gem: gem ? gem.textContent.trim() : null, over }; }"""

async def main():
    with game_url() as url:
        async with async_playwright() as p:
            b = await p.chromium.launch(**LAUNCH)
            for w in (390, 360):
                pg = await b.new_page(viewport={'width': w, 'height': 800})
                await use_mock_auth(pg)
                errs = []
                pg.on('pageerror', lambda e: errs.append(str(e)))
                await pg.goto(url); await pg.wait_for_timeout(1000)
                await start_as_guest(pg)
                await pg.evaluate("() => { clearGuideToast(); STATE.crystals = 123456; STATE.gold = 98765432; goto('home'); render(); }")
                await pg.wait_for_timeout(300)
                r = await pg.evaluate(BAR)
                check(f'{w}px ホーム: ゴールドの右隣に星結晶', r['pills'][-2:] == ['gold', 'gem'], r)
                check(f'{w}px ホーム: 星結晶は短く表示(123K)', r['gem'].endswith('123K'), r['gem'])
                check(f'{w}px ホーム: はみ出さない', not r['over'], r)
                await pg.screenshot(path=str(OUT / f'topbar_home_{w}.png'), clip={'x': 0, 'y': 0, 'width': w, 'height': 70})
                await pg.evaluate("() => { STATE.crystals = 5400; goto('gacha'); render(); }")
                await pg.wait_for_timeout(300)
                r = await pg.evaluate(BAR)
                check(f'{w}px ガチャ: 星結晶は1つだけ・数はそのまま(5,400)', r['pills'].count('gem') == 1 and r['gem'].endswith('5,400'), r)
                check(f'{w}px ガチャ: はみ出さない', not r['over'], r)
                real = [e for e in errs if 'favicon' not in e]
                check(f'{w}px JSエラーなし', not real, real[:3])
                await pg.close()
            await b.close()
    print('すべて通過' if bad == 0 else f'{bad}件 失敗')

asyncio.run(main())
