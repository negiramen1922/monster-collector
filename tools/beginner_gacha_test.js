/* regression test: 初心者ガチャ(通常の10連と同じ消費の10連を3回まで、1アカウント限り)。
   3回(30連)の中に★5が1体も出なければ、3回目の最後の枠を★5全体からランダムに確定させる
   (現在のバナーのピックアップには依存しない)。 */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e = {
  get STATE(){ return STATE }, set STATE(v){ STATE = v }, DEFAULT_STATE, MONSTERS,
  doBeginnerGacha, pullOneForced, normalizeState,
  BEGINNER_GACHA_COST, BEGINNER_GACHA_PULLS, BEGINNER_GACHA_ROUNDS, PULL10_COST,
};`);
const E = global.__e;
const ok = (name, cond, info) => console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
const star5Count = () => Object.keys(api.STATE.owned).filter(id => E.MONSTERS.find(m => m.id === id).rarity === 5).length;

// --- 1. 1回あたりは通常の10連と同じ(割引なし)、10連を3回 ---
ok('1回のコストは通常の10連と同じ', E.BEGINNER_GACHA_COST === E.PULL10_COST, E.BEGINNER_GACHA_COST);
ok('1回10連・3回まで', E.BEGINNER_GACHA_PULLS === 10 && E.BEGINNER_GACHA_ROUNDS === 3);

// --- 2. 初期状態・旧セーブ ---
api.STATE = E.DEFAULT_STATE();
ok('初期状態は未使用・0回', api.STATE.beginnerGachaDone === false && api.STATE.beginnerGachaCount === 0);
delete api.STATE.beginnerGachaDone; delete api.STATE.beginnerGachaCount; delete api.STATE.beginnerGachaHad5;
E.normalizeState();
ok('旧セーブ(項目なし)は0回として補完', api.STATE.beginnerGachaDone === false && api.STATE.beginnerGachaCount === 0);
api.STATE = E.DEFAULT_STATE(); api.STATE.beginnerGachaDone = true; delete api.STATE.beginnerGachaCount; delete api.STATE.beginnerGachaHad5;
E.normalizeState();
ok('旧版で30連を引き終えた人は3回済み扱い', api.STATE.beginnerGachaCount === 3);

// --- 3. 結晶が足りない場合は実行されない ---
api.STATE = E.DEFAULT_STATE();
api.STATE.crystals = E.BEGINNER_GACHA_COST - 1;
E.doBeginnerGacha();
ok('結晶不足だと消費されず回数も増えない', api.STATE.crystals === E.BEGINNER_GACHA_COST - 1 && api.STATE.beginnerGachaCount === 0);

// --- 4. 1回ずつ10連を引ける。3回で終わり ---
api.STATE = E.DEFAULT_STATE();
api.STATE.crystals = E.BEGINNER_GACHA_COST * 5;
E.doBeginnerGacha();
ok('1回目: 10連分の結晶だけ消費し、まだ終わらない', api.STATE.crystals === E.BEGINNER_GACHA_COST * 4 && api.STATE.beginnerGachaCount === 1 && !api.STATE.beginnerGachaDone);
E.doBeginnerGacha(); E.doBeginnerGacha();
ok('3回目で利用済みになる', api.STATE.beginnerGachaCount === 3 && api.STATE.beginnerGachaDone === true && api.STATE.crystals === E.BEGINNER_GACHA_COST * 2);
E.doBeginnerGacha();
ok('4回目は引けない', api.STATE.crystals === E.BEGINNER_GACHA_COST * 2 && api.STATE.beginnerGachaCount === 3);

// --- 5. pullOneForcedの帳簿処理 ---
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

// --- 6. 3回引き終えると必ず★5が1体以上いる ---
let allHaveStar5 = true;
for(let trial = 0; trial < 30; trial++){
  api.STATE = E.DEFAULT_STATE();
  api.STATE.crystals = E.BEGINNER_GACHA_COST * 3;
  for(let r = 0; r < 3; r++) E.doBeginnerGacha();
  if(star5Count() === 0) allHaveStar5 = false;
}
ok('3回引き終えると30回試行して毎回★5が最低1体いる(確定枠が機能している)', allHaveStar5);

// --- 7. 1・2回目で★5が出ていれば、3回目の確定は付かない(★5済みフラグ) ---
api.STATE = E.DEFAULT_STATE();
api.STATE.crystals = E.BEGINNER_GACHA_COST;
api.STATE.beginnerGachaCount = 2; api.STATE.beginnerGachaHad5 = true;
const origRandom = Math.random; Math.random = () => 0.001;   // ★5が自然に出ない乱数
E.doBeginnerGacha();
Math.random = origRandom;
ok('★5獲得済みなら3回目の最後の枠は確定にならない', star5Count() === 0);
api.STATE = E.DEFAULT_STATE();
api.STATE.crystals = E.BEGINNER_GACHA_COST;
api.STATE.beginnerGachaCount = 2; api.STATE.beginnerGachaHad5 = false;
Math.random = () => 0.001;
E.doBeginnerGacha();
Math.random = origRandom;
ok('★5未獲得なら3回目の最後の枠が★5確定', star5Count() === 1);

console.log('done');
