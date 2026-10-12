/* 2026-10-12 の不具合直し:
   1. ログインボーナス(10日): 受け取らないまま日が変わっても、その日の箱を飛ばさない
   2. 「結果だけ」の周回のイベントボーナスは、★3でクリアした編成のもの(今の編成ではない)
   3. おすすめユーザーは最近遊んだ人から選ぶ(fetchRecentPlayers) */
const load = require('./harness.js');
let now = new Date('2026-10-14T13:00:00+09:00').getTime();
Date.now = () => now;
const api = load('game.js', s => s + `;global.__t={ensureDailyLogin, claimDailyLoginDay, currentDayKey, grantEventMedal, sweepEventBonus, eventBonusRate, STAGE_BY_ID, EVENTS, MON_BY_ID,
  fetchRecommendedUsers, get recommendedUsers(){ return recommendedUsers; }, set ACCOUNT(v){ ACCOUNT = v; },
  get STATE(){return STATE}, set STATE(v){STATE=v}, DEFAULT_STATE};`);
const T = global.__t;
let bad = 0;
const ok = (c, name, info) => { if(!c) bad++; console.log((c ? '✅ ' : '❌ ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : '')); };
T.STATE = T.DEFAULT_STATE();
const day = 86400000;

console.log('--- ログインボーナス ---');
T.STATE.dailyLogin = null;
let dl = T.ensureDailyLogin();
ok(dl.day === 1, '初日は1日目', dl.day);
now += day; dl = T.ensureDailyLogin();
ok(dl.day === 1, '受け取らずに次の日 → 1日目のまま(飛ばさない)', dl.day);
T.claimDailyLoginDay(1);
ok(T.STATE.dailyLogin.claimed.includes(1), '1日目を受け取れる');
dl = T.ensureDailyLogin();
ok(dl.day === 1, '同じ日のうちは進まない(1日1つまで)', dl.day);
now += 3 * day; dl = T.ensureDailyLogin();
ok(dl.day === 2, '何日あいても、次に開いた日は2日目', dl.day);
T.claimDailyLoginDay(2); now += day; dl = T.ensureDailyLogin();
ok(dl.day === 3, '受け取った次の日は3日目', dl.day);

console.log('--- 結果だけの周回のイベントボーナス ---');
const st = T.STAGE_BY_ID.ev_momotaro_10;
const ev = T.EVENTS.find(e => e.key === 'ev_momotaro');
const bonusParty = ['m171', 'm172', 'm173', 'm174'].map(ref => ({ ref, element: T.MON_BY_ID[ref].element }));
T.STATE.sweepBonus = {};
let g = T.grantEventMedal(st, false, bonusParty, { sweep: true });
ok(g.bonus === 0 && g.run === 50, '★3クリアの記録がなければ、ボーナスの編成で周回してもボーナスなし', g);
T.STATE.sweepBonus = { ev_momotaro_10: 0.6 };
g = T.grantEventMedal(st, false, bonusParty, { sweep: true });
ok(g.bonus === 0.6 && g.run === 80, '★3クリアした編成のボーナス(+60%)で数える', g);
g = T.grantEventMedal(st, false, bonusParty);
ok(g.bonus === 1 && g.run === 100, '戦闘ありの周回・ふつうのクリアは、その編成のボーナス', g);

console.log('--- おすすめユーザー ---');
(async () => {
  const fresh = Array.from({ length: 30 }, (_, i) => ({ uid: 'u' + i, name: 'P' + i, playerId: 'AAAA-BBBB-' + String(1000 + i), updatedAt: now - i * 3600000, level: 10 }));
  window.__authBackend = window.__authBackend || {};
  window.__authBackend.fetchRecentPlayers = async n => fresh.slice(0, n);
  window.__authBackend.fetchRandomPlayers = async () => [];
  T.ACCOUNT = { uid: 'me', playerId: 'ZZZZ-ZZZZ-ZZZZ' };
  await T.fetchRecommendedUsers();
  ok((T.recommendedUsers || []).length === 10, '最近遊んだ人から10人出る', (T.recommendedUsers || []).length);
  console.log(bad ? `${bad}件 失敗` : 'すべて通過');
  process.exit(bad ? 1 : 0);
})();
