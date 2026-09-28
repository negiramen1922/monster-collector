#!/usr/bin/env python3
"""ガチャのピックアップ切り替えは横スクロール。ガチャ・イベントの横スクロールはボタンを押しても位置が戻らない。
イベントショップは左に品のアイコン、右にメダルのアイコン＋値段。召喚券(1回券)と星結晶を混ぜて10連を引ける。
使い方: CHROMIUM_PATH=/path/to/chrome python3 tools/gacha_scroll_ui_test.py"""
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
            pg = await b.new_page(viewport={'width': 390, 'height': 900})
            await use_mock_auth(pg)
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(url); await pg.wait_for_timeout(1000)
            await start_as_guest(pg)
            await pg.evaluate("""() => { clearGuideToast(); STATE.announceQueue = []; closeModal && closeModal();
              EVENTS.forEach(e => { e.startAt = '2026-09-01T00:00:00+09:00'; e.endAt = '2099-01-01T00:00:00+09:00'; });
              ['tu1','tu2','tu3'].forEach(id => STATE.clearedStages.push(id));
              STATE.crystals = 5000; addItem('gacha_char', 5); addItem('gacha_relic', 12); goto('gacha'); gachaKind = 'mon'; render(); }""")
            await pg.wait_for_timeout(300)
            tabs = await pg.evaluate("() => { const el = document.querySelector('.gacha-tabs'); return el ? { sw: el.scrollWidth, cw: el.clientWidth, wrap: getComputedStyle(el).flexWrap, n: el.children.length } : null; }")
            check('ピックアップの切り替えは1列で横にスクロールする', tabs and tabs['wrap'] == 'nowrap' and tabs['sw'] > tabs['cw'], tabs)
            x = await pg.evaluate("""() => { const el = document.querySelector('.gacha-tabs'); el.scrollLeft = 9999; const x = el.scrollLeft;
              [...el.querySelectorAll('[data-gacha-banner]')].pop().click(); return x; }""")
            await pg.wait_for_timeout(200)
            x2 = await pg.evaluate("() => document.querySelector('.gacha-tabs').scrollLeft")
            check('ガチャ: 右端のピックアップを押しても横スクロールが戻らない', x > 0 and abs(x2 - x) <= 1, (x, x2))
            ten = await pg.evaluate("() => { const b = document.querySelector('[data-ticket-pull10=\"mon\"]'); return b ? b.textContent.replace(/\\s+/g, ' ').trim() : null; }")
            check('モンスター召喚券5枚で「券で10連(券5枚＋星結晶675)」が出る', ten and '券5枚' in ten and '675' in ten, ten)
            await pg.screenshot(path=str(OUT / 'gacha_tabs_scroll.png'))
            got = await pg.evaluate("""() => { window.showGachaEggs = () => {}; const c = STATE.crystals, p = STATE.totalPulls;
              document.querySelector('[data-ticket-pull10="mon"]').click();
              return { tickets: getItem('gacha_char'), spent: c - STATE.crystals, pulls: STATE.totalPulls - p }; }""")
            check('券5枚と星結晶675で10連を引ける', got['tickets'] == 0 and got['spent'] == 675 and got['pulls'] == 10, got)
            got = await pg.evaluate("""() => { closeModal && closeModal(); gachaKind = 'relic'; render(); const c = STATE.crystals;
              const btn = document.querySelector('[data-ticket-pull10="relic"]'); const label = btn ? btn.textContent : '';
              btn && btn.click(); return { label, tickets: getItem('gacha_relic'), spent: c - STATE.crystals }; }""")
            check('遺物召喚券10枚で10連を引ける(星結晶は使わない)', got['tickets'] == 2 and got['spent'] == 0 and '券10枚' in got['label'], got)
            # イベントの切り替え
            await pg.evaluate("() => { closeModal && closeModal(); goto('battle'); stageTab = 'event'; eventKey = EVENTS[0].key; eventView = 'menu'; render(); }")
            await pg.wait_for_timeout(300)
            x = await pg.evaluate("""() => { const el = document.querySelector('.tier-tabs'); el.scrollLeft = 9999; const x = el.scrollLeft;
              [...el.querySelectorAll('[data-event-tier]')].pop().click(); return x; }""")
            await pg.wait_for_timeout(200)
            x2 = await pg.evaluate("() => document.querySelector('.tier-tabs').scrollLeft")
            check('イベント: 右端のイベントを押しても横スクロールが戻らない', x > 0 and abs(x2 - x) <= 1, (x, x2))
            # イベントショップ
            await pg.evaluate("() => { addItem('medal_ev_fenrir', 500); shopTab = 'ev:ev_fenrir'; goto('shop'); }")
            await pg.wait_for_timeout(300)
            r = await pg.evaluate("""() => { const rows = [...document.querySelectorAll('.shop-row')];
              return { rows: rows.length, icons: rows.filter(r => r.querySelector('.shop-item .shop-ic img, .shop-item .shop-ic svg, .shop-item .shop-ic .item-ic')).length,
                       cost: rows.filter(r => r.querySelector('.shop-price .ev-cost .item-ic')).length,
                       soul: !!document.querySelector('.shop-row .shop-ic img.shop-mon') }; }""")
            check('イベントショップ: どの品も左にアイコンがある', r['rows'] > 0 and r['icons'] == r['rows'], r)
            check('イベントショップ: 値段はメダルのアイコン＋数字', r['cost'] == r['rows'], r)
            check('ソウルの品は立ち絵のアイコン', r['soul'], r)
            await pg.screenshot(path=str(OUT / 'event_shop_icons.png'))
            check('JSエラーなし', not errs, errs)
            await b.close()
    sys.exit(1 if bad else 0)

asyncio.run(main())
