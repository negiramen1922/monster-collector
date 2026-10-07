/* 連続攻撃の見直し(α0.4.002)。防御を%カットにしたあと、連続攻撃の合計威力が単発より30〜160%高く残っていたので下げた。
   基準は「同じ★・同じ枠・同じ対象(ランダムは単体あつかい)の単発スキルの平均」。連続攻撃はその9割前後で、
   アバドン・フェンリル・オーガ・ケンタウロスのスキル2だけ手直しで平均くらい。
   → どの連続攻撃も、基準の1.05倍を超えないこと。 */
const load = require('./harness.js');
const api = load('game.js', s => s + ';global.__e={MONSTERS,MONSTER_KITS};');
const E = global.__e;
let bad = 0;
const ok = (n, c, i) => { if(!c) bad++; console.log((c ? '✅' : '❌') + ' ' + n + (i !== undefined ? '  ' + JSON.stringify(i) : '')); };
// 企画の資料で数値が決まっていて、採点式(tools/balance/power_lib.js)の予算に収めてあるもの。
// イヌの奥義(150%×3・重さ2の予算で103%)は docs/提案資料/次回イベント案_モモタロウ.md の値。要確認として残す
const MULTIHIT_EXCEPT = { 'イヌ:ult': true };
const rows = [];
for(const id in E.MONSTER_KITS){
  const k = E.MONSTER_KITS[id], m = E.MONSTERS.find(x => x.id === id);
  if(!m) continue;
  ['skill1', 'skill2', 'ult'].forEach(slot => { const a = k[slot]; if(a && a.pow) rows.push({ name: m.name, r: m.rarity, slot, pow: a.pow, hits: a.hits || 1, tgt: a.tgt === 'all' ? 'all' : 'one', desc: a.desc || '' }); });
}
const g = {};
rows.filter(x => x.hits === 1).forEach(x => { const k = x.slot + x.tgt + x.r; (g[k] = g[k] || []).push(x.pow); });
const base = x => { for(const r of [x.r, x.r - 1, x.r + 1]){ const a = g[x.slot + x.tgt + r]; if(a && a.length) return a.reduce((s, v) => s + v, 0) / a.length; } return null; };
const over = rows.filter(x => x.hits > 1).map(x => ({ n: x.name, s: x.slot, total: Math.round(x.pow * x.hits * 100), base: Math.round(base(x) * 100) }))
  .filter(x => x.total > x.base * 1.05 && !MULTIHIT_EXCEPT[x.n + ':' + x.s]);
ok('連続攻撃の合計威力は、同じ★・枠・対象の単発の平均の1.05倍まで', over.length === 0, over);
const mism = rows.filter(x => x.hits > 1 && /威力\d+%×/.test(x.desc) && !x.desc.includes(`威力${Math.round(x.pow * 100)}%×`)).map(x => [x.name, x.slot, x.pow, x.desc.slice(0, 20)]);
ok('説明文の「威力N%×」が実際の威力と同じ', mism.length === 0, mism);
const abd = E.MONSTER_KITS[E.MONSTERS.find(m => m.name === 'アバドン').id].skill1;
ok('アバドンのスキル1は定義の威力を使う(中に数字を直接書かない)', /ctx\.act\.pow/.test(String(abd.run)), String(abd.run).slice(0, 80));
console.log(bad ? `${bad}件 失敗` : 'すべて通過');
