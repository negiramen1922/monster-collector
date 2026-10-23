/* スライムパラダイス(ぷるぷる島)のイベント・EX・HELL・ガチャのピックアップ★3・ゴールドスライムのゴールド・お知らせのテスト。
   中身の正は docs/提案資料/次回イベント案_スライムパラダイス.md */
const load = require('./harness.js');
const api = load('game.js', s => s + `;global.__e={EVENTS,STAGE_BY_ID,EVENT_EX,EVENT_EX_RULES,eventShopItems,eventMissions,exStagesOf,eventStagePickupSoul,
  exPickupSoulRate,FRAMES,SLIME_START_AT,SLIME_END_AT,FREYJA_END_AT,activeEvents,RELICS,relicsOfStar,eventRelicOf,exclusiveRelicForMon,MON_BY_ID,MONSTER_PERKS,
  EVENT_MEDAL,EVENT_TITLES,EVENT_THEME,ITEM_ICON_LABEL,featuredOf,featured3Of,currentBanner,pickMonsterOfRarity,slimeGoldOf,grantStageRewards,sweepSpawned,NOTICES,liveNotices,
  get STATE(){return STATE}, set STATE(v){STATE=v}, DEFAULT_STATE};`);
const E = global.__e;
let fail = 0;
const ok = (c, m, v) => { console.log((c ? '✅' : '❌') + ' ' + m + (v !== undefined ? '  ' + JSON.stringify(v) : '')); if(!c) fail++; };
const realNow = Date.now, realRand = Math.random;
const at = iso => { Date.now = () => new Date(iso).getTime(); };
const ev = E.EVENTS.find(e => e.key === 'ev_slime');
const NEW = ['m185', 'm186', 'm187', 'm188', 'm189'];
const OLD = ['m06', 'm32', 'm33', 'm34', 'm35', 'm36'];

console.log('--- 日程 ---');
ok(!!ev && ev.econV2 && ev.soulV3 && ev.pickup === 'm31' && ev.element === 'water' && ev.terrain === 'sea' && ev.stageName === 'ぷるぷる島' && ev.name === 'スライムパラダイス',
  'イベントの基本(主役シースライム・水・海・ぷるぷる島)');
ok(ev.featured.join() === 'm31,m185,m186' && ev.featured3.join() === 'm187,m188,m189', '同時ピックアップの★4はキング・アーク、ピックアップの★3はアース・ウィンド・ゴールド');
ok(ev.startAt === '2026-10-26T12:00:00+09:00' && ev.endAt === '2026-11-09T12:00:00+09:00', '開始 10/26 12:00・終了 11/9 12:00');
ok(E.EVENTS.find(e => e.key === 'ev_momotaro').endAt === '2026-10-26T12:00:00+09:00' && E.FREYJA_END_AT === '2026-10-27T12:00:00+09:00', '鬼ヶ島は 10/26 12:00、豊穣の女神は 10/27 12:00 に終わる');
ok(NEW.every(id => E.MON_BY_ID[id].releaseAt === ev.startAt) && E.RELICS.rel_tidepool_jelly.releaseAt === ev.startAt
  && [...NEW, ...OLD].every(id => E.MONSTER_PERKS[id].from === ev.startAt), '新キャラ・新遺物の releaseAt と星刻の from はイベントの startAt と同じ');
at('2026-10-26T11:59:00+09:00');
ok(!E.activeEvents().some(e => e.key === 'ev_slime') && E.activeEvents().some(e => e.key === 'ev_momotaro'), '開始の前は出ない(鬼ヶ島は開催中)');
at('2026-10-26T12:00:01+09:00');
ok(E.activeEvents().map(e => e.key).sort().join() === 'ev_freyja,ev_slime', '10/26 12:00 を過ぎると 豊穣の女神とスライムパラダイス(鬼ヶ島は終わり)');
at('2026-10-27T12:00:01+09:00');
ok(!E.activeEvents().some(e => e.key === 'ev_freyja') && E.activeEvents().some(e => e.key === 'ev_slime'), '10/27 12:00 を過ぎると豊穣の女神も終わる(ハロウィンと入れ替わり)');
at('2026-11-09T12:00:01+09:00');
ok(!E.activeEvents().some(e => e.key === 'ev_slime'), '終了日時のあとは出ない');
at('2026-10-28T12:00:00+09:00');

