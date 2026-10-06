#!/usr/bin/env python3
"""ガチャの「虹」が必ず★5と一致しているかの回帰テスト。

虹は「その回に★5が出た」という約束の色。約束だけして出ないと、いちばん
がっかりする嘘になる。虹が出る場所は4つ(宝箱・飛び出す卵・卵のマス・
画面の光)。どれも★5がないときには出ないこと、★5があるときに宝箱が
★5より下の色で終わらない(ぬか喜びの逆)ことを確かめる。

使い方: CHROMIUM_PATH=/path/to/chrome python3 tools/gacha_rainbow_test.py
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
            await pg.evaluate("""() => { STATE.crystals = 999999; clearGuideToast(true);
                closeModal(); goto('gacha', { nav: true }); }""")
            await pg.wait_for_timeout(400)

            # ---- 1. 色を決める関数そのもの(総当たりに近い回数) ----
            print('\n--- 1. 色の決まりかた ---')
            r = await pg.evaluate("""() => {
                const out = { chestBad: [], eggBad: [], chestLow: [], n: 0, rbChest: 0, rbEgg: 0 };
                const byStar = {}; [1,2,3,4,5].forEach(s => byStar[s] = MONSTERS.filter(m => m.rarity === s));
                const pick = s => byStar[s][Math.floor(Math.random() * byStar[s].length)];
                for(let t = 0; t < 20000; t++){
                  const results = Array.from({ length: 10 }, () => pick([1,1,1,2,2,2,3,3,4,5][Math.floor(Math.random()*10)]))
                    .map(m => ({ mon: m }));
                  const top = Math.max(...results.map(x => x.mon.rarity));
                  const has5 = top >= 5;
                  const steps = summonSteps('mon', results);
                  if(steps.includes('rainbow')){ out.rbChest++; if(!has5) out.chestBad.push(results.map(x => x.mon.rarity)); }
                  // 宝箱は本当の結果より下で終わらない(最後の色が結果と合う)
                  const want = SUMMON_COLORS[summonTarget('mon', results)];
                  if(steps[steps.length - 1] !== want) out.chestLow.push([steps, want]);
                  const fake = results.map(x => x.mon.rarity >= 5 && Math.random() < EGG_UPGRADE_CHANCE);
                  results.forEach((x, i) => {
                    if(eggColorClass(x.mon.rarity, fake[i]) === 'egg-rainbow'){
                      out.rbEgg++;
                      if(x.mon.rarity < 5) out.eggBad.push([x.mon.rarity, fake[i]]);
                    }
                  });
                  out.n++;
                }
                ['chestBad','eggBad','chestLow'].forEach(k => out[k] = out[k].slice(0, 3));
                return out; }""")
            check('★5がないのに宝箱が虹にならない', r['chestBad'] == [], r['chestBad'])
            check('★5でない卵が虹にならない', r['eggBad'] == [], r['eggBad'])
            check('宝箱は結果より下の色で終わらない(ぬか喜びさせない)', r['chestLow'] == [], r['chestLow'])
            check('ちゃんと虹が出るときは出ている', r['rbChest'] > 0 and r['rbEgg'] > 0, [r['rbChest'], r['rbEgg']])
            check('★5の卵が金で出ることもある(偽の予兆)', await pg.evaluate("() => eggColorClass(5, true)") == 'egg-gold')

            # ---- 2. 演出を実際に流して画面を見る ----
            print('\n--- 2. 実際の演出 ---')
            async def run(stars, kind):
                await pg.evaluate("""(a) => {
                    const pickMon = s => { const l = MONSTERS.filter(m => m.rarity === s); return l[Math.floor(Math.random()*l.length)]; };
                    const pickRel = s => { const l = Object.values(RELICS).filter(x => x.star === s); return (l.length ? l : Object.values(RELICS))[0]; };
                    const results = a.stars.map(s => a.kind === 'relic'
                      ? { def: pickRel(s), isNew: true }
                      : { mon: pickMon(s), isNew: true, universal: 0, pity: false });
                    showGachaEggs(results, { universal: STATE.universalSouls, points: STATE.summonPoints }, a.kind); }""",
                    {'stars': stars, 'kind': kind})
                seen = set()
                for _ in range(60):
                    await pg.wait_for_timeout(220)
                    hits = await pg.evaluate("""() => { if(!gachaSeq) return null;
                        const h = document.getElementById('phone').innerHTML; const out = [];
                        if(/sc-rainbow/.test(h)) out.push('宝箱');
                        if(/fly-egg[^"]*egg-rainbow/.test(h)) out.push('飛ぶ卵');
                        if(/egg-slot[^"]*egg-rainbow/.test(h)) out.push('卵');
                        if(/gacha-flash[^"]*rainbow/.test(h)) out.push('光');
                        return out; }""")
                    if hits is None: break
                    seen.update(hits)
                    await pg.evaluate("""() => { const q = s => document.querySelector(s);
                        const el = q('[data-gacha-result]') || q('[data-gacha-skip]') || q('[data-egg-open]') || q('[data-chest-tap]');
                        if(el) el.click(); }""")
                await pg.evaluate("() => { closeModal(); gachaSeq = null; }")
                await pg.wait_for_timeout(250)
                return sorted(seen)

            no5 = []
            for _ in range(3):
                no5.append(await run([1,2,3,1,2,4,1,3,2,3], 'mon'))
            check('★5が出ない回は、どこにも虹が出ない', all(x == [] for x in no5), no5)
            with5 = []
            for _ in range(3):
                with5.append(await run([1,2,3,1,2,4,1,3,2,5], 'mon'))
            check('★5が出た回は必ず虹が出る', all(x for x in with5), with5)

            # 遺物は壺の★。★5の遺物でだけ虹になる
            check('遺物: ★4までは虹にならない', await run([1,2,3,4,4], 'relic') == [])
            check('遺物: ★5の壺は虹になる', bool(await run([1,2,3,4,5], 'relic')))

            check('JSエラーなし', not errs, errs[:3])
            await b.close()
    print('NG' if bad else 'すべて通過')
    return bad

sys.exit(asyncio.run(main()))
