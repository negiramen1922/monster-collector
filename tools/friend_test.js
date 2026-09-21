/* ad-hoc check for friend add/borrow flow with a mocked lookupPlayer backend,
   including defensive sanitization of another player's (untrusted) published data. */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e = {
  STATE_ref: () => STATE, DEFAULT_STATE, addFriendByCode, sanitizeSupport, sanitizeAvatar, borrowFriendHelper,
  returnBorrowed, friendsAvailable, MON_BY_ID, setAccount: a => { ACCOUNT = a; },
  sendFriendPoint, friendPointSentToday, FRIEND_POINT_PER_SEND, claimFriendGifts, FRIEND_POINT_PER_BORROW_USE,
  pullFriendMon, pullFriendMat, doFriendPull, FRIEND_CHAR_GACHA_COST, FRIEND_MAT_GACHA_COST,
  getItem, addItem, MONSTERS, STAGES, sanitizeLastActive, lastActiveText, refreshFriendProfiles, friendNameOf,
};`);
const E = global.__e;

api.STATE = E.DEFAULT_STATE();
E.setAccount({ uid: 'me', playerId: 'ME123' });
global.window.__authBackend = { kind: 'local' }; // no lookupPlayer: simulates offline/guest

(async () => {
  // 1. offline/local backend: no lookupPlayer -> friends unavailable
  console.log('friendsAvailable (no backend):', E.friendsAvailable(), '(expect false)');

  // 2. mocked backend with a well-formed friend
  global.window.__authBackend = {
    kind: 'mock',
    async lookupPlayer(code){
      if(code === 'GOOD1') return { uid: 'u-good', playerId: 'GOOD1', name: 'よきフレンド', level: 12,
        support: { id: 'm54', star: 5, level: 80, skillLv: 6, ultLv: 6, passiveLv: 6 }, updatedAt: Date.now() - 3600 * 1000 };
      if(code === 'EVIL1') return { uid: 'u-evil', playerId: 'EVIL1', name: '<script>alert(1)</script>', level: 99999,
        support: { id: 'not-a-real-monster', star: 999, level: -5, skillLv: 'x', ultLv: null }, updatedAt: Date.now() + 999999999 };
      if(code === 'NOSUP') return { uid: 'u-nosup', playerId: 'NOSUP', name: 'ソウルなし', level: 3, support: null };
      return null;
    },
  };
  console.log('friendsAvailable (mocked):', E.friendsAvailable(), '(expect true)');

  await E.addFriendByCode('good1');
  console.log('friends after adding GOOD1:', JSON.stringify(api.STATE.friends));

  await E.addFriendByCode('evil1');
  const evil = api.STATE.friends.find(f => f.uid === 'u-evil');
  console.log('evil friend sanitized support (expect null, since m id is bogus):', JSON.stringify(evil && evil.support));
  console.log('evil friend name stored raw (escaping happens at render time):', evil && evil.name);

  await E.addFriendByCode('nosup');
  const nosup = api.STATE.friends.find(f => f.uid === 'u-nosup');
  console.log('nosup friend support (expect null):', nosup && nosup.support);

  await E.addFriendByCode('good1'); // duplicate
  console.log('friend count after re-adding GOOD1 (expect 3, not 4):', api.STATE.friends.length);

  E.borrowFriendHelper('u-good');
  console.log('borrowed after borrowFriendHelper:', JSON.stringify(api.STATE.borrowed));

  E.returnBorrowed();
  console.log('borrowed after returnBorrowed (expect null):', api.STATE.borrowed);

  // sanitizeSupport unit checks
  console.log('sanitizeSupport(null):', E.sanitizeSupport(null));
  console.log('sanitizeSupport(bad id):', E.sanitizeSupport({ id: 'zzz', star: 3, level: 50 }));
  console.log('sanitizeSupport(out-of-range clamps):', JSON.stringify(E.sanitizeSupport({ id: 'm54', star: 999, level: -10, skillLv: 'nope' })));

  const ok = (name, cond, info) => console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
  const S = api.STATE;

  // --- last active: sanitized on add, refreshed on demand, formatted for display ---
  const good = S.friends.find(f => f.uid === 'u-good');
  ok('追加時にlastActiveが記録される(過去の妥当な時刻)', typeof good.lastActive === 'number' && good.lastActive <= Date.now(), good.lastActive);
  const evilFriend = S.friends.find(f => f.uid === 'u-evil');
  ok('未来日時のupdatedAtはlastActiveに採用しない', evilFriend.lastActive === null, evilFriend.lastActive);
  ok('sanitizeLastActive: 不正値はnull', E.sanitizeLastActive('nope') === null && E.sanitizeLastActive(-5) === null && E.sanitizeLastActive(Date.now() + 1e9) === null);
  ok('sanitizeLastActive: 過去の妥当な値はそのまま', E.sanitizeLastActive(1000) === 1000);
  console.log('lastActiveText(たった今):', E.lastActiveText(Date.now() - 5000));
  console.log('lastActiveText(分前):', E.lastActiveText(Date.now() - 5 * 60000));
  console.log('lastActiveText(時間前):', E.lastActiveText(Date.now() - 5 * 3600000));
  console.log('lastActiveText(日前):', E.lastActiveText(Date.now() - 5 * 86400000));
  console.log('lastActiveText(不明):', E.lastActiveText(null));
  ok('friendNameOf: 既知のuidは名前を返す', E.friendNameOf('u-good') === 'よきフレンド');
  ok('friendNameOf: 不明なuidはフォールバック', E.friendNameOf('u-not-a-friend') === 'フレンド');

  global.window.__authBackend.fetchProfiles = async (uids) => uids.filter(u => u === 'u-good').map(u => ({ uid: u, updatedAt: Date.now(), level: 55, support: null }));
  await E.refreshFriendProfiles();
  const goodAfterRefresh = S.friends.find(f => f.uid === 'u-good');
  ok('refreshFriendProfilesでlastActive/levelが更新される', goodAfterRefresh.level === 55 && Date.now() - goodAfterRefresh.lastActive < 1000, goodAfterRefresh);
  const evilAfterRefresh = S.friends.find(f => f.uid === 'u-evil');
  ok('fetchProfilesに含まれないフレンドは変更されない', evilAfterRefresh.level === 999, evilAfterRefresh.level);
  delete global.window.__authBackend.fetchProfiles;

  // --- friend points: sending is capped once/day/friend, only affects the sender ---
  ok('未送信ならfriendPointSentToday=false', E.friendPointSentToday('u-good') === false);
  const before = S.friendPoints || 0;
  E.sendFriendPoint('u-good');
  ok('送信するとフレンドポイントが増える', S.friendPoints === before + E.FRIEND_POINT_PER_SEND, [before, S.friendPoints]);
  ok('送信後はfriendPointSentToday=true', E.friendPointSentToday('u-good') === true);
  const afterFirst = S.friendPoints;
  E.sendFriendPoint('u-good');
  ok('同じフレンドには1日1回までしか送れない', S.friendPoints === afterFirst, [afterFirst, S.friendPoints]);
  E.sendFriendPoint('u-evil');
  ok('別のフレンドには別枠で送れる', S.friendPoints === afterFirst + E.FRIEND_POINT_PER_SEND, S.friendPoints);
  E.sendFriendPoint('u-not-a-friend');
  ok('フレンドでないuidを送っても増えない(存在チェック)', S.friendPoints === afterFirst + E.FRIEND_POINT_PER_SEND);

  // --- friend gacha: ★1-3 only, spends friendPoints, grants via the normal reward pipeline ---
  for(let i = 0; i < 50; i++){
    const r = E.pullFriendMon();
    if(E.MONSTERS.find(m => m.id === r.id).rarity > 3){ ok('friendキャラガチャは★1-3のみ(50回中1つでも★4+があれば失敗)', false, r); break; }
  }
  ok('friendキャラガチャは★1-3のみ(50回とも★3以下)', true);

  S.friendPoints = 1000;
  const goldBefore = S.gold;
  const ownedBefore = Object.keys(S.owned).length;
  E.doFriendPull('char', 1);
  ok('フレンドキャラガチャでポイントが消費される', S.friendPoints === 1000 - E.FRIEND_CHAR_GACHA_COST, S.friendPoints);
  ok('フレンドキャラガチャでモンスターが増える(所持済みならソウル)', Object.keys(S.owned).length >= ownedBefore);

  S.friendPoints = 1000;
  const scrapBefore = E.getItem('relic_scrap');
  E.doFriendPull('mat', 10);
  ok('フレンド素材ガチャで10連分のポイントが消費される', S.friendPoints === 1000 - E.FRIEND_MAT_GACHA_COST * 10, S.friendPoints);

  S.friendPoints = 0;
  const ptsBefore2 = S.friendPoints;
  E.doFriendPull('char', 1);
  ok('ポイント不足だと何も起きない', S.friendPoints === ptsBefore2);

  // --- mailbox: sendFriendPoint also drops a gift for the recipient when the backend
  // supports it, and claimFriendGifts picks up + clears any gifts waiting for us ---
  const mailboxes = {}; // uid -> [{id, from, amount}], stands in for players/{uid}/gifts
  let nextGiftId = 1;
  global.window.__authBackend = {
    kind: 'mock',
    async lookupPlayer(code){ return code === 'GOOD1' ? { uid: 'u-good', playerId: 'GOOD1', name: 'よきフレンド', level: 12, support: null } : null; },
    async sendGift(toUid, fromUid, amount){ (mailboxes[toUid] = mailboxes[toUid] || []).push({ id: String(nextGiftId++), from: fromUid, amount }); },
    async fetchGifts(uid){ return mailboxes[uid] || []; },
    async claimGifts(uid, ids){ mailboxes[uid] = (mailboxes[uid] || []).filter(g => !ids.includes(g.id)); },
  };
  S.friendSendDaily = null; // reset today's send caps so u-good can be sent to again below
  E.sendFriendPoint('u-good'); // the mock sendGift has no internal await, so it lands synchronously
  ok('送信すると受信箱(相手のuid)にギフトが積まれる', (mailboxes['u-good'] || []).length === 1, mailboxes['u-good']);

  // simulate a gift arriving FOR us (as if a friend had sent one to our own uid)
  mailboxes['me'] = [{ id: 'g1', from: 'u-good', amount: E.FRIEND_POINT_PER_SEND }, { id: 'g2', from: 'u-good', amount: E.FRIEND_POINT_PER_SEND }];
  const beforeClaim = S.friendPoints;
  await E.claimFriendGifts();
  ok('claimFriendGiftsで相手から届いたポイントが加算される(2件分)', S.friendPoints === beforeClaim + E.FRIEND_POINT_PER_SEND * 2, [beforeClaim, S.friendPoints]);
  ok('受け取り後は受信箱が空になる(二重取得防止)', (mailboxes['me'] || []).length === 0, mailboxes['me']);
  const afterClaim = S.friendPoints;
  await E.claimFriendGifts();
  ok('空の受信箱を再度claimしても増えない', S.friendPoints === afterClaim);

  // offline/local backend (no sendGift/fetchGifts): must no-op quietly, never throw
  global.window.__authBackend = { kind: 'local' };
  S.friendSendDaily = null; // otherwise today's cap short-circuits before reaching be.sendGift
  let threw = false;
  try{ E.sendFriendPoint('u-good'); await E.claimFriendGifts(); }catch(e){ threw = true; }
  ok('ギフト機能が無いバックエンドでも例外を投げない', !threw);

  // --- addFriendByCode: real playerIds are "XXXX-XXXX-XXXX" (see playerIdFromUid), but the
  // input maxlength used to be 12 (too short to even type the hyphens) and the lookup required
  // an exact hyphenated match - so typing the code without dashes always failed. Both are fixed:
  // the input now allows the full 14 chars, and the code is normalized (dashes/spaces/case
  // stripped, then re-grouped into 4-4-4) before the lookup. ---
  global.window.__authBackend = {
    kind: 'mock',
    async lookupPlayer(code){ return code === 'ABCD-1234-WXYZ' ? { uid: 'u-real', playerId: 'ABCD-1234-WXYZ', name: 'ハイフン太郎', level: 5, support: null } : null; },
  };
  S.friends = [];
  await E.addFriendByCode('abcd1234wxyz'); // no hyphens, lowercase - what a user is likely to type
  ok('ハイフンなし・小文字で入力してもフレンド追加できる', S.friends.some(f => f.uid === 'u-real'), S.friends);

  S.friends = [];
  await E.addFriendByCode('ABCD-1234-WXYZ'); // exact stored format still works
  ok('ハイフン付きの正式な形式でもフレンド追加できる', S.friends.some(f => f.uid === 'u-real'), S.friends);

  S.friends = [];
  await E.addFriendByCode('abcd 1234 wxyz'); // spaces instead of hyphens
  ok('区切りがスペースでもフレンド追加できる', S.friends.some(f => f.uid === 'u-real'), S.friends);

  // --- avatar: the friend list icon used to only show the お助けキャラ (support character)
  // icon, which is blank for most friends since setting a support character is optional.
  // publishProfile() now also publishes profileAvatar() (which always resolves to some owned
  // monster), so the friend list can always show a real icon. sanitizeAvatar guards it the
  // same way sanitizeSupport does: only accept a real monster id, otherwise null. ---
  ok('sanitizeAvatar: 実在するモンスターIDはそのまま通る', E.sanitizeAvatar('m06') === 'm06');
  ok('sanitizeAvatar: 存在しないIDはnull', E.sanitizeAvatar('not-a-real-monster') === null);
  ok('sanitizeAvatar: 非文字列(オブジェクトなど)はnull', E.sanitizeAvatar({ id: 'm06' }) === null);
  ok('sanitizeAvatar: nullはnull', E.sanitizeAvatar(null) === null);

  global.window.__authBackend = {
    kind: 'mock',
    async lookupPlayer(code){
      if(code === 'AVAT-ARXX-0001') return { uid: 'u-avatar', playerId: 'AVAT-ARXX-0001', name: 'アバター太郎', level: 7, support: null, avatar: 'm21', monsters: 12, cleared: 8 };
      return null;
    },
  };
  S.friends = [];
  await E.addFriendByCode('AVAT-ARXX-0001');
  const avatarFriend = S.friends.find(f => f.uid === 'u-avatar');
  ok('お助けキャラ未設定でもavatarが保存される', avatarFriend && avatarFriend.avatar === 'm21', avatarFriend);
  ok('monsters/clearedも保存される', avatarFriend && avatarFriend.monsters === 12 && avatarFriend.cleared === 8, avatarFriend);

  // a hostile/bogus published profile must not poison our state
  global.window.__authBackend = {
    kind: 'mock',
    async lookupPlayer(code){
      if(code === 'EVIL-AVAT-AR02') return { uid: 'u-evil-avatar', playerId: 'EVIL-AVAT-AR02', name: '悪', level: 1, support: null, avatar: 'not-a-real-monster', monsters: -5, cleared: 99999999 };
      return null;
    },
  };
  S.friends = [];
  await E.addFriendByCode('EVIL-AVAT-AR02');
  const evilAvatarFriend = S.friends.find(f => f.uid === 'u-evil-avatar');
  ok('不正なavatarはnullにサニタイズされる', evilAvatarFriend && evilAvatarFriend.avatar === null, evilAvatarFriend);
  ok('monsters/clearedは範囲内にクランプされる', evilAvatarFriend && evilAvatarFriend.monsters === 0 && evilAvatarFriend.cleared === E.STAGES.length, evilAvatarFriend);

  // refreshFriendProfiles also keeps avatar/monsters/cleared up to date
  global.window.__authBackend = {
    kind: 'mock',
    async fetchProfiles(uids){ return uids.map(uid => ({ uid, updatedAt: Date.now(), level: 99, support: null, avatar: 'm03', monsters: 20, cleared: 15 })); },
  };
  await E.refreshFriendProfiles();
  const refreshed = S.friends.find(f => f.uid === 'u-evil-avatar');
  ok('refreshFriendProfilesでavatar/monsters/clearedも更新される', refreshed && refreshed.avatar === 'm03' && refreshed.monsters === 20 && refreshed.cleared === 15, refreshed);

  // --- claimFriendGifts: 'borrow'-reason gifts (お助けキャラがクエストで使われた分、
  // see friend_borrow_battle_test.js for who actually sends these) are counted separately
  // from plain 'send' gifts, and accumulate into a persistent STATE.helperLentStats. ---
  const mailboxes2 = {
    me: [
      { id: 'b1', from: 'u-good', amount: E.FRIEND_POINT_PER_BORROW_USE, reason: 'borrow' },
      { id: 'b2', from: 'u-good', amount: E.FRIEND_POINT_PER_BORROW_USE, reason: 'borrow' },
      { id: 's1', from: 'u-good', amount: E.FRIEND_POINT_PER_SEND, reason: 'send' },
    ],
  };
  global.window.__authBackend = {
    kind: 'mock',
    async fetchGifts(uid){ return mailboxes2[uid] || []; },
    async claimGifts(uid, ids){ mailboxes2[uid] = (mailboxes2[uid] || []).filter(g => !ids.includes(g.id)); },
  };
  S.friendPoints = 0;
  S.helperLentStats = null;
  await E.claimFriendGifts();
  const expectedTotal = E.FRIEND_POINT_PER_BORROW_USE * 2 + E.FRIEND_POINT_PER_SEND;
  ok('borrow分もsend分も合算してfriendPointsに入る', S.friendPoints === expectedTotal, S.friendPoints);
  ok('helperLentStats.countはborrow分の件数だけ増える(sendは含まない)', S.helperLentStats && S.helperLentStats.count === 2, S.helperLentStats);
  ok('helperLentStats.fpはborrow分の合計額だけ増える', S.helperLentStats && S.helperLentStats.fp === E.FRIEND_POINT_PER_BORROW_USE * 2, S.helperLentStats);

  // stats accumulate across multiple claims, they don't reset
  mailboxes2.me = [{ id: 'b3', from: 'u-good', amount: E.FRIEND_POINT_PER_BORROW_USE, reason: 'borrow' }];
  await E.claimFriendGifts();
  ok('2回目のclaimでhelperLentStatsが積み上がる(リセットされない)', S.helperLentStats.count === 3 && S.helperLentStats.fp === E.FRIEND_POINT_PER_BORROW_USE * 3, S.helperLentStats);

  // a claim with no 'borrow' gifts at all must not touch helperLentStats
  const statsBefore = { ...S.helperLentStats };
  mailboxes2.me = [{ id: 's2', from: 'u-good', amount: E.FRIEND_POINT_PER_SEND, reason: 'send' }];
  await E.claimFriendGifts();
  ok('send専用のclaimではhelperLentStatsが変化しない', S.helperLentStats.count === statsBefore.count && S.helperLentStats.fp === statsBefore.fp, S.helperLentStats);
})();
