/* 育成クエストの入口の回帰テスト。2つ落ちていた:
   1. 霊素の鉱脈(dg_relic_*)が findStage の正規表現に入っておらず、挑戦できなかった
   2. 必要スタミナの表示に id のないダミーを渡していたので、「新バトルシステムの初回は無料」が
      常に成立して ⚡0 のまま表示されていた(実際には消費される)
   使い方: cd tools && node dungeon_entry_test.js */
const load = require('./harness.js');
const api = load('game.js', s => s + `;global.__e={
  findStage, startBattle, stageStaminaCost, dungeonStage, dungeonUnlockIds, DUNGEONS,
  DUNGEON_STAMINA, STAGE_BY_ID, get battleUI(){ return battleUI; },
  get STATE(){ return STATE }, set STATE(v){ STATE = v }, DEFAULT_STATE,
};`);
const E = global.__e;
let ng = 0;
const ok = (name, cond, info) => { console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : '')); if(!cond) ng++; };

api.STATE = E.DEFAULT_STATE();
const S = api.STATE;
S.clearedStages = ['tu1', 'tu2', 'tu3', 'q1_10', 'q2_05', 'q3_05', 'q3_10', 'q4_10', 'q5_10', 'q6_10'];
S.owned['m06'] = { star: 3, souls: 0, level: 50, skillLv: 3, ultLv: 3, passiveLv: 3 };
S.slots = ['m06', null, null, null, null];
S.stamina = 300;

const kinds = Object.keys(E.DUNGEONS);
ok('育成クエストは4種類(EXP・ゴールド・霊素・ルーン)', kinds.length === 4, kinds);

kinds.forEach(k => {
  const st = E.findStage(`dg_${k}_0`);
  ok(`findStage が dg_${k}_0 を返す`, !!st && st.dungeon === k, st ? st.name : null);
});
ok('段が存在しないidにはnullを返す', E.findStage('dg_exp_9') === null, E.findStage('dg_exp_9'));
ok('育成クエスト以外のidは今までどおり', !!E.findStage('q1_01') && !!E.findStage('ab_1'));

// 実際に戦闘に入れるか(霊素が入れなかったのが本題)
kinds.forEach(k => {
  api.resetQueue();
  E.startBattle(`dg_${k}_0`, { skipIntro: true });
  api.drainQueue();
  ok(`dg_${k}_0 の戦闘が始まる`, E.battleUI && E.battleUI.stage && E.battleUI.stage.id === `dg_${k}_0`,
     E.battleUI && E.battleUI.stage ? E.battleUI.stage.id : null);
});

// 必要スタミナの表示: 初回から通常どおり(新バトルシステムのお試しは α0.5 でなくなった)
api.STATE = E.DEFAULT_STATE();
const S2 = api.STATE;
S2.clearedStages = [...S.clearedStages];
kinds.forEach(k => {
  const st = E.dungeonStage(k, 0);
  ok(`dg_${k}_0 は初回から⚡${st.stamina}`, E.stageStaminaCost(st) === st.stamina, [E.stageStaminaCost(st), st.stamina]);
});

// 霊素の鉱脈の報酬が表示に乗るか(以前は空欄だった)
const r = E.DUNGEONS.relic.rewards[0];
ok('霊素の鉱脈の報酬に霊素鉱が入っている', !!r.relic_scrap, r);

console.log(ng ? `❌${ng}` : 'すべて通過');
