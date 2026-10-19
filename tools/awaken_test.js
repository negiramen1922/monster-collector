// 覚醒結晶(レベルの上限を★から切り離す)。公開前は今までどおり、公開後は全員Lv300・壁で覚醒結晶。
// docs/提案資料/レベル上限と凸の切り離し.md
// 使い方: node tools/awaken_test.js
const load = require('./harness.js');
const api = load('game.js', s => s + ';global.__a={AWAKEN,awakenLive,levelCapOf,atWall,levelStop,awakenCost,breakWall,ensureAwakenMigration,promoteMonster,levelUpMonster,dungeonKinds,dungeonReward,dungeonStage,grantDungeonRewards,missionEntries,ensureWeekly,babelFloorReward,eventShopItems,EVENTS,getItem,addItem,DEFAULT_STATE,MON_BY_ID,MONSTERS,itemName,DUNGEONS,STAR_TABLE};');
const A = global.__a;
let bad = 0;
const ok = (name, cond, info) => { bad += cond ? 0 : 1; console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : '')); };
const ID5 = A.MONSTERS.find(m => m.rarity === 5).id, ID3 = A.MONSTERS.find(m => m.rarity === 3).id;
function fresh(){
  api.STATE = A.DEFAULT_STATE();
  api.STATE.gold = 1e9;
  api.STATE.owned[ID5] = { base: 5, star: 7, souls: 0, level: 200, exp: 0, wall: 180, skillLv: 1, ultLv: 1, passiveLv: 1 };
  api.STATE.owned[ID3] = { base: 3, star: 3, souls: 0, level: 100, exp: 0, wall: 50, skillLv: 1, ultLv: 1, passiveLv: 1 };
}
const RELEASE = A.AWAKEN.releaseAt;

console.log('--- 1. 公開前(今までどおり) ---');
A.AWAKEN.releaseAt = '2999-01-01T00:00:00+09:00';   // テストのために公開前にする
fresh();
ok('公開前は覚醒結晶の仕組みが動いていない', A.awakenLive() === false);
ok('レベル上限は★で決まる(★7→200)', A.levelCapOf(api.STATE.owned[ID5]) === 200);
ok('育成クエストに「限界の門」は出ない', !A.dungeonKinds().includes('awaken'));
ok('EXPの泉はそのまま(5段 TierIII×10)', A.dungeonReward('exp', 4).exp3 === 10);
ok('壁で覚醒結晶は要らない', A.awakenCost(api.STATE.owned[ID3], ID3) === 0);

console.log('--- 2. 公開後 ---');
A.AWAKEN.releaseAt = null;   // テストのために公開ずみにする
fresh();
ok('公開後はレベル上限が全員300', A.awakenLive() && A.levelCapOf(api.STATE.owned[ID5]) === 300 && A.levelCapOf(api.STATE.owned[ID3]) === 300);
A.ensureAwakenMigration();
ok('移すとき、いまの★の上限を「結晶なしの上限」として残す(★7→200・★3→100)',
   api.STATE.owned[ID5].awakenFree === 200 && api.STATE.owned[ID3].awakenFree === 100 && api.STATE.awakenMigrated === true);
// ★7(もとは★5)の子は Lv200 の壁まで結晶なし、Lv230 からは結晶が要る
const o5 = api.STATE.owned[ID5];
ok('Lv200の壁は結晶なし(公開前に★で開いていた)', A.atWall(o5) && A.awakenCost(o5, ID5) === 0);
A.breakWall(ID5);
ok('Lv200の壁はゴールドだけで越えられる', o5.wall === 200);
o5.level = 230;
ok('Lv230の壁は覚醒結晶60個', A.atWall(o5) && A.awakenCost(o5, ID5) === 60);
A.breakWall(ID5);
ok('結晶が足りないと越えられない', o5.wall === 200);
A.addItem('awaken', 100);
A.breakWall(ID5);
ok('結晶が足りれば越えられて、60個減る', o5.wall === 230 && A.getItem('awaken') === 40, A.getItem('awaken'));
o5.level = 280;
ok('Lv280の壁が増えている(結晶100個)', A.atWall(o5) && A.awakenCost(o5, ID5) === 100);
// ★3の子: もとの上限100。Lv120 から結晶
const o3 = api.STATE.owned[ID3];
o3.wall = 100; o3.level = 120;
ok('★3の子はLv120の壁で結晶10個', A.awakenCost(o3, ID3) === 10);
// 公開後に★を上げても「結晶なしの上限」は伸びない
o3.souls = 1e6;
A.promoteMonster(ID3);
ok('公開後に★を上げても、結晶なしの上限は伸びない(100のまま)', o3.star === 4 && o3.awakenFree === 100 && A.awakenCost(o3, ID3) === 10);
// 公開後に手に入れた子(awakenFree なし)は、もとのレアリティの最初の上限から
delete o3.awakenFree; o3.level = 120;
ok('公開後に手に入れた★3は、Lv120の壁から結晶', A.awakenCost(o3, ID3) === 10);
// Lv280 ちょうどで止まっていた子は、移すとき新しい壁を越えたことにする
api.STATE.awakenMigrated = false;
o5.level = 280; o5.wall = 260; o5.star = 10;
A.ensureAwakenMigration();
ok('Lv280ちょうどの子は、移すとき280の壁を越えたことにする', o5.wall === 280 && !A.atWall(o5));

console.log('--- 3. 集まる場所 ---');
fresh();
ok('育成クエストに「限界の門」が出る', A.dungeonKinds().includes('awaken'));
const before = A.getItem('awaken');
A.grantDungeonRewards(A.dungeonStage('awaken', 4));
ok('限界の門5段で覚醒結晶5個', A.getItem('awaken') - before === 5);
ok('EXPの泉: 5段は2倍(TierIII×20)、1段は1.5倍(TierI×15)', A.dungeonReward('exp', 4).exp3 === 20 && A.dungeonReward('exp', 0).exp1 === 15);
ok('ほかの育成クエストは変わらない(黄金の洞窟)', A.dungeonReward('gold', 4).gold === A.DUNGEONS.gold.rewards[4].gold);
const wk = A.missionEntries().find(e => e.key === 'w:w_dungeon');
ok('毎週ミッション「育成クエストを15回」に覚醒結晶10個', wk && wk.reward.some(r => r.key === 'awaken' && r.n === 10));
ok('バベルのボスの階に覚醒結晶(5階 10個・60階 20個)',
   A.babelFloorReward('bal', 5).some(r => r.key === 'awaken' && r.n === 10) && A.babelFloorReward('bal', 60).some(r => r.key === 'awaken' && r.n === 20) && !A.babelFloorReward('bal', 6).some(r => r.key === 'awaken'));
const ev = A.EVENTS.find(e => e.soulV3);
const sku = ev && A.eventShopItems(ev).find(x => x.sku === 'awaken');
ok('イベントショップに覚醒結晶(10個×5回)', sku && !sku.hide && sku.limit === 5 && sku.qty === '10個', sku && { price: sku.price });
ok('アイテム名は「覚醒結晶」', A.itemName('awaken') === '覚醒結晶');

A.AWAKEN.releaseAt = RELEASE;
console.log(bad ? `${bad}件 失敗` : 'すべて通過');
process.exit(bad ? 1 : 0);
