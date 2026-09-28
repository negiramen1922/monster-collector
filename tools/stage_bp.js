/* 各ステージの「敵パーティのBP」を出す。
   プレイヤー側の battlePower() と同じ式を、実際に spawnWave が作る敵ユニットに当てる。
   つまり stage.power・ENEMY_POWER・レベル補正・ボス1.12倍・陣形ボーナスまで込みの実数値。
   使い方: python3 tools/extract.py してから  cd tools && node stage_bp.js [--json] */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e={
  STAGES, MONSTERS, MON_BY_ID, buildUnit, waveFormationOf, placeRows, applyFormationBonus,
  preferredRow, slotRowIn, slotX, isMeleeRole, skillSlotsFor, applySynergies, ENEMY_SYNERGY,
};`);
const E = global.__e;

/* battlePower() と同じ重み。プレイヤーのBPと同じ物差しで比べられるようにする。 */
function bpOf(u){
  const base = u.hp * 0.6 + u.str * 4 + (u.pdef + u.mdef) * 4 + u.spd * 1.5;
  const kit = 1
    + (u.skillLv - 1) * 0.04 + (u.skill2Lv - 1) * 0.04
    + (u.ultLv - 1) * 0.04 + (u.passiveLv - 1) * 0.05
    + (E.skillSlotsFor(u.star) - 1) * 0.10;
  return Math.round(base * kit);
}

/* spawnWave のレア枠抽選だけ外したもの(確率で変わると比較にならないため) */
function waveUnits(stage, wi){
  const f = E.waveFormationOf(stage, wi);
  const entries = stage.waves[wi].map(e => ({ ...e }));
  const rowOf = e => e.row || E.preferredRow(E.MON_BY_ID[e.ref].role);
  const slots = E.placeRows(entries.filter(e => rowOf(e) === 'front'), entries.filter(e => rowOf(e) === 'back'),
    f, e => E.MON_BY_ID[e.ref].role);
  const units = [];
  slots.forEach((e, i) => {
    if(!e) return;
    const sk = stage.enemySkill || 1;
    const u = E.buildUnit(E.MON_BY_ID[e.ref], e.level, true, e.star || null, e.boss, 1,
      { skillLv: sk, skill2Lv: sk, ultLv: sk, passiveLv: sk });
    u.slot = i; u.row = E.slotRowIn(f, i); u.x = E.slotX(f, i);
    ['hp', 'maxHp', 'str', 'pdef', 'mdef'].forEach(k => { u[k] = Math.round(u[k] * (stage.power || 1)); });
    E.applyFormationBonus(u, f);
    units.push(u);
  });
  if(E.ENEMY_SYNERGY) E.applySynergies(units);
  return units;
}

/* 比較のための目安: そのステージの推奨Lvで★5キャラ5体を並べたときのプレイヤー側BP。
   敵と同じ式・同じスキルLvで作るので、敵BPとそのまま比べられる。中央値の★5を使う。 */
function refPartyBp(rec, skillLv){
  const bps = E.MONSTERS.filter(m => m.rarity === 5).map(m => {
    const u = E.buildUnit(m, 1, false, 5, false, rec, { skillLv, skill2Lv: skillLv, ultLv: skillLv, passiveLv: skillLv });
    return bpOf(u);
  }).sort((a, b) => a - b);
  return bps.length ? bps[Math.floor(bps.length / 2)] * 5 : 0;
}

const rows = E.STAGES.map(s => {
  const waves = (s.waves || []).map((w, wi) => {
    const us = waveUnits(s, wi);
    return { n: us.length, bp: us.reduce((a, u) => a + bpOf(u), 0),
             mem: us.map(u => ({ n: u.name, star: u.star, lv: u.level, bp: bpOf(u), boss: !!u.boss })) };
  });
  return { id: s.id, tier: s.tier || s.type, name: s.name, rec: s.rec, type: s.type,
           boss: !!s.boss, power: s.power || 1, skill: s.enemySkill || 1,
           waves, total: waves.reduce((a, w) => a + w.bp, 0),
           peak: waves.reduce((a, w) => Math.max(a, w.bp), 0),
           ref: refPartyBp(s.rec, s.enemySkill || 1) };
});

if(process.argv.includes('--json')){ console.log(JSON.stringify(rows)); }
else{
  let tier = null;
  rows.forEach(r => {
    if(r.tier !== tier){ tier = r.tier; console.log('\n===== ' + tier + ' ====='); }
    console.log(`${r.id.padEnd(9)} 推奨Lv${String(r.rec).padStart(3)} ` +
      r.waves.map(w => `W:${w.n}体 ${String(w.bp).padStart(6)}`).join(' | ') +
      `  最大${String(r.peak).padStart(6)}  目安${String(r.ref).padStart(6)}(${Math.round(r.peak / r.ref * 100)}%)` +
      (r.boss ? '  BOSS' : ''));
  });
}
