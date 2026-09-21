/* regression test: skill1(skillLv) and skill2(skill2Lv) used to share one level stat
   (skillLv), so investing materials into "skill1" also silently powered up skill2 and
   vice versa. This verifies they now level and scale fully independently:
   1. upgradeSkillLevel('skillLv'/'skill2Lv') only ever touches its own field.
   2. In battle, a skill fired from slot 0 scales off skillLv and one fired from slot 1
      scales off skill2Lv (performAction's curSkillLv stash -> sv()/dealHits).
   3. A legacy save without skill2Lv gets it seeded from skillLv (no regression), and
      buildUnit falls back the same way for any upgrades object missing skill2Lv. */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e = {
  get STATE(){ return STATE }, set STATE(v){ STATE = v }, DEFAULT_STATE,
  MON_BY_ID, upgradeSkillLevel, addItem, skillCostList, skillCapOf,
  normalizeState, buildUnit, lvScale,
  performAction, sv, get battleUI(){ return battleUI }, startBattle,
  lineupFromList, formationForFrontCount, isMeleeRole, STAGES,
};`);
const E = global.__e;
const ok = (name, cond, info) => console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));

// --- 1. upgradeSkillLevel: skillLv and skill2Lv upgrade independently ---
api.STATE = E.DEFAULT_STATE();
const id = 'm116'; // 九尾, ★5, has 2 skill slots
const m = E.MON_BY_ID[id];
api.STATE.owned[id] = { star: 5, souls: 0, level: 10, skillLv: 1, skill2Lv: 1, ultLv: 1, passiveLv: 1 };
const owned = api.STATE.owned[id];
const grantMats = (field, lv) => E.skillCostList(m, field, lv).forEach(c => E.addItem(c.key, c.n));

grantMats('skillLv', 1);
E.upgradeSkillLevel(id, 'skillLv');
ok('スキル1だけレベルアップするとskillLvだけ上がる', owned.skillLv === 2 && owned.skill2Lv === 1, [owned.skillLv, owned.skill2Lv]);

grantMats('skill2Lv', 1);
E.upgradeSkillLevel(id, 'skill2Lv');
ok('スキル2だけレベルアップするとskill2Lvだけ上がる(skillLvは変わらない)', owned.skillLv === 2 && owned.skill2Lv === 2, [owned.skillLv, owned.skill2Lv]);

// --- 2. migration: legacy owned object without skill2Lv gets seeded from skillLv ---
api.STATE.owned['m21'] = { star: 3, souls: 0, level: 10, skillLv: 7, ultLv: 1, passiveLv: 1 }; // no skill2Lv at all
delete api.STATE.owned['m21'].skill2Lv;
E.normalizeState();
ok('旧セーブ(skill2Lvなし)はskillLvの値がskill2Lvに引き継がれる', api.STATE.owned['m21'].skill2Lv === 7, api.STATE.owned['m21']);

// already-migrated saves are left untouched by a second normalize
api.STATE.owned['m21'].skillLv = 9;
E.normalizeState();
ok('既にskill2Lvがある場合は上書きされない', api.STATE.owned['m21'].skill2Lv === 7, api.STATE.owned['m21']);

// --- 3. battle scaling: skill1 fired from slot 0 uses skillLv, skill2 from slot 1 uses skill2Lv ---
api.STATE = E.DEFAULT_STATE();
const party = ['m116', 'm06', 'm21'];
party.forEach(pid => api.STATE.owned[pid] = { star: 5, souls: 0, level: 10, skillLv: 1, skill2Lv: 10, ultLv: 1, passiveLv: 1 });
const fk = E.formationForFrontCount(Math.max(1, party.filter(pid => E.isMeleeRole(E.MON_BY_ID[pid].role)).length)).key;
api.STATE.formationKey = fk;
api.STATE.slots = E.lineupFromList(party, fk);
api.STATE.clearedStages = E.STAGES.map(s => s.id);
api.STATE.stamina = 1e9;
api.STATE.daily = null;
api.startBattle('q1_01', { skipIntro: true });
api.resetQueue();
const B = E.battleUI;
B.transitioning = false;
B.paused = true;
const kyu = B.party.find(u => u.ref === 'm116');

ok('スキル1はskillLv(=1)で計算される(スロット0)', E.sv(kyu, 1) === E.lvScale(1), [E.sv(kyu, 1), E.lvScale(1)]);
E.performAction(kyu, 'skill', kyu.skills[0], 0);
ok('スロット0でスキル発動後もskillLv基準のまま', E.sv(kyu, 1, 'skill') === E.lvScale(1), [E.sv(kyu, 1, 'skill'), E.lvScale(1)]);
E.performAction(kyu, 'skill', kyu.skills[1], 1);
ok('スロット1(スキル2)発動時はskill2Lv(=10)で計算される', E.sv(kyu, 1, 'skill') === E.lvScale(10), [E.sv(kyu, 1, 'skill'), E.lvScale(10)]);
E.performAction(kyu, 'skill', kyu.skills[0], 0);
ok('その後スロット0に戻ると再びskillLv(=1)基準に戻る', E.sv(kyu, 1, 'skill') === E.lvScale(1), [E.sv(kyu, 1, 'skill'), E.lvScale(1)]);
E.performAction(kyu, 'ult', kyu.ult);
ok('通常アクション(ult)はcurSkillLvに影響されずultLv基準', E.sv(kyu, 1, 'ult') === E.lvScale(kyu.ultLv), [E.sv(kyu, 1, 'ult'), E.lvScale(kyu.ultLv)]);

// --- 4. buildUnit fallback: upgrades object missing skill2Lv falls back to skillLv, never lower ---
const u1 = E.buildUnit(m, 10, false, 5, false, 10, { skillLv: 6, ultLv: 1, passiveLv: 1 });
ok('buildUnit: skill2Lv省略時はskillLvにフォールバックする(弱体化しない)', u1.skill2Lv === 6, u1.skill2Lv);
const u2 = E.buildUnit(m, 10, false, 5, false, 10, { skillLv: 3, skill2Lv: 8, ultLv: 1, passiveLv: 1 });
ok('buildUnit: skill2Lvが明示されていればそれが使われる', u2.skillLv === 3 && u2.skill2Lv === 8, [u2.skillLv, u2.skill2Lv]);

console.log('done');
