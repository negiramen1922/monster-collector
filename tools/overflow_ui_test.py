#!/usr/bin/env python3
"""横にはみ出していないかの回帰テスト。

スマホの幅は320〜430pxまで幅があり、狭い端末では文字が枠の外に出たり、
省略(…)も付かずに切れたりする。主要な画面を一通り開いて、

  1. #phone の外にはみ出す要素がないこと
  2. 省略(…)なしで切れている文字がないこと
  3. 絞り込みのチップ(「トリックスター」など長いラベル)が切れないこと
  4. 上のバーのプレイヤー名が潰れきらないこと

を確かめる。…付きの省略は意図したもの(モンスター名のマス目など)なので見逃す。

使い方: CHROMIUM_PATH=/path/to/chrome python3 tools/overflow_ui_test.py
"""
import asyncio, os, sys
from playwright.async_api import async_playwright
from _serve import game_url, use_mock_auth, start_as_guest

LAUNCH = {'executable_path': os.environ['CHROMIUM_PATH']} if os.environ.get('CHROMIUM_PATH') else {}
WIDTHS = [320, 360, 390, 430]
bad = 0
def check(name, cond, info=''):
    global bad
    bad += 0 if cond else 1
    print(('✅' if cond else '❌') + f' {name}' + (f'  {info}' if info != '' else ''))

SETUP = """() => {
  STATE.crystals = 99999; STATE.gold = 99999999; STATE.stamina = 999; STATE.runeDust = 9999;
  STATE.pvpPoints = 123456; STATE.friendPoints = 8888; STATE.universalSouls = 99999;
  STATE.announceQueue = []; STATE.guidesSeen = { welcome:true, monsterDetail:true, relics:true, runes:true };
  STATE.clearedStages = STAGES.map(s => s.id);
  for(const m of MONSTERS) if(!STATE.owned[m.id]) grantMonster(m);
  STATE.owned.m06.level = 60; STATE.owned.m06.star = 6; STATE.owned.m06.souls = 9999; STATE.owned.m06.skillLv = 5;
  const rids = Object.keys(RELICS);
  rids.forEach((r, i) => { STATE.relics[r] = { level: (i % 10) + 1, skillLv: (i % 3) + 1 }; });
  STATE.relics[rids[0]].equippedTo = 'm06';
  for(const k of ['exp1','exp4','box_sel_4','relic_core_3','stamina_60','idle_12','mon_sel_3','relic_scrap'])
    addItem(k, 99);
  clearGuideToast(true); closeModal();
}"""

# 飾りは枠からはみ出して切られるのが前提(イベントバナーの光条など)なので対象外
SCAN = """() => {
  const phone = document.getElementById('phone');
  const pr = phone.getBoundingClientRect();
  const out = [], cut = [];
  const desc = e => {
    const id = e.id ? '#' + e.id : '';
    const cl = (typeof e.className === 'string' && e.className) ? '.' + e.className.trim().split(/\\s+/).slice(0, 2).join('.') : '';
    return e.tagName.toLowerCase() + id + cl;
  };
  const DECOR = /fx|glow|ray|sheen|spark|flash|aura|pulse|shadow|mask|dim|veil|conf|sil|band|telop|banner|bar\\b|gauge|fill/i;
  const scrollerX = e => {
    for(let n = e.parentElement; n && n !== document.body; n = n.parentElement){
      const ox = getComputedStyle(n).overflowX;
      if(ox === 'auto' || ox === 'scroll') return n;
    }
    return null;
  };
  for(const e of phone.querySelectorAll('*')){
    const cs = getComputedStyle(e);
    if(cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const r = e.getBoundingClientRect();
    if(r.width === 0 || r.height === 0) continue;
    const cls = (typeof e.className === 'string' ? e.className : '');
    if(DECOR.test(cls)) continue;
    const txt = (e.innerText || '').replace(/\\n/g, ' / ').slice(0, 24);
    if((cs.overflowX === 'hidden' || cs.overflowX === 'clip') && cs.textOverflow !== 'ellipsis'
       && e.clientWidth > 0 && e.scrollWidth > e.clientWidth + 1)
      cut.push(`${desc(e)}+${Math.round(e.scrollWidth - e.clientWidth)} ${txt}`);
    if(!scrollerX(e)){
      const over = Math.round(Math.max(r.right - pr.right, pr.left - r.left));
      if(over > 1) out.push(`${desc(e)}+${over} ${txt}`);
    }
  }
  return { out: [...new Set(out)], cut: [...new Set(cut)] };
}"""

