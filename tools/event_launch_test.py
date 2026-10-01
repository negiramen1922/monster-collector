#!/usr/bin/env python3
"""イベント開始日(9/29)の通し確認: 2つのイベントが立ち上がり、メダル・ショップ・EX・ミッションが回るか。"""
import asyncio, os, pathlib, json
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
            pg = await b.new_page(viewport={'width': 390, 'height': 780})
            await use_mock_auth(pg)
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(url); await pg.wait_for_timeout(1000)
            await start_as_guest(pg)
            # 9/29 に前倒しして両イベントを開催中にする
            r = await pg.evaluate("""() => {
              ['ev_fenrir','ev_abaddon'].forEach(k => { EVENTS.find(e => e.key===k).startAt = '2026-09-01T00:00:00+09:00'; });
              ['tu1','tu2','tu3'].forEach(id => STATE.clearedStages.push(id));
              return activeEvents().map(e => e.key);
            }""")
            check('開催中は4つ(既存2＋新2)', len(r) == 4 and 'ev_fenrir' in r and 'ev_abaddon' in r, r)
            # メダルが無いとイベントショップも周回回数のミッションも出ないので、開催中は全部持っていること
            m = await pg.evaluate("() => activeEvents().map(e => [e.name, medalOf(e) && medalOf(e).name])")
            check('開催中のイベントは全部メダルを持っている', all(x[1] for x in m), m)
            check('メダルの名前が重複していない', len({x[1] for x in m}) == len(m), m)

            for key in ['ev_fenrir', 'ev_abaddon']:
                r = await pg.evaluate("""(key) => {
                  const ev = EVENTS.find(e => e.key === key);
                  const shop = eventShopItems(ev);
                  return { stages: ev.stages.length, ex: ev.exStages.length,
                           shopN: shop.length, shopTotal: shop.reduce((a,x)=>a+x.price*(x.limit===null?0:x.limit),0),
                           medalPerRun: medalRunGain(10) * 2, stam10: ev.stages[9].stamina,
                           missions: eventMissions(ev).length,
                           titles: Object.keys(TITLES).filter(k => k.startsWith('ti_'+key)).map(k=>TITLES[k].name),
                           exRules: ev.exStages.map(s => (s.rules||[]).length) };
                }""", key)
                check(f'{key}: 10層＋EX3', r['stages'] == 10 and r['ex'] == 3, (r['stages'], r['ex']))
                check(f'{key}: ショップ24品 上限まで14,920メダル', r['shopN'] == 24 and r['shopTotal'] == 14920, (r['shopN'], r['shopTotal']))
                # 2週間(自然回復 288×14 = 4,032スタミナ)で買い切れる量か
                runs = -(-r['shopTotal'] // r['medalPerRun'])
                stam = runs * r['stam10']
                check(f'{key}: 全買いが2週間ぶんのスタミナ(4,032)で足りる', stam <= 4032, (runs, stam))
                check(f'{key}: ミッション14本・称号3つ', r['missions'] == 14 and len(r['titles']) == 3, (r['missions'], r['titles']))
                check(f'{key}: EX全3面にルールがある', all(n > 0 for n in r['exRules']), r['exRules'])

            # メダルが実際に落ちるか(ボーナスつき)
            r = await pg.evaluate("""() => {
              const ev = EVENTS.find(e => e.key === 'ev_fenrir');
              const st = ev.stages[9];   // 10層
              const before = getItem('medal_ev_fenrir');
              battleUI = { party: [{ ref:'m68', element:'wind' }, { ref:'m166', element:'wind' }] };  // 主役+注目★4
              const got = grantEventMedal(st, true);
              battleUI = null;
              return { got, gain: getItem('medal_ev_fenrir') - before };
            }""")
            # 10層: 周回 10+4*10=50 に +60%(40+20) = 80、初回 500 → 580
            check('10層の初回クリアでメダル580(ボーナス+60%込み)', r['gain'] == 580, r)
            check('内訳が合っている', r['got']['run'] == 80 and r['got']['first'] == 500, r['got'])

            # EXはメダルを落とさない
            r = await pg.evaluate("""() => {
              const ev = EVENTS.find(e => e.key === 'ev_fenrir');
              return grantEventMedal(ev.exStages[0], true);
            }""")
            check('EXではメダルが出ない', r is None, r)

            # EXの解放条件
            r = await pg.evaluate("""() => {
              const ev = EVENTS.find(e => e.key === 'ev_abaddon');
              const before = ev.exStages.map(s => stageUnlocked(s));
              STATE.clearedStages.push('ev_abaddon_3');
              return { before, after: ev.exStages.map(s => stageUnlocked(s)) };
            }""")
            check('EXは3層クリアで開く', r['before'][0] is False and r['after'][0] is True, r)

            # ショップで交換できる
            r = await pg.evaluate("""() => {
              addItem('medal_ev_abaddon', 5000);
              const sku = eventShopItems(EVENTS.find(e=>e.key==='ev_abaddon'))[0];
              const before = getItem('medal_ev_abaddon');
              buyEventShop('ev_abaddon', sku.sku, 1);
              return { sku: sku.sku, price: sku.price, paid: before - getItem('medal_ev_abaddon') };
            }""")
            check('イベントショップで交換できる', r['paid'] == r['price'], r)

            # 画面: ショップのイベントタブは開催中のイベントのぶんだけ出る
            await pg.evaluate("() => { goto('shop'); shopTab = 'ev:ev_fenrir'; render(); }")
            await pg.wait_for_timeout(500)
            n = await pg.locator('[data-shop-tab^="ev:"]').count()
            want = await pg.evaluate("() => activeEvents().filter(e => medalOf(e)).length")
            check('ショップのイベントタブが開催中のぶんだけ出る', n == want, [n, want])
            check('イベントショップに24行出る', await pg.locator('[data-ev-buy]').count() == 24)
            await pg.screenshot(path=str(OUT / 'launch_shop.png'))

            # 画面: イベントタブが2つ、切り替えられる
            await pg.evaluate("() => { goto('battle'); stageTab = 'event'; eventKey = 'ev_abaddon'; eventView='menu'; render(); }")
            await pg.wait_for_timeout(500)
            check('イベントの切り替えタブが4つ', await pg.locator('[data-event-tier]').count() == 4)
            await pg.screenshot(path=str(OUT / 'launch_event.png'))
            await pg.evaluate("() => { eventView = 'ex'; render(); }")
            await pg.wait_for_timeout(300)
            txt = await pg.locator('.event-card').inner_text()
            check('EX画面にルールの説明が出る', 'EX1' in txt and ('闇' in txt or 'ルール' in txt), txt[:80].replace('\n', ' '))
            await pg.screenshot(path=str(OUT / 'launch_ex.png'))
            await b.close()
    real = [e for e in errs if 'favicon' not in e]
    check('JSエラーが出ない', not real, real[:3])
    print('すべて通過' if bad == 0 else f'{bad}件 失敗')
    return 1 if bad else 0

raise SystemExit(asyncio.run(main()))
