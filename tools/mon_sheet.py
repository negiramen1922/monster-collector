#!/usr/bin/env python3
"""index.html から「モンスター資料」(立ち絵・能力・ワザの一覧ページ)を1枚のHTMLに書き出す。

モンスターを足したり数値を直したら、これを走らせ直せば資料が最新になる。資料そのものは
リポジトリに入れない(立ち絵のぶん3MBほどあり、index.htmlと同じ中身が二重になるため)。

使い方: python3 tools/mon_sheet.py [出力先.html]
        (省略時は /tmp/monster_sheet.html)
"""
import sys, re, json, pathlib, subprocess, tempfile, os

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path('/tmp/monster_sheet.html')

# ---- もとデータ: モンスターは game.js 経由(ワザは MONSTER_KITS にあり、mons.json には無い)
DUMP = r'''
const fs = require('fs');
const load = require(TOOLS + '/harness.js');
load(TOOLS + '/game.js', src => src +
  ';global.__x={MONSTERS,kitOf,MONSTER_PERKS,ELEM_LABEL,ROLE_LABEL,SPECIES_LABEL,SPECIES_ORDER,ELEM_ORDER,ELEM_COLOR,STAR_TABLE};');
const x = global.__x;
const wz = a => a && { name:a.name, desc:a.desc, ct:a.ct, sp:a.sp, atk:a.atk, tgt:a.tgt, pow:a.pow, hits:a.hits };
const mons = x.MONSTERS.map(m => {
  const k = x.kitOf(m), p = x.MONSTER_PERKS[m.id];
  return { id:m.id, name:m.name, desc:m.desc, element:m.element, rarity:m.rarity, role:m.role,
    family:m.family, species:m.species, sprite:m.sprite, statType:m.statType,
    hp:m.hp, str:m.str, pdef:m.pdef, mdef:m.mdef, spd:m.spd, hate:m.hate,
    normal:wz(k.normal), skill1:wz(k.skill1), skill2:wz(k.skill2), ult:wz(k.ult),
    passive: k.passive && { name:k.passive.name, desc:k.passive.desc },
    perks: p ? [6,7,8,9,10].filter(s => p[s]).map(s => ({ star:s, desc:p[s].desc })) : [] };
});
fs.writeFileSync(process.argv[2], JSON.stringify({ mons,
  elemLabel:x.ELEM_LABEL, roleLabel:x.ROLE_LABEL, speciesLabel:x.SPECIES_LABEL,
  elemOrder:x.ELEM_ORDER, speciesOrder:x.SPECIES_ORDER, elemColor:x.ELEM_COLOR,
  starTable:x.STAR_TABLE }));
'''

