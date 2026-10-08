#!/usr/bin/env python3
"""モンスターの名前付けと通報(α0.5.002)を、実際の画面で確かめる。
名前付け: 入力・8文字・NG・保存・編成/戦闘に出る・お助け/PVPのスナップショットに載る・受け取り側の検査。
通報: 送る・確認・1日の上限・伏せ字・設定から戻す・moderation(運営の対処)の適用。
プレイヤー名・自己紹介の NG チェックも見る。スマホ幅(390px)で横にはみ出さないこと。

mock_auth.js にはフレンド/PVP用の関数が無いので、ここでテスト用の偽プレイヤーを差し込む。
使い方: CHROMIUM_PATH=/path/to/chrome python3 tools/nick_ui_test.py
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

FAKE = """() => {
  const now = Date.now();
  const P = {
    'u-a': { playerId: 'AAAA-AAAA-AAAA', name: 'ひよこテイマー', level: 12, bio: 'よろしくね', updatedAt: now,
             support: { id: 'm54', nick: 'かしたこ', star: 3, level: 10, skillLv: 1, ultLv: 1, passiveLv: 1 } },
    'u-b': { playerId: 'BBBB-BBBB-BBBB', name: 'わるもの', level: 30, bio: 'あいさつ', updatedAt: now,
             support: { id: 'm06', nick: 'ﾁ ﾝ ｺ', star: 3, level: 10 } },
    'u-c': { playerId: 'CCCC-CCCC-CCCC', name: 'ながい', level: 3, updatedAt: now,
             support: { id: 'm21', nick: '123456789', star: 2, level: 5 } },
  };
  const withUid = uid => ({ uid, ...P[uid] });
  Object.assign(window.__authBackend, {
    async lookupPlayer(code){ const uid = Object.keys(P).find(u => P[u].playerId === code); return uid ? withUid(uid) : null; },
    async fetchProfiles(uids){ return uids.filter(u => P[u]).map(withUid); },
    async fetchIncoming(){ return []; }, async recordIncomingFriend(){}, async removeIncoming(){},
    async searchPlayersByName(){ return []; }, async fetchRandomPlayers(){ return []; }, async fetchGifts(){ return []; },
    async fetchPvpOpponents(){ return [{ uid: 'u-p', playerId: 'PPPP-PPPP-PPPP', name: 'PVPの相手', level: 20, rand: 0.5,
      defense: { formationKey: STATE.formationKey, slots: [{ id: 'm06', nick: 'ぼうえい', star: 3, level: 10 }, { id: 'm21', nick: 'fuck', star: 2, level: 8 }, null, null, null] } }]; },
  });
}"""

async def overflow(pg):
    return await pg.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")

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
            await pg.evaluate(FAKE)
            uid = await pg.evaluate("""() => { clearGuideToast(); STATE.announceQueue = [];
              STATE.clearedStages = STAGES.map(s => s.id); STATE.guidesSeen = Object.fromEntries(Object.keys(STATE.guidesSeen || {}).map(k => [k, true]));
              saveState(); return ACCOUNT.uid; }""")
            toast = lambda: pg.evaluate("() => document.getElementById('toast').textContent")

            # ---------- 名前付け ----------
            await pg.evaluate("() => showMonsterDetail('m06')"); await pg.wait_for_timeout(250)
            species = await pg.evaluate("() => MON_BY_ID.m06.name")
            check('詳細に「名前を付ける」ボタン', await pg.locator('[data-nick-edit="m06"]').count() == 1)
            await pg.locator('[data-nick-edit="m06"]').click(); await pg.wait_for_timeout(150)
            check('押すと入力欄', await pg.locator('#nick-input').count() == 1)
            await pg.locator('#nick-input').fill('123456789')
            check('文字数を出す(9/8)', (await pg.locator('#nick-count').inner_text()) == '9/8')
            await pg.locator('[data-nick-save="m06"]').click(); await pg.wait_for_timeout(150)
            hint = await pg.locator('#nick-hint').inner_text()
            check('9文字は保存できず理由が出る', '8文字' in hint and not await pg.evaluate("() => STATE.owned.m06.nick"), hint)
            await pg.locator('#nick-input').fill('チ ン コ')
            await pg.locator('[data-nick-save="m06"]').click(); await pg.wait_for_timeout(150)
            hint = await pg.locator('#nick-hint').inner_text()
            check('NGワードは保存できず理由が出る', '使えない言葉' in hint and not await pg.evaluate("() => STATE.owned.m06.nick"), hint)
            await pg.locator('#nick-input').fill('  ぴよ丸 ')
            await pg.locator('#nick-input').press('Enter'); await pg.wait_for_timeout(250)
            check('Enterで保存(前後の空白は削る)', await pg.evaluate("() => STATE.owned.m06.nick") == 'ぴよ丸')
            name = await pg.locator('.detail-modal .detail-name').inner_text()
            sp = await pg.locator('.detail-modal .detail-species').inner_text()
            check('詳細の名前が付けた名前・図鑑名を小さく併記', name == 'ぴよ丸' and sp == species, [name, sp])
            check('390pxで横にはみ出さない(詳細)', await overflow(pg) <= 0)
            await pg.screenshot(path=str(OUT / 'nick_detail.png'))
            await pg.locator('[data-nick-edit="m06"]').click(); await pg.wait_for_timeout(150)
            await pg.screenshot(path=str(OUT / 'nick_edit.png'))
            check('名前があると「元に戻す」', await pg.locator('[data-nick-reset="m06"]').count() == 1)
            await pg.locator('[data-nick-cancel="m06"]').click(); await pg.wait_for_timeout(150)
            await pg.evaluate("() => { document.querySelector('[data-close-detail]').click(); }"); await pg.wait_for_timeout(150)

            # 編成画面・所持一覧
            await pg.evaluate("() => document.querySelector('.nav-btn[data-nav=\"party\"]').click()"); await pg.wait_for_timeout(300)
            roster = await pg.evaluate("() => [...document.querySelectorAll('#screen .roster-row .name')].map(e => e.textContent)")
            check('所持一覧に付けた名前(と小さく図鑑名)', any('ぴよ丸' in t and species in t for t in roster), roster[:4])
            inParty = await pg.evaluate("() => STATE.slots.includes('m06')")
            if inParty:
                aria = await pg.evaluate("() => [...document.querySelectorAll('#screen .formation .party-slot')].map(e => e.getAttribute('aria-label') || '').join('|')")
                check('陣形のマスにも付けた名前', 'ぴよ丸' in aria, aria)
            check('390pxで横にはみ出さない(編成)', await overflow(pg) <= 0)
            await pg.screenshot(path=str(OUT / 'nick_party.png'))

            # 戦闘
            await pg.evaluate("() => { if(!STATE.slots.includes('m06')){ const i = STATE.slots.indexOf(null); STATE.slots[i >= 0 ? i : 0] = 'm06'; } STATE.stamina = 999; saveState(); startBattle('q1_01', { skipIntro: true }); }")
            await pg.wait_for_timeout(1500)
            unames = await pg.evaluate("() => [...document.querySelectorAll('.uname')].map(e => e.textContent)")
            check('戦闘のユニット名に付けた名前', any('ぴよ丸' in t for t in unames), unames)
            await pg.evaluate("() => { STATE.battleSpeed = 3; }")
            for _ in range(60):
                if await pg.evaluate("() => battleUI && battleUI.finished"): break
                await pg.wait_for_timeout(500)
            logs = await pg.evaluate("() => battleUI.log.join('\\n')")
            check('戦闘ログに付けた名前', 'ぴよ丸' in logs)
            await pg.wait_for_timeout(1500)
            rep = await pg.evaluate("() => document.body.innerText")
            check('結果画面に付けた名前(ダメージ一覧など)', 'ぴよ丸' in rep)
            await pg.screenshot(path=str(OUT / 'nick_result.png'))
            await pg.evaluate("() => { const l = document.getElementById('modal-layer'); l.classList.remove('show'); l.innerHTML = ''; goto('home', {nav:true}); }")
            await pg.wait_for_timeout(300)

            # 公開スナップショット
            await pg.evaluate("""async () => { profileState().favorites = ['m06'];
              STATE.pvpDefenseSlots = STATE.slots.map(id => id === HELP_SLOT_ID ? null : id); STATE.pvpDefenseFormation = STATE.formationKey;
              saveState(); await publishProfile(); }""")
            pub = await pg.evaluate(f"() => __mockCloud().players['{uid}']")
            check('お助け(support)に名前が載る', pub['support']['nick'] == 'ぴよ丸', pub['support'])
            check('PVPの防衛に名前が載る', any(s and s.get('nick') == 'ぴよ丸' for s in pub['defense']['slots']))

            # 受け取り側
            await pg.evaluate("async () => { await addFriendByCode('AAAA-AAAA-AAAA'); await addFriendByCode('BBBB-BBBB-BBBB'); await addFriendByCode('CCCC-CCCC-CCCC'); }")
            await pg.wait_for_timeout(300)
            await pg.evaluate("() => openOverlay('friends')"); await pg.wait_for_timeout(300)
            lines = await pg.evaluate("() => [...document.querySelectorAll('#overlay .fc-line')].map(e => e.textContent).join('|')")
            sp54, sp06, sp21 = await pg.evaluate("() => [MON_BY_ID.m54.name, MON_BY_ID.m06.name, MON_BY_ID.m21.name]")
            check('フレンド一覧: 相手の付けた名前', 'お助け: かしたこ' in lines, lines)
            check('NGの名前は図鑑名で出す', f'お助け: {sp06}' in lines and 'ﾁ' not in lines)
            check('9文字の名前は図鑑名で出す', f'お助け: {sp21}' in lines and '123456789' not in lines)
            await pg.evaluate("() => { friendProfileUid = 'u-a'; overlayView = 'friend-profile'; render(); }"); await pg.wait_for_timeout(250)
            fav = await pg.evaluate("() => [...document.querySelectorAll('#overlay .pf-fav-name, #overlay .nick-species')].map(e => e.textContent)")
            check('プロフィールのお助け: 付けた名前と図鑑名', fav[:2] == ['かしたこ', sp54], fav)
            await pg.evaluate("() => borrowFriendHelper('u-a')"); await pg.wait_for_timeout(200)
            check('借りたお助けの表示名', await pg.evaluate("() => monName(HELP_SLOT_ID)") == 'かしたこ')
            await pg.evaluate("() => returnBorrowed()")

            # ---------- 通報 ----------
            await pg.evaluate("() => { friendProfileUid = 'u-b'; overlayView = 'friend-profile'; render(); }"); await pg.wait_for_timeout(250)
            check('プロフィールに通報ボタン', await pg.locator('[data-report-open="profile:u-b"]').count() == 1)
            check('390pxで横にはみ出さない(プロフィール)', await overflow(pg) <= 0)
            await pg.locator('[data-report-open="profile:u-b"]').click(); await pg.wait_for_timeout(250)
            seen = await pg.locator('.report-modal .report-seen').inner_text()
            check('通報の画面に見えている内容(名前・自己紹介)', 'わるもの' in seen and 'あいさつ' in seen, seen)
            check('390pxで横にはみ出さない(通報)', await overflow(pg) <= 0)
            await pg.screenshot(path=str(OUT / 'report_form.png'))
            await pg.locator('[data-report="confirm"]').click(); await pg.wait_for_timeout(150)
            check('理由を選ばないと進めない', '理由を選んで' in await pg.locator('.report-modal').inner_text())
            await pg.locator('#report-note').fill('名前がひどいです')
            await pg.locator('[data-report-reason="name"]').click(); await pg.wait_for_timeout(100)
            check('理由を選んでもひとことは消えない', await pg.locator('#report-note').input_value() == '名前がひどいです')
            await pg.locator('[data-report="confirm"]').click(); await pg.wait_for_timeout(150)
            conf = await pg.locator('.report-modal').inner_text()
            check('送る前に確認(理由・ひとこと)', 'よろしいですか' in conf and '不適切なプレイヤー名' in conf and '名前がひどいです' in conf, conf)
            check('確認の時点ではまだ送っていない', not (await pg.evaluate("() => __mockCloud().reports || []")))
            await pg.screenshot(path=str(OUT / 'report_confirm.png'))
            await pg.locator('[data-report="send"]').click(); await pg.wait_for_timeout(300)
            reps = await pg.evaluate("() => __mockCloud().reports || []")
            check('通報が保存される', len(reps) == 1, len(reps))
            if reps:
                r = reps[0]
                check('通報の中身', r['reporter'] == uid and r['target'] == 'u-b' and r['targetPlayerId'] == 'BBBB-BBBB-BBBB' and r['reason'] == 'name'
                      and r['note'] == '名前がひどいです' and r['snapshot']['name'] == 'わるもの' and r['snapshot']['bio'] == 'あいさつ'
                      and isinstance(r['at'], (int, float)) and r['version'].startswith('α'), r)
            check('送ったあとのお知らせ', '受け付けました' in await pg.locator('.report-modal').inner_text())
            await pg.locator('[data-report="close"]').click(); await pg.wait_for_timeout(200)
            prof = await pg.locator('#overlay').inner_text()
            check('通報した相手の名前は伏せ字', '(通報ずみ)' in prof and 'わるもの' not in prof, prof[:120])
            check('自己紹介も伏せる', 'あいさつ' not in prof)
            await pg.screenshot(path=str(OUT / 'report_masked.png'))
            await pg.evaluate("() => { overlayView = 'friends'; friendsView = 'list'; render(); }"); await pg.wait_for_timeout(200)
            fl = await pg.locator('#overlay').inner_text()
            check('フレンド一覧でも伏せる', 'わるもの' not in fl and '(通報ずみ)' in fl)
            await pg.evaluate("() => { friendProfileUid = 'u-b'; overlayView = 'friend-profile'; render(); }"); await pg.wait_for_timeout(200)
            check('同じ相手は2回目を出さない(通報ずみ)', await pg.locator('[data-report-open="profile:u-b"]').count() == 0)

            # PVPの相手
            await pg.evaluate("() => { closeOverlay(); goto('pvp', {nav:true}); }"); await pg.wait_for_timeout(250)
            await pg.evaluate("() => searchPvpOpponents()"); await pg.wait_for_timeout(300)
            check('PVPの相手に通報ボタン', await pg.locator('[data-report-open="pvp:u-p"]').count() == 1)
            check('390pxで横にはみ出さない(PVP)', await overflow(pg) <= 0)
            await pg.screenshot(path=str(OUT / 'report_pvp.png'))
            await pg.locator('[data-report-open="pvp:u-p"]').click(); await pg.wait_for_timeout(200)
            seen = await pg.locator('.report-modal .report-seen').inner_text()
            check('PVP: 防衛のモンスターの名前が見えている内容に入る(NGは入らない)', 'ぼうえい' in seen and 'fuck' not in seen, seen)
            await pg.locator('[data-report-reason="nick"]').click()
            await pg.locator('[data-report="confirm"]').click(); await pg.wait_for_timeout(100)
            await pg.locator('[data-report="send"]').click(); await pg.wait_for_timeout(300)
            r2 = (await pg.evaluate("() => __mockCloud().reports"))[-1]
            check('PVP: 通報の snapshot にモンスターの名前', r2['target'] == 'u-p' and r2['reason'] == 'nick' and 'ぼうえい' in r2['snapshot']['monsters'], r2['snapshot'])
            await pg.locator('[data-report="close"]').click(); await pg.wait_for_timeout(200)
            pv = await pg.locator('#screen').inner_text()
            check('PVP: 通報した相手の名前を伏せる', 'PVPの相手' not in pv and '(通報ずみ)' in pv)
            # PVP 戦闘: 伏せた相手のモンスターは図鑑名
            await pg.evaluate("() => { STATE.pvpAttackSlots = STATE.slots.map(id => id === HELP_SLOT_ID ? null : id); STATE.pvpAttackFormation = STATE.formationKey; startPvpBattle(pvpOpponents[0]); }")
            await pg.wait_for_timeout(1500)
            en = await pg.evaluate("() => (battleUI.waves ? [] : []).concat(battleUI.enemies.map(u => u.name))")
            check('PVP戦闘: 通報した相手のモンスターは図鑑名', 'ぼうえい' not in en and sp06 in en, en)
            await pg.evaluate("() => { clearTimeout(battleUI.tickTimer); battleUI.finished = true; const l = document.getElementById('modal-layer'); l.classList.remove('show'); l.innerHTML=''; goto('home', {nav:true}); }")
            await pg.wait_for_timeout(300)

            # 1日の上限
            await pg.evaluate("() => { STATE.reportDaily = { key: currentDayKey(), n: REPORT_DAILY_MAX, to: {} }; friendProfileUid = 'u-a'; openOverlay('friends'); overlayView = 'friend-profile'; render(); }")
            await pg.wait_for_timeout(200)
            await pg.locator('[data-report-open="profile:u-a"]').click(); await pg.wait_for_timeout(150)
            check('1日10件を超えると開かずに理由を出す', '1日10件' in await toast() and await pg.locator('.report-modal').count() == 0, await toast())
            check('上限のときは送られない', len(await pg.evaluate("() => __mockCloud().reports")) == 2)

            # 設定から伏せ字を戻す
            await pg.evaluate("() => { overlayView = 'settings'; render(); }"); await pg.wait_for_timeout(200)
            check('設定に「通報した相手の表示を元に戻す」', await pg.locator('[data-unhide-reported]').count() == 1)
            await pg.locator('[data-unhide-reported]').click(); await pg.wait_for_timeout(200)
            check('戻すと伏せ字が消える', await pg.evaluate("() => reportedUids().length") == 0)

            # プレイヤー名・自己紹介の NG
            await pg.evaluate("() => { overlayView = 'profile'; render(); }"); await pg.wait_for_timeout(200)
            await pg.locator('#bio-input').fill('ふつうの文 し ね')
            await pg.locator('[data-bio-save]').click(); await pg.wait_for_timeout(150)
            check('自己紹介: 全体が「しね」でなければ保存できる(部分一致にしない語)', await pg.evaluate("() => profileState().bio") == 'ふつうの文 し ね')
            await pg.locator('#bio-input').fill('おまえ ﾁﾝｺ')
            await pg.locator('[data-bio-save]').click(); await pg.wait_for_timeout(150)
            check('自己紹介: NGは保存しない', '使えない言葉' in await toast() and await pg.evaluate("() => profileState().bio") == 'ふつうの文 し ね')
            await pg.evaluate("() => { acctView = 'main'; renderAccountModal(); }"); await pg.wait_for_timeout(200)
            before = await pg.evaluate("() => ACCOUNT.name")
            await pg.locator('#acct-name').fill('ＦＵＣＫ')
            await pg.locator('[data-account="rename"]').click(); await pg.wait_for_timeout(150)
            check('プレイヤー名: NGは保存しない', '使えない言葉' in await toast() and await pg.evaluate("() => ACCOUNT.name") == before)
            await pg.locator('#acct-name').fill('わるいなまえ')
            await pg.locator('[data-account="rename"]').click(); await pg.wait_for_timeout(150)
            check('プレイヤー名: ふつうの名前は保存できる', await pg.evaluate("() => ACCOUNT.name") == 'わるいなまえ')
            await pg.evaluate("() => { const l = document.getElementById('modal-layer'); l.classList.remove('show'); l.innerHTML=''; }")

            # ---------- 運営の対処(moderation): 開き直したときに適用 ----------
            await pg.evaluate("() => { profileState().bio = 'けすべき'; saveState(); flushSave(); }")
            await pg.wait_for_timeout(300)
            await pg.evaluate(f"""() => {{ const c = __mockCloud(); c.moderation = {{ '{uid}': {{ resetName: true, resetBio: true, resetNicks: true, at: Date.now() }} }};
              localStorage.setItem('__mockCloud', JSON.stringify(c)); }}""")
            await pg.reload(); await pg.wait_for_timeout(1800)
            await pg.evaluate(FAKE)
            st = await pg.evaluate("() => ({ name: ACCOUNT.name, bio: profileState().bio, nick: STATE.owned.m06.nick || '', toast: document.getElementById('toast').textContent, modAt: STATE.modAt })")
            check('moderation: プレイヤー名が初期(テイマーXXXX)に戻る', st['name'].startswith('テイマー') and st['name'] != 'わるいなまえ', st)
            check('moderation: 自己紹介・モンスターの名前も戻る', st['bio'] == '' and st['nick'] == '', st)
            check('moderation: お知らせ(トースト)', '不適切と判断されたため' in st['toast'], st['toast'])
            pub = await pg.evaluate(f"() => __mockCloud().players['{uid}']")
            check('moderation: 公開し直す(名前・自己紹介・お助けの名前)', pub['name'] == st['name'] and pub['bio'] == '' and not pub['support'].get('nick'), {k: pub.get(k) for k in ('name', 'bio')})
            await pg.evaluate("() => { ACCOUNT.name = 'もういちど'; storeAccount(ACCOUNT); }")
            await pg.reload(); await pg.wait_for_timeout(1500)
            check('moderation: 同じ対処は2回は当てない', await pg.evaluate("() => ACCOUNT.name") == 'もういちど')

            check('ページのエラーなし', not errs, errs)
            await b.close()
    print('すべて通過' if bad == 0 else f'{bad}件 失敗')
    sys.exit(1 if bad else 0)

asyncio.run(main())
