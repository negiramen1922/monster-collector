/* regression test: チュートリアル(tu1-3)は初回クリアまでは無料(スタミナ0)、既に
   クリア済みのチュートリアルステージへの再挑戦は通常ステージと同じスタミナを消費する。
   以前は tier:'tu' のステージが常にstamina:0で、初回クリア後も報酬(ゴールド・素材・
   モンスター加入)だけ無限に無料で回収できてしまっていた不具合の回帰テスト。 */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e = {
  get STATE(){ return STATE }, set STATE(v){ STATE = v }, DEFAULT_STATE, MON_BY_ID,
  stageStaminaCost, findStage, startBattle, get battleUI(){ return battleUI; },
  formationForFrontCount, lineupFromList, isMeleeRole, TUTORIAL_REPLAY_STAMINA,
};`);
const E = global.__e;
const ok = (name, cond, info) => console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));

function setup(){
  api.STATE = E.DEFAULT_STATE();
  const S = api.STATE;
  const party = ['m06', 'm21', 'm03'];
  const fk = E.formationForFrontCount(Math.max(1, party.filter(id => E.isMeleeRole(E.MON_BY_ID[id].role)).length)).key;
  S.formationKey = fk;
  S.slots = E.lineupFromList(party, fk);
  S.stamina = 1000;
  return S;
}

// --- stageStaminaCost: free before the first clear, normal cost after ---
let S = setup();
const tu1 = E.findStage('tu1');
ok('tu1は未クリアなら無料', E.stageStaminaCost(tu1) === 0, E.stageStaminaCost(tu1));
S.clearedStages = ['tu1'];
ok('tu1はクリア済みだと通常コストがかかる', E.stageStaminaCost(tu1) === E.TUTORIAL_REPLAY_STAMINA, E.stageStaminaCost(tu1));

const q1_01 = E.findStage('q1_01');
ok('通常ステージのコストはtutorial判定の影響を受けない', E.stageStaminaCost(q1_01) === 10, E.stageStaminaCost(q1_01));

// --- startBattle: actually spends 0 on a fresh tutorial run, then real stamina on a replay ---
S = setup();
S.stamina = 50;
api.resetQueue();
E.startBattle('tu1', { skipIntro: true });
api.drainQueue();
ok('初回のtu1はスタミナを消費しない', S.stamina === 50, S.stamina);
ok('初回クリアでclearedStagesに入る', S.clearedStages.includes('tu1'), S.clearedStages);

api.resetQueue();
E.startBattle('tu1', { skipIntro: true });
api.drainQueue();
ok('クリア済みtu1への再挑戦はスタミナを消費する', S.stamina === 50 - E.TUTORIAL_REPLAY_STAMINA, S.stamina);

// --- スタミナが足りなければクリア済みチュートリアルへの再挑戦は弾かれる(消費されない) ---
S = setup();
S.clearedStages = ['tu1'];
S.stamina = 5; // TUTORIAL_REPLAY_STAMINA(10)未満
api.resetQueue();
E.startBattle('tu1', { skipIntro: true });
api.drainQueue();
ok('スタミナ不足だとクリア済みチュートリアルへの再挑戦でスタミナが減らない(拒否された)', S.stamina === 5, S.stamina);

console.log('done');
