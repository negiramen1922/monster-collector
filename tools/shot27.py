import asyncio
from playwright.async_api import async_playwright
import os, pathlib
# game file: GAME_HTML env var, else ../index.html next to this script
# chromium: CHROMIUM_PATH env var when playwright's own download is unavailable
LAUNCH = {'executable_path': os.environ['CHROMIUM_PATH']} if os.environ.get('CHROMIUM_PATH') else {}
GAME_HTML = 'file://' + os.environ.get('GAME_HTML', str(pathlib.Path(__file__).resolve().parent.parent / 'index.html'))
SETUP = """() => {
  ['m54','m113','m116','m68','m125'].forEach(id => STATE.owned[id] = { ...newOwned(MON_BY_ID[id]), level: 60 });
  STATE.formationKey='f2'; STATE.slots=['m54','m125','m116','m113','m68'];
  STATE.clearedStages=['tu1','tu2','tu3','q1_01','q1_02']; STATE.stageStars = { q1_02: 2, dg_exp_0: 3 }; STATE.battleSpeed = 3;
  render();
}"""
async def run(p, w, h, tag):
    b = await p.chromium.launch(**LAUNCH); pg = await b.new_page(viewport={'width':w,'height':h})
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(GAME_HTML); await pg.wait_for_timeout(600)
    await pg.evaluate(SETUP)
    await pg.click('[data-nav="battle"]')
    await pg.click('[data-nav="battle"]'); await pg.evaluate("() => { questTier = 'q1'; render(); }"); await pg.wait_for_timeout(120); await pg.click('[data-stage-open="q1_01"]'); await pg.wait_for_timeout(150); await pg.click('.ss-actions [data-stage="q1_01"]')
    for _ in range(150):
        await pg.wait_for_timeout(200)
        if await pg.evaluate("() => !!document.querySelector('#modal-layer .battle-result')"): break
    await pg.wait_for_timeout(300)
    await pg.screenshot(path=f'./v27_{tag}_result.png')
    rank = await pg.evaluate("() => [battleUI.rank, STATE.stageStars.q1_01]")
    await pg.click('#modal-layer [data-result-nav="battle"]')
    await pg.click('[data-nav="battle"]'); await pg.evaluate("() => { questTier = 'q1'; render(); }"); await pg.wait_for_timeout(120); await pg.click('[data-stage-open="q1_01"]'); await pg.wait_for_timeout(150)
    card_sweep_disabled = await pg.evaluate("() => document.querySelector('.ss-actions [data-sweep-open]').disabled")
    await pg.screenshot(path=f'./v27_{tag}_cards.png')
    await pg.evaluate("() => { STATE.vip = true; renderStageSheet(); }")
    await pg.click('.ss-actions [data-sweep-open]'); await pg.wait_for_timeout(100)
    await pg.screenshot(path=f'./v27_{tag}_sweep.png')
    st0 = await pg.evaluate("() => STATE.stamina")
    await pg.click('[data-sweep-run="5"]'); await pg.wait_for_timeout(100)
    st1 = await pg.evaluate("() => STATE.stamina")
    await pg.screenshot(path=f'./v27_{tag}_sweepres.png')
    await pg.click('#close-result')
    await pg.click('[data-stage-tab="dungeon"]')
    dg = await pg.evaluate("() => !document.querySelector('[data-sweep-open=\"dg_exp_0\"]').disabled")
    print(tag, '| rank', rank, '| sweep disabled w/o VIP', card_sweep_disabled, '| stamina', st0, '->', st1, '| dungeon sweep enabled', dg, '| errors', errs)
    await b.close()
async def main():
    async with async_playwright() as p:
        await run(p, 460, 880, 'desk'); await run(p, 375, 667, 'se')
asyncio.run(main())
