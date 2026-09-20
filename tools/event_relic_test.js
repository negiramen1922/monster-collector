/* ad-hoc check for event-quest relic distribution: each event's 7 tiers pay out its
   element's relic on a 1/3/5/6/7 schedule (reaching full 凸4/4 for free) plus enhancement
   material on 2/4, and a star-count achievement pays crystals across the whole event. */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e = {
  STATE_ref: () => STATE, DEFAULT_STATE, EVENTS, STAGE_BY_ID, ACHIEVEMENTS, EVENT_ELEMENT_RELIC,
  grantStageRewards, stageStars, getItem, setAccount: a => { ACCOUNT = a; },
};`);
const E = global.__e;
const ok = (name, cond, info) => console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));

api.STATE = E.DEFAULT_STATE();
const S = api.STATE;

const ev = E.EVENTS.find(e => e.key === 'ev_kyubi');
ok('イベントに属性遺物が設定されている', !!E.EVENT_ELEMENT_RELIC[ev.element], E.EVENT_ELEMENT_RELIC[ev.element]);
const relicId = E.EVENT_ELEMENT_RELIC[ev.element];

for(let n = 1; n <= 7; n++){
  const stage = E.STAGE_BY_ID[`${ev.key}_${n}`];
  const before = { relicDupe: (S.relics[relicId] || {}).dupe || 0, relicOwned: !!S.relics[relicId],
    scrap: E.getItem('relic_scrap'), core1: E.getItem('relic_core_1'), core2: E.getItem('relic_core_2') };
  E.grantStageRewards(stage, []);
  const after = { relicDupe: (S.relics[relicId] || {}).dupe || 0, relicOwned: !!S.relics[relicId],
    scrap: E.getItem('relic_scrap'), core1: E.getItem('relic_core_1'), core2: E.getItem('relic_core_2') };
  if(n === 1){
    ok('1層クリアで遺物本体を入手', after.relicOwned && !before.relicOwned, after);
  }else if(n === 2 || n === 4){
    ok(`${n}層クリアで強化素材(スクラップ)を入手`, after.scrap > before.scrap, [before.scrap, after.scrap]);
  }else{
    ok(`${n}層クリアで同じ遺物の凸が増える`, after.relicDupe === before.relicDupe + 1, [before.relicDupe, after.relicDupe]);
  }
  // second call (re-clearing) must not grant again - grantStageRewards itself doesn't gate on
  // clearedStages (that's the caller's job in the real battle-finish flow), so simulate that gate:
}
ok('7層クリアで凸4/4(完凸)まで届く', (S.relics[relicId] || {}).dupeUsed === 0 && (S.relics[relicId] || {}).dupe === 4, S.relics[relicId]);

// --- star-count achievement: value() sums stageStars across all 7 of this event's stages ---
const a = E.ACHIEVEMENTS.find(x => x.id === `a_event_stars_${ev.key}`);
ok('イベント★数実績が登録されている', !!a);
ok('未クリアなら★0', a.value() === 0, a.value());
S.stageStars = {};
[1, 2, 3].forEach(n => { S.stageStars[`${ev.key}_${n}`] = 3; }); // 3層 x ★3 = 9
ok('★の合計が正しく計算される(3層 x ★3 = 9)', a.value() === 9, a.value());
const maxStars = ev.tiers.length * 3;
ok('最終ティアの目標は最大★数と一致', a.tiers[a.tiers.length - 1].goal === maxStars, [a.tiers[a.tiers.length - 1].goal, maxStars]);
ok('ティアはgoalの昇順', a.tiers.every((t, i) => i === 0 || t.goal > a.tiers[i - 1].goal), a.tiers.map(t => t.goal));

console.log('done');
