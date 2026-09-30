/* 防御を「そのまま%カット」にした仕様の検証。
   - 防御はレベル・★・敵のレベル補正で伸びない(素の値がそのままカット%)
   - ダメージは raw × (1 - 防御/100)
   - 上限 DEF_POINT_CAP(99)。防御貫通は相手の防御ポイントを削る(RATIO_CAP 80%まで)
   - やけど・毒は防御を通らない(貫通100%あつかい)
   - ルーンの防御はポイント加算。既存のルーンも自動で新しい値になる
   - 戦闘力の重み(BP_DEF_WEIGHT)

   使い方: python3 tools/extract.py してから  cd tools && node defense_ratio_test.js */
const load = require('./harness.js');
const api = load('game.js', s => s + `;global.__e={
  DEF_POINT_CAP, BP_DEF_WEIGHT, RATIO_CAP, CUT_CAP, defCutOf, effDef, capRatio,
  scaledStats, buildUnit, MONSTERS, MON_BY_ID, ROLE_LABEL, RUNE_STATS, runeMainValue, runeSubValue,
  makeRune, runeBonusFromList, applyRuneBonusToUnit, applyStatus, hasStatus, ENEMY_POWER, LEVEL_STAT_BONUS,
  get battleUI(){ return battleUI }, set battleUI(v){ battleUI = v },
  get STATE(){ return STATE }, set STATE(v){ STATE = v }, DEFAULT_STATE,
};`);
const E = global.__e;
let ng = 0;
const ok = (name, cond, info) => { console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : '')); if(!cond) ng++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
api.STATE = E.DEFAULT_STATE();
const TANK = 'm54', ATK = 'm139', SHOOTER = 'm116';

/* ---- 1. 防御は伸びない ---- */
console.log('--- 1. 防御はレベル・★で伸びない ---');
[TANK, ATK, SHOOTER].forEach(id => {
  const m = E.MON_BY_ID[id];
  const at = (star, lv) => E.scaledStats(m, star, lv);
  ok(`  ${m.name} は Lv1 も Lv300 も 物防${m.pdef}% / 魔防${m.mdef}%`,
     [[5, 1], [5, 200], [10, 300]].every(([s, l]) => at(s, l).pdef === m.pdef && at(s, l).mdef === m.mdef),
     [at(5, 1).pdef, at(10, 300).pdef]);
  ok(`  ${m.name} のHPとSTRはちゃんと伸びる`, at(10, 300).hp > at(5, 1).hp * 5 && at(10, 300).str > at(5, 1).str * 5);
});
// 敵も伸びない(ここを直さないと高Lvのステージで全員が上限99%になる)
function enemy(id, stageLv, boss){
  E.battleUI = { stage: { rules: [] }, currentActor: null, party: [], enemies: [], log: [], fxEvents: [] };
  return E.buildUnit(E.MON_BY_ID[id], stageLv, true, 7, boss, null, null);
}
const e1 = enemy(TANK, 1, false), e300 = enemy(TANK, 300, false), eBoss = enemy(TANK, 300, true);
ok('敵の防御もステージLvで伸びない', e1.pdef === e300.pdef && e300.pdef === E.MON_BY_ID[TANK].pdef, [e1.pdef, e300.pdef]);
ok('ボス補正もかからない', eBoss.pdef === e1.pdef, [e1.pdef, eBoss.pdef]);
ok('敵のHPとSTRはステージLvで伸びる', e300.maxHp > e1.maxHp * 5 && e300.str > e1.str * 5, [e1.str, e300.str]);

/* ---- 2. カットの計算 ---- */
console.log('\n--- 2. 防御 = そのままカット% ---');
[[0, 0], [10, 0.10], [31, 0.31], [50, 0.50], [99, 0.99]].forEach(([pt, cut]) =>
  ok(`  防御${pt} → ${Math.round(cut * 100)}%カット`, near(E.defCutOf(pt), cut, 1e-9), E.defCutOf(pt)));
ok(`上限は${E.DEF_POINT_CAP}`, E.DEF_POINT_CAP === 99 && E.defCutOf(500) === 0.99, [E.DEF_POINT_CAP, E.defCutOf(500)]);
ok('マイナスは0あつかい', E.defCutOf(-50) === 0);

