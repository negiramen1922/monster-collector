/* 遺物の「会心率+X%」が、同じ枠の他ステータスと比べて本当に得かを測る。

   仕組み上の前提(index.html の strike / applyStatBonus より):
     - BASE_CRIT_RATE = 5%、BASE_CRIT_MULT = 1.5倍
     - 遺物の critRate は「率そのものへの加算」(5% + 32pt = 37%)であって、倍率ではない
     - 期待ダメージ倍率 = 1 + 0.5 × 会心率  →  5%で1.025、37%で1.185(+15.6%)
     - 一方 atk(STR)+32% は effStr がそのまま1.32倍。しかも防御は減算なので、
       防御を抜いた後の実ダメージでは +32% 以上になる
   この台本は、その差を実際の戦闘で回して確かめる。

   使い方: python3 tools/extract.py してから  cd tools && node crit_value_test.js
           N=120 node crit_value_test.js  で試行回数を変えられる */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e = {
  BASE_CRIT_RATE, BASE_CRIT_MULT, RELICS, MON_BY_ID, applyStatBonus,
  set TESTBONUS(v){ global.__tb = v; },
};
const __origBuild = buildUnit;
buildUnit = function(){
  const u = __origBuild.apply(this, arguments);
  if(global.__tb && !u.isEnemy) applyStatBonus(u, global.__tb);
  return u;
};`);
const E = global.__e;
const N = Number(process.env.N || 80);
const ok = (name, cond, info) => console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));

/* ---------- 1. 仕組みの確認 ---------- */
console.log('--- 会心の基礎値 ---');
console.log(`BASE_CRIT_RATE = ${E.BASE_CRIT_RATE * 100}% / BASE_CRIT_MULT = ${E.BASE_CRIT_MULT}倍`);
ok('会心率の素の値は5%', E.BASE_CRIT_RATE === 0.05, E.BASE_CRIT_RATE);
ok('会心倍率は1.5倍(=会心で+50%)', E.BASE_CRIT_MULT === 1.5, E.BASE_CRIT_MULT);

// critRate は「加算」であって「倍率」ではない、を実物で確認
const probe = { str: 100, maxHp: 100, hp: 100, pdef: 10, mdef: 10, spd: 10 };
const c1 = Object.assign({}, probe); E.applyStatBonus(c1, { critRate: 0.32 });
const a1 = Object.assign({}, probe); E.applyStatBonus(a1, { atk: 0.32 });
ok('critRate+0.32 は会心率に+32ポイント加算される(倍率ではない)', c1.bonusCrit === 0.32, c1.bonusCrit);
ok('atk+0.32 は STR が1.32倍になる', a1.str === 132, a1.str);

const expMult = p => 1 + (E.BASE_CRIT_MULT - 1) * p;
console.log('\n--- 期待ダメージ倍率(理論値) ---');
[0, 0.12, 0.18, 0.28, 0.32, 0.34].forEach(pt => {
  const p = E.BASE_CRIT_RATE + pt;
  const gain = expMult(p) / expMult(E.BASE_CRIT_RATE) - 1;
  console.log(`  会心率 +${String(Math.round(pt * 100)).padStart(2)}pt → 実効${String(Math.round(p * 100)).padStart(2)}%  `
    + `期待ダメージ ${(gain * 100 >= 0 ? '+' : '')}${(gain * 100).toFixed(1)}%`);
});

/* ---------- 2. 実戦で測る ---------- */
// 与ダメージの総量は「敵の総HP」で頭打ちになるので指標にならない(倒しきれば同じ値になる)。
// 火力の差が出るのは「何ラウンドで倒しきれるか」と「格上に勝てるか」なので、その2つで測る。
const CASES = [
  { label: '★3 バーサーカーの血怒り(role:attacker)', cap: 0.32,
    party: ['m24', 'm44', 'm23', 'm52', 'm104'], stage: 'q3_06', lv: 70 },
  { label: '★4 プロメテウスの焔(炎・role:attacker)', cap: 0.28,
    party: ['m53', 'm67', 'm87', 'm52', 'm104'], stage: 'q3_06', lv: 70 },
  { label: '★4 タナトスの鎌(element:闇)',            cap: 0.34,
    party: ['m24', 'm101', 'm44', 'm52', 'm104'], stage: 'q3_06', lv: 70 },
];
const VARIANTS = [
  ['無し',        null],
  ['会心率',      cap => ({ critRate: cap })],
  ['STR',         cap => ({ atk: cap })],
  ['スキル威力',  cap => ({ skillDmg: cap })],
];

function battle(c, bonus){
  global.__tb = bonus;
  const ui = api.run(c.party, c.stage, c.lv, { star: 5, skillLv: 5, ultLv: 5, passiveLv: 5 });
  global.__tb = null;
  return { win: !!ui.win, rounds: ui.round || 0 };
}

console.log(`\n--- 実戦で測った結果(各${N}戦) ---`);
const rows = [];
CASES.forEach(c => {
  const res = {};
  VARIANTS.forEach(([name, mk]) => {
    let wins = 0, rounds = 0, won = 0;
    for(let i = 0; i < N; i++){
      const r = battle(c, mk ? mk(c.cap) : null);
      if(r.win){ wins++; rounds += r.rounds; won++; }
    }
    res[name] = { wr: wins / N, rounds: won ? rounds / won : NaN };
  });
  console.log(`\n[${c.label}]  cap ${Math.round(c.cap * 100)}%  (${c.stage} Lv${c.lv})`);
  VARIANTS.forEach(([name]) => {
    const r = res[name], b = res['無し'];
    const tag = name === '無し' ? ''
      : `  勝率${((r.wr - b.wr) * 100 >= 0 ? '+' : '')}${((r.wr - b.wr) * 100).toFixed(0)}pt`
        + ` / ラウンド${(r.rounds - b.rounds >= 0 ? '+' : '')}${(r.rounds - b.rounds).toFixed(2)}`;
    console.log(`  ${name.padEnd(6, '　')} 勝率 ${(r.wr * 100).toFixed(0)}%  平均 ${r.rounds.toFixed(2)}ラウンド${tag}`);
  });
  rows.push({ label: c.label,
    crit: res['無し'].rounds - res['会心率'].rounds,   // 短縮ラウンド数(大きいほど強い)
    atk:  res['無し'].rounds - res['STR'].rounds });
});

console.log('\n--- 判定 ---');
rows.forEach(r => {
  ok(`${r.label}: 同じcap%なら会心率よりSTRの方がクリアが速い`, r.atk > r.crit,
    { 会心率: r.crit.toFixed(2) + 'ラウンド短縮', STR: r.atk.toFixed(2) + 'ラウンド短縮' });
});

/* ---------- 3. 会心率遺物の棚卸し ---------- */
console.log('\n--- 会心率を乗せている遺物 ---');
Object.values(E.RELICS).forEach(r => {
  const cs = (r.effects || []).filter(e => e.stat === 'critRate');
  if(!cs.length) return;
  const pt = cs.reduce((s, e) => s + e.pct, 0) * 2;   // skillLv10でちょうど2倍
  const gain = expMult(E.BASE_CRIT_RATE + pt) / expMult(E.BASE_CRIT_RATE) - 1;
  console.log(`  ★${r.star} ${r.name.padEnd(12, '　')} 会心率+${String(Math.round(pt * 100)).padStart(2)}pt`
    + ` → 期待ダメージ +${(gain * 100).toFixed(1)}%`);
});

console.log('\ndone');
