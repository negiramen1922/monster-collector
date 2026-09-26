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
}"""

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
            await pg.wait_for_timeout(2300)
            check('卵が並んだら止まる', await ph() == 'reveal')
            await pg.wait_for_timeout(1500)
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
            await pg.screenshot(path=str(OUT / 'gacha_7_all.png'))
            await pg.evaluate("() => document.querySelector('[data-gacha-result]').click()"); await pg.wait_for_timeout(900)
            check('結果画面へ', await pg.locator('.gacha-result').count() == 1 and await pg.evaluate("() => !gachaSeq"))
            # スキップ: ★5があればそのカットインだけ見せて結果へ
            await pg.evaluate(SETUP); await pg.wait_for_timeout(2300)
            await pg.evaluate("() => document.querySelector('[data-gacha-skip]').click()"); await pg.wait_for_timeout(300)
            check('スキップすると★5のカットインだけ見せる', await ph() == 'legend')
            await pg.evaluate("() => document.querySelector('[data-gacha-stage]').click()"); await pg.wait_for_timeout(900)
            check('タップで結果画面へ', await pg.locator('.gacha-result').count() == 1)
            # 単発
            await pg.evaluate("() => { closeModal(); const before = { universal: STATE.universalSouls, points: STATE.summonPoints }; showGachaEggs([pullOneForced(MONSTERS.find(m => m.rarity === 2))], before); }")
            await pg.wait_for_timeout(2300)
            check('単発には「まとめて開く」を出さない', await pg.locator('[data-gacha-openall]').count() == 0 and await pg.locator('[data-egg-open]').count() == 1)
            await pg.evaluate("() => document.querySelector('[data-egg-open]').click()"); await pg.wait_for_timeout(1400)
            check('単発もタップで割れて「結果を見る」', await pg.locator('[data-gacha-result]').count() == 1)
            check('JSエラーなし', not errs, errs[:3])
            await b.close()
    print('NG' if bad else 'すべて通過')
    return bad
sys.exit(asyncio.run(main()))
