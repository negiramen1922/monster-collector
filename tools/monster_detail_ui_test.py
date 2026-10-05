#!/usr/bin/env python3
"""キャラ詳細画面の回帰テスト。

縦に長くなりすぎたのを、育成/装備のタブ・ワザの折りたたみ・星刻の別モーダルに
分けた。スクロールせずに読めること、ステータスの増加分が数字の下に出ること、
星刻が★の横の＋から開けることを確かめる。

使い方: CHROMIUM_PATH=/path/to/chrome python3 tools/monster_detail_ui_test.py
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

            await pg.evaluate("""() => {
                STATE.gold = 9999999; STATE.universalSouls = 500;
                STATE.guidesSeen = { welcome: true, monsterDetail: true };
                STATE.announceQueue = [];
                STATE.owned.m06.level = 30; STATE.owned.m06.star = 3; STATE.owned.m06.souls = 999;
                STATE.owned.m06.skillLv = 3; addItem('exp2', 50);
                const rid = Object.keys(RELICS)[0];
                STATE.relics[rid] = { level: 5, skillLv: 2, equippedTo: 'm06' };
                clearGuideToast(true); closeModal(); goto('party', { nav: true });
                showMonsterDetail('m06'); }""")
            await pg.wait_for_timeout(500)
            size = lambda: pg.evaluate("""() => { const e = document.querySelector('.detail-modal');
                return e ? [Math.round(e.scrollHeight), Math.round(e.clientHeight)] : null; }""")

            # ---- 1. 縦の長さ ----
            print('\n--- 1. 縦に長すぎない ---')
            grow = await size()
            check('育成タブはスクロールせずに収まる', grow[0] <= grow[1] + 1, grow)
            check('星刻と遺物とルーンは育成タブには無い',
                  await pg.locator('.promo-box').count() == 0
                  and await pg.locator('.relic-box').count() == 0
                  and await pg.locator('.rune-box').count() == 0)
            await pg.screenshot(path=str(OUT / 'detail_grow.png'))

            # ---- 2. ワザの折りたたみ ----
            print('\n--- 2. ワザの折りたたみ ---')
            check('ワザは閉じた状態で始まる', await pg.locator('.detail-skill-box .skill-card').count() == 0)
            await pg.locator('[data-skill-toggle]').click(); await pg.wait_for_timeout(300)
            open_n = await pg.locator('.detail-skill-box .skill-card').count()
            check('押すとワザが開く', open_n >= 4, open_n)
            check('開くと画面より長くなる(だから既定は閉じている)', (await size())[0] > (await size())[1])
            await pg.locator('[data-skill-toggle]').click(); await pg.wait_for_timeout(300)
            check('もう一度押すと閉じる', await pg.locator('.detail-skill-box .skill-card').count() == 0)

            # ---- 3. ステータスの出しかた ----
            print('\n--- 3. ステータス ---')
            check('「ダメージをN%カット」「遺物・ルーン +N」の文章は出さない',
                  await pg.locator('.stat-plus').count() == 0)
            eq = await pg.evaluate("() => [...document.querySelectorAll('.stat-eq')].map(e => e.textContent)")
            check('遺物とルーンで増えたぶんを数字の下に +NNN で出す',
                  len(eq) >= 1 and all(t.startswith('+') for t in eq), eq)
            check('増えていないステータスには出さない',
                  await pg.evaluate("""() => {
                      const rows = [...document.querySelectorAll('.stat-row')];
                      return rows.some(r => !r.querySelector('.stat-eq')); }"""))
            check('防御は%のまま', '%' in await pg.evaluate("""() => {
                const r = [...document.querySelectorAll('.stat-row')].find(x => x.textContent.includes('物理防御'));
                return r.querySelector('b').textContent; }"""))

            # ---- 4. 装備タブ ----
            print('\n--- 4. 装備タブ ---')
            await pg.locator('[data-detail-tab="equip"]').click(); await pg.wait_for_timeout(400)
            check('遺物とルーンが装備タブにまとまっている',
                  await pg.locator('.relic-box').count() == 1 and await pg.locator('.rune-box').count() == 1)
            check('装備タブにレベルやステータスは出ない',
                  await pg.locator('.lv-card').count() == 0 and await pg.locator('.detail-stats').count() == 0)
            eqsz = await size()
            check('装備タブもスクロールせずに収まる', eqsz[0] <= eqsz[1] + 1, eqsz)
            await pg.screenshot(path=str(OUT / 'detail_equip.png'))
            await pg.locator('[data-detail-tab="grow"]').click(); await pg.wait_for_timeout(300)
            check('育成に戻れる', await pg.locator('.lv-card').count() == 1)

            # ---- 5. ★の＋から星刻 ----
            print('\n--- 5. 星刻 ---')
            check('★の右に＋がある', await pg.locator('.detail-head .star-plus').count() == 1)
            check('★5個ぶんの間が空いている', await pg.evaluate("""() => {
                const g = document.querySelector('.star-gap');
                return !!g && g.getBoundingClientRect().width > 60; }"""))
            check('ソウルが足りていると＋が光る', await pg.locator('.star-plus.ready').count() == 1)
            await pg.locator('.star-plus').click(); await pg.wait_for_timeout(500)
            check('星刻のモーダルが開く', await pg.locator('.promote-modal').count() == 1)
            check('中に星刻ボタンと無形のソウルの変換がある',
                  await pg.locator('.promote-modal [data-promote]').count() == 1
                  and await pg.locator('.promote-modal [data-convert]').count() == 2)
            await pg.screenshot(path=str(OUT / 'detail_promote.png'))
            before = await pg.evaluate("() => STATE.owned.m06.star")
            await pg.locator('.promote-modal [data-promote]').click(); await pg.wait_for_timeout(600)
            after = await pg.evaluate("() => STATE.owned.m06.star")
            check('星刻すると★が上がる', after == before + 1, [before, after])
            check('星刻したあともモーダルのまま', await pg.locator('.promote-modal').count() == 1)
            await pg.locator('.promote-modal [data-close-promote]').first.click(); await pg.wait_for_timeout(500)
            check('閉じるとキャラ詳細に戻る',
                  await pg.locator('.detail-modal').count() == 1 and await pg.locator('.promote-modal').count() == 0)
            check('★の表示も増えている',
                  await pg.locator('.detail-head .stars i').count() == min(after, 5),
                  [await pg.locator('.detail-head .stars i').count(), after])
            check('★は大きく出す', await pg.evaluate("""() => {
                const e = document.querySelector('.detail-head .stars');
                return parseFloat(getComputedStyle(e).fontSize) >= 18; }"""))

            # ---- 6. ハノコの説明 ----
            print('\n--- 6. 説明の指す先 ---')
            missing = await pg.evaluate("""() => GUIDE_CONTENT.monsterDetail.steps
                .map(s => s.highlight).filter(h => h && !document.querySelector(h))""")
            check('ハノコの説明が指す場所がぜんぶある', missing == [], missing)

            check('JSエラーなし', not errs, errs[:3])
            await b.close()
    print('NG' if bad else 'すべて通過')
    return bad

sys.exit(asyncio.run(main()))
