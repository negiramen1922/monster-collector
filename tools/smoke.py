#!/usr/bin/env python3
"""起動スモークテスト。

- 主要画面を開いてJSエラーと横スクロール(375px)を確認する
- BGMが assets/bgm/ から読めているかを、HTTP経由(WebAudio)と file://(要素再生のフォールバック)の両方で確認する

使い方: CHROMIUM_PATH=/path/to/chrome python3 smoke.py   (スクリーンショットは smoke_<画面>.png)
"""
import asyncio, os, pathlib
from playwright.async_api import async_playwright
from _serve import game_url

OUT = pathlib.Path(__file__).resolve().parent
LAUNCH = {'executable_path': os.environ['CHROMIUM_PATH']} if os.environ.get('CHROMIUM_PATH') else {}
SCREENS = ['home', 'gacha', 'party', 'dex', 'battle', 'base', 'missions']
# give the save a small roster so every screen has something to draw
SETUP = """() => {
  ['m05','m15','m19','m20','m13','m24'].forEach(id => STATE.owned[id] = { star: MON_BY_ID[id].rarity, souls:0, level:3, skillLv:1, ultLv:1, passiveLv:1 });
  STATE.clearedStages = ['tu1','tu2','tu3','q1_01','q1_02','q1_03']; STATE.formationKey='f3'; STATE.slots=['m05','m15','m13','m19','m20'];
  render();
}"""

bad = 0


def check(name, cond, info=''):
    global bad
    bad += 0 if cond else 1
    print(('✅' if cond else '❌') + f' {name}' + (f'  {info}' if info != '' else ''))


async def open_game(p, url):
    b = await p.chromium.launch(**LAUNCH, args=['--autoplay-policy=no-user-gesture-required'])
    pg = await b.new_page(viewport={'width': 375, 'height': 667})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(url)
    await pg.wait_for_timeout(1200)
    await pg.evaluate(SETUP)
    await pg.wait_for_timeout(300)
    return b, pg, errs


async def screens(p, url):
    b, pg, errs = await open_game(p, url)
    print('title:', await pg.title())
    for s in SCREENS:
        await pg.evaluate(f"() => {{ goto('{s}'); render(); }}")
        await pg.wait_for_timeout(400)
        await pg.screenshot(path=str(OUT / f'smoke_{s}.png'))
        w = await pg.evaluate("() => document.documentElement.scrollWidth")
        check(f'{s} 画面', w <= 375, f'scrollWidth={w}')
    check('JSエラーなし', not errs, f'{len(errs)}件 {errs[:3]}')
    # bgm loads on the first user gesture
    await pg.mouse.click(1, 1)
    await pg.wait_for_timeout(2500)
    mode = await pg.evaluate("() => bgm.mode")
    loaded = await pg.evaluate("() => Object.entries(bgm.buffers).map(([k,b]) => [k, Math.round(b.duration)])")
    check('HTTP: WebAudioで再生', mode == 'webaudio' and await pg.evaluate("() => !!bgm.src"), f'mode={mode}')
    check('HTTP: 3曲デコード', len(loaded) == 3, str(sorted(loaded)))
    check('HTTP: ホームBGM', await pg.evaluate("() => bgm.key") == 'home')
    await b.close()


async def local_file(p, url):
    b, pg, errs = await open_game(p, url)
    await pg.mouse.click(1, 1)
    await pg.wait_for_timeout(2500)
    mode = await pg.evaluate("() => bgm.mode")
    playing = await pg.evaluate("() => !!bgm.el && !bgm.el.paused && bgm.el.currentTime > 0")
    check('file://: 要素再生にフォールバック', mode == 'element', f'mode={mode}')
    check('file://: ホームBGMが鳴っている', playing and await pg.evaluate("() => bgm.key") == 'home')
    check('file://: JSエラーなし', not errs, f'{len(errs)}件 {errs[:3]}')
    await b.close()


async def main():
    async with async_playwright() as p:
        with game_url() as url:
            await screens(p, url)
        with game_url(http=False) as url:
            await local_file(p, url)
    raise SystemExit(1 if bad else 0)


asyncio.run(main())
