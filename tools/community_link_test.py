#!/usr/bin/env python3
"""DiscordとXのリンクが実際に開けるかを見る。

設定画面は素の <a href target="_blank">、お知らせの本文は <button> の中なので
クリックの振り分け(data-open-community)で拾っている。どちらも一度死んでいたので回帰テスト。

使い方: CHROMIUM_PATH=/path/to/chrome python3 tools/community_link_test.py
"""
import asyncio, os
from playwright.async_api import async_playwright
from _serve import game_url, use_mock_auth, start_as_guest

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
            await pg.goto(url); await pg.wait_for_timeout(1000)
            await start_as_guest(pg)

            opened = []
            await pg.expose_function('__rec', lambda u: opened.append(u))
            await pg.evaluate("() => { window.open = (u) => { window.__rec(u); return { opener: null }; }; }")

            urls = await pg.evaluate('() => COMMUNITY')
            check('COMMUNITYにDiscordとXが入っている',
                  urls.get('discord', '').startswith('https://discord.gg/') and urls.get('x', '').startswith('https://x.com/'), urls)

            # ---- 設定画面: 素の <a href> ----
            await pg.evaluate("() => { openOverlay('settings'); render(); }")
            await pg.wait_for_timeout(400)
            links = await pg.evaluate("""() => [...document.querySelectorAll('a.set-item')].map(a => ({
                href: a.getAttribute('href'), target: a.getAttribute('target'), rel: a.getAttribute('rel') }))""")
            check('設定にリンクが2つある', len(links) == 2, links)
            for want in (urls['discord'], urls['x']):
                hit = [l for l in links if l['href'] == want]
                check(f'設定のリンク先が正しい({want})',
                      len(hit) == 1 and hit[0]['target'] == '_blank' and 'noopener' in (hit[0]['rel'] or ''), hit)

            # ---- お知らせ本文: 押すと開く ----
            await pg.evaluate("() => { closeOverlay(); openOverlay('notices'); noticesTab = 'news'; render(); }")
            await pg.wait_for_timeout(400)
            key = await pg.evaluate("""() => { const n = liveNotices().find(x => x.title.includes('DiscordとX')); return n ? "news:" + n.id : null; }""")
            check('お知らせが出ている', key is not None, key)
            if key:
                if not await pg.evaluate(f"() => !!document.querySelector('[data-notice=\"{key}\"].on')"):
                    await pg.click(f'[data-notice="{key}"]'); await pg.wait_for_timeout(300)
                n = await pg.locator('.nt-link[data-open-community]').count()
                check('お知らせ本文にリンクのボタンが2つある', n == 2, n)
                for k in ('discord', 'x'):
                    opened.clear()
                    await pg.click(f'.nt-link[data-open-community="{k}"]')
                    await pg.wait_for_timeout(300)
                    check(f'お知らせの「{k}」を押すと開く', opened == [urls[k]], opened)
                still = await pg.evaluate(f"() => !!document.querySelector('[data-notice=\"{key}\"].on')")
                check('リンクを押してもお知らせは開いたまま', still)
            await b.close()
    print('❌' + str(bad) if bad else 'すべて通過')

asyncio.run(main())