console.log('--- クエスト10層 ---');
ok(ev.stages.length === 10 && ev.stages.every(s => s.waves.map(w => w.length).join() === '3,3,4,4,5'), '10層・ウェーブは3・3・4・4・5体');
ok(ev.stages.every(s => s.waves[4].map(e => e.ref).join() === 'm31,m185,m189,m186,m34'), '最終ウェーブは シースライム・キング・ゴールド・アーク・ホーリー');
const slimeOnly = ev.stages.every(s => s.waves.flat().every(e => E.MON_BY_ID[e.ref].tribe === 'スライム族'));
ok(slimeOnly, '敵はスライムだけ');
ok(ev.stages.every(s => s.waves.slice(0, 4).flat().every(e => e.ref !== 'm189')), 'ゴールドスライムは最終ウェーブだけ');
const early = new Set(ev.stages.slice(0, 4).flatMap(s => s.waves.slice(0, 4).flat().map(e => e.ref)));
ok([...early].every(id => OLD.includes(id)), '1〜4層の護衛は今までの★1・★2スライム', [...early]);

console.log('--- ゴールドスライムのゴールド ---');
const s10 = E.STAGE_BY_ID.ev_slime_10, s1 = E.STAGE_BY_ID.ev_slime_1;
ok(E.slimeGoldOf(s10, E.sweepSpawned(s10)) === 2000 && E.slimeGoldOf(s1, E.sweepSpawned(s1)) === 200, '層×200(10層で+2,000)');
const exS = E.exStagesOf(ev);
ok(exS.every(s => E.slimeGoldOf(s, E.sweepSpawned(s)) === 0), 'EX・HELLでは出さない');
const fq = E.STAGE_BY_ID.ev_freyja_10;
ok(E.slimeGoldOf(fq, [{ ref: 'm189' }]) === 0, 'ほかのイベントでは出さない');
ok(E.slimeGoldOf(s10, [{ ref: 'm189', isEnemy: false }]) === 0, '味方のゴールドスライムでは増えない');
api.STATE = E.DEFAULT_STATE(); api.STATE.gold = 0;
const r = E.grantStageRewards(s10, E.sweepSpawned(s10), []);
ok(r.gold === (s10.gold || 0) + 2000 && api.STATE.gold >= r.gold, '報酬のゴールドに足される', [r.gold, s10.gold]);

console.log('--- 遺物・ショップ ---');
const shop = Object.fromEntries(E.eventShopItems(ev).map(i => [i.sku, i]));
ok(E.eventRelicOf(ev) === 'rel_tidepool_jelly' && shop.relic_body.price === 200 && shop.relic_body.limit === 1 && shop.relic_dupe.limit === 4, '潮だまりのゼリー: 本体200×1・重複200×4');
const rl = id => E.RELICS[id].effects.map(e => `${e.stat}:${e.pct}:${e.cond ? e.cond.type + '=' + e.cond.value : '-'}`).join(' ');
ok(rl('rel_tidepool_jelly') === 'atk:0.125:- skillDmg:0.125:species=amorphous ultDmg:0.125:species=amorphous' && E.RELICS.rel_tidepool_jelly.base.hp === 34.4 && E.RELICS.rel_tidepool_jelly.base.atk === 21.6
  && E.RELICS.rel_tidepool_jelly.channel === 'event' && E.RELICS.rel_tidepool_jelly.star === 4, '潮だまりのゼリーの中身(STR型E・アモルファス・channel:event。2026-10-23 ユーザー決定)');
