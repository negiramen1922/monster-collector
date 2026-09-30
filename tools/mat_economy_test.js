/* ワザ強化素材の物価の検証。
   狙い: 「極上級までは素材で詰まらない。神話級に挑むときだけ TierIV がブレーキになる」

   - ステージが落とすのは TierI・TierII だけ(TierIII・TierIV はドロップ表から消えている)
   - ボスは +[2,1]、ハードは +[4,1]、ハードのボスは +[6,2](量だけ増える)
   - TierIV は上級以上のボスだけが確率で落とし、1日2個まで(上限後も TierI・II は落ちる)
   - TierIII 以上は拠点の「錬金術」(下位5個 → 上位1個)が本線
   - 1体を完凸(4系統すべて Lv12)するのに必要な周回数が、合意した 100周前後に収まる

   使い方: python3 tools/extract.py してから  cd tools && node mat_economy_test.js */
const load = require('./harness.js');
const api = load('game.js', s => s + `;global.__e={
  QUEST_TIERS, STAGES, STAGE_BY_ID, MAT_FAMILIES, MAT_TIER_ROUTE, MAT_TIER_FROM, MAT_TIER_QUEST,
  BOSS_DROP_ADD, HARD_DROP_ADD, bumpDropTiers, hardDropTiers,
  MAT_T4_DAILY_CAP, stageMatT4Chance, matT4Today, matT4Left,
  CRAFT_RATIO, CRAFT_RATIO_AHEAD, craftRatio, matTierUnlocked, parseMat, matKey, getItem,
  SKILL_MAT_COST, skillCostList, STAMINA_MAX, STAMINA_REGEN_MS, dropIconsHtml, itemSources, grantStageRewards, ensureDaily, tierOf,
  get STATE(){ return STATE }, set STATE(v){ STATE = v }, DEFAULT_STATE,
};`);
const E = global.__e;
let ng = 0;
const ok = (name, cond, info) => { console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : '')); if(!cond) ng++; };
api.STATE = E.DEFAULT_STATE();
const STAM_PER_DAY = Math.floor(24 * 60 * 60 * 1000 / E.STAMINA_REGEN_MS);  // 288
const tier = k => E.QUEST_TIERS.find(t => t.key === k);
const st = id => E.STAGE_BY_ID[id];

/* ---- 1. ドロップ表 ---- */
console.log('--- 1. ドロップ表は TierI・TierII だけ ---');
const dropStages = E.STAGES.filter(s => s.drops);
ok('どのステージも TierIII を落とさない', dropStages.every(s => !(s.drops.tiers[2] > 0)),
   dropStages.filter(s => s.drops.tiers[2] > 0).map(s => s.id));
ok('どのステージも TierIV を「確定」では落とさない', dropStages.every(s => !(s.drops.tiers[3] > 0)),
   dropStages.filter(s => s.drops.tiers[3] > 0).map(s => s.id));
const want = { q1: [4, 0], q2: [5, 1], q3: [6, 1], q4: [8, 2], q5: [10, 2], q6: [12, 3], q7: [15, 3] };
Object.entries(want).forEach(([k, v]) =>
  ok(`${tier(k).label}の素のドロップは [${v}]`, JSON.stringify(tier(k).drops) === JSON.stringify(v), tier(k).drops));
ok('初級だけは TierII が落ちない(TierIIは中級から)', tier('q1').drops[1] === 0);

/* ---- 2. ボス・ハードの増えかた ---- */
console.log('\n--- 2. ボス +[2,1] / ハード +[4,1] / ハードボス +[6,2] ---');
const base = t => tier(t).drops;
Object.keys(want).forEach(k => {
  const list = E.STAGES.filter(s => s.tier === k);
  const boss = list.find(s => s.boss), mob = list.find(s => !s.boss);
  const hb = E.STAGE_BY_ID[boss.id + 'h'], hm = E.STAGE_BY_ID[mob.id + 'h'];
  const exp = (add) => base(k).map((n, i) => n > 0 ? n + add[i] : 0);
  ok(`  ${tier(k).label} 雑魚 = 素のまま`, JSON.stringify(mob.drops.tiers) === JSON.stringify(base(k)), mob.drops.tiers);
  ok(`  ${tier(k).label} ボス = +[2,1]`, JSON.stringify(boss.drops.tiers) === JSON.stringify(exp([2, 1])), boss.drops.tiers);
  ok(`  ${tier(k).label} ハード = +[4,1]`, JSON.stringify(hm.drops.tiers) === JSON.stringify(exp([4, 1])), hm.drops.tiers);
  ok(`  ${tier(k).label} ハードボス = +[6,2]`, JSON.stringify(hb.drops.tiers) === JSON.stringify(exp([6, 2])), hb.drops.tiers);
});

