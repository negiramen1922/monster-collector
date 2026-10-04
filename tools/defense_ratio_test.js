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
  scaledStats, defBaseScale, TANK_DEF_BUDGET, MONSTERS, buildUnit, MONSTERS, MON_BY_ID, ROLE_LABEL, RUNE_STATS, runeMainValue, runeSubValue,
  makeRune, runeBonusFromList, applyRuneBonusToUnit, applyStatus, hasStatus, ENEMY_POWER, LEVEL_STAT_BONUS,
  applyStatBonus, addDefPoints, BONUS_POINT_KEYS, RELICS, SPECIES_SYNERGY, FORMATIONS, bonusText, relicEffectText, STAGES,
  POINT_BUFF_KEYS, MONSTER_KITS, applyEffect, buffAmountText, get battleUI(){ return battleUI }, set battleUI(v){ battleUI = v },
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
  // 防御見直し(α0.4.001): 図鑑の値に役割の倍率(タンク2.5・ほか2)がかかる
  const sc = E.defBaseScale(m.role), wp = Math.round(m.pdef * sc), wm = Math.round(m.mdef * sc);
  ok(`  ${m.name} は Lv1 も Lv300 も 物防${wp}% / 魔防${wm}%(図鑑の値×${sc})`,
     [[5, 1], [5, 200], [10, 300]].every(([s, l]) => at(s, l).pdef === wp && at(s, l).mdef === wm),
     [at(5, 1).pdef, at(10, 300).pdef]);
  ok(`  ${m.name} のHPとSTRはちゃんと伸びる`, at(10, 300).hp > at(5, 1).hp * 5 && at(10, 300).str > at(5, 1).str * 5);
});
// 敵も伸びない(ここを直さないと高Lvのステージで全員が上限99%になる)
function enemy(id, stageLv, boss){
  E.battleUI = { stage: { rules: [] }, currentActor: null, party: [], enemies: [], log: [], fxEvents: [] };
  return E.buildUnit(E.MON_BY_ID[id], stageLv, true, 7, boss, null, null);
}
function unitAlly(id){
  E.battleUI = { stage: { rules: [] }, currentActor: null, party: [], enemies: [], log: [], fxEvents: [] };
  return E.buildUnit(E.MON_BY_ID[id], 1, false, 5, false, 1, null);
}
const e1 = enemy(TANK, 1, false), e300 = enemy(TANK, 300, false), eBoss = enemy(TANK, 300, true);
ok('敵の防御もステージLvで伸びない', e1.pdef === e300.pdef, [e1.pdef, e300.pdef]);
// 防御見直し(α0.4.001)の倍率(タンク2.5・ほか2)は、敵にも味方にも同じようにかかる
ok('敵もタンクは図鑑の防御の2.5倍', e1.pdef === Math.round(E.MON_BY_ID[TANK].pdef * 2.5), [e1.pdef, E.MON_BY_ID[TANK].pdef]);
ok('味方も同じ(タンク2.5倍)', unitAlly(TANK).pdef === e1.pdef, unitAlly(TANK).pdef);
ok('ボス補正もかからない', eBoss.pdef === e1.pdef, [e1.pdef, eBoss.pdef]);
ok('敵のHPとSTRはステージLvで伸びる', e300.maxHp > e1.maxHp * 5 && e300.str > e1.str * 5, [e1.str, e300.str]);

