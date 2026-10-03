#!/usr/bin/env python3
"""称号(パーツ式): パーツは1か所(registerTitle)。実績は3段ずつ、イベント、はじめからの2つ。
持っているパーツを2つまで好きな順番に置き、間に自由な1文字を入れて称号を作る。
持っていないパーツは取り方と進みぐあい、終わったイベントのものは「もう取れません」。
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
            check('パーツは1か所に登録され(実績19×3+イベント12+はじめから2)、全部に取り方がある', r['n'] == 71 and not r['noHow'] and sorted(r['cats']) == ['achieve', 'event'], r)
            check('EXの称号の取り方は「EX3を★3でクリアする」', '★3' in r['exHow'], r['exHow'])
            # 実績の段を受け取ると、その段のパーツがもらえる(星刻10回 → 星刻見習い)
            r = await pg.evaluate("""() => { STATE.stats = STATE.stats || {}; STATE.stats.promote = 12; const before = hasTitle('tp_x_promote_1');
              claimMissions(e => e.key === 'a:x_promote'); closeModal(); return { before, after: hasTitle('tp_x_promote_1'), next: hasTitle('tp_x_promote_2'), on: STATE.titleParts }; }""")
            check('星刻を10回の段を受け取ると「星刻見習い」がもらえ、最初の1つは自動で付く', not r['before'] and r['after'] and not r['next'] and r['on']['a'] == 'tp_x_promote_1', r)
            check('はじめから「新人」「テイマー」を持っている', await pg.evaluate("() => hasTitle('tp_base_new') && hasTitle('tp_base_tamer')"))
            await pg.evaluate("""() => { grantTitle('ti_ev_kyubi_deep'); STATE.titleParts = { a: 'ti_ev_kyubi_deep', b: null, sep: '' }; saveState(); openOverlay('profile'); }""")
            await pg.wait_for_timeout(400)
            txt = await pg.evaluate("() => (document.querySelector('[data-open-titles]') || {}).textContent || ''")
            check('プロフィールに「称号パーツ(持っている/全部)・フレーム」のボタン', '称号パーツ(4/' in txt and 'フレーム(' in txt, txt)
            await pg.click('[data-open-titles]'); await pg.wait_for_timeout(300)
            r = await pg.evaluate("() => ({ rows: document.querySelectorAll('.tl-row').length, own: document.querySelectorAll('.tl-row.own').length, prog: document.querySelectorAll('.tl-row .tl-bar').length, groups: document.querySelectorAll('.tl-group').length, preview: document.getElementById('tc-preview').textContent })")
            check('実績タブ: 実績ごとに3段のパーツが並ぶ(持っていないものは進みぐあいつき)', r['rows'] == 59 and r['own'] == 3 and r['groups'] == 20 and r['prog'] >= 40, r)
            check('上の欄にいまの称号が出る', r['preview'] == '狐火を鎮めし者', r)
            # 組み立て: 前に「新人」、後ろに「テイマー」、間に「の」
            await pg.click('[data-title-part="a:tp_base_new"]'); await pg.wait_for_timeout(150)
            await pg.click('[data-title-part="b:tp_base_tamer"]'); await pg.wait_for_timeout(150)
            check('「前」「後」に置くと、2つをつないだ称号になる', await pg.evaluate("() => myTitleText()") == '新人テイマー')
            await pg.fill('#title-sep', 'のx'); await pg.press('#title-sep', 'Enter'); await pg.locator('#title-sep').blur(); await pg.wait_for_timeout(200)
            r = await pg.evaluate("() => ({ t: myTitleText(), v: document.getElementById('title-sep').value, pv: document.getElementById('tc-preview').textContent })")
            check('間の1文字を入れられる(2文字以上は1文字にそろえる)', r['t'] == '新人のテイマー' and r['v'] == 'の' and r['pv'] == '新人のテイマー', r)
            await pg.screenshot(path=str(OUT / 'title_list_achieve.png'))
            await pg.click('[data-title-swap]'); await pg.wait_for_timeout(150)
            check('前後を入れかえられる', await pg.evaluate("() => myTitleText()") == 'テイマーの新人')
            await pg.click('[data-title-part="a:tp_x_promote_1"]'); await pg.wait_for_timeout(150)
            check('好きなパーツを前にも後ろにも置ける(実績のパーツ+はじめからのパーツ)', await pg.evaluate("() => myTitleText()") == '星刻見習いの新人')
            await pg.click('[data-title-part="b:tp_x_promote_1"]'); await pg.wait_for_timeout(150)
            r = await pg.evaluate("() => STATE.titleParts")
            check('同じパーツを反対側に置くと、もう片方からは外れる', r['a'] is None and r['b'] == 'tp_x_promote_1', r)
            check('パーツが1つだけなら間の文字は出さない', await pg.evaluate("() => myTitleText()") == '星刻見習い')
            check('持っていないパーツは置けない', await pg.evaluate("() => { setTitlePart('a', 'tp_x_promote_3'); return STATE.titleParts.a; }") is None)
            await pg.evaluate("() => { setTitlePart('a', 'ti_ev_kyubi_deep'); }")
            await pg.click('[data-title-tab="event"]'); await pg.wait_for_timeout(200)
            r = await pg.evaluate("() => ({ groups: [...document.querySelectorAll('.tl-group')].map(x => x.textContent), rows: document.querySelectorAll('.tl-row').length })")
            check('イベントタブ: イベントごとにまとまる', len(r['groups']) >= 2 and r['rows'] >= 6, r)
            # 終わったイベントは「もう取れません」
            await pg.evaluate("() => { const ev = EVENTS.find(e => e.key === 'ev_titan'); ev.endAt = '2020-01-01T00:00:00+09:00'; renderTitleList(); }")
            ended = await pg.locator('.tl-row.ended').count()
            check('終わったイベントで持っていない称号は「もう取れません」', ended >= 3, ended)
            await pg.screenshot(path=str(OUT / 'title_list_event.png'))
            await pg.click('[data-close-title-list]'); await pg.wait_for_timeout(200)
            r = await pg.evaluate("() => ({ now: (document.querySelector('.pf-title-now .pf-title.on') || {}).textContent, top: (document.querySelector('.pf-name-title') || {}).textContent })")
            check('閉じるとプロフィールに戻り、組み立てた称号が名前の上にも出ている', r['now'] == '狐火を鎮めし者の星刻見習い' and r['top'] == r['now'], r)
            # フレーム: 条件を満たすと自動でもらえて、フレームのタブで付け替え
            await pg.evaluate("() => { STATE.stageStars['ev_kyubi_ex3'] = 3; openTitleList(); titleList.tab = 'frame'; renderTitleList(); }")
            await pg.wait_for_timeout(200)
            r = await pg.evaluate("() => ({ got: STATE.frames || [], rows: document.querySelectorAll('.tl-row').length, own: document.querySelectorAll('.tl-row.own').length, n: Object.keys(FRAMES).length })")
            check('EX3を★3にすると、そのイベントのフレームが自動でもらえる', 'fr_ev_kyubi' in r['got'] and r['own'] >= 1, r)
            check('フレームは14種類(ランク5・極み5・イベント4)で、タブにまとまって並ぶ', r['n'] == 14 and r['rows'] == 14, r)
            r = await pg.evaluate("() => ({ groups: [...document.querySelectorAll('.tl-group')].map(x => x.textContent), orn: document.querySelectorAll('.tl-frame .fr-orn').length, old: ['fr_collect','fr_mainstar','fr_abyss','fr_ex3'].filter(k => FRAMES[k]) })")
            check('ランクの枠・極みの枠・イベントの枠に分かれ、極みの枠は四すみに飾りが付く', r['groups'] == ['ランクの枠', '極みの枠', 'イベントの枠'] and r['orn'] == 10 and not r['old'], r)
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
            await pg.evaluate("() => { closeOverlay && closeOverlay(); STATE.titleParts.sep = '☆'; setTitlePart('a', 'tp_base_new'); setTitlePart('b', 'ti_ev_kyubi_deep'); }")
            await pg.wait_for_timeout(600)
            pub = await pg.evaluate("() => { const c = JSON.parse(localStorage.getItem('__mockCloud') || '{}'); const me = ACCOUNT && c.players && c.players[ACCOUNT.uid]; return me ? me.title : 'no-account'; }")
            check('称号を組み替えると、公開プロフィールにパーツ2つと間の文字が載る', isinstance(pub, dict) and pub.get('key') == 'tp_base_new' and pub.get('key2') == 'ti_ev_kyubi_deep' and pub.get('sep') == '☆' and pub.get('name') == '新人☆狐火を鎮めし者', pub)
            r = await pg.evaluate("""() => ({ known: sanitizeTitle({ key: 'tp_x_login_1', key2: 'tp_base_tamer', sep: 'の\\u200bあ', name: 'ちがう名前' }), one: sanitizeTitle({ key: 'tp_x_login_1', name: 'ちがう' }),
              unknown: sanitizeTitle({ key: 'zzz', name: 'あたらしい称号のながいなまえあいうえおかきくけこ' }), half: sanitizeTitle({ key: 'tp_base_new', key2: 'zzz', name: '新人ふしぎ' }), bad: sanitizeTitle('x') })""")
            check('相手の称号: 知っているパーツはこちらの名前で組み直し(間は1文字)、知らないものは20文字まで、変な値は空',
                  r['known'] == 'いつもの顔のテイマー' and r['one'] == 'いつもの顔' and len(r['unknown']) == 20 and r['half'] == '新人ふしぎ' and r['bad'] == '', r)
            # 前の版からの引っ越し: 実績の称号は受け取った段のパーツに置き換わり、付けていた称号は前に置かれる
            r = await pg.evaluate("""() => { const keep = JSON.stringify(STATE);
              STATE.titleV = 0; STATE.achievements = { x_promote: 3, x_runetier: 4, x_login: 4 }; STATE.titles = ['ach_x_promote', 'ach_x_login', 'ti_ev_kyubi_deep']; STATE.title = 'ach_x_login';
              STATE.frames = ['fr_gold', 'fr_collect']; STATE.frame = 'fr_collect'; delete STATE.titleParts;
              migrateTitleParts();
              const out = { ach: STATE.achievements, titles: STATE.titles.slice().sort(), parts: STATE.titleParts, title: STATE.title, frames: STATE.frames, frame: STATE.frame };
              STATE = JSON.parse(keep); return out; }""")
            check('引っ越し: 星刻(前の3段目=20回)は新しい段で数え直し、ルーンTier8までなら Tier7 のパーツまで',
                  r['ach']['x_promote'] == 2 and r['ach']['x_runetier'] == 4 and 'tp_x_promote_1' in r['titles'] and 'tp_x_promote_2' not in r['titles'] and 'tp_x_runetier_2' in r['titles'], r)
            check('引っ越し: 前の称号は消え、付けていた実績の称号はその実績のいちばん上のパーツに', not [k for k in r['titles'] if k.startswith('ach_')] and 'ti_ev_kyubi_deep' in r['titles'] and r['parts']['a'] == 'tp_x_login_1' and r['title'] is None, r)
            check('引っ越し: なくなったフレームは外れる', r['frames'] == ['fr_gold'] and r['frame'] is None, r)
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
