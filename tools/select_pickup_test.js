/* regression test: 常設(通常)ガチャ限定で、プレイヤーが属性ごとに選んだ★4/★5の
   セレクトピックアップが、対応するレアリティが出た時にPICKUP_SHAREの確率で優先的に出る。
   期間限定イベントバナーには影響しない(イベントの固定ピックアップは従来通り★5のみ)。 */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e = {
  get STATE(){ return STATE }, set STATE(v){ STATE = v }, DEFAULT_STATE, MONSTERS, MON_BY_ID,
  pickMonsterOfRarity, selectPickupPool, currentBanner, activeEvents, EVENTS,
  PICKUP_SHARE, DEFAULT_BANNER, normalizeState,
};`);
const E = global.__e;
const ok = (name, cond, info) => console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));

api.STATE = E.DEFAULT_STATE();

// --- 1. 初期状態はselectPickupが空オブジェクト ---
ok('初期状態でselectPickupが空オブジェクトになっている', JSON.stringify(api.STATE.selectPickup) === '{}');
delete api.STATE.selectPickup;
E.normalizeState();
ok('旧セーブ(selectPickupなし)はnormalizeStateで補完される', JSON.stringify(api.STATE.selectPickup) === '{}');

// このテスト実行時点では期間限定イベントが開催中(EVENTSの日付が広めに取ってあるため)。
// 常設バナーの挙動を検証するため、一時的にEVENTSを空にしてdefaultバナーへ切り替える。
const savedEvents = E.EVENTS.splice(0, E.EVENTS.length);
ok('EVENTSを空にするとcurrentBanner().keyがdefaultになる', E.currentBanner().key === 'default', E.currentBanner());

// --- 2. セレクトピックアップ未設定なら、★4/★5は完全ランダム(selectPickupPoolが空) ---
ok('未設定時はselectPickupPool(5)が空', E.selectPickupPool(5).length === 0);
ok('未設定時はselectPickupPool(4)が空', E.selectPickupPool(4).length === 0);

// --- 3. セレクトピックアップを設定すると、対応レアリティのロールで高確率に出る ---
const star5 = E.MONSTERS.find(m => m.rarity === 5);
const star4 = E.MONSTERS.find(m => m.rarity === 4);
api.STATE.selectPickup[star5.element] = star5.id;
api.STATE.selectPickup[star4.element] = star4.id;

ok('★5のセレクトピックアップを設定するとselectPickupPool(5)に入る', E.selectPickupPool(5).some(m => m.id === star5.id));
ok('★4のセレクトピックアップを設定するとselectPickupPool(4)に入る', E.selectPickupPool(4).some(m => m.id === star4.id));

let hitCount5 = 0, hitCount4 = 0;
const TRIALS = 4000;
for(let i = 0; i < TRIALS; i++){
  if(E.pickMonsterOfRarity(5).id === star5.id) hitCount5++;
  if(E.pickMonsterOfRarity(4).id === star4.id) hitCount4++;
}
const rate5 = hitCount5 / TRIALS;
const rate4 = hitCount4 / TRIALS;
// PICKUP_SHARE(0.5)の確率でこの1体が選ばれ、外れた場合も全体プールの中からランダムに
// 選ばれ得るので下限としてはPICKUP_SHAREよりやや高めになる。統計的なブレを見込んで幅を持たせる。
ok('★5のセレクトピックアップがおおよそPICKUP_SHARE以上の頻度で出る', rate5 >= E.PICKUP_SHARE - 0.05, rate5);
ok('★4のセレクトピックアップがおおよそPICKUP_SHARE以上の頻度で出る', rate4 >= E.PICKUP_SHARE - 0.05, rate4);

// --- 4. 期間限定イベントが動いている間は、セレクトピックアップの仕組みが★4に影響しない ---
E.EVENTS.push(...savedEvents);
ok('EVENTSを戻すとcurrentBanner().keyがevent系に戻る', E.currentBanner().key !== 'default', E.currentBanner().key);
const evBanner = E.currentBanner();
let star4HitDuringEvent = 0;
for(let i = 0; i < 500; i++){ if(E.pickMonsterOfRarity(4).id === star4.id) star4HitDuringEvent++; }
// セレクトピックアップに設定したstar4がイベント中の★4排出で特別扱いされていないか(通常のランダム
// 排出率=1/★4体数 程度に収まるはず。PICKUP_SHARE分ブーストされていれば明らかに高くなる)
const star4Pool = E.MONSTERS.filter(m => m.rarity === 4).length;
const expectedRandom = 1 / star4Pool;
ok('イベント中は★4のセレクトピックアップブーストが効かない(通常の排出率に近い)', star4HitDuringEvent / 500 < E.PICKUP_SHARE - 0.1, [star4HitDuringEvent / 500, expectedRandom]);
ok('イベント中のピックアップ(★5固定)はイベント自身のpickupのまま', evBanner.pickup !== star5.id || evBanner.key.startsWith('ev_'));

console.log('done');
