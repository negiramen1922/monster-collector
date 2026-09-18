#!/usr/bin/env python3
"""素材のPNGを `icon-data` に入る形に変換して index.html に書き込む。

素材は assets/source/ に置きます。
やること: マゼンタ背景を抜く → 左上の「AI」バッジを消す → 余白を詰める → 96px角にして
data URI(PNG)にし、`icon-data` の指定キーへ入れる。画像処理はChromiumのcanvasで行う
(この環境にはPillowもImageMagickも無いため)。

使い方: CHROMIUM_PATH=/path/to/chrome python3 make_icons.py
"""
import asyncio, base64, json, os, pathlib, re
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
LAUNCH = {'executable_path': os.environ['CHROMIUM_PATH']} if os.environ.get('CHROMIUM_PATH') else {}
SIZE = 96          # 既存の role_/tribe_ アイコンと同じ大きさ
BADGE = 0.08       # 左上のバッジを消す範囲(縦横の割合)
MARGIN = 0.04      # 切り出しに残す余白(短辺に対する割合)

# 素材ファイル → icon-data のキー
ICONS = {
  'icon_flame.png':        'elem_fire',
  'icon_waterdrop.png':    'elem_water',
  'icon_leaf.png':         'elem_grass',
  'icon_mountain.png':     'elem_earth',
  'icon_lightning.png':    'elem_thunder',
  'icon_whirlpool.png':    'elem_wind',
  'icon_sun.png':          'elem_light',
  'icon_crescent_moon.png':'elem_dark',
  'icon_planet.png':       'elem_none',
}

CONVERT = """
async ({ dataUrl, size, badge, margin }) => {
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
  const w = img.naturalWidth, h = img.naturalHeight;
  const src = document.createElement('canvas');
  src.width = w; src.height = h;
  const sx = src.getContext('2d', { willReadFrequently: true });
  sx.drawImage(img, 0, 0);
  const id = sx.getImageData(0, 0, w, h);
  const px = id.data;

  // 背景色は右上の角から拾う(左上はバッジがある)
  const at = (x, y) => { const i = (y * w + x) * 4; return [px[i], px[i+1], px[i+2]]; };
  const bg = at(w - 3, 2);
  const near = (r, g, b) => Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]) < 110;

  const bx = Math.round(w * badge), by = Math.round(h * badge);
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for(let y = 0; y < h; y++){
    for(let x = 0; x < w; x++){
      const i = (y * w + x) * 4;
      if(near(px[i], px[i+1], px[i+2]) || (x < bx && y < by)){ px[i+3] = 0; continue; }
      if(x < minX) minX = x;
      if(y < minY) minY = y;
      if(x > maxX) maxX = x;
      if(y > maxY) maxY = y;
    }
  }
  if(maxX < 0) throw new Error('no content left after keying out the background');
  sx.putImageData(id, 0, 0);

  // 余白を足して正方形に切り出し、縦横比を保ったまま縮小する
  let cw = maxX - minX + 1, ch = maxY - minY + 1;
  const pad = Math.round(Math.min(cw, ch) * margin);
  minX -= pad; minY -= pad; cw += pad * 2; ch += pad * 2;
  const out = document.createElement('canvas');
  out.width = size; out.height = size;
  const ox = out.getContext('2d');
  ox.imageSmoothingEnabled = true;
  ox.imageSmoothingQuality = 'high';
  const scale = Math.min(size / cw, size / ch);
  const dw = Math.round(cw * scale), dh = Math.round(ch * scale);
  ox.drawImage(src, minX, minY, cw, ch, Math.round((size - dw) / 2), Math.round((size - dh) / 2), dw, dh);
  return { url: out.toDataURL('image/png'), box: [minX, minY, cw, ch], src: [w, h] };
}
"""

async def main():
    html = ROOT / 'index.html'
    s = html.read_text(encoding='utf-8')
    m = re.search(r'(<script id="icon-data" type="application/json">)(.*?)(</script>)', s, re.S)
    data = json.loads(m.group(2))

    async with async_playwright() as p:
        b = await p.chromium.launch(**LAUNCH)
        pg = await b.new_page()
        for name, key in ICONS.items():
            f = ROOT / 'assets' / 'source' / name
            if not f.exists():
                print(f'❌ {name} が見つかりません')
                continue
            src = 'data:image/png;base64,' + base64.b64encode(f.read_bytes()).decode()
            out = await pg.evaluate(CONVERT, { 'dataUrl': src, 'size': SIZE, 'badge': BADGE, 'margin': MARGIN })
            data[key] = out['url']
            kb = len(base64.b64decode(out['url'].split(',')[1])) / 1024
            print(f"✅ {name:24s} → {key:12s} {out['src'][0]}px → {SIZE}px  {kb:.1f}KB  crop={out['box']}")
        await b.close()

    s = s[:m.start(2)] + json.dumps(data, ensure_ascii=False) + s[m.end(2):]
    html.write_text(s, encoding='utf-8')
    print(f'icon-data に {len(ICONS)} 件を書き込みました  (index.html {html.stat().st_size / 1024 / 1024:.2f}MB)')

asyncio.run(main())
