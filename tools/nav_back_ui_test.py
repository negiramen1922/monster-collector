#!/usr/bin/env python3
"""画面の中のボタンで別の画面へ移ったら「‹ 〇〇に戻る」が出て1つ前に戻れる。下のメニューで移ったときは出ない。
使い方: CHROMIUM_PATH=/path/to/chrome python3 tools/nav_back_ui_test.py"""
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
            await pg.evaluate("() => { clearGuideToast(); STATE.announceQueue = []; STATE.clearedStages = STAGES.filter(s => ['tu','q1'].includes(s.tier)).map(s => s.id); saveState(); }")
            cur = lambda: pg.evaluate("() => currentScreen")
            await pg.evaluate("() => document.querySelector('.nav-btn[data-nav=\"home\"]').click()"); await pg.wait_for_timeout(250)
            check('下のメニューで移ったときは戻るは出ない', await cur() == 'home' and await pg.locator('[data-screen-back]').count() == 0)
            await pg.evaluate("() => document.querySelector('#screen .home-party-btns [data-nav=\"party\"]').click()"); await pg.wait_for_timeout(250)
            txt = await pg.locator('[data-screen-back]').inner_text() if await pg.locator('[data-screen-back]').count() else ''
            check('ホーム → 編成 で「‹ ホームに戻る」が出る', await cur() == 'party' and 'ホームに戻る' in txt, txt)
            await pg.screenshot(path=str(OUT / 'nav_back.png'))
            await pg.evaluate("() => document.querySelector('[data-screen-back]').click()"); await pg.wait_for_timeout(250)
            check('押すとホームに戻る(戻るは消える)', await cur() == 'home' and await pg.locator('[data-screen-back]').count() == 0)
            # プロフィール(重ね画面)から図鑑 → 戻るとプロフィールも戻る
            await pg.evaluate("() => { overlayView = 'profile'; render(); }"); await pg.wait_for_timeout(200)
            await pg.evaluate("() => document.querySelector('.pf-stat[data-nav=\"dex\"]').click()"); await pg.wait_for_timeout(250)
            check('プロフィールから図鑑へ', await cur() == 'dex' and await pg.evaluate("() => !overlayView") and await pg.locator('[data-screen-back]').count() == 1)
            await pg.evaluate("() => document.querySelector('[data-screen-back]').click()"); await pg.wait_for_timeout(250)
            check('戻るとプロフィールの画面に戻る', await pg.evaluate("() => overlayView") == 'profile')
            # ホームのパーティ欄の「キャラ」ボタン → キャラ画面(戻るはホームへ)
            await pg.evaluate("() => { overlayView = null; document.querySelector('.nav-btn[data-nav=\"home\"]').click(); }"); await pg.wait_for_timeout(250)
            await pg.evaluate("() => document.querySelector('#screen [data-nav=\"dex\"]').click()"); await pg.wait_for_timeout(250)
            check('ホーム → キャラでも「ホームに戻る」', await cur() == 'dex' and 'ホームに戻る' in await pg.locator('[data-screen-back]').inner_text())
            # 下のメニュー: キャラ(編成の左)とショップ(拠点の右)がある
            navs = await pg.evaluate("() => [...document.querySelectorAll('.nav-btn')].map(b => b.dataset.nav)")
            check('下のメニューに「キャラ」(編成の左)と「ショップ」(拠点の右)', navs == ['gacha', 'relics', 'dex', 'party', 'home', 'base', 'shop', 'battle', 'pvp'], navs)
            await pg.evaluate("() => document.querySelector('.nav-btn[data-nav=\"shop\"]').click()"); await pg.wait_for_timeout(250)
            check('ショップは自分のタブが光る(拠点ではない)', await cur() == 'shop' and await pg.evaluate("() => document.querySelector('.nav-btn.active').dataset.nav") == 'shop')
            await pg.evaluate("() => document.querySelector('.nav-btn[data-nav=\"base\"]').click()"); await pg.wait_for_timeout(250)
            check('拠点からショップのカードは無くなった', await pg.locator('#screen [data-nav="shop"]').count() == 0)
            await pg.screenshot(path=str(OUT / 'nav9.png'))
            await pg.evaluate("() => document.querySelector('.nav-btn[data-nav=\"home\"]').click()"); await pg.wait_for_timeout(250)
            check('下のメニューで移ると履歴は消える', await cur() == 'home' and await pg.evaluate("() => navHistory.length") == 0 and await pg.locator('[data-screen-back]').count() == 0)
            check('JSエラーなし', not errs, errs[:3])
            await b.close()
    print('NG' if bad else 'すべて通過')
    return bad
sys.exit(asyncio.run(main()))
