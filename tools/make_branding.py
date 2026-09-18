#!/usr/bin/env python3
"""公開用の画像を作る: favicon(64/180) と OGP画像(1200x630)。

index.html の中の立ち絵・属性アイコンをそのまま使って組み、assets/ に書き出す。
描画はChromiumで行う(この環境にはPillowもImageMagickも無いため)。

使い方: CHROMIUM_PATH=/path/to/chrome python3 make_branding.py
"""
import asyncio, base64, json, os, pathlib, re
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets'
LAUNCH = {'executable_path': os.environ['CHROMIUM_PATH']} if os.environ.get('CHROMIUM_PATH') else {}
FACE = '31'            # 立ち絵のID(数字部分): ガチャのピックアップ
CAST = ['116', '54', '113', '68']   # OGPに並べる面子

def read_block(s, ident):
    return json.loads(re.search(rf'<script id="{ident}" type="application/json">(.*?)</script>', s, re.S).group(1))

def sprite(sprites, key):
    art = sprites[key]
    return art if art.startswith('data:') else 'data:image/png;base64,' + art

FAVICON = """
<!DOCTYPE html><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;background:transparent}
  .f{width:SIZEpx;height:SIZEpx;border-radius:22%;background:linear-gradient(160deg,#2c2549,#15111f);
     box-shadow:inset 0 0 0 RINGpx #e8b455;display:flex;align-items:center;justify-content:center;overflow:hidden}
  .f img{width:82%;height:82%;object-fit:contain;image-rendering:auto}
</style><div class="f"><img src="SRC"></div>
"""

OGP = """
<!DOCTYPE html><meta charset="utf-8"><style>
  @import url('https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@800&family=Press+Start+2P&display=swap');
  html,body{margin:0;padding:0}
  body{width:1200px;height:630px;background:radial-gradient(120% 90% at 50% 0%,#241d3d 0%,#0f0c1a 70%);
       font-family:'M PLUS Rounded 1c',sans-serif;color:#f3ecdf;display:flex;flex-direction:column;
       align-items:center;justify-content:center;gap:26px;position:relative;overflow:hidden}
  .logo{font-family:'Press Start 2P',monospace;font-size:52px;color:#e8b455;letter-spacing:2px}
  .sub{font-size:24px;color:#a89bc9;letter-spacing:1px}
  .cast{display:flex;align-items:flex-end;gap:26px;margin-top:6px}
  .cast img{height:210px;image-rendering:auto;filter:drop-shadow(0 12px 18px rgba(0,0,0,.55))}
  .elems{display:flex;gap:14px;margin-top:4px}
  .elems img{width:46px;height:46px}
  .edge{position:absolute;left:0;right:0;height:6px;background:linear-gradient(90deg,#e2572b,#e0c93a,#5cab52,#3aa0d6,#9269e0)}
  .edge.t{top:0} .edge.b{bottom:0}
</style>
<div class="edge t"></div>
<div class="logo">MONSTER</div>
<div class="sub">105体のモンスターを集めて冒険する、ブラウザで遊べる収集RPG</div>
<div class="cast">CAST</div>
<div class="elems">ELEMS</div>
<div class="edge b"></div>
"""

async def shot(pg, html, path, size):
    await pg.set_viewport_size({'width': size[0], 'height': size[1]})
    await pg.set_content(html)
    await pg.wait_for_timeout(700)
    await pg.screenshot(path=str(path), omit_background=True)
    print(f'✅ {path.relative_to(ROOT)}  {size[0]}x{size[1]}  {path.stat().st_size / 1024:.1f}KB')

async def main():
    s = (ROOT / 'index.html').read_text(encoding='utf-8')
    sprites = read_block(s, 'sprite-data')
    icons = read_block(s, 'icon-data')
    OUT.mkdir(exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(**LAUNCH)
        pg = await b.new_page()
        face = sprite(sprites, FACE)
        for size, ring, name in [(64, 3, 'favicon.png'), (180, 7, 'icon-180.png')]:
            html = FAVICON.replace('SIZE', str(size)).replace('RING', str(ring)).replace('SRC', face)
            await shot(pg, html, OUT / name, (size, size))
        cast = ''.join(f'<img src="{sprite(sprites, k)}">' for k in CAST)
        elems = ''.join(f'<img src="{icons["elem_" + e]}">' for e in ['fire', 'water', 'grass', 'thunder', 'light', 'dark'])
        await shot(pg, OGP.replace('CAST', cast).replace('ELEMS', elems), OUT / 'ogp.png', (1200, 630))
        await b.close()

asyncio.run(main())
