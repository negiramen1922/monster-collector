/* 遺物が配る各ステータスが「同じ%なら同じ強さか」を実測する。
   遺物のスキル枠1/2/3の比重を議論するには、まず stat 同士の交換レートが要る。
   会心率+30pt と STR+30% と スキル攻撃力+30% は全く別物なので、
   名目の%を揃えても実際の強さは揃わない。

   指標はクリアラウンド数の短縮(与ダメージ総量は敵の総HPで頭打ちになるため)。
   使い方: python3 tools/extract.py してから  cd tools && node stat_value_test.js
           N=200 node stat_value_test.js */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e={RELIC_STAT_LABEL};
const __o = buildUnit;
buildUnit = function(){
  const u = __o.apply(this, arguments);
  if(global.__tb && !u.isEnemy) applyStatBonus(u, global.__tb);
  return u;
};`);
const N = Number(process.env.N || 150);

const CASES = [
  { label:'標準編成 (q3_06 Lv70)', stage:'q3_06', lv:70, party:['m24','m44','m23','m52','m104'] },
  { label:'手数編成 (q3_06 Lv70)', stage:'q3_06', lv:70, party:['m24','m67','m08','m52','m104'] },
];

/* 遺物が実際に配れる stat(applyStatBonus が受け付けるキー)を、名目30%で揃えて比較 */
const NOMINAL = 0.30;
const STATS = [
  ['atk',      'STR'],
  ['skillDmg', 'スキル攻撃力'],
  ['ultDmg',   '必殺技攻撃力'],
  ['critRate', '会心率(＝+30ポイント)'],
  ['pierce',   '防御貫通'],
  ['spd',      'SPD'],
  ['hp',       'HP'],
  ['pdef',     '物理防御'],
  ['mdef',     '魔法防御'],
  ['def',      '物理・魔法防御'],
  ['cut',      '被ダメージカット'],
  ['spGain',   'SP獲得量'],
];

function measure(c, bonus){
  let win = 0, rounds = 0, won = 0;
  for(let i = 0; i < N; i++){
    global.__tb = bonus;
    const ui = api.run(c.party, c.stage, c.lv, { star:5, skillLv:5, ultLv:5, passiveLv:5 });
    global.__tb = null;
    if(ui.win){ win++; rounds += (ui.round || 0); won++; }
  }
  return { wr: win / N, rounds: won ? rounds / won : NaN };
}

console.log('遺物が配る各ステータスを、名目 +' + Math.round(NOMINAL * 100)
  + '% で揃えたときの強さ — 各' + N + '戦\n');

const all = {};
CASES.forEach(c => {
  const base = measure(c, null);
  console.log('[' + c.label + ']  基準: 勝率' + (base.wr * 100).toFixed(0) + '% / '
    + base.rounds.toFixed(2) + 'ラウンド');
  const rows = STATS.map(([k, ja]) => {
    const r = measure(c, { [k]: NOMINAL });
    const cut = base.rounds - r.rounds;          // 短縮ラウンド(大きいほど強い)
    const dwr = (r.wr - base.wr) * 100;
    all[k] = (all[k] || 0) + cut;
    return { k, ja, cut, dwr, wr:r.wr, rounds:r.rounds };
  }).sort((a, b) => b.cut - a.cut);
  rows.forEach(r => {
    console.log('  ' + r.ja.padEnd(22, '　')
      + r.rounds.toFixed(2).padStart(6) + 'R'
      + ('  短縮 ' + (r.cut >= 0 ? '-' : '+') + Math.abs(r.cut).toFixed(2)).padStart(14)
      + ('  勝率 ' + (r.dwr >= 0 ? '+' : '') + r.dwr.toFixed(0) + 'pt').padStart(14));
  });
  console.log('');
});

/* 2ケースの平均をとって、STR を 1.00 としたときの交換レートにする */
const avg = {};
STATS.forEach(([k]) => { avg[k] = all[k] / CASES.length; });
const ref = avg.atk;
console.log('--- STR +30% を 1.00 としたときの交換レート ---');
STATS.map(([k, ja]) => ({ k, ja, v: avg[k] / ref }))
  .sort((a, b) => b.v - a.v)
  .forEach(r => {
    const same = ref > 0 ? (NOMINAL * 100 / (r.v || 0.0001)) : 0;
    console.log('  ' + r.ja.padEnd(22, '　') + r.v.toFixed(2).padStart(6)
      + (r.v > 0.05 ? '    STR+30%と釣り合う量: 約+' + Math.round(same) + '%' : '    (火力にはほぼ寄与しない)'));
  });

console.log('\n注意: これは「クリアの速さ」への寄与。HP・防御・カットは生存に効くので、');
console.log('      短縮ラウンドが小さくても価値が無いわけではない(勝率の列を併せて見ること)。');
console.log('\ndone');