/* ---- 3. TierIV の確率ドロップ ---- */
console.log('\n--- 3. TierIV はボスだけの確率ドロップ ---');
const wantT4 = { q1: 0, q2: 0, q3: 0.03, q4: 0.05, q5: 0.07, q6: 0.10, q7: 0.12 };
Object.entries(wantT4).forEach(([k, rate]) => {
  const list = E.STAGES.filter(s => s.tier === k);
  const boss = list.find(s => s.boss), mob = list.find(s => !s.boss);
  ok(`  ${tier(k).label} ボスの TierIV 確率は ${Math.round(rate * 100)}%`, E.stageMatT4Chance(boss) === rate, E.stageMatT4Chance(boss));
  ok(`  ${tier(k).label} 雑魚からは TierIV が出ない`, E.stageMatT4Chance(mob) === 0, E.stageMatT4Chance(mob));
  ok(`  ${tier(k).label} ハードボスも同率`, E.stageMatT4Chance(E.STAGE_BY_ID[boss.id + 'h']) === rate, E.stageMatT4Chance(E.STAGE_BY_ID[boss.id + 'h']));
});
ok('上級より下のボスは TierIV を落とさない', E.STAGES.filter(s => s.boss && ['q1', 'q2', 'q1h', 'q2h'].includes(s.tier)).every(s => E.stageMatT4Chance(s) === 0));

/* ---- 4. 1日2個の上限 ---- */
console.log('\n--- 4. TierIV は1日2個まで(周回は止めない) ---');
ok(`上限は${E.MAT_T4_DAILY_CAP}個`, E.MAT_T4_DAILY_CAP === 2, E.MAT_T4_DAILY_CAP);
function farm(stageId, runs){
  api.STATE = E.DEFAULT_STATE();
  const S = api.STATE;
  S.clearedStages = E.STAGES.map(s => s.id);
  const stage = st(stageId);
  const got = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const spawned = stage.waves.flat().map(e => ({ ref: e.ref }));
  for(let i = 0; i < runs; i++){
    S.items = {};
    E.grantStageRewards(stage, spawned, [], {});
    Object.entries(S.items).forEach(([key, n]) => { const m = E.parseMat(key); if(m) got[m.tier] += n; });
  }
  return got;
}
const HB = 'q7_10h';
const hb = farm(HB, 300);
ok('300周まわしても TierIV は2個まで', hb[4] === E.MAT_T4_DAILY_CAP, hb[4]);
ok('上限に当たっても TierI は落ち続ける', hb[1] === 21 * 300, hb[1]);
ok('上限に当たっても TierII は落ち続ける', hb[2] === 5 * 300, hb[2]);
ok('TierIII は1個も落ちない', hb[3] === 0, hb[3]);
ok('日付が変わると上限も戻る', (() => {
  api.STATE.daily.key = 'other-day';
  return E.matT4Left() === E.MAT_T4_DAILY_CAP;
})(), E.matT4Left());

/* ---- 4b. 画面に出る文 ---- */
console.log('\n--- 4b. ステージとアイテム欄の案内 ---');
api.STATE = E.DEFAULT_STATE();
api.STATE.clearedStages = E.STAGES.map(s => s.id);
const hbHtml = E.dropIconsHtml(st('q7_10h'));
ok('ボスのステージに TierIV の確率と残りが出る', /TierIV 12%\(本日あと2個\)/.test(hbHtml), (hbHtml.match(/TierIV[^<]*/) || [])[0]);
ok('ボスのステージに TierI×21・TierII×5 が出る', hbHtml.includes('TierI×21・TierII×5'));
ok('雑魚のステージには TierIV の行が出ない', !E.dropIconsHtml(st('q7_01')).includes('TierIV'));
// TierIVを取り切ったあとは「本日あと0個」になる
E.ensureDaily().counts.mat4 = 2;
ok('上限に当たると「本日あと0個」になる', /本日あと0個/.test(E.dropIconsHtml(st('q7_10h'))));
api.STATE.daily.counts.mat4 = 0;
const srcT3 = E.itemSources('el_fire_3').map(x => x.label + '|' + x.tag);
ok('TierIII の入手手段にステージが出ない(合成とBOXだけ)', !srcT3.some(l => /ドロップ×/.test(l)), srcT3);
ok('TierIII の入手手段に錬金術が出る', srcT3.some(l => l.includes('錬金術')), srcT3);
const srcT4 = E.itemSources('el_fire_4').map(x => x.label + '|' + x.tag);
ok('TierIV の入手手段にボスの確率が出る', srcT4.some(l => /ボス\)\|\d+%/.test(l)), srcT4);
ok('TierIV の入手手段にも錬金術が出る', srcT4.some(l => l.includes('錬金術')), srcT4);

