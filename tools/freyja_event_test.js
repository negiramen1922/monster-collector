/* フレイヤイベ(豊穣の女神・黄金のフォールクヴァング)のイベント・EX・HELLのテスト。
   中身の正は docs/提案資料/次回イベント案_フレイヤ.md */
const load = require('./harness.js');
const api = load('game.js', s => s + `;global.__e={EVENTS,STAGE_BY_ID,EVENT_EX,EVENT_EX_RULES,eventShopItems,eventMissions,exStagesOf,EX_FIRST_CLEAR_CRYSTAL,
  exMobSoulRate,exPickupSoulRate,FRAMES,FREYJA_START_AT,MOMOTARO_START_AT,activeEvents,RELICS,relicsOfStar,eventRelicOf,exclusiveRelicForMon,MON_BY_ID,MONSTER_PERKS,
  EVENT_MEDAL,EVENT_TITLES,EVENT_THEME,get STATE(){return STATE}, set STATE(v){STATE=v}, DEFAULT_STATE};`);
const E = global.__e;
let fail = 0;
const ok = (c, m, v) => { console.log((c ? '✅' : '❌') + ' ' + m + (v !== undefined ? '  ' + JSON.stringify(v) : '')); if(!c) fail++; };
const realNow = Date.now;
const at = iso => { Date.now = () => new Date(iso).getTime(); };
const ev = E.EVENTS.find(e => e.key === 'ev_freyja');
const NEW = ['m177', 'm178', 'm179', 'm180', 'm181', 'm182', 'm183', 'm184'];
ok(!!ev && ev.econV2 && ev.pickup === 'm177' && ev.element === 'earth' && ev.terrain === 'field' && ev.stageName === '黄金のフォールクヴァング' && ev.name === '豊穣の女神',
  'イベントの基本(主役・属性・地形・名前)');
ok(ev.featured.join() === 'm177,m178,m179', '同時ピックアップの★4はフレイ・ヒルディスヴィーニ');
ok(E.FREYJA_START_AT === '2026-10-13T12:00:00+09:00' && ev.startAt === E.FREYJA_START_AT && ev.endAt === '2026-10-26T23:59:59+09:00', '開始 10/13 12:00・終了 10/26 23:59:59(どちらも仮)');
ok(NEW.every(id => E.MON_BY_ID[id].releaseAt === ev.startAt) && ['rel_hawk_cloak', 'rel_golden_ear'].every(id => E.RELICS[id].releaseAt === ev.startAt)
  && NEW.every(id => E.MONSTER_PERKS[id] && E.MONSTER_PERKS[id].from === ev.startAt), '新キャラ・新遺物の releaseAt と星刻の from はイベントの startAt と同じ');
at('2026-10-13T11:59:00+09:00');
ok(!E.activeEvents().some(e => e.key === 'ev_freyja') && E.activeEvents().some(e => e.key === 'ev_momotaro'), '開始日時の前は開催中に出ない(鬼ヶ島は開催中)');
at('2026-10-13T12:00:00+09:00');
ok(E.activeEvents().some(e => e.key === 'ev_freyja') && E.activeEvents().some(e => e.key === 'ev_momotaro'), '開始日時を過ぎると、鬼ヶ島と2本同時に開催中');
at('2026-10-27T00:00:00+09:00');
ok(!E.activeEvents().some(e => e.key === 'ev_freyja'), '終了日時のあとは開催中に出ない');
at('2026-10-14T12:00:00+09:00');

