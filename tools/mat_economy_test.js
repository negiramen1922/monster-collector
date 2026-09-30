/* ワザ強化素材の物価の検証。
   狙い: 「極上級までは素材で詰まらない。神話級に挑むときだけ TierIV がブレーキになる」

   - ドロップは「期待値」で持ち、実際の個数は毎回抽選する(枠 = 期待値×2、1枠 = 期待値÷枠数)。
     期待値が1を割るとそのまま「N%で1個」になるので、TierI〜TierIV が1本のルールで書ける
   - ボスは全Tierの期待値が1.6倍、ハードは1.5倍(ハードのボスは2.4倍)
   - TierIV だけは1日2個までしか取れない(周回そのものは止めない)
   - TierIII 以上は拠点の「錬金術」(下位5個 → 上位1個)でも作れる
   - 1体を完凸(4系統すべて Lv12)するのに必要な周回数が、合意した 100〜120周に収まる
   - ワザ素材BOXはメインステージから出ない(ショップとミッションのもの)

   使い方: python3 tools/extract.py してから  cd tools && node mat_economy_test.js */
const load = require('./harness.js');
const api = load('game.js', s => s + `;global.__e={
  QUEST_TIERS, STAGES, STAGE_BY_ID, MAT_FAMILIES, MAT_TIER_ROUTE, MAT_TIER_FROM,
  DROP_MUL_BOSS, DROP_MUL_HARD, dropMul, scaleDropTiers, rollDropCount, dropKindRange,
  MAT_T4_DAILY_CAP, stageMatT4Rate, matT4Today, matT4Left,
  CRAFT_RATIO, CRAFT_RATIO_AHEAD, craftRatio, matTierUnlocked, parseMat, matKey, getItem,
  SKILL_MAT_COST, grantStageRewards, ensureDaily, tierOf, dropIconsHtml, itemSources,
  craftMat, craftMax, ALCHEMY_FAMILIES, EVENTS, eventSkillMats, SHOP_GOLD_ITEMS, abyssFloorReward, addItem, addGold,
  eventShopItems, matT1Value, eventMatPrice, eventBoxPrice, EVENT_MAT_PER_MEDAL, EVENT_BOX_PREMIUM, BOX_CONTENT, medalRunGain,
  STAMINA_MAX, STAMINA_REGEN_MS,
  get STATE(){ return STATE }, set STATE(v){ STATE = v }, DEFAULT_STATE,
};`);
const E = global.__e;
let ng = 0;
const ok = (name, cond, info) => { console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : '')); if(!cond) ng++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const STAM_PER_DAY = Math.floor(24 * 60 * 60 * 1000 / E.STAMINA_REGEN_MS);   // 288
api.STATE = E.DEFAULT_STATE();
const tier = k => E.QUEST_TIERS.find(t => t.key === k);
const st = id => E.STAGE_BY_ID[id];

/* ---- 1. 抽選の仕組み ---- */
console.log('--- 1. 期待値ぶんだけ落ち、個数はブレる ---');
[[7, 0.25], [16.8, 0.4], [1.7, 0.1], [0.12, 0.02], [0.18, 0.02]].forEach(([e, tol]) => {
  const N = 40000;
  let sum = 0, min = 99, max = -1;
  for(let i = 0; i < N; i++){ const n = E.rollDropCount(e); sum += n; min = Math.min(min, n); max = Math.max(max, n); }
  const avg = sum / N;
  ok(`  期待値${e} → 平均${avg.toFixed(2)}(${min}〜${max})`, near(avg, e, tol), avg.toFixed(3));
  if(e >= 1) ok(`  期待値${e} は毎回同じ個数ではない`, max > min + 1, [min, max]);
});
ok('期待値0なら1個も落ちない', [0, -1, null, undefined].every(v => E.rollDropCount(v) === 0));
ok('期待値が1を割ると「その確率で1個」になる', E.dropKindRange(0.12, 1).n === 1 && near(E.dropKindRange(0.12, 1).q, 0.12, 1e-9));

/* ---- 2. ドロップ表 ---- */
console.log('\n--- 2. 素のドロップ(雑魚ステージの期待値) ---');
const want = { q1: [4, 0, 0, 0], q2: [5, 0.8, 0, 0], q3: [5, 0.9, 0.04, 0.02],
  q4: [5.5, 1.2, 0.06, 0.03], q5: [6, 1.3, 0.08, 0.045], q6: [6.5, 1.55, 0.1, 0.06], q7: [7, 1.7, 0.12, 0.075] };
