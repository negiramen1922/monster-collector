/* regression test: 設定 > データを削除。クラウド同期されている分(saves/players、
   best-effort)とこの端末のローカル保存を両方消してサインアウトする。
   バックエンドがdeleteCloudDataを持たない(ゲスト/オフライン)場合は、ローカル削除と
   サインアウトだけを静かに行い、例外を投げない。 */
const load = require('./harness.js');

// storage is captured once by index.html's `const storage = (() => ... window.storage ...)()`
// at load time, so the mock must be installed on global.window BEFORE load() evaluates game.js.
const storageData = {};
const storageCalls = { removed: [], set: [] };
global.window.storage = {
  async get(k){ return storageData[k] !== undefined ? { value: storageData[k] } : null; },
  async set(k, v){ storageData[k] = v; storageCalls.set.push(k); },
  async remove(k){ delete storageData[k]; storageCalls.removed.push(k); },
};

const api = load('game.js', src => src + `;global.__e = {
  get STATE(){ return STATE }, set STATE(v){ STATE = v }, DEFAULT_STATE,
  get ACCOUNT(){ return ACCOUNT; }, setAccount: a => { ACCOUNT = a; },
  deleteAllData, saveKeyFor, SAVE_KEY,
};`);
const E = global.__e;
const ok = (name, cond, info) => console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));

(async () => {
  // --- signed in with a cloud-capable backend: both cloud + local data get wiped ---
  api.STATE = E.DEFAULT_STATE();
  E.setAccount({ uid: 'u1', playerId: 'ABCD-1234-EFGH', name: 'テスター', provider: 'google' });
  storageData[E.saveKeyFor('u1')] = JSON.stringify({ dummy: true });

  let deletedUid = null;
  let signedOut = false;
  global.window.__authBackend = {
    kind: 'mock',
    async deleteCloudData(uid){ deletedUid = uid; },
    async signOut(){ signedOut = true; },
  };

  await E.deleteAllData();
  ok('クラウドの削除が正しいuidで呼ばれる', deletedUid === 'u1', deletedUid);
  ok('ローカルのセーブキーが削除される', storageCalls.removed.includes(E.saveKeyFor('u1')), storageCalls.removed);
  ok('サインアウトされる', signedOut === true);
  ok('ACCOUNTがnullになる', E.ACCOUNT === null, E.ACCOUNT);

  // --- guest/offline backend with no deleteCloudData: never throws, still wipes local data ---
  storageCalls.removed = [];
  api.STATE = E.DEFAULT_STATE();
  E.setAccount({ uid: 'u2', playerId: 'WXYZ-5678-IJKL', name: 'ゲスト', provider: 'guest' });
  storageData[E.saveKeyFor('u2')] = JSON.stringify({ dummy: true });
  global.window.__authBackend = { kind: 'local' }; // no deleteCloudData, no signOut

  let threw = false;
  try{ await E.deleteAllData(); }catch(e){ threw = true; }
  ok('deleteCloudDataが無いバックエンドでも例外を投げない', !threw);
  ok('この場合もローカルのセーブは削除される', storageCalls.removed.includes(E.saveKeyFor('u2')), storageCalls.removed);
  ok('この場合もACCOUNTはnullになる', E.ACCOUNT === null, E.ACCOUNT);

  // --- cloud delete failing (network error) still must not block the local wipe ---
  storageCalls.removed = [];
  api.STATE = E.DEFAULT_STATE();
  E.setAccount({ uid: 'u3', playerId: 'MNOP-9012-QRST', name: 'テスター3', provider: 'email' });
  storageData[E.saveKeyFor('u3')] = JSON.stringify({ dummy: true });
  global.window.__authBackend = {
    kind: 'mock',
    async deleteCloudData(){ throw new Error('network down'); },
    async signOut(){},
  };
  threw = false;
  try{ await E.deleteAllData(); }catch(e){ threw = true; }
  ok('クラウド削除が失敗しても例外を投げない(best-effort)', !threw);
  ok('クラウド削除が失敗してもローカルのセーブは削除される', storageCalls.removed.includes(E.saveKeyFor('u3')), storageCalls.removed);

  console.log('done');
})();
