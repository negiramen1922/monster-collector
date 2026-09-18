import asyncio
from playwright.async_api import async_playwright
import os, pathlib
# game file: GAME_HTML env var, else ../index.html next to this script
# chromium: CHROMIUM_PATH env var when playwright's own download is unavailable
LAUNCH = {'executable_path': os.environ['CHROMIUM_PATH']} if os.environ.get('CHROMIUM_PATH') else {}
GAME_HTML = 'file://' + os.environ.get('GAME_HTML', str(pathlib.Path(__file__).resolve().parent.parent / 'index.html'))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(**LAUNCH, args=['--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width':375,'height':667})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(GAME_HTML); await pg.wait_for_timeout(1500)
        await pg.evaluate("() => { ['m05','m15','m22','m57','m19'].forEach(id => STATE.owned[id] = { ...newOwned(MON_BY_ID[id]), star:4, level:60, wall:60 }); STATE.formationKey='f2'; STATE.slots=['m05','m15','m22','m57','m19']; STATE.clearedStages = STAGES.filter(s => s.tier==='tu' || s.tier==='q1').map(s=>s.id); STATE.battleSpeed=3; questTier='q1'; render(); }")
        await pg.click('[data-nav="home"]'); await pg.wait_for_timeout(1500)
        decoded = await pg.evaluate("() => Object.keys(bgm.buffers).length")
        home = await pg.evaluate("() => bgm.key")
        loops = await pg.evaluate("() => Object.entries(bgm.buffers).map(([k,b]) => [k, Math.round(b.duration)])")
        await pg.click('[data-nav="battle"]'); await pg.click('[data-stage-open="q1_04"]'); await pg.wait_for_timeout(200); await pg.click('.ss-actions [data-stage="q1_04"]')
        await pg.wait_for_timeout(2500)
        battle = await pg.evaluate("() => bgm.key")
        await pg.evaluate("() => { battleUI.paused = true; }")
        # boss stage: the boss wave switches to the boss track
        await pg.evaluate("() => { finishBattle(true); }"); await pg.wait_for_timeout(300)
        await pg.click('#modal-layer [data-result-nav="battle"]'); await pg.wait_for_timeout(400)
        after = await pg.evaluate("() => bgm.key")
        await pg.evaluate("() => { questTier='q1'; render(); }")
        await pg.click('[data-stage-open="q1_05"]'); await pg.wait_for_timeout(200); await pg.click('.ss-actions [data-stage="q1_05"]')
        boss=None
        for _ in range(200):
            await pg.wait_for_timeout(200)
            k = await pg.evaluate("() => [bgm.key, battleUI && battleUI.waveIndex, !!document.querySelector('#modal-layer .battle-result')]")
            if k[0]=='boss': boss=k
            if k[2]: break
        await pg.click("#modal-layer [data-result-nav=\"battle\"]"); await pg.wait_for_timeout(600)
        back_home = await pg.evaluate("() => bgm.key")
        await pg.click('#sound-btn'); await pg.wait_for_timeout(200)
        await pg.screenshot(path='./v33_sound.png')
        await pg.fill('#bgm-volume','30'); await pg.dispatch_event('#bgm-volume','input')
        vol = await pg.evaluate("() => [STATE.bgm.vol, bgm.gain.gain.value]")
        await pg.click('[data-bgm-toggle]'); await pg.wait_for_timeout(200)
        off = await pg.evaluate("() => [STATE.bgm.on, !!bgm.src]")
        await pg.click('[data-bgm-toggle]'); await pg.wait_for_timeout(600)
        on = await pg.evaluate("() => [STATE.bgm.on, bgm.key]")
        print('曲数', decoded, loops, '| ホーム', home, '| 通常戦闘', battle, '| 戦闘後', after, '| ボス戦', boss, '| 帰還', back_home)
        print('音量', vol, '| OFF', off, '| ON', on, '| errors', errs)
        await b.close()
asyncio.run(main())