def build_data():
    tools = ROOT / 'tools'
    if not (tools / 'game.js').exists():
        subprocess.run([sys.executable, str(tools / 'extract.py')], check=True, cwd=tools)
    with tempfile.TemporaryDirectory() as td:
        js = pathlib.Path(td) / 'dump.js'
        js.write_text(f'const TOOLS = {json.dumps(str(tools))};\n' + DUMP, encoding='utf-8')
        out = pathlib.Path(td) / 'data.json'
        subprocess.run(['node', str(js), str(out)], check=True, cwd=tools,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return json.loads(out.read_text(encoding='utf-8'))

def sprites_for(ids):
    src = (ROOT / 'index.html').read_text(encoding='utf-8')
    all_sp = json.loads(re.search(
        r'<script id="sprite-data" type="application/json">(.*?)</script>', src, re.S).group(1))
    miss = [k for k in ids if k not in all_sp]
    if miss:
        raise SystemExit(f'立ち絵が見つかりません: {miss}')
    return {k: all_sp[k] for k in ids}

PAGE = r'''<title>モンスター資料</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Dela+Gothic+One&family=Zen+Kaku+Gothic+New:wght@400;500;700;900&display=swap">
<style>
/* 並び: 上に総数と内わけ、下に絞り込み + 立ち絵の格子。1体を押すと下から詳細シートが出る。
   色はゲーム本体のトークン(紫黒 + 金 + 属性色)をそのまま使う。暗い画面に寄せきった1枚もの。 */
:root{
  color-scheme: dark;
  --bg:#0f0c1a; --panel:#1d1830; --panel2:#251f3d; --panel3:#2c2549; --groove:#171225;
  --line:rgba(232,180,85,.18); --gold:#e8b455; --gold-deep:#c98f2e;
  --text:#f3ecdf; --dim:#a89bc9; --dim2:#8d82ab;
  --danger:#e0435a;
  --r1:#8f8fa0; --r2:#5cab52; --r3:#3aa0d6; --r4:#e8b455; --r5:#ffd9f0; --violet:#9269e0;
  --rainbow:linear-gradient(120deg,#ff8fd0,#ffe06a 25%,#7ee07a 50%,#6fb7ff 75%,#c79bff);
  --display:"Dela Gothic One","Zen Kaku Gothic New",system-ui,sans-serif;
  --body:"Zen Kaku Gothic New",system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;
  --gut:max(16px, env(safe-area-inset-left, 0px));
  --gut-r:max(16px, env(safe-area-inset-right, 0px));
}
*{ box-sizing:border-box; }
body{ margin:0; background:var(--bg); color:var(--text); font-family:var(--body); font-size:14px; line-height:1.6;
  background-image:radial-gradient(120% 60% at 50% 0,rgba(146,105,224,.14),transparent 70%); }
body::before{ content:""; position:fixed; inset:0 0 auto; height:env(safe-area-inset-top,0px); z-index:10; background:var(--groove); }
.wrap{ max-width:1100px; margin:0 auto; padding-left:var(--gut); padding-right:var(--gut-r); padding-block:0; }
h1,h2,h3{ text-wrap:balance; margin:0; }

/* ---- 見出し ---- */
header{ padding-block:28px 18px; border-bottom:1px solid var(--line); }
h1{ font-family:var(--display); font-size:clamp(26px,6.2vw,40px); line-height:1.25; letter-spacing:.01em;
  background:var(--rainbow); -webkit-background-clip:text; background-clip:text; color:transparent; }
.sub{ color:var(--dim); margin-top:8px; font-size:13px; }
.asof{ color:var(--dim2); font-size:12px; margin-top:4px; font-variant-numeric:tabular-nums; }

/* ---- 総数と内わけ ---- */
.totals{ display:flex; flex-wrap:wrap; gap:10px 26px; align-items:flex-end; padding-block:20px 6px; }
.big{ font-family:var(--display); font-size:clamp(40px,10vw,58px); line-height:.95; color:var(--gold); font-variant-numeric:tabular-nums; }
.big small{ font-family:var(--body); font-size:15px; font-weight:700; color:var(--dim); margin-left:6px; }
.rare-row{ display:flex; gap:6px; flex-wrap:wrap; }
.rare-chip{ display:flex; align-items:baseline; gap:5px; padding:5px 10px; border-radius:999px;
  background:var(--panel); border:1px solid var(--line); font-size:12px; font-weight:700; }
.rare-chip b{ font-size:15px; font-variant-numeric:tabular-nums; }

.breaks{ display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:14px; padding-block:14px 26px; }
.brk{ background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:14px 14px 12px; min-width:0; }
.brk h3{ font-size:12px; font-weight:700; letter-spacing:.12em; color:var(--dim); margin-bottom:12px; }
.bar{ display:grid; grid-template-columns:auto 1fr auto; gap:8px 10px; align-items:center; font-size:12.5px; }
.bar .nm{ white-space:nowrap; }
.bar .tr{ height:7px; border-radius:4px; background:var(--groove); overflow:hidden; min-width:0; }
.bar .tr i{ display:block; height:100%; border-radius:4px; }
.bar .n{ font-variant-numeric:tabular-nums; color:var(--dim); font-weight:700; }

/* ---- 絞り込み ---- */
.tools{ position:sticky; top:env(safe-area-inset-top,0px); z-index:9; background:rgba(15,12,26,.96);
  backdrop-filter:blur(8px); border-bottom:1px solid var(--line); }
.tools-in{ max-width:1100px; margin:0 auto; padding-left:var(--gut); padding-right:var(--gut-r); padding-block:10px 12px;
  display:flex; flex-direction:column; gap:8px; }
.frow{ display:flex; gap:6px; flex-wrap:wrap; align-items:center; }
.frow>.lab{ font-size:11px; font-weight:700; letter-spacing:.1em; color:var(--dim2); width:46px; flex:0 0 auto; }
.chip{ font:inherit; font-size:12px; font-weight:700; color:var(--dim); cursor:pointer;
  background:var(--panel); border:1px solid var(--line); border-radius:999px; padding:4px 11px; display:flex; align-items:center; gap:5px; }
.chip:hover{ color:var(--text); border-color:var(--gold-deep); }
.chip[aria-pressed="true"]{ color:#140f22; background:var(--gold); border-color:var(--gold); }
.chip .dot{ width:8px; height:8px; border-radius:50%; flex:0 0 auto; }
.chip .ct{ font-variant-numeric:tabular-nums; opacity:.65; font-weight:500; }
input[type=search]{ font:inherit; font-size:13px; color:var(--text); background:var(--groove);
  border:1px solid var(--line); border-radius:8px; padding:6px 10px; min-width:0; flex:1 1 140px; max-width:260px; }
select{ font:inherit; font-size:12px; font-weight:700; color:var(--text); background:var(--panel);
  border:1px solid var(--line); border-radius:8px; padding:5px 8px; }
.hits{ font-size:12px; color:var(--dim2); font-variant-numeric:tabular-nums; margin-left:auto; }
:focus-visible{ outline:2px solid var(--gold); outline-offset:2px; }

/* ---- 立ち絵の格子 ---- */
.grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(104px,1fr)); gap:10px; padding-block:18px 40px; }
.cell{ appearance:none; font:inherit; text-align:left; cursor:pointer; color:var(--text); min-width:0;
  background:var(--panel); border:1px solid var(--line); border-top:none; border-radius:10px;
  padding:0 0 8px; overflow:hidden; display:flex; flex-direction:column; }
.cell:hover{ background:var(--panel2); border-color:var(--gold-deep); }
.cell .top{ height:3px; }
.cell .art{ aspect-ratio:1/1; max-width:100%; width:100%; object-fit:contain; display:block;
  background:radial-gradient(60% 55% at 50% 72%,rgba(232,180,85,.12),transparent 70%); }
.cell .nm{ font-size:11px; font-weight:700; line-height:1.2; min-height:2.4em; padding:0 6px;
  display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.cell .mt{ display:flex; align-items:center; gap:4px; padding:3px 6px 0; font-size:10px; color:var(--dim); }
.cell .mt .st{ font-weight:700; font-variant-numeric:tabular-nums; }
.cell .mt .el{ width:9px; height:9px; border-radius:50%; flex:0 0 auto; }
.cell .mt .rl{ margin-left:auto; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0; }

/* ---- 表 ---- */
.tablewrap{ overflow-x:auto; padding-block:18px 40px; }
table{ border-collapse:collapse; font-size:12.5px; width:100%; min-width:720px; }
th,td{ padding:6px 9px; text-align:left; border-bottom:1px solid var(--line); white-space:nowrap; }
th{ position:sticky; top:0; background:var(--groove); color:var(--dim); font-size:11px; letter-spacing:.06em; z-index:1; }
td.n{ text-align:right; font-variant-numeric:tabular-nums; }
tbody tr{ cursor:pointer; }
tbody tr:hover{ background:var(--panel2); }

/* ---- 詳細シート ---- */
.sheet{ position:fixed; inset:0; z-index:20; display:flex; align-items:flex-end; justify-content:center;
  background:rgba(8,7,15,.72); padding-top:env(safe-area-inset-top,0px); }
.sheet-in{ width:100%; max-width:620px; max-height:92%; overflow-y:auto; background:var(--panel);
  border:1px solid var(--line); border-radius:16px 16px 0 0;
  padding-left:var(--gut); padding-right:var(--gut-r);
  padding-bottom:calc(28px + env(safe-area-inset-bottom,0px)); }
.sheet-bar{ position:sticky; top:0; background:var(--panel); padding-block:12px 8px; display:flex; align-items:center; gap:10px;
  border-bottom:1px solid var(--line); margin-bottom:14px; }
.sheet-bar h2{ font-size:18px; font-weight:900; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.sheet-bar .x{ margin-left:auto; appearance:none; font:inherit; font-size:18px; line-height:1; cursor:pointer;
  color:var(--dim); background:var(--groove); border:1px solid var(--line); border-radius:8px; width:34px; height:30px; flex:0 0 auto; }
.sheet-bar .x:hover{ color:var(--text); }
.hero{ display:flex; gap:14px; align-items:flex-start; }
.hero img{ width:132px; flex:0 0 auto; aspect-ratio:1/1; object-fit:contain;
  background:radial-gradient(60% 55% at 50% 72%,rgba(232,180,85,.14),transparent 70%); border-radius:10px; }
.hero .meta{ min-width:0; display:flex; flex-direction:column; gap:6px; }
.tags{ display:flex; flex-wrap:wrap; gap:5px; }
.tag{ font-size:11px; font-weight:700; padding:3px 8px; border-radius:999px; background:var(--panel3); border:1px solid var(--line); }
.hero .flavor{ font-size:12.5px; color:var(--dim); }
.hero .id{ font-size:11px; color:var(--dim2); font-variant-numeric:tabular-nums; }
.stats{ display:grid; grid-template-columns:repeat(auto-fit,minmax(78px,1fr)); gap:7px; margin-top:16px; }
.stat{ background:var(--groove); border:1px solid var(--line); border-radius:9px; padding:7px 9px; min-width:0; }
.stat .k{ font-size:10px; letter-spacing:.08em; color:var(--dim2); font-weight:700; }
.stat .v{ font-size:17px; font-weight:900; font-variant-numeric:tabular-nums; }
.note{ font-size:11.5px; color:var(--dim2); margin-top:8px; }
.sec{ font-size:11px; font-weight:700; letter-spacing:.14em; color:var(--dim); margin:22px 0 9px; }
.wz{ background:var(--groove); border:1px solid var(--line); border-radius:10px; padding:10px 12px; margin-bottom:7px; }
.wz .hd{ display:flex; align-items:baseline; gap:8px; flex-wrap:wrap; }
.wz .kind{ font-size:10px; font-weight:700; letter-spacing:.1em; color:var(--gold); }
.wz .nm{ font-size:14px; font-weight:900; }
.wz .cost{ font-size:11px; color:var(--dim2); font-variant-numeric:tabular-nums; margin-left:auto; }
.wz .ds{ font-size:12.5px; color:var(--dim); margin-top:3px; }
.perk{ display:grid; grid-template-columns:auto 1fr; gap:4px 10px; font-size:12.5px; }
.perk b{ color:var(--gold); font-variant-numeric:tabular-nums; white-space:nowrap; }
.perk span{ color:var(--dim); min-width:0; }
footer{ border-top:1px solid var(--line); padding-block:18px 34px; color:var(--dim2); font-size:12px; }
@media (prefers-reduced-motion:no-preference){ .sheet-in{ animation:up .18s ease-out; } @keyframes up{ from{ transform:translateY(14px); } } }
@media (max-width:420px){ .grid{ grid-template-columns:repeat(auto-fill,minmax(88px,1fr)); }
  .hero img{ width:100px; } .frow>.lab{ width:100%; } }
</style>

<header><div class="wrap">
  <h1>モンスター資料</h1>
  <p class="sub">いま遊べるモンスターの立ち絵・基礎値・ワザ・星刻特性。index.html のデータから書き出したもの。</p>
  <p class="asof" id="asof"></p>
</div></header>

<div class="wrap">
  <div class="totals">
    <div class="big" id="total">0<small>体</small></div>
    <div class="rare-row" id="rares"></div>
  </div>
  <div class="breaks" id="breaks"></div>
</div>

<div class="tools"><div class="tools-in">
  <div class="frow"><span class="lab">レア度</span><span id="f-rarity" class="frow"></span></div>
  <div class="frow"><span class="lab">属性</span><span id="f-elem" class="frow"></span></div>
  <div class="frow"><span class="lab">種族</span><span id="f-species" class="frow"></span></div>
  <div class="frow"><span class="lab">ロール</span><span id="f-role" class="frow"></span></div>
  <div class="frow">
    <input type="search" id="q" placeholder="名前・科・説明でさがす" aria-label="さがす">
    <select id="sort" aria-label="並べ替え">
      <option value="id">図鑑の順</option><option value="rarity">レア度が高い順</option>
      <option value="hp">HPが高い順</option><option value="str">STRが高い順</option>
      <option value="spd">SPDが速い順</option><option value="name">名前順</option>
    </select>
    <select id="view" aria-label="見かた"><option value="grid">立ち絵</option><option value="table">数値の表</option></select>
    <button class="chip" id="reset" type="button">ぜんぶ見る</button>
    <span class="hits" id="hits"></span>
  </div>
</div></div>

<div class="wrap"><div class="grid" id="grid"></div><div class="tablewrap" id="tablewrap" hidden></div></div>

<footer><div class="wrap">
  この資料は <code>tools/mon_sheet.py</code> が index.html から作っています。モンスターを足したら走らせ直してください。
</div></footer>

<script id="sheet-data" type="application/json">__DATA__</script>
<script id="sheet-art" type="application/json">__ART__</script>
<script>
const D = JSON.parse(document.getElementById('sheet-data').textContent);
const ART = JSON.parse(document.getElementById('sheet-art').textContent);
const MONS = D.mons, EL = D.elemLabel, RL = D.roleLabel, SL = D.speciesLabel, EC = D.elemColor;
const RARE_COLOR = { 1:'var(--r1)', 2:'var(--r2)', 3:'var(--r3)', 4:'var(--r4)', 5:'var(--r5)' };
const CYCLE = { fire:'grass', grass:'water', water:'fire', earth:'thunder', thunder:'wind', wind:'earth' };
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
const by = (k) => { const m = {}; MONS.forEach(x => m[x[k]] = (m[x[k]] || 0) + 1); return m; };
const fam = m => m.family || '(科なし)';   // m128〜m135 は科が未設定
MONS.forEach(m => m.famLabel = fam(m));   // 集計用。空欄も1つの区分として数える

document.getElementById('asof').textContent = D.builtAt + ' 現在 / 全' + MONS.length + '体';
document.getElementById('total').innerHTML = MONS.length + '<small>体</small>';
const rc = by('rarity');
document.getElementById('rares').innerHTML = [5,4,3,2,1].map(r =>
  `<span class="rare-chip" style="color:${RARE_COLOR[r]}">★${r}<b>${rc[r] || 0}</b></span>`).join('');

/* 内わけ: 属性・種族・ロール。数の多い順に並べ、棒の長さは一番多いものを基準にする */
function breakdown(title, key, label, color){
  const c = by(key), rows = Object.keys(c).sort((a, b) => c[b] - c[a]);
  const max = Math.max(...rows.map(k => c[k]));
  return `<div class="brk"><h3>${title}</h3><div class="bar">` + rows.map(k =>
    `<span class="nm">${esc(label[k] || k)}</span>
     <span class="tr"><i style="width:${(c[k] / max * 100).toFixed(1)}%;background:${color(k)}"></i></span>
     <span class="n">${c[k]}</span>`).join('') + '</div></div>';
}
document.getElementById('breaks').innerHTML =
  breakdown('属性', 'element', EL, k => EC[k]) +
  breakdown('種族', 'species', SL, () => 'var(--gold-deep)') +
  breakdown('ロール', 'role', RL, () => 'var(--violet)') +
  breakdown('科', 'famLabel', {}, k => k === '(科なし)' ? 'var(--danger)' : 'var(--dim2)');

/* ---- 絞り込み ---- */
const sel = { rarity:new Set(), element:new Set(), species:new Set(), role:new Set() };
function chips(host, key, keys, label, dot){
  const c = by(key);
  document.getElementById(host).innerHTML = keys.filter(k => c[k]).map(k =>
    `<button class="chip" type="button" data-k="${key}" data-v="${esc(k)}" aria-pressed="false">` +
    (dot ? `<i class="dot" style="background:${dot(k)}"></i>` : '') +
    `${esc(label[k] || k)}<span class="ct">${c[k]}</span></button>`).join('');
}
chips('f-rarity', 'rarity', [5,4,3,2,1], { 1:'★1',2:'★2',3:'★3',4:'★4',5:'★5' }, k => RARE_COLOR[k]);
chips('f-elem', 'element', D.elemOrder, EL, k => EC[k]);
chips('f-species', 'species', D.speciesOrder, SL, null);
chips('f-role', 'role', Object.keys(RL), RL, null);

document.querySelectorAll('.chip[data-k]').forEach(b => b.addEventListener('click', () => {
  const k = b.dataset.k, v = k === 'rarity' ? +b.dataset.v : b.dataset.v;
  if(sel[k].has(v)) sel[k].delete(v); else sel[k].add(v);
  b.setAttribute('aria-pressed', sel[k].has(v) ? 'true' : 'false');
  draw();
}));
document.getElementById('reset').addEventListener('click', () => {
  Object.values(sel).forEach(s => s.clear());
  document.querySelectorAll('.chip[data-k]').forEach(b => b.setAttribute('aria-pressed', 'false'));
  document.getElementById('q').value = '';
  draw();
});
['q', 'sort', 'view'].forEach(id => document.getElementById(id).addEventListener('input', draw));

function shown(){
  const q = document.getElementById('q').value.trim().toLowerCase();
  let list = MONS.filter(m =>
    (!sel.rarity.size || sel.rarity.has(m.rarity)) &&
    (!sel.element.size || sel.element.has(m.element)) &&
    (!sel.species.size || sel.species.has(m.species)) &&
    (!sel.role.size || sel.role.has(m.role)) &&
    (!q || (m.name + fam(m) + m.desc + m.id).toLowerCase().includes(q)));
  const s = document.getElementById('sort').value;
  const cmp = { id:(a,b) => a.id.localeCompare(b.id), name:(a,b) => a.name.localeCompare(b.name, 'ja'),
    rarity:(a,b) => b.rarity - a.rarity || a.id.localeCompare(b.id),
    hp:(a,b) => b.hp - a.hp, str:(a,b) => b.str - a.str, spd:(a,b) => b.spd - a.spd };
  return list.slice().sort(cmp[s]);
}

function draw(){
  const list = shown(), table = document.getElementById('view').value === 'table';
  document.getElementById('hits').textContent = list.length === MONS.length
    ? `全${MONS.length}体` : `${list.length} / ${MONS.length}体`;
  document.getElementById('grid').hidden = table;
  document.getElementById('tablewrap').hidden = !table;
  if(table){
    document.getElementById('tablewrap').innerHTML =
      '<table><thead><tr><th>No.</th><th>名前</th><th>★</th><th>属性</th><th>種族</th><th>ロール</th>' +
      '<th>科</th><th>傾向</th><th class="n">HP</th><th class="n">STR</th><th class="n">物防</th>' +
      '<th class="n">魔防</th><th class="n">SPD</th><th class="n">ヘイト</th></tr></thead><tbody>' +
      list.map(m => `<tr data-id="${m.id}"><td>${esc(m.id)}</td><td>${esc(m.name)}</td>
        <td style="color:${RARE_COLOR[m.rarity]}">★${m.rarity}</td>
        <td style="color:${EC[m.element]}">${esc(EL[m.element])}</td><td>${esc(SL[m.species])}</td>
        <td>${esc(RL[m.role])}</td><td>${esc(fam(m))}</td><td>${esc(m.statType)}</td>
        <td class="n">${m.hp}</td><td class="n">${m.str}</td><td class="n">${m.pdef}</td>
        <td class="n">${m.mdef}</td><td class="n">${m.spd}</td><td class="n">${m.hate}</td></tr>`).join('') +
      '</tbody></table>';
    document.querySelectorAll('tbody tr').forEach(tr => tr.addEventListener('click', () => open(tr.dataset.id)));
  } else {
    document.getElementById('grid').innerHTML = list.map(m => `
      <button class="cell" type="button" data-id="${m.id}">
        <span class="top" style="background:${RARE_COLOR[m.rarity]}"></span>
        <img class="art" src="${ART[m.sprite]}" alt="${esc(m.name)}の立ち絵" loading="lazy" decoding="async">
        <span class="mt"><i class="el" style="background:${EC[m.element]}"></i>
          <span class="st" style="color:${RARE_COLOR[m.rarity]}">★${m.rarity}</span>
          <span class="rl">${esc(RL[m.role])}</span></span>
        <span class="nm">${esc(m.name)}</span>
      </button>`).join('');
    document.querySelectorAll('.cell').forEach(c => c.addEventListener('click', () => open(c.dataset.id)));
  }
}

/* ---- 詳細シート ---- */
function matchup(e){
  if(e === 'none') return '無属性は、どの属性に対しても1.0倍(受けるときも1.0倍)';
  const win = e === 'light' ? 'dark' : e === 'dark' ? 'light' : CYCLE[e];
  const lose = e === 'light' ? 'dark' : e === 'dark' ? 'light'
    : Object.keys(CYCLE).find(k => CYCLE[k] === e);
  return `${EL[win]}に1.5倍 / ${EL[lose]}には0.7倍`;
}
function wzHtml(kind, a){
  if(!a) return '';
  const cost = a.sp ? `SP ${a.sp}` : a.ct ? `CT ${a.ct}` : '';
  const tp = a.atk === 'mag' ? '魔法' : a.atk === 'phys' ? '物理' : '';
  return `<div class="wz"><div class="hd"><span class="kind">${kind}</span><span class="nm">${esc(a.name)}</span>
    ${tp ? `<span class="kind" style="color:var(--dim2)">${tp}</span>` : ''}
    ${cost ? `<span class="cost">${cost}</span>` : ''}</div>
    <div class="ds">${esc(a.desc || '')}</div></div>`;
}
let sheet = null;
function open(id){
  const m = MONS.find(x => x.id === id);
  close();
  sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.innerHTML = `<div class="sheet-in" role="dialog" aria-modal="true" aria-label="${esc(m.name)}">
    <div class="sheet-bar"><h2 style="color:${RARE_COLOR[m.rarity]}">${esc(m.name)}</h2>
      <button class="x" type="button" aria-label="閉じる">×</button></div>
    <div class="hero">
      <img src="${ART[m.sprite]}" alt="${esc(m.name)}の立ち絵">
      <div class="meta">
        <div class="tags">
          <span class="tag" style="color:${RARE_COLOR[m.rarity]}">★${m.rarity}</span>
          <span class="tag" style="color:${EC[m.element]}">${esc(EL[m.element])}</span>
          <span class="tag">${esc(RL[m.role])}</span>
          <span class="tag">${esc(SL[m.species])}</span>
          <span class="tag"${m.family ? '' : ' style="color:var(--danger)"'}>${esc(fam(m))}</span>
        </div>
        <p class="flavor">${esc(m.desc)}</p>
        <p class="id">${esc(m.id)} / 立ち絵 ${esc(m.sprite)} / 傾向 ${esc(m.statType)}</p>
      </div>
    </div>
    <div class="stats">
      ${[['HP', m.hp], ['STR', m.str], ['物理防御', m.pdef], ['魔法防御', m.mdef], ['SPD', m.spd], ['ヘイト', m.hate]]
        .map(([k, v]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('')}
    </div>
    <p class="note">Lv1・★${m.rarity}のときの基礎値。★1つで HP・STR・防御が+10%、Lv1つで+3%。
      ★${m.rarity}のLv上限は${D.starTable[m.rarity].lvCap}、★10で300。<br>相性: ${matchup(m.element)}</p>
    <div class="sec">ワザ</div>
    ${wzHtml('通常', m.normal)}${wzHtml('スキル1', m.skill1)}${wzHtml('スキル2', m.skill2)}${wzHtml('奥義', m.ult)}
    ${m.passive ? `<div class="sec">パッシブ</div>${wzHtml('常時', m.passive)}` : ''}
    ${m.perks.length ? `<div class="sec">星刻特性</div><div class="perk">` +
      m.perks.map(p => `<b>★${p.star}</b><span>${esc(p.desc)}</span>`).join('') + '</div>' : ''}
    <p class="note">スキル2は★4から使えます。スキル・奥義のLv上限は10、パッシブは5。</p>
  </div>`;
  document.body.appendChild(sheet);
  document.body.style.overflow = 'hidden';
  sheet.querySelector('.x').addEventListener('click', close);
  sheet.addEventListener('click', e => { if(e.target === sheet) close(); });
  sheet.querySelector('.x').focus();
}
function close(){
  if(sheet) sheet.remove();
  sheet = null;
  document.body.style.overflow = '';
}
document.addEventListener('keydown', e => { if(e.key === 'Escape') close(); });
draw();
</script>
'''

def main():
    data = build_data()
    data['builtAt'] = __import__('datetime').date.today().strftime('%Y年%-m月%-d日')
    art = sprites_for([m['sprite'] for m in data['mons']])
    html = (PAGE
            .replace('__DATA__', json.dumps(data, ensure_ascii=False))
            .replace('__ART__', json.dumps(art)))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(html, encoding='utf-8')
    print(f'{OUT} に書き出しました ({len(html) / 1024 / 1024:.2f} MB / {len(data["mons"])}体)')

if __name__ == '__main__':
    main()
