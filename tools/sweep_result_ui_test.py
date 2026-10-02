#!/usr/bin/env python3
"""周回はいつも「結果だけ」(スタミナを使って報酬だけ受け取る)から始まり、選んだ速さを覚える。
イベントのステージを「結果だけ」で回すと、結果にイベントメダル(今の編成のイベントボーナスこみ)が出る。
使い方: CHROMIUM_PATH=/path/to/chrome python3 tools/sweep_result_ui_test.py"""
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
            pg = await b.new_page(viewport={'width': 390, 'height': 900})
            await use_mock_auth(pg)
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(url); await pg.wait_for_timeout(1000)
            await start_as_guest(pg)
            await pg.evaluate("""() => { clearGuideToast(); closeModal && closeModal();
              const ev = EVENTS.find(e => e.key === 'ev_fenrir'); ev.startAt = '2026-09-01T00:00:00+09:00'; ev.endAt = '2099-01-01T00:00:00+09:00';
              ['tu1','tu2','tu3'].forEach(id => STATE.clearedStages.push(id));
              const st = ev.stages[0]; STATE.clearedStages.push(st.id); STATE.stageStars[st.id] = 3;
              STATE.owned.m68 = newOwned(MON_BY_ID.m68); STATE.slots[0] = 'm68';   // 主役を編成に入れる(ボーナス+40%)
              STATE.stamina = 300; goto('battle'); render(); sweepTarget = st.id; renderSweepModal(); }""")
            await pg.wait_for_timeout(300)
            on = await pg.evaluate("() => document.querySelector('.sw-speed.on').textContent.trim()")
            first = await pg.evaluate("() => document.querySelector('.sw-speed').textContent.trim()")
            check('周回を開くと「結果だけ」が選ばれていて、先頭にある', on == '結果だけ' and first == '結果だけ', (on, first))
            # 回数は −/＋ ボタンで決める。1 から ＋ を4回押して5回にする
            n1 = await pg.evaluate("() => document.querySelector('.sw-times').textContent.trim()")
            check('開いたときは1回', n1.startswith('1'), n1)
            # 押すたびに開き直すので、毎回引き直す
            n5 = await pg.evaluate("""() => { for(let i = 0; i < 4; i++) document.querySelector('[data-sweep-times="1"]').click();
              return document.querySelector('.sw-times').textContent.trim(); }""")
            check('＋を4回押すと5回になる', n5.startswith('5'), n5)
            nmax = await pg.evaluate("""() => { document.querySelector('[data-sweep-times="max"]').click();
              return [document.querySelector('.sw-times').textContent.trim(), sweepTimes,
                      Math.floor(STATE.stamina / findStage(sweepTarget).stamina)]; }""")
            check('「最大」で回せるだけの回数になる', nmax[1] == nmax[2], nmax)
            back5 = await pg.evaluate("""() => { document.querySelector('[data-sweep-times="-10"]').click();
              document.querySelector('[data-sweep-times="-10"]').click();
              document.querySelector('[data-sweep-times="-1"]').click();
              document.querySelector('[data-sweep-times="-1"]').click();
              while(sweepTimes > 5) document.querySelector('[data-sweep-times="-1"]').click();
              while(sweepTimes < 5) document.querySelector('[data-sweep-times="1"]').click();
              return sweepTimes; }""")
            check('−10 と − で戻せる', back5 == 5, back5)
            got = await pg.evaluate("""() => { const s0 = STATE.stamina, m0 = getItem('medal_ev_fenrir');
              document.querySelector('[data-sweep-run]').click();
              return { stam: s0 - STATE.stamina, medal: getItem('medal_ev_fenrir') - m0, battle: currentScreen,
                       line: (document.querySelector('.sw-medal') || {}).textContent || '' }; }""")
            await pg.wait_for_timeout(300)
            check('5回ぶんのスタミナを使い、戦闘には入らない', got['stam'] == 5 * 11 and got['battle'] != 'battle-fight', got)
            check('結果にイベントメダルが出る(ボーナス+40%こみ)', got['medal'] > 0 and str(got['medal']) in got['line'].replace(',', '') and '+40%' in got['line'], got)
            await pg.screenshot(path=str(OUT / 'sweep_result_medal.png'))
            on = await pg.evaluate("""() => { closeModal && closeModal(); sweepTarget = EVENTS.find(e => e.key === 'ev_fenrir').stages[0].id; renderSweepModal();
              document.querySelector('[data-sweep-speed="3"]').click(); closeModal(); renderSweepModal.seen = false; sweepSpeed = 0;
              renderSweepModal(); return document.querySelector('.sw-speed.on').textContent.trim(); }""")
            check('選んだ速さ(×3)を次に開いたときも覚えている', on == '×3', on)
            # TierIVの1日の上限を超える回数を選んだら、先に言う
            warn = await pg.evaluate("""() => { closeModal && closeModal();
              STATE.clearedStages = STAGES.map(s => s.id); STAGES.forEach(s => STATE.stageStars[s.id] = 3);
              STATE.stamina = 300; STATE.daily = null; ensureDaily();
              sweepTarget = 'q7_10h'; sweepTimes = 1; renderSweepModal();
              const one = !!document.querySelector('.alc-warn');
              document.querySelector('[data-sweep-times="max"]').click();
              const w = document.querySelector('.alc-warn');
              return { one, many: !!w, text: w ? w.textContent.replace(/\\s+/g, ' ') : '', times: sweepTimes,
                       rate: stageMatT4Rate(findStage('q7_10h')), left: matT4Left() }; }""")
            check('1回なら上限の注意は出ない', not warn['one'], warn)
            check('上限を超える回数だと「上限を超えます」が出る', warn['many'] and '上限を超えます' in warn['text'], warn)
            check('注意には本日の残りと、その回数ぶんの見込みが出る',
                  f"本日あと{warn['left']}個" in warn['text'] and '個ぶん' in warn['text'], warn['text'])
            check('JSエラーなし', not errs, errs)
            await b.close()
    sys.exit(1 if bad else 0)

asyncio.run(main())
