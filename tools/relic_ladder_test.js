/* 遺物のスキル枠の値を★ごとに下げると、★の階段がどうなるかを測る。

   遺物の強さは2層の掛け算になっている:
     1) base   … 遺物Lv1の素点加算。★で 20/28/36/44/50% と既に階段になっている
     2) effects… %ボーナス。base で増えた後の値に掛かるので、両者は掛け算で効く
   そのため「効果側も★で下げる」と階段が二重になる。下げ幅が適正かをここで見る。

   使い方: python3 tools/extract.py してから  cd tools && node relic_ladder_test.js
           N=200 node relic_ladder_test.js */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e={};
const __o = buildUnit;
buildUnit = function(){
  const u = __o.apply(this, arguments);
  if(global.__tb && !u.isEnemy && u.ref === global.__target){
    if(global.__base){                       // base(素点の加算)を先に入れる
      const b = global.__base;
      if(b.hp){ const a = Math.round(u.maxHp * b.hp); u.maxHp += a; u.hp += a; }
      if(b.atk) u.str = Math.round(u.str * (1 + b.atk));
    }
    applyStatBonus(u, global.__tb);          // effects(%)は base の後に掛かる
  }
  return u;
};`);
const N = Number(process.env.N || 150);

/* base は「その★の平均キャラの素ステの何%を足すか」(stat_value_test と同じ実測値)。
   ここでは STR型プリセットを使う(主ステSTR、従ステHP)。 */
const BASE = { 1:{atk:0.20, hp:0.07}, 2:{atk:0.28, hp:0.09}, 3:{atk:0.36, hp:0.12},
               4:{atk:0.44, hp:0.15}, 5:{atk:0.50, hp:0.17} };

/* 案A: 全★フラット(いま入っている規則) / 案B: ★ごとに2ポイントずつ下げる */
const SLOTS = { 1:1, 2:2, 3:2, 4:3, 5:3 };
const PLANS = {
  'A フラット(15-30)': { 1:[0.30], 2:[0.30,0.30], 3:[0.30,0.30], 4:[0.30,0.30,0.33], 5:[0.30,0.30,0.33] },
  'B ★ごとに下げる':   { 1:[0.14], 2:[0.18,0.18], 3:[0.22,0.22], 4:[0.26,0.26,0.29], 5:[0.30,0.30,0.33] },
  'C ★1だけ据え置き':  { 1:[0.30], 2:[0.18,0.18], 3:[0.22,0.22], 4:[0.26,0.26,0.29], 5:[0.30,0.30,0.33] },
  /* D: ★5と★4でカンスト-5% / ★4と★3は同率(枠数だけ違う) /
        ★3と★2で-5% / ★2と★1は同率(枠数だけ違う) */
  'D 2段の-5%':        { 1:[0.20], 2:[0.20,0.20], 3:[0.25,0.25], 4:[0.25,0.25,0.25], 5:[0.30,0.30,0.30] },
  /* D+: Dに「最後の枠だけ少し高い」を残した形 */
  'D+ 最後の枠を+3':   { 1:[0.20], 2:[0.20,0.20], 3:[0.25,0.25], 4:[0.25,0.25,0.28], 5:[0.30,0.30,0.33] },
};

/* 全枠がSTRに乗る「条件が完全一致した遺物」を想定する(最も分かりやすい比較) */
function bonusFor(caps){ return { atk: caps.reduce((s, v) => s + v, 0) }; }

const C = { stage:'q3_08', lv:70, party:['m125','m24','m44','m52','m104'] };
global.__target = 'm125';

function measure(base, bonus){
  let dealt = 0, rounds = 0, won = 0, win = 0;
  for(let i = 0; i < N; i++){
    global.__base = base; global.__tb = bonus;
    const ui = api.run(C.party, C.stage, C.lv, { star:5, skillLv:5, ultLv:5, passiveLv:5 });
    global.__base = null; global.__tb = null;
    const u = (ui.party || []).find(x => x.ref === 'm125');
    dealt += (u && u.report ? u.report.dealt : 0);
    if(ui.win){ win++; rounds += (ui.round || 0); won++; }
  }
  return { dealt: dealt / N, rounds: won ? rounds / won : NaN, wr: win / N };
}

console.log('雷電1体に「条件が完全一致した遺物」を着けたときの与ダメージ — 各' + N + '戦');
console.log('(base も effects も乗せた、実際の遺物1個ぶんの強さ)\n');

const none = measure(null, null);
console.log('遺物なし: ' + Math.round(none.dealt).toLocaleString() + '\n');

const table = {};
Object.keys(PLANS).forEach(plan => {
  console.log('[' + plan + ']');
  console.log('  ★  枠の値                     与ダメ      遺物なし比   前の★から');
  let prev = null;
  [1,2,3,4,5].forEach(st => {
    const caps = PLANS[plan][st];
    const r = measure(BASE[st], bonusFor(caps));
    const gain = r.dealt / none.dealt;
    const step = prev ? (gain / prev - 1) * 100 : null;
    console.log('  ★' + st + '  '
      + caps.map(v => '+' + Math.round(v * 100) + '%').join(' / ').padEnd(26, ' ')
      + Math.round(r.dealt).toLocaleString().padStart(8)
      + ('  ×' + gain.toFixed(2)).padStart(12)
      + (step === null ? '        —' : ('   +' + step.toFixed(1) + '%').padStart(12)));
    (table[plan] = table[plan] || []).push({ st, gain, step });
    prev = gain;
  });
  console.log('');
});

console.log('--- 階段の評価 ---');
Object.keys(PLANS).forEach(plan => {
  const steps = table[plan].filter(r => r.step !== null).map(r => r.step);
  const min = Math.min(...steps), max = Math.max(...steps);
  console.log('  ' + plan.padEnd(22, '　')
    + '★の刻み幅: ' + steps.map(s => '+' + s.toFixed(0) + '%').join(' → ')
    + '   (最小' + min.toFixed(0) + '% / 最大' + max.toFixed(0) + '%)');
});
console.log('\n刻み幅が揃っているほど「★が上がった実感」が均等になる。');
console.log('どこかが極端に小さいと、その★の遺物を引いても嬉しくない。');
console.log('\ndone');
