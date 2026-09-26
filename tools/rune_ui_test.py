#!/usr/bin/env python3
"""ルーン: キャラ → ルーン の一覧、ルーン詳細(強化・ロック・分解)、キャラ詳細の4枠から装備、育成クエストのルーン採掘。
使い方: CHROMIUM_PATH=/path/to/chrome python3 tools/rune_ui_test.py"""
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
            await pg.evaluate("""() => { clearGuideToast(); STATE.announceQueue = []; STATE.gold = 1e7; STATE.runeDust = 5000;
              STATE.clearedStages = STAGES.filter(s => ['tu','q1'].includes(s.tier)).map(s => s.id);
              const mains = Object.keys(RUNE_STATS);
              for(let i = 0; i < 21; i++) addRune(makeRune(1 + (i % 6), i % 5, mains[i % mains.length]));
              saveState(); }""")
            await pg.evaluate("() => document.querySelector('.nav-btn[data-nav=\"party\"]').click()"); await pg.wait_for_timeout(200)
            tabs = await pg.evaluate("() => [...document.querySelectorAll('.group-tab')].map(b => b.textContent)")
            check('キャラのタブに「ルーン」', tabs == ['編成', 'キャラ一覧', '遺物', 'ルーン'], tabs)
            await pg.evaluate("() => document.querySelector('[data-group-tab=\"runes\"]').click()"); await pg.wait_for_timeout(250)
            n = await pg.locator('#screen .rune-cell').count()
            check('ルーン一覧に全部並ぶ', await pg.evaluate("() => currentScreen") == 'runes' and n == 21, n)
            await pg.screenshot(path=str(OUT / 'rune_list.png'))
            await pg.evaluate("() => document.querySelector('[data-rune-filter=\"atk\"]').click()"); await pg.wait_for_timeout(150)
            check('効果で絞り込める(STRだけ)', await pg.locator('#screen .rune-cell').count() == 3)
            await pg.evaluate("() => document.querySelector('[data-rune-filter=\"all\"]').click()"); await pg.wait_for_timeout(150)
            # 詳細 → 合成(同じ効果・同じTierの3つでTier+1)
            uid = await pg.evaluate("() => { const b = addRune(makeRune(3, 4, 'mdef')); addRune(makeRune(3, 3, 'pdef')); addRune(makeRune(3, 0, 'hp')); addRune(makeRune(3, 4, 'atk')); saveState(); render(); openRuneDetail(b.uid); return b.uid; }"); await pg.wait_for_timeout(200)
            check('ルーン詳細に強化レベル(+N)はない', await pg.locator('#modal-layer .rune-detail-modal').count() == 1 and '+0' not in await pg.inner_text('#modal-layer .rd-head') and await pg.locator('[data-rune-enhance]').count() == 0)
            expect = await pg.evaluate(f"() => STATE.runes.filter(r => r.uid !== '{uid}' && r.tier === 3 && ['hp','pdef','mdef'].includes(r.main)).length")
            n = await pg.locator('#modal-layer .rf-cand').count()
            check('材料の候補は同じTier・同じタイプ(防御型)だけ(攻撃型は出ない)', n == expect and n >= 2, [n, expect])
            await pg.evaluate("() => document.querySelector('[data-rune-fuse-auto]') ? document.querySelector('[data-rune-fuse-auto]').click() : document.querySelectorAll('#modal-layer .rf-cand').forEach(b => b.click())"); await pg.wait_for_timeout(150)
            mats = await pg.evaluate("() => runeDetail.fuse.slice()")
            check('結果の見込み(TierⅣ、値の伸び)と合成ボタン', len(mats) == 2 and 'TierⅣ' in await pg.inner_text('#modal-layer .rf-result') and not await pg.evaluate("() => document.querySelector('[data-rune-fuse-go]').disabled"), await pg.inner_text('#modal-layer .rf-result'))
            await pg.screenshot(path=str(OUT / 'rune_fuse.png'))
            await pg.evaluate("() => document.querySelector('[data-rune-fuse-go]').click()"); await pg.wait_for_timeout(200)
            check('合成するとTierⅣ・虹のまま、材料が消える', await pg.evaluate(f"() => runeByUid('{uid}').tier") == 4 and await pg.evaluate(f"() => runeByUid('{uid}').rarity") == 4 and await pg.evaluate(f"() => {mats}.every(u => !runeByUid(u))") and await pg.locator('.rd-flash').count() == 1)
            await pg.screenshot(path=str(OUT / 'rune_detail.png'))
            await pg.evaluate("() => document.querySelector('[data-rune-lock]').click()"); await pg.wait_for_timeout(120)
            check('ロックすると分解ボタンが押せない', await pg.evaluate("() => document.querySelector('[data-rune-dismantle]').disabled"))
            await pg.evaluate("() => document.querySelector('[data-close-rune-detail]').click()"); await pg.wait_for_timeout(150)
            # キャラ詳細の4枠 → 装備
            await pg.evaluate("() => { showMonsterDetail('m06'); }"); await pg.wait_for_timeout(250)
            check('キャラ詳細にルーン4枠', await pg.locator('#modal-layer .rune-slot').count() == 4)
            await pg.evaluate("() => document.querySelector('[data-rune-slot=\"m06:0\"]').click()"); await pg.wait_for_timeout(200)
            check('枠を押すとルーンを選ぶ画面', await pg.locator('#modal-layer .rune-picker-modal .rp-row').count() == await pg.evaluate('() => STATE.runes.length'))
            await pg.screenshot(path=str(OUT / 'rune_picker.png'))
            await pg.evaluate("() => document.querySelector('#modal-layer .rp-row').click()"); await pg.wait_for_timeout(250)
            eq = await pg.evaluate("() => runesOf('m06')[0]")
            check('選ぶと装備してキャラ詳細に戻る', eq is not None and await pg.locator('#modal-layer .detail-modal .rune-slot.filled').count() == 1)
            await pg.evaluate("() => document.querySelector('#modal-layer .rune-box').scrollIntoView()"); await pg.wait_for_timeout(150)
            await pg.screenshot(path=str(OUT / 'rune_slots.png'))
            # 同じ編成の別キャラに付けると付け替わる
            await pg.evaluate(f"() => {{ openRunePicker('m21', 0); }}"); await pg.wait_for_timeout(150)
            await pg.evaluate(f"() => document.querySelector('[data-rune-pick=\"{eq}\"]').click()"); await pg.wait_for_timeout(200)
            check('同じ編成の別キャラに付けると元のキャラから外れる', await pg.evaluate("() => runesOf('m06')[0]") is None and await pg.evaluate("() => runesOf('m21')[0]") == eq)
            await pg.evaluate("() => { closeModal(); }")
            # まとめて分解(白・青、装備中とロックは残る)
            await pg.evaluate("() => { goto('runes', {nav:true}); }"); await pg.wait_for_timeout(150)
            await pg.evaluate("() => document.querySelector('[data-rune-bulk]').click()"); await pg.wait_for_timeout(150)
            before = await pg.evaluate("() => STATE.runes.length")
            await pg.evaluate("() => document.querySelector('[data-rune-bulk-go]').click()"); await pg.wait_for_timeout(150)
            left = await pg.evaluate(f"() => STATE.runes.filter(r => r.rarity <= 1).map(r => r.uid)")
            check('まとめて分解: 白・青が消え、装備中・ロック中は残る', await pg.evaluate("() => STATE.runes.length") < before and all(u in (eq, uid) for u in left), left)
            # 育成クエスト: 素材ダンジョンの代わりにルーン採掘
            await pg.evaluate("() => { goto('battle', {nav:true}); stageTab = 'dungeon'; render(); }"); await pg.wait_for_timeout(200)
            dtabs = await pg.evaluate("() => [...document.querySelectorAll('[data-dungeon-tab]')].map(b => b.dataset.dungeonTab)")
            check('育成クエストは EXP・ゴールド・ルーン採掘', dtabs == ['exp', 'gold', 'rune'], dtabs)
            await pg.evaluate("() => document.querySelector('[data-dungeon-tab=\"rune\"]').click()"); await pg.wait_for_timeout(200)
            check('ルーン採掘は7段階', await pg.locator('#screen .stage-card.dungeon').count() == 7)
            await pg.screenshot(path=str(OUT / 'rune_mine.png'))
            await pg.evaluate("() => { while(STATE.runes.length < RUNE_MAX) STATE.runes.push(makeRune(1, 0)); render(); document.querySelector('[data-stage=\"dg_rune_0\"]').click(); }"); await pg.wait_for_timeout(250)
            check('所持がいっぱいだと採掘に出られない', await pg.evaluate("() => currentScreen") == 'battle')
            check('JSエラーなし', not errs, errs[:3])
            await b.close()
    print('NG' if bad else 'すべて通過')
    return bad
sys.exit(asyncio.run(main()))
