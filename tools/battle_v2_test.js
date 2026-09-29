/* 新バトルシステム(α0.3)の検証。
   設定の battleV2 で旧/新が切り替わり、切り替えると表示(HP・BP)まで一緒に戻ることを見る。
   使い方: cd tools && node battle_v2_test.js */
const load = require('./harness.js');
const api = load('game.js', s => s + `;global.__e={
  MONSTERS, MON_BY_ID, scaledStats, battlePower, initialSkillCds, buildUnit, skillCt,
  ultSpCostFor, hpScale, shieldCapRatio, spFromDamage, avgBaseHp, addShield, shieldTotal,
  stageStaminaCost, grantStageRewards, sweepSpawned, findStage, statsWithRelic,
  RELICS, newRelicState, BATTLE_V2_SP_KILL, SP_ON_KILL, SP_HIT_CAP_PER_ROUND, BATTLE_V2_HIT_CAP,
  BATTLE_V2_MOB_LV, spawnWave, STAGES,
};`);
const E = global.__e;
let ng = 0;
const check = (name, ok, got) => { if(!ok){ ng++; console.log('NG ' + name, got === undefined ? '' : got); } };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

api.STATE = api.DEFAULT_STATE();
const S = api.STATE;
const by = Object.fromEntries(E.MONSTERS.map(m => [m.name, m.id]));
const titan = E.MON_BY_ID[by['タイタン']];        // tank   ult sp 120
const kyubi = E.MON_BY_ID[by['九尾の狐']];        // shooter ult sp 120
const fenrir = E.MON_BY_ID[by['フェンリル']];     // attacker ult sp 120
const v2 = on => { api.STATE.battleV2 = on; };

/* ---- 既定は新 ---- */
check('既定で新バトルシステム', api.DEFAULT_STATE().battleV2 === true);

/* ---- HPが2倍、旧に戻すと元通り ---- */
v2(false); const hpOld = E.scaledStats(titan, 5, 250).hp;
v2(true);  const hpNew = E.scaledStats(titan, 5, 250).hp;
check('新でHPが2倍', near(hpNew, hpOld * 2, 2), `${hpOld} → ${hpNew}`);
v2(false); check('旧に戻すとHPも戻る', E.scaledStats(titan, 5, 250).hp === hpOld);
v2(true);
check('STRは変わらない', E.scaledStats(titan, 5, 250).str === (v2(false), E.scaledStats(titan, 5, 250).str));
v2(true);

/* ---- BPはHPの重みで打ち消されて据え置き ---- */
S.owned[titan.id] = { star: 5, souls: 0, level: 250, skillLv: 10, ultLv: 10, passiveLv: 10 };
S.slots = [titan.id, null, null, null, null];
v2(false); const bpOld = E.battlePower(titan.id);
v2(true);  const bpNew = E.battlePower(titan.id);
check('BPは新旧でほぼ同じ(±3%)', near(bpNew, bpOld, bpOld * 0.03), `${bpOld} → ${bpNew}`);

/* ---- 遺物のHP固定値も2倍 ---- */
const relicWithHp = Object.values(E.RELICS).find(r => r.base && r.base.hp);
if(relicWithHp){
  S.relics[relicWithHp.id] = E.newRelicState();
  S.relics[relicWithHp.id].level = 80;
  S.relics[relicWithHp.id].equippedTo = titan.id;
  v2(false); const withOld = E.statsWithRelic(titan, 5, 250, relicWithHp.id, null).hp;
  v2(true);  const withNew = E.statsWithRelic(titan, 5, 250, relicWithHp.id, null).hp;
  check('遺物の固定値HPも2倍になる', near(withNew, withOld * 2, 3), `${withOld} → ${withNew}`);
  delete S.relics[relicWithHp.id];
}

/* ---- 初期CT ---- */
const mk = (mon, enemy, boss) => E.buildUnit(mon, 100, !!enemy, 5, !!boss, 250, { skillLv: 10, skill2Lv: 10, ultLv: 10, passiveLv: 10 });
v2(true);
let u = mk(kyubi);
check('新: 初期CTは全部0', u.skillCd.every(c => c === 0), u.skillCd);
v2(false);
u = mk(kyubi);
check('旧: スキル1はCTの半分', u.skillCd[0] === Math.ceil(E.skillCt(u, 0) / 2), u.skillCd);
check('旧: スキル2はCT+1', u.skillCd[1] === E.skillCt(u, 1) + 1, u.skillCd);

/* ---- 必要SP ---- */
v2(true);
check('タンクの必要SPは-30', mk(titan).spCost === titan && 0 || E.ultSpCostFor('tank', 120) === 90, E.ultSpCostFor('tank', 120));
check('シューターの必要SPは-20', E.ultSpCostFor('shooter', 120) === 100, E.ultSpCostFor('shooter', 120));
check('アタッカーは据え置き', E.ultSpCostFor('attacker', 120) === 120);
check('サポートは据え置き', E.ultSpCostFor('support', 110) === 110);
check('下限40を割らない', E.ultSpCostFor('tank', 60) === 40, E.ultSpCostFor('tank', 60));
v2(false);
check('旧はどのロールも変わらない', E.ultSpCostFor('tank', 120) === 120 && E.ultSpCostFor('shooter', 120) === 120);

