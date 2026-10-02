"""どのクエストでもリザルト画面の作りが同じか。特に「次のステージへ」が出るか。
   使い方: CHROMIUM_PATH=/opt/pw-browsers/chromium python3 tools/result_screen_ui_test.py"""
import asyncio, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from _serve import game_url, use_mock_auth, start_as_guest
from playwright.async_api import async_playwright

bad = 0
def check(name, cond, info=None):
    global bad
    if not cond: bad += 1
    print(('✅' if cond else '❌') + ' ' + name + ('  ' + repr(info) if info is not None else ''))

CASES = [
    ('メインクエスト',       "STAGE_BY_ID['q1_01']",              True),
    ('メイン(ハード)',       "STAGE_BY_ID['q1_01h']",             True),
    ('イベントのクエスト',    "STAGE_BY_ID['ev_kyubi_1']",         True),
    ('イベントの最終ステージ', "STAGE_BY_ID['ev_kyubi_10']",        False),
    ('EXクエスト',          "STAGE_BY_ID['ev_kyubi_ex1']",       True),
    ('EXの最終',            "STAGE_BY_ID['ev_kyubi_ex3']",       False),
    ('育成クエスト',         "dungeonStage('exp', 0)",            True),
    ('育成クエストの最終段',  "dungeonStage('exp', 4)",            False),
    ('深淵回廊',            "abyssStage(3)",                     True),
]

async def main():
    with game_url() as url:
        async with async_playwright() as pw:
            b = await pw.chromium.launch(executable_path='/opt/pw-browsers/chromium')
            pg = await b.new_page(viewport={'width': 420, 'height': 1200})
            await use_mock_auth(pg)
            await pg.add_init_script("""(() => { const R=Date; const T=new R('2026-10-02T12:00:00+09:00').getTime();
              const d0=R.now(); function F(...a){ return a.length? new R(...a) : new R(T + (R.now()-d0)); }
              F.now=()=>T+(R.now()-d0); F.parse=R.parse; F.UTC=R.UTC; F.prototype=R.prototype; window.Date=F; })()""")
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(url); await pg.wait_for_timeout(900)
            await start_as_guest(pg)
            await pg.evaluate("""() => { clearGuideToast(); closeModal && closeModal(); STATE.announceQueue = [];
              STATE.clearedStages = STAGES.map(s => s.id); STATE.stamina = 9999;
              ensureAbyss(); STATE.abyss.floor = 4; }""")

            for label, expr, wantNext in CASES:
                got = await pg.evaluate("""(expr) => {
                  const st = eval(expr);
                  // 勝った形のダミーの戦闘結果を作って、リザルトだけ描く
                  const party = STATE.slots.filter(Boolean).slice(0, 4).map(id => buildUnit(MON_BY_ID[id], 50, false, null, false, 1, {}));
                  battleUI = { stage: st, win: true, round: 3, waveIndex: st.waves.length - 1, party,
                    enemies: [], waveResults: st.waves.map((_, i) => ({ wave: i + 1, result: 'win', rounds: 3 })),
                    rank: 3, prevRank: 0, log: [], fxEvents: [], finished: true,
                    rewards: { items: [], gold: 100, souls: [], crystals: 0, firstItems: [], medal: null },
                    abyssResult: st.type === 'abyss' ? { floor: st.floor, checkpoint: false, first: true, restart: 1 } : null };
                  showBattleResult(battleUI);
                  const el = document.querySelector('.battle-result');
                  if(!el) return null;
                  const btn = [...el.querySelectorAll('[data-start-stage]')].map(x => x.textContent.replace(/\\s+/g, ' ').trim());
                  return { has: !!el,
                    title: !!el.querySelector('.br-title'), party: !!el.querySelector('.br-party'),
                    waves: !!el.querySelector('.br-waves'), tabs: el.querySelectorAll('.br-tab').length,
                    back: !!el.querySelector('[data-result-nav="battle"]'),
                    next: btn.filter(t => /次のステージ|階へ進む/.test(t)),
                    again: btn.filter(t => /もう一度|再挑戦/.test(t)) };
                }""", expr)
                if got is None:
                    check(label + ': リザルトが出る', False); continue
                isAbyss = '深淵' in label
                base = got['title'] and got['party'] and got['waves'] and got['tabs'] == 2 and got['back']
                check(f'{label}: 画面の作りが同じ(見出し・編成・ウェーブ・タブ2つ・戻る)', base, got)
                # 深淵回廊だけは勝つと次の階へ上がるので、同じ階に「もう一度」は無い(わざとの差)
                check(f'{label}: もう一度 ' + ('は出ない(勝つと次の階へ上がるので)' if isAbyss else 'が出る'),
                      bool(got['again']) != isAbyss, got['again'])
                check(f'{label}: 次のステージへ ' + ('が出る' if wantNext else 'は出ない(最後なので)'),
                      bool(got['next']) == wantNext, got['next'])
                await pg.evaluate("() => closeModal && closeModal()")

            check('JSエラーなし', not errs, errs[:3])
            await b.close()
    sys.exit(1 if bad else 0)

asyncio.run(main())
