/* BASE_CRIT_MULT を 1.5 → 2.0 にすると何が起きるかを実測する。
   会心は味方だけでなく敵も引くので、「与ダメージが増える」だけでは済まない。
   味方側の伸び・敵側の伸び・勝率・クリアラウンド数を同じ条件で突き合わせる。

   使い方: python3 tools/extract.py してから  cd tools && node crit_mult_test.js
           N=200 node crit_mult_test.js  で試行回数を変えられる */
const fs = require('fs');
const path = require('path');
const load = require('./harness.js');
const N = Number(process.env.N || 120);

/* BASE_CRIT_MULT を差し替えた game.js を一時ファイルに書いて読ませる */
function apiWithMult(mult){
  const src = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');
  const re = /const BASE_CRIT_MULT = [0-9.]+;/;
  if(!re.test(src)) throw new Error('BASE_CRIT_MULT が見つかりませんでした');
  const patched = src.replace(re, 'const BASE_CRIT_MULT = ' + mult + ';');
  const tmp = path.join(__dirname, '.crit_mult_' + String(mult).replace('.', '_') + '.js');
  fs.writeFileSync(tmp, patched);
  const api = load(tmp, s => s + `;global.__e={BASE_CRIT_MULT,MONSTERS,MON_BY_ID};
const __orig = buildUnit;
buildUnit = function(){
  const u = __orig.apply(this, arguments);
  if(global.__tb && !u.isEnemy) applyStatBonus(u, global.__tb);
  return u;
};`);
  fs.unlinkSync(tmp);
  return { api, mult: global.__e.BASE_CRIT_MULT };
}

/* 素の会心率5%のとき、会心倍率を上げると期待ダメージは何倍になるか */
function expAt(p, mult){ return 1 + (mult - 1) * p; }

console.log('--- 理論値: 会心倍率を上げたときの期待ダメージ ---');
console.log('会心率   1.5倍     2.0倍     伸び');
[0.05, 0.18, 0.23, 0.33, 0.35, 0.37, 0.39].forEach(p => {
  const a = expAt(p, 1.5), b = expAt(p, 2.0);
  console.log(String(Math.round(p * 100)).padStart(4) + '%  '
    + a.toFixed(3) + '     ' + b.toFixed(3) + '     +' + ((b / a - 1) * 100).toFixed(1) + '%');
});
console.log('\n素の5%しか持たないキャラは+2.4%しか伸びない。会心率を積んだキャラほど大きく伸びる。');

/* 実戦。敵も会心を引くので、味方の与ダメと敵の与ダメを両方測る */
const CASES = [
  { label:'格下(q2_08)',   stage:'q2_08', lv:55, party:['m24','m44','m23','m52','m104'] },
  { label:'相応(q3_06)',   stage:'q3_06', lv:70, party:['m24','m44','m23','m52','m104'] },
  { label:'格上(q3_10)',   stage:'q3_10', lv:70, party:['m24','m44','m23','m52','m104'] },
  { label:'手数型編成(q3_06)', stage:'q3_06', lv:70, party:['m24','m67','m08','m52','m104'] },
];

function run(api, c){
  const ui = api.run(c.party, c.stage, c.lv, { star:5, skillLv:5, ultLv:5, passiveLv:5 });
  const dealt = (ui.party || []).reduce((s, u) => s + ((u.report && u.report.dealt) || 0), 0);
  const taken = (ui.party || []).reduce((s, u) => s + ((u.report && u.report.taken) || 0), 0);
  return { win: !!ui.win, rounds: ui.round || 0, dealt, taken };
}

const A = apiWithMult(1.5), B = apiWithMult(2.0);
console.log('\n読み込み確認: ' + A.mult + '倍 / ' + B.mult + '倍\n');
console.log('--- 実戦(各' + N + '戦) ---');