Object.entries(want).forEach(([k, v]) =>
  ok(`${tier(k).label} = [${v}]`, JSON.stringify(tier(k).drops) === JSON.stringify(v), tier(k).drops));
ok('初級だけは TierII 以上が落ちない', tier('q1').drops.slice(1).every(n => n === 0));
ok('中級は TierIII・TierIV が落ちない', tier('q2').drops.slice(2).every(n => n === 0));
ok('上級から TierIII・TierIV が落ちる', tier('q3').drops.slice(2).every(n => n > 0));
ok('難度が上がるほど期待値が上がる(どのTierも)', [0, 1, 2, 3].every(i => {
  const seq = ['q3', 'q4', 'q5', 'q6', 'q7'].map(k => tier(k).drops[i]);
  return seq.every((n, j) => j === 0 || n > seq[j - 1]);
}));

/* ---- 3. ボス・ハードの倍率 ---- */
console.log('\n--- 3. ボス×1.6 / ハード×1.5 / ハードのボス×2.4 ---');
ok('倍率はボス1.6・ハード1.5', E.DROP_MUL_BOSS === 1.6 && E.DROP_MUL_HARD === 1.5);
ok('ハードのボスは2.4倍(1.6×1.5)', near(E.dropMul({ boss: true, hard: true }), 2.4, 1e-9), E.dropMul({ boss: true, hard: true }));
Object.keys(want).forEach(k => {
  const list = E.STAGES.filter(s => s.tier === k);
  const boss = list.find(s => s.boss), mob = list.find(s => !s.boss);
  const hb = st(boss.id + 'h'), hm = st(mob.id + 'h');
  const exp = m => tier(k).drops.map(e => e > 0 ? e * m : 0);
  const same = (a, b) => a.length === b.length && a.every((n, i) => near(n, b[i], 1e-9));
  ok(`  ${tier(k).label} 雑魚 = 素のまま`, same(mob.drops.tiers, exp(1)), mob.drops.tiers);
  ok(`  ${tier(k).label} ボス = ×1.6`, same(boss.drops.tiers, exp(1.6)), boss.drops.tiers);
  ok(`  ${tier(k).label} ハード = ×1.5`, same(hm.drops.tiers, exp(1.5)), hm.drops.tiers);
  ok(`  ${tier(k).label} ハードボス = ×2.4`, same(hb.drops.tiers, exp(2.4)), hb.drops.tiers);
});
ok('落ちないTierは倍率をかけても0のまま', E.STAGES.filter(s => s.tier === 'q1h').every(s => s.drops.tiers.slice(1).every(n => n === 0)));

/* ---- 4. TierIV の1日2個の上限 ---- */
console.log('\n--- 4. TierIV は1日2個まで(周回は止めない) ---');
ok(`上限は${E.MAT_T4_DAILY_CAP}個`, E.MAT_T4_DAILY_CAP === 5, E.MAT_T4_DAILY_CAP);
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
const RUNS = 400, HB = 'q7_10h';
const hb = farm(HB, RUNS);
const hbT = st(HB).drops.tiers;
ok(`${RUNS}周まわしても TierIV は2個まで`, hb[4] === E.MAT_T4_DAILY_CAP, hb[4]);
ok('上限に当たっても TierI は落ち続ける', near(hb[1] / RUNS, hbT[0], 0.5), (hb[1] / RUNS).toFixed(2));
ok('上限に当たっても TierII は落ち続ける', near(hb[2] / RUNS, hbT[1], 0.4), (hb[2] / RUNS).toFixed(2));
ok('上限に当たっても TierIII は落ち続ける', near(hb[3] / RUNS, hbT[2], 0.1), (hb[3] / RUNS).toFixed(3));
ok('日付が変わると上限も戻る', (() => { api.STATE.daily.key = 'other-day'; return E.matT4Left() === E.MAT_T4_DAILY_CAP; })(), E.matT4Left());

