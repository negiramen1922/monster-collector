#!/usr/bin/env python3
"""ログイン・アカウント・クラウドセーブの検証。

本番のFirebaseには接続せず、mock_auth.js の偽バックエンドを add_init_script で差し込んで、
タイトル画面 → 各ログイン方法 → 自動ログイン → 引き継ぎ → 端末間同期 までを通しで確認する。

使い方: CHROMIUM_PATH=/path/to/chrome python3 auth_test.py
"""
import asyncio, json, os, pathlib, re
from playwright.async_api import async_playwright
from _serve import serve

HERE = pathlib.Path(__file__).resolve().parent
MOCK = (HERE / 'mock_auth.js').read_text(encoding='utf-8')
LAUNCH = {'executable_path': os.environ['CHROMIUM_PATH']} if os.environ.get('CHROMIUM_PATH') else {}
ID_RE = re.compile(r'^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$')

BATTLE_SETUP = """() => {
  STATE.clearedStages = STAGES.map(s => s.id); STATE.stamina = 999;
  ['m05','m15','m22','m57','m19'].forEach(id => STATE.owned[id] = { ...newOwned(MON_BY_ID[id]), star:4, level:60, wall:60 });
  STATE.slots = ['m05','m15','m22','m57','m19'];
  startBattle('q1_01', { skipIntro: true });
}"""

bad = 0
def check(name, cond, info=''):
    global bad
    bad += 0 if cond else 1
    print(('✅' if cond else '❌') + f' {name}' + (f'  {info}' if info != '' else ''))


async def device(browser, url, seed=None, mock=True):
    ctx = await browser.new_context(viewport={'width': 375, 'height': 667})
    if mock:
        if seed is not None:
            await ctx.add_init_script(f'window.__mockCloudSeed = {json.dumps(seed)};')
        await ctx.add_init_script(MOCK)
    pg = await ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(url)
    await pg.wait_for_timeout(900)
    return ctx, pg, errs


async def acct(pg):
    return await pg.evaluate("() => ACCOUNT && { ...ACCOUNT }")


async def set_crystals(pg, n):
    # ゲーム内の変更と同じ経路: saveState() が savedAt を更新し、flushSave() が即書き込む
    await pg.evaluate(f"async () => {{ STATE.crystals = {n}; saveState(); await flushSave(); }}")
    await pg.wait_for_timeout(300)


