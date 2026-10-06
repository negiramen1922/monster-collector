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
            # 前の節の案内が残っていると同じkeyで弾かれるので、いったん畳んでから開く
            await pg.evaluate("""() => { guideOwner = null; clearGuideToast(true); guideOwner = 'tutorial';
                openGuideToast(TUTORIAL_MASCOT, [{ body: 'ないものを指す', spot: '.this-does-not-exist', await: 'tap' }],
                  { key: 'tutorial', dismissible: false }); }""")
            await pg.wait_for_timeout(400)
            check('見つからない相手を指しても、穴のない真っ暗にはしない', await panes() == 0)
            check('代わりに「次へ」で進める', await pg.locator('[data-guide-next]').count() == 1)
            check('スキップはいつでも出ている', await pg.locator('[data-guide-skip]').count() == 1)
            await pg.evaluate("""() => { guideOwner = null; clearGuideToast(true); guideOwner = 'tutorial';
                openGuideToast(TUTORIAL_MASCOT, [{ body: '説明だけのステップ' }], { key: 'tutorial', dismissible: false }); }""")
            await pg.wait_for_timeout(400)
            check('説明だけのステップでも暗転する(読んでいるあいだに別の画面へ行けない)', await panes() == 1, await panes())
            check('そのときも「次へ」は押せる(帯は暗転より上)', await pg.locator('[data-guide-next]').count() == 1)
            await pg.evaluate("() => { guideOwner = null; clearGuideToast(true); }")

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

            # ---- 11. 0-4 陣形とロールの向き ----
            print('\n--- 11. 0-4 陣形とロールの向き ---')
            await fresh(['tu1', 'tu2', 'tu3'])
            await pg.evaluate("""() => { grantMonster(MON_BY_ID['m11']); grantMonster(MON_BY_ID['m02']);
                goto('home', { nav: true }); startTutorialPre(); }""")
            await wait_guide()
            form = lambda: pg.evaluate("""() => { const f = currentFormation(); return {
                key: STATE.formationKey, front: f.front, party: getPartyIds().length,
                rows: STATE.slots.map((id, i) => id ? [MON_BY_ID[id].name, MON_BY_ID[id].role, slotRowIn(f, i)] : null),
                warn: penalizedIds().map(id => MON_BY_ID[id].name) }; }""")
            bodies, log, seen_warn, launched = [], [], None, None
            for _ in range(30):
                st = await pg.evaluate("""() => { const s = guideToastState; if(!s) return null;
                    const d = s.steps[s.step];
                    return { spot: d.spot || null, tap: d.await === 'tap',
                             body: (d.body || '').replace(/<[^>]*>/g, ''),
                             found: d.spot ? !!document.querySelector(d.spot) : null }; }""")
                if not st: break
                bodies.append(st['body'])
                log.append((st['spot'], st['found']))
                if st['spot'] and not st['found']: break
                if st['spot'] == '[data-row-warn]': seen_warn = await form()
                if st['tap']:
                    if st['spot'] == '.ss-go[data-stage="tu4"]': launched = await form()
                    await pg.locator(st['spot']).first.click()
                else:
                    await pg.locator('[data-guide-next]').click()
                await pg.wait_for_timeout(500)
                if launched: break
            joined = ' '.join(bodies)
            spotted = [sp for sp, _ in log]
            check('どのステップも対象が見つかる', all(f is not False for _, f in log),
                  [x for x in log if x[1] is False])
            check('ロールの前衛向き・後衛向きを説明する',
                  '前衛向き' in joined and '後衛向き' in joined and 'タンク' in joined and 'シューター' in joined)
            check('後衛の近接は与ダメージ-30%だと伝える', '与ダメージ-30%' in joined)
            check('鶴翼の陣(前衛3)に導く', '[data-formation="f3"]' in spotted)
            check('わざと一枚盾の陣を踏ませる', '[data-formation="f1"]' in spotted)
            check('そのとき⚠が2体に出る', bool(seen_warn) and seen_warn['warn'] == ['ゴブリン', 'ホーンラビット'],
                  seen_warn and seen_warn['warn'])
            check('⚠の欄そのものを穴にする', '[data-row-warn]' in spotted)
            check('もとの陣形に戻させる', '鶴翼の陣' in joined and '戻し' in joined)
            check('出撃までたどり着く', bool(launched), log[-1] if log else None)
            check('出撃時は5体そろっている', bool(launched) and launched['party'] == 5, launched and launched['party'])
            check('出撃時は前衛3・後衛2', bool(launched) and launched['key'] == 'f3' and launched['front'] == 3,
                  launched and [launched['key'], launched['front']])
            check('出撃時に適正外が1つもない', bool(launched) and launched['warn'] == [], launched and launched['warn'])
            check('近接3体が前衛・遠隔2体が後衛',
                  bool(launched) and all((r[2] == 'front') == (r[1] in ('tank', 'attacker'))
                                         for r in launched['rows'] if r),
                  launched and launched['rows'])
            check('0-5はキャラ詳細を閉じさせてから終わる',
                  await pg.evaluate("""() => { const b = TUT_FLOW.tu5.battle;
                      const i = b.findIndex(s => s.spot === '.unit-modal');
                      const close = b[i + 1], bye = b[i + 2];
                      return i >= 0 && !!close && close.await === 'tap'
                        && /close-inspect/.test(close.spot || '')
                        && !!bye && !bye.spot && bye === b[b.length - 1]; }"""))
            check('奥義のあとの説明の裏で戦闘が動かない',
                  await pg.evaluate("""() => {
                      // SPが溜まった案内は、行動の決着の途中ではなく次の行動の手前で出す
                      const src = runNextAction.toString();
                      return /spGuidePending/.test(src) && /fxEvents\s*=\s*\[\]/.test(src)
                        && /startTutorialSpFull/.test(src); }"""))
            check('止めているあいだは直前の行動の見出しも消す',
                  await pg.evaluate("""() => /tutorialPause/.test(renderBattleFight.toString())"""))
            check('見直しのガイドにも向き不向きが載る',
                  await pg.evaluate("""() => GUIDE_CONTENT.tut_form.steps.some(s => /前衛向き/.test(s.body || ''))"""))

            # ---- 12. 入門の敵に回復役を入れない ----
            print('\n--- 12. 入門の敵 ---')
            healers = await pg.evaluate("""() => {
                const bad = /回復|復活|吸収/;
                const out = [];
                STAGES.filter(s => s.tier === 'tu').forEach(s => (s.pool || []).forEach(id => {
                  const k = MONSTER_KITS[id] || {};
                  const hit = ['normal', 'skill1', 'skill2', 'passive', 'ult']
                    .filter(w => k[w] && bad.test(k[w].desc || ''));
                  if(hit.length) out.push([s.id, MON_BY_ID[id].name, hit.join('/')]);
                })); 
                return out; }""")
            check('入門の敵に回復・復活・吸収を持つ子がいない', healers == [], healers)
            check('0-4と0-5からマイコニド・マンドラゴラが外れている',
                  await pg.evaluate("""() => ['tu4','tu5'].every(id =>
                      !(STAGE_BY_ID[id].pool || []).some(m => m === 'm03' || m === 'm10'))"""))

            # ---- 13. 案内の文が今のゲームと合っているか ----
            print('\n--- 13. 文と中身が合っているか ---')
            facts = await pg.evaluate("""() => {
                const all = Object.entries(GUIDE_CONTENT).concat(
                  Object.entries(TUT_FLOW).flatMap(([k, f]) =>
                    ['pre','battle','onSpFull','post'].filter(w => f[w]).map(w => [k+'.'+w, { steps: f[w] }])));
                // アイコンの <img> が文の途中に入るので、タグを落としてから見る
                const text = k => (GUIDE_CONTENT[k] ? GUIDE_CONTENT[k].steps : [])
                  .map(s => (s.title || '') + (s.body || '')).join(' ').replace(/<[^>]*>/g, '');
                const flow = k => (TUT_FLOW[k.split('.')[0]][k.split('.')[1]] || [])
                  .map(s => (s.title || '') + (s.body || '')).join(' ');
                const tu = STAGE_BY_ID[TUTORIAL_LAST_STAGE];
                return {
                  gacha: text('tut_gacha'),
                  done: text('tutorialDone'),
                  tu1post: flow('tu1.post'),
                  pull: PULL_COST, pull10: PULL10_COST, spark: SPARK_POINTS,
                  clearCrystal: tu.firstClear,
                  tu1reward: (STAGE_BY_ID.tu1.reward || []).map(r => r.type + ':' + (r.key || r.id || '')),
                  tu1gold: STAGE_BY_ID.tu1.gold, tu1pots: Object.keys(STAGE_BY_ID.tu1.pots || {}),
                  waveHeal: /HPが少し回復/.test(text('tut_wave')),
                  ultBtn: text('tut_ult').includes('奥義: 手動 / オート'),
                  empty: all.filter(([k, v]) => !v.steps || !v.steps.length).map(([k]) => k),
                }; }""")
            check('ガチャの値段が定数どおり', f"1回{facts['pull']}個" in facts['gacha']
                  and f"{facts['pull10']:,}個" in facts['gacha'], facts['gacha'][:60])
            check('10連の1回あたりも書いてある', f"{facts['pull10'] // 10}個でお得" in facts['gacha'])
            check('召喚ポイントの必要数が定数どおり', f"{facts['spark']}個貯まったら" in facts['gacha'])
            check('クリア報酬の石が実際の値と合う', f"{facts['clearCrystal']:,}個" in facts['done'],
                  facts['clearCrystal'])
            check('初心者ガチャの値段も定数どおり',
                  f"ふつうの10連と同じ{facts['pull10']:,}個" in facts['done'], facts['done'][:140])
            check('0-1の報酬の説明が実際と合う(ゴールドとEXPポットと石)',
                  'EXPポット' in facts['tu1post'] and 'ゴールド' in facts['tu1post']
                  and 'ソウル' not in facts['tu1post'] and 'ワザ' not in facts['tu1post'],
                  [facts['tu1gold'], facts['tu1pots'], facts['tu1reward']])
            check('奥義ボタンの文言が画面と合う', facts['ultBtn'])
            check('中身が空のガイドが無い', facts['empty'] == [], facts['empty'])

            # ---- 14. しめくくりでガチャを引かせる ----
            print('\n--- 14. ガチャへの引き継ぎ ---')
            done = await pg.evaluate("""() => GUIDE_CONTENT.tutorialDone.steps.map(s => [s.spot || null, s.await || null])""")
            wrap = await pg.evaluate("""() => GUIDE_CONTENT.tutorialWrapUp.steps.map(s => [s.spot || null, s.await || null])""")
            check('ガチャ画面へ連れて行く', ['.nav-btn[data-nav="gacha"]', 'tap'] in done, done)
            check('引かせるのは初心者ガチャ(ピックアップは引かせない)',
                  ['#beginner-gacha-btn', 'tap'] in done and ['#pull10', 'tap'] not in done, done)
            check('初心者ガチャの中身を伝える(同じ値段・3回・★5確定)',
                  await pg.evaluate("""() => { const t = GUIDE_CONTENT.tutorialDone.steps.map(s => s.body || '').join(' ');
                      return t.includes('初心者ガチャ') && t.includes(String(BEGINNER_GACHA_ROUNDS))
                        && t.includes('★5') && t.includes(BEGINNER_GACHA_COST.toLocaleString()); }"""))
            check('石が足りないときは飛ばす',
                  await pg.evaluate("""() => { const c = STATE.crystals; STATE.crystals = 0;
                      const n = GUIDE_CONTENT.tutorialDone.steps.filter(s => s.skipIf && s.skipIf()).length;
                      STATE.crystals = c; return n; }""") == 2)
            check('引き終わっていたら飛ばす',
                  await pg.evaluate("""() => { const d = STATE.beginnerGachaDone; STATE.beginnerGachaDone = true;
                      const n = GUIDE_CONTENT.tutorialDone.steps.filter(s => s.skipIf && s.skipIf()).length;
                      STATE.beginnerGachaDone = d; return n; }""") == 2)
            check('初心者ガチャも「ガチャを10連する」に数える',
                  await pg.evaluate("""() => { const m = BEGINNER_MISSIONS.find(x => x.id === 'b01');
                      const s0 = STATE.stats && STATE.stats.beginnerGacha;
                      track('beginnerGacha');
                      const ok = m.value() >= 1;
                      if(STATE.stats) STATE.stats.beginnerGacha = s0 || 0;
                      return ok; }"""))
            check('結果を閉じてから次へ進ませる(モーダルがナビを覆うので)',
                  ['#close-result', 'tap'] in wrap, wrap)
            check('最後ははじめてガイドに引き継ぐ',
                  ['.nav-btn[data-nav="home"]', 'tap'] in wrap and ['.beginner-card', None] in wrap, wrap)

            # ---- 15. はじめてガイドのショートカット ----
            print('\n--- 15. はじめてガイドのショートカット ---')
            info = await pg.evaluate("""() => {
                const withGo = BEGINNER_MISSIONS.filter(m => m.go);
                return { total: BEGINNER_MISSIONS.length, withGo: withGo.length,
                  noGo: BEGINNER_MISSIONS.filter(m => !m.go).map(m => m.id),
                  badGuide: withGo.filter(m => m.guide && !(GUIDE_CONTENT[m.guide] && GUIDE_REPLAY[m.guide])).map(m => m.id),
                  types: [...new Set(withGo.map(m => m.go.type))].sort(),
                  badStage: withGo.filter(m => m.go.type === 'stage' && !STAGE_BY_ID[m.go.id]).map(m => m.id),
                  badScreen: withGo.filter(m => m.go.type === 'screen' && !SCREEN_LABEL[m.go.screen]).map(m => m.id),
                  monsterNoGuide: withGo.filter(m => m.go.type === 'monster').every(m => !m.guide),
                }; }""")
            check('ログイン以外ぜんぶに行き先がある', info['withGo'] == info['total'] - 1 and info['noGo'] == ['b20'],
                  [info['withGo'], info['total'], info['noGo']])
            check('説明のキーがぜんぶ実在する', info['badGuide'] == [], info['badGuide'])
            check('ステージの行き先が実在する', info['badStage'] == [], info['badStage'])
            check('画面の行き先が実在する', info['badScreen'] == [], info['badScreen'])
            check('モンスター詳細は一覧の上で説明を出さない(詳細側が出すので)', info['monsterNoGuide'])

            feats = ['dungeon', 'pvp', 'friends', 'shop', 'base']
            check('機能ごとの説明を5つ足した',
                  await pg.evaluate("""(ks) => ks.every(k => GUIDE_CONTENT[k] && GUIDE_CONTENT[k].steps.length
                      && GUIDE_REPLAY[k])""", feats))
            # 各画面に「?」が出るか
            helps = {}
            for scr, key in [('gacha', 'tut_gacha'), ('party', 'tut_form'), ('pvp', 'pvp'),
                             ('shop', 'shop'), ('base', 'base')]:
                await pg.evaluate("""(s) => { STATE.clearedStages = ['tu1','tu2','tu3','tu4','tu5'];
                    guideOwner = null; clearGuideToast(true); closeModal(); goto(s, { nav: true }); }""", scr)
                await pg.wait_for_timeout(400)
                helps[scr] = await pg.locator(f'[data-guide-help="{key}"]').count() == 1
            await pg.evaluate("""() => { stageTab = 'dungeon'; dungeonTab = 'exp'; goto('battle', { nav: true }); }""")
            await pg.wait_for_timeout(400)
            helps['育成クエスト'] = await pg.locator('[data-guide-help="dungeon"]').count() == 1
            await pg.evaluate("""() => { goto('home', { nav: true }); openOverlay('friends'); }""")
            await pg.wait_for_timeout(500)
            helps['フレンド'] = await pg.locator('[data-guide-help="friends"]').count() == 1
            await pg.evaluate("() => closeOverlay()")
            check('各機能の画面に「?」が出る', all(helps.values()), helps)
            check('同じ説明は2回目から自動で出ない',
                  await pg.evaluate("""() => { STATE.guidesSeen = { shop: true };
                      guideOwner = null; clearGuideToast(true);
                      const again = openFeatureGuide('shop');
                      STATE.guidesSeen = {};
                      const first = openFeatureGuide('shop');
                      clearGuideToast(true);
                      return again === false && first === true; }"""))

            # ---- 16. 下書きの目印がプレイヤーに出ていないか ----
            # 指示を書くときの変数(+NNN)や、書き損じたテンプレート(${...})がそのまま
            # 画面に出ていたことがあるので、文言の定数をまとめて見張る
            print('\n--- 16. 下書きの目印が残っていない ---')
            leaks = await pg.evaluate("""() => {
                const bad = [];
                const look = (where, v) => {
                  if(typeof v === 'string'){
                    // アイコンは <img src="data:..."> なので中身は見ない
                    const t = v.replace(/<img[^>]*>/g, '');
                    if(/\\$\\{|NNN|XXX|\\bTODO\\b|undefined|\\[object /.test(t)) bad.push([where, t.slice(0, 80)]);
                  } else if(Array.isArray(v)) v.forEach((x, i) => look(where + '[' + i + ']', x));
                  else if(v && typeof v === 'object') for(const k of Object.keys(v)) look(where + '.' + k, v[k]);
                };
                for(const k of Object.keys(GUIDE_CONTENT)) look('GUIDE_CONTENT.' + k, GUIDE_CONTENT[k]);
                for(const k of Object.keys(TUT_FLOW)) look('TUT_FLOW.' + k, TUT_FLOW[k]);
                return bad; }""")
            check('説明の文に下書きの目印(${...}や+NNN)が残っていない', leaks == [], leaks[:3])

            check('JSエラーなし', not errs, errs[:3])
            await b.close()
    print('NG' if bad else 'すべて通過')
    return bad

sys.exit(asyncio.run(main()))
