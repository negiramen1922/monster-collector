#!/usr/bin/env python3
"""スキル強化: 「レベルアップする」を押しても強化画面は閉じず、続けて上げられる。
閉じると、キャラ詳細の一番上ではなく、開く前に見ていた場所に戻る。
使い方: CHROMIUM_PATH=/path/to/chrome python3 tools/skill_up_stay_ui_test.py"""
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
            tid = await pg.evaluate("""() => { clearGuideToast(); STATE.announceQueue = [];
              STATE.guidesSeen = Object.assign(STATE.guidesSeen || {}, { welcome: true, monsterDetail: true });
              const m = MONSTERS.find(x => x.name === 'トレント');
              STATE.owned[m.id] = Object.assign(newOwned(m), { star: 5, level: 100, ultLv: 1, skillLv: 1, skill2Lv: 1, passiveLv: 1 });
              Object.entries(MAT_FAMILIES).forEach(([f, d]) => d.kinds().forEach(k => [1, 2, 3, 4].forEach(t => addItem(matKey(f, k, t), 999))));
              addGold(10000000); saveState(); openMonsterDetailOrPreview(m.id); return m.id; }""")
            await pg.wait_for_timeout(400)
            # スキル欄までスクロールしてから、強化ボタンを押す
            top0 = await pg.evaluate("""() => { const d = document.querySelector('.detail-modal'); const btn = d.querySelector('[data-skill-up]');
              btn.scrollIntoView({ block: 'center' }); return d.scrollTop; }""")
            await pg.wait_for_timeout(200)
            field = await pg.evaluate("() => { const btn = document.querySelector('.detail-modal [data-skill-up]'); btn.click(); return btn.dataset.field; }")
            await pg.wait_for_timeout(300)
            lv0 = await pg.evaluate(f"() => STATE.owned['{tid}']['{field}']")
            await pg.evaluate("() => document.querySelector('[data-confirm-skill-up]').click()"); await pg.wait_for_timeout(300)
            r = await pg.evaluate(f"() => ({{ lv: STATE.owned['{tid}']['{field}'], open: !!document.querySelector('.skill-up-modal'), detail: !!document.querySelector('.detail-modal'), flash: (document.querySelector('.skill-up-modal .rd-flash') || {{}}).textContent || '' }})")
            check('レベルアップしても強化画面は閉じない', r['lv'] == lv0 + 1 and r['open'] and not r['detail'], r)
            check('上がったことが画面に出る', '上がりました' in r['flash'], r['flash'])
            await pg.screenshot(path=str(OUT / 'skill_up_stay.png'))
            await pg.evaluate("() => document.querySelector('[data-confirm-skill-up]').click()"); await pg.wait_for_timeout(300)
            lv2 = await pg.evaluate(f"() => STATE.owned['{tid}']['{field}']")
            check('そのまま続けてもう1回上げられる', lv2 == lv0 + 2, lv2)
            await pg.evaluate("() => document.querySelector('[data-close-skill-up]').click()"); await pg.wait_for_timeout(300)
            top1 = await pg.evaluate("() => { const d = document.querySelector('.detail-modal'); return d ? d.scrollTop : -1; }")
            check('閉じるとキャラ詳細の、開く前に見ていた場所に戻る(一番上に行かない)', top0 > 50 and abs(top1 - top0) < 5, [top0, top1])
            await b.close()
    real = [e for e in errs if 'favicon' not in e]
    check('JSエラーなし', not real, real[:3])
    print('すべて通過' if bad == 0 else f'{bad}件 失敗')

asyncio.run(main())
