/* バトルシステムの検証(α0.5 で新バトルシステムだけになった)。
   使い方: cd tools && node battle_v2_test.js */
const load = require('./harness.js');
const api = load('game.js', s => s + `;global.__e={
  MONSTERS, MON_BY_ID, scaledStats, battlePower, initialSkillCds, buildUnit, skillCt,
  ultSpCostFor, hpScale, shieldCapRatio, spFromDamage, avgBaseHp, addShield, shieldTotal,
  stageStaminaCost, grantStageRewards, grantDungeonRewards, sweepSpawned, findStage, statsWithRelic,
  RELICS, newRelicState, BATTLE_V2_SP_KILL, BATTLE_V2_HIT_CAP, BATTLE_V2_HP_SCALE,
  WAVE_LV_RAMP, waveEnemyLv, spawnWave, STAGES,
};`);
const E = global.__e;
let ng = 0;
const check = (name, ok, got) => { if(!ok){ ng++; console.log('NG ' + name, got === undefined ? '' : got); } };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

api.STATE = api.DEFAULT_STATE();
const S = api.STATE;
const by = Object.fromEntries(E.MONSTERS.map(m => [m.name, m.id]));
const titan = E.MON_BY_ID[by['タイタン']];
const kyubi = E.MON_BY_ID[by['九尾の狐']];
const fenrir = E.MON_BY_ID[by['フェンリル']];

/* ---- 旧に戻す設定はもうない ---- */
check('セーブに battleV2 を持たない', !('battleV2' in api.DEFAULT_STATE()));
check('セーブに v2Cleared を持たない', !('v2Cleared' in api.DEFAULT_STATE()));
check('HPの倍率は2', E.hpScale() === 2 && E.BATTLE_V2_HP_SCALE === 2);

/* ---- 初期CT ---- */
const mk = (mon, enemy, boss) => E.buildUnit(mon, 100, !!enemy, 5, !!boss, 250, { skillLv: 10, skill2Lv: 10, ultLv: 10, passiveLv: 10 });
let u = mk(kyubi);
check('初期CTは全部0', u.skillCd.every(c => c === 0), u.skillCd);

/* ---- 必要SP ---- */
// α0.5: ロールの差は ult.sp に入れたので、戦闘中には足し引きしない(ult_sp_test.js)
check('タンクも必要SPはデータのまま', E.ultSpCostFor('tank', 70) === 70, E.ultSpCostFor('tank', 70));
check('シューターも必要SPはデータのまま', E.ultSpCostFor('shooter', 80) === 80, E.ultSpCostFor('shooter', 80));
check('下限40を割らない', E.ultSpCostFor('tank', 30) === 40, E.ultSpCostFor('tank', 30));

/* ---- 被弾SPは「平均HP」基準 ---- */
const tu = mk(titan), ku = mk(kyubi);
check('基準HPは自分のHPではなく平均HP', tu.spRefHp !== tu.maxHp && near(tu.spRefHp, ku.spRefHp, 2), `${tu.spRefHp} / ${ku.spRefHp}`);
check('タンクの方がHPは多い', tu.maxHp > ku.maxHp, `${tu.maxHp} / ${ku.maxHp}`);
const dmg = Math.round(tu.spRefHp * 0.2);   // 基準HPの20%ぶん
check('同じダメージなら同じSP(ロール差が消える)', E.spFromDamage(tu, dmg) === E.spFromDamage(ku, dmg), `${E.spFromDamage(tu, dmg)} / ${E.spFromDamage(ku, dmg)}`);
check('基準HPの20%でSP25', E.spFromDamage(tu, dmg) === 25, E.spFromDamage(tu, dmg));
check('1発で基準HP超えても100%ぶんで頭打ち', E.spFromDamage(tu, tu.spRefHp * 5) === 125, E.spFromDamage(tu, tu.spRefHp * 5));

/* ---- 撃破SPと被弾SPの上限 ---- */
check('撃破SPは25', E.BATTLE_V2_SP_KILL === 25);
check('被弾SPの上限は60', E.BATTLE_V2_HIT_CAP === 60);

/* ---- シールドの上限 ---- */
check('シールド上限は100%', E.shieldCapRatio() === 1.0);

/* ---- 敵のレベル(ウェーブごとに上がり、最終ウェーブが推奨Lv) ---- */
const stage = E.STAGES.find(st => st.type === 'main' && (st.waves || []).length >= 3 && (st.waves || []).some(w => w.some(e => e.boss)));
if(stage){
  const n = stage.waves.length;
  const lvs = stage.waves.map((w, i) => E.waveEnemyLv(stage, i));
  check('最終ウェーブは推奨レベルちょうど', lvs[n - 1] === stage.rec, `${stage.id} 推奨${stage.rec} → ${lvs[n - 1]}`);
  check('ウェーブが進むとレベルが上がる', lvs.every((v, i) => i === 0 || v >= lvs[i - 1]), lvs.join(','));
  check('第1ウェーブは推奨レベルの 1-WAVE_LV_RAMP', lvs[0] === Math.max(1, Math.round(stage.rec * (1 - E.WAVE_LV_RAMP))), `${lvs[0]}`);
  // ボスも取り巻きも最終ウェーブのレベル(推奨Lv = ボスのレベル で一本)
  const wi = stage.waves.findIndex(w => w.some(e => e.boss));
  const nw = E.spawnWave(stage, wi);
  const bossNew = nw.find(x => x.boss), mobNew = nw.find(x => !x.boss);
  if(bossNew && mobNew) check('同じウェーブならボスと取り巻きは同じレベル', bossNew.level === mobNew.level, `${bossNew.level} / ${mobNew.level}`);
  if(bossNew) check('ボスのレベルは推奨レベル', bossNew.level === stage.rec, `${bossNew.level} / ${stage.rec}`);
}
// 1ウェーブのステージ(深淵回廊)はいつも推奨レベルちょうど
check('1ウェーブなら推奨レベルちょうど', E.waveEnemyLv({ rec: 300, waves: [[]] }, 0) === 300);
// 推奨Lvが低いステージでもレベル1に潰れない
check('推奨Lv6でも第1ウェーブは1より上', E.waveEnemyLv({ rec: 6, waves: [[], [], []] }, 0) === 5, E.waveEnemyLv({ rec: 6, waves: [[], [], []] }, 0));

/* ---- お試し(初回スタミナ0＋お礼の星結晶)は α0.5 でなくなった ---- */
api.STATE = api.DEFAULT_STATE();
const S2 = api.STATE;
[titan.id, kyubi.id, fenrir.id].forEach(id => { S2.owned[id] = { star: 5, souls: 0, level: 250, skillLv: 10, ultLv: 10, passiveLv: 10 }; });
S2.slots = [titan.id, kyubi.id, fenrir.id, null, null];
S2.clearedStages = E.STAGES.map(x => x.id);
const st = E.findStage('q4_05');
check('初回からスタミナがかかる', E.stageStaminaCost(st) === st.stamina, E.stageStaminaCost(st));
const before = S2.crystals;
const r = E.grantStageRewards(st, [], [{ ref: titan.id }]);
check('お礼の星結晶は出ない', !('v2Crystals' in r) && S2.crystals === before, S2.crystals - before);
const dg = E.findStage('dg_exp_1');
if(dg) check('育成クエストも初回からスタミナがかかる', E.stageStaminaCost(dg) === dg.stamina, [E.stageStaminaCost(dg), dg.stamina]);

console.log(ng ? `❌${ng}` : 'すべて通過');