/* ---- 5. 錬金術の解放ラダー ---- */
console.log('\n--- 5. 錬金術の「正規の効率」は進みぐあいで解放 ---');
api.STATE = E.DEFAULT_STATE();
const ladder = [[[], 1], [['q2'], 2], [['q2', 'q3'], 3], [['q2', 'q3', 'q4'], 4]];
ladder.forEach(([keys, top]) => {
  api.STATE.clearedStages = E.STAGES.filter(s => keys.includes(s.tier)).map(s => s.id);
  ok(`  ${keys.length ? keys.map(k => tier(k).label).join('・') + 'クリアで' : '未クリアなら'} Tier${top} まで`, E.matTierUnlocked() === top, E.matTierUnlocked());
});
api.STATE.clearedStages = E.STAGES.filter(s => s.tier === 'q2').map(s => s.id);
ok('先回りは効率が悪い(TierIII は15個→1個)', E.craftRatio(3, 'el') === E.CRAFT_RATIO_AHEAD, E.craftRatio(3, 'el'));
api.STATE.clearedStages = E.STAGES.filter(s => ['q2', 'q3'].includes(s.tier)).map(s => s.id);
ok('上級クリア後は TierIII が5個→1個', E.craftRatio(3, 'el') === E.CRAFT_RATIO, E.craftRatio(3, 'el'));
ok('解放したTierの案内文がある', [1, 2, 3, 4].every(t => typeof E.MAT_TIER_ROUTE[t] === 'string' && E.MAT_TIER_ROUTE[t]));

/* ---- 6. 完凸までの周回数 ---- */
console.log('\n--- 6. 1体を完凸(4系統 Lv12)するのに何周か ---');
// 1体ぶんの必要素材。1系統につき2種類の素材を食うので、Tierごとの合計は ×2 ×4系統
const needTier = [0, 0, 0, 0];
for(let lv = 1; lv <= 11; lv++) (E.SKILL_MAT_COST[lv] || []).forEach((n, i) => { needTier[i] += n * 2 * 4; });
const R = E.CRAFT_RATIO;
const asT1 = arr => arr.reduce((a, n, i) => a + n * Math.pow(R, i), 0);
const need = asT1(needTier);
const T4_AS_T1 = Math.pow(R, 3);
const RUNS_PER_DAY = Math.floor(STAM_PER_DAY / 10);   // メインは1周10スタミナ
console.log(`   必要素材 TierI ${needTier[0]} / II ${needTier[1]} / III ${needTier[2]} / IV ${needTier[3]}  = TierI換算 ${need}個`);
console.log(`   スタミナの自然回復は1日${STAM_PER_DAY} → メインなら1日${RUNS_PER_DAY}周`);
/* 1周ぶんの値段。ドロップ(TierI・II)に、その日ぶんの TierIV(上限2個)を周回数で割って足す。
   TierIV は1日2個で止まるので、たくさん回るほど1周の値段は下がる。 */
function perRun(id){
  const s = st(id);
  const drop = asT1(s.drops.tiers);
  const t4 = E.stageMatT4Chance(s) > 0 ? E.MAT_T4_DAILY_CAP * T4_AS_T1 / RUNS_PER_DAY : 0;
  return { drop, t4, all: drop + t4 };
}
[['q5_10h', '極上級ハードボス'], ['q6_10h', '伝説級ハードボス'], ['q7_10h', '神話級ハードボス']].forEach(([id, ja]) => {
  const p = perRun(id);
  console.log(`   ${ja}  1周 TierI換算${p.all.toFixed(1)}個(ドロップ${p.drop} + TierIV枠${p.t4.toFixed(1)})`
    + ` → 完凸まで ${Math.ceil(need / p.all)}周 / ${(need / p.all / RUNS_PER_DAY).toFixed(1)}日`);
});
const mythic = Math.ceil(need / perRun('q7_10h').all);
ok('神話級ハードボスの完凸は95〜125周(合意した「100周相当」)', mythic >= 95 && mythic <= 125, mythic);
ok('完凸に3.5〜5.5日かかる(1日では終わらない)',
   need / perRun('q7_10h').all / RUNS_PER_DAY >= 3.5 && need / perRun('q7_10h').all / RUNS_PER_DAY <= 5.5,
   +(need / perRun('q7_10h').all / RUNS_PER_DAY).toFixed(1));

/* TierIV を使わないところ(スキルLv10まで = ★5でも届く範囲)は詰まらない */
const needNoT4 = [0, 0, 0, 0];
for(let lv = 1; lv <= 9; lv++) (E.SKILL_MAT_COST[lv] || []).forEach((n, i) => { needNoT4[i] += n * 2 * 4; });
ok('スキルLv10まで(TierIV不要)は TierIV が1個もいらない', needNoT4[3] === 0, needNoT4);
const upTo10 = Math.ceil(asT1(needNoT4) / perRun('q5_10h').drop);
console.log(`   極上級ハードボスなら スキルLv10まで ${upTo10}周 / ${(upTo10 / RUNS_PER_DAY).toFixed(1)}日(TierIVを1個も使わない)`);
ok('極上級ハードボスで「Lv10まで」が4日以内(素材で詰まらない)', upTo10 / RUNS_PER_DAY <= 4, +(upTo10 / RUNS_PER_DAY).toFixed(1));
ok('TierIV が要るのは スキルLv10→11 と Lv11→12 だけ',
   Object.entries(E.SKILL_MAT_COST).every(([lv, c]) => (c[3] > 0) === (Number(lv) >= 10)),
   Object.entries(E.SKILL_MAT_COST).filter(([, c]) => c[3] > 0).map(([lv]) => lv));

console.log(ng ? `\n${ng}件 NG` : '\ndone');
if(ng) process.exitCode = 1;
