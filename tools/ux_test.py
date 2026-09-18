#!/usr/bin/env python3
"""図鑑の絞り込み・並び替えと、モンスター詳細の操作性の検証。

使い方: CHROMIUM_PATH=/path/to/chrome python3 ux_test.py
"""
import asyncio, os, pathlib
from playwright.async_api import async_playwright
from _serve import game_url, use_mock_auth, start_as_guest

OUT = pathlib.Path(__file__).resolve().parent
LAUNCH = {'executable_path': os.environ['CHROMIUM_PATH']} if os.environ.get('CHROMIUM_PATH') else {}
SETUP = """() => {
  MONSTERS.slice(0, 40).forEach((m, i) => STATE.owned[m.id] = { ...newOwned(m), star: m.rarity, level: 5 + i });
  STATE.owned['m128'] = { ...newOwned(MON_BY_ID['m128']), star: 3, level: 1, wall: 0 };
  STATE.items.exp3 = 900; STATE.gold = 500000;
  ['el_fire_1','ro_attacker_1','sp_draconia_1'].forEach(k => STATE.items[k] = 30);
  goto('dex'); render();
}"""

bad = 0
def check(name, cond, info=''):
    global bad
    bad += 0 if cond else 1
    print(('✅' if cond else '❌') + f' {name}' + (f'  {info}' if info != '' else ''))


