/* モモタロウイベ(鬼ヶ島)のイベント・EX・HELLのテスト。中身の正は docs/提案資料/次回イベント案_モモタロウ.md */
const load = require('./harness.js');
const api = load('game.js', s => s + `;global.__e={EVENTS,STAGE_BY_ID,EVENT_EX,EVENT_EX_RULES,eventShopItems,eventMissions,exStagesOf,EX_FIRST_CLEAR_CRYSTAL,eventStagePickupSoul,eventStageMobSoulRate,
  exMobSoulRate,exPickupSoulRate,FRAMES,TITLES:typeof TITLES!=='undefined'?TITLES:null,MOMOTARO_START_AT,activeEvents,RELICS,relicsOfStar,eventRelicOf,MON_BY_ID,
  get STATE(){return STATE}, set STATE(v){STATE=v}, DEFAULT_STATE};`);
const E = global.__e;
let fail = 0;
const ok = (c, m, v) => { console.log((c ? '✅' : '❌') + ' ' + m + (v !== undefined ? '  ' + JSON.stringify(v) : '')); if(!c) fail++; };
const realNow = Date.now;
const at = iso => { Date.now = () => new Date(iso).getTime(); };
const ev = E.EVENTS.find(e => e.key === 'ev_momotaro');
ok(!!ev && ev.econV2 && ev.pickup === 'm171' && ev.element === 'grass' && ev.terrain === 'sea' && ev.stageName === '鬼ヶ島', 'イベントの基本(主役・属性・地形・名前)');
ok(ev.startAt === E.MOMOTARO_START_AT && E.MON_BY_ID.m171.releaseAt === ev.startAt && E.RELICS.rel_hinomaru_touken.releaseAt === ev.startAt, '新キャラ・新遺物の releaseAt はイベントの startAt と同じ');
at('2026-10-10T12:00:00+09:00');
ok(!E.activeEvents().some(e => e.key === 'ev_momotaro'), '開始日時の前は開催中に出ない');
at('2026-10-14T12:00:00+09:00');
ok(E.activeEvents().some(e => e.key === 'ev_momotaro'), '開始日時を過ぎると開催中');

console.log('--- クエスト10層 ---');
ok(ev.stages.length === 10 && ev.stages.every(s => s.waves.map(w => w.length).join() === '3,3,4,4,5'), '10層・ウェーブは3・3・4・4・5体');
ok(ev.stages.every(s => s.waves[4].map(e => e.ref).join() === 'm171,m172,m173,m174,m88'), '最終ウェーブは モモタロウ・イヌ・サル・キジ・ウンディーネ(finalWave)');
ok(ev.stages.every((s, i) => s.waves[4].slice(1).every(e => e.star === ev.tiers[i].star)), 'finalWave の★は護衛と同じ t.star');
const early = new Set(ev.stages.slice(0, 4).flatMap(s => s.waves.slice(0, 4).flat().map(e => e.ref)));
ok([...early].every(id => ['m127', 'm117', 'm115', 'm135', 'm10'].includes(id)), '1〜4層の護衛は 鬼火・河童・猫又・カマイタチ・マンドラゴラ', [...early]);
ok(ev.stages.every(s => !(s.bossReward || []).some(r => r.type === 'relic')), '層の初回クリアでは遺物を配らない');
ok([1, 3, 6, 8, 10].every(n => E.STAGE_BY_ID[`ev_momotaro_${n}`].bossReward.some(r => r.key === 'relic_scrap')), '1・3・6・8・10層は強化素材(霊素鉱)');

console.log('--- ショップ ---');
const shop = E.eventShopItems(ev);
const body = shop.find(x => x.sku === 'relic_body'), dupe = shop.find(x => x.sku === 'relic_dupe');
ok(E.eventRelicOf(ev) === 'rel_hinomaru_hachimaki' && body && body.price === 200 && body.limit === 1 && dupe && dupe.price === 200 && dupe.limit === 4, '鉢巻: 本体200×1・重複200×4');
ok(['soul_sub1', 'soul_sub2', 'soul_sub3'].every(k => shop.some(x => x.sku === k)), '★4の3体のソウルを1体ずつ売る');
ok(!E.relicsOfStar(4).some(r => r.id === 'rel_hinomaru_hachimaki') && E.relicsOfStar(5).some(r => r.id === 'rel_hinomaru_touken'), '鉢巻はガチャに出ない・桃剣はガチャに出る(公開後)');
const fen = E.EVENTS.find(e => e.key === 'ev_fenrir');
ok(!E.eventShopItems(fen).some(x => x.sku === 'relic_body') && E.eventShopItems(fen).find(x => x.sku === 'relic_dupe').limit === 2, '既存のイベントのショップは変わらない');

