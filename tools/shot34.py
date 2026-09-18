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
        async def phase():
            return await pg.evaluate("() => gachaSeq ? gachaSeq.phase : (document.querySelector('.gacha-result') ? 'result' : 'none')")
        async def wait_phase(want, tries=40):
            for _ in range(tries):
                if await phase() in want: return await phase()
                await pg.wait_for_timeout(250)
            return await phase()

        await pg.click('[data-nav="gacha"]'); await pg.click('#pull1')
        for i, t in enumerate([500, 400, 300, 400]):
            await pg.wait_for_timeout(t)
            await pg.screenshot(path=f'./v34_egg{i}.png')
        # a ★5 stops on the legend cut-in and waits for a tap
        legend = await wait_phase(['legend'])
        await pg.click('[data-gacha-stage]')
        after = await wait_phase(['result']) == 'result'
        await pg.click('#close-result')
        await pg.evaluate("() => { pullOne = window.__orig; }")
        await pg.click('#pull10'); await pg.wait_for_timeout(1400)
        await pg.screenshot(path='./v34_ten.png')
        await wait_phase(['reveal'])
        await pg.wait_for_timeout(900)
        await pg.screenshot(path='./v34_ten2.png')
        # skip button jumps to the end
        await pg.click('[data-gacha-skip]')
        ph = await wait_phase(['result', 'legend'])
        if ph == 'legend':
            await pg.click('[data-gacha-stage]')
            ph = await wait_phase(['result'])
        skipped = ph == 'result'
        print('★5: カットイン', legend, '| 単発: 結果へ', after, '| 10連: スキップ', skipped, '| errors', errs)
        await b.close()
asyncio.run(main())
