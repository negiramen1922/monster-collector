#!/usr/bin/env python3
"""称号: データは1か所(registerTitle)。プロフィールの「称号一覧」で、実績/イベントに分けて全部見られる。
持っている称号はタップで付け替え、持っていない称号は取り方と進みぐあい、終わったイベントのものは「もう取れません」。
使い方: CHROMIUM_PATH=/path/to/chrome python3 tools/title_list_ui_test.py"""
import asyncio, os, pathlib
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
            pg = await b.new_page(viewport={'width': 390, 'height': 844})
            await use_mock_auth(pg)
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(url); await pg.wait_for_timeout(900)
            await start_as_guest(pg)
            r = await pg.evaluate("""() => { clearGuideToast(); STATE.announceQueue = [];
              const all = Object.values(TITLES);
              return { n: all.length, cats: [...new Set(all.map(t => t.cat))], noHow: all.filter(t => !t.how).map(t => t.key),
                exHow: TITLES.ti_ev_kyubi_ex.how }; }""")
            check('称号は1か所に登録され、全部に取り方がある', r['n'] >= 28 and not r['noHow'] and sorted(r['cats']) == ['achieve', 'event'], r)
            check('EXの称号の取り方は「EX3を★3でクリアする」', '★3' in r['exHow'], r['exHow'])
            await pg.evaluate("""() => { grantTitle('ti_ev_kyubi_deep'); grantTitle('ach_x_login'); STATE.title = 'ti_ev_kyubi_deep'; saveState(); openOverlay('profile'); }""")
            await pg.wait_for_timeout(400)
            txt = await pg.evaluate("() => (document.querySelector('[data-open-titles]') || {}).textContent || ''")
            check('プロフィールに「称号(持っている/全部)・フレーム」のボタン', '称号(2/' in txt and 'フレーム(' in txt, txt)
            await pg.click('[data-open-titles]'); await pg.wait_for_timeout(300)
            r = await pg.evaluate("() => ({ rows: document.querySelectorAll('.tl-row').length, own: document.querySelectorAll('.tl-row.own').length, prog: document.querySelectorAll('.tl-row .tl-bar').length, tabs: [...document.querySelectorAll('.tl-tab')].map(x => x.textContent) })")
            check('実績タブ: 持っている称号と、持っていない称号(進みぐあいつき)が並ぶ', r['rows'] >= 16 and r['own'] == 1 and r['prog'] >= 10, r)
            await pg.screenshot(path=str(OUT / 'title_list_achieve.png'))
            await pg.click('[data-set-title="ach_x_login"]'); await pg.wait_for_timeout(200)
            check('タップで付け替えられる', await pg.evaluate("() => STATE.title") == 'ach_x_login' and await pg.locator('.tl-row.on').count() == 1)
            await pg.click('[data-title-tab="event"]'); await pg.wait_for_timeout(200)
            r = await pg.evaluate("() => ({ groups: [...document.querySelectorAll('.tl-group')].map(x => x.textContent), rows: document.querySelectorAll('.tl-row').length })")
            check('イベントタブ: イベントごとにまとまる', len(r['groups']) >= 2 and r['rows'] >= 6, r)
            # 終わったイベントは「もう取れません」
            await pg.evaluate("() => { const ev = EVENTS.find(e => e.key === 'ev_titan'); ev.endAt = '2020-01-01T00:00:00+09:00'; renderTitleList(); }")
            ended = await pg.locator('.tl-row.ended').count()
            check('終わったイベントで持っていない称号は「もう取れません」', ended >= 3, ended)
            await pg.screenshot(path=str(OUT / 'title_list_event.png'))
            await pg.click('[data-close-title-list]'); await pg.wait_for_timeout(200)
            check('閉じるとプロフィールに戻り、いまの称号が出ている', await pg.locator('.pf-title-now .pf-title.on').count() == 1)
            # フレーム: 条件を満たすと自動でもらえて、フレームのタブで付け替え
            await pg.evaluate("() => { STATE.stageStars['ev_kyubi_ex3'] = 3; openTitleList(); titleList.tab = 'frame'; renderTitleList(); }")
            await pg.wait_for_timeout(200)
            r = await pg.evaluate("() => ({ got: STATE.frames || [], rows: document.querySelectorAll('.tl-row').length, own: document.querySelectorAll('.tl-row.own').length, n: Object.keys(FRAMES).length })")
            check('EX3を★3にすると、そのイベントのフレームが自動でもらえる', 'fr_ev_kyubi' in r['got'] and r['own'] >= 1, r)
            check('フレームは12種類で、タブに全部並ぶ', r['n'] == 12 and r['rows'] == 12, r)
            await pg.click('[data-set-frame="fr_ev_kyubi"]'); await pg.wait_for_timeout(300)
            r = await pg.evaluate("() => ({ frame: STATE.frame, top: document.querySelector('.tb-avatar').className })")
            check('付けると上のバーのアイコンにも枠が付く', r['frame'] == 'fr_ev_kyubi' and 'fr-kyubi' in r['top'], r)
            await pg.screenshot(path=str(OUT / 'title_frames.png'))
            await pg.click('[data-close-title-list]'); await pg.wait_for_timeout(200)
            check('プロフィールのアイコンにも枠が付く', await pg.locator('.pf-avatar.fr-kyubi').count() == 1)
            r = await pg.evaluate("""() => { const b = document.querySelector('.pf-avatar .fr-badge img'), t = document.querySelector('.tb-avatar .fr-badge img');
              const r1 = document.querySelector('.pf-avatar').getBoundingClientRect(), r2 = b ? b.parentElement.getBoundingClientRect() : null;
              return { pf: !!b && b.getAttribute('src') === imgSrc('m116'), top: !!t, rightBottom: !!r2 && r2.right > r1.right - r1.width * 0.3 && r2.bottom > r1.bottom - r1.height * 0.3,
                none: frameBadgeHtml('fr_gold') === '' }; }""")
            check('イベントのフレームは右下にピックアップ★5(九尾の狐)が小さくいる(上のバーにも)', r['pf'] and r['top'] and r['rightBottom'], r)
            check('イベント以外のフレームには付かない', r['none'], r)
            await pg.screenshot(path=str(OUT / 'title_profile.png'))
            pubf = await pg.evaluate("() => { const c = JSON.parse(localStorage.getItem('__mockCloud') || '{}'); const me = ACCOUNT && c.players && c.players[ACCOUNT.uid]; return me ? me.frame : null; }")
            check('公開プロフィールにフレームが載る', pubf == 'fr_ev_kyubi', pubf)
            check('知らないフレームは使わない', await pg.evaluate("() => sanitizeFrame('fr_zzz') === '' && sanitizeFrame(3) === '' && sanitizeFrame('fr_gold') === 'fr_gold'"))
            # 他の人に見せる: 公開プロフィールに称号が載る
            await pg.evaluate("() => { closeOverlay && closeOverlay(); equipTitle('ti_ev_kyubi_deep'); }")
            await pg.wait_for_timeout(600)
            pub = await pg.evaluate("() => { const c = JSON.parse(localStorage.getItem('__mockCloud') || '{}'); const me = ACCOUNT && c.players && c.players[ACCOUNT.uid]; return me ? me.title : 'no-account'; }")
            check('称号を付け替えると、公開プロフィールに称号が載る', isinstance(pub, dict) and pub.get('key') == 'ti_ev_kyubi_deep', pub)
            r = await pg.evaluate("""() => ({ known: sanitizeTitle({ key: 'ach_x_login', name: 'ちがう名前' }), unknown: sanitizeTitle({ key: 'zzz', name: 'あたらしい称号のながいなまえあいうえおかきくけこ' }), bad: sanitizeTitle('x') })""")
            check('相手の称号: 知っている称号はこちらの名前、知らない称号は20文字まで、変な値は空', r['known'] == 'いつもの顔' and len(r['unknown']) == 20 and r['bad'] == '', r)
            r = await pg.evaluate("""() => {
              const be = authBackend(); be.lookupPlayer = be.lookupPlayer || (async () => null); be.fetchPvpOpponents = be.fetchPvpOpponents || (async () => []);   // モックにはフレンド・PVPが無いので仮に足す
              STATE.friends = [{ uid: 'f1', playerId: 'P1', name: 'アリス', level: 12, support: null, avatar: null, title: '狐火を鎮めし者', frame: 'fr_gold', bio: '', lastActive: Date.now() }];
              openOverlay('friends'); render();
              const row = document.querySelector('[data-view-friend="f1"]');
              const inList = row ? row.textContent.includes('狐火を鎮めし者') && !!row.querySelector('.fc-ic.fr-gold') : false;
              friendProfileUid = 'f1'; overlayView = 'friend-profile'; render();
              const inProfile = !!document.querySelector('.pf-name-title') && document.querySelector('.pf-name-title').textContent === '狐火を鎮めし者' && !!document.querySelector('.pf-avatar.fr-gold');
              return { inList, inProfile }; }""")
            check('フレンド一覧とフレンドのプロフィールに相手の称号・フレームが出る', r['inList'] and r['inProfile'], r)
            await pg.screenshot(path=str(OUT / 'title_friend.png'))
            r = await pg.evaluate("""() => { closeOverlay && closeOverlay();
              pvpOpponents = [{ uid: 'o1', name: '<b>悪い名前</b>', title: '試練を越えし者', level: 30, defense: { slots: ['m54', null, null, null, null] } }];
              goto('pvp'); render();
              const row = document.querySelector('.pvp-opp-row');
              return { title: row ? row.textContent.includes('試練を越えし者') : false, escaped: row ? !row.querySelector('.pvp-opp-name b') && row.textContent.includes('<b>悪い名前</b>') : false }; }""")
            check('PVPの相手にも称号が出る(名前はそのまま文字として出す)', r['title'] and r['escaped'], r)
            await b.close()
    real = [e for e in errs if 'favicon' not in e]
    check('JSエラーなし', not real, real[:3])
    print('すべて通過' if bad == 0 else f'{bad}件 失敗')

asyncio.run(main())