ok(!E.relicsOfStar(4).some(x => x.id === 'rel_tidepool_jelly'), 'ゼリーはガチャに出ない');
ok(E.exclusiveRelicForMon('m31') && E.exclusiveRelicForMon('m31').id === 'rel_slime_core', 'シースライムの専用遺物は今のクラーケンの残滓');
ok(shop.soul_pick.price === 230 && shop.soul_pick.limit === 30 && shop.soul_sub1 && shop.soul_sub2 && !shop.soul_sub3 && shop.uni.price === 310 && shop.reso.price === 430,
  'ショップ: 主役230×30・★4の2体・無形のソウル・無形の共鳴石(★3はショップのソウルに入らない)');

console.log('--- ガチャのピックアップ★3 ---');
ok(E.featuredOf(ev).join() === 'm31,m185,m186' && E.featured3Of(ev).join() === 'm187,m188,m189', '★3は featured と別の項目(抱き合わせの率・ショップに入らない)');
api.STATE = E.DEFAULT_STATE();
at('2026-10-26T18:00:00+09:00');   // ハロウィンが始まる前(始まると、新しく始まったハロウィンのバナーが既定になる)
const b = E.currentBanner();
ok(b.key === 'ev_slime' && b.featured3.join() === 'm187,m188,m189', 'バナーにピックアップ★3が載る');
{ const n = 4000; let hit = 0; for(let i = 0; i < n; i++){ if(['m187', 'm188', 'm189'].includes(E.pickMonsterOfRarity(3).id)) hit++; }
  ok(hit / n > 0.45 && hit / n < 0.56, '★3が出たときの約5割がこの3体', hit / n); }
at('2026-11-09T12:00:01+09:00');
{ let hit = 0; for(let i = 0; i < 2000; i++){ if(['m187', 'm188', 'm189'].includes(E.pickMonsterOfRarity(3).id)) hit++; }
  ok(hit / 2000 < 0.15, '期間が終わったら、ほかの★3と同じ', hit / 2000); }
at('2026-10-28T12:00:00+09:00');

console.log('--- EX・HELL ---');
const def = E.EVENT_EX.ex_slime;
ok(exS.map(s => s.name).join() === 'ぷるぷる島・EX1,ぷるぷる島・EX2,ぷるぷる島・EX3,ぷるぷる島・HELL', 'EX1〜EX3とHELL');
ok(def.map(t => [t.lv, t.boss, t.mob, t.sk].join('/')).join(' ') === '80/6/4/8 200/8/5/10 300/10/6/10 300/10/10/10', '段ごとの lv/boss/mob/sk');
ok(exS.every(s => new Set(s.waves.flat().map(e => e.ref)).size <= 10), '各段10体まで');
ok(exS.every(s => s.waves.flat().every(e => E.MON_BY_ID[e.ref].tribe === 'スライム族')), '顔ぶれはスライムだけ');
ok(exS.every(s => s.waves.flat().every(e => E.MON_BY_ID[e.ref].rarity < 5 || e.ref === 'm31')), '主役以外の★5は入れない');
ok(exS.every(s => s.waves[2].map(e => e.ref).join() === 'm31,m185,m189,m186,m34'), '最終ウェーブ');
ok(exS[3].requires === 'ev_slime_ex3' && exS.map(s => s.firstClear).join() === '100,200,400,500', 'HELLはEX3クリアで開く・初回の石 100/200/400/500');
const labels = s => s.rules.map(x => x.label);
// 段ごとの合計(どの値も段が上がるごとに下がらない)。base は全段共通の2本
const sum = (s, f) => s.rules.reduce((a, r) => a + f(r), 0);
const st = (who, k) => r => r.side === 'enemy' && r.stat && r.stat[k] && (!r.who || (who === 'mob' ? r.who.boss === false : who === 'boss' ? r.who.boss === true : false)) ? r.stat[k] : 0;
const tot = s => ({ mobHp: sum(s, st('mob', 'hp')), mobStr: sum(s, st('mob', 'str')), bossHp: sum(s, st('boss', 'hp')), bossStr: sum(s, st('boss', 'str')),
  amo: sum(s, r => r.side === 'ally' && r.who && r.who.species === 'amorphous' ? r.stat.str : 0),
  water: sum(s, r => r.side === 'ally' && r.who && r.who.element === 'water' ? r.stat.str : 0),
  strDown: sum(s, r => r.whenTarget === 'strDown' ? r.dmgDealt : 0) });
