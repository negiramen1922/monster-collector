/* regression test: losing a battle used to refund only half the spent stamina
   (STAMINA_REFUND_ON_LOSS = 0.5). Now the full amount comes back on defeat/time-out,
   so a loss never costs the player stamina at all - only a win "spends" it for real. */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e = {
  get STATE(){ return STATE }, set STATE(v){ STATE = v }, DEFAULT_STATE, MON_BY_ID, STAGES,
  startBattle, finishBattle, get battleUI(){ return battleUI; },
  formationForFrontCount, lineupFromList, isMeleeRole, STAMINA_REFUND_ON_LOSS,
};`);
const E = global.__e;
const ok = (name, cond, info) => console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));

ok('STAMINA_REFUND_ON_LOSSは全額(1)', E.STAMINA_REFUND_ON_LOSS === 1, E.STAMINA_REFUND_ON_LOSS);

function setup(){
  api.STATE = E.DEFAULT_STATE();
  const S = api.STATE;
  const party = ['m06', 'm21', 'm03'];
  party.forEach(id => S.owned[id] = { star: E.MON_BY_ID[id].rarity, souls: 0, level: 30, skillLv: 5, skill2Lv: 5, ultLv: 5, passiveLv: 5 });
  const fk = E.formationForFrontCount(2).key;
  S.formationKey = fk;
  S.slots = E.lineupFromList(party, fk);
  S.clearedStages = E.STAGES.map(s => s.id);
  S.stamina = 1000;
  S.daily = null;
  return S;
}

// --- losing refunds the full cost spent for that battle ---
let S = setup();
api.resetQueue();
E.startBattle('q1_01', { skipIntro: true });
const spent = E.battleUI.staminaSpent;
const afterStart = S.stamina;
ok('開始時にスタミナが消費される', afterStart === 1000 - spent && spent > 0, [afterStart, spent]);

E.finishBattle(false); // force a loss without simulating the actual fight
ok('負けると使ったスタミナが全額戻る', S.stamina === 1000, S.stamina);
ok('battleUI.staminaRefundが使った分と一致する', E.battleUI.staminaRefund === spent, E.battleUI.staminaRefund);

// --- winning still spends the stamina for real (no refund) ---
S = setup();
api.resetQueue();
E.startBattle('q1_01', { skipIntro: true });
const spent2 = E.battleUI.staminaSpent;
E.finishBattle(true);
ok('勝つとスタミナは戻らない(消費されたまま)', S.stamina === 1000 - spent2, S.stamina);
ok('勝った時はstaminaRefundが設定されない', E.battleUI.staminaRefund === undefined, E.battleUI.staminaRefund);

console.log('done');
