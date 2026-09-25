#!/usr/bin/env python3
"""ガチャ結果のSNS共有ボタンの検証。

- モンスター/遺物ガチャの結果画面に共有ボタンがある
- 共有すると結晶+10、同じ日の2回目はもらえない、日付が変わるとまたもらえる
- 共有シートをキャンセルしたら報酬なし
- 共有シートが無い端末ではXの投稿画面を開く

使い方: CHROMIUM_PATH=/path/to/chrome python3 tools/share_test.py
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
            await pg.add_init_script("""() => {}""")
            await pg.goto(url); await pg.wait_for_timeout(900)
            await start_as_guest(pg)
            # 共有シートあり(成功)の端末
            await pg.evaluate("""() => {
              window.__shared = []; navigator.share = async d => { window.__shared.push(d); if(window.__cancelShare) throw Object.assign(new Error('x'), { name: 'AbortError' }); };
              STATE.clearedStages = STAGES.map(s => s.id); STATE.crystals = 5000; saveState();
              const before = { universal: STATE.universalSouls, points: STATE.summonPoints };
              const res = [pullOne(1), pullOne(1)]; showGachaResults(res, before);
            }""")
            await pg.wait_for_timeout(300)
            check('ガチャ結果に共有ボタン', await pg.locator('[data-gacha-share]').count() == 1)
            await pg.screenshot(path=str(OUT / 'share_result.png'))
            await pg.evaluate("() => { window.__cancelShare = true; }")
            c0 = await pg.evaluate('() => STATE.crystals')
            await pg.locator('[data-gacha-share]').click(); await pg.wait_for_timeout(300)
            check('キャンセルしたら報酬なし', await pg.evaluate('() => STATE.crystals') == c0)
            await pg.evaluate("() => { window.__cancelShare = false; }")
            await pg.locator('[data-gacha-share]').click(); await pg.wait_for_timeout(300)
            check('共有すると結晶+10', await pg.evaluate('() => STATE.crystals') == c0 + 10)
            shared = await pg.evaluate('() => window.__shared[window.__shared.length - 1]')
            check('共有文にキャラ名とハッシュタグ・URLが入る', '#モンコレ' in shared['text'] and '★' in shared['text'] and shared['url'].startswith('https://'), shared)
            await pg.locator('[data-gacha-share]').click(); await pg.wait_for_timeout(300)
            check('同じ日の2回目はもらえない', await pg.evaluate('() => STATE.crystals') == c0 + 10)
            check('ボタンが受け取り済みの表示になる', '受け取り済み' in await pg.locator('[data-gacha-share]').inner_text())
            await pg.evaluate("() => { STATE.shareDaily = { key: 'old-day' }; }")
            await pg.evaluate("""() => { const r = [pullRelicOne()]; showRelicGachaFinalResult(r); }""")
            await pg.wait_for_timeout(300)
            check('遺物ガチャの結果にも共有ボタン', await pg.locator('[data-gacha-share]').count() == 1)
            await pg.locator('[data-gacha-share]').click(); await pg.wait_for_timeout(300)
            check('日付が変わるとまたもらえる', await pg.evaluate('() => STATE.crystals') == c0 + 20)
            # 共有シートが無い端末: Xの投稿画面
            await pg.evaluate("""() => { delete navigator.share; Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
              window.__opened = []; window.open = u => { window.__opened.push(u); return {}; };
              STATE.shareDaily = null; showGachaResults([pullOne(1)], { universal: STATE.universalSouls, points: STATE.summonPoints }); }""")
            await pg.wait_for_timeout(200)
            await pg.locator('[data-gacha-share]').click(); await pg.wait_for_timeout(300)
            opened = await pg.evaluate('() => window.__opened')
            check('共有シートが無い端末ではXの投稿画面を開き、報酬が入る', opened and 'x.com/intent/post' in opened[0] and await pg.evaluate('() => STATE.crystals') == c0 + 30, opened[:1])
            check('JSエラーなし', not errs, errs[:3])
            await b.close()
    print('NG' if bad else 'すべて通過')
    return bad
sys.exit(asyncio.run(main()))
