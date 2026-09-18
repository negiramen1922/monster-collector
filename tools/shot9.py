import asyncio
from playwright.async_api import async_playwright
import os, pathlib
# game file: GAME_HTML env var, else ../index.html next to this script
# chromium: CHROMIUM_PATH env var when playwright's own download is unavailable
LAUNCH = {'executable_path': os.environ['CHROMIUM_PATH']} if os.environ.get('CHROMIUM_PATH') else {}
GAME_HTML = 'file://' + os.environ.get('GAME_HTML', str(pathlib.Path(__file__).resolve().parent.parent / 'index.html'))
SETUP = """() => {
  ['m05','m15','m19','m20','m13','m24'].forEach(id => STATE.owned[id] = { star: MON_BY_ID[id].rarity, souls:0, level:3, skillLv:1, ultLv:1, passiveLv:1 });
  STATE.clearedStages = ['tu1','tu2','tu3','q1_01','q1_02','q1_03']; STATE.formationKey = 'f3'; STATE.slots = ['m05','m15','m13','m19','m20'];
  render();
}"""
async def run(p, w, h, tag):
    b = await p.chromium.launch(**LAUNCH)
    pg = await b.new_page(viewport={'width':w,'height':h})
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(GAME_HTML); await pg.wait_for_timeout(600)
    await pg.evaluate(SETUP)
    if tag == 'desk':
        await pg.click('[data-nav="party"]'); await pg.click('[data-slot="0"] img'); await pg.click('[data-slot-action="detail"]')
        await pg.wait_for_timeout(200); await pg.screenshot(path='./v9_detail.png')
        await pg.click('[data-close-detail]')
    await pg.click('[data-nav="battle"]'); await pg.click('[data-nav=\"battle\"]'); await pg.wait_for_timeout(120); await pg.click('[data-quest-tier=\"q1\"]'); await pg.wait_for_timeout(120); await pg.click('[data-stage-open="q1_03"]'); await pg.wait_for_timeout(150); await pg.click('.ss-actions [data-stage="q1_03"]')
    await pg.wait_for_timeout(3000)
    # speed 1 -> 2 -> 3
    await pg.click('#speed-btn'); s2 = await pg.inner_text('#speed-btn')
    await pg.click('#speed-btn'); s3 = await pg.inner_text('#speed-btn')
    # give an ally full SP and reserve it
    await pg.evaluate("() => { const u = battleUI.party[1]; u.sp = u.spCost; renderBattleScreenOnly(); }")
    await pg.wait_for_timeout(50)
    ready = await pg.query_selector('[data-ult="1"]')
    box = await ready.bounding_box()
    await pg.mouse.move(box['x']+box['width']/2, box['y']+box['height']/2); await pg.mouse.down(); await pg.mouse.up()
    reserved = await pg.evaluate("() => battleUI.party[1].ultReserved")
    await pg.wait_for_timeout(100)
    await pg.screenshot(path=f'./v9_{tag}_reserved.png')
    # wait for the reserved ultimate to fire
    fired = False
    await pg.evaluate("() => { battleUI.party.forEach(u => { u.str *= 3; }); }")
    for _ in range(40):
        await pg.wait_for_timeout(150)
        if await pg.evaluate("() => !battleUI.party[1].ultReserved && battleUI.log.some(l => l.includes('必殺技「ベアクラッシュ」') && l.includes('グリズリー'))"):
            fired = True; break
    await pg.wait_for_timeout(120)
    await pg.screenshot(path=f'./v9_{tag}_ult.png')
    m = await pg.evaluate("() => { const s=document.getElementById('screen'); const f=document.querySelector('.battle-field'); return [s.scrollHeight, s.clientHeight, f.scrollHeight, f.clientHeight]; }")
    strip = await pg.eval_on_selector_all('.turn-strip .ts-icon', 'els => els.length')
    # finish: let it play out at 3x
    for _ in range(200):
        await pg.wait_for_timeout(200)
        if await pg.evaluate("() => !!document.querySelector('#modal-layer .battle-result')"): break
    await pg.screenshot(path=f'./v9_{tag}_result.png')
    waves = await pg.eval_on_selector_all('.br-wave', 'els => els.map(e => e.innerText)')
    print(tag, '| speed:', s2.strip(), '/', s3.strip(), '| reserved:', reserved, '| ult fired:', fired, '| fits:', m, '| strip icons:', strip, '| waves:', waves, '| errors:', errs)
    await b.close()
async def main():
    async with async_playwright() as p:
        await run(p, 460, 880, 'desk')
        await run(p, 375, 667, 'se')
asyncio.run(main())
