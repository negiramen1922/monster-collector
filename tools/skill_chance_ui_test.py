#!/usr/bin/env python3
"""スキル強化の画面で、持続時間が伸びるLvのときに「(○○の持続) 2ターン → 3ターン」が出る。必殺技の説明が「必ず」になっている。
使い方: CHROMIUM_PATH=/path/to/chrome python3 tools/skill_chance_ui_test.py"""
import asyncio, os, pathlib, sys
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
            pg = await b.new_page(viewport={'width': 390, 'height': 1400})
            await use_mock_auth(pg)
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(url); await pg.wait_for_timeout(900)
            await start_as_guest(pg)
            tid = await pg.evaluate("""() => { clearGuideToast(); STATE.announceQueue = [];
              STATE.guidesSeen = Object.assign(STATE.guidesSeen || {}, { welcome: true, monsterDetail: true });
              const m = MONSTERS.find(x => x.name === 'トレント');
              STATE.owned[m.id] = Object.assign(newOwned(m), { star: 5, level: 100, ultLv: 4, skillLv: 9, skill2Lv: 9 });
              saveState(); openMonsterDetailOrPreview(m.id); return m.id; }""")
            await pg.wait_for_timeout(500)
            rows = "() => [...document.querySelectorAll('.su-preview-row')].map(r => r.textContent.replace(/\\s+/g, ' ').trim())"
            await pg.evaluate(f"() => openSkillUpgradeModal('{tid}', 'ultLv')"); await pg.wait_for_timeout(300)
            txt = await pg.evaluate(rows)
            check('必殺技Lv4→5で味方バフの持続が2ターン→3ターンと出る', any('持続' in t and '2ターン → 3ターン' in t for t in txt), txt)
            await pg.screenshot(path=str(OUT / 'skill_duration_preview.png'))
            await pg.evaluate(f"() => {{ closeSkillUpgradeModal(); openSkillUpgradeModal('{tid}', 'ultLv'); STATE.owned['{tid}'].ultLv = 5; renderSkillUpgradeModal(); }}"); await pg.wait_for_timeout(200)
            txt2 = await pg.evaluate(rows)
            check('Lv5→6では持続の行は出ない', txt2 and not any('持続' in t for t in txt2), txt2)
            ult = await pg.evaluate("() => MONSTER_KITS[MONSTERS.find(x => x.name === 'ノーム').id].ult.desc")
            check('必殺技の説明が「必ず気絶」になっている', '必ず気絶' in ult, ult)
            check('JSエラーなし', not errs, errs)
            await b.close()
    sys.exit(1 if bad else 0)

asyncio.run(main())
