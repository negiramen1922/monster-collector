/* ソウルの入手ルートの検証(α0.3.003)。
   - 星刻の必要ソウルが「元レアリティ × いまの★」で決まり、レアリティが高いほど重いこと
   - EXの主役ソウルが EX3 だけ「50%で1〜3個」になること
   - EXの脇役ソウルが ev.exSouls を付けたイベントだけ出ること(公開ずみは据え置き)
   - イベントショップの主役が10個×20回、抱き合わせ★4が1体ずつの商品になっていること
   使い方: cd tools && node soul_route_test.js */
const load = require('./harness.js');
const api = load('game.js', s => s + `;global.__e={
  SOULS_TO_NEXT, soulsToNext, soulsToNextOf, MAX_STAR, MON_BY_ID, MONSTERS, DUP_SOULS, newOwned,
  EX_PICKUP_SOUL_RATE, EX_PICKUP_SOUL_RATE_V2, EX_PICKUP_SOUL_QTY, exPickupSoulRate, exPickupSoulQty, exPickupSoulQtyText,
  EX_MOB_SOUL_RATE, exMobSoulRate, eventShopItems, EVENTS, STAR_TABLE,
  get STATE(){ return STATE }, set STATE(v){ STATE = v }, DEFAULT_STATE,
};`);
const E = global.__e;
let ng = 0;
const ok = (name, cond, info) => { console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : '')); if(!cond) ng++; };
api.STATE = E.DEFAULT_STATE();

/* ---- 星刻の必要ソウル ---- */
const total = r => { let t = 0; for(let st = r; st < E.MAX_STAR; st++) t += E.soulsToNext({ star: st, base: r }, r); return t; };
const want = { 1: 1500, 2: 2100, 3: 3150, 4: 3900, 5: 4800 };
[1, 2, 3, 4, 5].forEach(r => ok(`★${r}の子の完凸は${want[r]}ソウル`, total(r) === want[r], total(r)));
ok('レアリティが高いほど完凸が重い(逆転が直っている)',
   [1, 2, 3, 4, 5].every((r, i, a) => i === 0 || total(a[i - 1]) < total(r)),
   [1, 2, 3, 4, 5].map(total));
ok('★10は星刻できない', E.soulsToNext({ star: E.MAX_STAR, base: 5 }, 5) === null);
// 最初の1段は今までと同じ(重くなるのは後半だけ)
[[1, 10], [2, 50], [4, 200], [5, 300]].forEach(([r, was]) =>
  ok(`★${r}→★${r + 1} は据え置きの${was}`, E.soulsToNext({ star: r, base: r }, r) === was, E.soulsToNext({ star: r, base: r }, r)));
ok('★3→★4 は 100 → 90 に下がる(重複3体ぶん)', E.soulsToNext({ star: 3, base: 3 }, 3) === 90, E.soulsToNext({ star: 3, base: 3 }, 3));
// ガチャの重複ソウルの倍数になっている(「重複◯体ぶん」と数えられる)
[3, 4, 5].forEach(r => {
  const steps = Object.values(E.SOULS_TO_NEXT[r]);
  ok(`★${r}の各段はガチャの重複(${E.DUP_SOULS[r]})の倍数`, steps.every(v => v % E.DUP_SOULS[r] === 0), steps);
});
ok('newOwned が元レアリティを持つ', E.newOwned(E.MON_BY_ID['m116']).base === 5, E.newOwned(E.MON_BY_ID['m116']).base);
// 元レアリティを渡さなくても、owned.base から引ける
ok('owned.base から引ける', E.soulsToNext({ star: 7, base: 5 }) === 1050, E.soulsToNext({ star: 7, base: 5 }));
ok('★1の子と★5の子で同じ★でも必要数が違う',
   E.soulsToNext({ star: 7, base: 1 }, 1) !== E.soulsToNext({ star: 7, base: 5 }, 5),
   [E.soulsToNext({ star: 7, base: 1 }, 1), E.soulsToNext({ star: 7, base: 5 }, 5)]);
// 古いセーブの移行(base が無い)
const S = api.STATE;
S.owned['m116'] = { star: 7, souls: 0, level: 1 };
ok('soulsToNextOf は図鑑から元レアリティを引く', E.soulsToNextOf('m116') === 1050, E.soulsToNextOf('m116'));

/* ---- EXの主役ソウル ---- */
const evNow = E.EVENTS.find(e => e.key === 'ev_abaddon');
const evV2 = { ...evNow, econV2: true, featured: [evNow.pickup, 'm157', 'm158'] };
const evOld = { ...evNow, econV2: false };   // 旧仕様の比較用
ok('いまのイベントはぜんぶ econV2(開催中のものにも入れた)', E.EVENTS.every(e => e.econV2), E.EVENTS.map(e => e.key + ':' + !!e.econV2));
ok('econV2 を外すと旧仕様に戻せる(20% / 50% / 100%)',
   [1, 2, 3].map(ex => E.exPickupSoulRate(evOld, ex)).join() === '0.2,0.5,1', [1, 2, 3].map(ex => E.exPickupSoulRate(evOld, ex)));
ok('econV2 のイベントは 20% / 50% / 50%',
   [1, 2, 3].map(ex => E.exPickupSoulRate(evV2, ex)).join() === '0.2,0.5,0.5', [1, 2, 3].map(ex => E.exPickupSoulRate(evV2, ex)));