VIEWS = [
    ('ホーム', "() => goto('home', { nav: true })"),
    ('ガチャ', "() => goto('gacha', { nav: true })"),
    ('編成', "() => goto('party', { nav: true })"),
    ('探索メニュー', "() => { stageTab = 'menu'; goto('battle', { nav: true }); }"),
    ('メインクエスト', "() => { stageTab = 'main'; questTier = 'q1'; render(); }"),
    ('育成クエスト', "() => { stageTab = 'dungeon'; dungeonTab = 'exp'; render(); }"),
    ('深淵回廊', "() => { stageTab = 'abyss'; render(); }"),
    ('拠点', "() => goto('base', { nav: true })"),
    ('ショップ', "() => goto('shop', { nav: true })"),
    ('ミッション', "() => goto('missions', { nav: true })"),
    ('PVP', "() => goto('pvp', { nav: true })"),
    ('遺物', "() => goto('relics', { nav: true })"),
    ('ルーン', "() => goto('runes', { nav: true })"),
    ('図鑑', "() => goto('dex', { nav: true })"),
    ('メニュー', "() => { goto('home', { nav: true }); openOverlay('menu'); }"),
    ('フレンド', "() => { closeOverlay(); openOverlay('friends'); }"),
    ('設定', "() => { closeOverlay(); openOverlay('settings'); }"),
    ('お知らせ', "() => { closeOverlay(); openOverlay('notices'); }"),
    ('プレゼント', "() => { closeOverlay(); openOverlay('gifts'); }"),
    ('プロフィール', "() => { closeOverlay(); openOverlay('profile'); }"),
    ('スパーク交換', "() => { closeOverlay(); openOverlay('spark'); }"),
    ('称号一覧', "() => { closeOverlay(); closeModal(); openTitleList(); }"),
    ('キャラ詳細', "() => { closeModal(); goto('party', { nav: true }); detailTab = 'grow'; detailSkillOpen = false; showMonsterDetail('m06'); }"),
    ('キャラ詳細(装備)', "() => document.querySelector('[data-detail-tab=\\\"equip\\\"]').click()"),
    ('星刻', "() => showPromoteModal('m06')"),
    ('遺物詳細', "() => { closeModal(); showRelicDetail(Object.keys(RELICS)[0]); }"),
    ('アイテム詳細', "() => { closeModal(); openItemDetail('exp2'); }"),
    ('錬成', "() => { closeModal(); openAlchemy(); }"),
    ('排出率', "() => { closeModal(); openRatesModal('monster'); }"),
    ('戦闘', "() => { closeModal(); startBattle('tu1', { skipIntro: true }); }"),
]

SHEETS = [
    ('図鑑の絞り込み', "() => { closeModal(); goto('dex', { nav: true }); openFilterSheet('dex'); }"),
    ('編成の絞り込み', "() => { closeModal(); goto('party', { nav: true }); openFilterSheet('roster'); }"),
    ('遺物の絞り込み', "() => { closeModal(); goto('relics', { nav: true }); openRelicFilterSheet(); }"),
]

CHIPS = """() => {
  const sp = [...document.querySelectorAll('.fs-chip span')];
  const phone = document.getElementById('phone').getBoundingClientRect();
  return { n: sp.length,
    cut: sp.filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.innerText),
    out: [...document.querySelectorAll('.fs-chip')].filter(e => {
      const b = e.getBoundingClientRect(); return b.right > phone.right + 1 || b.left < phone.left - 1; }).length };
}"""

TBNAME = """() => { const n = document.querySelector('.tb-name');
  return { w: Math.round(n.clientWidth), sw: Math.round(n.scrollWidth) }; }"""


async def main():
    with game_url() as url:
        async with async_playwright() as p:
            b = await p.chromium.launch(**LAUNCH)
            for w in WIDTHS:
                pg = await b.new_page(viewport={'width': w, 'height': 860})
                await use_mock_auth(pg)
                errs = []
                pg.on('pageerror', lambda e: errs.append(str(e)))
                await pg.goto(url); await pg.wait_for_timeout(900)
                await start_as_guest(pg)
                await pg.evaluate(SETUP); await pg.wait_for_timeout(400)
                print(f'\n--- 幅 {w}px ---')

                out, cut = {}, {}
                for name, js in VIEWS:
                    await pg.evaluate(js)
                    await pg.wait_for_timeout(300)
                    r = await pg.evaluate(SCAN)
                    if r['out']: out[name] = r['out'][:3]
                    if r['cut']: cut[name] = r['cut'][:3]
                check('画面の外にはみ出す物がない', out == {}, out)
                check('省略(…)なしで切れている文字がない', cut == {}, cut)

                for name, js in SHEETS:
                    await pg.evaluate(js); await pg.wait_for_timeout(350)
                    r = await pg.evaluate(CHIPS)
                    check(f'{name}: チップのラベルが全部読める',
                          r['n'] > 0 and not r['cut'] and r['out'] == 0, r)
                    await pg.evaluate('() => closeModal()')

                await pg.evaluate("() => goto('home', { nav: true })")
                await pg.wait_for_timeout(300)
                tb = await pg.evaluate(TBNAME)
                ratio = round(100 * tb['w'] / tb['sw'])
                # 320pxは3つのピルで埋まるので全部は出せない。それでも半分以上は出す。
                # 名前は端末ごとに長さが違う(既定は「テイマー」+4文字)ので、1〜2px分は見逃す
                need = 50 if w < 360 else 95
                check(f'上のバーのプレイヤー名が読める({need}%以上)', ratio >= need, f'{ratio}% {tb}')

                check('JSエラーなし', not errs, errs[:2])
                await pg.close()
            await b.close()
    print('NG' if bad else 'すべて通過')
    return bad

sys.exit(asyncio.run(main()))