/* ---- 5. 画面に出る文 ---- */
console.log('\n--- 5. ステージとアイテム欄の案内 ---');
api.STATE = E.DEFAULT_STATE();
api.STATE.clearedStages = E.STAGES.map(s => s.id);
const hbHtml = E.dropIconsHtml(st(HB));
const cells = [...hbHtml.matchAll(/class="dc-name">([^<]+)<\/div><div class="dc-n">([^<]+)</g)].map(m => m[1] + ' ' + m[2]);
console.log('   ' + cells.join(' / '));
ok('出るものが 3種 × 落ちるTier ぶん並ぶ', cells.length === 3 * 4, cells.length);
// アイコンのSVGにも % が入るので、タグの外に出ている文字だけを見る
const hbText = hbHtml.replace(/<[^>]*>/g, ' ');
ok('確率は出さない', !/%/.test(hbText), hbText.replace(/\s+/g, ' ').trim());
ok('個数は 3-8 のような幅で出る', cells.filter(c => / 3-8$/.test(c)).length === 3, cells.slice(0, 3));
ok('1個を割るものは 0-1 と出る', cells.filter(c => / 0-1$/.test(c)).length === 6, cells.filter(c => / 0-1$/.test(c)));
ok('TierIVの残りが出る', /TierIVは本日あと5個/.test(hbHtml));
ok('TierIVが落ちないステージには残りを出さない', !E.dropIconsHtml(st('q1_10h')).includes('本日あと'));
[3, 4].forEach(t => {
  const src = E.itemSources(`el_fire_${t}`).map(x => x.label + '|' + x.tag);
  ok(`  Tier${t === 3 ? 'III' : 'IV'} の入手手段にステージと1周の個数が出る`, src.some(l => /ドロップ \d+-\d+個/.test(l)), src.slice(0, 2));
  ok(`  Tier${t === 3 ? 'III' : 'IV'} の入手手段に錬金術が出る`, src.some(l => l.includes('錬金術')), src.slice(0, 5));
});
ok('TierIVの案内に本日の残りが出る', E.itemSources('el_fire_4').some(x => /本日あと/.test(x.tag)));
ok('案内文が全Tierぶんある', [1, 2, 3, 4].every(t => E.MAT_TIER_ROUTE[t] && E.MAT_TIER_FROM[t]));
ok('「TierIIIは上級から」が表から作られている', E.MAT_TIER_FROM[3] === '上級' && E.MAT_TIER_FROM[2] === '中級', E.MAT_TIER_FROM);

/* ---- 6. 錬金術 ---- */
console.log('\n--- 6. 錬金術は落ちるTierまでが5個→1個 ---');
api.STATE = E.DEFAULT_STATE();
[[[], 1], [['q2'], 2], [['q2', 'q3'], 4]].forEach(([keys, top]) => {
  api.STATE.clearedStages = E.STAGES.filter(s => keys.includes(s.tier)).map(s => s.id);
  ok(`  ${keys.length ? keys.map(k => tier(k).label).join('・') + 'クリアで' : '未クリアなら'} Tier${top} まで`, E.matTierUnlocked() === top, E.matTierUnlocked());
});
api.STATE.clearedStages = E.STAGES.filter(s => s.tier === 'q2').map(s => s.id);
ok('先回りは効率が悪い(中級までなら TierIII は15個→1個)', E.craftRatio(3, 'el') === E.CRAFT_RATIO_AHEAD, E.craftRatio(3, 'el'));
api.STATE.clearedStages = E.STAGES.filter(s => ['q2', 'q3'].includes(s.tier)).map(s => s.id);
ok('上級クリア後は TierIII・TierIV が5個→1個', E.craftRatio(3, 'el') === E.CRAFT_RATIO && E.craftRatio(4, 'el') === E.CRAFT_RATIO);

/* ---- 7. ワザ素材BOX ---- */
console.log('\n--- 7. ワザ素材BOXはメインステージから出ない ---');
const mainBoxes = E.STAGES.filter(s => s.type === 'main')
  .flatMap(s => [...(s.bossReward || []), ...(s.reward || [])])
  .filter(r => r.key && /^box_/.test(r.key));
ok('メインステージの報酬にBOXがない', mainBoxes.length === 0, mainBoxes);
ok('どのメインステージのドロップにもBOXがない', E.STAGES.filter(s => s.type === 'main').every(s => !s.drops || s.drops.kinds.every(([f]) => E.MAT_FAMILIES[f])));
const bosses = E.STAGES.filter(s => s.type === 'main' && s.boss && s.tier !== 'tu');
ok('ボスの初回クリアは素材そのものを配る', bosses.every(s => (s.bossReward || []).length === 1 && E.parseMat(s.bossReward[0].key)), bosses.filter(s => !(s.bossReward || [])[0] || !E.parseMat(s.bossReward[0].key)).map(s => s.id));
ok('ボスの報酬はそのステージで落ちる3種のどれか', bosses.every(s => {
  const m = E.parseMat(s.bossReward[0].key);
  return s.drops.kinds.some(([f, k]) => f === m.fam && k === m.kind);
}));
ok('ハードのボスは同じ素材の2倍', bosses.filter(s => !s.tier.endsWith('h')).every(s => {
  const h = st(s.id + 'h');
  return h.bossReward[0].key === s.bossReward[0].key && h.bossReward[0].n === s.bossReward[0].n * 2;
}));

