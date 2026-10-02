/* 経済見直し(α0.4.000)の検算。指示書「落としどころ」の数字が、コードの値から出るか。
   月の石 = デイリー + ログイン + ウィークリー + イベント×4 + 深淵回廊(+ 総力戦・封印戦は未実装なので0)
   ガチャ1回135石、天井200回。 */
const load = require('./harness.js');
const api = load('game.js', s => s + ';global.__e={DAILY_MISSIONS,DAILY_ALL_CLEAR,WEEKLY_MISSIONS,DAILY_LOGIN_REWARDS,EVENTS,eventMissions,eventShopItems,STAGES,TIER_STAR_CHESTS,ACHIEVEMENTS,DUP_SOULS,PICKUP_BONUS_SOULS,UNIVERSAL_SOULS,RESONANCE_PER_PULL,SOULS_TO_NEXT,DUNGEONS,FACILITIES,RARITY_WEIGHTS,COMPENSATION_GIFTS};');
const E = global.__e;
let bad = 0;
const ok = (n, c, i) => { if(!c) bad++; console.log((c ? '✅' : '❌') + ' ' + n + (i !== undefined ? '  ' + JSON.stringify(i) : '')); };
api.STATE = api.DEFAULT_STATE();
const cr = list => list.filter(r => r.type === 'crystal').reduce((a, r) => a + r.n, 0);

// ① ソウル
const sum = o => Object.values(o).reduce((a, b) => a + b, 0);
ok('★10までのソウル ★1:1,500 / ★2:2,000 / ★3:3,000 / ★4:4,000 / ★5:5,000', [1, 2, 3, 4, 5].map(b => sum(E.SOULS_TO_NEXT[b])).join() === '1500,2000,3000,4000,5000');
ok('★5の段ごとは 500 / 500 / 1,000 / 1,500 / 1,500', Object.values(E.SOULS_TO_NEXT[5]).join() === '500,500,1000,1500,1500');
ok('★5のPUかぶり1体で1,000、PUなら本体+かぶり5体で完凸', E.DUP_SOULS[5] + E.PICKUP_BONUS_SOULS[5] === 1000 && 5 * 1000 === sum(E.SOULS_TO_NEXT[5]));
const w = E.RARITY_WEIGHTS, wt = sum(w);
const avgUni = Object.keys(w).reduce((a, r) => a + w[r] / wt * E.UNIVERSAL_SOULS[r], 0);
ok('無形のソウル(1回あたり平均)は6.00個', Math.abs(avgUni - 6.0) < 0.01, avgUni);
ok('無形の共鳴石も同じ表', JSON.stringify(E.RESONANCE_PER_PULL) === JSON.stringify(E.UNIVERSAL_SOULS));

// ② 一度きりの石
const mains = E.STAGES.filter(s => s.type === 'main');
const mainOnce = mains.reduce((a, s) => a + (s.firstClear || 0), 0) + 14 * E.TIER_STAR_CHESTS.reduce((a, c) => a + c.crystals, 0);
ok('メイン143本(★箱こみ)は23,610石', mainOnce === 23610, mainOnce);

// ③ 恒常
const daily = E.DAILY_MISSIONS.filter(m => !m.when).reduce((a, m) => a + cr(m.reward), 0) + cr(E.DAILY_ALL_CLEAR);
const weekly = E.WEEKLY_MISSIONS.reduce((a, m) => a + cr(m.reward), 0);
const login = sum(E.DAILY_LOGIN_REWARDS) / E.DAILY_LOGIN_REWARDS.length;
ok('デイリーは150石/日', daily === 150, daily);
ok('ウィークリーは1,400石/週', weekly === 1400, weekly);
ok('ミッションからゴールドがなくなった', [...E.DAILY_MISSIONS, ...E.WEEKLY_MISSIONS].every(m => !m.reward.some(r => r.type === 'gold')) && !E.DAILY_ALL_CLEAR.some(r => r.type === 'gold'));
const steady = daily * 30 + login * 30 + weekly * 30 / 7;
ok('恒常は月12,600石', Math.round(steady) === 12600, steady);

// ② イベント
const ev = E.EVENTS.find(e => (e.exStages || []).length);
const stageCr = ev.stages.reduce((a, s) => a + (s.firstClear || 0), 0);
const exCr = ev.exStages.reduce((a, s) => a + (s.firstClear || 0), 0);
api.STATE.evMission = {};
const mis = E.eventMissions(ev);
const misCr = mis.reduce((a, m) => a + cr(m.reward), 0);
const misTickets = mis.reduce((a, m) => a + m.reward.filter(r => /^gacha_char/.test(r.key || '')).length, 0);
const shopTickets = E.eventShopItems(ev).filter(it => it.sku === 'gacha_char').reduce((a, it) => a + (it.limit || 0), 0);
ok('イベント: ステージ990 / EX700 / ミッション1,000 / 召喚券10枚', stageCr === 990 && exCr === 700 && misCr === 1000 && misTickets === 0 && shopTickets === 10, { stageCr, exCr, misCr, misTickets, shopTickets });
const perEvent = stageCr + exCr + misCr + shopTickets * 135;
ok('1イベント4,040石相当(指示書の4,050)', perEvent === 4040, perEvent);

// 合計と天井
const abyss = 800, pvpRaid = 0;   // 総力戦・封印戦(月10,000)は未実装
const month = steady + perEvent * 4 + abyss + pvpRaid;
const spark = 200 * 135 / (month / 30);
ok('月の石(総力戦・封印戦なし)は29,560石 → 天井27.4日', Math.round(month) === 29560 && Math.abs(spark - 27.4) < 0.05, { month: Math.round(month), spark: Math.round(spark * 10) / 10 });
const full = month + 10000;
ok('総力戦・封印戦が入ると39,560石(指示書39,600) → 天井20.5日', Math.abs(200 * 135 / (full / 30) - 20.5) < 0.05, Math.round(200 * 135 / (full / 30) * 10) / 10);

// ⑤ 素材のレート
ok('黄金の洞窟5段は1⚡あたり1,750G', E.DUNGEONS.gold.rewards[4].gold / 20 === 1750);
ok('霊素工房 Lv5: 霊素鉱90/時・霊素核I 1.5/時', E.FACILITIES.smithy.perHour[5] === 90 && E.FACILITIES.smithy.corePerHour[5] === 1.5);
// ⑦ 補填
const g = E.COMPENSATION_GIFTS.find(x => x.id === 'econ_review_2026_10');
ok('補填: 星結晶3,000・無形のソウル300・霊素核TierI 30', g && cr(g.reward) === 3000 && g.reward.some(r => r.type === 'universal' && r.n === 300) && g.reward.some(r => r.key === 'relic_core_1' && r.n === 30));
// ④ 実績
const ach = E.ACHIEVEMENTS.reduce((a, x) => a + x.tiers.reduce((b, t) => b + cr(t.reward), 0), 0);
ok('実績は19,610石(総力戦・封印戦・バベルの3,940は未実装)', ach === 19610, ach);
console.log(bad ? `${bad}件 失敗` : 'すべて通過');
