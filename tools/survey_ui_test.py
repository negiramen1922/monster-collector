#!/usr/bin/env python3
"""アンケート画面(α0.5)の画面テスト。設定から開いて、答えて送るまで。

使い方: CHROMIUM_PATH=/path/to/chrome python3 tools/survey_ui_test.py
"""
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
            pg = await b.new_page(viewport={'width': 390, 'height': 820})
            await use_mock_auth(pg)
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(url); await pg.wait_for_timeout(900)
            await start_as_guest(pg)
            # チュートリアルを終えた人にして、時計をアンケートの期間にする
            await pg.evaluate("""() => {
              const t = new Date('2026-10-09T12:00:00+09:00').getTime(); Date.now = () => t;
              ['tu1','tu2','tu3','tu4','tu5'].forEach(id => { if(!STATE.clearedStages.includes(id)) STATE.clearedStages.push(id); });
              STATE.tutorialSkipped = true; guideOwner = null; clearGuideToast(true);
              STATE.tutDoneV2 = true; render();
            }""")
            await pg.evaluate("() => openSurvey()")
            await pg.wait_for_timeout(300)
            check('アンケートが開く', await pg.locator('.survey-modal #survey-form').count() == 1)
            check('送るは最初は押せない', await pg.locator('#sv-send').is_disabled())
            await pg.screenshot(path=str(OUT / 'survey_open.png'))
            await pg.locator('label:has(#q1-4)').click()
            await pg.locator('label:has(#q2-good)').click()
            await pg.locator('label:has(#q3-ult)').click()
            await pg.fill('#q4-text', '奥義のボタンの場所がしばらく分からなかったです')
            await pg.locator('label:has(#q5-5)').click()
            await pg.fill('#q6-text', '星刻で何が強くなるのかを、★を上げる前に一覧で見たいです')
            await pg.wait_for_timeout(100)
            check('全部答えると送れる', not await pg.locator('#sv-send').is_disabled(), await pg.locator('#sv-send-hint').inner_text())
            await pg.locator('label:has(#q3-none)').click()
            await pg.wait_for_timeout(100)
            check('とくになしでQ4が入力できなくなる', await pg.locator('#q4-text').is_disabled())
            check('とくになしでほかの選択肢が外れる', not await pg.locator('#q3-ult').is_checked())
            # にせものの送り先
            await pg.evaluate("() => { const be = authBackend(); be.submitSurvey = async () => {}; ACCOUNT = ACCOUNT || { uid: 'u1' }; }")
            await pg.locator('#sv-send').click()
            await pg.wait_for_timeout(400)
            check('送ると送信しましたが出る', await pg.locator('.survey-modal:has-text("送信しました")').count() == 1)
            check('召喚券10枚がプレゼントボックスに届く', await pg.evaluate("() => STATE.presentBox.some(g => g.label === 'アンケートのお礼')"))
            await pg.screenshot(path=str(OUT / 'survey_done.png'))
            check('ページのエラーなし', not errs, errs[:3])
            await b.close()
    print('NG' if bad else 'すべて通過')
    if bad: raise SystemExit(1)

asyncio.run(main())