async def main():
    with game_url() as url:
        async with async_playwright() as p:
            b = await p.chromium.launch(**LAUNCH)
            pg = await b.new_page(viewport={'width': 375, 'height': 667})
            await use_mock_auth(pg)
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(url)
            await pg.wait_for_timeout(1000)
            await start_as_guest(pg)
            await pg.evaluate(SETUP)
            await pg.wait_for_timeout(300)

            # ---- 図鑑: 並び替えと絞り込み ----
            keys = await pg.evaluate("() => [...document.querySelectorAll('[data-sort]')].map(b => b.dataset.sort)")
            check('図鑑に並び替えがある', keys == ['dex:no', 'dex:rarity', 'dex:level', 'dex:bp'], str(keys))
            first = lambda: pg.evaluate("() => [...document.querySelectorAll('.mon-cell .name')].slice(0,1)[0].textContent")
            before = await first()
            await pg.click('[data-sort="dex:bp"]')
            await pg.wait_for_timeout(300)
            check('並び替えが効く', await first() != before, f'{before} → {await first()}')
            await pg.click('[data-sort="dex:bp"]')
            await pg.wait_for_timeout(300)
            check('もう一度押すと逆順', '▲' in await pg.inner_text('[data-sort="dex:bp"]'))

            await pg.click('[data-rf-open="dex"]')
            await pg.wait_for_timeout(300)
            await pg.click('[data-rf-chip="elem:fire"]')
            await pg.wait_for_timeout(200)
            await pg.click('[data-rf-apply]')
            await pg.wait_for_timeout(400)
            shown = await pg.evaluate("() => document.querySelectorAll('.mon-cell').length")
            fire = await pg.evaluate("() => MONSTERS.filter(m => m.element === 'fire').length")
            check('属性で絞り込める', shown == fire, f'{shown} / 火属性{fire}体')
            check('絞り込み中だと分かる', '絞り込み(1)' in await pg.inner_text('[data-rf-open="dex"]'))
            await pg.click('[data-owned-toggle]')
            await pg.wait_for_timeout(300)
            owned_fire = await pg.evaluate("() => MONSTERS.filter(m => m.element === 'fire' && STATE.owned[m.id]).length")
            check('所持のみと併用できる', await pg.evaluate("() => document.querySelectorAll('.mon-cell').length") == owned_fire)
            await pg.click('[data-rf-clear="dex"]')
            await pg.click('[data-owned-toggle]')
            await pg.wait_for_timeout(300)
            check('解除で全部に戻る', await pg.evaluate("() => document.querySelectorAll('.mon-cell').length") == await pg.evaluate("() => MONSTERS.length"))

            # ---- モンスター詳細 ----
            await pg.evaluate("() => showMonsterDetail('m128')")
            await pg.wait_for_timeout(400)
            order = await pg.evaluate("() => [...document.querySelectorAll('.detail-modal > div')].map(d => d.className)")
            check('レベルアップが詳細の一番上にある', order[:3] == ['detail-head', 'upgrade-section-title', 'detail-level-box'], str(order[:4]))
            check('レベルで変わる数字が色つき', await pg.evaluate("() => document.querySelectorAll('.detail-stats .lv-stat').length") == 5)
            check('スキル説明の下に強化ボタンがある',
                  await pg.evaluate("() => document.querySelectorAll('.detail-skill-box .skill-upgrade [data-skill-up]').length") == 3)

            lv = lambda: pg.evaluate("() => STATE.owned.m128.level")
            await pg.click('[data-times="1"]')
            await pg.wait_for_timeout(300)
            check('タップで1レベル上がる', await lv() == 2, str(await lv()))
            await pg.evaluate("() => { document.querySelector('.detail-modal').scrollTop = 220; }")
            await pg.click('[data-times="1"]')
            await pg.wait_for_timeout(300)
            check('レベルアップしてもスクロール位置が戻らない',
                  await pg.evaluate("() => document.querySelector('.detail-modal').scrollTop") == 220)
            check('上がった数字が光る', await pg.evaluate("() => document.querySelectorAll('.detail-stats b.up').length") > 0)

            await pg.evaluate("() => { document.querySelector('.detail-modal').scrollTop = 0; }")
            box = await pg.locator('[data-times="1"]').bounding_box()
            await pg.mouse.move(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2)
            await pg.mouse.down()
            await pg.wait_for_timeout(1500)
            await pg.mouse.up()
            await pg.wait_for_timeout(400)
            check('長押しで連続レベルアップ', await lv() >= 6, f'Lv{await lv()}')
            check('壁で止まる', await lv() == 10, f'Lv{await lv()}')
            await pg.screenshot(path=str(OUT / 'ux_detail.png'))


            # ---- 周回UI・★上げフィルター・シールド表示 ----
            await pg.evaluate("""() => {
              closeModal(); STATE.stamina = 180; STATE.vip = true;
              STATE.stageStars = Object.fromEntries(STAGES.map(s => [s.id, 3]));
              STATE.owned['m128'].souls = 999;
              sweepTarget = 'q1_01'; renderSweepModal();
            }""")
            await pg.wait_for_timeout(300)
            sweep = await pg.evaluate("() => [...document.querySelectorAll('[data-sweep-run]')].map(b => b.textContent.replace(/\\\\s+/g,' ').trim())")
            check('周回に回数・消費・残りが出る', any('残り' in x and '⚡' in x for x in sweep), str(sweep[:2]))
            check('周回に今のスタミナが出る', '180' in await pg.inner_text('.sw-stamina'))
            check('周回に1回の報酬が出る', '報酬' in await pg.inner_text('.sw-reward'))
            await pg.evaluate("() => closeModal()")

            await pg.evaluate("() => { goto('dex'); render(); }")
            await pg.wait_for_timeout(300)
            all_cells = await pg.evaluate("() => document.querySelectorAll('.mon-cell').length")
            await pg.click('[data-promo-toggle="dex"]')
            await pg.wait_for_timeout(300)
            promo_cells = await pg.evaluate("() => document.querySelectorAll('.mon-cell').length")
            check('★上げできるモンスターだけに絞れる', 0 < promo_cells < all_cells, f'{all_cells} → {promo_cells}')
            check('絞れる数がボタンに出る', '(' in await pg.inner_text('[data-promo-toggle="dex"]'))
            await pg.click('[data-promo-toggle="dex"]')
            await pg.wait_for_timeout(200)

            await pg.evaluate("""() => {
              ['m05','m15','m22','m57','m19'].forEach(id => STATE.owned[id] = { ...newOwned(MON_BY_ID[id]), star:4, level:60, wall:60 });
              STATE.formationKey = 'f2'; STATE.slots = ['m05','m15','m22','m57','m19'];
              STATE.clearedStages = STAGES.map(s => s.id);
              STATE.stamina = 999; STATE.battleSpeed = 1; startBattle('q1_05', { skipIntro:true });
            }""")
            await pg.wait_for_timeout(900)
            await pg.evaluate("""() => { battleUI.paused = true;
              const u = battleUI.party[0]; u.hp = Math.round(u.maxHp * 0.5);
              addShield(u, Math.round(u.maxHp * 0.3), 3, u); renderBattleScreenOnly(); }""")
            await pg.wait_for_timeout(300)
            check('シールドがHPバーの上に青く出る',
                  await pg.evaluate("() => document.querySelectorAll('.shield-fill').length") >= 1)
            check('シールド量が数字で出る',
                  await pg.evaluate("() => { const e = document.querySelector('.shield-num'); return e && Number(e.textContent) > 0; }"))
            check('状態アイコンから💠が消えた',
                  '💠' not in await pg.evaluate("() => [...document.querySelectorAll('.status-row')].map(e => e.textContent).join('')"))
            await pg.evaluate("() => { closeModal(); goto('home'); render(); }")

            # ---- 戦闘: ユニットのタップとログ ----
            await pg.evaluate("""() => {
              ['m05','m15','m22','m57','m19'].forEach(id => STATE.owned[id] = { ...newOwned(MON_BY_ID[id]), star:4, level:60, wall:60 });
              STATE.formationKey='f2'; STATE.slots=['m05','m15','m22','m57','m19'];
              STATE.clearedStages = STAGES.map(s => s.id); STATE.stamina = 999; STATE.battleSpeed = 1;
              closeModal(); startBattle('q1_05', { skipIntro:true });
            }""")
            await pg.wait_for_timeout(900)
            await pg.evaluate("() => { battleUI.paused = true; }")   # 戦闘が終わる前に止める
            check('戦闘中', not await pg.evaluate("() => battleUI.finished"))
            check('戦闘中の全ユニットがタップできる',
                  await pg.evaluate("() => document.querySelectorAll('[data-inspect]').length") >= 8)
            await pg.evaluate("""() => {
              const u = battleUI.party[0];
              applyStatus(u, 'burn', battleUI.enemies[0]);
              addBuff(u, 'strUp', 0.3, 3, u); addShield(u, 200, 2, u);
            }""")
            await pg.click('.bf-grid .unit >> nth=0')
            await pg.wait_for_timeout(300)
            check('タップで詳細が開く', await pg.evaluate("() => !!document.querySelector('.unit-modal')"))
            await pg.evaluate("() => showUnitInspect('ally', 0)")   # 効果を付けた本人を開く
            await pg.wait_for_timeout(300)
            effects = await pg.evaluate("() => [...document.querySelectorAll('.ui-effect b')].map(e => e.textContent)")
            check('かかっている効果が出る', 'やけど' in effects and 'STRアップ' in effects and 'シールド' in effects, str(effects))
            check('パッシブと技が出る',
                  await pg.evaluate("() => !!document.querySelector('.ui-passive b') && document.querySelectorAll('.ui-skill').length >= 3"))
            await pg.click('[data-close-inspect]')
            await pg.wait_for_timeout(200)
            await pg.evaluate("() => { showUnitInspect('enemy', 0); }")
            await pg.wait_for_timeout(300)
            check('敵も見られる', '敵' in await pg.inner_text('.ui-name'), await pg.inner_text('.ui-name'))
            await pg.click('[data-close-inspect]')
            await pg.evaluate("() => { STATE.battleSpeed = 3; battleUI.paused = false; scheduleNextTick(); }")
            await pg.wait_for_timeout(3000)
            log = await pg.evaluate("() => (battleUI ? battleUI.log : []).join('\\n')")
            check('パッシブの発動がログに出る', 'パッシブ「' in log)
            check('バフ・回復・シールドがログに出る',
                  any(k in log for k in ['アップ', 'シールド', '回復', '挑発']), log[:80])

            check('JSエラーなし', not errs, f'{len(errs)}件 {errs[:3]}')
            await b.close()
    raise SystemExit(1 if bad else 0)

asyncio.run(main())