const rows = [];
CASES.forEach(c => {
  const res = {};
  [['1.5倍', A.api], ['2.0倍', B.api]].forEach(([name, api]) => {
    let win = 0, rounds = 0, won = 0, dealt = 0, taken = 0;
    for(let i = 0; i < N; i++){
      const r = run(api, c);
      dealt += r.dealt; taken += r.taken;
      if(r.win){ win++; rounds += r.rounds; won++; }
    }
    res[name] = { wr: win / N, rounds: won ? rounds / won : NaN, dealt: dealt / N, taken: taken / N };
  });
  const a = res['1.5倍'], b = res['2.0倍'];
  console.log('\n[' + c.label + ']');
  console.log('          勝率      ラウンド   味方の与ダメ   味方の被ダメ');
  console.log('  1.5倍  ' + (a.wr * 100).toFixed(0).padStart(4) + '%    '
    + a.rounds.toFixed(2).padStart(6) + '    ' + Math.round(a.dealt).toLocaleString().padStart(9)
    + '    ' + Math.round(a.taken).toLocaleString().padStart(9));
  console.log('  2.0倍  ' + (b.wr * 100).toFixed(0).padStart(4) + '%    '
    + b.rounds.toFixed(2).padStart(6) + '    ' + Math.round(b.dealt).toLocaleString().padStart(9)
    + '    ' + Math.round(b.taken).toLocaleString().padStart(9));
  console.log('   差    ' + (((b.wr - a.wr) * 100 >= 0 ? '+' : '') + ((b.wr - a.wr) * 100).toFixed(0) + 'pt').padStart(5)
    + '    ' + ((b.rounds - a.rounds >= 0 ? '+' : '') + (b.rounds - a.rounds).toFixed(2)).padStart(6)
    + '    ' + ((b.dealt / a.dealt - 1) * 100 >= 0 ? '+' : '') + ((b.dealt / a.dealt - 1) * 100).toFixed(1) + '%'
    + '        ' + ((b.taken / a.taken - 1) * 100 >= 0 ? '+' : '') + ((b.taken / a.taken - 1) * 100).toFixed(1) + '%');
  rows.push({ label:c.label, dWin:(b.wr - a.wr) * 100, dDealt:(b.dealt / a.dealt - 1) * 100,
              dTaken:(b.taken / a.taken - 1) * 100 });
});

console.log('\n--- まとめ ---');
const avgD = rows.reduce((s, r) => s + r.dDealt, 0) / rows.length;
const avgT = rows.reduce((s, r) => s + r.dTaken, 0) / rows.length;
console.log('味方の与ダメージ 平均 ' + (avgD >= 0 ? '+' : '') + avgD.toFixed(1) + '%');
console.log('味方の被ダメージ 平均 ' + (avgT >= 0 ? '+' : '') + avgT.toFixed(1) + '%');
console.log(avgD > avgT
  ? '→ 与ダメの伸びが被ダメの伸びを上回るので、全体としてはプレイヤー有利に振れる。'
  : '→ 被ダメの伸びが与ダメの伸びに追いつくので、体感difficultyは上がる。');
console.log('\ndone');

/* ------------------------------------------------------------------
   本題: 会心率を「積んだ」状態での比較。
   今の編成に会心が乗っていないのは、会心率を配る遺物を着けていないから。
   会心遺物(★4 影牙ウンブラ相当 +34pt)やアバドンのパッシブ(+30pt)を
   想定して、会心率を持たせたうえで 1.5倍 と 2.0倍 を比べる。 ------- */
function runWithBonus(api, c, bonus){
  global.__tb = bonus;
  const ui = api.run(c.party, c.stage, c.lv, { star:5, skillLv:5, ultLv:5, passiveLv:5 });
  global.__tb = null;
  const dealt = (ui.party || []).reduce((s, u) => s + ((u.report && u.report.dealt) || 0), 0);
  return { win: !!ui.win, rounds: ui.round || 0, dealt };
}

console.log('\n\n=== 会心率を積んだ状態での比較 ===');
console.log('(遺物や自前パッシブで会心率を持たせた場合。ここが実際の判断材料)');
console.log('与ダメ総量は敵の総HPで頭打ちになるので、勝率とクリアラウンド数で測る。\n');

const C = { label:'相応(q3_06)', stage:'q3_06', lv:70, party:['m24','m67','m08','m52','m104'] };
const BONUSES = [
  ['会心率なし(素の5%)',        null],
  ['会心率 +18pt(★5専用相当)',  { critRate:0.18 }],
  ['会心率 +34pt(★4闇相当)',    { critRate:0.34 }],
  ['会心率 +64pt(遺物+アバドン)', { critRate:0.64 }],
];
function measure(api, bonus){
  let win = 0, rounds = 0, won = 0;
  for(let i = 0; i < N; i++){
    const r = runWithBonus(api, C, bonus);
    if(r.win){ win++; rounds += r.rounds; won++; }
  }
  return { wr: win / N, rounds: won ? rounds / won : NaN };
}
console.log('                                  1.5倍            2.0倍          短縮ラウンド');
BONUSES.forEach(([name, b]) => {
  const a = measure(A.api, b), c = measure(B.api, b);
  console.log('  ' + name.padEnd(26, '\u3000')
    + ('勝率' + (a.wr * 100).toFixed(0) + '% ' + a.rounds.toFixed(2) + 'R').padStart(16)
    + ('勝率' + (c.wr * 100).toFixed(0) + '% ' + c.rounds.toFixed(2) + 'R').padStart(16)
    + '     ' + (a.rounds - c.rounds >= 0 ? '-' : '+') + Math.abs(a.rounds - c.rounds).toFixed(2));
});
console.log('\n会心率が高いほど 2.0倍の恩恵が大きくなる。会心率を配らないままなら、倍率を上げてもほぼ動かない。');
