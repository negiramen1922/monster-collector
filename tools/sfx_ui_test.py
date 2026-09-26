#!/usr/bin/env python3
"""効果音: すべて合成音(GAME_SFX)で、どの名前を鳴らしてもエラーにならない。戦闘・操作で呼ばれる音がすべて定義されている。
使い方: CHROMIUM_PATH=/path/to/chrome python3 tools/sfx_ui_test.py"""
import asyncio, os, pathlib, sys, re
from playwright.async_api import async_playwright
from _serve import game_url, use_mock_auth, start_as_guest

LAUNCH = {'executable_path': os.environ['CHROMIUM_PATH']} if os.environ.get('CHROMIUM_PATH') else {}
bad = 0
def check(name, cond, info=''):
    global bad
    bad += 0 if cond else 1
    print(('✅' if cond else '❌') + f' {name}' + (f'  {info}' if info != '' else ''))

SRC = (pathlib.Path(__file__).parent.parent / 'index.html').read_text()
called = set(re.findall(r"playSfx\('([A-Za-z]+)'", SRC)) | set(re.findall(r"return '([A-Za-z]+)';", SRC[SRC.index('function uiSfxFor'):SRC.index('function uiSfxFor') + 4000]))

async def main():
    with game_url() as url:
        async with async_playwright() as p:
            b = await p.chromium.launch(**LAUNCH, args=['--autoplay-policy=no-user-gesture-required'])
            pg = await b.new_page(viewport={'width': 390, 'height': 820})
            await use_mock_auth(pg)
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(url); await pg.wait_for_timeout(900)
            await start_as_guest(pg)
            await pg.evaluate("async () => { clearGuideToast(); await sfxInit(); }")
            names = await pg.evaluate("() => Object.keys(GAME_SFX)")
            missing = sorted(n for n in called if n not in names and n != 'battle')
            check('コードで鳴らしている音はすべて合成音に定義されている', not missing, missing)
            check('音源ファイル(sfx-data)は使っていない', await pg.evaluate("() => !document.getElementById('sfx-data') && typeof SFX_DATA === 'undefined'"))
            res = await pg.evaluate("""() => { const out = []; for(const n of Object.keys(GAME_SFX)){ try{ sfx.lastAt = {}; playSfx(n, 0, 2); out.push(n); }catch(e){ return 'ERR ' + n + ' ' + e; } } return out.length; }""")
            check('すべての効果音を鳴らしてもエラーにならない', res == len(names), [res, len(names)])
            # 戦闘を1回まわして、効果音の呼び出しでエラーが出ない
            await pg.evaluate("() => { STATE.sfx = { on: true, vol: 0.7 }; STATE.battleSpeed = 3; STATE.autoUlt = true; saveState(); startBattle('tu1', { skipIntro: true }); }")
            await pg.wait_for_timeout(9000)
            check('戦闘中に効果音でエラーが出ない', not errs, errs[:3])
            await b.close()
    print('NG' if bad else 'すべて通過')
    return bad
sys.exit(asyncio.run(main()))
