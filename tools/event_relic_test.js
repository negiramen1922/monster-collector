/* ad-hoc check for event-quest relic distribution: each event's 7 tiers pay out its
   element's relic on a 1/3/5/6/7 schedule (reaching full 凸4/4 for free) plus enhancement
   material on 2/4, and the ★ count is tracked by the event missions (eventMissions). */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e = {
  STATE_ref: () => STATE, DEFAULT_STATE, EVENTS, STAGE_BY_ID, ACHIEVEMENTS, EVENT_ELEMENT_RELIC,
  grantStageRewards, stageStars, getItem, eventMissions, setAccount: a => { ACCOUNT = a; },
};`);
const E = global.__e;
const ok = (name, cond, info) => console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));

api.STATE = E.DEFAULT_STATE();
const S = api.STATE;

const ev = E.EVENTS.find(e => e.key === 'ev_kyubi');
ok('イベントに属性遺物が設定されている', !!E.EVENT_ELEMENT_RELIC[ev.element], E.EVENT_ELEMENT_RELIC[ev.element]);
const relicId = E.EVENT_ELEMENT_RELIC[ev.element];

// 遺物本体は1・3・6・8・10層、間の層は強化素材(α0.1.021 で7層→10層に広げた)
const RELIC_LAYERS = [1, 3, 6, 8, 10];
for(let n = 1; n <= 10; n++){
  const stage = E.STAGE_BY_ID[`${ev.key}_${n}`];
  const before = { relicDupe: (S.relics[relicId] || {}).dupe || 0, relicOwned: !!S.relics[relicId],
    scrap: E.getItem('relic_scrap'), core1: E.getItem('relic_core_1'), core2: E.getItem('relic_core_2') };
  E.grantStageRewards(stage, []);
  const after = { relicDupe: (S.relics[relicId] || {}).dupe || 0, relicOwned: !!S.relics[relicId],
    scrap: E.getItem('relic_scrap'), core1: E.getItem('relic_core_1'), core2: E.getItem('relic_core_2') };
  if(n === 1){
    ok('1層クリアで遺物本体を入手', after.relicOwned && !before.relicOwned, after);
  }else if(!RELIC_LAYERS.includes(n)){
    ok(`${n}層クリアで強化素材(スクラップ)を入手`, after.scrap > before.scrap, [before.scrap, after.scrap]);
  }else{
    ok(`${n}層クリアで同じ遺物の凸が増える`, after.relicDupe === before.relicDupe + 1, [before.relicDupe, after.relicDupe]);
  }
  // second call (re-clearing) must not grant again - grantStageRewards itself doesn't gate on
  // clearedStages (that's the caller's job in the real battle-finish flow), so simulate that gate:
}
ok('10層クリアで凸4/4(完凸)まで届く', (S.relics[relicId] || {}).dupeUsed === 0 && (S.relics[relicId] || {}).dupe === 4, S.relics[relicId]);

// --- ★の集めぐあいは実績ではなくイベントミッションで数える(α0.1.09〜) ---
ok('イベント★数の実績は残っていない', !E.ACHIEVEMENTS.some(x => x.id === `a_event_stars_${ev.key}`));
S.stageStars = {};
const starsOf = () => E.eventMissions(ev).find(x => x.id === 'stars30');
ok('★のミッションが登録されている', !!starsOf());
ok('未クリアなら★0', starsOf().value === 0, starsOf().value);
[1, 2, 3].forEach(n => { S.stageStars[`${ev.key}_${n}`] = 3; }); // 3層 x ★3 = 9
ok('★の合計が正しく計算される(3層 x ★3 = 9)', starsOf().value === 9, starsOf().value);
const maxStars = ev.tiers.length * 3;
const starGoals = E.eventMissions(ev).filter(x => x.kind === 'star').map(x => x.goal);
ok('最後の段の目標は最大★数と一致', starGoals[starGoals.length - 1] === maxStars, [starGoals, maxStars]);
ok('段はgoalの昇順', starGoals.every((g, i) => i === 0 || g > starGoals[i - 1]), starGoals);

// --- 8〜10層(深層) ---
ok('イベントは10層ある', ev.tiers.length === 10, ev.tiers.length);
ok('8〜10層の推奨Lvは300/350/400', JSON.stringify(ev.tiers.slice(7).map(t => t.lv)) === '[300,350,400]',
  ev.tiers.slice(7).map(t => t.lv));
ok('推奨Lvは層が進むほど上がる', ev.tiers.every((t, i) => i === 0 || t.lv > ev.tiers[i - 1].lv),
  ev.tiers.map(t => t.lv));
ok('8〜10層のボス★は5→6→7と上がる', JSON.stringify(ev.tiers.slice(7).map(t => t.bossStar)) === '[5,6,7]',
  ev.tiers.slice(7).map(t => t.bossStar));
ok('仲間になる確率は層が進むほど上がる', ev.tiers.every((t, i) => i === 0 || t.rate > ev.tiers[i - 1].rate),
  ev.tiers.map(t => t.rate));
[8, 9, 10].forEach(n => {
  const st = E.STAGE_BY_ID[`${ev.key}_${n}`];
  ok(`${n}層が存在する`, !!st);
  ok(`${n}層の最終ウェーブはボス+護衛`, st.waves[st.waves.length - 1].some(e => e.boss), st.waves.length);
});
ok('7層では完凸しない(8・10層に残りの凸がある)', ['8', '10'].every(n => (E.STAGE_BY_ID[`${ev.key}_${n}`].bossReward || []).some(r => r.type === 'relic')));
ok('9層は強化素材(スクラップ・コアTierIII)を配る', (E.STAGE_BY_ID[`${ev.key}_9`].bossReward || []).some(r => r.key === 'relic_core_3'));
// α0.5: スキルLvの上限が10になったので、敵も10で止まる
ok('敵のスキルLvは8層から10(上限)',
  JSON.stringify([8, 9, 10].map(n => E.STAGE_BY_ID[`${ev.key}_${n}`].enemySkill)) === '[10,10,10]',
  [8, 9, 10].map(n => E.STAGE_BY_ID[`${ev.key}_${n}`].enemySkill));
ok('7層までの敵スキルLvは従来どおり(3〜9)',
  JSON.stringify([1, 7].map(n => E.STAGE_BY_ID[`${ev.key}_${n}`].enemySkill)) === '[3,9]',
  [1, 7].map(n => E.STAGE_BY_ID[`${ev.key}_${n}`].enemySkill));

console.log('done');
