/* スキルLv・パッシブLvの制度(α0.5)の回帰テスト。
   スキル1・スキル2・奥義は上限10(Lv10で1.5倍)、パッシブは上限5(Lv5で1.5倍)。
   古いセーブ(スキルLv11・12、パッシブLv6以上)は一度だけ移して、素材をプレゼントボックスで返す。
   使い方: cd tools && node lv_system_test.js */
const load = require('./harness.js');
const api = load('game.js', s => s + `;global.__e={
  DEFAULT_STATE, lvScale, passiveLvScale, passiveFromSkillLv, skillCapOf, SKILL_MAT_COST, PASSIVE_MAT_COST,
  skillCostList, migrateLvSystem, normalizeState, MON_BY_ID, buildUnit, STAGES, findStage, spawnWave, pv,
  get STATE(){ return STATE }, set STATE(v){ STATE = v },
};`);
const E = global.__e;
let ng = 0;
const ok = (name, cond, info) => { if(!cond){ ng++; console.log('❌ ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : '')); } };
const near = (a, b) => Math.abs(a - b) < 1e-9;

// 倍率
ok('スキルLv1は1倍', near(E.lvScale(1), 1));
ok('スキルLv10は1.5倍', near(E.lvScale(10), 1.5), E.lvScale(10));
ok('スキルLv5は約1.22倍', near(E.lvScale(5), 1 + 4 * 0.5 / 9), E.lvScale(5));
ok('スキルLv12でも1.5倍で止まる', near(E.lvScale(12), 1.5));
ok('パッシブLv1は1倍', near(E.passiveLvScale(1), 1));
ok('パッシブLv3は1.25倍', near(E.passiveLvScale(3), 1.25));
ok('パッシブLv5は1.5倍', near(E.passiveLvScale(5), 1.5));
ok('パッシブLv10でも1.5倍で止まる', near(E.passiveLvScale(10), 1.5));

// 上限
const o = { star: 10 };
ok('★10でもスキルの上限は10', E.skillCapOf(o, 'skillLv') === 10 && E.skillCapOf(o, 'ultLv') === 10);
ok('パッシブの上限は5', E.skillCapOf(o, 'passiveLv') === 5);

// 素材
ok('スキル Lv8→9 に TierIV×1', E.SKILL_MAT_COST[8][3] === 1);
ok('スキル Lv9→10 に TierIV×2', E.SKILL_MAT_COST[9][3] === 2);
ok('スキル Lv10→11 はない', !E.SKILL_MAT_COST[10]);
const sum = t => Object.values(t).reduce((a, c) => a.map((v, i) => v + c[i]), [0, 0, 0, 0]);
ok('パッシブの素材の合計は前の Lv1→10 と同じ(89/29/6/0)', JSON.stringify(sum(E.PASSIVE_MAT_COST)) === '[89,29,6,0]', sum(E.PASSIVE_MAT_COST));
const m = E.MON_BY_ID.m54;
ok('パッシブの素材はパッシブの表', E.skillCostList(m, 'passiveLv', 3).reduce((a, c) => a + c.n, 0) === (34 + 12 + 1) * 2);

// 移し替え
const mk = () => { api.STATE = E.DEFAULT_STATE(); delete api.STATE.lvSys; return api.STATE; };
let S = mk();
S.owned.m54 = { star: 7, souls: 0, level: 200, skillLv: 12, skill2Lv: 11, ultLv: 10, passiveLv: 12 };
S.owned.m116 = { star: 5, souls: 0, level: 100, skillLv: 5, skill2Lv: 5, ultLv: 5, passiveLv: 4 };
S.owned.m06 = { star: 1, souls: 0, level: 1, skillLv: 1, skill2Lv: 1, ultLv: 1, passiveLv: 1 };
const refund = E.migrateLvSystem();
ok('スキルLv12→10', S.owned.m54.skillLv === 10 && S.owned.m54.skill2Lv === 10 && S.owned.m54.ultLv === 10, S.owned.m54);
ok('パッシブLv12→5', S.owned.m54.passiveLv === 5);
ok('パッシブLv4→2', S.owned.m116.passiveLv === 2);
ok('パッシブLv1→1', S.owned.m06.passiveLv === 1);
// タイタン: スキル1(10→11・11→12: TierIV 1+2=3)、スキル2(10→11: 1)、パッシブ(10→11・11→12: 3) をそれぞれ2系統ぶん
const t4 = Object.entries(refund).filter(([k]) => /_4$|4$/.test(k));
ok('返す素材がある', Object.keys(refund).length > 0, refund);
ok('プレゼントボックスに1件届く', S.presentBox.length === 1 && /見直し/.test(S.presentBox[0].label), S.presentBox.map(x => x.label));
ok('lvSys が2になる', S.lvSys === 2);
// 2回目は何もしない(normalizeState は lvSys を見る)
const before = S.presentBox.length;
E.normalizeState();
ok('2回読んでも素材は2回返らない', S.presentBox.length === before, S.presentBox.length);
// 新しいセーブは移し替えない
S = E.DEFAULT_STATE(); api.STATE = S;
E.normalizeState();
ok('新しいセーブにはお返しが届かない', S.presentBox.length === 0 && S.lvSys === 2);

// パッシブLv1・3・5 の値
const u1 = { passiveLv: 1 }, u3 = { passiveLv: 3 }, u5 = { passiveLv: 5 };
ok('pv: パッシブLv1/3/5 で 1/1.25/1.5 倍', near(E.pv(u1, 0.2), 0.2) && near(E.pv(u3, 0.2), 0.25) && near(E.pv(u5, 0.2), 0.3));

// 敵: ステージの enemySkill をパッシブLvに読み替える
ok('敵のスキルLv10 → パッシブLv5', E.passiveFromSkillLv(10) === 5);
ok('敵のスキルLv6 → パッシブLv3', E.passiveFromSkillLv(6) === 3);
const u = E.buildUnit(E.MON_BY_ID.m54, 100, true, 5, false, 1, { skillLv: 12, ultLv: 12, passiveLv: 12 });
ok('buildUnit はスキルLv10・パッシブLv5で止める', u.skillLv === 10 && u.ultLv === 10 && u.passiveLv === 5, [u.skillLv, u.ultLv, u.passiveLv]);
const tooHigh = E.STAGES.filter(st => (st.enemySkill || 0) > 10).map(st => st.id);
ok('ステージの敵のスキルLvは10まで', tooHigh.length === 0, tooHigh.slice(0, 5));

console.log(ng ? `❌${ng}` : 'すべて通過');
