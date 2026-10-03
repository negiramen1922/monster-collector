#!/usr/bin/env python3
"""イベントメニュー・イベントミッション・称号・召喚券を実際の画面で確かめる。

使い方: CHROMIUM_PATH=/path/to/chrome python3 tools/ev_menu_test.py
"""
import asyncio, os, pathlib, json
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
            pg = await b.new_page(viewport={'width': 390, 'height': 780})
            await use_mock_auth(pg)
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(url); await pg.wait_for_timeout(1000)
            await start_as_guest(pg)

            # フェンリルを開催中にして、全層★3・EX3までクリアずみにする
            r = await pg.evaluate("""() => {
              const ev = EVENTS.find(e => e.key === 'ev_fenrir');
              ev.startAt = '2026-09-01T00:00:00+09:00';
              ['tu1','tu2','tu3'].forEach(id => STATE.clearedStages.push(id));   // 探索メニューはチュートリアル後に出る
              ev.stages.forEach(s => { STATE.clearedStages.push(s.id); STATE.stageStars[s.id] = 3; });
              [1,2,3].forEach(n => STATE.clearedStages.push(ev.key + '_ex' + n));
              STATE.stageStars[ev.key + '_ex3'] = 3;   // EX3を★3(称号のミッション)
              const m = evMissionState('ev_fenrir');
              m.clears = 60; m.bonusMax = 2; m.pickClears = 12;
              const ms = eventMissions(ev);
              return { n: ms.length, claim: ms.filter(x => x.state === 'claim').length, ids: ms.map(x => x.id) };
            }""")
            # 経済見直し(α0.4.000): EXのミッションは「EX3を★3」の称号1本だけ(星結晶はEXステージの初回クリアに移した)
            check('ミッションは通常8＋★3＋EX3★3の12本', r['n'] == 12, r['ids'])
            check('条件を満たすと12本すべて受け取れる', r['claim'] == 12, r['claim'])

            got = await pg.evaluate("""() => {
              const c0 = STATE.crystals;
              claimEventMissionsAll('ev_fenrir');
              return { crystal: STATE.crystals - c0, medal: getItem('medal_ev_fenrir'),
                       titles: (STATE.titles || []).map(k => TITLES[k].name), title: myTitleText(),
                       gc: getItem('gacha_char'), gc10: getItem('gacha_char10'),
                       left: eventMissions(EVENTS.find(e => e.key === 'ev_fenrir')).filter(x => x.state === 'claim').length };
            }""")
            # 通常500 ＋ ★500 = 1,000(経済見直し)
            check('結晶は1,000もらえる', got['crystal'] == 1000, got['crystal'])
            # 通常500 ＋ ★1,800 = 2,300
            check('メダルは2,300もらえる', got['medal'] == 2300, got['medal'])
            check('ミッションから召喚券は出ない(イベントの召喚券はショップの10枚だけ)', got['gc'] == 0 and got['gc10'] == 0, (got['gc'], got['gc10']))
            check('称号を3つ手に入れる', len(got['titles']) == 3, got['titles'])
            check('最初の称号が自動でつく', bool(got['title']), got['title'])
            check('受け取り残しがない', got['left'] == 0, got['left'])

            await pg.evaluate("() => closeModal && closeModal()")
            await pg.evaluate("() => { goto('battle'); stageTab = 'event'; eventKey = 'ev_fenrir'; eventView = 'menu'; render(); }")
            await pg.wait_for_timeout(400)
            n = await pg.locator('.ev-entry').count()
            check('イベントトップに入口が5つ並ぶ', n == 5, n)
            check('バナーが出る', await pg.locator('.ev-banner').count() == 1)
            await pg.screenshot(path=str(OUT / 'ev_menu.png'))

            for view, sel, want in [('quest', '.stage-row, .ss-card', 10), ('ex', '.stage-row, .ss-card', 3)]:
                await pg.evaluate(f"() => {{ eventView = '{view}'; render(); }}"); await pg.wait_for_timeout(300)
                c = await pg.locator(sel).count()
                check(f'{view}に{want}ステージ出る', c == want, c)
                await pg.screenshot(path=str(OUT / f'ev_{view}.png'))

            await pg.evaluate("() => { eventView = 'mission'; render(); }"); await pg.wait_for_timeout(300)
            c = await pg.locator('.ev-mi').count()
            check('ミッション画面に12行出る', c == 12, c)
            await pg.screenshot(path=str(OUT / 'ev_mission.png'))

            await pg.evaluate("() => { eventView = 'bonus'; render(); }"); await pg.wait_for_timeout(300)
            c = await pg.locator('.ev-bonus-row').count()
            check('ボーナス画面にピックアップ＋注目★4＋属性の行が出る', c == 4, c)
            await pg.screenshot(path=str(OUT / 'ev_bonus.png'))

            # 称号: プロフィールで選べる
            await pg.evaluate("() => openOverlay('profile')"); await pg.wait_for_timeout(500)
            # α0.4.003〜: 称号はプロフィールの「称号・フレームを見る」の一覧で付け替える(持っている3つに「付ける/付けている」)
            await pg.evaluate("() => { openTitleList(); titleList.tab = 'event'; renderTitleList(); }"); await pg.wait_for_timeout(200)
            c = await pg.locator('.tl-row.own').count()
            check('称号一覧で、手に入れた3つを付け替えられる', c == 3, c)
            await pg.evaluate("() => closeTitleList()"); await pg.wait_for_timeout(200)
            check('名前の上に称号が出る', await pg.locator('.pf-name-title').count() == 1)
            await pg.screenshot(path=str(OUT / 'ev_title.png'))

            # 召喚券でガチャ
            await pg.evaluate("() => { closeOverlay(); addItem('gacha_char', 5); addItem('gacha_char10', 1); gachaKind = 'mon'; goto('gacha'); render(); }")
            await pg.wait_for_timeout(400)
            c = await pg.locator('[data-ticket-pull]').count()
            check('券を持っていると「券で引く」が出る', c == 2, c)
            before = await pg.evaluate("() => [getItem('gacha_char'), STATE.crystals, STATE.totalPulls]")
            await pg.evaluate("() => doPull(1, 0, 'gacha_char')"); await pg.wait_for_timeout(500)
            after = await pg.evaluate("() => [getItem('gacha_char'), STATE.crystals, STATE.totalPulls]")
            check('券で引くと券が1枚減り結晶は減らない', after[0] == before[0] - 1 and after[1] == before[1], (before, after))
            check('天井(召喚ポイント)は結晶で引いた時と同じに数える', after[2] == before[2] + 1, (before[2], after[2]))
            await b.close()
    real = [e for e in errs if 'favicon' not in e]
    check('JSエラーが出ない', not real, real[:3])
    print('すべて通過' if bad == 0 else f'{bad}件 失敗')
    return 1 if bad else 0

raise SystemExit(asyncio.run(main()))
