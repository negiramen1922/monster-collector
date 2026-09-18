import asyncio
from playwright.async_api import async_playwright
import os, pathlib
from _serve import use_mock_auth, start_as_guest
# game file: GAME_HTML env var, else ../index.html next to this script
# chromium: CHROMIUM_PATH env var when playwright's own download is unavailable
LAUNCH = {'executable_path': os.environ['CHROMIUM_PATH']} if os.environ.get('CHROMIUM_PATH') else {}
GAME_HTML = 'file://' + os.environ.get('GAME_HTML', str(pathlib.Path(__file__).resolve().parent.parent / 'index.html'))
async def run(p, w, h, tag):
    b = await p.chromium.launch(**LAUNCH); pg = await b.new_page(viewport={'width':w,'height':h})
    await use_mock_auth(pg)
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(GAME_HTML); await pg.wait_for_timeout(600)
    await start_as_guest(pg)
    await pg.evaluate("() => { ['m05','m15','m22','m57','m19'].forEach(id => STATE.owned[id] = { ...newOwned(MON_BY_ID[id]), star: 4, level: 60, wall: 60 }); STATE.formationKey='f2'; STATE.slots=['m05','m15','m22','m57','m19']; STATE.clearedStages = STAGES.filter(s => s.tier==='tu' || s.tier==='q1' || (s.tier==='q2' && s.no<6)).map(s => s.id); STATE.stageStars = { q1_01:3, q1_02:2, q2_01:3 }; STATE.vip = true; STATE.battleSpeed=3; questTier=null; render(); }")
    await pg.click('[data-nav="battle"]'); await pg.wait_for_timeout(150)
    await pg.screenshot(path=f'./v31_{tag}_tiers.png')
    await pg.click('[data-quest-tier="q2"]'); await pg.wait_for_timeout(150)
    await pg.screenshot(path=f'./v31_{tag}_list.png')
    await pg.click('[data-stage-open="q2_05"]'); await pg.wait_for_timeout(200)
    await pg.screenshot(path=f'./v31_{tag}_sheet.png')
    sheet_fits = await pg.evaluate("() => { const e=document.querySelector('.stage-sheet'); const r=e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), e.scrollHeight <= e.clientHeight]; }")
    btn = await pg.evaluate("() => [...document.querySelectorAll('.ss-actions .btn')].map(b => { const r=b.getBoundingClientRect(); return [b.innerText.replace(/\\s+/g,''), Math.round(r.width), Math.round(r.height)]; })")
    await pg.click('[data-close-sheet]'); await pg.wait_for_timeout(100)
    await pg.click('[data-stage-open="q2_01"]'); await pg.wait_for_timeout(150)
    await pg.screenshot(path=f'./v31_{tag}_sheet2.png')
    await pg.click('.ss-actions [data-stage]')
    await pg.wait_for_timeout(2000)
    in_battle = await pg.evaluate("() => currentScreen === 'battle-fight' && !!battleUI")
    await pg.evaluate("() => { battleUI.enemies.forEach(u => u.hp = 1); }")
    for _ in range(80):
        await pg.wait_for_timeout(200)
        if await pg.evaluate("() => !!document.querySelector('#modal-layer .battle-result')"): break
    await pg.click('#modal-layer [data-result-nav="battle"]'); await pg.wait_for_timeout(200)
    back = await pg.evaluate("() => [questTier, !!document.querySelector('.stage-row'), !!document.querySelector('#modal-layer.show')]")
    print(tag, '| sheet', sheet_fits, '| buttons', btn, '| battle', in_battle, '| after battle', back, '| errors', errs)
    await b.close()
async def main():
    async with async_playwright() as p:
        await run(p, 375, 667, 'se'); await run(p, 460, 880, 'desk')
asyncio.run(main())
