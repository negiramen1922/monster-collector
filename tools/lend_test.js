/* お助けモンスターの貸し出し: 借りっぱなしでも最新に追いつくか、遺物とルーンが乗るか */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e = {
  DEFAULT_STATE, MON_BY_ID, RELICS, HELP_SLOT_ID, MAX_STAR,
  publishSupport: () => {
    const favId = (profileState().favorites || []).filter(id => STATE.owned[id])[0];
    const favOwned = favId && STATE.owned[favId];
    const favRelicId = favId ? equippedRelicOf(favId) : null;
    const favRelicSt = favRelicId ? STATE.relics[favRelicId] : null;
    return favOwned ? { id: favId, star: favOwned.star, level: favOwned.level,
      skillLv: favOwned.skillLv, skill2Lv: favOwned.skill2Lv, ultLv: favOwned.ultLv, passiveLv: favOwned.passiveLv,
      relic: favRelicSt ? { defId: favRelicId, level: favRelicSt.level, skillLv: favRelicSt.skillLv, dupeUsed: favRelicSt.dupeUsed } : null,
      runes: sanitizeRuneBonus(runeBonusOf(favId)) } : null;
  },
  sanitizeSupport, mergeFriendProfile, syncBorrowedFrom, syncHelperMon, battlePower, statsWithSnap, scaledStats,
  grantRelic, profileState,
  STATE_get: () => STATE,
};`);
const E = global.__e;
let bad = 0;
const ok = (n, c, i) => { if(!c) bad++; console.log((c ? '✅' : '❌') + ' ' + n + (i !== undefined ? '  ' + JSON.stringify(i) : '')); };

api.STATE = E.DEFAULT_STATE();
const S = api.STATE;

// --- 貸す側のつもりで「公開される support」を作る ---
S.owned['m68'] = { star: 5, souls: 0, level: 200, exp: 0, wall: 200, skillLv: 8, skill2Lv: 8, ultLv: 8, passiveLv: 8 };
E.profileState().favorites = ['m68'];
E.grantRelic(E.RELICS['rel_wolf_howl'] || Object.values(E.RELICS)[0]);
const relicId = Object.keys(S.relics)[0];
S.relics[relicId].equippedTo = 'm68';
S.relics[relicId].level = 40;
const pub1 = E.publishSupport();
ok('貸出データにモンスターが入る', pub1 && pub1.id === 'm68', pub1 && pub1.id);
ok('貸出データに遺物が入る', !!(pub1 && pub1.relic && pub1.relic.defId === relicId), pub1 && pub1.relic);

// --- 借りる側 ---
api.STATE = E.DEFAULT_STATE();
const B = api.STATE;
B.friends = [{ uid: 'u1', playerId: 'P1', name: 'ともだち', level: 50, support: E.sanitizeSupport(pub1) }];
B.borrowed = { uid: 'u1', name: 'ともだち', mon: { ...B.friends[0].support } };
E.syncHelperMon();
ok('借りたモンスターに遺物のスナップショットが付く', !!B.borrowed.mon.relic, B.borrowed.mon.relic);

const bpBefore = E.battlePower(E.HELP_SLOT_ID);
ok('借りたモンスターのBPが出る', bpBefore > 0, bpBefore);
// 遺物なしと比べて強いこと
const noRelic = E.statsWithSnap(E.MON_BY_ID['m68'], 5, 200, null, null);
const withRelic = E.statsWithSnap(E.MON_BY_ID['m68'], 5, 200, B.borrowed.mon.relic, null);
ok('遺物のぶんステータスが上がる', withRelic.str > noRelic.str || withRelic.hp > noRelic.hp, [noRelic.str, withRelic.str, noRelic.hp, withRelic.hp]);

// --- 相手がレベルと★を上げたあと、借りっぱなしでも追いつくか ---
const grown = { ...pub1, level: 260, star: 7, skillLv: 10 };
E.mergeFriendProfile(B.friends[0], { uid: 'u1', playerId: 'P1', name: 'ともだち', level: 60, support: grown });
ok('借りっぱなしでもレベルが最新になる', B.borrowed.mon.level === 260, B.borrowed.mon.level);
ok('借りっぱなしでも★が最新になる', B.borrowed.mon.star === 7, B.borrowed.mon.star);
const bpAfter = E.battlePower(E.HELP_SLOT_ID);
ok('BPも上がる', bpAfter > bpBefore, [bpBefore, bpAfter]);

// --- 相手が貸出をやめたら、借りている分はそのまま残す ---
E.mergeFriendProfile(B.friends[0], { uid: 'u1', playerId: 'P1', name: 'ともだち', level: 60, support: null });
ok('相手が貸出をやめても借りている分は消えない', B.borrowed && B.borrowed.mon.level === 260, B.borrowed && B.borrowed.mon.level);

// --- 他人のデータは必ず丸める ---
const evil = E.sanitizeSupport({ id: 'm68', star: 999, level: 99999, skillLv: 99,
  relic: { defId: 'ないよ', level: 99999 }, runes: { str: 999999 } });
ok('★とLvは上限で止まる', evil.star <= E.MAX_STAR && evil.level <= 300, [evil.star, evil.level]);
ok('存在しない遺物は落とす', evil.relic === null, evil.relic);
ok('ルーンの値も上限で止まる', !evil.runes || evil.runes.str < 99999, evil.runes);
console.log(bad ? `${bad}件 失敗` : 'すべて通過');
process.exitCode = bad ? 1 : 0;
