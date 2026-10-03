#!/usr/bin/env python3
"""称号: データは1か所(registerTitle)。プロフィールの「称号一覧」で、実績/イベントに分けて全部見られる。
持っている称号はタップで付け替え、持っていない称号は取り方と進みぐあい、終わったイベントのものは「もう取れません」。
使い方: CHROMIUM_PATH=/path/to/chrome python3 tools/title_list_ui_test.py"""
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
            pg = await b.new_page(viewport={'width': 390, 'height': 844})
            await use_mock_auth(pg)
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(url); await pg.wait_for_timeout(900)
            await start_as_guest(pg)
            r = await pg.evaluate("""() => { clearGuideToast(); STATE.announceQueue = [];
              const all = Object.values(TITLES);
              return { n: all.length, cats: [...new Set(all.map(t => t.cat))], noHow: all.filter(t => !t.how).map(t => t.key),
                exHow: TITLES.ti_ev_kyubi_ex.how }; }""")
            check('称号は1か所に登録され、全部に取り方がある', r['n'] >= 28 and not r['noHow'] and sorted(r['cats']) == ['achieve', 'event'], r)
            check('EXの称号の取り方は「EX3を★3でクリアする」', '★3' in r['exHow'], r['exHow'])
            await pg.evaluate("""() => { grantTitle('ti_ev_kyubi_deep'); grantTitle('ach_x_login'); STATE.title = 'ti_ev_kyubi_deep'; saveState(); openOverlay('profile'); }""")
            await pg.wait_for_timeout(400)
            txt = await pg.evaluate("() => (document.querySelector('[data-open-titles]') || {}).textContent || ''")
            check('プロフィールに「称号一覧(持っている/全部)」のボタン', '称号一覧(2 /' in txt, txt)
            await pg.click('[data-open-titles]'); await pg.wait_for_timeout(300)
            r = await pg.evaluate("() => ({ rows: document.querySelectorAll('.tl-row').length, own: document.querySelectorAll('.tl-row.own').length, prog: document.querySelectorAll('.tl-row .tl-bar').length, tabs: [...document.querySelectorAll('.tl-tab')].map(x => x.textContent) })")
            check('実績タブ: 持っている称号と、持っていない称号(進みぐあいつき)が並ぶ', r['rows'] >= 16 and r['own'] == 1 and r['prog'] >= 10, r)
            await pg.screenshot(path=str(OUT / 'title_list_achieve.png'))
            await pg.click('[data-set-title="ach_x_login"]'); await pg.wait_for_timeout(200)
            check('タップで付け替えられる', await pg.evaluate("() => STATE.title") == 'ach_x_login' and await pg.locator('.tl-row.on').count() == 1)
            await pg.click('[data-title-tab="event"]'); await pg.wait_for_timeout(200)
            r = await pg.evaluate("() => ({ groups: [...document.querySelectorAll('.tl-group')].map(x => x.textContent), rows: document.querySelectorAll('.tl-row').length })")
            check('イベントタブ: イベントごとにまとまる', len(r['groups']) >= 2 and r['rows'] >= 6, r)
            # 終わったイベントは「もう取れません」
            await pg.evaluate("() => { const ev = EVENTS.find(e => e.key === 'ev_titan'); ev.endAt = '2020-01-01T00:00:00+09:00'; renderTitleList(); }")
            ended = await pg.locator('.tl-row.ended').count()
            check('終わったイベントで持っていない称号は「もう取れません」', ended >= 3, ended)
            await pg.screenshot(path=str(OUT / 'title_list_event.png'))
            await pg.click('[data-close-title-list]'); await pg.wait_for_timeout(200)
            check('閉じるとプロフィールに戻り、いまの称号が出ている', await pg.locator('.pf-title-now .pf-title.on').count() == 1)
            await b.close()
    real = [e for e in errs if 'favicon' not in e]
    check('JSエラーなし', not real, real[:3])
    print('すべて通過' if bad == 0 else f'{bad}件 失敗')

asyncio.run(main())
