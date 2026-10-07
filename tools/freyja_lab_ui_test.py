#!/usr/bin/env python3
"""イベント試験場(index.html?lab=freyja): 本番のセーブに触れず、フレイヤイベの新キャラ8体を好きな育ちで組んで
黄金のフォールクヴァングのクエスト1〜10層・EX1〜EX3・HELLと日付に関係なく戦える(観戦・連続テスト)。
使い方: CHROMIUM_PATH=/path/to/chrome python3 tools/momotaro_lab_ui_test.py"""
import asyncio, os, pathlib
from playwright.async_api import async_playwright
from _serve import game_url

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
            pg = await b.new_page(viewport={'width': 390, 'height': 844})
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            # 試験場の時計は公開前(10/8)にしておく。新キャラはそれでも使える
            await pg.add_init_script("(() => { const t = new Date('2026-10-08T12:00:00+09:00').getTime(); const D = Date; Date.now = () => t; })()")
            await pg.goto(url + '?lab=freyja'); await pg.wait_for_timeout(1500)
            r = await pg.evaluate("""() => ({ screen: currentScreen, lab: !!document.querySelector('.lab'), acct: ACCOUNT, saved: localStorage.getItem('monster-game-state'),
              stages: document.querySelectorAll('.lab-fl').length, slots: document.querySelectorAll('.lab-slot img').length,
              enemies: document.querySelectorAll('.lab-en').length, nav: getComputedStyle(document.getElementById('nav')).display,
              party: evLab.party.filter(Boolean).map(s => s.id), released: releasedMonsters().some(m => m.id === 'm177'), live: isEventLive(EVENTS.find(e => e.key === 'ev_freyja')) })""")
            check('ログインなしで試験場が開き、クエスト10層＋EX3段＋HELLの14面が選べる', r['lab'] and r['screen'] == 'lab' and r['acct'] is None and r['stages'] == 14, r)
            check('最初からフレイヤとフレイ・ヒルディスヴィーニの3体が入っている', r['party'] == ['m177', 'm178', 'm179'] and r['slots'] == 3, r)
            check('開始日時の前(10/8)でも新キャラが使える(イベントは本番ではまだ始まっていない)', r['released'] and not r['live'], r)
            check('下のメニューは出さない', r['nav'] == 'none', r)
            await pg.screenshot(path=str(OUT / 'freyja_lab_top.png'), full_page=True)
            await pg.click('[data-lab="sim:20"]')
            await pg.wait_for_function("() => evLab.sim && evLab.sim.done === 20 && !labSimming", timeout=120000)
            r = await pg.evaluate("() => ({ err: evLab.sim.rows.map(x => x.parts[0]).filter(p => p.error).map(p => p.error), rate: (document.querySelector('.lab-rate b') || {}).textContent, saved: localStorage.getItem('monster-game-state') })")
            check('クエスト1層: 20回まわすと勝率が出る(エラーなし)', not r['err'] and r['rate'], r)
            check('本番のセーブには何も書かない', r['saved'] is None, r)
            # 育ちをそろえる・編集
            await pg.click('[data-lab="pick:4"]'); await pg.wait_for_timeout(200)
            await pg.click('[data-lab="set:m180"]'); await pg.wait_for_timeout(150)
            for k in ['star', 'lv', 'sk', 'pv']:
                await pg.click(f'[data-lab="adj:{k}:1"]')
            await pg.wait_for_timeout(150)
            r = await pg.evaluate("() => evLab.party[4]")
            check('エインヘリャル(★2)を入れて、★・Lv・スキルLv・パッシブLvを変えられる', r['id'] == 'm180' and r['star'] == 3 and r['lv'] == 110 and r['sk'] == 2 and r['pv'] == 2, r)
            await pg.click('[data-lab="grow:hell"]'); await pg.wait_for_timeout(200)
            r = await pg.evaluate("() => evLab.party.filter(Boolean).map(s => [s.star, s.lv, s.sk, s.pv, !!s.relic])")
            check('HELL想定: 全員 ★10・Lv300・スキルLv10・パッシブLv5・遺物つき', all(x == [10, 300, 10, 5, True] for x in r), r)
            await pg.click('[data-lab="stage:ev_freyja_ex4"]'); await pg.wait_for_timeout(200)
            r = await pg.evaluate("() => ({ title: document.querySelector('.lab-title').textContent, rules: [...document.querySelectorAll('.lab-rules div')].map(d => d.textContent) })")
            check('HELLを選ぶと、黄金のフォールクヴァング・HELLのステージ効果(敵のフレイヤ・フレイ+50%を含む9本)が出る', 'HELL' in r['title'] and any('フレイヤ' in x for x in r['rules']) and len(r['rules']) == 9, r)
            await pg.click('[data-lab="sim:20"]')
            await pg.wait_for_function("() => evLab.sim && evLab.sim.key === 'ev_freyja_ex4' && evLab.sim.done === 20 && !labSimming", timeout=180000)
            r = await pg.evaluate("() => ({ err: evLab.sim.rows.map(x => x.parts[0]).filter(p => p.error).map(p => p.error), wins: evLab.sim.rows.filter(x => x.win).length })")
            check('HELL: 20回まわしてもエラーが出ない', not r['err'], r)
            await pg.screenshot(path=str(OUT / 'freyja_lab_hell.png'), full_page=True)
            # 観戦
            await pg.click('[data-lab="watch"]'); await pg.wait_for_timeout(2500)
            r = await pg.evaluate("() => ({ screen: currentScreen, lab: !!(battleUI && battleUI.lab), stage: battleUI && battleUI.stage.id })")
            check('観戦: 戦闘画面に入る', r['screen'] == 'battle-fight' and r['lab'] and r['stage'] == 'ev_freyja_ex4', r)
            await pg.screenshot(path=str(OUT / 'freyja_lab_battle.png'))
            await pg.evaluate("() => { STATE.battleSpeed = 4; }")
            await pg.wait_for_function("() => battleUI && battleUI.finished", timeout=240000)
            await pg.wait_for_timeout(2500)
            r = await pg.evaluate("() => ({ modal: !!document.querySelector('.lab-result') })")
            check('観戦が終わると結果が出る', r['modal'], r)
            await pg.click('[data-lab="back"]'); await pg.wait_for_timeout(300)
            r = await pg.evaluate("() => ({ screen: currentScreen, saved: localStorage.getItem('monster-game-state') })")
            check('試験場に戻れる・本番のセーブは空のまま', r['screen'] == 'lab' and r['saved'] is None, r)
            check('ページのエラーなし', not errs, errs[:3])
            # ?lab= なしで開くと、新キャラもイベントも出ない
            pg2 = await b.new_page(viewport={'width': 390, 'height': 844})
            await pg2.add_init_script("(() => { const t = new Date('2026-10-08T12:00:00+09:00').getTime(); Date.now = () => t; })()")
            await pg2.goto(url); await pg2.wait_for_timeout(1500)
            r = await pg2.evaluate("() => ({ rel: releasedMonsters().some(m => m.id === 'm177'), ev: activeEvents().map(e => e.key) })")
            check('?lab= なしでは、公開前の新キャラ・イベントは出ない', not r['rel'] and 'ev_freyja' not in r['ev'], r)
            await b.close()
    print('すべて通過' if not bad else f'{bad}件 失敗')
    raise SystemExit(1 if bad else 0)

asyncio.run(main())