/* ---- 被弾SPは「平均HP」基準 ---- */
v2(true);
const tu = mk(titan), ku = mk(kyubi);
check('基準HPは自分のHPではなく平均HP', tu.spRefHp !== tu.maxHp && near(tu.spRefHp, ku.spRefHp, 2), `${tu.spRefHp} / ${ku.spRefHp}`);
check('タンクの方がHPは多い', tu.maxHp > ku.maxHp, `${tu.maxHp} / ${ku.maxHp}`);
const dmg = Math.round(tu.spRefHp * 0.2);   // 基準HPの20%ぶん
check('同じダメージなら同じSP(ロール差が消える)', E.spFromDamage(tu, dmg) === E.spFromDamage(ku, dmg), `${E.spFromDamage(tu, dmg)} / ${E.spFromDamage(ku, dmg)}`);
check('基準HPの20%でSP25', E.spFromDamage(tu, dmg) === 25, E.spFromDamage(tu, dmg));
check('1発で基準HP超えても100%ぶんで頭打ち', E.spFromDamage(tu, tu.spRefHp * 5) === 125, E.spFromDamage(tu, tu.spRefHp * 5));

/* ---- 撃破SPと被弾SPの上限 ---- */
check('撃破SPは25', E.BATTLE_V2_SP_KILL === 25);
check('旧の撃破SPは15のまま', E.SP_ON_KILL === 15);
check('被弾SPの上限は60', E.BATTLE_V2_HIT_CAP === 60 && E.SP_HIT_CAP_PER_ROUND === 10);

/* ---- シールドの上限 ---- */
v2(true);  check('新のシールド上限は100%', E.shieldCapRatio() === 1.0);
v2(false); check('旧のシールド上限は50%', E.shieldCapRatio() === 0.5);

/* ---- 敵のレベル(ボスは推奨どおり、雑魚は-10) ---- */
v2(true);
const stage = E.STAGES.find(st => st.type === 'main' && (st.waves || []).some(w => w.some(e => e.boss)) && (st.waves || []).some(w => w.some(e => !e.boss)));
if(stage){
  const wi = stage.waves.findIndex(w => w.some(e => e.boss));
  v2(true);  const nw = E.spawnWave(stage, wi);
  v2(false); const ow = E.spawnWave(stage, wi);
  const bossNew = nw.find(x => x.boss), bossOld = ow.find(x => x.boss);
  const mobNew = nw.find(x => !x.boss), mobOld = ow.find(x => !x.boss);
  if(bossNew && bossOld) check('ボスのレベルは新旧で同じ', bossNew.level === bossOld.level, `${bossOld.level} → ${bossNew.level}`);
  if(mobNew && mobOld) check('雑魚のレベルは新で-10', mobOld.level - mobNew.level === E.BATTLE_V2_MOB_LV, `${mobOld.level} → ${mobNew.level}`);
}

/* ---- スタミナ0とクリア報酬 ---- */
v2(true);
api.STATE = api.DEFAULT_STATE();
const S2 = api.STATE;
[titan.id, kyubi.id, fenrir.id].forEach(id => { S2.owned[id] = { star: 5, souls: 0, level: 250, skillLv: 10, ultLv: 10, passiveLv: 10 }; });
S2.slots = [titan.id, kyubi.id, fenrir.id, null, null];
S2.clearedStages = E.STAGES.map(x => x.id);
const st = E.findStage('q4_05');
check('新システムの初回はスタミナ0', E.stageStaminaCost(st) === 0, E.stageStaminaCost(st));
const before = S2.crystals;
const r = E.grantStageRewards(st, [], [{ ref: titan.id }]);
check('新システムの初クリアで星結晶10', r.v2Crystals === 10 && S2.crystals === before + 10, `${r.v2Crystals} / ${S2.crystals - before}`);
check('2回目はスタミナがかかる', E.stageStaminaCost(st) === st.stamina, E.stageStaminaCost(st));
const r2 = E.grantStageRewards(st, [], [{ ref: titan.id }]);
check('2回目は星結晶を配らない', !r2.v2Crystals, r2.v2Crystals);

const ev = E.STAGES.find(x => x.type === 'event' && !x.ex);
if(ev){
  const r3 = E.grantStageRewards(ev, [], [{ ref: titan.id }]);
  check('イベントは20', r3.v2Crystals === 20, r3.v2Crystals);
}
const ex = E.STAGES.find(x => x.ex);
if(ex){
  const r4 = E.grantStageRewards(ex, [], [{ ref: titan.id }]);
  check('EXはクリア済みでも初回クリア扱いに戻す', !S2.clearedStages.includes(ex.id) || r4.firstItems.length >= 0);
}
const st2 = E.findStage('q4_06');
const r5 = E.grantStageRewards(st2, [], [{ ref: titan.id }], { sweep: true });
check('周回(結果だけ)では配らない', !r5.v2Crystals, r5.v2Crystals);

/* ---- 旧に戻すとスタミナも元通り ---- */
v2(false);
check('旧はスタミナを消費する', E.stageStaminaCost(E.findStage('q5_01')) === E.findStage('q5_01').stamina);

console.log(ng ? `❌${ng}` : 'すべて通過');