/* 1周ぶんの TierI 換算(8節でも使う)。TierIVは1日の上限で頭打ちになるので周回数で割り戻す */
const RUNS_PER_DAY_ = Math.floor(STAM_PER_DAY / 10);
function perRunAll(id){
  const t = st(id).drops.tiers;
  const drop = t[0] + t[1] * 5 + t[2] * 25;
  return drop + Math.min((t[3] || 0) * RUNS_PER_DAY_, E.MAT_T4_DAILY_CAP) / RUNS_PER_DAY_ * 125;
}

/* ---- 7b. 錬金術は「同じ種類の1つ下のTier」からだけ ---- */
console.log('\n--- 7b. 錬金術はロールをまたげない ---');
api.STATE = E.DEFAULT_STATE();
api.STATE.clearedStages = E.STAGES.map(s => s.id);
api.STATE.gold = 10000000;
E.addItem('ro_attacker_1', 100);
const beforeShooter = E.getItem('ro_shooter_2');
E.craftMat('ro', 'shooter', 2, 1);
ok('アタッカーの証I×5からシューターの証IIは作れない', E.getItem('ro_shooter_2') === beforeShooter && E.getItem('ro_attacker_1') === 100,
   { shooter2: E.getItem('ro_shooter_2'), attacker1: E.getItem('ro_attacker_1') });
E.craftMat('ro', 'attacker', 2, 1);
ok('アタッカーの証I×5 → アタッカーの証II×1 は作れる', E.getItem('ro_attacker_2') === 1 && E.getItem('ro_attacker_1') === 95,
   { attacker2: E.getItem('ro_attacker_2'), attacker1: E.getItem('ro_attacker_1') });
E.addItem('el_fire_1', 100);
const beforeSp = E.getItem('sp_beast_2');
E.craftMat('sp', 'beast', 2, 1);
ok('属性の欠片から種族の魂も作れない', E.getItem('sp_beast_2') === beforeSp && E.getItem('el_fire_1') === 100);
ok('作れるのは「同じ種類の1つ下のTier」だけ(craftMaxが0)', E.craftMax('ro', 'shooter', 2) === 0 && E.craftMax('ro', 'attacker', 2) === Math.floor(95 / E.CRAFT_RATIO),
   [E.craftMax('ro', 'shooter', 2), E.craftMax('ro', 'attacker', 2)]);

/* ---- 7c. イベントステージ ---- */
console.log('\n--- 7c. イベントステージもBOXなし ---');
const evStages = E.STAGES.filter(s => s.type === 'event' && !s.ex);
ok('イベントステージの報酬にBOXがない', evStages.every(s => (s.bossReward || []).every(r => !/^box_/.test(r.key || ''))),
   evStages.flatMap(s => (s.bossReward || []).filter(r => /^box_/.test(r.key || '')).map(r => s.id + ':' + r.key)));
E.EVENTS.forEach(ev => {
  const mats = Object.values(E.eventSkillMats(ev)).map(([f, k]) => f + '_' + k);
  const s10 = E.STAGE_BY_ID[`${ev.key}_10`];
  const got = (s10.bossReward || []).filter(r => E.parseMat(r.key || '')).map(r => E.parseMat(r.key));
  ok(`  ${ev.key} ステージ10は主役の3種のTierIIIを配る`,
     got.length === 3 && got.every(m => m.tier === 3 && mats.includes(m.fam + '_' + m.kind)), got.map(m => m.fam + '_' + m.kind + '/' + m.tier));
});
ok('深淵回廊にはBOXが残っている', [25, 50].every(f => E.abyssFloorReward(f).some(r => /^box_/.test(r.key || ''))));
ok('ゴールドショップにもBOXが残っている', E.SHOP_GOLD_ITEMS.some(x => /^box_/.test(x.itemKey || '')));

