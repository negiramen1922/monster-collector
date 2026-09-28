#!/usr/bin/env python3
"""新しいニュースがあるとき、ゲームに入るとお知らせ(ニュース)が開く。既読になったら2回目は出ない。
アップデート内容だけが新しいときや、はじめたばかりのときは出ない。
使い方: CHROMIUM_PATH=/path/to/chrome python3 tools/news_popup_ui_test.py"""
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
            await pg.wait_for_timeout(300)
            check('はじめたばかりのときはニュースを開かない(今あるニュースは既読)', await pg.evaluate("() => overlayView") != 'notices' and await pg.evaluate("() => STATE.noticeSeen === liveNotices()[0].id"))
            reenter = "async () => { overlayView = null; await flushSave(); await startGame(); }"
            # 既存の人: 新しいニュースが1件ある
            await pg.evaluate("() => { clearGuideToast(); STATE.guidesSeen = Object.assign(STATE.guidesSeen || {}, { welcome: true }); STATE.noticeSeen = liveNotices()[1].id; STATE.updateLogSeen = 0; saveState(); }")
            await pg.evaluate(reenter); await pg.wait_for_timeout(400)
            st = await pg.evaluate("() => [overlayView, noticesTab, [...noticesOpen]]")
            check('新しいニュースがあると、入ったときにニュースが開く(その記事が開いた状態)', st[0] == 'notices' and st[1] == 'news' and st[2] == [f"news:{await pg.evaluate('() => liveNotices()[0].id')}"], st)
            await pg.screenshot(path=str(OUT / 'news_popup.png'))
            check('開いたら既読(ニュースだけ。アップデート内容の未読は残る)', await pg.evaluate("() => STATE.noticeSeen === liveNotices()[0].id && STATE.updateLogSeen === 0"))
            await pg.evaluate(reenter); await pg.wait_for_timeout(400)
            check('2回目は出ない', await pg.evaluate("() => overlayView") != 'notices')
            # アップデート内容だけが新しいときは出ない
            await pg.evaluate("() => { STATE.updateLogSeen = 0; saveState(); }")
            await pg.evaluate(reenter); await pg.wait_for_timeout(400)
            check('アップデート内容だけが新しいときは出ない', await pg.evaluate("() => overlayView") != 'notices')
            check('JSエラーなし', not errs, errs[:3])
            await b.close()
    print('NG' if bad else 'すべて通過')
    return bad
sys.exit(asyncio.run(main()))
