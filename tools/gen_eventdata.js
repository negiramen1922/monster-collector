/* 次回イベントの各層を、決定シートで見られる形にして書き出す。

   勝率だけ見せても判断できない(「どんな敵が、どこに、どのレベルで並ぶのか」が
   分からない)ので、実際に spawnWave が組み立てるのと同じ手順でユニットを作り、
   配置・レベル・スキルLv・ステータス・BPまで出す。

   使い方: cd tools && python3 extract.py && node gen_eventdata.js > event_tiers.json */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e={
  EVENTS, STAGE_BY_ID, MON_BY_ID, MONSTERS, buildUnit, waveFormationOf, placeRows,
  applyFormationBonus, preferredRow, slotRowIn, slotX, skillSlotsFor, applySynergies,
  ENEMY_SYNERGY, ELEM_LABEL, ROLE_LABEL, SPECIES_LABEL, speciesOf,
};`);
const E = global.__e;

/* ゲーム内の battlePower() と同じ式。プレイヤーのBPと同じ物差しで比べられる。 */
const bpOf = u => Math.round((u.hp * 0.6 + u.str * 4 + (u.pdef + u.mdef) * 4 + u.spd * 1.5)
  * (1 + (u.skillLv - 1) * 0.04 + (u.skill2Lv - 1) * 0.04 + (u.ultLv - 1) * 0.04
       + (u.passiveLv - 1) * 0.05 + (E.skillSlotsFor(u.star) - 1) * 0.10));

/* spawnWave からレア枠の抽選だけ外したもの(確率で変わると比較にならない) */
function wave(stage, wi){
  const f = E.waveFormationOf(stage, wi);
  const es = stage.waves[wi].map(e => ({ ...e }));
  const rowOf = e => e.row || E.preferredRow(E.MON_BY_ID[e.ref].role);
  const slots = E.placeRows(es.filter(e => rowOf(e) === 'front'),
    es.filter(e => rowOf(e) === 'back'), f, e => E.MON_BY_ID[e.ref].role);
  const us = [];
  slots.forEach((e, i) => {
    if(!e) return;
    const sk = stage.enemySkill || 1;
    const u = E.buildUnit(E.MON_BY_ID[e.ref], e.level, true, e.star || null, e.boss, 1,
      { skillLv: sk, skill2Lv: sk, ultLv: sk, passiveLv: sk });
    u.slot = i; u.row = E.slotRowIn(f, i); u.x = E.slotX(f, i);
    ['hp', 'maxHp', 'str', 'pdef', 'mdef'].forEach(k => { u[k] = Math.round(u[k] * (stage.power || 1)); });
    E.applyFormationBonus(u, f);
    us.push(u);
  });
  if(E.ENEMY_SYNERGY) E.applySynergies(us);
  const m = id => E.MON_BY_ID[id];
  return {
    formation: f.key, n: us.length, bp: us.reduce((a, u) => a + bpOf(u), 0),
    units: us.map(u => ({
      ref: u.ref, n: u.name, boss: !!u.boss, row: u.row, star: u.star, lv: u.level,
      el: E.ELEM_LABEL[m(u.ref).element], role: E.ROLE_LABEL[m(u.ref).role],
      sp: E.SPECIES_LABEL[E.speciesOf(m(u.ref))],
      hp: u.hp, str: u.str, pdef: u.pdef, mdef: u.mdef, spd: u.spd, bp: bpOf(u),
    })),
  };
}

/* 比べるための目安: 同じ推奨Lv・同じスキルLvで★5を5体並べたときのプレイヤー側BP */
const refCache = {};
function refBp(rec, sk){
  const k = rec + '/' + sk;
  if(refCache[k] != null) return refCache[k];
  const v = E.MONSTERS.filter(m => m.rarity === 5).map(m =>
    bpOf(E.buildUnit(m, 1, false, 5, false, rec, { skillLv: sk, skill2Lv: sk, ultLv: sk, passiveLv: sk })))
    .sort((a, b) => a - b);
  return refCache[k] = (v.length ? v[Math.floor(v.length / 2)] * 5 : 0);
}

const out = E.EVENTS.filter(ev => ev.key === 'ev_fenrir' || ev.key === 'ev_abaddon').map(ev => ({
  key: ev.key, name: ev.name, pickup: E.MON_BY_ID[ev.pickup].name,
  el: E.ELEM_LABEL[ev.element], stageName: ev.stageName,
  tiers: ev.tiers.map((t, i) => {
    const s = E.STAGE_BY_ID[ev.key + '_' + (i + 1)];
    const ws = s.waves.map((_, wi) => wave(s, wi));
    return {
      n: i + 1, rec: s.rec, skill: s.enemySkill || 1, bossStar: t.bossStar,
      escortStar: t.star, rate: t.rate, stamina: s.stamina,
      total: ws.reduce((a, w) => a + w.bp, 0),
      peak: ws.reduce((a, w) => Math.max(a, w.bp), 0),
      ref: refBp(s.rec, s.enemySkill || 1),
      waves: ws,
    };
  }),
}));
console.log(JSON.stringify(out));
