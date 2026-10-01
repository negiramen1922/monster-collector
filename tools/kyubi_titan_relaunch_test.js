/* 九尾・タイタンの再開催(α0.3.010): 10/7まで延長 / 同時ピックアップ★4 / EXのショップ枠・ミッション
   使い方: cd tools && node kyubi_titan_relaunch_test.js */
const load = require('./harness.js');
const api = load('game.js', s => s + `;global.__e={
  EVENTS, MONSTERS, MON_BY_ID, eventShopItems, eventMissions, EVENT_TITLES, TITLES, NOTICES, UPDATE_LOG,
  pickMonsterOfRarity, currentBanner, PICKUP_SHARE, RARITY_WEIGHTS, EVENT_BONUS,
  featuredOf, exStagesOf, perksOf, addonOpen, EVENT_ADDON_AT,
  exMobSoulRate, DEFAULT_STATE, get STATE(){ return STATE }, set STATE(v){ STATE = v },
  get gachaBannerKey(){ return gachaBannerKey }, set gachaBannerKey(v){ gachaBannerKey = v },
};`);
const E = global.__e;
/* 追加ぶん(EX・同時ピックアップ★4・星刻)は EVENT_ADDON_AT から開く。
   テストは「開いたあと」の時計で回し、最後に「開く前」も1度だけ見る */
const realNow = Date.now;
const atTime = iso => { Date.now = () => new Date(iso).getTime(); };
atTime('2026-10-02T12:00:00+09:00');
let ng = 0;
const ok = (n, c, i) => { console.log((c ? '✅' : '❌') + ' ' + n + (i !== undefined ? '  ' + JSON.stringify(i) : '')); if(!c) ng++; };
E.STATE = E.DEFAULT_STATE();
const ev = k => E.EVENTS.find(e => e.key === k);
const SUBS = { ev_kyubi: ['m170', 'm150'], ev_titan: ['m144', 'm53'] };

console.log('--- 開催期間 ---');
['ev_kyubi', 'ev_titan'].forEach(k => {
  ok(`${k}: 10/7 23:59 まで`, ev(k).endAt === '2026-10-07T23:59:59+09:00', ev(k).endAt);
});

console.log('\n--- 同時ピックアップの★4 ---');
['ev_kyubi', 'ev_titan'].forEach(k => {
  const e = ev(k);
  const subs = (e.featured || []).filter(id => id !== e.pickup);
  ok(`${k}: ★4が2体`, JSON.stringify(subs) === JSON.stringify(SUBS[k]), subs.map(id => E.MON_BY_ID[id].name));
  ok(`${k}: 2体とも★4`, subs.every(id => E.MON_BY_ID[id].rarity === 4), subs.map(id => E.MON_BY_ID[id].rarity));
  ok(`${k}: 主役は featured の先頭`, e.featured[0] === e.pickup);
});

console.log('\n--- ガチャ: ★4のピックアップが確率に効く ---');
{
  // 時計は先頭で公開後に寄せてある
  ['ev_kyubi', 'ev_titan'].forEach(k => {
    E.gachaBannerKey = k;
    const b = E.currentBanner();
    ok(`${k}: バナーが切り替わる`, b.key === k, b.key);
    const n = 30000, got = {};
    for(let i = 0; i < n; i++){ const m = E.pickMonsterOfRarity(4); got[m.id] = (got[m.id] || 0) + 1; }
    const hit = SUBS[k].reduce((a, id) => a + (got[id] || 0), 0) / n;
    ok(`${k}: ★4のうち約${E.PICKUP_SHARE * 100}%がピックアップ`, Math.abs(hit - E.PICKUP_SHARE) < 0.02,
       { 実測: +(hit * 100).toFixed(1), 内訳: SUBS[k].map(id => E.MON_BY_ID[id].name + ':' + (100 * got[id] / n).toFixed(1)) });
    // ピックアップ以外の★4も出る(外れたぶんが主役に吸われていないこと)
    const others = E.MONSTERS.filter(m => m.rarity === 4 && !SUBS[k].includes(m.id));
    ok(`${k}: 他の★4も出る`, others.filter(m => got[m.id]).length >= others.length - 2,
       others.filter(m => !got[m.id]).map(m => m.name));
  });
  E.gachaBannerKey = null;
}

