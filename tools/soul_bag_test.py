#!/usr/bin/env python3
"""アイテム欄の「ソウル」欄(モンスターのソウル・遺物の共鳴石)と、お知らせの出し分けを確かめる。"""
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
            pg = await b.new_page(viewport={'width': 390, 'height': 860})
            await use_mock_auth(pg)
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(url); await pg.wait_for_timeout(1000)
            await start_as_guest(pg)

            # --- お知らせ: イベントは開催時刻まで出ない ---
            r = await pg.evaluate("""() => ({
              all: NOTICES.slice(0, 2).map(n => n.id),
              live: liveNotices().slice(0, 2).map(n => n.id),
              at: NOTICES[0].at,
            })""")
            check('ニュースの一番上はイベント(id17)', r['all'][0] == 17, r['all'])
            check('9/28のいまはまだ出ない(先頭はid16)', r['live'][0] == 16, r['live'])
            check('掲載開始は9/29 0:00', r['at'].startswith('2026-09-29T00:00'), r['at'])
            n = await pg.evaluate("""() => {
              const real = Date.now;
              Date.now = () => new Date('2026-09-29T09:00:00+09:00').getTime();
              const got = liveNotices().slice(0, 2).map(x => x.id);
              Date.now = real;
              return got;
            }""")
            check('9/29になるとイベントが一番上に出る', n[0] == 17 and n[1] == 16, n)
            check('ニュースは今回ぶん2本だけ', await pg.evaluate("() => NOTICES.filter(n => n.date === '9/29').length") == 2)
            check('アップデート内容も2本', await pg.evaluate("() => UPDATE_LOG.filter(n => n.version === 'α0.2.000').length") == 2)

            # --- ソウル欄 ---
            await pg.evaluate("""() => {
              STATE.owned['m01'] = { star:3, souls:40, level:20, exp:0, wall:20, skillLv:1, skill2Lv:1, ultLv:1, passiveLv:1 };
              STATE.owned['m24'] = { star:7, souls:1200, level:60, exp:0, wall:60, skillLv:1, skill2Lv:1, ultLv:1, passiveLv:1 };
              STATE.pendingSouls['m54'] = 12;
              grantRelic(RELICS['rel_fang']); grantRelic(RELICS['rel_fang']); grantRelic(RELICS['rel_fang']);
              grantRelic(RELICS['rel_droplet']); grantRelic(RELICS['rel_droplet']);
              STATE.universalSouls = 500; STATE.resonance = 30;
              closeModal(); bagTab = 'soul'; renderBag();
            }""")
            await pg.wait_for_timeout(500)
            tabs = await pg.evaluate("() => [...document.querySelectorAll('[data-bag-tab]')].map(e => e.textContent.trim())")
            check('アイテム欄のタブは 強化・素材・ソウル・その他', tabs == ['強化', '素材', 'ソウル', 'その他'], tabs)
            mons = await pg.locator('[data-soul-mon]').count()
            relics = await pg.locator('[data-soul-relic]').count()
            check('モンスターのソウルが3件出る(所持2＋未所持1)', mons == 3, mons)
            check('遺物の共鳴石が2件出る', relics == 2, relics)
            txt = await pg.locator('.bag-modal').inner_text()
            check('無形のソウルと無形の共鳴石も出る', '無形のソウル' in txt and '無形の共鳴石' in txt)
            check('未所持ぶんは「あとNで仲間に」', 'で仲間に' in txt, txt[:0])
            await pg.screenshot(path=str(OUT / 'soul_bag.png'), full_page=True)
            # 押すと詳細へ
            await pg.locator('[data-soul-relic]').first.click(); await pg.wait_for_timeout(500)
            check('共鳴石を押すと遺物の画面に移る', await pg.locator('.relic-detail-modal, .relic-upgrade-modal').count() >= 1)
            await b.close()
    real = [e for e in errs if 'favicon' not in e]
    check('JSエラーが出ない', not real, real[:3])
    print('すべて通過' if bad == 0 else f'{bad}件 失敗')
    return 1 if bad else 0

raise SystemExit(asyncio.run(main()))