console.log('--- EX・HELL ---');
const ex = E.exStagesOf(ev);
ok(ex.map(s => s.name).join() === '鬼ヶ島・EX1,鬼ヶ島・EX2,鬼ヶ島・EX3,鬼ヶ島・HELL', 'EX1〜EX3とHELL', ex.map(s => s.name));
const def = E.EVENT_EX.ex_momotaro;
ok(def.map(t => [t.lv, t.boss, t.mob, t.sk].join('/')).join(' ') === '80/6/4/8 200/8/5/10 300/10/6/10 300/10/10/10', '段ごとの lv/boss/mob/sk');
ok(ex.every(s => new Set(s.waves.flat().map(e => e.ref)).size <= 10), '各段10体まで');
ok(ex.every(s => s.waves.flat().every(e => E.MON_BY_ID[e.ref].rarity < 5 || e.ref === 'm171')), '主役以外の★5は入れない');
ok(ex.every(s => s.waves[2].map(e => e.ref).join() === 'm171,m172,m173,m174,m88'), '最終ウェーブは モモタロウ・イヌ・サル・キジ・ウンディーネ');
ok(def.every(t => t.waves.flat().every(x => /:(front|back)$/.test(x))), '前後の配置をすべて書いている');
ok(ex[3].requires === 'ev_momotaro_ex3' && ex[0].requires === 'ev_momotaro_3', 'HELLはEX3クリアで開く');
ok(ex.map(s => s.firstClear).join() === '100,200,400,500', '初回クリアの石 100/200/400/500');
ok(ex[3].waves.flat().filter(e => !e.boss).every(e => e.star === 10) && ex[3].waves[2][0].star === 10, 'HELLは雑魚も★10');
ok(ex[3].rules.length === 9 && ex[3].rules.some(r => r.who && r.who.species === 'demon' && r.side === 'ally' && r.stat.str === -0.5) && ex[3].rules.some(r => r.who && r.who.ref === 'm171' && r.side === 'enemy' && r.stat.hp === 1.0) && ex[3].rules.some(r => r.side === 'enemy' && r.dmgDealt === 1.0), 'HELLだけ敵のモモタロウ 最大HP+100%・敵 与ダメージ+100%・デーモンの味方 攻撃力-50%');
ok(ex[2].rules.length === 6 && ex[2].rules.some(r => r.whenTarget === 'lowHp50' && r.dmgDealt === 0.6), 'EX共通ルール6本(HP50%以下の敵へ+60%を含む)');
ok(E.exMobSoulRate(ev, 4, E.MON_BY_ID.m172) === 0.5 && E.exMobSoulRate(ev, 4, E.MON_BY_ID.m175) === 0.175 && E.exPickupSoulRate(ev, 4) === 0.25, 'HELLのソウル率はEX3と同じ(soulV3: それまでの半分)');
ok([1, 2, 3].map(x => E.exPickupSoulRate(ev, x)).join() === '0.1,0.25,0.25', 'EX1〜EX3の主役のソウルはそれまでの半分', [1, 2, 3].map(x => E.exPickupSoulRate(ev, x)));
{ const ps = n => E.eventStagePickupSoul(ev, E.STAGE_BY_ID['ev_momotaro_' + n]);
  ok([1, 3, 4, 7, 8, 10].map(n => ps(n).rate + '/' + ps(n).ex).join() === '0.2/1,0.2/1,0.5/2,0.5/2,0.5/3,0.5/3', '通常ステージの主役のソウル: 1〜3層=EX1 / 4〜7層=EX2 / 8〜10層=EX3(1〜3個)の率', [1, 10].map(ps));
  ok(E.eventStageMobSoulRate(ev, E.STAGE_BY_ID['ev_momotaro_10'], E.MON_BY_ID.m172) === 1.0 && E.eventStageMobSoulRate(ev, E.STAGE_BY_ID['ev_momotaro_1'], E.MON_BY_ID.m175) === 0.15, '通常ステージの脇役のソウルもそれまでのEXの率'); }
{ const sh = Object.fromEntries(E.eventShopItems(ev).map(i => [i.sku, i]));
  ok(sh.soul_pick.price === 230 && sh.soul_pick.limit === 30 && sh.uni.price === 310 && sh.uni.limit === 5 && sh.uni.qty === '50個' && sh.reso.price === 430 && sh.reso.limit === 3 && sh.reso.qty === '20個', 'ショップ: 主役のソウル230・無形のソウル50個310×5・無形の共鳴石20個430×3'); }

console.log('--- ミッション・称号・フレーム ---');
api.STATE = E.DEFAULT_STATE();
let ms = E.eventMissions(ev);
ok(ms.some(m => m.id === 'ex3star') && ms.some(m => m.id === 'hellstar' && m.title === 'ti_ev_momotaro_hell'), 'HELLの★3クリアのミッション(称号つき)');
const fr = E.FRAMES.fr_ev_momotaro;
ok(fr && fr.style === 'momotaro' && fr.badge === 'm171' && fr.how.includes('HELL'), 'イベントの枠はHELLの★3で、主役(モモタロウ)入り');
ok(!fr.test(), 'まだもらえない');
api.STATE.stageStars = { ev_momotaro_ex4: 3 };
ok(fr.test() && E.eventMissions(ev).find(m => m.id === 'hellstar').state === 'claim', 'HELLを★3でクリアすると枠とミッション');
ok(E.FRAMES.fr_ev_fenrir.how.includes('EX3'), '既存のイベントの枠はEX3の★3のまま');
Date.now = realNow;
console.log(fail ? `\n${fail}件 失敗` : '\nすべて通過');
process.exit(fail ? 1 : 0);
