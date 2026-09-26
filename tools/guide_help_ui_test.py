#!/usr/bin/env python3
"""チュートリアルのある機能(キャラ詳細・遺物図鑑・深淵回廊・ルーン採掘)の右上に「?」があり、押すと何度でも説明を見返せる。
使い方: CHROMIUM_PATH=/path/to/chrome python3 tools/guide_help_ui_test.py"""
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
            pg = await b.new_page(viewport={'width': 390, 'height': 820})
            await use_mock_auth(pg)
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(url); await pg.wait_for_timeout(900)
            await start_as_guest(pg)
            await pg.evaluate("""() => { clearGuideToast(); STATE.announceQueue = [];
              STATE.guidesSeen = Object.assign(STATE.guidesSeen || {}, { welcome: true, monsterDetail: true, relics: true, abyss: true, runeMine: true });
              STATE.clearedStages = STAGES.filter(s => !s.disabled && !s.hard).map(s => s.id); saveState(); }""")
            guide = lambda: pg.evaluate("() => { const g = document.querySelector('#guide-toast.show'); return g ? g.querySelector('.guide-name').textContent : null; }")
            async def press_twice(label, name, shot):
                await pg.evaluate("() => document.querySelector('[data-guide-help]').click()"); await pg.wait_for_timeout(200)
                g1 = await guide()
                await pg.screenshot(path=str(OUT / shot))
                await pg.evaluate("() => document.querySelector('[data-guide-close]').click()"); await pg.wait_for_timeout(150)
                closed = await guide()
                await pg.evaluate("() => document.querySelector('[data-guide-help]').click()"); await pg.wait_for_timeout(200)
                g2 = await guide()
                await pg.evaluate("() => document.querySelector('[data-guide-close]').click()"); await pg.wait_for_timeout(150)
                check(f'{label}: 「?」で{name}の説明が開き、閉じたあとも何度でも開ける', g1 and name in g1 and closed is None and g2 and name in g2, [g1, closed, g2])
            # キャラ詳細
            await pg.evaluate("() => showMonsterDetail('m06')"); await pg.wait_for_timeout(250)
            check('キャラ詳細の右上に「?」', await pg.locator('#modal-layer .detail-modal [data-guide-help="monsterDetail"]').count() == 1)
            await press_twice('キャラ詳細', 'ハノコ', 'help_detail.png')
            await pg.evaluate("() => document.querySelector('[data-close-detail]').click()"); await pg.wait_for_timeout(150)
            # 遺物図鑑
            await pg.evaluate("() => goto('relics', {nav:true})"); await pg.wait_for_timeout(250)
            await press_twice('遺物図鑑', 'ピクシー', 'help_relics.png')
            # 深淵回廊
            await pg.evaluate("() => { goto('battle', {nav:true}); stageTab = 'abyss'; render(); }"); await pg.wait_for_timeout(250)
            await press_twice('深淵回廊', 'アヌビス', 'help_abyss.png')
            # ルーン採掘
            await pg.evaluate("() => { stageTab = 'dungeon'; dungeonTab = 'rune'; render(); }"); await pg.wait_for_timeout(250)
            await press_twice('ルーン採掘', 'ノッカー', 'help_rune.png')
            await pg.evaluate("() => { dungeonTab = 'exp'; render(); }"); await pg.wait_for_timeout(150)
            check('チュートリアルのない画面(EXPダンジョン)には「?」は出ない', await pg.locator('[data-guide-help]').count() == 0)
            check('JSエラーなし', not errs, errs[:3])
            await b.close()
    print('NG' if bad else 'すべて通過')
    return bad
sys.exit(asyncio.run(main()))
