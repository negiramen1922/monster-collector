#!/usr/bin/env python3
"""ハンズオンのチュートリアル(0-1〜0-5)の回帰テスト。

押させたいボタン以外を暗くして、そのボタンを押したら次へ進む形になっているか。
穴の外が押せないこと・穴の中が押せること・ほかのガイドが割り込まないこと・
スキップと再開・見直しの一覧まで、頭から通しで確かめる。

使い方: CHROMIUM_PATH=/path/to/chrome python3 tools/tutorial_ui_test.py
"""
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
            pg = await b.new_page(viewport={'width': 390, 'height': 820})
            await use_mock_auth(pg)
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(url); await pg.wait_for_timeout(900)
            await start_as_guest(pg)

            step = lambda: pg.evaluate("() => guideToastState && [guideToastState.key, guideToastState.step, guideToastState.steps.length]")
            panes = lambda: pg.locator('#guide-mask .gm-pane').count()
            async def wait_guide(n=24):
                """案内の帯が出るまで待つ(出たらその中身を返す)"""
                for _ in range(n):
                    st = await step()
                    if st: return st
                    await pg.wait_for_timeout(250)
                return None
            async def masked():
                """暗転が敷かれているか。画面の端にある相手(ナビのボタンなど)は、
                その側の板が高さ0になるので3枚になる"""
                return await pg.locator('#guide-mask.show').count() == 1 and await panes() >= 3
            spots = lambda: pg.locator('.guide-spot').count()

            async def fresh(cleared=None, party5=False):
                """まっさらな新規プレイヤーにして、好きなところまでクリア済みにする"""
                await pg.evaluate("""(a) => {
                    STATE = DEFAULT_STATE(); STATE.battleSpeed = 3; STATE.announceQueue = [];
                    STATE.guidesSeen = { welcome: true };
                    STATE.clearedStages = a.cleared || [];
                    if(a.party5){
                      grantMonster(MON_BY_ID['m11']); grantMonster(MON_BY_ID['m02']);
                      const ids = Object.keys(STATE.owned);
                      const fk = formationForFrontCount(Math.max(1, ids.filter(i => isMeleeRole(MON_BY_ID[i].role)).length)).key;
                      STATE.formationKey = fk; STATE.slots = lineupFromList(ids, fk);
                    }
                    guideOwner = null; clearGuideToast(true); closeModal();
                    goto('home'); render();
                  }""", {'cleared': cleared or [], 'party5': party5})
                await pg.wait_for_timeout(200)

            async def finish_battle(limit=400):
                """説明を進めながら戦闘が終わるまで待つ"""
                for _ in range(limit):
                    if await pg.evaluate("() => !!(battleUI && battleUI.finished)"): return True
                    if await pg.locator('.unit.ready.guide-spot').count():
                        await pg.locator('.unit.ready').first.click(); await pg.wait_for_timeout(350); continue
                    if await pg.locator('[data-guide-next]').count():
                        await pg.locator('[data-guide-next]').click(); await pg.wait_for_timeout(350); continue
                    await pg.wait_for_timeout(250)
                return False

            # ---- 1. ようこそ → チュートリアル ----
            print('\n--- 1. 入り口 ---')
            await fresh()
            await pg.evaluate("() => { delete STATE.guidesSeen.welcome; openWelcomeThenTutorial(); }")
            await pg.wait_for_timeout(400)
            who = lambda: pg.evaluate("() => { const e = document.querySelector('#guide-toast.show .guide-name'); return e ? e.textContent : null; }")
            first = await who()
            check('いきなり戦闘ではなく、ようこそ(ケットシー)から始まる', first and 'ケットシー' in first, first)
            for _ in range(4):
                if 'ヒノコ' in (await who() or ''): break
                await pg.locator('[data-guide-next]').click(); await pg.wait_for_timeout(300)
            check('ようこそのあとヒノコに交代する', 'ヒノコ' in (await who() or ''), await who())
            check('探索タブだけが光って、暗転が敷かれる',
                  await pg.locator('.nav-btn[data-nav="battle"].guide-spot').count() == 1 and await masked(),
                  [await spots(), await panes()])

            # ---- 2. 穴の外は押せない / 穴の中は押せる ----
            print('\n--- 2. 暗転の穴 ---')
            before = await step()
            await pg.mouse.click(195, 400)          # 画面の真ん中(穴の外)
            await pg.wait_for_timeout(350)
            check('穴の外を押しても進まない', await step() == before, [before, await step()])
            await pg.locator('.nav-btn[data-nav="battle"]').click(); await pg.wait_for_timeout(500)
            check('穴の中(探索タブ)を押すと次へ進む', (await step())[1] == before[1] + 1, [before, await step()])

            # ---- 3. 0-1 を頭から通す ----
            print('\n--- 3. 0-1 はじめての戦い ---')
            for sel, name in [('[data-quest-tier="tu"]', '入門'),
                              ('[data-stage-open="tu1"]', '0-1'),
                              ('.ss-go[data-stage="tu1"]', '出撃する')]:
                lit = await pg.locator(sel + '.guide-spot').count()
                check(f'{name} だけが光る', lit == 1 and await spots() == 1, [lit, await spots()])
                await pg.locator(sel).first.click(); await pg.wait_for_timeout(700)
            await pg.wait_for_timeout(1500)
            st = await pg.evaluate("() => battleUI && [battleUI.stage.id, battleUI.paused, battleUI.tutorialPause]")
            check('戦闘のあたまで止まって説明が出る', st == ['tu1', True, True], st)
            check('敵と味方が描かれている(前の戦闘の残りではない)',
                  await pg.locator('.unit[data-inspect^="enemy"]').count() > 0 and await pg.locator('.unit[data-inspect^="ally"]').count() > 0)
            check('「⏸ 一時停止中」のパネルは出ない(説明の帯と二重にならない)', await pg.locator('.pause-banner').count() == 0)
            await pg.screenshot(path=str(OUT / 'tutorial_tu1.png'))
            check('0-1をクリアできる', await finish_battle())
            st = await wait_guide()
            check('リザルトで続きの説明が出る', bool(st) and st[0] == 'tutorial', st)

            # ---- 4. 「次のステージへ」は一度押せば進む ----
            print('\n--- 4. 次のステージへ ---')
            while await pg.locator('[data-start-stage="tu2"].guide-spot').count() == 0:
                if not await pg.locator('[data-guide-next]').count(): break
                await pg.locator('[data-guide-next]').click(); await pg.wait_for_timeout(300)
            check('「次のステージへ」が光る', await pg.locator('[data-start-stage="tu2"].guide-spot').count() == 1)
            await pg.locator('[data-start-stage="tu2"]').click(); await pg.wait_for_timeout(2200)
            now = await pg.evaluate("() => battleUI && battleUI.stage.id")
            check('一度押しただけで0-2が始まる(帯が消えるだけで終わらない)', now == 'tu2', now)

            # ---- 5. 0-3 奥義: 押すまで止まって待つ ----
            print('\n--- 5. 0-3 奥義を使う ---')
            await fresh(['tu1', 'tu2'])
            await pg.evaluate("() => { STATE.autoUlt = false; startBattle('tu3', { skipIntro: true }); }")
            await pg.wait_for_timeout(2200)
            while await pg.locator('[data-guide-next]').count():
                await pg.locator('[data-guide-next]').click(); await pg.wait_for_timeout(350)
            for _ in range(160):
                if await pg.locator('.unit.ready.guide-spot').count(): break
                await pg.wait_for_timeout(250)
            check('SPが溜まると、光った子に穴が開く', await pg.locator('.unit.ready.guide-spot').count() == 1)
            check('押すまで戦闘が止まる', await pg.evaluate("() => battleUI && battleUI.paused"))
            check('止めていても「⏸ 一時停止中」は出さない', await pg.locator('.pause-banner').count() == 0)
            r1 = await pg.evaluate("() => battleUI.round")
            await pg.wait_for_timeout(2000)
            check('待っているあいだラウンドは進まない', await pg.evaluate("() => battleUI.round") == r1)
            await pg.screenshot(path=str(OUT / 'tutorial_tu3_sp.png'))
            await pg.locator('.unit.ready').first.click(); await pg.wait_for_timeout(600)
            check('止まったままタップで奥義発動が決まる', await pg.evaluate("() => battleUI.party.some(u => u.ultReserved)"))
            check('続けてオート奥義の切替を案内する', await pg.locator('#auto-ult-btn.guide-spot').count() == 1)
            await pg.locator('[data-guide-next]').click(); await pg.wait_for_timeout(700)
            check('閉じると戦闘が動き出す', not await pg.evaluate("() => battleUI.paused"))

            # ---- 6. ほかのガイドが割り込まない ----
            print('\n--- 6. チュートリアルにチュートリアルが被らない ---')
            await fresh(['tu1', 'tu2', 'tu3'], party5=True)
            await pg.evaluate("() => { goto('battle'); render(); startTutorialPre(); }")
            key_before = ((await wait_guide()) or [None])[0]
            r = await pg.evaluate("""() => {
                openGuideToast('hanoko', GUIDE_CONTENT.monsterDetail.steps, { key: 'monsterDetail' });
                replayGuide('relics');
                clearGuideToast();
                const news = openNewNewsOnEntry();
                return [guideToastState && guideToastState.key, overlayView, news];
              }""")
            check('モンスター詳細・遺物・お知らせが割り込んでも奪われない',
                  r[0] == 'tutorial' and r[1] != 'notices' and r[2] is False, [key_before] + r)
            # 0-4は編成画面に寄り道するので、モンスター詳細を開いても大丈夫か
            await pg.evaluate("() => { showMonsterDetail('m06'); }")
            await pg.wait_for_timeout(400)
            check('0-4で編成に行ってモンスター詳細を開いてもハノコが出ない',
                  (await step() or [None])[0] == 'tutorial', await step())
            await pg.evaluate("() => { closeModal(); }"); await pg.wait_for_timeout(200)

            # ---- 7. 対象が見つからないときは真っ暗にしない ----
            print('\n--- 7. 閉じ込めない ---')
            await pg.evaluate("""() => { guideOwner = 'tutorial';
                openGuideToast(TUTORIAL_MASCOT, [{ body: 'ないものを指す', spot: '.this-does-not-exist', await: 'tap' }],
                  { key: 'tutorial', dismissible: false }); }""")
            await pg.wait_for_timeout(400)
            check('見つからない相手を指しても、穴のない真っ暗にはしない', await panes() == 0)
            check('代わりに「次へ」で進める', await pg.locator('[data-guide-next]').count() == 1)
            check('スキップはいつでも出ている', await pg.locator('[data-guide-skip]').count() == 1)

            # ---- 8. スキップと再開 ----
            print('\n--- 8. スキップと再開 ---')
            await fresh(['tu1'])
            await pg.evaluate("() => { goto('battle'); render(); startTutorialPre(); }")
            await pg.wait_for_timeout(500)
            await pg.locator('[data-guide-skip]').click(); await pg.wait_for_timeout(400)
            check('スキップを押すと確認が出る', await pg.locator('[data-tut-skip]').count() == 2)
            check('確認のあいだ暗転は畳む(確認が暗転の下に隠れない)', await panes() == 0)
            await pg.locator('[data-tut-skip="no"]').click(); await pg.wait_for_timeout(400)
            check('「つづける」で案内と暗転が戻る', await pg.locator('#guide-toast.show').count() == 1 and await masked(),
                  [await pg.locator('#guide-toast.show').count(), await panes()])
            await pg.locator('[data-guide-skip]').click(); await pg.wait_for_timeout(300)
            await pg.locator('[data-tut-skip="yes"]').click(); await pg.wait_for_timeout(600)
            after = await pg.evaluate("() => [STATE.tutorialSkipped, guideOwner, STATE.clearedStages.length]")
            check('スキップしても案内が止まるだけで、ステージは残る', after == [True, None, 1], after)
            check('帯も暗転も消える', await pg.locator('#guide-toast.show').count() == 0 and await panes() == 0)
            await pg.evaluate("() => { overlayView = 'settings'; render(); }"); await pg.wait_for_timeout(400)
            check('設定に「チュートリアルを再開」が出る', await pg.locator('[data-resume-tutorial]').count() == 1)
            await pg.locator('[data-resume-tutorial]').click(); await pg.wait_for_timeout(700)
            check('押すと案内が戻る', await pg.evaluate("() => [STATE.tutorialSkipped, guideOwner]") == [False, 'tutorial']
                  and await pg.locator('#guide-toast.show').count() == 1)
            # pre を持たない回(0-2・0-3・0-5)から再開しても道順が出る
            await fresh(['tu1', 'tu2'])
            await pg.evaluate("() => { STATE.tutorialSkipped = true; resumeTutorial(); }")
            await pg.wait_for_timeout(700)
            check('0-3から再開しても出撃までの道順が出る',
                  await pg.locator('#guide-toast.show').count() == 1 and await masked(), [await step(), await panes()])

            # ---- 9. 見直しの一覧 ----
            print('\n--- 9. もう一度見る ---')
            await fresh(['tu1', 'tu2', 'tu3', 'tu4', 'tu5'])
            await pg.evaluate("() => { stageTab = 'main'; questTier = 'tu'; goto('battle'); render(); }")
            await pg.wait_for_timeout(500)
            rows = await pg.locator('.tut-replay [data-guide-help]').count()
            check('入門の画面に見直しの一覧が8項目出る', rows == 8, rows)
            await pg.screenshot(path=str(OUT / 'tutorial_replay.png'))
            keys = await pg.evaluate("() => TUTORIAL_REPLAY_TOPICS.map(t => t.key)")
            opened = []
            for k in keys:
                await pg.locator(f'[data-guide-help="{k}"]').click(); await pg.wait_for_timeout(300)
                opened.append(await pg.locator('#guide-toast.show').count() == 1)
                while await pg.locator('[data-guide-next]').count():
                    await pg.locator('[data-guide-next]').click(); await pg.wait_for_timeout(150)
            check('8項目すべて開いて閉じられる', all(opened), opened)
            await pg.evaluate("() => replayGuide('tut_form')"); await pg.wait_for_timeout(300)
            check('陣形の説明に図が出る', await pg.locator('#guide-toast .gv-form .gv-u').count() == 5)
            while await pg.locator('[data-guide-next]').count():
                await pg.locator('[data-guide-next]').click(); await pg.wait_for_timeout(150)
            await pg.evaluate("() => replayGuide('tut_element')"); await pg.wait_for_timeout(300)
            check('属性の説明に8つのアイコンが出る', await pg.locator('#guide-toast .gv-ic').count() == 8)
            await pg.locator('[data-guide-next]').click(); await pg.wait_for_timeout(250)
            check('相性の循環も出る', await pg.locator('#guide-toast .af-cycle').count() == 2)
            await pg.locator('[data-guide-next]').click(); await pg.wait_for_timeout(250)
            check('種族の10アイコンも出る', await pg.locator('#guide-toast .gv-ic').count() == 10)
            while await pg.locator('[data-guide-next]').count():
                await pg.locator('[data-guide-next]').click(); await pg.wait_for_timeout(150)

            # ---- 10. 入門の形 ----
            print('\n--- 10. 入門の中身 ---')
            info = await pg.evaluate("""() => STAGES.filter(s => s.tier === 'tu')
                .map(s => [s.id, s.name, s.waves.length, s.firstClear])""")
            check('入門は5本', len(info) == 5, [x[0] for x in info])
            check('名前に 0-1〜0-5 が付く', all(f'0-{i+1}' in info[i][1] for i in range(5)), [x[1] for x in info])
            check('石は 100/150/200/250/3000 の合計3,700',
                  [x[3] for x in info] == [100, 150, 200, 250, 3000] and sum(x[3] for x in info) == 3700,
                  [x[3] for x in info])
            check('0-3クリアで★1が2体もらえる',
                  await pg.evaluate("""() => (STAGE_BY_ID.tu3.reward || []).filter(r => r.type === 'monster').length""") == 2)
            check('倍速は0-3を終えてから', await pg.evaluate("() => SPEED_UNLOCK_STAGE") == 'tu3')
            check('旧チュートリアル(tu3まで)を終えた人は終えた扱いになる',
                  await pg.evaluate("""() => { const s = STATE.clearedStages;
                      STATE.clearedStages = ['tu1','tu2','tu3']; normalizeState();
                      const ok = tutorialCleared(); STATE.clearedStages = s; return ok; }"""))

            check('JSエラーなし', not errs, errs[:3])
            await b.close()
    print('NG' if bad else 'すべて通過')
    return bad

sys.exit(asyncio.run(main()))
