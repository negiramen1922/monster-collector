"""説明文の中の用語を押すと説明が出る。閉じたら元のモーダルに戻る(スクロール位置も)。
   使い方: CHROMIUM_PATH=/opt/pw-browsers/chromium python3 tools/term_help_ui_test.py"""
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
            pg = await b.new_page(viewport={'width': 420, 'height': 1000})
            await use_mock_auth(pg)
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(url); await pg.wait_for_timeout(900)
            await start_as_guest(pg)
            # 九尾(やけど持ち)の詳細
            await pg.evaluate("""() => { clearGuideToast(); closeModal && closeModal(); STATE.announceQueue = [];
              STATE.owned.m116 = { star:7, souls:0, level:120, exp:0, skillLv:8, skill2Lv:8, ultLv:8, passiveLv:8 };
              goto('monsters'); render(); showMonsterDetail('m116'); }""")
            await pg.wait_for_timeout(300)

            n = await pg.locator('.term').count()
            check('説明文の中の用語が押せる形になっている', n >= 3, n)
            color = await pg.evaluate("() => getComputedStyle(document.querySelector('.term')).color")
            gold = await pg.evaluate("() => getComputedStyle(document.documentElement).getPropertyValue('--gold').trim()")
            check('用語の色が数字の黄色と別', color and 'rgb(111, 211, 224)' in color, (color, gold))
            deco = await pg.evaluate("() => getComputedStyle(document.querySelector('.term')).borderBottomStyle")
            check('下線が点線で付いている', deco == 'dotted', deco)

            # スクロールしてから やけど を押す
            await pg.evaluate("() => { const el = document.querySelector('.detail-modal'); if(el) el.scrollTop = 600; }")
            await pg.wait_for_timeout(150)
            await pg.evaluate("() => [...document.querySelectorAll('.term')].find(e => e.dataset.term === 'burn').click()")
            await pg.wait_for_timeout(250)
            title = await pg.locator('.term-top h3').inner_text()
            body = await pg.locator('.term-body').inner_text()
            check('やけどの説明が出る', title == 'やけど' and 'STR' in body, (title, body[:30]))
            check('説明の中の数字が定数から出ている(STRの40%・2ターン)', '40%' in body and '2ターン' in body, body)

            # やけど → 延焼 に飛べる
            await pg.evaluate("() => [...document.querySelectorAll('.term-modal .term')].find(e => e.dataset.term === 'spread').click()")
            await pg.wait_for_timeout(250)
            t2 = await pg.locator('.term-top h3').inner_text()
            b2 = await pg.locator('.term-body').inner_text()
            check('やけどの説明から延焼へ飛べる', t2 == '延焼', t2)
            check('延焼の説明に重ねがけの話が入っている', 'もう一度' in b2 and '50%' in b2, b2[:50])

            # 閉じると元のモーダルに戻り、スクロール位置も残る
            await pg.evaluate("() => document.querySelector('[data-term-close]').click()")
            await pg.wait_for_timeout(250)
            back = await pg.locator('.detail-modal').count()
            top = await pg.evaluate("() => { const el = document.querySelector('.detail-modal'); return el ? el.scrollTop : -1; }")
            check('閉じるとモンスター詳細に戻る', back == 1, back)
            check('スクロール位置も残る', top == 600, top)
            check('用語の説明はもう出ていない', await pg.locator('.term-modal').count() == 0)

            # ステージ効果のラベルでも押せる
            # どのイベントが開催中かで変わらないように、用語が出るステージを自分で探す
            sid = await pg.evaluate("""() => { closeModal && closeModal();
              const st = STAGES.find(s => (s.rules || []).some(r => markTerms(r.label || '').includes('data-term=')));
              if(!st) return null;
              const ev = EVENTS.find(e => st.id.startsWith(e.key + '_'));
              if(ev){ ev.startAt = '2026-09-01T00:00:00+09:00'; ev.endAt = '2099-01-01T00:00:00+09:00'; }
              STATE.clearedStages = STAGES.map(s => s.id);
              goto('battle'); render(); stageSheet = st.id; renderStageSheet(); return st.id; }""")
            await pg.wait_for_timeout(300)
            terms = await pg.evaluate("() => [...document.querySelectorAll('.sr-row .term')].map(e => e.dataset.term)")
            check('ステージ効果の中の用語も押せる', len(terms) > 0, (sid, terms))
            await pg.evaluate("() => document.querySelector('.sr-row .term').click()")
            await pg.wait_for_timeout(250)
            check('ステージ効果からも説明が開く', await pg.locator('.term-modal').count() == 1)
            await pg.evaluate("() => document.querySelector('[data-term-close]').click()")
            await pg.wait_for_timeout(250)
            check('閉じるとステージ詳細に戻る', await pg.locator('.stage-sheet').count() == 1)

            check('JSエラーなし', not errs, errs)
            await b.close()
    sys.exit(1 if bad else 0)

asyncio.run(main())
