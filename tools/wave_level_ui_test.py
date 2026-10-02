"""ウェーブごとに敵のレベルが上がり、最終ウェーブが推奨レベルになる。ステージ画面の「敵Lv◯〜◯」もその範囲になる。
   使い方: CHROMIUM_PATH=/opt/pw-browsers/chromium python3 tools/wave_level_ui_test.py"""
import asyncio, sys, pathlib, re
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from _serve import game_url, use_mock_auth, start_as_guest
from playwright.async_api import async_playwright

bad = 0
def check(name, cond, info=None):
    global bad
    if not cond: bad += 1
    print(('✅' if cond else '❌') + ' ' + name + ('  ' + repr(info) if info is not None else ''))

async def sheet(pg, sid):
    await pg.evaluate("""(sid) => { closeModal && closeModal();
      STATE.clearedStages = STAGES.map(s => s.id);
      goto('battle'); render(); stageSheet = sid; renderStageSheet(); }""", sid)
    await pg.wait_for_timeout(250)
    return await pg.inner_text('.ss-meta')

async def main():
    with game_url() as url:
        async with async_playwright() as pw:
            b = await pw.chromium.launch(executable_path='/opt/pw-browsers/chromium')
            pg = await b.new_page(viewport={'width': 420, 'height': 1000})
            await use_mock_auth(pg)
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(url); await pg.wait_for_timeout(900)
            await start_as_guest(pg)

            # 神話級の最後: 推奨Lv300・4ウェーブ → 敵Lv250〜300
            meta = await sheet(pg, 'q7_10')
            check('推奨Lvと敵Lvの範囲が出る', '推奨Lv300' in meta and '敵Lv250〜300' in meta, meta.replace('\n', ' / '))

            # 上限の端が推奨レベルと一致する(どのステージでも)
            bads = await pg.evaluate("""() => STAGES.filter(st => (st.waves || []).length > 1)
              .map(st => { const l = stageEnemyLevels(st);
                return { id: st.id, rec: st.rec, lo: Math.min(...l), hi: Math.max(...l) }; })
              .filter(x => x.hi !== x.rec || x.lo > x.rec).slice(0, 5)""")
            check('最後のウェーブがちょうど推奨レベル(全ステージ)', bads == [], bads)

            # ウェーブごとに上がっていて、下がらない
            drops = await pg.evaluate("""() => STAGES.filter(st => (st.waves || []).length > 1)
              .filter(st => { const l = stageEnemyLevels(st); return l.some((v, i) => i && v < l[i - 1]); })
              .map(st => st.id).slice(0, 5)""")
            check('ウェーブが進むとレベルが下がらない', drops == [], drops)

            # 推奨Lvの低いステージがLv1に潰れていない
            flat = await pg.evaluate("""() => { const st = STAGE_BY_ID['q1_10'], l = stageEnemyLevels(st);
              return { rec: st.rec, lv: l }; }""")
            check('推奨Lv28のステージも段がある', flat['lv'][0] < flat['lv'][-1] and flat['lv'][-1] == flat['rec'], flat)

            # 深淵回廊は1ウェーブなので推奨レベルちょうど1つ
            ab = await pg.evaluate("() => { const st = abyssStage(30); return { rec: st.rec, lv: stageEnemyLevels(st) }; }")
            check('深淵回廊は推奨レベルちょうど', ab['lv'] == [ab['rec']], ab)

            # 実際に出てくる敵も表示どおりのレベル
            lv = await pg.evaluate("""() => { closeModal && closeModal();
              const st = STAGE_BY_ID['q7_10'];
              return st.waves.map((w, i) => waveEnemyLv(st, i)); }""")
            check('ウェーブのレベルは 250→267→283→300', lv == [250, 267, 283, 300], lv)
            spawned = await pg.evaluate("""() => { const st = STAGE_BY_ID['q7_10'];
              startBattle(st.id, { skipIntro: true });
              const got = battleUI.enemies.map(u => u.level);
              return { w1: [...new Set(got)], boss: battleUI.enemies.some(u => u.boss) }; }""")
            check('第1ウェーブの敵が実際にLv250で出る', spawned['w1'] == [250], spawned)

            check('JSエラーなし', not errs, errs)
            await pg.screenshot(path='/tmp/claude-0/-home-user-monster-collector/07e3a820-f360-57bd-8a3f-3072a7fc0146/scratchpad/wave_lv.png')
            await b.close()
    sys.exit(1 if bad else 0)

asyncio.run(main())
