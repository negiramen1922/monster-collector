/* regression test: 初心者ガチャ(通常の10連×3回分の消費で30連、1アカウント1回限り)。
   30連の中に★5が1体も出なければ、最後の枠を★5全体からランダムに確定させる
   (現在のバナーのピックアップには依存しない)。 */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e = {
  get STATE(){ return STATE }, set STATE(v){ STATE = v }, DEFAULT_STATE, MONSTERS,
  doBeginnerGacha, pullOneForced, normalizeState,
  BEGINNER_GACHA_COST, BEGINNER_GACHA_PULLS, PULL10_COST,
};`);
const E = global.__e;
const ok = (name, cond, info) => console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));

// --- 1. コストは通常の10連×3(割引なし) ---
ok('BEGINNER_GACHA_COSTは10連コスト×3', E.BEGINNER_GACHA_COST === E.PULL10_COST * 3, E.BEGINNER_GACHA_COST);
ok('BEGINNER_GACHA_PULLSは30', E.BEGINNER_GACHA_PULLS === 30);

// --- 2. 初期状態はbeginnerGachaDoneがfalse ---
api.STATE = E.DEFAULT_STATE();
ok('初期状態でbeginnerGachaDoneがfalse', api.STATE.beginnerGachaDone === false);
delete api.STATE.beginnerGachaDone;
E.normalizeState();
ok('旧セーブ(beginnerGachaDoneなし)はnormalizeStateでfalse補完される', api.STATE.beginnerGachaDone === false);

// --- 3. 結晶が足りない場合は実行されない ---
api.STATE = E.DEFAULT_STATE();
api.STATE.crystals = E.BEGINNER_GACHA_COST - 1;
E.doBeginnerGacha();
ok('結晶不足だと消費されない', api.STATE.crystals === E.BEGINNER_GACHA_COST - 1);
ok('結晶不足だとbeginnerGachaDoneのままfalse', api.STATE.beginnerGachaDone === false);

// --- 4. 正常に30連実行できる。ちょうどコスト分だけ消費し、1回限りフラグが立つ ---
api.STATE = E.DEFAULT_STATE();
api.STATE.crystals = E.BEGINNER_GACHA_COST;
E.doBeginnerGacha();
ok('コスト分の結晶が消費される', api.STATE.crystals === 0);
ok('beginnerGachaDoneがtrueになる', api.STATE.beginnerGachaDone === true);
ok('所持モンスター数が増えている(30連分)', Object.keys(api.STATE.owned).length >= 1);

// --- 5. 2回目は実行できない(1アカウント1回限り) ---
api.STATE.crystals = E.BEGINNER_GACHA_COST * 5;
const before = api.STATE.crystals;
E.doBeginnerGacha();
ok('既に利用済みなら再実行しても結晶は消費されない', api.STATE.crystals === before);

// --- 6. ★5が1体も自然に出なければ、最後の枠が★5全体からランダムに確定する ---
// pullOneForcedで直接★5を付与できることを確認(帳簿処理: pity解消・ポイント・万能ソウル)
api.STATE = E.DEFAULT_STATE();
const star5 = E.MONSTERS.find(m => m.rarity === 5);
api.STATE.pitySinceRare = 12;
const beforePoints = api.STATE.summonPoints;
const beforeUniversal = api.STATE.universalSouls;
const res = E.pullOneForced(star5);
ok('pullOneForcedは指定したモンスターを返す', res.mon.id === star5.id);
ok('pullOneForcedはpitySinceRareをリセットする', api.STATE.pitySinceRare === 0);
ok('pullOneForcedはsummonPointsを+1する', api.STATE.summonPoints === beforePoints + 1);
ok('pullOneForcedは万能ソウルを加算する', api.STATE.universalSouls > beforeUniversal);

// --- 7. 統計的検証: 30連を多数回実行し、必ず★5が1体以上含まれることを確認 ---
let allHaveStar5 = true;
for(let trial = 0; trial < 30; trial++){
  api.STATE = E.DEFAULT_STATE();
  api.STATE.crystals = E.BEGINNER_GACHA_COST;
  // pity/確率だけでは毎回★5が出るとは限らないため、doBeginnerGacha内部の結果を
  // 直接見るためownedの中に★5が1体以上含まれているかで判定する
  E.doBeginnerGacha();
  const has5 = Object.keys(api.STATE.owned).some(id => E.MONSTERS.find(m => m.id === id).rarity === 5);
  if(!has5) allHaveStar5 = false;
}
ok('30連を30回試行して毎回★5が最低1体は含まれる(確定枠が機能している)', allHaveStar5);

console.log('done');
