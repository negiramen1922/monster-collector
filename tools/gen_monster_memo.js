/* モンスターの開発メモ(docs/モンスター設計メモ.md)を作り直す。
   - 技の中身(名前・説明・CT・SP)は、いまの game.js から毎回読む。手で書き写さないので古くならない
   - 想定の役割・動き・技ごとの意図・星刻特性の方針は docs/design/モンスター設計メモ.json に書く(こちらが正)
   - 傾向(アーキタイプ)は docs/design/既存キャラの傾向.json と 新規モンスター30体.json から補う

   使い方(リポジトリの根で):
     python3 tools/extract.py index.html   # game.js を最新にする
     node tools/gen_monster_memo.js         # md を書き出す
     node tools/gen_monster_memo.js --check # md が最新でなければ exit 1 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const load = require('./harness.js');
console.error = () => {}; console.warn = () => {};

const api = load(path.join(__dirname, 'game.js'),
  s => s + ';global.__m={MONSTER_KITS,MONSTER_PERKS,ELEM_LABEL,ROLE_LABEL,SPECIES_LABEL,ultSpCostFor,skillSlotsFor};');
const G = global.__m;
const design = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/design', f), 'utf8'));
const memo = design('モンスター設計メモ.json');
const arch = design('既存キャラの傾向.json').data;
const newArch = Object.fromEntries(design('新規モンスター30体.json').data.map(m => [m.n, m.arch]));

const SLOTS = [['normal', '通常攻撃'], ['skill1', 'スキル1'], ['skill2', 'スキル2'], ['passive', 'パッシブ'], ['ult', '奥義']];
const esc = s => String(s == null ? '' : s).replace(/\|/g, '｜').replace(/\n/g, ' ');
const label = o => typeof o === 'string' ? o : (o && (o.ja || o.name)) || '';

function kitRows(m){
  const k = G.MONSTER_KITS[m.id] || {};
  return SLOTS.map(([key, ja]) => {
    const a = k[key];
    if(!a) return `| ${ja} | — | (ロール標準) |`;
    let head = ja;
    if(key.startsWith('skill') && a.ct) head += `(CT${a.ct})`;
    if(key === 'ult' && a.sp){
      const v2 = G.ultSpCostFor(m.role, a.sp);
      head += v2 === a.sp ? `(SP${a.sp})` : `(SP${a.sp}→新${v2})`;
    }
    return `| ${head} | ${esc(a.name)} | ${esc(a.desc)} |`;
  });
}

function perkRows(m){
  const t = G.MONSTER_PERKS[m.id];
  if(!t) return null;
  return Object.keys(t).map(n => `| ★${n} | ${esc(t[n].desc)} |`);
}

const mons = api.MONSTERS.slice().sort((a, b) => b.rarity - a.rarity || +a.id.slice(1) - +b.id.slice(1));
const filled = mons.filter(m => memo.mons[m.id] && memo.mons[m.id].yakuwari).length;
const out = [];
out.push('# モンスター設計メモ', '');
out.push('> **このファイルは `node tools/gen_monster_memo.js` が作ります。手で直さないでください。**');
out.push('> 技の中身はいまの `index.html` から、想定の役割・動き・意図は `docs/design/モンスター設計メモ.json` から作っています。');
out.push('> キャラの技を変えたとき・星刻特性を決めたときは、JSON の同じキャラの欄も直してから、このファイルを作り直してください。', '');
out.push(`記入ずみ ${filled} / ${mons.length} 体`, '');
out.push('## 書き方', '');
memo.fields.forEach(([k, v]) => out.push(`- **${k}**: ${v}`));
out.push('');
for(const r of [5, 4, 3, 2, 1]){
  const list = mons.filter(m => m.rarity === r);
  out.push(`## ★${r}(${list.length}体)`, '');
  for(const m of list){
    const e = memo.mons[m.id] || {};
    const a = arch[m.id] || newArch[m.name] || '—';
    out.push(`### ${m.name}(${m.id})`, '');
    out.push(`${G.ELEM_LABEL[m.element] || m.element}・${G.ROLE_LABEL[m.role] || m.role}・${label(G.SPECIES_LABEL[m.species]) || m.species}　傾向: ${a}　` +
      `HP ${m.hp}(新バトル${m.hp * 2}) / STR ${m.str} / 物防 ${m.pdef} / 魔防 ${m.mdef} / SPD ${m.spd}`, '');
    out.push(`- **想定の役割**: ${e.yakuwari || '(未記入)'}`);
    if(e.ugoki && e.ugoki.length){ out.push('- **想定の動き**:'); e.ugoki.forEach(x => out.push(`  - ${x}`)); }
    if(e.aite) out.push(`- **組ませたい相手・苦手**: ${e.aite}`);
    out.push('');
    out.push('| 枠 | 技 | 効果(いまの実装) |', '|---|---|---|', ...kitRows(m), '');
    if(e.ito && Object.keys(e.ito).length){
      out.push('**技ごとの意図**', '');
      SLOTS.forEach(([key, ja]) => { if(e.ito[key]) out.push(`- ${ja}: ${e.ito[key]}`); });
      out.push('');
    }
    const pr = perkRows(m);
    if(pr) out.push('**星刻特性(実装ずみ)**', '', '| ★ | 効果 |', '|---|---|', ...pr, '');
    if(e.seikoku) out.push(`**星刻特性の方針**: ${e.seikoku}`, '');
    if(e.chui && e.chui.length){ out.push('**実装・調整の注意**', ''); e.chui.forEach(x => out.push(`- ${x}`)); out.push(''); }
    if(e.sokutei) out.push(`**実測**: ${e.sokutei}`, '');
  }
}
const md = out.join('\n');
const file = path.join(ROOT, 'docs', 'モンスター設計メモ.md');
if(process.argv.includes('--check')){
  const cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if(cur !== md){ console.log('docs/モンスター設計メモ.md が最新ではありません。node tools/gen_monster_memo.js を走らせてください'); process.exit(1); }
  console.log('docs/モンスター設計メモ.md は最新です');
}else{
  fs.writeFileSync(file, md);
  console.log(`書き出しました: docs/モンスター設計メモ.md(記入ずみ ${filled} / ${mons.length} 体)`);
}
process.exit(0);
