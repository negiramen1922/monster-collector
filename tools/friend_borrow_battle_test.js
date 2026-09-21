/* regression test: borrowing a friend's お助けキャラ and actually using it in a battle
   should credit the LENDER (not the borrower) with FRIEND_POINT_PER_BORROW_USE FP, via
   a 'borrow'-reason gift sent through the same mailbox sendFriendPoint already uses.
   Only startBattle-driven battles (quests/dungeons/events) count, not PVP - finishBattle
   bails out to finishPvpBattle before the credit line runs. */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e = {
  get STATE(){ return STATE }, set STATE(v){ STATE = v }, DEFAULT_STATE,
  MON_BY_ID, startBattle, get battleUI(){ return battleUI },
  borrowFriendHelper, placeHelperInSlot, returnBorrowed,
  formationForFrontCount, lineupFromList, isMeleeRole, STAGES,
  setAccount: a => { ACCOUNT = a; }, FRIEND_POINT_PER_BORROW_USE,
};`);
const E = global.__e;
const ok = (name, cond, info) => console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));

function setup(party){
  api.STATE = E.DEFAULT_STATE();
  const S = api.STATE;
  party.forEach(id => S.owned[id] = { star: E.MON_BY_ID[id].rarity, souls: 0, level: 30, skillLv: 5, skill2Lv: 5, ultLv: 5, passiveLv: 5 });
  const fk = E.formationForFrontCount(Math.max(1, party.filter(id => E.isMeleeRole(E.MON_BY_ID[id].role)).length)).key;
  S.formationKey = fk;
  S.slots = E.lineupFromList(party, fk);
  S.clearedStages = E.STAGES.map(s => s.id);
  S.stamina = 1e9;
  S.daily = null;
  S.friends = [{ uid: 'friend-uid', name: 'ゆうじん', support: { id: 'm54', star: 5, level: 50, skillLv: 1, skill2Lv: 1, ultLv: 1, passiveLv: 1 } }];
  E.setAccount({ uid: 'me', playerId: 'ME123' });
  return S;
}

// --- helper borrowed AND placed in the party: a win must credit the lender ---
let sendGiftCalls = [];
global.window.__authBackend = {
  kind: 'mock',
  async sendGift(toUid, fromUid, amount, reason){ sendGiftCalls.push({ toUid, fromUid, amount, reason }); },
};
let S = setup(['m06', 'm21', 'm03']);
E.borrowFriendHelper('friend-uid');
E.placeHelperInSlot();
ok('お助けキャラが編成に入る', S.slots.includes('__help__'), S.slots);

api.resetQueue();
E.startBattle('q1_01', { skipIntro: true });
api.drainQueue();
ok('バトルが終了する', E.battleUI.finished === true, E.battleUI.finished);
ok('勝敗を問わず貸した側へborrow理由のギフトが送られる', sendGiftCalls.length === 1
  && sendGiftCalls[0].toUid === 'friend-uid' && sendGiftCalls[0].fromUid === 'me'
  && sendGiftCalls[0].amount === E.FRIEND_POINT_PER_BORROW_USE && sendGiftCalls[0].reason === 'borrow',
  sendGiftCalls);

// --- no helper in the party: no credit sent at all ---
sendGiftCalls = [];
S = setup(['m06', 'm21', 'm03']);
api.resetQueue();
E.startBattle('q1_01', { skipIntro: true });
api.drainQueue();
ok('お助けキャラを使っていなければギフトは送られない', sendGiftCalls.length === 0, sendGiftCalls);

// --- helper borrowed but NOT placed in the party (still just "held"): no credit either,
// since it never actually fought ---
sendGiftCalls = [];
S = setup(['m06', 'm21', 'm03']);
E.borrowFriendHelper('friend-uid'); // borrowed, but placeHelperInSlot() never called
api.resetQueue();
E.startBattle('q1_01', { skipIntro: true });
api.drainQueue();
ok('借りただけで編成に入れていなければギフトは送られない', sendGiftCalls.length === 0, sendGiftCalls);

console.log('done');