console.log('\n--- イベントショップ ---');
['ev_kyubi', 'ev_titan'].forEach(k => {
  const items = E.eventShopItems(ev(k));
  const souls = items.filter(x => /^soul_sub/.test(x.sku));
  ok(`${k}: ★4のソウルが1体ずつ並ぶ`, souls.length === 2, souls.map(x => x.name));
  ok(`${k}: 各60メダル・20個・上限10回`, souls.every(x => x.price === 60 && x.qty === '20個' && x.limit === 10),
     souls.map(x => [x.price, x.qty, x.limit]));
  ok(`${k}: 主役のソウルは150メダル・10個・上限30回(econV2)`,
     items.some(x => x.sku === 'soul_pick' && x.price === 150 && x.limit === 30));
  ok(`${k}: ワザ素材BOX TierIV がある`, items.some(x => x.sku === 'box4'));
});

console.log('\n--- イベントミッション ---');
['ev_kyubi', 'ev_titan'].forEach(k => {
  const ms = E.eventMissions(ev(k)).filter(m => m.kind === 'ex');
  ok(`${k}: EXミッションが3つ`, ms.length === 3, ms.map(m => m.id));
  ok(`${k}: EX3に称号が付く`, !!ms.find(m => m.id === 'ex3').title, ms.find(m => m.id === 'ex3').title);
  const cry = ms.map(m => (m.reward.find(r => r.type === 'crystal') || {}).n);
  ok(`${k}: 星結晶は 500 / 1,000 / 2,000`, JSON.stringify(cry) === '[500,1000,2000]', cry);
  ok(`${k}: 称号が登録されている`, !!E.TITLES[ms.find(m => m.id === 'ex3').title],
     ms.find(m => m.id === 'ex3').title);
  ok(`${k}: ステージ10と★30の称号も戻っている`, !!E.EVENT_TITLES[k].deep && !!E.EVENT_TITLES[k].star);
});

console.log('\n--- EXで★4のソウルが出る ---');
['ev_kyubi', 'ev_titan'].forEach(k => {
  const e = ev(k);
  SUBS[k].forEach(id => {
    const rates = [1, 2, 3].map(n => E.exMobSoulRate(e, n, E.MON_BY_ID[id]));
    ok(`${k}: ${E.MON_BY_ID[id].name} は EX3で100%`, rates[2] === 1, rates);
    ok(`${k}: ${E.MON_BY_ID[id].name} は段が上がるほど出やすい`, rates[0] < rates[1] && rates[1] < rates[2], rates);
  });
});

console.log('\n--- お知らせ ---');
{
  const n = E.NOTICES[0];
  ok('先頭が今回のお知らせ', /EXステージ/.test(n.title), n.title);
  ok('立ち絵に6体ならぶ', (n.art || []).length === 6, n.art);
  ok('立ち絵が実在する', (n.art || []).every(id => E.MON_BY_ID[id]), (n.art || []).map(id => E.MON_BY_ID[id] && E.MON_BY_ID[id].name));
  ok('本文に 10/7 が入っている', /10\/7/.test(n.body));
  ok('本文に牛鬼が入っている', /牛鬼/.test(n.body));
  ok('お知らせのIDが重複していない', new Set(E.NOTICES.map(x => x.id)).size === E.NOTICES.length);
  ok('アップデートのIDが重複していない', new Set(E.UPDATE_LOG.map(x => x.id)).size === E.UPDATE_LOG.length);
}

console.log('\n--- 公開時刻(10/1 16:00)まで出ない ---');
{
  atTime('2026-10-01T15:59:00+09:00');
  ['ev_kyubi', 'ev_titan'].forEach(k => {
    const e = ev(k);
    ok(`${k}: 16時前はEXが出ない`, E.exStagesOf(e).length === 0, E.exStagesOf(e).length);
    ok(`${k}: 16時前は抱き合わせ★4が出ない`, E.featuredOf(e).filter(id => id !== e.pickup).length === 0, E.featuredOf(e));
    ok(`${k}: 16時前はショップのソウル枠が出ない`, E.eventShopItems(e).filter(x => /^soul_sub/.test(x.sku)).length === 0);
    ok(`${k}: 16時前はEXミッションが出ない`, E.eventMissions(e).filter(m => m.kind === 'ex').length === 0);
    ok(`${k}: 16時前も主役のソウルは買える`, E.eventShopItems(e).some(x => x.sku === 'soul_pick'));
  });
  SUBS.ev_kyubi.concat(SUBS.ev_titan).forEach(id => {
    ok(`${E.MON_BY_ID[id].name}: 16時前は星刻が出ない`, E.perksOf(id, 10).length === 0, E.perksOf(id, 10).length);
  });
  atTime('2026-10-01T16:00:00+09:00');
  ok('16時ちょうどで開く', E.exStagesOf(ev('ev_kyubi')).length === 3 && E.perksOf('m170', 10).length === 5);
  Date.now = realNow;
}

console.log(ng ? `\n${ng}件失敗` : '\nすべて通過');
process.exit(ng ? 1 : 0);
