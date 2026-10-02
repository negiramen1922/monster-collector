#!/usr/bin/env python3
"""ルーン・遺物を選ぶ一覧で、装備しているキャラが右端に顔と名前で出る(文字の「装備中: 〇〇」ではなく)。
使い方: CHROMIUM_PATH=/path/to/chrome python3 tools/equip_who_ui_test.py"""
import asyncio, os, pathlib
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
            pg = await b.new_page(viewport={'width': 390, 'height': 844})
            await use_mock_auth(pg)
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(url); await pg.wait_for_timeout(1000)
            await start_as_guest(pg)
            r = await pg.evaluate("""() => { clearGuideToast();
              ['m68','m139','m01'].forEach((id, i) => { STATE.owned[id] = STATE.owned[id] || newOwned(MON_BY_ID[id]); STATE.slots[i] = id; });
              const rel = Object.keys(RELICS).slice(0, 3); rel.forEach(id => grantRelic(RELICS[id]));
              equipRelic(rel[0], 'm139'); equipRelic(rel[1], 'm68');
              openRelicPicker('m68');
              const rows = [...document.querySelectorAll('.relic-row')];
              const who = rows.map(x => { const w = x.querySelector('.eq-who'); return w ? (w.querySelector('img') ? w.querySelector('img').alt + '+img' : '') + (w.querySelector('small') ? '+name' : '') : ''; });
              return { who, first: rows[0].classList.contains('on'), firstId: rows[0].dataset.relicRow, mine: rel[1], text: document.querySelector('.relic-list').textContent.includes('装備中: ') }; }""")
            check('遺物: ほかの子が付けている遺物は、右端にその子の顔だけ(名前は出さない)', 'アバドン+img' in r['who'], r)
            check('遺物: この子が付けている遺物は一番上・金色の枠・顔だけ出す(名前・「この子」の文字は出さない)', r['first'] and r['firstId'] == r['mine'] and r['who'][0] == 'フェンリル+img' and not any('この子' in w for w in r['who']), r)
            check('遺物: 「装備中: 〇〇」の文字はもう出ない', not r['text'], r)
            await pg.screenshot(path=str(OUT / 'equip_who_relic.png'))
            r = await pg.evaluate("""() => { closeModal(); relicPicker = null;
              const a = makeRune(3, 2, 'atk'), c = makeRune(4, 3, 'hp'); addRune(a); addRune(c); addRune(makeRune(2, 1, 'def'));
              equipRune(a.uid, 'm139', 0);
              runePicker = { monId: 'm68', slot: 0, filter: 'all' }; renderRunePicker();
              const rows = [...document.querySelectorAll('.rpk-row')];
              return { n: rows.length, who: rows.map(x => { const w = x.querySelector('.eq-who'); return w ? (w.querySelector('img') ? w.querySelector('img').alt + '+img' : '') + (w.querySelector('small') ? '+name' : '') : ''; }) }; }""")
            check('ルーン: ほかの子が付けているルーンは、右端にその子の顔だけ(名前は出さない)', 'アバドン+img' in r['who'], r)
            await pg.screenshot(path=str(OUT / 'equip_who_rune.png'))
            await b.close()
    real = [e for e in errs if 'favicon' not in e]
    check('JSエラーなし', not real, real[:3])
    print('すべて通過' if bad == 0 else f'{bad}件 失敗')

asyncio.run(main())