/* ---- 3. バフ・デバフは掛け算のまま ---- */
console.log('\n--- 3. 防御バフ・デバフ ---');
function unit(id, buffs){
  E.battleUI = { stage: { rules: [] }, currentActor: null, party: [], enemies: [], log: [], fxEvents: [] };
  const u = E.buildUnit(E.MON_BY_ID[id], 100, false, 5, false, 100, null);
  Object.entries(buffs || {}).forEach(([k, v]) => u.buffs[k] = { v, turns: 3 });
  return u;
}
{
  const base = E.MON_BY_ID[TANK].pdef;
  ok(`  タンクの素は ${base}%`, E.effDef(unit(TANK), 'phys') === base, E.effDef(unit(TANK), 'phys'));
  ok('  pdefUp +40% で 1.4倍', near(E.effDef(unit(TANK, { pdefUp: 0.4 }), 'phys'), base * 1.4, 0.01),
     E.effDef(unit(TANK, { pdefUp: 0.4 }), 'phys'));
  ok('  pdefDown -25% で 0.75倍', near(E.effDef(unit(TANK, { pdefDown: 0.25 }), 'phys'), base * 0.75, 0.01));
  ok('  どれだけ積んでも上限99', E.effDef(unit(TANK, { pdefUp: 10 }), 'phys') === E.DEF_POINT_CAP,
     E.effDef(unit(TANK, { pdefUp: 10 }), 'phys'));
  ok('  下限は0(デバフでマイナスにならない)', E.effDef(unit(TANK, { pdefDown: 5 }), 'phys') === 0);
  // 弱い子に同じバフを掛けても、増えるポイントは小さい(比率は同じ)
  const s = E.MON_BY_ID[SHOOTER].pdef;
  ok('  防御が低い子ほど、同じ%バフで増えるポイントは小さい',
     E.effDef(unit(TANK, { pdefUp: 0.4 }), 'phys') - base > E.effDef(unit(SHOOTER, { pdefUp: 0.4 }), 'phys') - s,
     [+(base * 0.4).toFixed(1), +(s * 0.4).toFixed(1)]);
}

/* ---- 4. 防御貫通 ---- */
console.log('\n--- 4. 防御貫通は相手の防御ポイントを削る ---');
{
  const base = E.MON_BY_ID[TANK].pdef;
  const left = pierce => base * (1 - E.capRatio(pierce));
  [[0, base], [0.3, base * 0.7], [0.5, base * 0.5], [0.8, base * 0.2], [1, base * 0.2], [2, base * 0.2]].forEach(([p, want]) =>
    ok(`  貫通${Math.round(p * 100)}% → 残る防御 ${want.toFixed(1)}%`, near(left(p), want, 0.01), +left(p).toFixed(1)));
  ok(`貫通の上限は${E.RATIO_CAP}(2割は必ず残る)`, E.capRatio(9) === E.RATIO_CAP && E.RATIO_CAP === 0.8);
  ok('防御99の壁は貫通では壊せない(19.8%残る)', near(99 * (1 - E.capRatio(1)), 19.8, 0.01), +(99 * (1 - E.capRatio(1))).toFixed(1));
}

/* ---- 5. やけど・毒は防御を通らない ---- */
console.log('\n--- 5. 状態異常は防御を無視する(貫通100%あつかい) ---');
{
  const tank = unit(TANK), shooter = unit(SHOOTER), src = unit(ATK);
  E.applyStatus(tank, 'burn', src);
  E.applyStatus(shooter, 'burn', src);
  ok('  やけどのダメージは相手の防御で変わらない',
     tank.statuses.burn.dmg === shooter.statuses.burn.dmg,
     [tank.statuses.burn.dmg, shooter.statuses.burn.dmg]);
  ok('  防御99でもやけどはかかる', (() => { const u = unit(TANK, { pdefUp: 10 }); return E.applyStatus(u, 'burn', src) !== false; })());
}