// タンクの防御の合計(倍率をかけたあと)は★ごとの上限以下
{
  const over = E.MONSTERS.filter(m => m.role === 'tank').map(m => { const st = E.scaledStats(m, m.rarity, 1); return { n: m.name, r: m.rarity, t: st.pdef + st.mdef }; })
    .filter(x => x.t > E.TANK_DEF_BUDGET[x.r]);
  ok('タンクの物防+魔防は ★5:80 / ★4:75 / ★3:65 / ★2:55 / ★1:45 以下', over.length === 0, over);
}
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
  const base = E.scaledStats(E.MON_BY_ID[TANK], 5, 1).pdef, sh = E.scaledStats(E.MON_BY_ID[SHOOTER], 5, 1).pdef;
  ok(`  タンクの素は ${base}%`, E.effDef(unit(TANK), 'phys') === base, E.effDef(unit(TANK), 'phys'));
  ok('  pdefUp +8 で +8ポイント', E.effDef(unit(TANK, { pdefUp: 8 }), 'phys') === base + 8, E.effDef(unit(TANK, { pdefUp: 8 }), 'phys'));
  ok('  pdefDown -5 で -5ポイント', E.effDef(unit(TANK, { pdefDown: 5 }), 'phys') === base - 5);
  ok('  どれだけ積んでも上限99', E.effDef(unit(TANK, { pdefUp: 500 }), 'phys') === E.DEF_POINT_CAP,
     E.effDef(unit(TANK, { pdefUp: 500 }), 'phys'));
  ok('  下限は0(デバフでマイナスにならない)', E.effDef(unit(TANK, { pdefDown: 500 }), 'phys') === 0);
  // ここが割合をやめた理由: 柔らかい子にも同じだけ効く
  ok('  防御が低い子にも同じ +8 が乗る(割合ではない)',
     E.effDef(unit(SHOOTER, { pdefUp: 8 }), 'phys') - sh === 8 && E.effDef(unit(TANK, { pdefUp: 8 }), 'phys') - base === 8,
     [sh + 8, base + 8]);
}

