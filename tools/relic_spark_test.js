/* regression test: 遺物ガチャにも「天井」(召喚ポイント交換)を追加した。キャラガチャと
   召喚ポイントを共有し(どちらを引いても貯まる)、RELIC_SPARK_POINTS(100)貯まると、
   現在ピックアップ中の専用遺物と交換できる(SPARK_POINTS=200のキャラ交換とは別枠で、
   同じSTATE.summonPointsから引き落とす)。 */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e = {
  get STATE(){ return STATE }, set STATE(v){ STATE = v }, DEFAULT_STATE, RELICS, MON_BY_ID,
  pullOne, pullRelicOne, exchangeSpark, exchangeRelicSpark, currentBanner, exclusiveRelicForMon,
  SPARK_POINTS, RELIC_SPARK_POINTS,
};`);
const E = global.__e;
const ok = (name, cond, info) => console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));

api.STATE = E.DEFAULT_STATE();
const pickupRelic = E.exclusiveRelicForMon(E.currentBanner().pickup);
ok('前提: デフォルトバナーのピックアップキャラに専用遺物がある', !!pickupRelic, pickupRelic && pickupRelic.id);

// --- 1. 召喚ポイントはキャラガチャ・遺物ガチャの両方のpullで貯まる(共有プール) ---
ok('初期召喚ポイントは0', api.STATE.summonPoints === 0);
E.pullOne(1);
ok('キャラガチャを1回引くと召喚ポイントが1貯まる', api.STATE.summonPoints === 1, api.STATE.summonPoints);
E.pullRelicOne();
ok('遺物ガチャを1回引いても同じ召喚ポイントが貯まる(共有)', api.STATE.summonPoints === 2, api.STATE.summonPoints);

// --- 2. RELIC_SPARK_POINTS(100)貯まるまでは交換できない ---
api.STATE.summonPoints = E.RELIC_SPARK_POINTS - 1;
const before = JSON.stringify(api.STATE.relics);
E.exchangeRelicSpark();
ok('100未満では交換できない(ポイントも遺物所持状況も変化なし)', api.STATE.summonPoints === E.RELIC_SPARK_POINTS - 1 && JSON.stringify(api.STATE.relics) === before);

// --- 3. 100貯まると、現在ピックアップ中の専用遺物と交換できる ---
api.STATE.summonPoints = E.RELIC_SPARK_POINTS;
E.exchangeRelicSpark();
ok('100ポイントでピックアップ専用遺物と交換できる(新規入手)', !!api.STATE.relics[pickupRelic.id], api.STATE.relics[pickupRelic.id]);
ok('交換後は召喚ポイントが0になる(100消費)', api.STATE.summonPoints === 0, api.STATE.summonPoints);

// --- 4. 2回目の交換(所持済み)は凸(dupe)が増える ---
api.STATE.summonPoints = E.RELIC_SPARK_POINTS;
const dupeBefore = api.STATE.relics[pickupRelic.id].dupe || 0;
E.exchangeRelicSpark();
ok('所持済みの専用遺物と交換すると凸(dupe)が増える(新規付与ではなくならない)', api.STATE.relics[pickupRelic.id].dupe === dupeBefore + 1, api.STATE.relics[pickupRelic.id].dupe);

// --- 5. RELIC_SPARK_POINTS(100)とSPARK_POINTS(200)は同じ共有プールから引き落とされ、
//     遺物交換で使った分もキャラ交換用のポイントとしてちゃんと減っている(別枠のカウンタではない) ---
api.STATE.summonPoints = E.SPARK_POINTS + E.RELIC_SPARK_POINTS; // 両方に十分な300ポイント
E.exchangeRelicSpark(); // -100
ok('遺物交換後、キャラ交換分(200)がまだ残っている', api.STATE.summonPoints === E.SPARK_POINTS, api.STATE.summonPoints);
E.exchangeSpark(); // -200
ok('続けてキャラ交換もでき、同じプールから正しく引き落とされる', api.STATE.summonPoints === 0, api.STATE.summonPoints);

console.log('done');