/* ---- 7d. イベントショップの素材の値段 ---- */
console.log('\n--- 7d. イベントショップは TierI換算あたり同じ値段 ---');
const V1 = [1, 5, 25, 125];
const MAT_QTY = { 1: [12, 20], 2: [5, 8], 3: [3, 5], 4: [1, 2] };
function shopMats(ev){
  return E.eventShopItems(ev).filter(x => /^(mat|box)\d$/.test(x.sku) && !x.hide).map(x => {
    const m = /^mat(\d)$/.exec(x.sku), b = /^box(\d)$/.exec(x.sku);
    const tier = Number((m || b)[1]);
    const t1 = m ? (MAT_QTY[tier][0] * 2 + MAT_QTY[tier][1]) * V1[tier - 1] : E.BOX_CONTENT.sel[tier] * V1[tier - 1];
    return { sku: x.sku, tier, price: x.price, limit: x.limit, t1, per: t1 / x.price, box: !!b };
  });
}
ok('TierI換算は合成の倍率から決まる', [1, 2, 3, 4].every(t => E.matT1Value(t) === V1[t - 1]), [1, 2, 3, 4].map(E.matT1Value));
const evNew = { ...E.EVENTS.find(e => e.key === 'ev_fenrir'), econV2: true };
const rowsNew = shopMats(evNew);
rowsNew.forEach(r => console.log(`   ${r.sku.padEnd(5)} ${String(r.price).padStart(4)}メダル  TierI換算${String(r.t1).padStart(4)}  ${r.per.toFixed(2)}/メダル ×${r.limit}`));
const raw = rowsNew.filter(r => !r.box), box = rowsNew.filter(r => r.box);
ok('生の素材はどのTierも同じ単価(±5%)', raw.every(r => Math.abs(r.per - E.EVENT_MAT_PER_MEDAL) / E.EVENT_MAT_PER_MEDAL <= 0.05),
   raw.map(r => r.sku + ':' + r.per.toFixed(2)));
ok('BOXもどのTierも同じ単価', box.every(r => near(r.per, box[0].per, 0.01)), box.map(r => r.sku + ':' + r.per.toFixed(2)));
ok(`BOXは選べるぶん${E.EVENT_BOX_PREMIUM}倍の割高`, near(raw[0].per / box[0].per, E.EVENT_BOX_PREMIUM, 0.06),
   +(raw[0].per / box[0].per).toFixed(2));
ok('TierIVのBOXが買える(深淵回廊とミッションしか出どころが無かった)', box.some(r => r.tier === 4), box.map(r => r.sku));
// いまのイベントはぜんぶ econV2(開催中のものにも入れた)。econV2 を外すと旧の値段に戻る
ok('いまのイベントはぜんぶ新しい値段', E.EVENTS.every(ev => ev.econV2), E.EVENTS.map(ev => ev.key + ':' + !!ev.econV2));
const rowsOld = shopMats({ ...E.EVENTS.find(e => e.key === 'ev_fenrir'), econV2: false });
ok('econV2 を外すと旧の値段に戻る',
   JSON.stringify(rowsOld.map(r => [r.sku, r.price])) === JSON.stringify([['mat1', 73], ['mat2', 50], ['mat3', 45], ['mat4', 33], ['box1', 40], ['box2', 14], ['box3', 12]]),
   rowsOld.map(r => r.sku + ':' + r.price));
ok('econV2 を外すとTierIVのBOXは出ない', !rowsOld.some(r => r.tier === 4 && r.box));
// メダルは「同じスタミナをメインに使ったとき」と釣り合っているか
const medalPerRun = E.medalRunGain(10) * 2;      // イベントボーナス最大
const evStam = st('ev_fenrir_10').stamina;
const mainT1PerStam = perRunAll('q7_10h') / 10;
console.log(`   1メダル = ${(evStam / medalPerRun).toFixed(2)}スタミナ / メイン1スタミナ = TierI換算${mainT1PerStam.toFixed(1)}`
  + ` → メダル1個ぶんの周回で ${(evStam / medalPerRun * mainT1PerStam).toFixed(2)} 相当`);
ok('イベントで素材を買うのが、メインを回るより極端に得でも損でもない(0.5〜2倍)', (() => {
  const mainEquiv = evStam / medalPerRun * mainT1PerStam;
  const r = E.EVENT_MAT_PER_MEDAL / mainEquiv;
  return r >= 0.5 && r <= 2;
})(), +(E.EVENT_MAT_PER_MEDAL / (evStam / medalPerRun * mainT1PerStam)).toFixed(2));

