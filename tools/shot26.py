import asyncio
from playwright.async_api import async_playwright
import os, pathlib
# game file: GAME_HTML env var, else ../index.html next to this script
# chromium: CHROMIUM_PATH env var when playwright's own download is unavailable
LAUNCH = {'executable_path': os.environ['CHROMIUM_PATH']} if os.environ.get('CHROMIUM_PATH') else {}
GAME_HTML = 'file://' + os.environ.get('GAME_HTML', str(pathlib.Path(__file__).resolve().parent.parent / 'index.html'))
SETUP = """() => {
  ['m54','m113','m116','m68','m125'].forEach(id => STATE.owned[id] = newOwned(MON_BY_ID[id]));
  STATE.formationKey='f2'; STATE.slots=['m54','m125','m116','m113','m68'];
  STATE.clearedStages=['tu1','tu2','tu3','q1_01','q1_02','q1_03']; STATE.gold = 300000;
  STATE.items = { exp1: 300, exp2: 50, exp3: 5, box_sel_4: 1, box_rnd_2: 1, el_fire_1: 40, sp_demon_1: 12, ro_shooter_1: 12 };
  baseState().mine.at = Date.now() - 5 * 3600e3; baseState().lab.at = Date.now() - 30 * 3600e3;
  render();
}"""
async def run(p, w, h, tag):
    b = await p.chromium.launch(**LAUNCH)
    pg = await b.new_page(viewport={'width':w,'height':h})
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(GAME_HTML); await pg.wait_for_timeout(600)
    await pg.evaluate(SETUP)
    hdr = await pg.evaluate("() => { const s = document.getElementById('statusbar'); return [s.scrollWidth, s.clientWidth]; }")
    await pg.screenshot(path=f'./v26_{tag}_home.png')
    # explore: dungeons
    await pg.click('[data-nav="battle"]'); await pg.click('[data-stage-tab="dungeon"]'); await pg.click('[data-dungeon-tab="mat"]'); await pg.wait_for_timeout(100)
    await pg.screenshot(path=f'./v26_{tag}_dungeon.png')
    await pg.click('[data-stage-tab="main"]'); await pg.evaluate("() => { document.getElementById('screen').scrollTop = 99999; }")
    await pg.screenshot(path=f'./v26_{tag}_main.png')
    # base
    await pg.click('[data-nav="base"]'); await pg.wait_for_timeout(100)
    await pg.screenshot(path=f'./v26_{tag}_base.png')
    g0 = await pg.evaluate("() => STATE.gold")
    await pg.click('[data-collect="mine"]'); g1 = await pg.evaluate("() => STATE.gold")
    await pg.click('[data-collect="lab"]'); lab = await pg.evaluate("() => [STATE.items.exp1, STATE.items.exp2]")
    await pg.click('[data-craft="el:fire:2"]'); craft = await pg.evaluate("() => [STATE.items.el_fire_1, STATE.items.el_fire_2]")
    await pg.evaluate("() => { document.getElementById('screen').scrollTop = 99999; }")
    await pg.screenshot(path=f'./v26_{tag}_alchemy.png')
    # bag: open selection box
    await pg.click('[data-open-bag]'); await pg.click('[data-open-box="box_sel_4"]'); await pg.click('[data-bag-fam="sp"]')
    await pg.screenshot(path=f'./v26_{tag}_bag.png')
    await pg.click('[data-box-pick="sp:demon"]')
    sel = await pg.evaluate("() => [STATE.items.sp_demon_4, STATE.items.box_sel_4]")
    await pg.click('[data-close-bag]')
    # detail: level up + skill up
    await pg.evaluate("() => showMonsterDetail('m116')"); await pg.wait_for_timeout(100)
    await pg.click('[data-levelup="m116"][data-times="max"]'); lv = await pg.evaluate("() => STATE.owned.m116.level")
    await pg.click('[data-break-wall="m116"]'); await pg.click('[data-levelup="m116"][data-times="max"]'); lv2 = await pg.evaluate("() => STATE.owned.m116.level")
    await pg.evaluate("() => { STATE.items.el_fire_1 = 10; }"); await pg.evaluate("() => showMonsterDetail('m116')")
    await pg.click('[data-skill-up="m116"][data-field="ultLv"]'); ult = await pg.evaluate("() => STATE.owned.m116.ultLv")
    await pg.evaluate("document.querySelector('.detail-level-box').scrollIntoView({block:'start'})")
    await pg.screenshot(path=f'./v26_{tag}_detail.png')
    await pg.click('[data-close-detail]')
    # dungeon battle
    await pg.click('[data-nav="battle"]'); await pg.click('[data-stage-tab="dungeon"]'); await pg.click('[data-dungeon-tab="exp"]')
    await pg.click('[data-stage="dg_exp_0"]')
    await pg.evaluate("() => { STATE.battleSpeed = 3; }")
    for _ in range(150):
        await pg.wait_for_timeout(200)
        if await pg.evaluate("() => !!document.querySelector('#modal-layer .battle-result')"): break
    await pg.screenshot(path=f'./v26_{tag}_result.png')
    title = await pg.inner_text('.br-title')
    # missions render
    await pg.click('#modal-layer [data-result-nav="battle"]')
    await pg.click('[data-nav="home"]'); await pg.click('.mission-card'); await pg.click('[data-mission-tab="weekly"]')
    wk = await pg.eval_on_selector_all('.mission .ms-title', 'els => els.map(e => e.innerText)')
    print(tag, '| header', hdr, '| mine', g0, '->', g1, '| lab pots', lab, '| craft', craft, '| select box', sel, '| lv', lv, lv2, '| ultLv', ult, '| result', title)
    print('  weekly', wk, '| errors', errs)
    await b.close()
async def main():
    async with async_playwright() as p:
        await run(p, 460, 880, 'desk')
        await run(p, 375, 667, 'se')
asyncio.run(main())
