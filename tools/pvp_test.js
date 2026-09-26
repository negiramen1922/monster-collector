/* ad-hoc check for the PVP system: defense-formation sanitization (adversarial input),
   the Firestore random-opponent mock, daily challenge tickets, and a full battle against
   a fetched (fully sanitized) opponent, including a fairness check that buildPvpEnemyParty
   does not apply the stage-difficulty ENEMY_POWER buff a scripted stage enemy would get. */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e = { MAX_STAR,
  get STATE(){ return STATE }, set STATE(v){ STATE = v }, DEFAULT_STATE, setAccount: a => { ACCOUNT = a; },
  sanitizeDefense, sanitizeRelicSnap, buildDefenseSnapshot, publishProfile,
  pvpAvailable, searchPvpOpponents, get pvpOpponents(){ return pvpOpponents; },
  setPvpDefense, hasPvpDefense, hasPvpForm, ensurePvpSlots, copyPartyIntoPvpForm, placeInPvpForm,
  pvpChallengesLeft, ensurePvpDaily, PVP_DAILY_MAX,
  startPvpBattle, buildPvpEnemyParty, buildUnit, isMeleeRole, getFormation, applyFormationBonus,
  grantRelic, equipRelic, RELICS, MON_BY_ID, FORMATIONS, DEFAULT_FORMATION, HELP_SLOT_ID,
  formationForFrontCount, lineupFromList, borrowFriendHelper, placeHelperInSlot,
};`);
const E = global.__e;
const ok = (name, cond, info) => console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));

api.STATE = E.DEFAULT_STATE();
const S = api.STATE;
E.setAccount({ uid: 'me', playerId: 'ME123' });
global.window.__authBackend = { kind: 'local' }; // no fetchPvpOpponents: offline/guest

(async () => {
  // --- 1. availability gate ---
  ok('pvpAvailable (no backend) = false', E.pvpAvailable() === false);

  // --- 2. sanitizeDefense: adversarial / malformed input never crashes, always degrades safely ---
  ok('null は null', E.sanitizeDefense(null) === null);
  ok('slotsが配列でないと null', E.sanitizeDefense({ formationKey: 'f1', slots: 'nope' }) === null);
  ok('全スロットが不正なモンスターIDなら null(有効なスロットが1つもない)',
    E.sanitizeDefense({ formationKey: 'f1', slots: [{ id: 'not-a-real-monster' }, null, null, null, null] }) === null);

  const evilDefense = E.sanitizeDefense({
    formationKey: 'not-a-real-formation',
    slots: [
      { id: 'm06', star: 999, level: -10, skillLv: 'x', ultLv: null, passiveLv: 5, relic: { defId: 'rel_flame_ember', level: 99999, skillLv: -1, dupeUsed: 999 } },
      { id: 'not-a-real-monster', star: 3, level: 50 },
      null, undefined, { id: 'm21', level: 40 },
      { id: 'm03', level: 999999 }, { id: 'm02', level: 1 }, // 2 extra slots beyond PARTY_MAX(5), should be truncated
    ],
  });
  ok('不正な陣形キーはデフォルトに落ちる', evilDefense.formationKey === E.DEFAULT_FORMATION, evilDefense.formationKey);
  ok('5枠に切り詰められる', evilDefense.slots.length === 5, evilDefense.slots.length);
  ok('不正なモンスターIDのスロットは null になる', evilDefense.slots[1] === null);
  ok('star/levelは範囲内にクランプされる', evilDefense.slots[0].star === E.MAX_STAR && E.MAX_STAR === 10 && evilDefense.slots[0].level === 1, evilDefense.slots[0]);
  ok('skillLvが非数値ならデフォルト1', evilDefense.slots[0].skillLv === 1);
  ok('遺物のdupeUsedは0-4にクランプされる', evilDefense.slots[0].relic.dupeUsed === 4, evilDefense.slots[0].relic);
  ok('存在しない遺物defIdは null', E.sanitizeRelicSnap({ defId: 'rel_does_not_exist', level: 1 }) === null);

  // --- 3. setPvpDefense: snapshots the CURRENT party/formation, publishes via cloudProfile ---
  S.owned.m06 = { star: 3, souls: 0, level: 40, exp: 0, wall: 0, skillLv: 3, ultLv: 3, passiveLv: 3 };
  S.owned.m21 = { star: 2, souls: 0, level: 30, exp: 0, wall: 0, skillLv: 1, ultLv: 1, passiveLv: 1 };
  const fk0 = E.formationForFrontCount(1).key;
  S.formationKey = fk0;
  S.slots = E.lineupFromList(['m06', 'm21'], fk0);
  E.grantRelic(E.RELICS.rel_flame_ember);
  E.equipRelic('rel_flame_ember', 'm06');
  ok('防衛編成は最初は未設定', E.hasPvpDefense() === false);

  let publishedPayload = null;
  global.window.__authBackend = {
    kind: 'mock',
    async cloudProfile(uid, profile){ publishedPayload = profile; },
    async fetchPvpOpponents(){ return []; },
  };
  E.setPvpDefense();
  await new Promise(r => setImmediate(r));
  ok('防衛編成が現在の編成のスナップショットになる', E.hasPvpDefense() === true && S.pvpDefenseSlots.filter(Boolean).length === 2, S.pvpDefenseSlots);
  ok('publishProfile経由でdefenseが公開される(遺物込み)', !!(publishedPayload && publishedPayload.defense && publishedPayload.defense.slots.some(s => s && s.relic)),
    publishedPayload && publishedPayload.defense);

  // --- 4. searchPvpOpponents: filters out opponents with no usable defense ---
  global.window.__authBackend = {
    kind: 'mock',
    async fetchPvpOpponents(selfUid, n){
      return [
        { uid: 'u-good', name: 'よきライバル', level: 42, defense: { formationKey: 'f1', slots: [{ id: 'm06', star: 3, level: 40, skillLv: 1, ultLv: 1, passiveLv: 1 }, null, null, null, null] } },
        { uid: 'u-nodef', name: 'まだ未設定', level: 5, defense: null },
        { uid: 'u-evil', name: '<script>1</script>', level: 999999, defense: { formationKey: 'x', slots: [{ id: 'bogus' }] } },
      ];
    },
  };
  ok('pvpAvailable (mocked) = true', E.pvpAvailable() === true);
  await E.searchPvpOpponents();
  ok('未設定/不正な相手は除外され、有効な相手だけ残る', E.pvpOpponents.length === 1 && E.pvpOpponents[0].uid === 'u-good', E.pvpOpponents.map(o => o.uid));

  // --- 5. buildPvpEnemyParty fairness: no ENEMY_POWER stage-difficulty buff ---
  const mon = E.MON_BY_ID['m06'];
  const asAlly = E.buildUnit(mon, 1, false, 3, false, 40, { skillLv: 1, ultLv: 1, passiveLv: 1 });
  E.applyFormationBonus(asAlly, E.getFormation('f1')); // buildPvpEnemyParty applies the same formation bonus, so match it here for a fair comparison
  const defenseParty = E.buildPvpEnemyParty({ formationKey: 'f1', slots: [{ id: 'm06', star: 3, level: 40, skillLv: 1, ultLv: 1, passiveLv: 1 }, null, null, null, null] });
  ok('PVP相手のステータスは通常の味方と同じ(ENEMY_POWERのバフが乗らない)',
    defenseParty[0].maxHp === asAlly.maxHp && defenseParty[0].str === asAlly.str, [asAlly.maxHp, defenseParty[0].maxHp]);
  ok('PVP相手はisEnemy=trueとして扱われる', defenseParty[0].isEnemy === true);

  // --- 6. PVP攻撃編成はクエストのパーティ(STATE.slots)と別枠で、お助けキャラは持ち込めない ---
  const opponent = E.pvpOpponents[0];
  const leftBeforeNoAttack = E.pvpChallengesLeft();
  E.startPvpBattle(opponent);
  ok('攻撃編成を設定していないと挑戦できない', E.pvpChallengesLeft() === leftBeforeNoAttack && !api.battleUI, api.battleUI);

  S.friends = [{ uid: 'friend-uid', name: 'ゆうじん', support: { id: 'm54', star: 5, level: 50, skillLv: 1, skill2Lv: 1, ultLv: 1, passiveLv: 1 } }];
  E.borrowFriendHelper('friend-uid');
  E.placeHelperInSlot(); // お助けキャラをクエスト用パーティ(STATE.slots)に編成
  ok('お助けキャラがクエストパーティには入る', S.slots.includes(E.HELP_SLOT_ID), S.slots);

  E.copyPartyIntoPvpForm('attack');
  ok('現在の編成をコピーしてもPVP攻撃編成にお助けキャラは入らない', !E.ensurePvpSlots('attack').includes(E.HELP_SLOT_ID), E.ensurePvpSlots('attack'));
  ok('PVP攻撃編成が設定される', E.hasPvpForm('attack') === true, S.pvpAttackSlots);

  E.placeInPvpForm('attack', E.HELP_SLOT_ID);
  ok('お助けキャラを直接PVP攻撃編成に配置しようとしても入らない', !E.ensurePvpSlots('attack').includes(E.HELP_SLOT_ID), E.ensurePvpSlots('attack'));

  const attackSnapshotBefore = [...S.pvpAttackSlots];
  S.slots = E.lineupFromList(['m03'], fk0); // クエストパーティを変えても
  ok('PVP攻撃編成はクエストパーティの変更に影響されない(別枠)', JSON.stringify(S.pvpAttackSlots) === JSON.stringify(attackSnapshotBefore), S.pvpAttackSlots);

  // --- 7. daily challenge tickets + full battle integration ---
  ok('挑戦回数の初期値', E.pvpChallengesLeft() === E.PVP_DAILY_MAX);
  api.resetQueue();
  E.startPvpBattle(opponent);
  api.drainQueue();
  const b = api.battleUI;
  ok('PVP戦闘が終了する', b.finished === true);
  ok('battleUI.pvpに挑戦相手が入る', b.pvp === opponent);
  ok('挑戦回数が1消費される', E.pvpChallengesLeft() === E.PVP_DAILY_MAX - 1, E.pvpChallengesLeft());
  ok('PVPポイントが増える', S.pvpPoints > 0, S.pvpPoints);
  ok('戦ったのはPVP攻撃編成(m06)で、その時点のクエストパーティ(m03)ではない',
    b.party.some(u => u.ref === 'm06') && !b.party.some(u => u.ref === 'm03'), b.party.map(u => u.ref));

  // --- 8. 不正な相手には挑戦できず、回数も減らない ---
  const before = E.pvpChallengesLeft();
  E.startPvpBattle({ uid: 'u-evil', name: 'evil', level: 1, defense: { formationKey: 'x', slots: [{ id: 'bogus' }] } });
  ok('不正な防衛編成には挑戦できず、回数も減らない', E.pvpChallengesLeft() === before);

  console.log('done');
})();
