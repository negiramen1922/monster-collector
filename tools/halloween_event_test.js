/* ハロウィン(かぼちゃ畑の古屋敷)のイベント・EX・HELL・ガチャのピックアップ★3・遺物・お知らせのテスト。
   中身の正は docs/提案資料/次回イベント案_ハロウィン.md */
const load = require('./harness.js');
const api = load('game.js', s => s + `;global.__e={EVENTS,STAGE_BY_ID,EVENT_EX,eventShopItems,exStagesOf,FRAMES,HALLOWEEN_START_AT,HALLOWEEN_END_AT,activeEvents,RELICS,
  relicsOfStar,eventRelicOf,exclusiveRelicForMon,MON_BY_ID,MONSTER_PERKS,EVENT_MEDAL,EVENT_TITLES,EVENT_THEME,ITEM_ICON_LABEL,featuredOf,featured3Of,currentBanner,
  pickMonsterOfRarity,slimeGoldOf,sweepSpawned,NOTICES,liveNotices,DEFAULT_STATE};`);
const E = global.__e;
let fail = 0;
const ok = (c, m, v) => { console.log((c ? '✅' : '❌') + ' ' + m + (v !== undefined ? '  ' + JSON.stringify(v) : '')); if(!c) fail++; };
const realNow = Date.now;
const at = iso => { Date.now = () => new Date(iso).getTime(); };
const ev = E.EVENTS.find(e => e.key === 'ev_halloween');
const NEW = ['m190', 'm191', 'm192', 'm193', 'm194', 'm195'];

console.log('--- 日程 ---');
ok(!!ev && ev.soulV3 && ev.econV2 && ev.pickup === 'm190' && ev.element === 'fire' && ev.terrain === 'ruins' && ev.stageName === 'かぼちゃ畑の古屋敷', 'イベントの基本');
ok(ev.featured.join() === 'm190,m191,m192' && ev.featured3.join() === 'm193,m194,m195', '同時ピックアップ★4はミミック・ヴァンパイア、ピックアップ★3はパンプキン・フランケン・黒猫');
ok(ev.startAt === '2026-10-27T12:00:00+09:00' && ev.endAt === '2026-11-10T12:00:00+09:00', '開始 10/27 12:00・終了 11/10 12:00');
ok(NEW.every(id => E.MON_BY_ID[id].releaseAt === ev.startAt && E.MONSTER_PERKS[id].from === ev.startAt) && ['rel_devil_ember', 'rel_candy_basket'].every(id => E.RELICS[id].releaseAt === ev.startAt),
  '新キャラ・新遺物の releaseAt と星刻の from はイベントの startAt と同じ');
at('2026-10-27T12:00:01+09:00');
ok(E.activeEvents().map(e => e.key).sort().join() === 'ev_halloween,ev_slime', '10/27 12:00 を過ぎると、スライムパラダイスと2本同時(豊穣の女神は終わり)');
at('2026-11-10T12:00:01+09:00');
ok(!E.activeEvents().some(e => e.key === 'ev_halloween'), '終了日時のあとは出ない');
at('2026-10-29T12:00:00+09:00');

console.log('--- クエスト10層 ---');
ok(ev.stages.length === 10 && ev.stages.every(s => s.waves.map(w => w.length).join() === '3,3,4,4,5'), '10層・ウェーブは3・3・4・4・5体');
ok(ev.stages.every(s => s.waves[4].map(e => e.ref).join() === 'm190,m191,m194,m192,m193'), '最終ウェーブは ジャック・ミミック・フランケン・ヴァンパイア・パンプキン');
const all = new Set(ev.stages.flatMap(s => s.waves.flat().map(e => E.MON_BY_ID[e.ref].name)));
ok(![...all].some(n => n.includes('ゴブリン')), 'ゴブリンは出さない');
ok(E.slimeGoldOf(E.STAGE_BY_ID.ev_halloween_10, E.sweepSpawned(E.STAGE_BY_ID.ev_halloween_10)) === 0, 'ゴールドスライムのゴールドは出ない');

console.log('--- 遺物・ショップ・ガチャ ---');
ok(E.exclusiveRelicForMon('m190') && E.exclusiveRelicForMon('m190').id === 'rel_devil_ember', '悪魔の残り火はジャックの専用遺物');
const shop = Object.fromEntries(E.eventShopItems(ev).map(i => [i.sku, i]));
ok(E.eventRelicOf(ev) === 'rel_candy_basket' && shop.relic_body.limit === 1 && shop.relic_dupe.limit === 4 && shop.soul_pick.price === 230 && shop.soul_sub1 && shop.soul_sub2 && !shop.soul_sub3,
  'ショップ: お菓子のバスケット(本体1・重複4)・主役230×30・★4の2体');