ok('旧仕様は1個のまま', [1, 2, 3].every(ex => E.exPickupSoulQtyText(evOld, ex) === '1個'));
ok('econV2 はEX3だけ1〜3個',
   E.exPickupSoulQtyText(evV2, 1) === '1個' && E.exPickupSoulQtyText(evV2, 2) === '1個' && E.exPickupSoulQtyText(evV2, 3) === '1〜3個');
let sum = 0, N = 200000;
for(let i = 0; i < N; i++) sum += E.exPickupSoulQty(evV2, 3);
const avg = sum / N;
ok('EX3で落ちたときの平均が1.65個(1個50%/2個35%/3個15%)', Math.abs(avg - 1.65) < 0.02, avg.toFixed(3));
ok('EX3の1クリアあたりの期待は0.825個', Math.abs(0.5 * avg - 0.825) < 0.01, (0.5 * avg).toFixed(3));
[1, 2].forEach(ex => {
  let s2 = 0; for(let i = 0; i < 1000; i++) s2 += E.exPickupSoulQty(evV2, ex);
  ok(`econV2でもEX${ex}は1個`, s2 === 1000, s2 / 1000);
});
let s3 = 0; for(let i = 0; i < 1000; i++) s3 += E.exPickupSoulQty(evOld, 3);
ok('旧仕様のEX3は1個のまま', s3 === 1000, s3 / 1000);

/* ---- EXの脇役ソウル ---- */
const ev = evNow;
ok('econV2 を外すと脇役のソウルは出ない', E.exMobSoulRate(evOld, 3, E.MON_BY_ID['m17']) === 0);
ok('いまのイベントでは脇役のソウルが出る', E.exMobSoulRate(evNow, 3, E.MON_BY_ID['m17']) > 0, E.exMobSoulRate(evNow, 3, E.MON_BY_ID['m17']));
const fake = evV2;
ok('主役はこの表の対象外(専用の率で出す)', E.exMobSoulRate(fake, 3, E.MON_BY_ID[ev.pickup]) === 0);
ok('抱き合わせ★4はEX3で100%', E.exMobSoulRate(fake, 3, E.MON_BY_ID['m157']) === 1.00);
ok('抱き合わせ★4はEX1で40%・EX2で70%',
   E.exMobSoulRate(fake, 1, E.MON_BY_ID['m157']) === 0.40 && E.exMobSoulRate(fake, 2, E.MON_BY_ID['m157']) === 0.70);
const other4 = E.MONSTERS.find(m => m.rarity >= 4 && m.id !== ev.pickup && !fake.featured.includes(m.id));
ok('その他の★4以上はEX3で50%', E.exMobSoulRate(fake, 3, other4) === 0.50, other4.name);
const low = E.MONSTERS.find(m => m.rarity <= 3);
ok('★3以下はEX3で35%', E.exMobSoulRate(fake, 3, low) === 0.35, low.name);
// 主役より後に終わる(狙いどおりの順番)
const clears = (need, rate) => Math.ceil(need / rate);
const cPick = clears(total(5), 0.825), cSub = clears(total(4), 1.0), cOther = clears(total(4), 0.5), cLow = clears(total(3), 0.35);
ok('抱き合わせ★4は主役より先に終わる', cSub < cPick, { 抱き合わせ: cSub, 主役: cPick });
ok('その他★4・★3以下は主役より後に終わる', cOther > cPick && cLow > cPick, { その他4: cOther, 低レア: cLow, 主役: cPick });

/* ---- イベントショップ ---- */
const shopOld = E.eventShopItems(evOld);
const pickOld = shopOld.find(it => it.sku === 'soul_pick');
ok('econV2 を外すと主役20個×15回に戻る', pickOld.qty === '20個' && pickOld.limit === 15, [pickOld.qty, pickOld.limit]);
ok('econV2 を外すと★4はまとめた商品', shopOld.some(it => it.sku === 'soul_sub'));
const pickNow = E.eventShopItems(evNow).find(it => it.sku === 'soul_pick');
ok('いまのイベントは主役10個×30回', pickNow.qty === '10個' && pickNow.limit === 30, [pickNow.qty, pickNow.limit]);

const shopV2 = E.eventShopItems(evV2);
const pickV2 = shopV2.find(it => it.sku === 'soul_pick');
ok('econV2 は主役10個×30回(合計300個・総量は同じ)',
   pickV2.qty === '10個' && pickV2.limit === 30, [pickV2.qty, pickV2.limit, 10 * pickV2.limit]);
const subRows = shopV2.filter(it => /^soul_sub\d+$/.test(it.sku));
ok('econV2 は抱き合わせ★4を1体ずつ別の商品に', subRows.length === 2, subRows.map(r => r.name));
ok('  → 各60メダルで20個・上限10回', subRows.every(r => r.price === 60 && r.qty === '20個' && r.limit === 10), subRows.map(r => [r.name, r.price]));
ok('  → 名前にモンスター名が入る(どちらのソウルか分かる)', subRows.every(r => /のソウル$/.test(r.name)), subRows.map(r => r.name));
ok('  → まとめて配る古い商品は出ない', !shopV2.some(it => it.sku === 'soul_sub'));

console.log(ng ? `❌${ng}` : 'すべて通過');
