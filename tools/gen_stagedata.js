/* 確認ツール(Artifact)のステージタブ用データを index.html から作り直す。
   各ウェーブ・各敵のBPと、推奨Lvでの「★5×5体の目安BP」を一緒に出す。
   使い方: python3 tools/extract.py してから  cd tools && node gen_stagedata.js > out.json */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e={
  STAGES, MONSTERS, MON_BY_ID, QUEST_TIERS_ACTIVE, kitOf, buildUnit, waveFormationOf, placeRows,
  applyFormationBonus, preferredRow, slotRowIn, slotX, skillSlotsFor, applySynergies, ENEMY_SYNERGY,
};`);
const E = global.__e;

const bpOf = u => Math.round((u.hp * 0.6 + u.str * 4 + (u.pdef + u.mdef) * 4 + u.spd * 1.5)
  * (1 + (u.skillLv - 1) * 0.04 + (u.skill2Lv - 1) * 0.04 + (u.ultLv - 1) * 0.04
       + (u.passiveLv - 1) * 0.05 + (E.skillSlotsFor(u.star) - 1) * 0.10));

const refCache = {};
function refPartyBp(rec, sk){
  const key = rec + '/' + sk;
  if(refCache[key] != null) return refCache[key];
  const bps = E.MONSTERS.filter(m => m.rarity === 5).map(m =>
    bpOf(E.buildUnit(m, 1, false, 5, false, rec, { skillLv: sk, skill2Lv: sk, ultLv: sk, passiveLv: sk }))
  ).sort((a, b) => a - b);
  return refCache[key] = (bps.length ? bps[Math.floor(bps.length / 2)] * 5 : 0);
}

function waveUnits(stage, wi){
  const f = E.waveFormationOf(stage, wi);
  const entries = stage.waves[wi].map(e => ({ ...e }));
  const rowOf = e => e.row || E.preferredRow(E.MON_BY_ID[e.ref].role);
  const slots = E.placeRows(entries.filter(e => rowOf(e) === 'front'),
    entries.filter(e => rowOf(e) === 'back'), f, e => E.MON_BY_ID[e.ref].role);
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

/* 各ティアに置いた4軸ステージ。確認ツールでバッジとして出す。
   中身は stage_axis_test.js の PLAN と同じで、null は材料不足で未設置。 */
const AXIS = {
  q1: { mag:'q1_09', phy:'q1_01' },
  q2: { mag:'q2_06', phy:'q2_04', mdef:'q2_07' },
  q3: { mag:'q3_02', phy:'q3_03', pdef:'q3_07', mdef:'q3_09' },
  q4: { mag:'q4_01', phy:'q4_04', pdef:'q4_03', mdef:'q4_09' },
  q5: { mag:'q5_08', phy:'q5_01', pdef:'q5_07', mdef:'q5_09' },
  q6: { mag:'q6_08', phy:'q6_02', pdef:'q6_04', mdef:'q6_03' },
  q7: { mag:'q7_04', phy:'q7_03', pdef:'q7_09', mdef:'q7_07' },
};
const AXIS_LABEL = { mag:'魔法攻撃', phy:'物理攻撃', pdef:'物理耐性', mdef:'魔法耐性' };
const axisOf = {};
Object.keys(AXIS).forEach(t => Object.keys(AXIS[t]).forEach(k => {
  const id = AXIS[t][k];
  if(id){ axisOf[id] = k; axisOf[id + 'h'] = k; }
}));

/* 敵の攻撃のうち魔法が占める割合と、最終ウェーブの 物防-魔防 の差 */
function magShareOf(mon){
  const k = E.kitOf(mon);
  let mag = 0, tot = 0;
  ['normal', 'skill1', 'skill2', 'ult'].forEach(n => {
    const o = k[n]; if(!o || !o.pow) return;
    const w = o.pow * (o.hits || 1);
    tot += w; if(o.atk === 'mag') mag += w;
  });
  return tot ? mag / tot : 0;
}
const magCache = {};
const magOf = id => magCache[id] != null ? magCache[id] : (magCache[id] = magShareOf(E.MON_BY_ID[id]));

const tiers = E.QUEST_TIERS_ACTIVE.map(t => ({ key: t.key, label: t.label, lv: t.lv, skill: t.skill,
  hard: !!t.hard, waves: t.waves, star: t.star, bossStar: t.bossStar }));
tiers.push({ key: 'event', label: 'イベント', lv: null, skill: null, hard: false, waves: 5, star: null, bossStar: null });

const data = E.STAGES.map(s => {
  const ref = refPartyBp(s.rec, s.enemySkill || 1);
  const w = (s.waves || []).map((wave, wi) => {
    const us = waveUnits(s, wi);
    return { bp: us.reduce((a, u) => a + bpOf(u), 0),
      e: us.map(u => ({ r: u.ref, n: u.name, lv: u.level, st: u.star, b: !!u.boss, row: u.row, bp: bpOf(u) })) };
  });
  const refs = s.waves.flat().map(e => e.ref);
  const mag = refs.length ? refs.reduce((a, r) => a + magOf(r), 0) / refs.length : 0;
  const last = s.waves.slice(-1)[0].map(e => E.MON_BY_ID[e.ref]);
  const gap = (last.reduce((a, m) => a + m.pdef, 0) - last.reduce((a, m) => a + m.mdef, 0)) / last.length;
  return { id: s.id, tier: s.tier || s.type, name: s.name, req: s.requires || null,
    sk: s.enemySkill || 1, rec: s.rec, ref,
    mag: Math.round(mag * 100), gap: Math.round(gap * 10) / 10,
    axis: axisOf[s.id] || null, axisJa: AXIS_LABEL[axisOf[s.id]] || null,
    peak: w.reduce((a, x) => Math.max(a, x.bp), 0), total: w.reduce((a, x) => a + x.bp, 0), w };
});
console.log('/* 全' + data.length + 'ステージの敵編成とBP。tools/gen_stagedata.js が index.html から生成。 */');
console.log('const TIERS = ' + JSON.stringify(tiers) + ';');
console.log('const STAGEDATA = ' + JSON.stringify(data) + ';');
