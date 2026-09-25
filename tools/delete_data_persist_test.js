/* 回帰テスト: 「データを削除」したあとにデータが書き戻らないこと。

   元の不具合: deleteAllData が最後に signOutAccount を呼び、その signOutAccount が
   flushSave() を実行していた。flushSave は writeSave + cloudPush(true) なので、
   消した直後に同じ STATE をローカルとクラウドへ保存し直していた。
   結果、サインインし直すとクラウドから前のデータが戻ってくる。

   あわせて、予約済みの保存タイマー(saveState の 250ms / cloudPush のタイマー)が
   削除の途中で発火しても書き戻らないこと、サインイン前の匿名セーブも消えることを見る。

   使い方: python3 tools/extract.py してから  cd tools && node delete_data_persist_test.js */
/* harness.js は setTimeout を戦闘用の疑似キューに差し替える。この検証では実時間の
   タイマー(保存の250ms待ちなど)そのものを見たいので、本物を控えて読み込み後に戻す。 */
const realSetTimeout = global.setTimeout, realClearTimeout = global.clearTimeout;
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e = {
  get STATE(){ return STATE; }, set STATE(v){ STATE = v; },
  get ACCOUNT(){ return ACCOUNT; }, set ACCOUNT(v){ ACCOUNT = v; },
  get deletingData(){ return deletingData; },
  deleteAllData, writeSave, flushSave, cloudPush, saveState,
  storage, SAVE_KEY, saveKeyFor, DEFAULT_STATE,
  setBackend(b){ authBackend = () => b; },
};`);
global.setTimeout = realSetTimeout;
global.clearTimeout = realClearTimeout;
const E = global.__e;
const ok = (name, cond, info) => {
  console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
  if(!cond) process.exitCode = 1;
};

/* localStorage の代わりになる素朴な箱 */
const box = {};
E.storage.get = async k => (k in box ? { value: box[k] } : null);
E.storage.set = async (k, v) => { box[k] = v; };
E.storage.remove = async k => { delete box[k]; };

/* クラウドの代役。cloudSave が呼ばれたら記録する(=書き戻しが起きた証拠) */
let cloud = { saves: {}, deleted: [], saveCalls: 0 };
const backend = {
  signOut: async () => {},
  deleteCloudData: async uid => {
    cloud.deleted.push(uid);
    delete cloud.saves[uid];
    await new Promise(r => setTimeout(r, 0));   // 削除は通信なので一拍かかる
  },
  cloudSave: async (uid, payload) => { cloud.saveCalls++; cloud.saves[uid] = payload; return true; },
  cloudLoad: async uid => cloud.saves[uid] || null,
};
E.setBackend(backend);

const UID = 'u_test';
function seed(){
  box[E.saveKeyFor(UID)] = JSON.stringify({ marker: 'アカウントのセーブ' });
  box[E.SAVE_KEY] = JSON.stringify({ marker: 'サインイン前の匿名セーブ' });
  cloud = { saves: { [UID]: { marker: 'クラウドのセーブ', savedAt: 1 } }, deleted: [], saveCalls: 0 };
  E.ACCOUNT = { uid: UID, playerId: 'ABCD-1234' };
  E.STATE = Object.assign(E.DEFAULT_STATE(), { marker: 'いま遊んでいたデータ' });
}

(async () => {
  console.log('--- 1. 削除するとローカル・クラウドの両方が消える ---');
  seed();
  await E.deleteAllData();
  ok('アカウント別のセーブが消えている', !(E.saveKeyFor(UID) in box), Object.keys(box));
  ok('サインイン前の匿名セーブも消えている', !(E.SAVE_KEY in box), Object.keys(box));
  ok('クラウドの削除が呼ばれている', cloud.deleted.includes(UID), cloud.deleted);
  ok('クラウドにデータが残っていない', !cloud.saves[UID], cloud.saves);

  console.log('\n--- 2. 削除の最後のサインアウトで書き戻らない(元の不具合) ---');
  ok('削除中に cloudSave が一度も呼ばれていない', cloud.saveCalls === 0, { cloudSave: cloud.saveCalls });
  ok('STATE が null になっている', E.STATE === null);
  ok('削除フラグが戻っている', E.deletingData === false);

  console.log('\n--- 3. 予約済みの保存タイマーが途中で発火しても書き戻らない ---');
  seed();
  E.saveState();                 // 250ms 後に writeSave + cloudPush が走る予約
  const p = E.deleteAllData();   // 予約が生きているあいだに削除を始める
  await new Promise(r => setTimeout(r, 400));   // 予約時刻をまたぐ
  await p;
  ok('タイマーが発火してもローカルは消えたまま', !(E.saveKeyFor(UID) in box), Object.keys(box));
  ok('タイマーが発火してもクラウドは消えたまま', !cloud.saves[UID], cloud.saves);
  ok('cloudSave は呼ばれていない', cloud.saveCalls === 0, { cloudSave: cloud.saveCalls });

  console.log('\n--- 4. 削除後に保存を呼んでも復活しない ---');
  await E.writeSave();
  await E.flushSave();
  ok('writeSave/flushSave を呼んでもローカルは空', Object.keys(box).length === 0, Object.keys(box));
  ok('cloudSave は依然として呼ばれていない', cloud.saveCalls === 0, { cloudSave: cloud.saveCalls });

  console.log('\n--- 5. 削除が終わったあとは通常どおり保存できる ---');
  E.ACCOUNT = { uid: UID, playerId: 'ABCD-1234' };
  E.STATE = Object.assign(E.DEFAULT_STATE(), { marker: '新しく始めたデータ' });
  await E.writeSave();
  ok('新しいデータは保存できる', !!box[E.saveKeyFor(UID)]);

  console.log('\ndone');
})();
