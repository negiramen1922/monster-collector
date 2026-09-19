/* ad-hoc check for friend add/borrow flow with a mocked lookupPlayer backend,
   including defensive sanitization of another player's (untrusted) published data. */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e = {
  STATE_ref: () => STATE, DEFAULT_STATE, addFriendByCode, sanitizeSupport, borrowFriendHelper,
  returnBorrowed, friendsAvailable, MON_BY_ID, setAccount: a => { ACCOUNT = a; },
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
        support: { id: 'm54', star: 5, level: 80, skillLv: 6, ultLv: 6, passiveLv: 6 } };
      if(code === 'EVIL1') return { uid: 'u-evil', playerId: 'EVIL1', name: '<script>alert(1)</script>', level: 99999,
        support: { id: 'not-a-real-monster', star: 999, level: -5, skillLv: 'x', ultLv: null } };
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
})();
