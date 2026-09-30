#!/usr/bin/env python3
"""周回結果に「1回ずつの行」が上から順に出る(左にMVP、右にその回いちばん良かったドロップ)。
「結果だけ」も ×1〜×4 のオート周回も同じ並び。一覧をタップすると残りを一気に出す。
使い方: CHROMIUM_PATH=/path/to/chrome python3 tools/sweep_log_ui_test.py"""
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

ROWS = "() => { const r = [...document.querySelectorAll('.swl-row')]; return { n: r.length, shown: r.filter(x => x.classList.contains('in')).length, mvp: r.filter(x => x.querySelector('.swl-mvp img')).length, drop: r.filter(x => x.querySelector('.swl-ic')).length }; }"

async def main():
    with game_url() as url:
        async with async_playwright() as p:
            b = await p.chromium.launch(**LAUNCH)
            pg = await b.new_page(viewport={'width': 390, 'height': 844})
            await use_mock_auth(pg)
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(url); await pg.wait_for_timeout(1000)
            await start_as_guest(pg)
            await pg.evaluate("""() => { clearGuideToast(); closeModal && closeModal();
              const ev = EVENTS.find(e => e.key === 'ev_fenrir'); ev.startAt = '2026-09-01T00:00:00+09:00'; ev.endAt = '2099-01-01T00:00:00+09:00';
              ['tu1','tu2','tu3'].forEach(id => STATE.clearedStages.push(id));
              const st = ev.stages[9]; ev.stages.forEach(s => { STATE.clearedStages.push(s.id); STATE.stageStars[s.id] = 3; });
              ['m68','m01','m02'].forEach((id, i) => { if(MON_BY_ID[id]){ STATE.owned[id] = STATE.owned[id] || newOwned(MON_BY_ID[id]); STATE.slots[i] = id; } });
              STATE.stamina = 5000; STATE.sweepSpeed = 0; goto('battle'); render(); sweepTarget = st.id; renderSweepModal(); }""")
            await pg.wait_for_timeout(300)
            await pg.evaluate("() => { const b = document.querySelector('[data-sweep-run]'); b.dataset.sweepRun = '10'; b.click(); }")
            await pg.wait_for_timeout(450)
            early = await pg.evaluate(ROWS)
            await pg.screenshot(path=str(OUT / 'sweep_log_mid.png'))
            check('「結果だけ」10回: 行が10本できる', early['n'] == 10, early)
            check('はじめは一部だけ出ていて、上から順に出てくる', 0 < early['shown'] < 10, early)
            await pg.wait_for_timeout(3500)
            done = await pg.evaluate(ROWS)
            check('しばらくすると全部出る', done['shown'] == 10, done)
            check('どの行にもMVPの顔', done['mvp'] == 10, done)
            order = await pg.evaluate("() => [...document.querySelectorAll('.swl-row small')].filter(x => /^RUN/.test(x.textContent)).map(x => x.textContent.slice(0, 6))")
            check('RUN 01 から順に並ぶ', order[:3] == ['RUN 01', 'RUN 02', 'RUN 03'], order[:3])
            await pg.screenshot(path=str(OUT / 'sweep_log_done.png'))

            # ドロップの選びかた(ソウル > ルーン > TierIII、なにもなければ空)
            r = await pg.evaluate("""() => {
              const a = sweepBestDrop({ souls: [{ id: 'm68', n: 1 }], items: [{ key: matKey(Object.keys(MAT_FAMILIES)[0], MAT_FAMILIES[Object.keys(MAT_FAMILIES)[0]].kinds()[0], 3), n: 2 }] });
              const b2 = sweepBestDrop({ items: [{ key: matKey(Object.keys(MAT_FAMILIES)[0], MAT_FAMILIES[Object.keys(MAT_FAMILIES)[0]].kinds()[0], 1), n: 9 }] });
              return { a: a && a.kind, b: b2 }; }""")
            check('ソウルがあればソウルを出す / TierI・IIだけなら空', r['a'] == 'soul' and r['b'] is None, r)

            # タップで一気に出す
            await pg.evaluate("() => { closeModal(); STATE.stamina = 5000; renderSweepModal(); const b = document.querySelector('[data-sweep-run]'); b.dataset.sweepRun = '20'; b.click(); }")
            await pg.wait_for_timeout(250)
            await pg.click('[data-sweep-log]')
            await pg.wait_for_timeout(100)
            r = await pg.evaluate(ROWS)
            check('一覧をタップすると残りが一気に出る', r['n'] > 0 and r['shown'] == r['n'], r)

            # オート周回(×4)でも同じ行が出る
            await pg.evaluate("() => { closeModal(); STATE.stamina = 5000; Object.values(STATE.owned).forEach(o => { o.level = 300; o.star = 10; }); const ev = EVENTS.find(e => e.key === 'ev_fenrir'); startAutoRun(ev.stages[0].id, 2, 4); }")
            for _ in range(120):
                await pg.wait_for_timeout(500)
                if await pg.evaluate("() => !!document.querySelector('.swl')"): break
            await pg.wait_for_timeout(800)
            r = await pg.evaluate(ROWS)
            check('オート周回2回: 行が2本・MVPつき', r['n'] == 2 and r['mvp'] == 2 and r['shown'] == 2, r)
            await pg.screenshot(path=str(OUT / 'sweep_log_auto.png'))
            await b.close()
    real = [e for e in errs if 'favicon' not in e]
    check('JSエラーなし', not real, real[:3])
    print('すべて通過' if bad == 0 else f'{bad}件 失敗')

asyncio.run(main())
