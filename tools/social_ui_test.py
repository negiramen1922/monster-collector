#!/usr/bin/env python3
"""フレンド画面(フレンドリスト・フレンド追加・おすすめユーザー・フォロワー)と
プロフィールの自己紹介・フォロー/フォロワー数を、実際の画面で開いて確かめる。

mock_auth.js にはフレンド用の関数が無いので、ここでテスト用の偽プレイヤーを差し込む。
使い方: CHROMIUM_PATH=/path/to/chrome python3 tools/social_ui_test.py
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
  const now = Date.now(), DAY = 86400000;
  const P = {
    'u-a': { playerId: 'AAAA-AAAA-AAAA', name: 'ひよこテイマー', level: 12, avatar: 'm136', bio: 'バハムート育成中です', updatedAt: now - DAY, following: 4, followers: 9 },
    'u-b': { playerId: 'BBBB-BBBB-BBBB', name: 'ひかり', level: 30, avatar: 'm158', updatedAt: now - 2 * DAY },
    'u-old': { playerId: 'OOOO-OOOO-OOOO', name: 'ひさしぶり', level: 5, updatedAt: now - 40 * DAY },
    'u-f': { playerId: 'FFFF-FFFF-FFFF', name: 'フォロワー太郎', level: 8, avatar: 'm165', updatedAt: now },
  };
  const incoming = ['u-f', 'u-a'];
  const withUid = uid => ({ uid, ...P[uid] });
  Object.assign(window.__authBackend, {
    async lookupPlayer(code){ const uid = Object.keys(P).find(u => P[u].playerId === code); return uid ? withUid(uid) : null; },
    async fetchProfiles(uids){ return uids.filter(u => P[u]).map(withUid); },
    async fetchIncoming(){ return incoming.slice(); },
    async recordIncomingFriend(){}, async removeIncoming(){},
    async searchPlayersByName(prefix){ return Object.keys(P).filter(u => P[u].name.startsWith(prefix)).map(withUid); },
    async fetchRandomPlayers(){ return Object.keys(P).map(withUid); },
    async fetchGifts(){ return []; },
  });
}"""

async def main():
    with game_url() as url:
        async with async_playwright() as p:
            b = await p.chromium.launch(**LAUNCH)
            pg = await b.new_page(viewport={'width': 390, 'height': 780})
            await use_mock_auth(pg)
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(url); await pg.wait_for_timeout(1000)
            await start_as_guest(pg)
            await pg.evaluate(FAKE)
            await pg.evaluate("() => { STATE.clearedStages = STAGES.map(s => s.id); saveState(); openOverlay('friends'); }")
            await pg.wait_for_timeout(500)
            body = await pg.locator('#overlay').inner_text()
            check('最初はフレンドリストが出る', 'フレンドリスト' in body)
            check('検索バーのあった場所に「フレンドを追加」ボタン', await pg.locator('[data-friends-view="add"]').count() == 1 and await pg.locator('#friend-code-input').count() == 0)
            check('フォロー/フォロワー数が出る', 'フォロー' in body and 'フォロワー' in body)
            check('フォロワー数はフォロワー全員(2人)', await pg.evaluate('() => STATE.followerCount') == 2)
            await pg.screenshot(path=str(OUT / 'soc_list.png'))

            await pg.locator('[data-friends-view="add"]').click(); await pg.wait_for_timeout(400)
            body = await pg.locator('#overlay').inner_text()
            check('追加画面に名前・IDの検索バー', await pg.locator('#friend-search-input').count() == 1)
            check('何も検索していないときは「おすすめユーザー」', 'おすすめユーザー' in body)
            check('おすすめは最近遊んでいる人だけ(ひさしぶりは出ない)', 'ひよこテイマー' in body and 'ひさしぶり' not in body)
            await pg.screenshot(path=str(OUT / 'soc_add.png'))

            await pg.locator('#friend-search-input').fill('ひよ')
            await pg.locator('#friend-search-input').press('Enter'); await pg.wait_for_timeout(400)
            body = await pg.locator('#overlay').inner_text()
            check('名前で検索できる(Enterでも)', '「ひよ」の検索結果' in body and 'ひよこテイマー' in body and 'ひかり' not in body)
            await pg.locator('#friend-search-input').fill('BBBBBBBBBBBB')
            await pg.locator('[data-friend-search]').click(); await pg.wait_for_timeout(400)
            check('IDで検索できる', 'ひかり' in await pg.locator('#overlay').inner_text())
            await pg.locator('[data-add-friend-uid="u-b"]').click(); await pg.wait_for_timeout(300)
            check('検索結果から追加できる', await pg.evaluate("() => STATE.friends.some(f => f.uid === 'u-b')"))

            await pg.locator('[data-view-friend="u-a"]').first.click() if await pg.locator('[data-view-friend="u-a"]').count() else None
            await pg.evaluate("() => { friendProfileUid = 'u-a'; overlayView = 'friend-profile'; render(); }")
            await pg.wait_for_timeout(300)
            body = await pg.locator('#overlay').inner_text()
            check('フレンドでない人のプロフィールに自己紹介と「フレンドに追加」', 'バハムート育成中です' in body and 'フレンドに追加' in body and '9 フォロワー' in body.replace('　', ' '))
            await pg.screenshot(path=str(OUT / 'soc_profile_other.png'))

            await pg.evaluate("() => { overlayView = 'friends'; setFriendsView('followers'); }"); await pg.wait_for_timeout(400)
            body = await pg.locator('#overlay').inner_text()
            check('フォロワー一覧が出る', 'フォロワー太郎' in body and 'ひよこテイマー' in body)
            check('フォロワーに「フレンドを返す」ボタン', await pg.locator('[data-add-friend-back="u-f"]').count() == 1)
            await pg.screenshot(path=str(OUT / 'soc_followers.png'))
            await pg.locator('[data-add-friend-back="u-f"]').click(); await pg.wait_for_timeout(300)
            check('フレンドを返すとフレンドになる', await pg.evaluate("() => STATE.friends.some(f => f.uid === 'u-f')"))
            check('返した人は「フレンド」表示に変わる', await pg.locator('[data-add-friend-back="u-f"]').count() == 0)

            await pg.evaluate("() => { openOverlay('profile'); }"); await pg.wait_for_timeout(400)
            body = await pg.locator('#overlay').inner_text()
            check('プロフィールにフォロー/フォロワー数', 'フォロー' in body and 'フォロワー' in body)
            await pg.locator('#bio-input').fill('のんびり図鑑を埋めています')
            check('入力中に文字数が出る', (await pg.locator('#bio-count').inner_text()) == str(len('のんびり図鑑を埋めています')))
            await pg.locator('[data-bio-save]').click(); await pg.wait_for_timeout(300)
            check('自己紹介を保存できる', await pg.evaluate("() => STATE.profile.bio") == 'のんびり図鑑を埋めています')
            await pg.screenshot(path=str(OUT / 'soc_my_profile.png'))
            over = await pg.evaluate('() => document.documentElement.scrollWidth - document.documentElement.clientWidth')
            check('横にはみ出していない', over <= 0, over)
            check('JSエラーなし', not errs, errs[:3])
            await b.close()
    print('NG' if bad else 'すべて通過')
    return bad

sys.exit(asyncio.run(main()))
