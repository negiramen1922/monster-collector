# -*- coding: utf-8 -*-
"""お知らせバナー(960x540)を、ゲームのスプライトと同じ版面で組む。
   既存の ann_ev_fenrir / ann_ev_abaddon に合わせてある。"""
import re, json, base64, io, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SRC = '/home/user/monster-collector/index.html'
OUT = '/tmp/claude-0/-home-user-monster-collector/07e3a820-f360-57bd-8a3f-3072a7fc0146/scratchpad/'
F = '/usr/share/fonts/truetype/fonts-japanese-gothic.ttf'
W, H = 960, 540

s = open(SRC, encoding='utf-8').read()
SPR = json.loads(re.search(r'<script id="sprite-data" type="application/json">(.*?)</script>', s, re.S).group(1))
def sprite(mid):
    v = SPR[mid.replace('m','')]
    return Image.open(io.BytesIO(base64.b64decode(v.split(',',1)[1] if v.startswith('data:') else v))).convert('RGBA')
def fnt(sz, bold=True): return ImageFont.truetype(F, sz)

def banner(cfg):
    import math
    base = Image.new('RGB', (W, H), cfg['bg'])
    cx, cy = 690, 250
    # 放射の筋(元のバナーと同じ、円の後ろから伸びる光)
    rays = Image.new('L', (W, H), 0)
    rd = ImageDraw.Draw(rays)
    for i in range(36):
        a0 = math.radians(i * 10); a1 = a0 + math.radians(4.6)
        rd.polygon([(cx, cy),
                    (cx + 900*math.cos(a0), cy + 900*math.sin(a0)),
                    (cx + 900*math.cos(a1), cy + 900*math.sin(a1))], fill=70)
    rays = rays.filter(ImageFilter.GaussianBlur(3))
    base = Image.composite(Image.new('RGB', (W, H), cfg['glow']), base, rays)
    # 中心に絞った光
    glow = Image.new('L', (W, H), 0)
    gd = ImageDraw.Draw(glow)
    for r, a in [(400, 26), (300, 46), (200, 72), (120, 100)]:
        gd.ellipse([cx-r, cy-r, cx+r, cy+r], fill=a)
    glow = glow.filter(ImageFilter.GaussianBlur(80))
    base = Image.composite(Image.new('RGB', (W, H), cfg['glow']), base, glow)
    # 左は文字を置くので暗く落とす
    shade = Image.new('L', (W, H), 0)
    sd = ImageDraw.Draw(shade)
    for x in range(0, 520, 8): sd.rectangle([x, 0, x+8, H], fill=int(215 * (1 - x/520) ** 0.8))
    base = Image.composite(Image.new('RGB', (W, H), cfg['bg']), base, shade)
    # 背後の円(日輪/月)
    d = ImageDraw.Draw(base, 'RGBA')
    d.ellipse([cx-152, cy-152, cx+152, cy+152], fill=cfg['disc'] + (70,))
    d.ellipse([cx-138, cy-138, cx+138, cy+138], fill=cfg['disc'] + (190,))
    layer = Image.new('RGBA', (W, H), (0,0,0,0))

    # スプライト(大きいボスを手前、★4を奥に)
    for mid, box, tag, new in cfg['mons']:
        im = sprite(mid)
        bb = im.getchannel('A').getbbox()
        im = im.crop(bb)
        k = box[2] / max(im.size)
        im = im.resize((max(1,int(im.width*k)), max(1,int(im.height*k))), Image.LANCZOS)
        px, py = box[0] - im.width//2, box[1] - im.height//2
        sh = Image.new('RGBA', im.size, (0,0,0,0)); sh.putalpha(im.getchannel('A'))
        layer.alpha_composite(Image.new('RGBA', im.size, (0,0,0,120)).copy().resize(im.size), (px+5, py+7)) if False else None
        layer.alpha_composite(im, (px, py))
        # 名札
        ld = ImageDraw.Draw(layer, 'RGBA')
        f = fnt(16)
        t = tag
        tw = ld.textlength(t, font=f)
        extra = ld.textlength(' NEW', font=fnt(12)) if new else 0
        bw, bh = tw + extra + 26, 28
        bx, by = cfg['tagpos'].pop(0)
        ld.rounded_rectangle([bx, by, bx+bw, by+bh], 14, fill=(18,14,30,235), outline=cfg['accent']+(255,), width=2)
        ld.text((bx+13, by+bh/2), t, font=f, fill=(255,255,255,255), anchor='lm')
        if new: ld.text((bx+13+tw+6, by+bh/2+1), 'NEW', font=fnt(12), fill=cfg['accent']+(255,), anchor='lm')
    base = Image.alpha_composite(base.convert('RGBA'), layer).convert('RGB')
    d = ImageDraw.Draw(base, 'RGBA')

    # 左上のピル
    f = fnt(19)
    d.rounded_rectangle([28, 26, 28+110, 26+36], 18, fill=cfg['accent']+(255,))
    d.text((83, 44), 'EVENT', font=f, fill=(16,12,26,255), anchor='mm')
    d.rounded_rectangle([150, 29, 150+86, 29+30], 15, fill=(255,255,255,42))
    d.text((193, 44), '期間限定', font=fnt(14), fill=(236,230,250,255), anchor='mm')

    # タイトル
    ft = fnt(62)
    d.text((34, 82), cfg['title'], font=ft, fill=(0,0,0,150))          # 落ち影
    for r in range(5, 0, -1):
        for dx in range(-r, r+1):
            for dy in range(-r, r+1):
                if dx*dx + dy*dy <= r*r: d.text((30+dx, 76+dy), cfg['title'], font=ft, fill=(8,5,16,255))
    d.text((30, 76), cfg['title'], font=ft, fill=(255,255,255,255))
    d.text((30, 76), cfg['title'], font=ft, fill=cfg['accent']+(190,))
    d.text((32, 150), cfg['lead'], font=fnt(16), fill=(226,218,244,255))

    # 期間
    d.rectangle([30, 182, 34, 216], fill=cfg['accent']+(255,))
    d.text((46, 199), cfg['dates'], font=fnt(21), fill=(255,255,255,255), anchor='lm')

    # 箇条書き
    y = 248
    for line in cfg['bullets']:
        d.polygon([(40, y+2), (49, y+11), (40, y+20), (31, y+11)], fill=cfg['accent']+(255,))
        d.text((60, y+11), line, font=fnt(19), fill=(244,240,255,255), anchor='lm')
        y += 44

    # 下のピル
    d.rounded_rectangle([30, 466, 30+330, 466+40], 20, fill=cfg['accent']+(255,))
    d.text((195, 486), '▶ 詳細はゲーム内「お知らせ」から', font=fnt(16), fill=(16,12,26,255), anchor='mm')
    return base

