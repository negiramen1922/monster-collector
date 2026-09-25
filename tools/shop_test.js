/* ad-hoc check for the shop (ゴールドショップ / PVPポイントショップ): purchase success,
   insufficient funds, already-bought-today, the daily reset, the daily sale discount,
   and that the PVP-points shop actually sells relic_core_2/3 (closing the progression gap
   where those tiers previously had no acquisition source anywhere in the game). */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e = {
  get STATE(){ return STATE }, set STATE(v){ STATE = v }, DEFAULT_STATE,
  buyShopItem, shopBought, shopDailyState, todaysSaleSku, shopGoldPrice, shopSaleMap, refreshShop, shopRefreshCost, SHOP_REFRESH_COSTS,
  SHOP_GOLD_ITEMS, SHOP_PVP_ITEMS, SHOP_CRYSTAL_ITEMS, buyCrystalItem,
  pvpDailyMax, pvpChallengesLeft, ensurePvpDaily, PVP_DAILY_MAX,
  getItem, addGold, addItem, currentDayKey,
};`);
const E = global.__e;
const ok = (name, cond, info) => console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));

api.STATE = E.DEFAULT_STATE();
const S = api.STATE;

// --- gold shop: successful purchase ---
S.gold = 100000;
const scrapDef = E.SHOP_GOLD_ITEMS.find(x => x.sku === 'scrap');
const scrapPrice = E.shopGoldPrice(scrapDef);
const goldBefore = S.gold;
E.buyShopItem('gold', 'scrap');
ok('ゴールドショップ: 購入するとアイテムが増える', E.getItem('relic_scrap') === scrapDef.qty, E.getItem('relic_scrap'));
ok('ゴールドショップ: 購入するとゴールドが減る', S.gold === goldBefore - scrapPrice, [goldBefore, S.gold, scrapPrice]);
ok('ゴールドショップ: 購入済みフラグが立つ', E.shopBought('scrap') === true);

// --- already bought today: second purchase is rejected, no double-grant ---
const scrapAfterFirst = E.getItem('relic_scrap');
const goldAfterFirst = S.gold;
E.buyShopItem('gold', 'scrap');
ok('同じ商品は1日1回まで(2回目は弾かれる)', E.getItem('relic_scrap') === scrapAfterFirst && S.gold === goldAfterFirst);

// --- insufficient funds: never grants, never marks bought ---
const core1Def = E.SHOP_GOLD_ITEMS.find(x => x.sku === 'core1');
S.gold = 0;
E.buyShopItem('gold', 'core1');
ok('ゴールド不足だと購入できない', E.getItem('relic_core_1') === 0 && E.shopBought('core1') === false, E.getItem('relic_core_1'));

// --- daily sale: one SKU is discounted, matches what buyShopItem actually charges ---
const saleSku = E.todaysSaleSku();
const saleDef = E.SHOP_GOLD_ITEMS.find(x => x.sku === saleSku);
const discounted = E.shopGoldPrice(saleDef);
ok('本日の特売品は定価より安い', discounted < saleDef.price, [saleSku, saleDef.price, discounted]);
S.gold = 1e9;
const goldBeforeSale = S.gold;
E.buyShopItem('gold', saleSku);
ok('特売価格が実際に請求される', S.gold === goldBeforeSale - discounted, [goldBeforeSale, S.gold, discounted]);

// --- daily reset: an old shopDaily key clears the bought map ---
E.shopDailyState().key = '2000-1-1';
const st = E.shopDailyState();
ok('日付が変わると購入済みフラグがリセットされる', st.key === E.currentDayKey() && Object.keys(st.bought).length === 0, st);

// --- 特売は3品(5割・4割・3割引) ---
const sm = E.shopSaleMap();
ok('特売は3品で、5割・4割・3割引', Object.keys(sm).length === 3 && JSON.stringify(Object.values(sm).sort()) === JSON.stringify([0.3, 0.4, 0.5]), sm);
ok('特売の選び方は同じ日・同じ更新回数なら変わらない', JSON.stringify(E.shopSaleMap()) === JSON.stringify(sm));

// --- ショップ更新: 50→100→150石、1日3回まで。購入済みが消えて、特売が入れ替わる ---
S.gold = 1e9;
E.buyShopItem('gold', 'exp1');
S.crystals = 1000;
const saleSets = [JSON.stringify(E.shopSaleMap())];
ok('1回目の更新は50石', E.shopRefreshCost() === 50);
E.refreshShop();
ok('更新すると50石減り、購入済みの商品がまた買える', S.crystals === 950 && !E.shopBought('exp1'), [S.crystals, E.shopBought('exp1')]);
saleSets.push(JSON.stringify(E.shopSaleMap()));
ok('2回目は100石', E.shopRefreshCost() === 100);
E.refreshShop(); saleSets.push(JSON.stringify(E.shopSaleMap()));
ok('3回目は150石', E.shopRefreshCost() === 150);
E.refreshShop(); saleSets.push(JSON.stringify(E.shopSaleMap()));
ok('3回で合計300石', S.crystals === 700, S.crystals);
E.refreshShop();
ok('4回目はできない(石も減らない)', S.crystals === 700 && E.shopRefreshCost() === null);
ok('更新で特売品が入れ替わる(4通りのうち2通り以上)', new Set(saleSets).size >= 2, saleSets);
S.crystals = 10; E.shopDailyState().key = '2000-1-1';
ok('日付が変わると更新回数もリセット', E.shopRefreshCost() === 50);
E.refreshShop();
ok('石が足りないと更新できない', S.crystals === 10 && E.shopDailyState().refresh === 0);
// 各日の特売がいろいろな商品に散らばる(いつも同じ品にならない)
const seen = new Set();
for(let d = 1; d <= 30; d++) Object.keys(E.shopSaleMap({ key: `2026-10-${d}`, refresh: 0 })).forEach(k => seen.add(k));
ok('30日で特売になる商品が偏らない(8種類以上)', seen.size >= 8, [...seen]);

// --- PVP points shop: relic_core_1/2/3 are all purchasable (closes the core2/3 acquisition gap) ---
S.pvpPoints = 10000;
['pvp_core1', 'pvp_core2', 'pvp_core3'].forEach(sku => {
  const def = E.SHOP_PVP_ITEMS.find(x => x.sku === sku);
  const before = E.getItem(def.itemKey);
  const ptsBefore = S.pvpPoints;
  E.buyShopItem('pvp', sku);
  ok(`PVPショップ: ${def.itemKey} を購入できる`, E.getItem(def.itemKey) === before + def.qty && S.pvpPoints === ptsBefore - def.price,
    [def.itemKey, E.getItem(def.itemKey), S.pvpPoints]);
});

// --- PVP points shop: insufficient points never grants ---
S.pvpPoints = 0;
const before3 = E.getItem('relic_core_3');
E.buyShopItem('pvp', 'pvp_core3');
ok('PVPポイント不足だと購入できない', E.getItem('relic_core_3') === before3);

// --- crystal shop: stamina refill (100石 -> スタミナ+150) ---
S.crystals = 1000;
S.stamina = 100;
E.buyCrystalItem('stamina');
ok('水晶でスタミナを回復できる(100石で+150)', S.stamina === 250 && S.crystals === 900, [S.stamina, S.crystals]);

// --- crystal shop: repeatable, not capped to 1/day like the gold/PVP shops ---
E.buyCrystalItem('stamina');
ok('水晶ショップは1日1回に制限されない(連続購入できる)', S.stamina === 400 && S.crystals === 800, [S.stamina, S.crystals]);

// --- crystal shop: PVP挑戦券 (180石 -> 本日の挑戦回数+3) ---
S.pvpDaily = null; // force a fresh day so bonus starts at 0
const maxBefore = E.pvpDailyMax();
const leftBefore = E.pvpChallengesLeft();
E.buyCrystalItem('pvp_ticket');
ok('水晶でPVP挑戦券を購入すると本日の上限が+3される', E.pvpDailyMax() === maxBefore + 3 && E.pvpChallengesLeft() === leftBefore + 3 && S.crystals === 620,
  [E.pvpDailyMax(), E.pvpChallengesLeft(), S.crystals]);

// --- crystal shop: insufficient crystals never grants, never charges ---
S.crystals = 50;
const staminaBefore = S.stamina;
E.buyCrystalItem('stamina');
ok('水晶が足りないと購入できない', S.crystals === 50 && S.stamina === staminaBefore, [S.crystals, S.stamina]);

// --- PVPチケットのボーナスは日付が変わるとリセットされる(ensurePvpDailyが新しいキーで作り直す) ---
S.pvpDaily.key = '2000-1-1';
ok('日付が変わるとPVP挑戦券のボーナスもリセットされる', E.pvpDailyMax() === E.PVP_DAILY_MAX, E.pvpDailyMax());

console.log('done');