ok(!E.relicsOfStar(4).some(x => x.id === 'rel_candy_basket'), 'バスケットはガチャに出ない');
api.STATE = E.DEFAULT_STATE();
{ let hit = 0; const n = 4000;
  for(let i = 0; i < n; i++){ api.STATE.gachaBannerKey = null; }
  const b = E.activeEvents().find(e => e.key === 'ev_halloween');
  ok(E.featured3Of(b).join() === 'm193,m194,m195' && E.featuredOf(b).join() === 'm190,m191,m192', 'ピックアップ★3は featured と別の項目'); }

console.log('--- EX・HELL ---');
const exS = E.exStagesOf(ev);
ok(exS.map(s => s.name).join() === 'かぼちゃ畑の古屋敷・EX1,かぼちゃ畑の古屋敷・EX2,かぼちゃ畑の古屋敷・EX3,かぼちゃ畑の古屋敷・HELL', 'EX1〜EX3とHELL');
ok(exS.every(s => new Set(s.waves.flat().map(e => e.ref)).size <= 10), '各段10体まで');
ok(exS.every(s => s.waves.flat().every(e => E.MON_BY_ID[e.ref].rarity < 5 || e.ref === 'm190')), '主役以外の★5は入れない');
ok(exS.every(s => s.waves[0][0].ref === 'm191'), '1ウェーブ目にミミック(敵も必ず先制で動く)');
const sum = (s, f) => s.rules.reduce((a, r) => a + f(r), 0);
const st = (who, k) => r => r.side === 'enemy' && r.stat && r.stat[k] && (!r.who || (who === 'mob' ? r.who.boss === false : who === 'boss' ? r.who.boss === true : false)) ? r.stat[k] : 0;
const T = exS.map(s => ({ mobHp: sum(s, st('mob', 'hp')), mobStr: sum(s, st('mob', 'str')), bossHp: sum(s, st('boss', 'hp')), bossStr: sum(s, st('boss', 'str')),
  trick: sum(s, r => r.side === 'ally' && r.who && r.who.role === 'trickster' ? r.stat.str : 0),
  status: sum(s, r => r.whenTarget === 'statused' ? r.dmgDealt : 0) })).map(t => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, Math.round(v * 100)])));
ok(T.every((t, i) => i === 0 || Object.keys(t).every(k => t[k] >= T[i - 1][k])), '段が上がっても、どの値も下がらない', T);
ok(exS[2].rules.some(r => r.when === 'noBuff' && r.dmgTaken === 0.3) && !exS[1].rules.some(r => r.when === 'noBuff'), 'EX3から: 味方 強化が1つもないとき 受けるダメージ+30%');
ok(exS[3].rules.some(r => r.who && r.who.ref === 'm190' && r.stat.hp === 1.0), 'HELL: 敵のジャック 最大HP+100%');

console.log('--- メダル・称号・フレーム・お知らせ ---');
ok(E.EVENT_MEDAL.ev_halloween.name === 'ハロウィンのキャンディ' && E.ITEM_ICON_LABEL.medal_candy === 'ハロウィンのキャンディ', 'メダル');
const tt = E.EVENT_TITLES.ev_halloween;
ok(tt.deep === 'お菓子あつめ' && tt.star === 'いたずら名人' && tt.ex === '仮装行列の王' && tt.hell === '真夜中の主役', '称号');
ok(E.EVENT_THEME.ev_halloween && E.FRAMES.fr_ev_halloween && E.FRAMES.fr_ev_halloween.style === 'halloween' && E.FRAMES.fr_ev_halloween.badge === 'm190', '色・フレーム(HELL★3・ジャック入り)');
at('2026-10-24T11:59:00+09:00');
ok(!E.liveNotices().some(n => n.id === 50 || n.id === 53), '予告(10/24 12:00)の前はお知らせに出ない');
at('2026-10-24T12:00:00+09:00');
ok(E.liveNotices().some(n => n.id === 50) && !E.liveNotices().some(n => n.id === 53), '10/24 12:00 に予告');
at('2026-10-27T12:00:00+09:00');
ok(E.liveNotices().some(n => n.id === 53), '10/27 12:00 に開幕のお知らせ');

Date.now = realNow;
console.log(fail ? `${fail}件 失敗` : 'すべて通過');
process.exit(fail ? 1 : 0);