const T = exS.map(tot).map(t => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, Math.round(v * 100)])));
ok(JSON.stringify(T) === JSON.stringify([
  { mobHp: 20, mobStr: 20, bossHp: 50, bossStr: 10, amo: 75, water: 25, strDown: 0 },
  { mobHp: 30, mobStr: 30, bossHp: 80, bossStr: 20, amo: 75, water: 25, strDown: 0 },
  { mobHp: 50, mobStr: 30, bossHp: 80, bossStr: 30, amo: 75, water: 25, strDown: 60 },
  { mobHp: 170, mobStr: 150, bossHp: 450, bossStr: 130, amo: 150, water: 50, strDown: 100 }]), '段ごとの合計(2026-10-20 ユーザー決定の並び)', T);
ok(T.every((t, i) => i === 0 || Object.keys(t).every(k => t[k] >= T[i - 1][k])), '段が上がっても、どの値も下がらない');
ok(exS.slice(1).every(s => s.rules.some(x => x.side === 'enemy' && x.dmgTaken === -0.3 && x.atk === 'phys')) && !exS[0].rules.some(x => x.dmgTaken), 'EX2から: 敵 受ける物理ダメージ-30%');
ok(exS[3].rules.some(x => x.who && x.who.ref === 'm31' && x.stat.hp === 1.0) && exS[3].rules.some(x => x.side === 'enemy' && x.dmgDealt === 0.7), 'HELL: 敵のシースライム 最大HP+100%・敵 与ダメージ+70%');

console.log('--- メダル・称号・フレーム・お知らせ ---');
ok(E.EVENT_MEDAL.ev_slime.name === 'スライムの雫' && E.EVENT_MEDAL.ev_slime.icon === 'medal_slime' && E.ITEM_ICON_LABEL.medal_slime === 'スライムの雫', 'メダル「スライムの雫」');
const tt = E.EVENT_TITLES.ev_slime;
ok(tt.deep === 'スライムなかま' && tt.star === 'ぷるぷるマスター' && tt.ex === 'スライムの勇者' && tt.hell === '楽園の王者', '称号');
ok(E.EVENT_THEME.ev_slime && E.EVENT_THEME.ev_slime.bg1 === '#062430', '色');
const fr = E.FRAMES.fr_ev_slime;
ok(fr && fr.style === 'slime' && fr.badge === 'm31' && fr.how.includes('HELL'), 'イベントの枠はHELLの★3で、シースライム入り');
at('2026-10-23T11:59:00+09:00');
ok(!E.liveNotices().some(n => n.id === 44 || n.id === 45), '予告(10/23 12:00)の前はお知らせに出ない');
at('2026-10-23T12:00:00+09:00');
ok(E.liveNotices().some(n => n.id === 44) && !E.liveNotices().some(n => n.id === 45), '10/23 12:00 に予告が出る');
at('2026-10-26T12:00:00+09:00');
ok(E.liveNotices().some(n => n.id === 45), '10/26 12:00 に開幕のお知らせが出る');
const teaser = E.NOTICES.find(n => n.id === 44).body;
ok(teaser.includes('10/26(月) 12:00') && teaser.includes('10/27(火) 12:00'), '予告に、鬼ヶ島・豊穣の女神の終了時刻の変更を書く');

Date.now = realNow; Math.random = realRand;
console.log(fail ? `${fail}件 失敗` : 'すべて通過');
process.exit(fail ? 1 : 0);