/* ---- 3b. 装備・陣形・シナジーもポイント加算 ---- */
console.log('\n--- 3b. 上乗せはぜんぶポイント加算(掛け算はゼロ) ---');
{
  const u = unit(TANK), base = u.pdef;
  E.applyStatBonus(u, { pdef: 6 });
  ok('  applyStatBonus の pdef はポイント', u.pdef === base + 6, [base, u.pdef]);
  const v = unit(TANK), vb = v.pdef, vm = v.mdef;
  E.applyStatBonus(v, { def: 4 });
  ok('  def は物防・魔防の両方にポイント', v.pdef === vb + 4 && v.mdef === vm + 4, [v.pdef, v.mdef]);
  const w = unit(TANK), wh = w.maxHp;
  E.applyStatBonus(w, { hp: 0.2 });
  ok('  HPは今までどおり割合', near(w.maxHp / wh, 1.2, 0.01), +(w.maxHp / wh).toFixed(3));
  ok('  上限99・下限0でクランプ', E.addDefPoints(50, 500) === E.DEF_POINT_CAP && E.addDefPoints(5, -500) === 0);
  // 順番に依存しない(ルーン → 遺物 でも 遺物 → ルーン でも同じ)
  const a = unit(TANK); E.applyRuneBonusToUnit(a, { pdef: 12 }); E.applyStatBonus(a, { pdef: 6 });
  const b = unit(TANK); E.applyStatBonus(b, { pdef: 6 }); E.applyRuneBonusToUnit(b, { pdef: 12 });
  ok('  積む順番で結果が変わらない', a.pdef === b.pdef, [a.pdef, b.pdef]);
  // 表の中に割合が残っていないこと
  const relicPct = [];
  Object.values(E.RELICS).forEach(r => (r.effects || []).forEach(e => {
    if(E.BONUS_POINT_KEYS.includes(e.stat) && e.pct < 1) relicPct.push(r.name + ':' + e.stat + ':' + e.pct);
  }));
  ok('  遺物パークの防御に割合が残っていない', relicPct.length === 0, relicPct.slice(0, 5));
  ok('  陣形の防御はポイント', E.FORMATIONS.every(f => [f.frontBonus, f.backBonus].every(b => !b.def || b.def >= 1)),
     E.FORMATIONS.map(f => f.frontBonus.def).filter(Boolean));
  ok('  種族シナジーの防御はポイント', E.SPECIES_SYNERGY.dwarf.every(x => x.def >= 1), E.SPECIES_SYNERGY.dwarf.map(x => x.def));
  // ステージ効果に割合が残っていないこと(ラベルだけ直して値を忘れる事故があった)
  const ruleBad = [];
  E.STAGES.forEach(st => (st.rules || []).forEach(r => {
    if(!r.stat) return;
    ['pdef', 'mdef'].forEach(k => { const v = r.stat[k]; if(v !== undefined && v !== 0 && Math.abs(v) < 1) ruleBad.push(st.id + ' ' + k + ':' + v); });
  }));
  ok('  ステージ効果の防御に割合が残っていない', ruleBad.length === 0, ruleBad);
  // ワザが配る防御バフは「ポイント」。capRatio(上限0.8)を通すと48件ぜんぶ 0.8 に潰れる
  const clamped = [];
  E.MONSTERS.forEach(m => {
    const kit = E.MONSTER_KITS[m.id];
    ['normal', 'skill1', 'skill2', 'ult'].forEach(key => {
      const a = kit[key]; if(!a) return;
      [...(a.effects || []), ...(a.onHit || [])].forEach(e => {
        const b = e.buff || e.debuff;
        if(!b || !E.POINT_BUFF_KEYS.has(b) || e.flat || e.v === undefined) return;
        const u = unit(TANK); u.row = 'front'; u.alive = true; u.slot = 1;
        const back = unit(SHOOTER); back.row = 'back'; back.alive = true; back.slot = 2;
        E.battleUI = { round: 1, party: [u, back], enemies: [], log: [], fxEvents: [], stage: { id: 't' }, waveIndex: 0, finished: false };
        E.applyEffect({ actor: u, act: a, kind: key === 'ult' ? 'ult' : 'skill', hits: [] }, e);
        const got = [u, back].map(x => x.buffs[b] && x.buffs[b].v).find(v => v !== undefined);
        if(got !== undefined && Math.abs(got - e.v) > 0.01) clamped.push(`${m.name} ${a.name} ${b} ${e.v}→${got}`);
      });
    });
  });
  ok('  ワザの防御バフがポイントのまま届く(0.8に潰れない)', clamped.length === 0, clamped.slice(0, 6));
  ok('  防御バフの表示はポイント(x100しない・%も付けない: +8)', E.buffAmountText('mdefUp', 8, false) === '+8', E.buffAmountText('mdefUp', 8, false));
  ok('  割合のバフは今までどおりx100する(+30%)', E.buffAmountText('strUp', 0.3, false) === '+30%', E.buffAmountText('strUp', 0.3, false));
  ok('  陣形の説明文の防御はポイント(「防御+1」・%なし)', E.bonusText({ def: 1 }).endsWith('防御+1'), E.bonusText({ def: 1 }));
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
  ok('  Ⅹのメインは10ポイント(防御見直しで2倍)', main[9] === 10, main[9]);
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
ok(`BP_DEF_WEIGHT は ${E.BP_DEF_WEIGHT}`, E.BP_DEF_WEIGHT === 70, E.BP_DEF_WEIGHT);
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
  ok('タンクの素の防御は20前後まで', stat.tank.pMax <= 21, E.MONSTERS.filter(m => m.pdef > 21 || m.mdef > 21).map(m => m.name + ':' + m.pdef + '/' + m.mdef));
  ok('アタッカー・シューターの素は10以下', E.MONSTERS.filter(m => ['attacker', 'shooter'].includes(m.role)).every(m => m.pdef <= 10 && m.mdef <= 10),
     E.MONSTERS.filter(m => ['attacker', 'shooter'].includes(m.role) && (m.pdef > 10 || m.mdef > 10)).map(m => m.name));
}

console.log(ng ? `\n${ng}件 NG` : '\ndone');
if(ng) process.exitCode = 1;
