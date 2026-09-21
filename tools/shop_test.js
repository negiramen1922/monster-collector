/* ad-hoc check for the shop (ゴールドショップ / PVPポイントショップ): purchase success,
   insufficient funds, already-bought-today, the daily reset, the daily sale discount,
   and that the PVP-points shop actually sells relic_core_2/3 (closing the progression gap
   where those tiers previously had no acquisition source anywhere in the game). */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e = {
  get STATE(){ return STATE }, set STATE(v){ STATE = v }, DEFAULT_STATE,
  buyShopItem, shopBought, shopDailyState, todaysSaleSku, shopGoldPrice,
  SHOP_GOLD_ITEMS, SHOP_PVP_ITEMS,
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

console.log('done');
