import asyncio
from playwright.async_api import async_playwright
import os, pathlib
from _serve import use_mock_auth, start_as_guest
# game file: GAME_HTML env var, else ../index.html next to this script
# chromium: CHROMIUM_PATH env var when playwright's own download is unavailable
LAUNCH = {'executable_path': os.environ['CHROMIUM_PATH']} if os.environ.get('CHROMIUM_PATH') else {}
GAME_HTML = 'file://' + os.environ.get('GAME_HTML', str(pathlib.Path(__file__).resolve().parent.parent / 'index.html'))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(**LAUNCH); pg = await b.new_page(viewport={'width':375,'height':667})
        await use_mock_auth(pg)
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(GAME_HTML); await pg.wait_for_timeout(1200)
        await start_as_guest(pg)
        # single pull with a forced ★5, then a 10-pull
        await pg.evaluate("() => { STATE.crystals = 99999; render(); }")
        await pg.evaluate("""() => { const orig = pullOne; window.__orig = orig; pullOne = (min) => { const r = orig(min); r.mon = MON_BY_ID.m116; return r; }; }""")
        await pg.click('[data-nav="gacha"]'); await pg.click('#pull1')
        for i, t in enumerate([500, 400, 300, 400]):
            await pg.wait_for_timeout(t)
            await pg.screenshot(path=f'./v34_egg{i}.png')
        await pg.wait_for_timeout(1500)
        after = await pg.evaluate("() => !!document.querySelector('.gacha-result')")
        await pg.click('#close-result')
        await pg.evaluate("() => { pullOne = window.__orig; }")
        await pg.click('#pull10'); await pg.wait_for_timeout(1400)
        await pg.screenshot(path='./v34_ten.png')
        await pg.wait_for_timeout(2400)
        await pg.screenshot(path='./v34_ten2.png')
        # tap to skip
        await pg.click('.gacha-eggs'); await pg.wait_for_timeout(300)
        skipped = await pg.evaluate("() => !!document.querySelector('.gacha-result')")
        print('単発: 結果へ自動遷移', after, '| 10連: タップでスキップ', skipped, '| errors', errs)
        await b.close()
asyncio.run(main())
