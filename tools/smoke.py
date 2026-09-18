#!/usr/bin/env python3
"""起動スモークテスト: 主要画面を開いてJSエラーと横スクロールの有無を確認する。
使い方: CHROMIUM_PATH=/path/to/chrome python3 smoke.py   (スクリーンショットは smoke_<画面>.png)"""
import asyncio, os, pathlib
from playwright.async_api import async_playwright

GAME_HTML = 'file://' + os.environ.get('GAME_HTML', str(pathlib.Path(__file__).resolve().parent.parent / 'index.html'))
LAUNCH = {'executable_path': os.environ['CHROMIUM_PATH']} if os.environ.get('CHROMIUM_PATH') else {}
OUT = pathlib.Path(__file__).resolve().parent
SCREENS = ['home', 'gacha', 'party', 'dex', 'battle', 'base', 'missions']
# give the save a small roster so every screen has something to draw
SETUP = """() => {
  ['m05','m15','m19','m20','m13','m24'].forEach(id => STATE.owned[id] = { star: MON_BY_ID[id].rarity, souls:0, level:3, skillLv:1, ultLv:1, passiveLv:1 });
  STATE.clearedStages = ['tu1','tu2','tu3','q1_01','q1_02','q1_03']; STATE.formationKey='f3'; STATE.slots=['m05','m15','m13','m19','m20'];
  render();
}"""

async def main():
    bad = 0
    async with async_playwright() as p:
        b = await p.chromium.launch(**LAUNCH)
        pg = await b.new_page(viewport={'width': 375, 'height': 667})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(GAME_HTML)
        await pg.wait_for_timeout(1500)
        await pg.evaluate(SETUP)
        await pg.wait_for_timeout(400)
        print('title:', await pg.title())
        for s in SCREENS:
            await pg.evaluate(f"() => {{ goto('{s}'); render(); }}")
            await pg.wait_for_timeout(400)
            await pg.screenshot(path=str(OUT / f'smoke_{s}.png'))
            w = await pg.evaluate("() => document.documentElement.scrollWidth")
            ok = (w <= 375)
            bad += 0 if ok else 1
            print(('✅' if ok else '❌') + f' {s}  scrollWidth={w}')
        ok = not errs
        bad += 0 if ok else 1
        print(('✅' if ok else '❌') + f' JSエラー {len(errs)}件', errs[:5])
        await b.close()
    raise SystemExit(1 if bad else 0)

asyncio.run(main())
