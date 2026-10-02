#!/usr/bin/env python3
"""遺物: スキル強化で「レベルアップする」を押しても確認画面は閉じず、続けて上げられる。閉じると強化画面の同じ場所に戻る。
★の並べ方はモンスターと同じ: 白い★を5個まで、★6を超えたぶんは左から青。
使い方: CHROMIUM_PATH=/path/to/chrome python3 tools/relic_up_stay_ui_test.py"""
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
            pg = await b.new_page(viewport={'width': 390, 'height': 700})
            await use_mock_auth(pg)
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(url); await pg.wait_for_timeout(900)
            await start_as_guest(pg)
            # ★の並べ方
            r = await pg.evaluate("""() => { const def = s => Object.values(RELICS).find(d => d.star === s);
              const row = (s, d) => { const el = document.createElement('div'); el.innerHTML = relicStarRowHtml(def(s), { dupeUsed: d }); const i = [...el.querySelectorAll('i')]; return [i.length, i.filter(x => x.classList.contains('blue')).length, i.findIndex(x => !x.classList.contains('blue'))]; };
              return { s5d4: row(5, 4), s5d1: row(5, 1), s5d0: row(5, 0), s3d2: row(3, 2), s4d2: row(4, 2), s2d0: row(2, 0) }; }""")
            check('★5のまま: 白い★5個', r['s5d0'] == [5, 0, 0], r)
            check('★6(★5を1回共鳴): ★5個のうち左の1個が青', r['s5d1'] == [5, 1, 1], r)
            check('★9(★5を4回共鳴): 左から4個が青、右の1個は白', r['s5d4'] == [5, 4, 4], r)
            check('★5以下は白い★だけ(★3+2回=★5、★2)', r['s3d2'] == [5, 0, 0] and r['s2d0'] == [2, 0, 0], r)
            check('★4+2回=★6: 左の1個が青', r['s4d2'] == [5, 1, 1], r)
            # スキル強化
            rid = await pg.evaluate("""() => { clearGuideToast(); STATE.announceQueue = [];
              const def = Object.values(RELICS).find(d => d.star === 5); grantRelic(def); const st = STATE.relics[def.id]; st.dupe = 4; st.dupeUsed = 2;
              addGold(10000000); [1, 2, 3].forEach(t => addItem('relic_core_' + t, 99)); addItem('relic_scrap', 9999);
              saveState(); openRelicUpgrade(def.id); return def.id; }""")
            await pg.wait_for_timeout(300)
            top0 = await pg.evaluate("""() => { const m = document.querySelector('.relic-upgrade-modal'); const b = m.querySelector('[data-relic-skillup]');
              b.scrollIntoView({ block: 'center' }); return m.scrollTop; }""")
            await pg.screenshot(path=str(OUT / 'relic_up_stars.png'))
            await pg.evaluate("() => document.querySelector('.relic-upgrade-modal [data-relic-skillup]').click()"); await pg.wait_for_timeout(250)
            lv0 = await pg.evaluate(f"() => STATE.relics['{rid}'].skillLv || 1")
            await pg.evaluate("() => document.querySelector('[data-confirm-relic-skill-up]').click()"); await pg.wait_for_timeout(250)
            r = await pg.evaluate(f"() => ({{ lv: STATE.relics['{rid}'].skillLv, open: !!document.querySelector('[data-confirm-relic-skill-up]'), flash: (document.querySelector('.rd-flash') || {{}}).textContent || '' }})")
            check('遺物のスキル強化: 押しても確認画面は閉じない', r['lv'] == lv0 + 1 and r['open'], r)
            check('上がったことが画面に出る', '上がりました' in r['flash'], r)
            await pg.screenshot(path=str(OUT / 'relic_skill_stay.png'))
            await pg.evaluate("() => document.querySelector('[data-confirm-relic-skill-up]').click()"); await pg.wait_for_timeout(250)
            check('続けてもう1回上げられる', await pg.evaluate(f"() => STATE.relics['{rid}'].skillLv") == lv0 + 2)
            await pg.evaluate("() => document.querySelector('[data-close-relic-skill-up]').click()"); await pg.wait_for_timeout(250)
            top1 = await pg.evaluate("() => { const m = document.querySelector('.relic-upgrade-modal'); return m ? m.scrollTop : -1; }")
            check('閉じると遺物の強化画面の、見ていた場所に戻る', top0 > 30 and abs(top1 - top0) < 5, [top0, top1])
            # レベルアップしても強化画面の場所はそのまま
            t2 = await pg.evaluate("""() => { const m = document.querySelector('.relic-upgrade-modal'); const b = m.querySelector('[data-relic-levelup]');
              if(!b) return null; b.scrollIntoView({ block: 'center' }); const t = m.scrollTop; b.click(); const m2 = document.querySelector('.relic-upgrade-modal'); return [t, m2 ? m2.scrollTop : -1]; }""")
            check('遺物のレベルアップでも画面は閉じず、場所もそのまま', t2 is None or (t2[1] >= 0 and abs(t2[0] - t2[1]) < 5), t2)
            await b.close()
    real = [e for e in errs if 'favicon' not in e]
    check('JSエラーなし', not real, real[:3])
    print('すべて通過' if bad == 0 else f'{bad}件 失敗')

asyncio.run(main())
