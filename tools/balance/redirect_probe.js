/* 肩代わりが実際どれくらい得なのかを測る。採点式の redirect の値付けの根拠。
   同じ生ダメージを味方が受けた場合とタイタンが受けた場合で、パーティのHP消費がどれだけ変わるか。 */
const load = require('../harness.js');
load('game.js', s => s + ';global.__e={MONSTERS,buildUnit,DAMAGE_MIN_RATIO};');
const E = global.__e;
const TANK = process.argv[2] || 'タイタン';
const allies = (process.argv[3] || 'フェンリル,アバドン,九尾の狐').split(',');
const mk = n => E.buildUnit(E.MONSTERS.find(x => x.name === n), 100, false, 5, false, 1, {});
const raw = 800;
const pct = u => Math.max(raw * (E.DAMAGE_MIN_RATIO || 0.10), raw - u.pdef) / u.maxHp;
const t = mk(TANK), avg = allies.map(mk).reduce((s, u) => s + pct(u), 0) / allies.length;
const keep = pct(t) / avg;
console.log(`${TANK} に攻撃を移すと、パーティのHP消費は ${(keep*100).toFixed(0)}% で済む`);
for (const r of [0.3, 0.4, 0.5, 0.7]) console.log(`  肩代わり${r*100}% = 味方全体の被ダメ -${(r*(1-keep)*100).toFixed(1)}% 相当`);
