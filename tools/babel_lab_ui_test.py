#!/usr/bin/env python3
"""バベル試験場(index.html?lab=babel): 本番のセーブに触れず、全モンスターを好きな育ちで組んで
バベルの各階と戦える(観戦・連続テスト)。
使い方: CHROMIUM_PATH=/path/to/chrome python3 tools/babel_lab_ui_test.py"""
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
            await pg.goto(url + '?lab=babel'); await pg.wait_for_timeout(1200)
            r = await pg.evaluate("""() => ({ screen: currentScreen, lab: !!document.querySelector('.lab'), acct: ACCOUNT, saved: localStorage.getItem('monster-game-state'),
              owned: Object.keys(STATE.owned).length, all: MONSTERS.length, slots: document.querySelectorAll('.lab-slot img').length,
              enemies: document.querySelectorAll('.lab-bw .lab-u').length, hints: document.querySelectorAll('.lab-hint-box .lab-u').length,
              nav: getComputedStyle(document.getElementById('nav')).display })""")
            check('ログインなしで試験場が開き、全モンスターが使える', r['lab'] and r['screen'] == 'lab' and r['acct'] is None and r['owned'] == r['all'], r)
            check('1階の敵(5体×3WAVE)と、勝てる想定の編成が最初から入っている', r['enemies'] == 15 and r['slots'] == 5, r)
            check('勝てる想定・勝てない想定の編成が5体ずつ並ぶ', r['hints'] == 10, r)
            check('下のメニューは出さない', r['nav'] == 'none', r)
            # 均衡の塔は60階。10階ずつ区切って、ボスの階に印
            r = await pg.evaluate("""() => ({ floors: document.querySelectorAll('[data-lab^="floor:"]').length,
              groups: [...document.querySelectorAll('.bb-fl-label')].map(e => e.textContent),
              boss: [...document.querySelectorAll('.lab-fl.boss')].map(e => parseInt(e.textContent)) })""")
            check('階の一覧は1〜60階(10階ずつの区切り)', r['floors'] == 60 and r['groups'] == ['1〜10階', '11〜20階', '21〜30階', '31〜40階', '41〜50階', '51〜60階'], r)
            check('ボスの階(5の倍数)に印', r['boss'] == [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60], r['boss'])
            # 配置: 各WAVEの敵が前衛/後衛に分かれ、Lv・★・スキルLv・パッシブLvが出る
            await pg.click('[data-lab="floor:55"]'); await pg.wait_for_timeout(250)
            r = await pg.evaluate("""() => {
              const waves = [...document.querySelectorAll('.lab-bw')].map(w => [...w.querySelectorAll('.lab-row')].map(row => ({
                label: row.querySelector('.lab-rl').textContent, n: row.querySelectorAll('.lab-u').length })));
              const st = babelStage('bal', 55);
              const boss = document.querySelector('.lab-bw .lab-u.boss');
              return { waves, total: st.waves.map(w => w.length), title: document.querySelector('.lab-title').textContent,
                bossTxt: boss && boss.innerText, bossTag: !!(boss && boss.querySelector('.lab-boss-tag')),
                cardTxt: document.querySelector('.lab-bw .lab-u').innerText,
                sw: document.documentElement.scrollWidth };
            }""")
            ok_rows = all([x['label'][:2] for x in w] == ['後衛', '前衛'] for w in r['waves']) and [sum(x['n'] for x in w) for w in r['waves']] == r['total']
            check('55階: 敵がWAVEごとに後衛/前衛に分かれて全員出る', ok_rows and '死神' in r['title'], r)
            check('ボスに印があり、★・Lv・スキルLv・パッシブLvが出る',
                  r['bossTag'] and '死神' in r['bossTxt'] and '★10' in r['bossTxt'] and 'Lv200' in r['bossTxt'] and 'スキルLv10' in r['bossTxt'] and 'パッシブLv5' in r['bossTxt'], r)
            check('スマホ幅390pxで横にはみ出さない', r['sw'] <= 390, r['sw'])
            await pg.screenshot(path=str(OUT / 'lab_floor55.png'), full_page=True)
            # タップでワザと星刻
            await pg.click('.lab-bw .lab-u.boss'); await pg.wait_for_timeout(250)
            r = await pg.evaluate("""() => { const md = document.querySelector('.lab-unit-modal');
              return md && { name: md.querySelector('.detail-name').textContent, cards: [...md.querySelectorAll('.skill-card .slot-tag')].map(e => e.textContent),
                perkOn: md.querySelectorAll('.perk-row.on').length, perkAll: md.querySelectorAll('.perk-row').length,
                lv: md.querySelector('.detail-family').textContent, stats: md.querySelectorAll('.stat-row').length,
                sw: document.documentElement.scrollWidth }; }""")
            check('敵をタップすると、そのキャラのワザ(通常・スキル1・スキル2・パッシブ・奥義)と星刻が出る',
                  r and r['name'] == '死神' and all(k in r['cards'] for k in ['通常', 'スキル1', 'スキル2', 'パッシブ', '奥義']) and len(r['cards']) >= 6, r)
            check('★10の敵は星刻が全部光る(その★で効いている星刻)', r and r['perkAll'] > 0 and r['perkOn'] == r['perkAll'] and 'スキルLv10' in r['lv'], r)
            await pg.screenshot(path=str(OUT / 'lab_unit_detail.png'), full_page=False)
            await pg.click('.lab-unit-modal .detail-close'); await pg.wait_for_timeout(200)
            check('×で閉じる', await pg.evaluate("() => !document.querySelector('.lab-unit-modal')"))
            await pg.click('.lab-hint-box.win .lab-u'); await pg.wait_for_timeout(250)
            r = await pg.evaluate("""() => { const md = document.querySelector('.lab-unit-modal');
              return md && { note: md.querySelector('.lab-unit-note').textContent, lv: md.querySelector('.detail-family').textContent,
                on: md.querySelectorAll('.perk-row.on').length }; }""")
            check('想定の編成のキャラもタップで見られる(育ち・ルーン・遺物も出る)', r and '勝てる想定' in r['note'] and '上級+' in r['note'] and '★' in r['lv'], r)
            await pg.click('.lab-unit-modal .detail-close'); await pg.wait_for_timeout(150)
            await pg.click('[data-lab="floor:1"]'); await pg.wait_for_timeout(200)
            await pg.click('[data-lab="hint:win"]'); await pg.wait_for_timeout(200)
            await pg.screenshot(path=str(OUT / 'lab_top.png'), full_page=True)
            # 連続テスト
            await pg.click('[data-lab="sim:20"]')
            await pg.wait_for_function("() => lab.sim && lab.sim.done === 20 && !labSimming", timeout=60000)
            r = await pg.evaluate("() => ({ wins: lab.sim.rows.filter(x => x.win).length, err: lab.sim.rows.flatMap(x => x.parts).filter(p => p.error).map(p => p.error), rate: (document.querySelector('.lab-rate b') || {}).textContent, screen: currentScreen, saved: localStorage.getItem('monster-game-state') })")
            check('20回まわすと勝率が出る(エラーなし)', not r['err'] and r['rate'] and r['screen'] == 'lab', r)
            check('本番のセーブには何も書かない', r['saved'] is None, r)
            await pg.screenshot(path=str(OUT / 'lab_sim.png'), full_page=True)
            # 秩序の塔: その塔の種族でないモンスターは選べない・編成にいたら警告
            await pg.click('[data-lab="tower:order"]'); await pg.wait_for_timeout(200)
            await pg.click('[data-lab="hint:win"]'); await pg.wait_for_timeout(200)
            await pg.click('[data-lab="pick:0:0"]'); await pg.wait_for_timeout(200)
            r = await pg.evaluate("""() => ({ dis: document.querySelector('[data-lab="set:m61"]').disabled, ok: document.querySelector('[data-lab="set:m05"]').disabled,
              editor: !!document.querySelector('.lab-editor') })""")
            check('秩序の塔ではビースト(イエティ)は選べず、マキナ(シルバーナイト)は選べる', r['editor'] and r['dis'] and not r['ok'], r)
            await pg.click('[data-lab="set:m05"]'); await pg.wait_for_timeout(150)
            await pg.click('[data-lab="adj:star:1"]'); await pg.click('[data-lab="adj:sk:1"]'); await pg.click('[data-lab="adj:rune:1"]'); await pg.wait_for_timeout(150)
            r = await pg.evaluate("() => lab.parties[0][0]")
            check('モンスターを入れ替えて、★・スキルLv・ルーンを1つずつ変えられる', r['id'] == 'm05' and r['star'] >= 4 and r['sk'] >= 2 and r['rune'] >= 1, r)
            await pg.screenshot(path=str(OUT / 'lab_editor.png'), full_page=True)
            # 超上級: ★10・スキルLv10(上限)・ルーンⅩ・遺物カンスト(合う遺物を自動で)
            await pg.click('[data-lab="grow:3"]'); await pg.wait_for_timeout(200)
            r = await pg.evaluate("() => lab.parties[0].filter(Boolean).map(s => [s.star >= 9, s.sk, s.rune, s.relic && RELICS[s.relic].star, s.rlv, s.rsk, s.rdupe])")
            check('上級+にすると全員 ★9以上・スキルLv10・ルーンⅨ・★5遺物Lv180(遺物スキル9・3凸)',
                  len(r) > 0 and all(x == [True, 10, 9, 5, 180, 9, 3] for x in r), r)
            await pg.click('[data-lab="grow:4"]'); await pg.wait_for_timeout(200)
            r = await pg.evaluate("() => lab.parties[0].filter(Boolean).map(s => [s.star, s.sk, s.rune, !!s.relic, s.rlv])")
            SKILL_LV_CAP = await pg.evaluate("() => SKILL_LV_CAP")
            check('超上級にすると全員 ★10・スキルLv上限・ルーンⅩ・遺物Lv200(遺物つき)',
                  len(r) > 0 and all(x == [10, SKILL_LV_CAP, 10, True, 200] for x in r), (SKILL_LV_CAP, r))
            await pg.evaluate("() => { lab.pick = { p: 0, i: 0 }; render(); }"); await pg.wait_for_timeout(200)
            r = await pg.evaluate("() => ({ sel: document.getElementById('lab-relic').value, note: document.querySelector('.lab-relic-note').textContent })")
            check('編集欄で遺物を選べて、カンスト(スキルLv10・4凸)と出る', r['sel'] != '' and 'スキルLv10' in r['note'] and '4凸' in r['note'], r)
            await pg.screenshot(path=str(OUT / 'lab_ultra.png'), full_page=True)
            await pg.select_option('#lab-relic', '')
            await pg.wait_for_timeout(200)
            check('遺物を「なし」にできる', await pg.evaluate("() => lab.parties[0][0].relic === null && lab.parties[0][0].rlv === 0"))
            await pg.click('[data-lab="sim:20"]')
            await pg.wait_for_function("() => lab.sim && lab.sim.done === 20 && !labSimming", timeout=90000)
            r = await pg.evaluate("() => lab.sim.rows.flatMap(x => x.parts).filter(p => p.error).length")
            check('超上級でも連続テストが動く', r == 0, r)
            await pg.click('[data-lab="close"]')
            # 5階はステージ効果つき、10階はボス1体＋取り巻きの特殊ステージ
            await pg.click('[data-lab="tower:bal"]'); await pg.click('[data-lab="floor:5"]'); await pg.wait_for_timeout(150)
            await pg.click('[data-lab="hint:win"]'); await pg.wait_for_timeout(150)
            r = await pg.evaluate("""() => ({ parties: document.querySelectorAll('.lab-party').length,
                ok: labProblem(0), rules: document.querySelectorAll('.lab-rules div').length })""")
            check('5階は編成が1つで、ステージ効果が出る', r['parties'] == 1 and r['ok'] == '' and r['rules'] >= 3, r)
            await pg.click('[data-lab="floor:3"]'); await pg.wait_for_timeout(200)
            r = await pg.evaluate("() => babelStage(lab.tower, 3).rules.map(x => x.label)")
            check('ふつうの階は塔の敵の底上げだけ(ステージ効果なし)',
                  len(r) <= 1 and all('塔の敵' in x for x in r), r)
            await pg.click('[data-lab="floor:10"]'); await pg.click('[data-lab="hint:win"]'); await pg.wait_for_timeout(200)
            r = await pg.evaluate("""() => { const st = babelStage(lab.tower, 10);
                const last = st.waves[st.waves.length - 1];
                return { boss: last.filter(u => u.boss).length, rules: st.rules.map(r => r.label) }; }""")
            check('10階はボスが1体で、ボスだけ大きく強化される',
                  r['boss'] == 1 and any(x.startswith('ボス「') for x in r['rules']), r)
            await pg.screenshot(path=str(OUT / 'lab_boss.png'), full_page=True)
            # 観戦: 戦闘画面になり、終わると結果 → 試験場に戻る
            await pg.click('[data-lab="floor:1"]'); await pg.wait_for_timeout(150)
            await pg.click('[data-lab="hint:win"]'); await pg.wait_for_timeout(150)
            await pg.evaluate("() => { STATE.battleSpeed = 4; }")
            await pg.click('[data-lab="watch:0"]'); await pg.wait_for_timeout(1500)
            r = await pg.evaluate("() => ({ screen: currentScreen, lv: battleUI && battleUI.party.map(u => u.level), elv: battleUI && battleUI.enemies.map(u => u.level) })")
            check('観戦すると戦闘画面になり、味方も敵もLv200', r['screen'] == 'battle-fight' and set(r['lv']) == {200} and set(r['elv']) == {200}, r)
            await pg.screenshot(path=str(OUT / 'lab_battle.png'))
            await pg.wait_for_selector('.lab-result', timeout=120000)
            await pg.screenshot(path=str(OUT / 'lab_result.png'))
            await pg.click('[data-lab="back"]'); await pg.wait_for_timeout(300)
            r = await pg.evaluate("() => ({ screen: currentScreen, lab: !!document.querySelector('.lab'), saved: localStorage.getItem('monster-game-state'), mem: !!localStorage.getItem('monster-game-lab-babel') })")
            check('結果から試験場に戻れる。編成は試験場用にだけ覚える', r['screen'] == 'lab' and r['lab'] and r['saved'] is None and r['mem'], r)
            # ふつうに開いたときは試験場にならない
            pg2 = await b.new_page(viewport={'width': 390, 'height': 844})
            await pg2.goto(url); await pg2.wait_for_timeout(900)
            r = await pg2.evaluate("() => ({ lab: LAB_MODE, el: !!document.querySelector('.lab') })")
            check('ふつうに開いたときは試験場にならない', not r['lab'] and not r['el'], r)
            await b.close()
    real = [e for e in errs if 'favicon' not in e]
    check('JSエラーなし', not real, real[:3])
    print('すべて通過' if bad == 0 else f'{bad}件 失敗')

asyncio.run(main())