async def main():
    with serve() as url:
        async with async_playwright() as p:
            browser = await p.chromium.launch(**LAUNCH)

            # ---- 端末A: はじめての人 ----
            ctxA, a, errsA = await device(browser, url)
            check('初回はタイトル画面が出る', await a.evaluate("() => !!document.getElementById('title')"))
            labels = await a.evaluate("() => [...document.querySelectorAll('[data-auth]')].map(b => b.dataset.auth)")
            check('3つの入口がある', {'google', 'email-form', 'guest'} <= set(labels), str(labels))
            await a.screenshot(path=str(HERE / 'auth_title.png'))

            # ゲストで開始
            await a.click('[data-auth="guest"]')
            await a.wait_for_timeout(900)
            g = await acct(a)
            check('ゲストで開始できる', g and g['provider'] == 'guest' and await a.evaluate("() => !!document.getElementById('nav')"))
            check('プレイヤーIDが割り振られる', bool(g and ID_RE.match(g['playerId'])), g['playerId'] if g else '-')
            check('ホームにアカウント欄が出る', await a.evaluate("() => !!document.querySelector('[data-open-account]')"))

            # 保存 → 再読み込みで自動ログイン
            await set_crystals(a, 777)
            await a.reload()
            await a.wait_for_timeout(1200)
            g2 = await acct(a)
            check('再訪時は自動ログインしてゲームが始まる',
                  await a.evaluate("() => !document.getElementById('title') && !!document.getElementById('nav')"))
            check('進行状況が残る', await a.evaluate("() => STATE.crystals") == 777)
            check('IDは変わらない', g2 and g2['playerId'] == g['playerId'], g2['playerId'] if g2 else '-')

            # ゲスト → メールアドレスに引き継ぎ
            await a.click('[data-open-account]')
            await a.wait_for_timeout(300)
            check('アカウント画面にIDが出る',
                  (await a.inner_text('.acct-id')).strip() == g['playerId'])
            await a.screenshot(path=str(HERE / 'auth_account.png'))
            await a.click('[data-account="link-email-form"]')
            await a.fill('#link-email', 'tamer@example.com')
            await a.fill('#link-pass', 'secret123')
            await a.click('[data-account="link-email-go"]')
            await a.wait_for_timeout(600)
            g3 = await acct(a)
            check('メールアドレスに引き継げる', g3 and g3['provider'] == 'email' and g3['email'] == 'tamer@example.com')
            check('引き継いでもIDと進行状況はそのまま',
                  g3['playerId'] == g['playerId'] and await a.evaluate("() => STATE.crystals") == 777)

            await set_crystals(a, 888)
            saved = await a.evaluate("() => window.__mockCloud().saves")
            check('クラウドに保存される', any(json.loads(v['data'])['crystals'] == 888 for v in saved.values()))

            # ログアウト → タイトルに戻る
            await a.click('[data-account="logout"]')
            await a.wait_for_timeout(200)
            await a.click('[data-account="logout-yes"]')
            await a.wait_for_timeout(600)
            check('ログアウトでタイトルに戻る',
                  await a.evaluate("() => !!document.getElementById('title') && !ACCOUNT"))

            # メールでログインし直す
            await a.click('[data-auth="email-form"]')
            await a.fill('#auth-email', 'tamer@example.com')
            await a.fill('#auth-pass', 'secret123')
            await a.click('[data-auth="email-in"]')
            await a.wait_for_timeout(1000)
            g4 = await acct(a)
            check('メールでログインし直せる', g4 and g4['provider'] == 'email' and g4['playerId'] == g['playerId'])
            check('データが戻る', await a.evaluate("() => STATE.crystals") == 888)

            # 間違ったパスワード
            await a.evaluate("async () => { await signOutAccount(); appPhase='title'; titleView='email'; renderTitle(); }")
            await a.fill('#auth-email', 'tamer@example.com')
            await a.fill('#auth-pass', 'wrongpass')
            await a.click('[data-auth="email-in"]')
            await a.wait_for_timeout(500)
            msg = (await a.inner_text('.title-msg')).strip()
            check('パスワード違いはメッセージが出る', 'パスワード' in msg or '違い' in msg, msg)
            await a.fill('#auth-pass', 'secret123')     # 正しいパスワードで入り直す
            await a.click('[data-auth="email-in"]')
            await a.wait_for_timeout(1000)
            check('入り直せる', await a.evaluate("() => !!ACCOUNT && STATE.crystals") == 888)

            # ---- 端末B: 同じアカウントで別端末 ----
            cloud = await a.evaluate("() => window.__mockCloud()")
            ctxB, b, errsB = await device(browser, url, seed=cloud)
            check('端末Bは最初タイトル画面', await b.evaluate("() => !!document.getElementById('title')"))
            await b.click('[data-auth="email-form"]')
            await b.fill('#auth-email', 'tamer@example.com')
            await b.fill('#auth-pass', 'secret123')
            await b.click('[data-auth="email-in"]')
            await b.wait_for_timeout(1200)
            gb = await acct(b)
            check('端末Bでも同じID', gb and gb['playerId'] == g['playerId'], gb['playerId'] if gb else '-')
            check('端末Bにデータが引き継がれる', await b.evaluate("() => STATE.crystals") == 888)

            # 端末Bで進めて、端末Aに戻る
            await set_crystals(b, 999)
            cloud2 = await b.evaluate("() => window.__mockCloud()")
            await a.evaluate("c => localStorage.setItem('__mockCloud', JSON.stringify(c))", cloud2)
            await a.reload()
            await a.wait_for_timeout(1400)
            check('端末Aに戻ると新しい方が読まれる', await a.evaluate("() => STATE.crystals") == 999,
                  str(await a.evaluate("() => STATE.crystals")))
            check('上書きされた端末のデータは控えが残る',
                  await a.evaluate("() => !!localStorage.getItem(`monster-game-state:${ACCOUNT.uid}:backup`)"))

            check('JSエラーなし(端末A)', not errsA, f'{len(errsA)}件 {errsA[:3]}')
            check('JSエラーなし(端末B)', not errsB, f'{len(errsB)}件 {errsB[:3]}')

            # ---- Googleログイン(モック) ----
            ctxG, gpg, errsG = await device(browser, url)
            await gpg.click('[data-auth="google"]')
            await gpg.wait_for_timeout(1200)
            gg = await acct(gpg)
            check('Googleでログインできる', gg and gg['provider'] == 'google' and gg['name'] == 'グーグル太郎', str(gg and gg['name']))
            check('GoogleアカウントにもIDが割り振られる', bool(gg and ID_RE.match(gg['playerId'])), gg['playerId'] if gg else '-')
            ids = await gpg.evaluate("() => window.__mockCloud().ids")
            check('IDがフレンドコード表として登録される', ids.get(gg['playerId']) == gg['uid'], str(ids))
            profiles = await gpg.evaluate("() => window.__mockCloud().players")
            check('公開プロフィールが作られる', gg['uid'] in profiles and profiles[gg['uid']]['playerId'] == gg['playerId'])
            check('JSエラーなし(Google)', not errsG, f'{len(errsG)}件 {errsG[:3]}')

            # ---- アナリティクス ----
            ctxA2, an, errsAn = await device(browser, url)
            await an.click('[data-auth="guest"]')
            await an.wait_for_timeout(1000)
            names = [e[0] for e in await an.evaluate("() => window.__events")]
            check('ログインが記録される', 'login' in names, str(names))
            check('新規プレイヤーが記録される', 'game_start' in names, str(names))
            check('ユーザーが紐づく', bool(await an.evaluate("() => window.__gaUser")),
                  str(await an.evaluate("() => window.__gaUser")))
            await an.evaluate("() => { goto('gacha'); render(); }")
            await an.evaluate("() => doPull(1, PULL_COST)")
            await an.wait_for_timeout(400)
            await an.evaluate(BATTLE_SETUP)
            await an.wait_for_timeout(600)
            await an.evaluate("() => finishBattle(true)")
            await an.wait_for_timeout(400)
            events = await an.evaluate("() => window.__events")
            names = [e[0] for e in events]
            check('画面遷移が記録される', 'screen_view' in names)
            check('ガチャが記録される', 'gacha_pull' in names,
                  str([e[1] for e in events if e[0] == 'gacha_pull']))
            check('ステージの開始と結果が記録される', 'stage_start' in names and 'stage_clear' in names,
                  str([e[1] for e in events if e[0] in ('stage_start', 'stage_clear')]))
            check('JSエラーなし(アナリティクス)', not errsAn, f'{len(errsAn)}件 {errsAn[:3]}')

            # ---- Firebaseに届かないとき(このサンドボックスは外へ出られない) ----
            ctxC, c, errsC = await device(browser, url, mock=False)
            await c.wait_for_timeout(2500)
            check('接続できなくてもタイトルは出る', await c.evaluate("() => !!document.getElementById('title')"))
            await c.click('[data-auth="guest"]')
            await c.wait_for_timeout(2500)
            cmsg = (await c.inner_text('.title-msg')).strip()
            check('接続できないログインは理由が出る', 'ネットワーク' in cmsg, cmsg)

            await browser.close()
    raise SystemExit(1 if bad else 0)

asyncio.run(main())
