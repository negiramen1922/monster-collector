/* ルーン合成: 下のTierのルーンも材料にできる(Tier(N)1個 = Tier(N-1)3個) */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e = {
  DEFAULT_STATE, fuseRunes, runeFuseNeed, runeFusePoint, runeFuseMaterials, runeFusePicked,
  autoRuneFusePick, RUNE_FUSE_COUNT, RUNE_TIERS, runeFuseNeedFor, runeFuseSteps, runeFuseGoldFor, runeFuseCost,
  setDetail: v => { runeDetail = v; }, getDetail: () => runeDetail,
};`);
const E = global.__e;
let bad = 0;
const ok = (n, c, i) => { if(!c) bad++; console.log((c ? '✅' : '❌') + ' ' + n + (i !== undefined ? '  ' + JSON.stringify(i) : '')); };

api.STATE = E.DEFAULT_STATE();
const S = api.STATE;
S.gold = 1e9; S.runes = []; S.runeDust = 0;
let n = 0;
const mk = (tier, main) => { const r = { uid: 'r' + (++n), main: main || 'atk', tier, rarity: 1, subs: [], lock: false }; S.runes.push(r); return r; };

const base = mk(5);
for(let i = 0; i < 8; i++) mk(4);
mk(4, 'hp');   // 防御型なので材料にならない

ok('Tier(N)1個 = Tier(N-1) 3個ぶん', E.runeFusePoint(5) === E.runeFusePoint(4) * E.RUNE_FUSE_COUNT,
  [E.runeFusePoint(4), E.runeFusePoint(5)]);
ok('土台Tier5に必要なのはTier4換算で6個', E.runeFuseNeed(base) / E.runeFusePoint(4) === 6, E.runeFuseNeed(base) / E.runeFusePoint(4));
ok('違うタイプ(防御型)は材料に出てこない', E.runeFuseMaterials(base).every(r => r.main === 'atk'), E.runeFuseMaterials(base).length);

let mats = S.runes.filter(r => r.tier === 4 && r.main === 'atk').slice(0, 5).map(r => r.uid);
let res = E.fuseRunes(base.uid, mats);
ok('Tier4×5では足りない', res.ok === false, res.why);

mats = S.runes.filter(r => r.tier === 4 && r.main === 'atk').slice(0, 6).map(r => r.uid);
res = E.fuseRunes(base.uid, mats);
ok('Tier4×6でTier6になる', res.ok === true && res.rune.tier === 6, res.ok ? res.rune.tier : res.why);
ok('使った6個だけ消える', S.runes.filter(r => r.tier === 4 && r.main === 'atk').length === 2,
  S.runes.filter(r => r.tier === 4 && r.main === 'atk').length);

// 同じTierだけでも今までどおり通る
S.runes = []; n = 0;
const b2 = mk(3); mk(3); mk(3);
res = E.fuseRunes(b2.uid, S.runes.filter(r => r.uid !== b2.uid).map(r => r.uid));
ok('同じTier2個でも今までどおり上がる', res.ok === true && res.rune.tier === 4, res.ok ? res.rune.tier : res.why);

// 混ぜてもよい: Tier5×1 + Tier4×3
S.runes = []; n = 0;
const b3 = mk(5); const hi = mk(5); const lo = [mk(4), mk(4), mk(4)];
res = E.fuseRunes(b3.uid, [hi.uid, ...lo.map(r => r.uid)]);
ok('Tier5×1 + Tier4×3 の混ぜ方も通る', res.ok === true && res.rune.tier === 6, res.ok ? res.rune.tier : res.why);

// 土台より上のTierは材料にできない
S.runes = []; n = 0;
const b4 = mk(3); const tooHi = mk(6);
ok('土台より上のTierは材料に出てこない', E.runeFuseMaterials(b4).length === 0, E.runeFuseMaterials(b4).map(r => r.tier));

// おまかせは低いTierから使う
S.runes = []; n = 0;
const b5 = mk(5); mk(5); [0,1,2].forEach(() => mk(4));
E.setDetail({ uid: b5.uid, fuse: [] });
E.autoRuneFusePick();
const picked = E.getDetail().fuse.map(u => S.runes.find(r => r.uid === u).tier).sort();
ok('おまかせは低いTierから使う(Tier4×3 + Tier5×1)', JSON.stringify(picked) === '[4,4,4,5]', picked);

// --- 何段でも一度に上げられる。手で1段ずつ上げたときと同じ個数 ---
S.runes = []; n = 0;
const m4 = mk(4);
for(let i = 0; i < 12; i++) mk(4);
ok('TierⅣ→Ⅴ はTierⅣ2個', E.runeFuseNeedFor(m4, 1) / E.runeFusePoint(4) === 2, E.runeFuseNeedFor(m4, 1) / E.runeFusePoint(4));
ok('TierⅣ→Ⅵ はTierⅣ8個(2+3+3)', E.runeFuseNeedFor(m4, 2) / E.runeFusePoint(4) === 8, E.runeFuseNeedFor(m4, 2) / E.runeFusePoint(4));
ok('TierⅣ→Ⅶ はTierⅣ26個', E.runeFuseNeedFor(m4, 3) / E.runeFusePoint(4) === 26, E.runeFuseNeedFor(m4, 3) / E.runeFusePoint(4));
ok('ゴールドも1段ずつ上げたときの合計', E.runeFuseGoldFor(m4, 2) === E.runeFuseCost({ tier: 4 }).gold + E.runeFuseCost({ tier: 5 }).gold,
  [E.runeFuseGoldFor(m4, 2), E.runeFuseCost({ tier: 4 }).gold + E.runeFuseCost({ tier: 5 }).gold]);

let pool = S.runes.filter(r => r.uid !== m4.uid);
S.gold = 1e9;
res = E.fuseRunes(m4.uid, pool.slice(0, 7).map(r => r.uid));
ok('TierⅣ材料7個ではⅤ止まり', res.ok === true && res.rune.tier === 5 && res.steps === 1, res.ok ? [res.rune.tier, res.steps] : res.why);

S.runes = []; n = 0;
const m4b = mk(4);
for(let i = 0; i < 12; i++) mk(4);
pool = S.runes.filter(r => r.uid !== m4b.uid);
res = E.fuseRunes(m4b.uid, pool.slice(0, 8).map(r => r.uid));
ok('TierⅣ材料8個でⅥまで一度に上がる', res.ok === true && res.rune.tier === 6 && res.steps === 2, res.ok ? [res.rune.tier, res.steps] : res.why);
ok('使った8個だけ消える', S.runes.length === 5, S.runes.length);

console.log(bad ? `${bad}件 失敗` : 'すべて通過');
process.exitCode = bad ? 1 : 0;
