// 遠征(放置報酬)。docs/提案資料/遠征案.md
// 使い方: node tools/expedition_test.js
const load = require('./harness.js');
const api = load('game.js', s => s.replace("const EXPEDITION_DEV = typeof location", "const EXPEDITION_DEV = true || typeof location") + ';global.__x={EXPEDITION_DESTS,EXPEDITION_SLOTS,expeditionLive,expUnlocked,expState,expSlotCount,expDailyKeys,expDailyDest,expDestByKey,expTodayDests,expCondMet,expGreat,expRewardOf,expStart,expCollect,expCancel,expUpgrade,expBusyIds,DEFAULT_STATE,MON_BY_ID,MONSTERS,getItem,matKey};');
const X = global.__x;
let bad = 0;
const ok = (name, cond, info) => { bad += cond ? 0 : 1; console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : '')); };
const realNow = Date.now;
let now = new Date('2026-10-28T12:00:00+09:00').getTime();
Date.now = () => now;
const M = X.MONSTERS.filter(m => !m.releaseAt);
const pick = (f, n) => M.filter(f).slice(0, n).map(m => m.id);
function fresh(){
  api.STATE = X.DEFAULT_STATE();
  api.STATE.clearedStages = ['q1_05', 'q1_10', 'q2_10', 'q3_10']; api.STATE.gold = 1e7; api.STATE.crystals = 0;
  M.forEach(m => { api.STATE.owned[m.id] = { base: m.rarity, star: m.rarity, souls: 0, level: 250, exp: 0, skillLv: 1, ultLv: 1, passiveLv: 1 }; });
}
fresh();

console.log('--- 公開・解放 ---');
ok('?expedition=1 で出る(公開日が決まるまでは試験場とこれだけ)', X.expeditionLive() === true);
ok('行き先は固定8か所', X.EXPEDITION_DESTS.length === 8);
ok('日替わり4か所(種族2・ロール2)。同じ日は同じ', X.expDailyKeys('2026-10-28').length === 4 && X.expDailyKeys('2026-10-28').join() === X.expDailyKeys('2026-10-28').join()
  && X.expDailyKeys('2026-10-28').filter(k => k.startsWith('sp:')).length === 2);
ok('日によって入れ替わる', X.expDailyKeys('2026-10-28').join() !== X.expDailyKeys('2026-10-29').join() || X.expDailyKeys('2026-10-29').join() !== X.expDailyKeys('2026-10-30').join());
ok('遠征所の枠: Lv1〜2で3・Lv3〜4で4・Lv5で5', X.EXPEDITION_SLOTS.slice(1).join() === '3,3,4,4,5');

console.log('--- 条件と報酬 ---');
const fire = X.expDestByKey('fire');
const fires = pick(m => m.element === 'fire', 3), others = pick(m => m.element !== 'fire', 3);
ok('炎属性2体以上で大成功', X.expGreat(fire, fires) && !X.expGreat(fire, others));
const g12 = X.expRewardOf(X.expDestByKey('gold'), 12, true, 0.5), g12n = X.expRewardOf(X.expDestByKey('gold'), 12, false, 0.5);
ok('金色の鉱脈 12時間: 大成功 30,000 / ふつう 20,000', g12.gold === 30000 && g12n.gold === 20000, [g12.gold, g12n.gold]);
const g1 = X.expRewardOf(X.expDestByKey('gold'), 1, true, 0.5);
ok('1時間は12時間の1/12×1.3(短いほど1時間あたり多い)', g1.gold === Math.round(30000 / 12 * 1.3 / 100) * 100, g1.gold);
const f12 = X.expRewardOf(fire, 12, true, 0.5);
const t1 = Object.entries(f12.items).reduce((a, [k, n]) => a + n * (k.endsWith('_3') ? 25 : k.endsWith('_2') ? 5 : 1), 0);
ok('属性の行き先 12時間・大成功のワザ素材は TierI換算65', t1 === 65, f12.items);
ok('限界の門の向こうは8・12時間だけ、星降る丘は12時間だけ', X.expDestByKey('awaken').hours.join() === '8,12' && X.expDestByKey('stars').hours.join() === '12');
ok('星降る丘: 大成功15・ふつう10', X.expRewardOf(X.expDestByKey('stars'), 12, true, 0.5).crystals === 15 && X.expRewardOf(X.expDestByKey('stars'), 12, false, 0.5).crystals === 10);
ok('日替わりの集落は、その種族2体以上で大成功', (() => { const d = X.expDailyDest('sp:beast'); return d && X.expGreat(d, pick(m => m.species === 'beast', 2).concat(others.slice(0, 1))) && !X.expGreat(d, others); })());

console.log('--- 出す・受け取る ---');
fresh();
ok('最初は3枠', X.expSlotCount() === 3);
ok('出発できる', X.expStart(0, 'fire', fires, 4));
ok('同じ子は同時に2つの遠征に出せない', !X.expStart(1, 'fire', fires, 4));
ok('人数が違うと出せない', !X.expStart(1, 'gold', others, 4));
ok('遠征に出した子は busy(戦闘には使える)', fires.every(id => X.expBusyIds().has(id)));
ok('時間前は受け取れない', X.expCollect(0) === null);
const before = fires.reduce((a, _) => a, 0), mat = X.matKey('el', 'fire', 2), had = X.getItem(mat);
now += 4 * 3600000;
const r = X.expCollect(0);
ok('時間がたつと受け取れて、枠が空く', r && r.great && !X.expState().slots[0] && X.getItem(mat) > had, r && r.reward);
ok('やめる: 報酬なしで枠が空く', X.expStart(1, 'gold', pick(m => m.element === 'earth', 1).concat(pick(m => m.role === 'tank' && m.element !== 'earth', 1)), 12) && (X.expCancel(1), !X.expState().slots[1]));
X.expUpgrade(); X.expUpgrade();
ok('遠征所をLv3にすると4枠', X.expState().lv === 3 && X.expSlotCount() === 4);
X.expUpgrade(); X.expUpgrade();
ok('Lv5で5枠', X.expState().lv === 5 && X.expSlotCount() === 5);

console.log('--- 1日の価値(中: スタミナ100ぶん) ---');
// 5枠×12時間×1日2回・全部大成功で、属性の行き先なら TierI換算 65×10 = 650(神話級ハードのボス10周ぶん)
ok('12時間・大成功 = スタミナ10ぶん(メイン1周)', t1 === 65 && g12.gold === 30000);

Date.now = realNow;
console.log(bad ? `${bad}件 失敗` : 'すべて通過');
process.exit(bad ? 1 : 0);