/* ---- 8. 完凸までの周回数 ---- */
console.log('\n--- 8. 1体を完凸(4系統 Lv12)するのに何周か ---');
const V = [1, 5, 25, 125];   // 合成5個→1個 なので TierI 換算
const asT1 = arr => arr.reduce((a, n, i) => a + n * V[i], 0);
const needTier = [0, 0, 0, 0];
for(let lv = 1; lv <= 11; lv++) (E.SKILL_MAT_COST[lv] || []).forEach((n, i) => { needTier[i] += n * 2 * 4; });
const need = asT1(needTier);
const RUNS_PER_DAY = Math.floor(STAM_PER_DAY / 10);   // メインは1周10スタミナ
console.log(`   必要素材 TierI ${needTier[0]} / II ${needTier[1]} / III ${needTier[2]} / IV ${needTier[3]}  = TierI換算 ${need}個`);
console.log(`   スタミナの自然回復は1日${STAM_PER_DAY} → メインなら1日${RUNS_PER_DAY}周`);
/* 1周ぶんの値段。TierI〜TierIII は期待値そのまま、TierIV は1日2個で止まるので周回数で割り戻す */
function perRun(id){
  const t = st(id).drops.tiers;
  const drop = asT1([t[0], t[1], t[2], 0]);
  const t4 = Math.min((t[3] || 0) * RUNS_PER_DAY, E.MAT_T4_DAILY_CAP) / RUNS_PER_DAY * V[3];
  return { drop, t4, all: drop + t4 };
}
[['q5_10h', '極上級ハードボス'], ['q6_10h', '伝説級ハードボス'], ['q7_10h', '神話級ハードボス']].forEach(([id, ja]) => {
  const p = perRun(id);
  console.log(`   ${ja}  1周 TierI換算${p.all.toFixed(1)}個(ドロップ${p.drop.toFixed(1)} + TierIV枠${p.t4.toFixed(1)})`
    + ` → 完凸まで ${Math.ceil(need / p.all)}周 / ${(need / p.all / RUNS_PER_DAY).toFixed(1)}日`);
});
const mythic = Math.ceil(need / perRun('q7_10h').all);
ok('神話級ハードボスの完凸は85〜105周', mythic >= 85 && mythic <= 105, mythic);
ok('TierIVの上限(1日5個)は神話級ハードボスだけが届く',
   st('q7_10h').drops.tiers[3] * RUNS_PER_DAY > E.MAT_T4_DAILY_CAP
   && st('q6_10h').drops.tiers[3] * RUNS_PER_DAY < E.MAT_T4_DAILY_CAP,
   [+(st('q7_10h').drops.tiers[3] * RUNS_PER_DAY).toFixed(2), +(st('q6_10h').drops.tiers[3] * RUNS_PER_DAY).toFixed(2)]);
ok('TierIIIも周回で集まる(1周のTierI換算のうち10%以上)',
   st('q7_10h').drops.tiers[2] * V[2] / perRun('q7_10h').all >= 0.10,
   +(st('q7_10h').drops.tiers[2] * V[2] / perRun('q7_10h').all).toFixed(3));

/* TierIV を使わないところ(ワザLv10まで)は詰まらない */
const needNoT4 = [0, 0, 0, 0];
for(let lv = 1; lv <= 9; lv++) (E.SKILL_MAT_COST[lv] || []).forEach((n, i) => { needNoT4[i] += n * 2 * 4; });
ok('ワザLv10まで(TierIV不要)は TierIV が1個もいらない', needNoT4[3] === 0, needNoT4);
const upTo10 = Math.ceil(asT1(needNoT4) / perRun('q5_10h').drop);
console.log(`   極上級ハードボスなら ワザLv10まで ${upTo10}周 / ${(upTo10 / RUNS_PER_DAY).toFixed(1)}日(TierIVを1個も使わない)`);
ok('極上級ハードボスで「Lv10まで」が4日以内(素材で詰まらない)', upTo10 / RUNS_PER_DAY <= 4, +(upTo10 / RUNS_PER_DAY).toFixed(1));
ok('TierIV が要るのは ワザLv10→11 と Lv11→12 だけ',
   Object.entries(E.SKILL_MAT_COST).every(([lv, c]) => (c[3] > 0) === (Number(lv) >= 10)),
   Object.entries(E.SKILL_MAT_COST).filter(([, c]) => c[3] > 0).map(([lv]) => lv));

console.log(ng ? `\n${ng}件 NG` : '\ndone');
if(ng) process.exitCode = 1;