/* ---- 6. ルーンはポイント加算 ---- */
console.log('\n--- 6. ルーンの防御はポイント加算 ---');
ok('pdef / mdef は % ではない', !E.RUNE_STATS.pdef.pct && !E.RUNE_STATS.mdef.pct);
ok('HP / STR は今までどおり %', E.RUNE_STATS.hp.pct && E.RUNE_STATS.atk.pct);
{
  const main = E.RUNE_STATS.pdef.main;
  console.log('   メイン Ⅰ〜Ⅹ: ' + main.join(' / '));
  console.log('   サブ1個 Ⅰ: ' + E.runeSubValue({ stat: 'pdef', q: 0 }, 1) + '〜' + E.runeSubValue({ stat: 'pdef', q: 1 }, 1)
    + '  Ⅹ: ' + E.runeSubValue({ stat: 'pdef', q: 0 }, 10) + '〜' + E.runeSubValue({ stat: 'pdef', q: 1 }, 10));
  ok('  Tierが上がるほど大きい', main.every((v, i) => i === 0 || v > main[i - 1]));
  ok('  Ⅹのメインは10ポイント', main[9] === 10, main[9]);
  const u = unit(TANK);
  const before = u.pdef;
  E.applyRuneBonusToUnit(u, { pdef: 20 });
  ok('  そのままポイントが足される(割合ではない)', u.pdef === before + 20, [before, u.pdef]);
  const u2 = unit(TANK);
  E.applyRuneBonusToUnit(u2, { pdef: 500 });
  ok('  足しても上限99を超えない', u2.pdef === E.DEF_POINT_CAP, u2.pdef);
  const u3 = unit(TANK);
  const hp0 = u3.maxHp;
  E.applyRuneBonusToUnit(u3, { hp: 18.5 });
  ok('  HPは今までどおり割合', near(u3.maxHp / hp0, 1.185, 0.01), +(u3.maxHp / hp0).toFixed(3));
  // 既存のルーンは tier しか持たないので、表を書き換えるだけで自動で新しい値になる
  const r = E.makeRune(10, 3, 'pdef');
  ok('  ルーンは値ではなくTierを持つ(移行処理が要らない)',
     r.tier === 10 && r.main === 'pdef' && r.subs.every(s => typeof s.q === 'number') && !('value' in r),
     { tier: r.tier, main: r.main, subs: r.subs.length });
  ok('  メインの値はTierの表から引く', E.runeMainValue(r) === main[9], E.runeMainValue(r));
}

/* ---- 7. 戦闘力の重み ---- */
console.log('\n--- 7. 戦闘力 ---');
ok(`BP_DEF_WEIGHT は ${E.BP_DEF_WEIGHT}`, E.BP_DEF_WEIGHT === 40, E.BP_DEF_WEIGHT);
ok('防御の重みが上がっている(旧: 4)', E.BP_DEF_WEIGHT > 4);

/* ---- 8. ロール別の分布 ---- */
console.log('\n--- 8. ロール別の防御(そのままカット%) ---');
{
  const roles = {};
  E.MONSTERS.forEach(m => { (roles[m.role] = roles[m.role] || []).push(m); });
  const med = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
  const stat = {};
  Object.entries(roles).forEach(([r, l]) => {
    const p = l.map(m => m.pdef), d = l.map(m => m.mdef);
    stat[r] = { p: med(p), d: med(d), pMax: Math.max(...p) };
    console.log(`   ${E.ROLE_LABEL[r].padEnd(8)} 物防 ${Math.min(...p)}〜${Math.max(...p)}% (中央値${med(p)}%)   魔防 ${Math.min(...d)}〜${Math.max(...d)}% (中央値${med(d)}%)`);
  });
  ok('タンクがいちばん硬い', stat.tank.p > Math.max(stat.attacker.p, stat.shooter.p, stat.support.p, stat.trickster.p));
  ok('シューターがいちばん柔らかい', stat.shooter.p <= Math.min(stat.attacker.p, stat.support.p, stat.trickster.p));
  ok('素の防御は50%を超えない(ふだんは50が上限の想定)', E.MONSTERS.every(m => m.pdef <= 50 && m.mdef <= 50),
     E.MONSTERS.filter(m => m.pdef > 50 || m.mdef > 50).map(m => m.name));
}

console.log(ng ? `\n${ng}件 NG` : '\ndone');
if(ng) process.exitCode = 1;
