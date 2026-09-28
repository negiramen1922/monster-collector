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
              navigator.canShare = d => !!(d && d.files);
              STATE.clearedStages = STAGES.map(s => s.id); STATE.crystals = 5000; saveState();
              const before = { universal: STATE.universalSouls, points: STATE.summonPoints };
              const res = Array.from({ length: 10 }, () => pullOne(1)); showGachaResults(res, before);
            }""")
            await pg.wait_for_timeout(800)
            check('ガチャ結果に共有ボタン', await pg.locator('[data-gacha-share]').count() == 1)
            await pg.screenshot(path=str(OUT / 'share_result.png'))
            await pg.evaluate("() => { window.__cancelShare = true; }")
            c0 = await pg.evaluate('() => STATE.crystals')
            await pg.evaluate("() => document.querySelector('[data-gacha-share]').click()"); await pg.wait_for_timeout(300)
            check('キャンセルしたら報酬なし', await pg.evaluate('() => STATE.crystals') == c0)
            await pg.evaluate("() => { window.__cancelShare = false; }")
            await pg.evaluate("() => document.querySelector('[data-gacha-share]').click()"); await pg.wait_for_timeout(300)
            check('共有すると結晶+10', await pg.evaluate('() => STATE.crystals') == c0 + 10)
            shared = await pg.evaluate('() => window.__shared[window.__shared.length - 1]')
            check('共有文にキャラ名とハッシュタグ・URLが入る', '#モンコレ' in shared['text'] and '★' in shared['text'] and 'https://' in shared['text'], shared.get('text'))
            img = await pg.evaluate('''async () => { const d = window.__shared[window.__shared.length - 1]; const f = d.files && d.files[0]; if(!f) return null;
              const url = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); });
              const im = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = url; }); return { type: f.type, w: im.width, h: im.height, url }; }''')
            check('10連の結果が画像(PNG)として添付される', img and img['type'] == 'image/png' and img['w'] == 1080 and img['h'] > 700, img and {k: img[k] for k in ('type', 'w', 'h')})
            if img:
                import base64
                (OUT / 'share_image_10.png').write_bytes(base64.b64decode(img['url'].split(',', 1)[1]))
            await pg.evaluate("() => document.querySelector('[data-gacha-share]').click()"); await pg.wait_for_timeout(300)
            check('同じ日の2回目はもらえない', await pg.evaluate('() => STATE.crystals') == c0 + 10)
            check('ボタンが受け取り済みの表示になる', '受け取り済み' in await pg.locator('[data-gacha-share]').inner_text())
            await pg.evaluate("() => { STATE.shareDaily = { key: 'old-day' }; }")
            await pg.evaluate("""() => { const r = Array.from({ length: 10 }, () => pullRelicOne()); showRelicGachaFinalResult(r); }""")
            await pg.wait_for_timeout(800)
            check('遺物ガチャの結果にも共有ボタン', await pg.locator('[data-gacha-share]').count() == 1)
            await pg.evaluate("() => document.querySelector('[data-gacha-share]').click()"); await pg.wait_for_timeout(300)
            check('日付が変わるとまたもらえる', await pg.evaluate('() => STATE.crystals') == c0 + 20)
            rimg = await pg.evaluate('''async () => { const d = window.__shared[window.__shared.length - 1]; const f = d.files && d.files[0]; if(!f) return null;
              return await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); }); }''')
            check('遺物ガチャの結果も画像つきで共有', bool(rimg))
            if rimg:
                import base64
                (OUT / 'share_image_relic.png').write_bytes(base64.b64decode(rimg.split(',', 1)[1]))
            # 共有シートが無い端末: Xの投稿画面
            await pg.evaluate("""() => { delete navigator.share; Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
              window.__opened = []; window.open = u => { window.__opened.push(u); return {}; };
              window.__downloads = []; const oc = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function(){ if(this.download) window.__downloads.push(this.download); else oc.call(this); };
              STATE.shareDaily = null; showGachaResults([pullOne(1)], { universal: STATE.universalSouls, points: STATE.summonPoints }); }""")
            await pg.wait_for_timeout(700)
            await pg.evaluate("() => document.querySelector('[data-gacha-share]').click()"); await pg.wait_for_timeout(300)
            check('画像を添付できないPCでは結果画像を保存してから投稿画面を開く', await pg.evaluate('() => window.__downloads.length') == 1)
            opened = await pg.evaluate('() => window.__opened')
            check('共有シートが無い端末ではXの投稿画面を開き、報酬が入る', opened and 'x.com/intent/post' in opened[0] and await pg.evaluate('() => STATE.crystals') == c0 + 30, opened[:1])
            check('JSエラーなし', not errs, errs[:3])
            await b.close()
    print('NG' if bad else 'すべて通過')
    return bad
sys.exit(asyncio.run(main()))
