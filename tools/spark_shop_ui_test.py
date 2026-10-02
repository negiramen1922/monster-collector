"""召喚ポイントショップと、ショップの個数選び・提供割合/最近の結果のモーダル。
   使い方: CHROMIUM_PATH=/opt/pw-browsers/chromium python3 tools/spark_shop_ui_test.py"""
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
            pg = await b.new_page(viewport={'width': 420, 'height': 1100})
            await use_mock_auth(pg); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.add_init_script("""(() => { const R=Date; const T=new R('2026-10-02T12:00:00+09:00').getTime();
              const d0=R.now(); function F(...a){ return a.length? new R(...a) : new R(T+(R.now()-d0)); }
              F.now=()=>T+(R.now()-d0); F.parse=R.parse; F.UTC=R.UTC; F.prototype=R.prototype; window.Date=F; })()""")
            await pg.goto(url); await pg.wait_for_timeout(1000)
            await start_as_guest(pg)
            await pg.evaluate("""() => { clearGuideToast(); closeModal && closeModal(); STATE.announceQueue = [];
              STATE.summonPoints = 450; gachaBannerKey = 'ev_kyubi'; goto('gacha'); render(); }""")
            await pg.wait_for_timeout(400)

            # ガチャ画面: 天井のワンタップが消え、交換するボタンになっている
            txt = await pg.evaluate("() => document.body.innerText")
            check('天井のワンタップ交換が無くなった', 'ポイントで「' not in txt, [l for l in txt.split('\n') if 'ポイント' in l][:3])
            check('「交換する」ボタンがある', await pg.locator('[data-open-spark-shop]').count() >= 1)
            check('排出率/かぶりの長い説明文が無い', '無形のソウル　出たモンスターの初期★' not in txt and 'かぶり' not in txt)
            check('提供割合ボタンがある', await pg.locator('[data-open-rates]').count() == 1)
            check('最近の結果ボタンがある', await pg.locator('[data-open-recent]').count() == 1)

            # 提供割合モーダル
            await pg.locator('[data-open-rates]').click(); await pg.wait_for_timeout(300)
            mt = await pg.inner_text('.result-modal')
            check('提供割合がモーダルで出る', '提供割合' in mt and '★5' in mt, mt.split('\n')[0])
            check('ピックアップの率が出る', 'ピックアップ★5' in mt)
            await pg.locator('#close-result').click(); await pg.wait_for_timeout(250)

            # 最近の結果モーダル
            await pg.locator('[data-open-recent]').click(); await pg.wait_for_timeout(300)
            check('最近の結果がモーダルで出る', '最近の結果' in await pg.inner_text('.result-modal'))
            await pg.locator('#close-result').click(); await pg.wait_for_timeout(250)

            # 召喚ポイントショップ
            await pg.locator('[data-open-spark-shop]').first.click(); await pg.wait_for_timeout(400)
            st = await pg.inner_text('.ov-screen')
            check('召喚ポイントショップが開く', '召喚ポイントショップ' in st, st.split('\n')[0:2])
            check('所持ポイントが出る', '450' in st)
            rows = await pg.locator('[data-spark-buy]').count()
            check('ピックアップのキャラと遺物が並ぶ', rows == 2, rows)
            check('九尾の狐が並んでいる', '九尾の狐' in st)

            # 個数の±。遺物は100ptなので450で4個まで
            relic = pg.locator('.spark-card').nth(1)
            check('個数の±が出る(−10・−・＋・＋10・最大)', await relic.locator('[data-shop-qty]').count() == 5, await relic.locator('[data-shop-qty]').count())
            mx = await relic.locator('[data-shop-qty$=":max"]').inner_text()
            check('最大が買える個数になっている(450÷100=4)', '4' in mx, mx)
            await relic.locator('[data-shop-qty$=":max"]').click(); await pg.wait_for_timeout(300)
            tot = await pg.locator('.spark-card').nth(1).locator('.shop-total').inner_text()
            check('合計の消費ポイントが出る', '400' in tot and '50' in tot, tot)
            btn = await pg.locator('.spark-card').nth(1).locator('[data-spark-buy]').inner_text()
            check('ボタンにも合計が出る', '400' in btn, btn)

            # 実際に交換する
            before = await pg.evaluate("() => STATE.summonPoints")
            await pg.locator('.spark-card').nth(1).locator('[data-spark-buy]').click(); await pg.wait_for_timeout(500)
            after = await pg.evaluate("() => STATE.summonPoints")
            check('4個ぶん(400pt)引かれた', before - after == 400, [before, after])
            check('個数は1に戻る', await pg.evaluate("() => shopQty['spark:relic']") == 1)

            # イベントショップの個数選び
            await pg.evaluate("""() => { closeOverlay(); addItem('medal_ev_kyubi', 5000); goto('shop'); shopTab='ev:ev_kyubi'; render(); }""")
            await pg.wait_for_timeout(400)
            n = await pg.locator('.shop-qty').count()
            check('イベントショップにも個数の±が出る', n >= 1, n)
            if n:
                first = pg.locator('.shop-qty').first
                await first.locator('[data-shop-qty$=":1"]').click(); await pg.wait_for_timeout(300)
                t2 = await pg.locator('.shop-total').first.inner_text()
                check('＋で合計メダルが増える', '→ 残り' in t2, t2)

            check('JSエラーなし', not errs, errs[:3])
            await pg.screenshot(path='/tmp/claude-0/-home-user-monster-collector/07e3a820-f360-57bd-8a3f-3072a7fc0146/scratchpad/shop_qty.png')
            await b.close()
    sys.exit(1 if bad else 0)

asyncio.run(main())
