/* 肩代わりが実際どれくらい得なのかを測る。採点式の redirect の値付けの根拠。
   同じ攻撃を味方が受けた場合とタンクが受けた場合で、パーティのHP消費がどれだけ変わるか。
   ※ buildUnit(mon, stageLevel, isEnemy, star, boss, charLevel, upgrades)
     味方は charLevel にレベルを渡さないと育たない(以前これを間違えていた) */
const load = require('../harness.js');
load('game.js', s => s + ';global.__e={MONSTERS,buildUnit,DAMAGE_MIN_RATIO,effStr};');
const E = global.__e;
const TANK = process.argv[2] || 'タイタン';
const ALLIES = (process.argv[3] || 'フェンリル,アバドン,九尾の狐,雷電').split(',');
const ATK = process.argv[4] || 'バハムート';
const ally = (n, lv) => E.buildUnit(E.MONSTERS.find(x => x.name === n), 1, false, 5, false, lv, {});
const foe = lv => E.buildUnit(E.MONSTERS.find(x => x.name === ATK), lv, true, 5, false, 1, {});
console.log(`攻撃側 ${ATK}(★5・敵) の威力100%を、味方★5が受けたとき失うHPの割合`);
for (const lv of [100, 200, 300]) {
  const raw = E.effStr(foe(lv));
  const pct = u => Math.max(raw * (E.DAMAGE_MIN_RATIO || 0.10), raw - u.pdef) / u.maxHp;
  const t = pct(ally(TANK, lv));
  const a = ALLIES.reduce((s, n) => s + pct(ally(n, lv)), 0) / ALLIES.length;
  const keep = t / a;
  console.log(` Lv${lv}: ${TANK} ${(t*100).toFixed(0)}% / 味方平均 ${(a*100).toFixed(0)}% → ${TANK}に移すとHP消費は ${(keep*100).toFixed(0)}%`);
  for (const r of [0.3, 0.4, 0.6]) {
    const eq = r * (1 - keep);
    console.log(`   肩代わり${r*100}% = 味方全体の被ダメ -${(eq*100).toFixed(1)}% 相当 → 採点 2.5×${(eq*100/10).toFixed(2)}×3×2.5 = ${(2.5*(eq*100/10)*3*2.5).toFixed(1)}点(3ターン)`);
  }
}