DATES = '10/1(水) 16:00 〜 10/7(火) 23:59'
kyubi = dict(bg=(20,9,14), glow=(150,52,30), disc=(255,150,70), accent=(255,170,92),
  title='紅蓮の九尾', lead='狐火を操る大妖怪、九尾の狐', dates=DATES,
  bullets=['★5 九尾の狐 ピックアップ', '★4 牛鬼・ロキ ピックアップ', 'EXステージ「狐火の祭壇」', '★4に星刻が付きます'],
  mons=[('m150',(600,180,190),'★4 ロキ',True), ('m170',(830,210,230),'★4 牛鬼',True), ('m116',(690,390,280),'★5 九尾の狐',False)],
  tagpos=[(470,268),(792,74),(598,498)])
titan = dict(bg=(18,14,8), glow=(150,110,30), disc=(255,214,120), accent=(240,200,96),
  title='黄金の巨神', lead='黄金の鎧をまとう神話の巨人、タイタン', dates=DATES,
  bullets=['★5 タイタン ピックアップ', '★4 ブロック・スルト ピックアップ', 'EXステージ「巨神の遺跡」', '★4に星刻が付きます'],
  mons=[('m53',(600,180,190),'★4 スルト',False), ('m144',(830,210,230),'★4 ブロック',False), ('m54',(690,390,280),'★5 タイタン',False)],
  tagpos=[(470,268),(784,74),(604,498)])
for name, cfg in [('ann_ev_kyubi', kyubi), ('ann_ev_titan', titan)]:
    banner(cfg).save(OUT + name + '.png')
    print('wrote', name)