console.log('--- クエスト10層 ---');
ok(ev.stages.length === 10 && ev.stages.every(s => s.waves.map(w => w.length).join() === '3,3,4,4,5'), '10層・ウェーブは3・3・4・4・5体');
ok(ev.stages.every(s => s.waves[4].map(e => e.ref).join() === 'm177,m178,m179,m181,m183'), '最終ウェーブは フレイヤ・フレイ・ヒルディスヴィーニ・ヒルデ・スコグル(finalWave)');
ok(ev.stages.every((s, i) => s.waves[4].slice(1).every(e => e.star === ev.tiers[i].star)), 'finalWave の★は護衛と同じ t.star');
const early = new Set(ev.stages.slice(0, 4).flatMap(s => s.waves.slice(0, 4).flat().map(e => e.ref)));
ok([...early].every(id => ['m180', 'm47', 'm70', 'm134', 'm133', 'm91'].includes(id)), '1〜4層の護衛は エインヘリャル・コボルト・ジャッカロープ・マッドモール・ピクシー・ウィスプ', [...early]);
const all = new Set(ev.stages.flatMap(s => s.waves.flat().map(e => E.MON_BY_ID[e.ref].name)));
ok(![...all].some(n => n.includes('ゴブリン')), 'ゴブリンは出さない', [...all]);
ok(ev.stages.every(s => !(s.bossReward || []).some(r => r.type === 'relic')), '層の初回クリアでは遺物を配らない');
ok([1, 3, 6, 8, 10].every(n => E.STAGE_BY_ID[`ev_freyja_${n}`].bossReward.some(r => r.key === 'relic_scrap')), '1・3・6・8・10層は強化素材(霊素鉱)');

console.log('--- 遺物・ショップ ---');
const shop = E.eventShopItems(ev);
const body = shop.find(x => x.sku === 'relic_body'), dupe = shop.find(x => x.sku === 'relic_dupe');
ok(E.eventRelicOf(ev) === 'rel_golden_ear' && body && body.price === 200 && body.limit === 1 && dupe && dupe.price === 200 && dupe.limit === 4, '黄金の麦穂: 本体200×1・重複200×4');
ok(['soul_sub1', 'soul_sub2'].every(k => shop.some(x => x.sku === k)) && !shop.some(x => x.sku === 'soul_sub3'), '★4の2体のソウルを1体ずつ売る');
ok(!E.relicsOfStar(4).some(r => r.id === 'rel_golden_ear') && E.relicsOfStar(5).some(r => r.id === 'rel_hawk_cloak'), '麦穂はガチャに出ない・羽衣はガチャに出る(公開後)');
ok(E.exclusiveRelicForMon('m177') && E.exclusiveRelicForMon('m177').id === 'rel_hawk_cloak', '鷹の羽衣はフレイヤの専用遺物');
const rl = id => E.RELICS[id].effects.map(e => `${e.stat}:${e.pct}:${e.cond ? e.cond.type + '=' + e.cond.value : '-'}`).join(' ');
ok(rl('rel_hawk_cloak') === 'hp:0.15:- atk:0.15:role=support spGain:0.165:mon=m177' && E.RELICS.rel_hawk_cloak.base.hp === 85.4 && E.RELICS.rel_hawk_cloak.base.atk === 19.8, '鷹の羽衣の中身');
ok(rl('rel_golden_ear') === 'atk:0.125:- spGain:0.125:element=earth ultDmg:0.125:element=earth' && E.RELICS.rel_golden_ear.base.hp === 67.6 && E.RELICS.rel_golden_ear.base.atk === 14.5
  && E.RELICS.rel_golden_ear.channel === 'event', '黄金の麦穂の中身(channel:event)');
const momo = E.EVENTS.find(e => e.key === 'ev_momotaro');
ok(E.eventRelicOf(momo) === 'rel_hinomaru_hachimaki' && E.eventShopItems(momo).some(x => x.sku === 'soul_sub3'), '鬼ヶ島のショップは変わらない');

