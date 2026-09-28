#!/usr/bin/env python3
"""複数編成: 編成画面の「編成1〜5」タブ、出撃前の画面で使う編成を選べる、遺物は編成ごと。
使い方: CHROMIUM_PATH=/path/to/chrome python3 tools/formation_sets_ui_test.py"""
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
            await pg.evaluate("""() => { clearGuideToast(); STATE.announceQueue = []; STATE.guidesSeen = Object.assign(STATE.guidesSeen || {}, {abyss: true});
              STATE.clearedStages = STAGES.filter(s => ['tu','q1'].includes(s.tier)).map(s => s.id);
              const r = Object.keys(RELICS)[0]; STATE.relics[r] = newRelicState(); STATE.relics[r].equippedTo = 'm06'; saveState(); }""")
            slots = lambda: pg.evaluate("() => STATE.slots.filter(Boolean)")
            await pg.evaluate("() => document.querySelector('.nav-btn[data-nav=\"party\"]').click()"); await pg.wait_for_timeout(250)
            tabs = await pg.evaluate("() => [...document.querySelectorAll('#screen .fset-tab')].map(b => b.firstChild.textContent)")
            check('編成画面の上に 編成1〜5 のタブ', tabs == ['編成1', '編成2', '編成3', '編成4', '編成5'], tabs)
            first = await slots()
            hdr = await pg.evaluate("() => { const e = document.querySelector('#screen .party-count'); return [e.firstElementChild.className, e.textContent]; }")
            check('総合BPが人数(n / 5体)の左に大きく出る', hdr[0] == 'bp' and hdr[1].index('総合BP') < hdr[1].index('/ 5体'), hdr)
            check('「陣形を選び…」の説明は出ない', '陣形を選び' not in await pg.inner_text('#screen'))
            # お助けキャラはキャラリストの一番上、絞り込みに連動
            await pg.evaluate("() => { STATE.borrowed = { uid: 'x', name: 'フレンド', mon: { id: 'm05', star: 3, level: 20, skillLv: 1, skill2Lv: 1, ultLv: 1, passiveLv: 1 } }; syncHelperMon(); render(); }"); await pg.wait_for_timeout(200)
            order = await pg.evaluate("() => { const rows = [...document.querySelectorAll('#screen .roster-row')]; return rows.map(r => r.classList.contains('helper-row')); }")
            check('お助けキャラはキャラリストの一番上', order[:1] == [True] and order.count(True) == 1, order[:3])
            await pg.screenshot(path=str(OUT / 'fset_party_helper.png'), full_page=True)
            await pg.evaluate("() => { rosterFilter.elem = ['water']; render(); }"); await pg.wait_for_timeout(150)
            check('絞り込みに合わないと隠れる(シルバーナイトは無属性)', await pg.locator('#screen .helper-row').count() == 0)
            await pg.evaluate("() => { rosterFilter.elem = ['none']; render(); }"); await pg.wait_for_timeout(150)
            check('合う絞り込みなら出る', await pg.locator('#screen .helper-row').count() == 1)
            await pg.evaluate("() => { rosterFilter.elem = []; STATE.borrowed = null; syncHelperMon(); render(); }"); await pg.wait_for_timeout(150)
            check('借りていない時は「借りる」の行', await pg.locator('#screen .helper-row [data-overlay=\"friends\"]').count() == 1)
            await pg.screenshot(path=str(OUT / 'fset_party.png'))
            await pg.evaluate("() => document.querySelector('#screen [data-fset=\"1\"]').click()"); await pg.wait_for_timeout(250)
            check('編成2を押すと空の編成に切り替わる', await pg.evaluate("() => STATE.formationIdx") == 1 and await slots() == [])
            # 所持キャラを2体置く
            await pg.evaluate("() => { STATE.slots = ['m21', null, null, null, null]; saveState(); render(); }"); await pg.wait_for_timeout(200)
            await pg.evaluate("() => document.querySelector('#screen [data-fset=\"0\"]').click()"); await pg.wait_for_timeout(250)
            check('編成1に戻すと元のパーティ', await slots() == first, await slots())
            check('編成1の遺物はそのまま', await pg.evaluate("() => equippedRelicOf('m06')") == await pg.evaluate("() => Object.keys(RELICS)[0]"))
            check('ホームのパーティ欄に「編成1」', '編成1' in await pg.evaluate("() => { goto('home', {nav:true}); return document.querySelector('.home-fm').textContent; }"))
            # 出撃前(ステージ詳細)で編成を選ぶ
            await pg.evaluate("() => { goto('battle', {nav:true}); stageTab = 'main'; questTier = 'q1'; render(); stageSheet = STAGES.find(s => s.tier === 'q1').id; renderStageSheet(); }"); await pg.wait_for_timeout(300)
            n = await pg.locator('#modal-layer .stage-sheet .fset-tab').count()
            check('ステージ詳細に「使う編成」のタブ', n == 5)
            await pg.evaluate("() => document.querySelector('#modal-layer [data-fset=\"1\"]').click()"); await pg.wait_for_timeout(250)
            on = await pg.evaluate("() => document.querySelector('#modal-layer .fset-tab.on').firstChild.textContent")
            imgs = await pg.locator('#modal-layer .fset-members img').count()
            check('ステージ詳細で編成2に切り替え(詳細は開いたまま)', await pg.evaluate("() => STATE.formationIdx") == 1 and on == '編成2' and imgs == 1 and await pg.locator('#modal-layer .stage-sheet').count() == 1, [on, imgs])
            await pg.screenshot(path=str(OUT / 'fset_sheet.png'))
            await pg.evaluate("() => document.querySelector('#modal-layer [data-fset-edit]').click()"); await pg.wait_for_timeout(250)
            check('「編成する」で編成画面へ(戻るボタンつき)', await pg.evaluate("() => currentScreen") == 'party' and await pg.locator('[data-screen-back]').count() == 1)
            # 育成クエスト・深淵回廊にも出る
            await pg.evaluate("() => { goto('battle', {nav:true}); stageTab = 'dungeon'; render(); }"); await pg.wait_for_timeout(250)
            check('育成クエストにも「使う編成」', await pg.locator('#screen .fset-box').count() == 1)
            # 遺物を選ぶ画面の説明
            await pg.evaluate("() => { relicPicker = { monId: 'm06' }; renderRelicPicker(); }"); await pg.wait_for_timeout(200)
            check('遺物を選ぶ画面に「編成ごと」の説明', '編成2' in await pg.locator('#modal-layer .relic-picker-modal .fs-note').first.inner_text())
            await pg.evaluate("() => { relicPicker = null; closeModal(); }")
            # PVP編成の編集: 遺物の参照先を選べる
            await pg.evaluate("() => { authBackend().fetchPvpOpponents = async () => []; goto('pvp', {nav:true}); openPvpFormEdit('attack'); }"); await pg.wait_for_timeout(250)
            await pg.evaluate("() => document.querySelector('[data-pvp-relic-src=\"2\"]').click()"); await pg.wait_for_timeout(200)
            check('PVP攻撃編成は遺物の参照先の編成を選べる', await pg.evaluate("() => STATE.pvpAttackRelicsFrom") == 2)
            await pg.screenshot(path=str(OUT / 'fset_pvp.png'))
            await pg.evaluate("() => document.querySelector('[data-pvp-form-cancel]').click()"); await pg.wait_for_timeout(200)
            check('キャンセルすると参照先も元に戻る', await pg.evaluate("() => STATE.pvpAttackRelicsFrom") == 0)
            check('JSエラーなし', not errs, errs[:3])
            await b.close()
    print('NG' if bad else 'すべて通過')
    return bad
sys.exit(asyncio.run(main()))
