/* デイリー・ウィークリー・初心者ミッションの追加分の回帰テスト。
   - デイリー「探索を3回」は、周回と育成ダンジョンでも数える
   - デイリーに「遺物を1回強化」「PVPを1回」、ウィークリーに「PVPを10回」
   - はじめてガイド2(b11〜b19): 1〜10を終えた人にも続きとして出て、報酬を受け取れる */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e = {
  DEFAULT_STATE, DAILY_MISSIONS, WEEKLY_MISSIONS, BEGINNER_MISSIONS, BEGINNER_PART1, missionEntries, claimMission, track,
  grantDungeonRewards, grantStageRewards, findStage, dungeonStage, runSweep, ensureDaily, ensureWeekly, baseState,
  beginnerAllDone, buyShopItem, SHOP_GOLD_ITEMS, renderMissions, renderBeginnerCard, useMonTicket, pullOne, currentBanner, EVENTS,
  set tab(v){ missionTab = v; },
};`);
const E = global.__e;
let fails = 0;
const ok = (name, cond, info) => { if(!cond) fails++; console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : '')); };
const entry = key => E.missionEntries().find(e => e.key === key);

api.STATE = E.DEFAULT_STATE();
const S = api.STATE;
S.clearedStages = api.STAGES.map(s => s.id);

// --- デイリー「探索を3回」 ---
const dg = E.dungeonStage('mat', 0);
E.grantDungeonRewards(dg);
ok('育成ダンジョン(素材)のクリアで「探索を3回」が進む', entry('d:d_clear').progress === 1, entry('d:d_clear').progress);
E.grantStageRewards(E.findStage('q1_01'), []);
ok('クエストのクリアでも進む', entry('d:d_clear').progress === 2);
S.stageStars = { dg_exp_0: 3 }; S.stamina = 999;
E.runSweep('dg_exp_0', 2);
ok('育成ダンジョンの周回も1回ずつ数える', entry('d:d_clear').progress === 4, entry('d:d_clear').progress);
ok('3回で受け取れる', entry('d:d_clear').state === 'claim');

// --- 新しいデイリー・ウィークリー ---
ok('デイリーに「遺物を1回強化する」', E.DAILY_MISSIONS.some(m => m.id === 'd_relic' && m.event === 'relicUpgrade' && m.goal === 1));
ok('デイリーに「PVPを1回する」', E.DAILY_MISSIONS.some(m => m.id === 'd_pvp' && m.event === 'pvpBattle' && m.goal === 1));
ok('ウィークリーに「PVPを10回する」', E.WEEKLY_MISSIONS.some(m => m.id === 'w_pvp' && m.event === 'pvpBattle' && m.goal === 10));
E.track('relicUpgrade', 1);
ok('遺物を強化するとデイリーが受け取れる', entry('d:d_relic').state === 'claim');
for(let i = 0; i < 10; i++) E.track('pvpBattle');
ok('PVP 1回でデイリー、10回でウィークリーが受け取れる', entry('d:d_pvp').state === 'claim' && entry('w:w_pvp').state === 'claim');
ok('デイリーのすべて達成は8個になる', entry('d:all').goal === E.DAILY_MISSIONS.length && E.DAILY_MISSIONS.length === 8, entry('d:all').goal);

// --- はじめてガイド2: 1〜10を終えた人 ---
api.STATE = E.DEFAULT_STATE();
const T = api.STATE;
T.clearedStages = api.STAGES.map(s => s.id);
T.beginnerStep = E.BEGINNER_PART1; T.beginnerBonusClaimed = true;   // 旧版で全部終えた人
ok('旧版を全部終えた人にも初心者タブが出る', !E.beginnerAllDone());
ok('続きは「ログインする」から始まり、すぐ受け取れる', entry('b:b20').state === 'claim' && entry('b:b10').state === 'done');
E.claimMission('b:b20');
ok('ガイド1のすべて達成は受け取り済みのまま', entry('b:all').state === 'done');
ok('初心者ミッションは20個', E.BEGINNER_MISSIONS.length === 20);
const crystals0 = T.crystals;
T.pvpAttackSlots = ['m01', null, null, null, null]; T.pvpAttackFormation = T.formationKey;
const got = E.claimMission('b:b11');
ok('b11(PVP編成)を受け取れて報酬が入る', !!got && T.crystals === crystals0 + 100 && T.beginnerStep === 12, [!!got, T.crystals - crystals0]);
E.track('pvpBattle'); E.claimMission('b:b12');
T.friends = [{ uid: 'x', name: 'x' }]; E.claimMission('b:b13');
E.track('helperClear'); E.claimMission('b:b14');
T.beginnerGachaDone = true; E.claimMission('b:b15');
E.track('shopBuy'); E.claimMission('b:b16');
E.baseState().mine.lv = 2; E.claimMission('b:b17');
T.stageStars = { dg_gold_0: 1, dg_exp_0: 1 }; E.claimMission('b:b18'); E.claimMission('b:b19');
ok('b12〜b19 を順に受け取れる', T.beginnerStep === 20, T.beginnerStep);
ok('ガイド2のすべて達成が受け取れる', entry('b:all2').state === 'claim');
E.claimMission('b:all2');
ok('ガイド2のすべて達成で★4キャラ選択券がもらえる', (T.items.mon_sel_4 || 0) === 1);
ok('両方のボーナスを受け取ると初心者タブが消える', E.beginnerAllDone());
const star4 = api.MONSTERS.filter(m => m.rarity === 4);
ok('★5のキャラは★4選択券で受け取れない', E.useMonTicket('mon_sel_4', api.MONSTERS.find(m => m.rarity === 5).id) === null && T.items.mon_sel_4 === 1);
const pickNew = star4.find(m => !T.owned[m.id]);
const r1 = E.useMonTicket('mon_sel_4', pickNew.id);
ok('★4選択券で選んだキャラが仲間になり、券が減る', r1 && r1.isNew && T.owned[pickNew.id] && T.items.mon_sel_4 === 0);
ok('券が無いと使えない', E.useMonTicket('mon_sel_4', pickNew.id) === null);
T.items.mon_sel_4 = 1; const s0 = T.owned[pickNew.id].souls;
E.useMonTicket('mon_sel_4', pickNew.id);
ok('持っているキャラを選ぶとソウルになる', T.owned[pickNew.id].souls === s0 + 50, T.owned[pickNew.id].souls - s0);

// --- ピックアップのソウル ---
api.STATE = E.DEFAULT_STATE();
const U = api.STATE;
const pu = api.MON_BY_ID[E.currentBanner().pickup];
let pulled = null;
for(let i = 0; i < 4000 && !pulled; i++){ U.pitySinceRare = 0; const r = E.pullOne(5); if(r.mon.id === pu.id) pulled = r; }
ok('ピックアップの★5を新規で引くとソウル+150が付く', pulled && pulled.isNew && pulled.pickupBonus === 150 && U.owned[pu.id].souls >= 150, pulled && { souls: pulled.souls, bonus: pulled.pickupBonus });
pulled = null;
for(let i = 0; i < 4000 && !pulled; i++){ U.pitySinceRare = 0; const r = E.pullOne(5); if(r.mon.id === pu.id) pulled = r; }
ok('重複でも通常のソウル150に+150', pulled && !pulled.isNew && pulled.souls === 300, pulled && pulled.souls);
let other = null;
for(let i = 0; i < 4000 && !other; i++){ U.pitySinceRare = 0; const r = E.pullOne(5); if(r.mon.id !== pu.id && !r.isNew) other = r; }
ok('ピックアップ以外の★5にはボーナスが付かない', other && !other.pickupBonus && other.souls === 150, other && other.souls);

// --- イベントの遺物の配布 ---
const ev = E.EVENTS[0];
const relicLayers = ev.stages.filter(st => (st.bossReward || []).some(r => r.type === 'relic')).map(st => Number(st.id.split('_').pop()));
ok('イベントの属性遺物は1・3・6・8・10層で届き、10層で完凸', JSON.stringify(relicLayers) === '[1,3,6,8,10]', relicLayers);
ok('間の層は強化素材', [2, 4, 5, 7, 9].every(n => ev.stages[n - 1].bossReward.some(r => r.key === 'relic_scrap')));

// --- 途中の人は順番どおり ---
api.STATE = E.DEFAULT_STATE();
api.STATE.beginnerStep = 3;
ok('ガイド1の途中なら b11 はまだロック', entry('b:b11').state === 'locked' && entry('b:all2').state === 'locked');
api.STATE.clearedStages = api.STAGES.map(s => s.id);
ok('ミッション画面が描ける', typeof E.renderMissions() === 'string' && E.renderBeginnerCard() !== undefined);
console.log(fails ? `${fails}件失敗` : 'すべて通過');
