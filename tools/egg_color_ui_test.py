"""宝箱から出る卵の色が中身で変わる。SPDの「SP」だけが光らない。
   使い方: CHROMIUM_PATH=/opt/pw-browsers/chromium python3 tools/egg_color_ui_test.py"""
import asyncio, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from _serve import game_url, use_mock_auth, start_as_guest
from playwright.async_api import async_playwright

bad = 0
def check(name, cond, info=None):
    global bad
    if not cond: bad += 1
    print(('✅' if cond else '❌') + ' ' + name + ('  ' + repr(info) if info is not None else ''))

async def main():
    with game_url() as url:
        async with async_playwright() as pw:
            b = await pw.chromium.launch(executable_path='/opt/pw-browsers/chromium')
            pg = await b.new_page(viewport={'width': 420, 'height': 1000})
            await use_mock_auth(pg); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(url); await pg.wait_for_timeout(1000)
            await start_as_guest(pg)

            # --- 説明文: SPD が割られない ---
            r = await pg.evaluate("""() => {
              const mk = t => markTerms(t);
              return { spd: mk('3ターン、STR+30%・SPD+10'), sp: mk('SPを20回復'),
                       kits: MONSTERS.flatMap(m => ['normal','skill1','skill2','ult','passive']
                         .map(k => MONSTER_KITS[m.id][k]).filter(a => a && a.desc)
                         .filter(a => />SP<\\/b>D/.test(markTerms(a.desc)))).map(a => a.name) };
            }""")
            check('SPD の SP が光らない', 'term' not in r['spd'], r['spd'])
            check('単体の SP は光る', 'data-term="sp"' in r['sp'], r['sp'][:60])
            check('全キットで SPD が割られていない', r['kits'] == [], r['kits'])

            # --- 卵の色 ---
            # 器の色は3段: 青 = ★3以下 / 金 = ★4 / 虹 = ★5(宝箱・卵・壺で共通)
            col = await pg.evaluate("""() => ({
              r1: eggColorClass(1, false), r3: eggColorClass(3, false), r4: eggColorClass(4, false),
              r5: eggColorClass(5, false), fake5: eggColorClass(5, true) })""")
            check('★1は青', col['r1'] == 'egg-blue', col)
            check('★3も青', col['r3'] == 'egg-blue', col)
            check('★4は金', col['r4'] == 'egg-gold', col)
            check('★5は虹', col['r5'] == 'egg-rainbow', col)
            check('★5の偽の予兆は1段下の金(割るまで分からない)', col['fake5'] == 'egg-gold', col)

            # 10連ぶんの演出のHTMLを直に作って、飛ぶ卵と並んだ卵の色を見る
            got = await pg.evaluate("""() => {
              const five = MONSTERS.find(m => m.rarity === 5), one = MONSTERS.find(m => m.rarity === 1);
              // 結果は { mon, isNew } の形(pullRarity が r.mon.rarity を見る)
              const results = [{ mon: five, isNew: true }, ...Array.from({length: 9}, () => ({ mon: one, isNew: false }))];
              gachaSeq = { results, kind: 'mon', fake: results.map(() => false), openAt: 700, phase: 'summon' };
              const pick = h => [...h.matchAll(/egg-(blue|gold|rainbow)/g)].map(m => m[1]);
              const fly = pick(gachaChestHtml(10));
              const slots = results.map((r, i) => pick(eggFace(r, i, 'egg', 'mon'))[0]);
              // ★5が偽の予兆を出すときは金のまま
              gachaSeq.fake = results.map((_, i) => i === 0);
              const faked = pick(eggFace(results[0], 0, 'egg', 'mon'))[0];
              gachaSeq = null;
              return { fly, slots, faked };
            }""")
            check('飛び出す卵に虹が1つ混じる', got['fly'].count('rainbow') == 1, got['fly'])
            check('飛び出す残り9個は青', got['fly'].count('blue') == 9, got['fly'])
            check('並んだ卵も同じ色', got['slots'] == ['rainbow'] + ['blue'] * 9, got['slots'])
            check('偽の予兆の★5は金で出る', got['faked'] == 'gold', got['faked'])

            check('JSエラーなし', not errs, errs[:3])
            await b.close()
    sys.exit(1 if bad else 0)

asyncio.run(main())
