#!/usr/bin/env python3
"""α0.1 の新キャラ30体・新遺物56種を実際の画面で開いて、壊れていないかを見る。

- 図鑑に135体が並び、新キャラの詳細画面が開ける(立ち絵・スキル説明が出る)
- 遺物図鑑に56種が並び、全部にアイコンが付いている
- 新キャラだけのパーティで戦闘を最後まで進めても JS エラーが出ない

使い方: CHROMIUM_PATH=/path/to/chrome python3 tools/alpha01_ui_test.py
スクリーンショットは SHOT_DIR(既定 /tmp)に a01_*.png で出る。
"""
import asyncio, os, pathlib, sys
from playwright.async_api import async_playwright
from _serve import game_url, use_mock_auth, start_as_guest

OUT = pathlib.Path(os.environ.get('SHOT_DIR', '/tmp'))
LAUNCH = {'executable_path': os.environ['CHROMIUM_PATH']} if os.environ.get('CHROMIUM_PATH') else {}
NEW = ['m%d' % i for i in range(136, 166)]

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
            # 新キャラを全員★5で持たせ、遺物も全種持たせる
            await pg.evaluate("""(ids) => {
              ids.forEach(id => { STATE.owned[id] = { star: 5, souls: 0, level: 60, exp: 0, wall: 60, skillLv: 5, skill2Lv: 5, ultLv: 5, passiveLv: 5 }; });
              Object.values(RELICS).forEach(r => grantRelic(r));
              STATE.clearedStages = STAGES.map(s => s.id); saveState();
            }""", NEW)

            await pg.evaluate("() => { currentScreen = 'dex'; render(); }")
            await pg.wait_for_timeout(400)
            total = await pg.evaluate('() => MONSTERS.length')
            check('図鑑のモンスターは135体', total == 135, total)
            await pg.screenshot(path=str(OUT / 'a01_dex.png'))

            await pg.evaluate("() => showMonsterDetail('m165')")
            await pg.wait_for_timeout(400)
            txt = await pg.locator('body').inner_text()
            check('死神の詳細にスキル名が出る', '刈り取りの一閃' in txt and '死の宣告' in txt)
            await pg.screenshot(path=str(OUT / 'a01_detail_shinigami.png'))
            await pg.evaluate("() => closeModal && closeModal()")

            await pg.evaluate("() => { currentScreen = 'relics'; render(); }")
            await pg.wait_for_timeout(400)
            n_rel = await pg.evaluate('() => Object.keys(RELICS).length')
            no_icon = await pg.evaluate('() => Object.values(RELICS).filter(r => !r.icon || !r.icon.includes("data:image")).map(r => r.id)')
            check('遺物は56種', n_rel == 56, n_rel)
            check('全遺物にアイコンがある', not no_icon, no_icon)
            await pg.screenshot(path=str(OUT / 'a01_relics.png'), full_page=True)
            await pg.evaluate("() => showRelicDetail('rel_hellfire_sword')")
            await pg.wait_for_timeout(400)
            txt = await pg.locator('body').inner_text()
            check('新遺物の詳細が開ける(業炎の魔剣・バハムート専用枠)', '業炎の魔剣' in txt and 'バハムート' in txt)
            await pg.screenshot(path=str(OUT / 'a01_relic_detail.png'))
            await pg.evaluate("() => closeModal && closeModal()")

            # 新キャラだけで戦闘
            for k, party in enumerate([NEW[0:5], NEW[5:10], NEW[26:30] + [NEW[12]]]):
                await pg.evaluate("""(party) => {
                  STATE.formationKey = formationForFrontCount(Math.max(1, party.filter(id => isMeleeRole(MON_BY_ID[id].role)).length)).key;
                  STATE.slots = lineupFromList(party, STATE.formationKey); STATE.autoUlt = true; STATE.stamina = 999;
                  startBattle('q3_05', { skipIntro: true });
                }""", party)
                await pg.wait_for_timeout(300)
                started = await pg.evaluate("() => !!battleUI && battleUI.party.every(u => party_ok(u))".replace('party_ok(u)', 'u.ref >= "m136"'))
                check(f'新キャラ編成{k + 1}で戦闘が始まる', started)
                for _ in range(80):
                    fin = await pg.evaluate('() => !battleUI || battleUI.finished')
                    if fin: break
                    await pg.evaluate("""() => { for(let i = 0; i < 20 && battleUI && !battleUI.finished; i++){
                      if(battleUI.transitioning && !battleUI.enemies.some(e => e.alive)) advanceWave();
                      battleUI.transitioning = false; battleUI.paused = false; runNextAction(); } }""")
                    await pg.wait_for_timeout(50)
                    if _ == 3: await pg.screenshot(path=str(OUT / f'a01_battle{k}.png'))
                fin = await pg.evaluate('() => !!battleUI && battleUI.finished')
                check(f'新キャラ編成{k + 1}の戦闘が最後まで進む', fin)
                await pg.evaluate("() => { closeModal && closeModal(); currentScreen = 'home'; render(); }")

            check('JSエラーが出ていない', not errs, errs[:3])
            await b.close()

asyncio.run(main())
sys.exit(1 if bad else 0)
