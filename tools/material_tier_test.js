/* 育成素材のTierの出方: 難易度ごとの上限Tier・ボス/ハードも上限を超えない・帯ごとに全素材が手に入る・錬金術の先回りは15個→1個 */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e = { DEFAULT_STATE, STAGES, MAT_FAMILIES, matTierUnlocked, craftRatio, CRAFT_RATIO, CRAFT_RATIO_AHEAD, bestStageForMat };`);
const E = global.__e;
let fails = 0;
const ok = (n, c, i) => { if(!c) fails++; console.log((c ? '✅' : '❌') + ' ' + n + (i !== undefined ? '  ' + JSON.stringify(i) : '')); };
const CAP = { q1: 1, q2: 2, q3: 2, q4: 3, q5: 3, q6: 4, q7: 4 };
const MIN = { q6: 2, q7: 2 };
Object.entries(CAP).forEach(([t, cap]) => {
  [t, t + 'h'].forEach(tk => {
    const list = E.STAGES.filter(s => s.tier === tk && s.drops);
    const top = Math.max(...list.flatMap(s => s.drops.tiers.map((n, i) => n > 0 ? i + 1 : 0)));
    const low = Math.min(...list.flatMap(s => s.drops.tiers.map((n, i) => n > 0 ? i + 1 : 9)));
    ok(`${tk}: いちばん上はTier${cap}(ボス・ハードも超えない)`, top === cap && low === (MIN[t] || 1), [low, top]);
  });
});
const bands = [['q1'], ['q2', 'q3'], ['q4', 'q5'], ['q6', 'q7']];
bands.forEach(b => {
  const list = E.STAGES.filter(s => s.drops && b.includes(s.tier));
  const miss = ['el', 'sp', 'ro'].flatMap(f => E.MAT_FAMILIES[f].kinds().filter(k => !list.some(s => s.drops.kinds.some(([ff, kk]) => ff === f && kk === k))).map(k => f + ':' + k));
  ok(`${b.join('・')}: すべての素材がどこかで手に入る`, miss.length === 0, miss);
});
ok('どのステージも素材は属性・種族・ロールの3種に固定', E.STAGES.filter(s => s.drops).every(s => s.drops.kinds.length === 3 && ['el', 'sp', 'ro'].every(f => s.drops.kinds.some(([ff]) => ff === f))));
api.STATE = E.DEFAULT_STATE();
api.STATE.clearedStages = ['tu1', 'tu2', 'tu3', 'q1_01'];
ok('初級だけならTierIまで', E.matTierUnlocked() === 1);
ok('錬金術: 先回り(TierII)は15個→1個', E.craftRatio(2) === E.CRAFT_RATIO_AHEAD && E.CRAFT_RATIO_AHEAD === 15);
api.STATE.clearedStages.push('q2_01');
ok('中級をクリアするとTierIIまで・5個→1個', E.matTierUnlocked() === 2 && E.craftRatio(2) === E.CRAFT_RATIO && E.craftRatio(3) === 15);
api.STATE.clearedStages = E.STAGES.filter(s => ['tu', 'q1', 'q2', 'q3'].includes(s.tier)).map(s => s.id);
const st = E.bestStageForMat({ fam: 'ro', kind: 'trickster', tier: 2 });
ok('素材が落ちるステージを案内できる(トリックスターの証II)', st && st.drops.kinds.some(([f, k]) => f === 'ro' && k === 'trickster') && st.drops.tiers[1] > 0, st && st.id);
console.log(fails ? `${fails}件失敗` : 'すべて通過');
