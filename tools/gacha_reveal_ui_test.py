#!/usr/bin/env python3
"""ガチャ演出(10連)の検証: 勝手に進まない・タップで割る・まとめて開く・★4/★5の予兆とカットイン・スキップ。
使い方: CHROMIUM_PATH=/path/to/chrome python3 tools/gacha_reveal_ui_test.py"""
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

SETUP = """() => {
  clearGuideToast(); const gt = document.getElementById('guide-toast'); if(gt) gt.classList.remove('show');
  STATE.clearedStages = STAGES.map(s => s.id); STATE.announceQueue = []; saveState(); closeModal();
  const pick = r => MONSTERS.find(m => m.rarity === r);
  const before = { universal: STATE.universalSouls, points: STATE.summonPoints };
  const rs = [1, 2, 3, 3, 4, 2, 5, 3, 1, 2].map(r => pullOneForced(pick(r)));
  showGachaEggs(rs, before);
  gachaSeq.fake = rs.map(() => false);   // 卵の昇格(ランダム)はこのテストでは起こさない
}"""

async def wait_reveal(pg):
    for _ in range(60):
        if await pg.evaluate("() => gachaSeq && gachaSeq.phase") == 'reveal': return
        await pg.wait_for_timeout(100)

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
            await pg.evaluate(SETUP)
            ph = lambda: pg.evaluate("() => gachaSeq && gachaSeq.phase")
            check('召喚の演出から始まる', await ph() == 'summon')
            chest_cls = await pg.evaluate("() => [...document.querySelectorAll('.fly-egg')].map(e => e.className)")
            check('飛び出す卵はどれも同じ色(レア度がバレない)', all('egg-blue' in c and 'egg-rainbow' not in c and 'egg-gold' not in c for c in chest_cls))
            await wait_reveal(pg)
            check('卵が並んだら止まる', await ph() == 'reveal')
            await pg.wait_for_timeout(1500)
            check('演出中はBGMを小さくする', await pg.evaluate("() => bgm.duck") == 0.15)
            call = await pg.locator('.reveal-call').inner_text()
            check('卵が並ぶと大きく「タップして卵を割る!」', 'タップして卵を割る' in call, call)
            check('放っておいても勝手に割れない', await pg.evaluate("() => gachaSeq.open.every(o => !o)"))
            cls = await pg.evaluate("() => [...document.querySelectorAll('.reveal-grid .egg-slot')].map(e => e.className)")
            check('★4の卵は紫の予兆、★5の卵は金の予兆、ほかは予兆なし', 'hint4' in cls[4] and 'hint5' in cls[6] and not any('hint' in c for i, c in enumerate(cls) if i not in (4, 6)), cls)
            await pg.screenshot(path=str(OUT / 'gacha_1_eggs.png'))
            # 1つタップ
            await pg.evaluate("() => document.querySelectorAll('[data-egg-open]')[0].click()"); await pg.wait_for_timeout(1500)
            check('タップした卵だけが割れる', await pg.evaluate("() => gachaSeq.open.filter(Boolean).length === 1 && gachaSeq.open[0]"))
            # まとめて開く
            await pg.evaluate("() => document.querySelector('[data-gacha-openall]').click()"); await pg.wait_for_timeout(1600)
            opened = await pg.evaluate("() => gachaSeq.open")
            check('まとめて開くで★3以下が全部割れ、★4・★5は残る', opened == [True, True, True, True, False, True, False, True, True, True], opened)
            check('残りが大物だけになったら「まとめて開く」は消える', await pg.locator('[data-gacha-openall]').count() == 0)
            check('大物だけ残ると「残った卵をタップ!」', '残った卵をタップ' in await pg.locator('.reveal-call').inner_text())
            await pg.screenshot(path=str(OUT / 'gacha_2_left.png'))
            # ★4
            await pg.evaluate("() => document.querySelector('[data-egg-open=\"4\"]').click()"); await pg.wait_for_timeout(1400)
            check('★4は割れたあとカットイン', await ph() == 'rare')
            await pg.screenshot(path=str(OUT / 'gacha_3_rare.png'))
            await pg.wait_for_timeout(2200)
            check('★4のカットインは勝手に閉じない(タップ待ち)', await ph() == 'rare')
            await pg.evaluate("() => document.querySelector('[data-gacha-stage]').click()"); await pg.wait_for_timeout(300)
            check('タップで卵の画面に戻る', await ph() == 'reveal')
            # ★5
            await pg.evaluate("() => document.querySelector('[data-egg-open=\"6\"]').click()"); await pg.wait_for_timeout(500)
            check('★5は1段目: ヒビ(ほかの卵が暗くなり激しく揺れる)', await ph() == 'crack' and await pg.locator('.egg-slot.crack5').count() == 1)
            check('★5のヒビからはBGMを止めて静けさで溜める', await pg.evaluate("() => bgm.duck") == 0)
            await pg.screenshot(path=str(OUT / 'gacha_4_crack.png'))
            await pg.wait_for_timeout(1000)
            check('2段目: 暗転してシルエット', await ph() == 'silhouette' and await pg.locator('.sil-mon').count() == 1)
            await pg.screenshot(path=str(OUT / 'gacha_5_silhouette.png'))
            await pg.wait_for_timeout(1500)
            check('3段目: カットイン(★が刻まれ、紙吹雪)', await ph() == 'legend' and await pg.locator('.cut-stars span').count() == 5 and await pg.locator('.confetti i').count() > 20)
            await pg.wait_for_timeout(1500)
            await pg.screenshot(path=str(OUT / 'gacha_6_legend.png'))
            await pg.evaluate("() => document.querySelector('[data-gacha-stage]').click()"); await pg.wait_for_timeout(300)
            check('全部割れたら「結果を見る」', await pg.locator('[data-gacha-result]').count() == 1)
            check('カットインから戻るとBGMは小さい音に戻る', await pg.evaluate("() => bgm.duck") == 0.15)
            await pg.screenshot(path=str(OUT / 'gacha_7_all.png'))
            check('全部割れたら「タップして結果へ」に変わる', 'タップして結果へ' in await pg.locator('.reveal-call').inner_text())
            await pg.evaluate("() => { window.__flashes = 0; const o = gachaFlash; window.gachaFlash = k => { window.__flashes++; o(k); }; document.querySelector('[data-gacha-result]').click(); }")
            await pg.wait_for_timeout(200)
            check('結果へは白いフラッシュではなくフェードアウト', await pg.evaluate("() => window.__flashes === 0 && !!document.querySelector('.gacha-stage.fade-out')"))
            await pg.wait_for_timeout(700)
            check('結果画面はふわっと出る', await pg.locator('.gacha-result.fade-in-result').count() == 1)
            check('結果画面へ', await pg.locator('.gacha-result').count() == 1 and await pg.evaluate("() => !gachaSeq"))
            check('結果画面でBGMを元の大きさに戻す', await pg.evaluate("() => bgm.duck") == 1)
            # スキップ: ★5があればそのカットインだけ見せて結果へ
            await pg.evaluate(SETUP); await wait_reveal(pg)
            await pg.evaluate("() => document.querySelector('[data-gacha-skip]').click()"); await pg.wait_for_timeout(300)
            check('スキップすると★5のカットインだけ見せる', await ph() == 'legend')
            await pg.evaluate("() => document.querySelector('[data-gacha-stage]').click()"); await pg.wait_for_timeout(900)
            check('タップで結果画面へ', await pg.locator('.gacha-result').count() == 1)
            # 単発
            await pg.evaluate("() => { closeModal(); const before = { universal: STATE.universalSouls, points: STATE.summonPoints }; showGachaEggs([pullOneForced(MONSTERS.find(m => m.rarity === 2))], before); }")
            await wait_reveal(pg)
            check('単発には「まとめて開く」を出さない', await pg.locator('[data-gacha-openall]').count() == 0 and await pg.locator('[data-egg-open]').count() == 1)
            await pg.evaluate("() => document.querySelector('[data-egg-open]').click()"); await pg.wait_for_timeout(1400)
            check('単発もタップで割れて「結果を見る」', await pg.locator('[data-gacha-result]').count() == 1)
            await pg.evaluate("() => document.querySelector('.reveal-grid').click()"); await pg.wait_for_timeout(900)
            check('全部割れたら、結果を見るを押さなくても画面タップで結果へ', await pg.locator('.gacha-result').count() == 1)
            await pg.evaluate("() => closeModal()"); await pg.wait_for_timeout(200)
            await pg.mouse.click(30, 300); await pg.wait_for_timeout(120)
            check('どこをタップしても青いキラキラが出る', await pg.locator('.tap-fx .tap-star').count() >= 5)
            await pg.screenshot(path=str(OUT / 'gacha_12_tapfx.png'))
            await pg.wait_for_timeout(1200)
            check('キラキラはすぐ消える(残り続けない)', await pg.locator('.tap-fx').count() == 0)
            # --- 第2弾: 宝箱の色の予告と昇格 ---
            await pg.evaluate("""() => { closeModal(); const before = { universal: STATE.universalSouls, points: STATE.summonPoints };
              const pu = MON_BY_ID[currentBanner().pickup];
              const rs = [pullOneForced(pu), ...Array.from({ length: 9 }, () => pullOneForced(MONSTERS.find(m => m.rarity === 2)))];
              const R = Math.random; Math.random = () => 0; showGachaEggs(rs, before); Math.random = R; }""")
            steps = await pg.evaluate("() => gachaSeq.steps")
            check('ピックアップ★5なら宝箱は最後に虹色、低い色から昇格していく', steps[-1] == 'rainbow' and len(steps) >= 2, steps)
            check('最初は低い色', await pg.evaluate("() => document.querySelector('.chest-wrap').classList.contains('sc-' + gachaSeq.steps[0])"))
            await pg.wait_for_timeout(200)
            check('宝箱は上から落ちてくる', await pg.evaluate("() => getComputedStyle(document.querySelector('.chest')).animationName.includes('chest-drop')"))
            await pg.screenshot(path=str(OUT / 'gacha_8a_drop.png'))
            await pg.wait_for_timeout(400)
            await pg.screenshot(path=str(OUT / 'gacha_8b_land.png'))
            await pg.wait_for_timeout(350)
            await pg.screenshot(path=str(OUT / 'gacha_8_up.png'))
            check('昇格が終わるまで宝箱のフタは開かない', await pg.evaluate("() => getComputedStyle(document.querySelector('.chest-lid')).transform === 'none' || getComputedStyle(document.querySelector('.chest-lid')).transform === 'matrix(1, 0, 0, 1, 0, 0)'"))
            check('昇格すると色が変わり UP! が出る', await pg.evaluate("() => document.querySelector('.chest-wrap').classList.contains('sc-' + gachaSeq.steps[1]) && document.querySelector('.summon-up.show') !== null"))
            await wait_reveal(pg)
            check('ピックアップの★5の卵は(昇格なしなら)金の予兆', 'hint' in await pg.evaluate("() => document.querySelectorAll('.reveal-grid .egg-slot')[0].className"))
            await pg.evaluate("() => { gachaSeq.fake[0] = false; document.querySelector('[data-egg-open=\"0\"]').click(); }")
            await pg.wait_for_timeout(2600)
            check('ピックアップ★5は虹色の専用カットインと流れる帯', await pg.evaluate("() => gachaSeq.phase === 'legend' && !!document.querySelector('.cut-stage.legend.pickup .pickup-band')"))
            await pg.wait_for_timeout(1400)
            await pg.screenshot(path=str(OUT / 'gacha_9_pickup.png'))
            # 卵の昇格: 紫の予兆の★5
            await pg.evaluate(SETUP); await pg.evaluate("() => { gachaSeq.fake[6] = true; }"); await wait_reveal(pg)
            c6 = await pg.evaluate("() => document.querySelectorAll('.reveal-grid .egg-slot')[6].className")
            check('昇格する★5の卵は紫の予兆で並ぶ(★4と見分けがつかない)', 'hint4' in c6 and 'hint5' not in c6, c6)
            await pg.evaluate("() => document.querySelector('[data-egg-open=\"6\"]').click()"); await pg.wait_for_timeout(300)
            check('割ると紫→金に昇格するヒビ演出', await pg.locator('.egg-slot.crack5.crack-up').count() == 1)
            await pg.wait_for_timeout(450)
            await pg.screenshot(path=str(OUT / 'gacha_10_crackup.png'))
            # 宝箱は本当の結果より上の色にならない(★3以下なら必ず青)
            low = await pg.evaluate("""() => { closeModal(); const out = new Set(); const before = { universal: STATE.universalSouls, points: STATE.summonPoints };
              const rs = Array.from({ length: 10 }, () => pullOneForced(MONSTERS.find(m => m.rarity === 3)));
              for(let k = 0; k < 30; k++) summonSteps('mon', rs).forEach(c => out.add(c)); return [...out]; }""")
            check('★3以下しかなければ宝箱は必ず青', low == ['blue'], low)
            # --- 遺物ガチャ(壺)も同じ演出 ---
            info = await pg.evaluate("""() => { closeModal();
              const ex = exclusiveRelicForMon(currentBanner().pickup);
              const by = st => Object.values(RELICS).find(d => d.star === st && d !== ex);
              const rs = [ex, by(1), by(2), by(4), by(3), by(1), by(2), by(3), by(2), by(1)].map(def => ({ def, isNew: true, resonance: 0 }));
              const R = Math.random; Math.random = () => 0; showGachaEggs(rs, null, 'relic'); Math.random = R; gachaSeq.fake = rs.map(() => false);
              return { star: ex && ex.star, steps: gachaSeq.steps }; }""")
            check('遺物ガチャも宝箱が降ってきて、専用遺物(★5)なら最後は虹色', info['star'] != 5 or info['steps'][-1] == 'rainbow', info)
            await wait_reveal(pg)
            check('遺物ガチャは「壺」と表示し、タップ待ちで止まる', '壺' in await pg.locator('.reveal-sub').inner_text() and 'タップして壺を割る' in await pg.locator('.reveal-call').inner_text() and await pg.evaluate("() => gachaSeq.open.every(o => !o) && document.querySelectorAll('.jar-svg').length === 10"))
            await pg.evaluate("() => document.querySelector('[data-gacha-openall]').click()"); await pg.wait_for_timeout(1500)
            check('遺物ガチャもまとめて開くで★4以上の壺が残る', await pg.evaluate("() => gachaSeq.open.filter(o => !o).length === 2"))
            await pg.evaluate("() => document.querySelector('[data-egg-open=\"0\"]').click()"); await pg.wait_for_timeout(2700)
            if info['star'] == 5:
                check('専用遺物は虹色の専用カットイン', await pg.evaluate("() => gachaSeq.phase === 'legend' && !!document.querySelector('.cut-stage.legend.pickup .pickup-band')"))
                await pg.wait_for_timeout(1300)
                await pg.screenshot(path=str(OUT / 'gacha_11_relic_pickup.png'))
            check('JSエラーなし', not errs, errs[:3])
            await b.close()
    print('NG' if bad else 'すべて通過')
    return bad
sys.exit(asyncio.run(main()))
