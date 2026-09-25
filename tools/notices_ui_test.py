#!/usr/bin/env python3
"""お知らせ画面のトグル表示の検証。

件数が増えて全文が縦に並ぶと読めないので、タイトルと日付だけを並べて
タップで本文を開く形にした。その開閉が実際に動くかを見る。

使い方: CHROMIUM_PATH=/path/to/chrome python3 tools/notices_ui_test.py
"""
import asyncio, os, pathlib, sys
from playwright.async_api import async_playwright
from _serve import game_url, use_mock_auth, start_as_guest

# スクリーンショットは目視確認用。リポジトリを汚さないよう一時ディレクトリに出す。
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
            await pg.evaluate("() => { openOverlay('notices'); render(); }")
            await pg.wait_for_timeout(400)

            # 件数はゲーム側の配列から取る(履歴が増えるたびにテストを直さなくていいように)
            n_update = await pg.evaluate('() => UPDATE_LOG.length')
            n_news = await pg.evaluate('() => NOTICES.length')
            rows = await pg.locator('.nt-row').count()
            check('アップデート内容が全件出ている', rows == n_update, f'{rows} / {n_update}')
            opened = await pg.locator('.nt-row.on').count()
            check('最新の1件だけ開いている', opened == 1, opened)
            bodies = await pg.locator('.nt-row .nt-sub').count()
            check('閉じている項目は本文を出していない', bodies == 1, bodies)
            await pg.screenshot(path=str(OUT / 'nt_update.png'))

            # 3件目をタップして開く
            await pg.locator('.nt-row').nth(2).click()
            await pg.wait_for_timeout(300)
            check('タップで2件目が開く', await pg.locator('.nt-row.on').count() == 2)
            # もう一度で閉じる
            await pg.locator('.nt-row').nth(2).click()
            await pg.wait_for_timeout(300)
            check('もう一度タップで閉じる', await pg.locator('.nt-row.on').count() == 1)

            # ニュースタブ
            await pg.locator('[data-notices-tab="news"]').click()
            await pg.wait_for_timeout(400)
            n = await pg.locator('.nt-row').count()
            check('ニュースが全件出ている', n == n_news, f'{n} / {n_news}')
            check('ニューズも最新1件だけ開く', await pg.locator('.nt-row.on').count() == 1)
            t = await pg.locator('.nt-row').first.inner_text()
            check('最新ニュースはα0.1アップデート内容(1)', 'α0.1アップデート内容(1)' in t, t.split('\n')[0])
            # 長い本文の小見出しと箇条書きが崩れずに出ているか
            check('小見出しが出ている', await pg.locator('.nt-row.on .nt-h').count() >= 3,
                  await pg.locator('.nt-row.on .nt-h').count())
            n_item = await pg.locator('.nt-row.on .nt-i').count()
            check('キャラ30体ぶんの行が出ている', n_item == 30, n_item)
            # 横にはみ出していないこと(スマホ幅で本文が切れると読めない)
            over = await pg.evaluate('''() => {
              const el = document.querySelector('.nt-row.on');
              return el ? el.scrollWidth - el.clientWidth : -1;
            }''')
            check('本文が横にはみ出していない', over <= 1, over)
            await pg.screenshot(path=str(OUT / 'nt_news.png'))

            # 全部開いてスクロールできるか
            for i in range(3):
                await pg.locator('.nt-row').nth(i).click(); await pg.wait_for_timeout(120)
            await pg.screenshot(path=str(OUT / 'nt_news_open.png'))

            check('JSエラーなし', not errs, errs[:3])
            await b.close()
    print('NG' if bad else 'すべて通過')
    return bad

sys.exit(asyncio.run(main()))
