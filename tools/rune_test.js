/* ルーン: 生成(Tier・レアリティ)・強化・編成ごとの装備・効果・分解・上限・ルーン採掘・PVP の回帰テスト */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e = { DEFAULT_STATE, normalizeState, makeRune, addRune, runeMainValue, fuseRunes, runeFuseCost, runeFuseMaterials, RUNE_FUSE_COUNT, RUNE_TIERS, runeSubValue,
  equipRune, unequipRune, runesOf, runeBonusOf, runeUsers, switchFormationSet, dismantleRunes, runeDustValue, runeFull, RUNE_MAX, RUNE_STATS,
  statsWithRelic, scaledStats, MON_BY_ID, dungeonStage, grantDungeonRewards, DUNGEONS, buildDefenseSnapshot, sanitizeRuneBonus, sanitizeDefense,
  battlePower, findStage, dungeonTierUnlocked, runeIconSvg, ensureRunes };`);
const E = global.__e;
let fails = 0;
const ok = (n, c, i) => { if(!c) fails++; console.log((c ? '✅' : '❌') + ' ' + n + (i !== undefined ? '  ' + JSON.stringify(i) : '')); };
api.STATE = E.DEFAULT_STATE(); E.normalizeState();
const S = () => api.STATE;

// 生成: レアリティ=最初のサブの数、Tier=数値の桁
const subsBy = [0, 1, 2, 3, 4].map(r => E.makeRune(1, r, 'atk').subs.length);
ok('レアリティ(白青紫金虹)で最初のサブの数が0〜4', subsBy.join() === '0,1,2,3,4', subsBy);
const t1 = E.makeRune(1, 0, 'hp'), t6 = E.makeRune(6, 0, 'hp');
ok('Tierが高いほどメインの数値が大きい(ⅩはⅠの4倍弱)', E.runeMainValue(t6) > E.runeMainValue(t1) && E.runeMainValue(E.makeRune(10, 0, 'hp')) / E.runeMainValue(t1) < 4, [E.runeMainValue(t1), E.runeMainValue(t6)]);
ok('メインとサブの効果はかぶらない', [...Array(200)].every(() => { const r = E.makeRune(3, 4); const k = [r.main, ...r.subs.map(s => s.stat)]; return new Set(k).size === k.length; }));

// 伸び率: 1Tierごとにほぼ同じ幅、ⅩでもⅠの4倍弱
const st = E.RUNE_STATS.atk.main;
ok('STRのメインはⅠ+5% → Ⅹ+18.5%(1Tierごとに+1.5%)', st[0] === 5 && st[9] === 18.5 && st.every((v, i) => i === 0 || Math.abs(v - st[i - 1] - 1.5) < 1e-9));
ok('効果は攻撃型4つ・防御型3つ', Object.values(E.RUNE_STATS).filter(x => x.type === 'atk').length === 4 && ['hp', 'pdef', 'mdef'].every(k => E.RUNE_STATS[k].type === 'def'));

// 合成: 土台 + 同じTier・同じタイプの材料2つ → 土台のTier+1。レア度とサブ効果は土台のまま
S().gold = 1e9; S().runeDust = 1e6; S().runes = [];
const f1 = E.addRune(E.makeRune(2, 4, 'atk')), f2 = E.addRune(E.makeRune(2, 0, 'critRate')), f3 = E.addRune(E.makeRune(2, 1, 'spd'));
const ng1 = E.addRune(E.makeRune(2, 4, 'hp')), ng2 = E.addRune(E.makeRune(3, 4, 'atk'));
ok('材料は同じTier・同じタイプ(攻撃型)なら効果は問わない', E.runeFuseMaterials(f1).map(r => r.uid).sort().join() === [f2.uid, f3.uid].sort().join());
ok('材料が足りないと合成できない', !E.fuseRunes(f1.uid, [f2.uid]).ok && f1.tier === 2);
ok('タイプが違う(防御型)・Tierが違うものは材料にできない', !E.fuseRunes(f1.uid, [ng1.uid, ng2.uid]).ok);
const subsBefore = JSON.stringify(f1.subs), subVal = E.runeSubValue(f1.subs[0], 2), g0 = S().gold;
let fr = E.fuseRunes(f1.uid, [f2.uid, f3.uid]);
ok('合成で土台のTierが1つ上がり、材料は消える', fr.ok && f1.tier === 3 && !S().runes.some(r => r.uid === f2.uid || r.uid === f3.uid) && S().gold === g0 - E.runeFuseCost({ tier: 2 }).gold);
ok('レア度(虹)とサブ効果の種類・当たり具合はそのまま', f1.rarity === 4 && JSON.stringify(f1.subs) === subsBefore && f1.main === 'atk');
ok('サブ効果の値はTierに合わせて伸びる', E.runeSubValue(f1.subs[0], 3) > subVal, [subVal, E.runeSubValue(f1.subs[0], 3)]);
ok('強化レベルはない', f1.lv === undefined && !('lv' in E.makeRune(1, 0)));
const top = E.addRune(E.makeRune(10, 2, 'spd')), m1 = E.addRune(E.makeRune(10, 2, 'atk')), m2 = E.addRune(E.makeRune(10, 2, 'critDmg'));
ok('TierⅩは最大(合成できない)', E.RUNE_TIERS === 10 && !E.fuseRunes(top.uid, [m1.uid, m2.uid]).ok);
const L = E.addRune(E.makeRune(4, 1, 'mdef')), l1 = E.addRune(E.makeRune(4, 1, 'hp')), l2 = E.addRune(E.makeRune(4, 1, 'pdef'));
l2.lock = true;
ok('ロック中は材料にできない', !E.fuseRunes(L.uid, [l1.uid, l2.uid]).ok && E.runeFuseMaterials(L).length === 1);
// α0.1.063〜064のルーン(旧仕様)は、分解の2倍の粉に交換して1回だけ知らせる
S().runes = [{ uid: 'rx', tier: 2, rarity: 1, main: 'hp', lv: 9, spent: 40, subs: [{ stat: 'atk', val: 3, rolls: 1 }], lock: false },
             { uid: 'ry', tier: 6, rarity: 4, main: 'atk', subs: [], lock: true }];
S().formations[0].runes = { m06: ['rx', 'ry', null, null] };
delete S().runeSpecVer; S().runeDust = 100; S().announceQueue = [];
E.normalizeState();
ok('旧仕様のルーンは粉に交換(2×(2×4 + 6×10) = 136)', S().runes.length === 0 && S().runeDust === 100 + 2 * (2 * 4 + 6 * 10), S().runeDust);
ok('装備は外れ、お知らせが1件', !S().formations[0].runes.m06 && S().announceQueue.filter(a => a.key === 'rune_legacy').length === 1);
S().runes = [E.makeRune(1, 0)]; E.normalizeState();
ok('交換は1回だけ(新しいルーンは残る)', S().runes.length === 1 && S().announceQueue.filter(a => a.key === 'rune_legacy').length === 1);

// 装備: 編成ごと、同じ編成の中では1体だけ
S().runes = []; S().formations.forEach(f => f.runes = {});
const a = E.addRune(E.makeRune(3, 2, 'hp')), b = E.addRune(E.makeRune(3, 2, 'atk'));
E.equipRune(a.uid, 'm06', 0);
E.equipRune(a.uid, 'm21', 1);
ok('同じ編成で別のキャラに付けると付け替わる', E.runesOf('m06')[0] === null && E.runesOf('m21')[1] === a.uid);
E.switchFormationSet(1);
ok('編成2ではまだ付いていない', E.runesOf('m21').every(x => !x));
E.equipRune(a.uid, 'm06', 0);
ok('別の編成なら同じルーンを使える', E.runesOf('m06')[0] === a.uid && E.runesOf('m21', 0)[1] === a.uid && E.runeUsers(a.uid).length === 2);
E.switchFormationSet(0);
ok('編成1に戻ると編成1の装備', E.runesOf('m21')[1] === a.uid && E.runesOf('m06')[0] === null);

// 効果: ステータスに乗る
const m = E.MON_BY_ID.m21, o = S().owned.m21;
const base = E.scaledStats(m, o.star, o.level);
const withR = E.statsWithRelic(m, o.star, o.level, null, E.runeBonusOf('m21'));
ok('HPのルーンでHPが上がる', withR.hp > base.hp, [base.hp, withR.hp]);
const bp0 = E.battlePower('m06'), bp1 = E.battlePower('m21');
E.equipRune(b.uid, 'm21', 2);
ok('ルーンを付けるとBPが上がる', E.battlePower('m21') > bp1);

// 分解: 装備中・ロック中は不可
const d = E.addRune(E.makeRune(2, 3, 'critRate'));
d.lock = true;
let res = E.dismantleRunes([a.uid, d.uid]);
ok('装備中・ロック中は分解されない', res.n === 0 && S().runes.some(r => r.uid === a.uid) && S().runes.some(r => r.uid === d.uid));
d.lock = false;
const dust0 = S().runeDust, val = E.runeDustValue(d);
res = E.dismantleRunes([d.uid]);
ok('分解するとルーンの粉が増える', res.n === 1 && S().runeDust === dust0 + val && val > 0, val);

// ルーン採掘: 段階=Tier、上限を超えた分は粉
S().clearedStages = ['tu3', 'q1_10', 'q2_10', 'q3_10', 'q4_10', 'q5_10', 'q6_10'];
ok('素材ダンジョンの代わりにルーン採掘(7段階、推奨Lv5〜250)', !E.DUNGEONS.mat && E.DUNGEONS.rune.rewards.length === 7 && E.DUNGEONS.rune.baseLv.join() === '5,30,60,100,150,200,250' && E.dungeonTierUnlocked(6, 'rune') && E.findStage('dg_rune_6').name.includes('ルーン採掘'));
S().runes = [];
let tiers = [];
for(let i = 0; i < 200; i++){ const r = E.grantDungeonRewards(E.dungeonStage('rune', 3)); tiers.push(...r.runes.map(x => x.tier)); S().runes = []; }
ok('採掘Lv4はTierⅣ(たまにⅢ)', tiers.every(t => t === 4 || t === 3) && tiers.filter(t => t === 4).length > tiers.length * 0.7);
S().runes = [...Array(E.RUNE_MAX)].map(() => E.makeRune(1, 0));
const dust1 = S().runeDust;
const full = E.grantDungeonRewards(E.dungeonStage('rune', 0));
ok('上限なら新しいルーンは増えず粉になる', S().runes.length === E.RUNE_MAX && full.runes.length === 0 && S().runeDust > dust1 + 5);
// レア度の出方(採掘Lv1とLv6)
const rarDist = t => { const n = [0, 0, 0, 0, 0]; S().runes = []; for(let i = 0; i < 3000; i++){ E.grantDungeonRewards(E.dungeonStage('rune', t)).runes.forEach(r => n[r.rarity]++); S().runes = []; } return n.map(x => Math.round(x / n.reduce((a, b) => a + b) * 1000) / 10); };
const r1 = rarDist(0), r7 = rarDist(6);
ok('上の段階ほど高レアが出やすく、最上段(Lv7)でも虹は5%前後', r7[3] + r7[4] > (r1[3] + r1[4]) * 3 && r7[4] > 3 && r7[4] < 7, { lv1: r1, lv7: r7 });

// PVP: 防衛編成にルーン効果が乗る・届いた値は範囲に収める
S().runes = []; S().formations.forEach(f => f.runes = {});
const pr = E.addRune(E.makeRune(4, 2, 'atk'));
E.equipRune(pr.uid, 'm06', 0, 0);
S().pvpDefenseSlots = ['m06', null, null, null, null]; S().pvpDefenseRelicsFrom = 0;
const snap = E.buildDefenseSnapshot();
ok('防衛編成のスナップショットにルーン効果', snap.slots[0].runes && snap.slots[0].runes.atk > 0, snap.slots[0].runes);
const bad = E.sanitizeDefense({ formationKey: 'x', slots: [{ id: 'm06', star: 1, level: 1, runes: { atk: 99999, spd: -5, junk: 3 } }] });
ok('不正に大きい値は丸められる', bad.slots[0].runes.atk < 1000 && bad.slots[0].runes.spd === undefined && bad.slots[0].runes.junk === undefined, bad.slots[0].runes);

// 見た目
ok('アイコンはSVG(中心にローマ数字のTier)', /<svg[\s\S]*Ⅳ/.test(E.runeIconSvg(E.makeRune(4, 3, 'mdef'))));
console.log(fails ? `NG ${fails}` : 'すべて通過');
process.exit(fails ? 1 : 0);
