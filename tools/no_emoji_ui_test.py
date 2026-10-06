#!/usr/bin/env python3
"""画面に出してはいけない文字の回帰テスト(絵文字と、下書きの目印)。

絵文字はフォント任せで端末ごとに形も色も変わり、ゲームのドット絵とも合わない。
ぜんぶ UI_ICON(インラインSVG)に寄せたので、主要な画面を一通り開いて
絵文字が1文字も出ていないことを確かめる。

★ → ✓ などの幾何学記号は絵文字ではない(どの環境でも同じ字形)ので対象外。

あわせて、テンプレートの書き損じ(「${UI_ICON.shield}」がそのまま出ていた)や
undefined が画面に出ていないかも、同じ巡回のついでに見る。

使い方: CHROMIUM_PATH=/path/to/chrome python3 tools/no_emoji_ui_test.py
"""
import asyncio, os, pathlib, re, sys
from playwright.async_api import async_playwright
from _serve import game_url, use_mock_auth, start_as_guest

OUT = pathlib.Path(os.environ.get('SHOT_DIR', '/tmp'))
LAUNCH = {'executable_path': os.environ['CHROMIUM_PATH']} if os.environ.get('CHROMIUM_PATH') else {}
EMOJI = re.compile('[\U0001F000-\U0001FAFF☀-⛿✀-➿⬀-⯿⏩-⏺]')
# 書き損じの目印。'${' はシングルクォートの中にテンプレートを書いた時にそのまま出る
LEAK = re.compile(r'\$\{|undefined|\[object |NaN|TODO')
# 字形が環境で変わらない記号は絵文字ではないので見逃す
PLAIN = set('★✓✕✗✦→←↑↓▲▼▶◀◆◯○')
bad = 0
def check(name, cond, info=''):
    global bad
    bad += 0 if cond else 1
    print(('✅' if cond else '❌') + f' {name}' + (f'  {info}' if info != '' else ''))


VIEWS = [
    ('ホーム',        "() => goto('home', { nav: true })"),
    ('ガチャ',        "() => goto('gacha', { nav: true })"),
    ('編成',          "() => goto('party', { nav: true })"),
    ('探索メニュー',  "() => { stageTab = 'menu'; goto('battle', { nav: true }); }"),
    ('メインクエスト', "() => { stageTab = 'main'; questTier = 'q1'; render(); }"),
    ('育成クエスト',  "() => { stageTab = 'dungeon'; dungeonTab = 'exp'; render(); }"),
    ('深淵回廊',      "() => { stageTab = 'abyss'; render(); }"),
    ('拠点',          "() => goto('base', { nav: true })"),
    ('ショップ',      "() => goto('shop', { nav: true })"),
    ('ミッション',    "() => goto('missions', { nav: true })"),
    ('PVP',           "() => goto('pvp', { nav: true })"),
    ('遺物',          "() => goto('relics', { nav: true })"),
    ('ルーン',        "() => goto('runes', { nav: true })"),
    ('図鑑',          "() => goto('dex', { nav: true })"),
    ('メニュー',      "() => { goto('home', { nav: true }); openOverlay('menu'); }"),
    ('フレンド',      "() => { closeOverlay(); openOverlay('friends'); }"),
    ('設定',          "() => { closeOverlay(); openOverlay('settings'); }"),
    ('キャラ詳細',    "() => { closeOverlay(); goto('party', { nav: true }); showMonsterDetail('m06'); }"),
    ('ワザを開く',    "() => document.querySelector('[data-skill-toggle]').click()"),
    ('装備タブ',      "() => document.querySelector('[data-detail-tab=\"equip\"]').click()"),
    ('星刻',          "() => showPromoteModal('m06')"),
    ('戦闘',          "() => { closeModal(); startBattle('tu1', { skipIntro: true }); }"),
]


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
            await pg.evaluate("""() => {
                STATE.crystals = 9999; STATE.gold = 999999; STATE.stamina = 200;
                STATE.runeDust = 500; STATE.pvpPoints = 120; STATE.friendPoints = 80;
                STATE.universalSouls = 300; STATE.announceQueue = [];
                STATE.guidesSeen = { welcome: true, monsterDetail: true };
                STATE.clearedStages = ['tu1','tu2','tu3','tu4','tu5','q1_01','q1_02','q1_03',
                  'q1_04','q1_05','q1_06','q1_07','q1_08','q1_09','q1_10'];
                clearGuideToast(true); closeModal(); }""")
            await pg.wait_for_timeout(400)

            found, leaks = {}, {}
            for name, js in VIEWS:
                await pg.evaluate(js)
                await pg.wait_for_timeout(400)
                txt = await pg.evaluate("() => document.getElementById('phone').innerText")
                hit = sorted({c for c in txt if EMOJI.match(c) and c not in PLAIN})
                if hit: found[name] = hit
                bad_lines = [l.strip() for l in txt.split('\n') if LEAK.search(l)]
                if bad_lines: leaks[name] = bad_lines[:3]
            check('どの画面にも絵文字が出ない', found == {}, found)
            check('どの画面にも書き損じ(${...}・undefined など)が出ない', leaks == {}, leaks)

            # UI_ICON そのものの健全性
            info = await pg.evaluate("""() => {
                const ks = Object.keys(UI_ICON);
                return { n: ks.length,
                  notImg: ks.filter(k => !/^<img /.test(UI_ICON[k])),
                  noLabel: ks.filter(k => !UI_ICON_LABEL[k]),
                  emoji: ks.filter(k => /[\\u{1F000}-\\u{1FAFF}]/u.test(UI_SVG_BODY[k])) }; }""")
            check('アイコンが一通りそろっている', info['n'] >= 60, info['n'])
            check('どれも <img> になっている', info['notImg'] == [], info['notImg'])
            check('どれも名前(読み上げ用)がある', info['noLabel'] == [], info['noLabel'])
            check('アイコンの中身に絵文字が混ざっていない', info['emoji'] == [], info['emoji'])

            check('JSエラーなし', not errs, errs[:3])
            await b.close()
    print('NG' if bad else 'すべて通過')
    return bad

sys.exit(asyncio.run(main()))
