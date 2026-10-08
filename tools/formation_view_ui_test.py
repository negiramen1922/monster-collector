#!/usr/bin/env python3
"""編成画面の陣形の表示切り替え(キャラ / 装備)。
キャラ: マスに ★とLv。装備: マスに 遺物とルーン4枠(埋まり・空き・未解放)と、編成全体の装備の数。
使い方: CHROMIUM_PATH=/path/to/chrome python3 tools/formation_view_ui_test.py"""
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
            # 1体目: ★6(ルーン3枠)・遺物つき・ルーン2つ / 2体目: 遺物なし・ルーンなし
            ids = await pg.evaluate("""() => { clearGuideToast(); STATE.announceQueue = [];
              const ids = STATE.slots.filter(Boolean);
              STATE.owned[ids[0]].star = 6; STATE.owned[ids[0]].level = 120;
              const r = Object.keys(RELICS)[0]; STATE.relics[r] = newRelicState(); STATE.relics[r].equippedTo = ids[0];
              const a = addRune(makeRune(3, 1, 'str')), c = addRune(makeRune(3, 1, 'hp'));
              equipRune(a.uid, ids[0], 0);
              equipRune(c.uid, ids[0], 2);
              saveState(); return ids; }""")
            await pg.evaluate("() => document.querySelector('.nav-btn[data-nav=\"party\"]').click()"); await pg.wait_for_timeout(250)
            tabs = await pg.evaluate("() => [...document.querySelectorAll('#screen .fview-tab')].map(b => [b.firstChild.textContent, b.classList.contains('on')])")
            check('陣形の右上に「キャラ / 装備」の切り替え(はじめはキャラ)', tabs == [['キャラ', True], ['装備', False]], tabs)
            cap = await pg.evaluate("() => document.querySelector('#screen .formation .party-slot .slot-cap').textContent")
            check('キャラ: マスに ★とLv', cap == '★6Lv120', cap)
            await pg.screenshot(path=str(OUT / 'fview_char.png'))
            await pg.evaluate("() => document.querySelector('#screen [data-fview=\"equip\"]').click()"); await pg.wait_for_timeout(200)
            r = await pg.evaluate("""() => { const s = document.querySelector('#screen .formation .party-slot');
              return { relic: !!s.querySelector('.slot-relic:not(.none)'), pips: [...s.querySelectorAll('.rp')].map(i => i.className.replace('rp', '').trim() || 'empty'),
                       role: !!s.querySelector('.role-mini'), sum: document.querySelector('#screen .fview-sum').textContent }; }""")
            check('装備: 遺物のアイコンが出る', r['relic'], r)
            check('装備: ルーン4枠(埋まり・空き・埋まり・未解放)', r['pips'] == ['on', 'empty', 'on', 'locked'], r['pips'])
            check('装備: ロールの印は出さない(重ならないように)', not r['role'])
            check('装備: 編成全体の遺物・ルーンの数', '遺物 1 /' in r['sum'] and 'ルーン 2 /' in r['sum'] and '空いている枠' in r['sum'], r['sum'])
            second = await pg.evaluate("() => { const s = document.querySelectorAll('#screen .formation .party-slot')[1]; return !!s.querySelector('.slot-relic.none'); }")
            check('装備: 遺物のない子は「—」の枠', second)
            await pg.screenshot(path=str(OUT / 'fview_equip.png'))
            marks = await pg.evaluate("() => ({ tab: !!document.querySelector('#screen [data-fview=\"equip\"] .equip-empty'), slots: [...document.querySelectorAll('#screen .formation .party-slot')].filter(s => s.querySelector('img')).map(s => !!s.querySelector('.equip-empty')) })")
            check('装備に空きがあると「!」(装備のタブと、空きのある子のマス)', marks['tab'] and marks['slots'][:2] == [True, True], marks)
            # 全員の遺物とルーンを埋めると「!」が消える
            await pg.evaluate("""() => { const ids = STATE.slots.filter(Boolean); const rs = Object.keys(RELICS);
              ids.forEach((id, k) => { const r = rs[k + 1]; if(!equippedRelicOf(id)){ STATE.relics[r] = newRelicState(); STATE.relics[r].equippedTo = id; }
                runesOf(id).forEach((u, i) => { if(!u && i < runeSlotsOpen(id)) equipRune(addRune(makeRune(1, 0, 'hp')).uid, id, i); }); });
              saveState(); render(); }"""); await pg.wait_for_timeout(200)
            n = await pg.evaluate("() => document.querySelectorAll('#screen .equip-empty').length")
            check('全部埋めると「!」は出ない', n == 0, n)
            await pg.evaluate("() => { goto('home', {nav:true}); }"); await pg.wait_for_timeout(200)
            home = await pg.evaluate("() => document.querySelectorAll('#screen .formation .slot-cap').length")
            check('ホームの小さい陣形には出さない', home == 0, home)
            await pg.evaluate("() => document.querySelector('.nav-btn[data-nav=\"party\"]').click()"); await pg.wait_for_timeout(200)
            check('画面を移っても装備の表示のまま', await pg.evaluate("() => formationView") == 'equip')
            check('ページのエラーなし', not errs, errs)
            await b.close()
    print('すべて通過' if bad == 0 else f'{bad}件 失敗')
    sys.exit(1 if bad else 0)

asyncio.run(main())
