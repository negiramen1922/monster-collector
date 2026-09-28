#!/usr/bin/env python3
"""オート周回(戦闘をそのまま自動で繰り返す)を実際の画面で確かめる。"""
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

async def main():
    with game_url() as url:
        async with async_playwright() as p:
            b = await p.chromium.launch(**LAUNCH)
            pg = await b.new_page(viewport={'width': 390, 'height': 780})
            await use_mock_auth(pg)
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(url); await pg.wait_for_timeout(1000)
            await start_as_guest(pg)
            await pg.evaluate("""() => {
              ['m01','m24','m17','m13','m45'].forEach(id => { STATE.owned[id] = { star:5, souls:0, level:120, exp:0, wall:120, skillLv:8, skill2Lv:8, ultLv:8, passiveLv:8 }; });
              STATE.slots = lineupFromList(['m01','m24','m17','m13','m45'], STATE.formationKey);
              STATE.clearedStages = STAGES.map(s => s.id);
              STATE.stageStars = {}; STAGES.forEach(s => STATE.stageStars[s.id] = 3);
              STATE.stamina = 999; STATE.autoUlt = true; saveState();
            }""")
            check('VIPでなくてもメインを周回できる', await pg.evaluate("() => sweepAllowed(STAGE_BY_ID['q1_05']).ok"))
            check('速さは×1〜×4', await pg.evaluate("() => JSON.stringify(SPEED_OPTIONS)") == '[1,2,3,4]')

            await pg.evaluate("() => { sweepTarget = 'q1_05'; sweepSpeed = 4; renderSweepModal(); }")
            await pg.wait_for_timeout(300)
            check('周回モーダルに速さが5つ出る', await pg.locator('[data-sweep-speed]').count() == 5)
            await pg.screenshot(path=str(OUT / 'auto_modal.png'))

            await pg.evaluate("() => startAutoRun('q1_05', 3, 4)")
            await pg.wait_for_timeout(1500)
            check('周回HUDが戦闘画面に出る', await pg.locator('.ar-hud').count() == 1)
            await pg.screenshot(path=str(OUT / 'auto_hud.png'))
            # 3周終わるまで待つ
            for _ in range(80):
                if await pg.evaluate("() => !autoRun || autoRun.done2"): break
                await pg.wait_for_timeout(500)
            st = await pg.evaluate("""() => {
              const el = document.querySelector('.ar-sum');
              return { open: !!el, txt: el ? el.innerText.replace(/\\n/g, ' ') : '', mvp: !!document.querySelector('.ar-mvp') };
            }""")
            check('3周したら結果がまとまって出る', st['open'], st['txt'])
            check('MVPが出る', st['mvp'])
            await pg.screenshot(path=str(OUT / 'auto_result.png'))
            check('周回は片づいている', await pg.evaluate("() => autoRun === null"))

            # 周回券
            r = await pg.evaluate("""() => {
              closeModal();
              addItem('sweep_main', 8); addItem('sweep_dungeon', 8);
              const before = { stam: STATE.stamina, tk: getItem('sweep_main') };
              const res = runSweep('q1_05', 5, true);
              return { runs: res ? res.runs : 0, stam: STATE.stamina - before.stam, tk: getItem('sweep_main') - before.tk,
                       key_main: sweepTicketKey(STAGE_BY_ID['q1_05']), key_ev: sweepTicketKey(STAGE_BY_ID['ev_kyubi_1']) };
            }""")
            check('周回券で5回まわるとスタミナが減らない', r['runs'] == 5 and r['stam'] == 0, r)
            check('券が5枚減る', r['tk'] == -5, r['tk'])
            check('メインは「メインクエスト周回券」', r['key_main'] == 'sweep_main', r['key_main'])
            check('イベントには周回券を使えない', r['key_ev'] is None, r['key_ev'])
            await b.close()
    real = [e for e in errs if 'favicon' not in e]
    check('JSエラーが出ない', not real, real[:3])
    print('すべて通過' if bad == 0 else f'{bad}件 失敗')
    return 1 if bad else 0

raise SystemExit(asyncio.run(main()))