console.log('--- EX・HELL ---');
const ex = E.exStagesOf(ev);
ok(ex.map(s => s.name).join() === '黄金のフォールクヴァング・EX1,黄金のフォールクヴァング・EX2,黄金のフォールクヴァング・EX3,黄金のフォールクヴァング・HELL', 'EX1〜EX3とHELL', ex.map(s => s.name));
const def = E.EVENT_EX.ex_freyja;
ok(def.map(t => [t.lv, t.boss, t.mob, t.sk].join('/')).join(' ') === '80/6/4/8 200/8/5/10 300/10/6/10 300/10/10/10', '段ごとの lv/boss/mob/sk');
ok(ex.every(s => new Set(s.waves.flat().map(e => e.ref)).size <= 10), '各段10体まで');
const allowed = new Set(['m177', 'm178', 'm179', 'm144', 'm56', 'm180', 'm181', 'm182', 'm183', 'm184']);
ok(ex.every(s => s.waves.flat().every(e => allowed.has(e.ref))), '顔ぶれはフレイヤ / フレイ・ヒルディスヴィーニ / ブロック・ミノタウロス / ★3以下の5体');
ok(ex.every(s => s.waves.flat().every(e => E.MON_BY_ID[e.ref].rarity < 5 || e.ref === 'm177')), '主役以外の★5は入れない');
ok(ex.every(s => s.waves[2].map(e => e.ref).join() === 'm177,m178,m179,m181,m183'), '最終ウェーブは フレイヤ・フレイ・ヒルディスヴィーニ・ヒルデ・スコグル');
ok(def.every(t => t.waves.flat().every(x => /:(front|back)$/.test(x))), '前後の配置をすべて書いている');
ok(ex[3].requires === 'ev_freyja_ex3' && ex[0].requires === 'ev_freyja_3', 'HELLはEX3クリアで開く');
ok(ex.map(s => s.firstClear).join() === '100,200,400,500', '初回クリアの石 100/200/400/500');
ok(ex[3].waves.flat().filter(e => !e.boss).every(e => e.star === 10) && ex[3].waves[2][0].star === 10, 'HELLは雑魚も★10');
ok(ex[3].desc.includes('最も手ごわい、腕に覚えのある者のための段。'), 'HELLの説明文は鬼ヶ島と共通');
const labels = s => s.rules.map(r => r.label);
ok(labels(ex[0]).join('|') === '土属性の味方 攻撃力・HP+25%|光属性の味方 攻撃力・HP+25%|セレスティアの味方 攻撃力+25%|エルフの味方 攻撃力+25%', 'EX1: 4本', labels(ex[0]));
ok(ex[1].rules.length === 5 && ex[1].rules.some(r => r.side === 'enemy' && r.stat && r.stat.pdef === 50), 'EX2: +敵 物理防御+50');
ok(ex[2].rules.length === 7 && ex[2].rules.some(r => r.whenTarget === 'strDown' && r.dmgDealt === 0.3) && ex[2].rules.some(r => r.when === 'notShielded' && r.dmgTaken === 0.3 && r.side === 'ally'),
  'EX3: +攻撃力低下の敵へ与ダメ+30%・シールドがないとき被ダメ+30%');
ok(ex[3].rules.length === 11 && ex[3].power === 1.3 && ex[3].rules.some(r => r.side === 'enemy' && r.dmgDealt === 0.75) && ['m177', 'm178'].every(id => ex[3].rules.some(r => r.who && r.who.ref === id && r.side === 'enemy' && r.stat.str === 0.5 && r.stat.hp === 0.5)), 'HELL: +敵のフレイヤ・フレイ 攻撃力・HP+50%');
ok(E.exMobSoulRate(ev, 4, E.MON_BY_ID.m178) === 1.0 && E.exMobSoulRate(ev, 4, E.MON_BY_ID.m181) === 0.35 && E.exPickupSoulRate(ev, 4) === 0.5, 'HELLのソウル率はEX3と同じ');

console.log('--- メダル・ミッション・称号・フレーム ---');
ok(E.EVENT_MEDAL.ev_freyja && E.EVENT_MEDAL.ev_freyja.name === '豊穣の麦印' && E.EVENT_THEME.ev_freyja, 'メダル・色');
api.STATE = E.DEFAULT_STATE();
const ms = E.eventMissions(ev);
ok(ms.some(m => m.id === 'ex3star') && ms.some(m => m.id === 'hellstar' && m.title === 'ti_ev_freyja_hell'), 'HELLの★3クリアのミッション(称号つき)');
const fr = E.FRAMES.fr_ev_freyja;
ok(fr && fr.style === 'freyja' && fr.badge === 'm177' && fr.how.includes('HELL'), 'イベントの枠はHELLの★3で、主役(フレイヤ)入り');
ok(!fr.test(), 'まだもらえない');
api.STATE.stageStars = { ev_freyja_ex4: 3 };
ok(fr.test() && E.eventMissions(ev).find(m => m.id === 'hellstar').state === 'claim', 'HELLを★3でクリアすると枠とミッション');
Date.now = realNow;
console.log(fail ? `\n${fail}件 失敗` : '\nすべて通過');
process.exit(fail ? 1 : 0);
