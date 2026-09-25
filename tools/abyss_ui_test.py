#!/usr/bin/env python3
"""深淵回廊の画面テスト: タブ・1階の戦闘・結果画面の「次の階へ」・アイテムの使用。
使い方: CHROMIUM_PATH=/path/to/chrome python3 tools/abyss_ui_test.py"""
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
            await pg.evaluate("""() => {
              ['m68','m116','m54','m113','m31'].forEach(id => STATE.owned[id] = { star: 7, souls: 0, level: 200, exp: 0, wall: 200, skillLv: 10, skill2Lv: 10, ultLv: 10, passiveLv: 10 });
              STATE.formationKey = formationForFrontCount(3).key; STATE.slots = lineupFromList(['m68','m116','m54','m113','m31'], STATE.formationKey);
              STATE.clearedStages = STAGES.map(s => s.id); STATE.autoUlt = true; saveState();
              stageTab = 'abyss'; currentScreen = 'battle'; render(); }""")
            # 初心者ガイドの吹き出しがボタンに重なるので消しておく
            await pg.evaluate("() => { clearGuideToast(); const g = document.getElementById('guide-toast'); if(g){ g.classList.remove('show'); g.innerHTML = ''; } }")
            await pg.wait_for_timeout(400)
            txt = await pg.locator('.abyss-card').inner_text()
            check('深淵回廊のタブが出る', '深淵回廊' in txt and '1階に挑戦する' in txt)
            check('テーマ属性とリセットまでの日数', 'テーマ属性' in txt and 'リセットまで' in txt)
            await pg.screenshot(path=str(OUT / 'abyss_tab.png'))
            chart = await pg.evaluate("() => [...document.querySelectorAll('.ab-tl-row')].map(r => r.querySelector('.ab-tl-floor').firstChild.textContent)")
            check('階層報酬のタイムチャートが5階ごとに並ぶ', chart[:4] == ['5階', '10階', '15階', '20階'] and len(chart) >= 10, chart[:6])
            check('25階は大報酬、5階が次のボス', await pg.evaluate("() => document.querySelectorAll('.ab-tl-row')[4].classList.contains('big') && document.querySelectorAll('.ab-tl-row')[0].classList.contains('next')"))
            n0 = len(chart)
            await pg.evaluate("() => document.querySelector('[data-abyss-chart-more]').click()"); await pg.wait_for_timeout(200)
            check('さらに先を見るで+50階', await pg.evaluate("() => document.querySelectorAll('.ab-tl-row').length") == n0 + 10)
            await pg.evaluate("() => document.querySelector('.ab-chart').scrollIntoView()"); await pg.wait_for_timeout(100)
            await pg.screenshot(path=str(OUT / 'abyss_chart.png'))
            # 探索メニュー: 下のナビで探索を押すとメニュー、押すと各画面、左上の「戻る」でメニューへ
            await pg.evaluate("() => document.querySelector('.nav-btn[data-nav=battle]').click()"); await pg.wait_for_timeout(300)
            tabs = await pg.evaluate("() => [...document.querySelectorAll('.explore-tabs .stage-tab')].map(e => { const r = e.getBoundingClientRect(); return { t: e.querySelector('.et-label').firstChild.textContent, x: r.left, y: r.top, w: r.width }; })")
            check('探索を開くと メインクエスト→育成クエスト→深淵回廊→イベント が縦に並ぶ',
                  [t['t'] for t in tabs] == ['メインクエスト', '育成クエスト', '深淵回廊', 'イベント']
                  and all(tabs[i]['y'] < tabs[i + 1]['y'] and abs(tabs[i]['x'] - tabs[i + 1]['x']) < 1 for i in range(3))
                  and tabs[0]['w'] > 300 and await pg.locator('.abyss-card').count() == 0 and await pg.locator('.explore-back').count() == 0, tabs)
            await pg.screenshot(path=str(OUT / 'explore_menu.png'))
            for key, sel in [('main', '.tier-tabs'), ('dungeon', '[data-dungeon-tab]'), ('abyss', '.abyss-card')]:
                await pg.evaluate(f"() => document.querySelector('.explore-tabs [data-stage-tab={key}]').click()"); await pg.wait_for_timeout(250)
                inside = await pg.locator(sel).count() > 0 and await pg.locator('.explore-tabs').count() == 0
                back = await pg.locator('.explore-back').count() == 1
                if key == 'abyss': await pg.screenshot(path=str(OUT / 'explore_abyss.png'))
                await pg.evaluate("() => document.querySelector('.explore-back').click()"); await pg.wait_for_timeout(250)
                check(f'{key} を押すと中に入り、左上の戻るでメニューに戻る', inside and back and await pg.locator('.explore-tabs').count() == 1)
            # 初めて深淵回廊に入るとアヌビスの説明が出て、読み終えると二度と出ない
            await pg.evaluate("() => { delete STATE.guidesSeen.abyss; }")
            await pg.evaluate("() => document.querySelector('.explore-tabs [data-stage-tab=abyss]').click()"); await pg.wait_for_timeout(300)
            g = await pg.evaluate("() => { const el = document.getElementById('guide-toast'); return el && el.classList.contains('show') ? el.innerText : ''; }")
            check('初めて入るとアヌビスが無限・5階ごとのボスとチェックポイント・2週間リセットを説明する', 'アヌビス' in g and '無限' in g and '1 / 5' in g, g[:60])
            await pg.screenshot(path=str(OUT / 'abyss_guide.png'))
            texts = [g]
            for _ in range(4):
                await pg.evaluate("() => document.querySelector('[data-guide-next]').click()"); await pg.wait_for_timeout(150)
                texts.append(await pg.evaluate("() => document.getElementById('guide-toast').innerText"))
            allt = ''.join(texts)
            check('説明の中身', all(k in allt for k in ['5階ごと', 'チェックポイント', '2週間', '持ち越']) and 'いざ深淵へ' in texts[-1])
            await pg.evaluate("() => document.querySelector('[data-guide-next]').click()"); await pg.wait_for_timeout(200)
            await pg.evaluate("() => document.querySelector('.explore-back').click()"); await pg.wait_for_timeout(200)
            await pg.evaluate("() => document.querySelector('.explore-tabs [data-stage-tab=abyss]').click()"); await pg.wait_for_timeout(300)
            check('2回目以降は出ない', await pg.evaluate("() => STATE.guidesSeen.abyss === true && !document.getElementById('guide-toast').classList.contains('show')"))
            st0 = await pg.evaluate('() => STATE.stamina')
            await pg.evaluate("() => document.querySelector('[data-start-stage=\"ab_1\"]').click()"); await pg.wait_for_timeout(600)
            check('戦闘が始まる', await pg.evaluate("() => battleUI && battleUI.stage.id === 'ab_1'"))
            for _ in range(80):
                if await pg.evaluate('() => battleUI.finished'): break
                await pg.evaluate("() => { for(let i = 0; i < 30 && !battleUI.finished; i++){ battleUI.transitioning = false; battleUI.paused = false; runNextAction(); } }")
                await pg.wait_for_timeout(30)
            check('1階を突破', await pg.evaluate('() => battleUI.win'))
            check('スタミナは減っていない', await pg.evaluate('() => STATE.stamina') >= st0)
            await pg.evaluate("() => showBattleResult()"); await pg.wait_for_timeout(300)
            res = await pg.locator('.battle-result').inner_text()
            check('結果画面に「1階 突破」と「2階へ進む」', '1階 突破' in res and '2階へ進む' in res)
            check('深淵回廊の結果画面にスタミナを出さない', 'スタミナ' not in res and '⚡' not in res, res[-80:])
            await pg.screenshot(path=str(OUT / 'abyss_result.png'))
            await pg.evaluate("() => document.querySelector('[data-start-stage=\"ab_2\"]').click()"); await pg.wait_for_timeout(500)
            check('そのまま2階へ進める', await pg.evaluate("() => battleUI.stage.id === 'ab_2'"))
            await pg.evaluate("() => { closeModal(); addItem('stamina_60', 1); addItem('idle_12', 1); bagTab = 'other'; renderBag(); }")
            await pg.wait_for_timeout(300)
            check('アイテム欄に「使えるアイテム」', await pg.locator('[data-use-item="stamina_60"]').count() == 1 and await pg.locator('[data-use-item="idle_12"]').count() == 1)
            await pg.screenshot(path=str(OUT / 'abyss_items.png'))
            s0 = await pg.evaluate('() => STATE.stamina')
            await pg.evaluate("() => document.querySelector('[data-use-item=\"stamina_60\"]').click()"); await pg.wait_for_timeout(200)
            check('スタミナの実を使うと+60', await pg.evaluate('() => STATE.stamina') == s0 + 60)
            g0 = await pg.evaluate('() => STATE.gold')
            await pg.evaluate("() => document.querySelector('[data-use-item=\"idle_12\"]').click()"); await pg.wait_for_timeout(200)
            check('時渡りの砂・大でゴールドが入る', await pg.evaluate('() => STATE.gold') > g0)
            check('JSエラーなし', not errs, errs[:3])
            await b.close()
    print('NG' if bad else 'すべて通過')
    return bad
sys.exit(asyncio.run(main()))
