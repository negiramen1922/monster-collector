/* ad-hoc check for the お助けキャラ (borrowed support character) mechanic:
   formation rendering, reflow, battle unit building, and the stamina surcharge. */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e = {
  STATE_ref: () => STATE, DEFAULT_STATE, HELP_SLOT_ID, syncHelperMon, slotOwnedLike,
  stageStaminaCost, battlePower, renderFormationGrid, changeFormation, FORMATIONS,
  MON_BY_ID, penalizedIds, currentFormation, placeHelperInSlot, removeHelperFromSlot,
  startBattle, STAGE_BY_ID,
};`);
const E = global.__e;

api.STATE = E.DEFAULT_STATE();
api.STATE.owned = { m21: { star: 1, souls: 0, level: 10, exp: 0, wall: 0, skillLv: 1, ultLv: 1, passiveLv: 1 } };
api.STATE.slots = ['m21', null, null, null, null];
api.STATE.stamina = 300;
api.STATE.clearedStages = ['tu3'];
api.STATE.borrowed = { uid: 'friend-1', name: 'テストフレンド', mon: { id: 'm54', star: 5, level: 80, skillLv: 6, ultLv: 6, passiveLv: 6 } };
E.syncHelperMon();

console.log('MON_BY_ID alias resolves:', E.MON_BY_ID[E.HELP_SLOT_ID] && E.MON_BY_ID[E.HELP_SLOT_ID].name);

E.placeHelperInSlot();
console.log('slots after placeHelperInSlot:', api.STATE.slots);
console.log('helper slot is HELP_SLOT_ID:', api.STATE.slots.includes(E.HELP_SLOT_ID));

const bp = E.battlePower(E.HELP_SLOT_ID);
console.log('battlePower(helper):', bp, bp > 0 ? 'OK' : 'FAIL (expected > 0)');

const penalized = E.penalizedIds();
console.log('penalizedIds (should not throw):', penalized);

// formation change must not crash when a helper occupies a slot (reflowSlots -> idRole -> MON_BY_ID)
const otherKey = E.FORMATIONS.find(f => f.key !== E.currentFormation().key).key;
try{
  E.changeFormation(otherKey);
  console.log('changeFormation with helper in party: OK, slots =', api.STATE.slots);
}catch(e){
  console.log('changeFormation with helper in party: FAIL', e.message);
}

const gridHtml = E.renderFormationGrid(false);
console.log('renderFormationGrid contains help-mini badge:', gridHtml.includes('help-mini'));

const stage = E.STAGE_BY_ID['q1_01'];
const baseCost = stage.stamina;
const withHelperCost = E.stageStaminaCost(stage);
console.log(`stageStaminaCost: base=${baseCost} withHelper=${withHelperCost} surcharge=${withHelperCost - baseCost} (expect 5)`);

const staminaBefore = api.STATE.stamina;
E.startBattle('q1_01');
console.log('stamina after startBattle:', api.STATE.stamina, 'spent =', staminaBefore - api.STATE.stamina, '(expect', withHelperCost, ')');

E.removeHelperFromSlot();
console.log('slots after removeHelperFromSlot:', api.STATE.slots);
console.log('stageStaminaCost after removing helper:', E.stageStaminaCost(stage), '(expect', baseCost, ')');
