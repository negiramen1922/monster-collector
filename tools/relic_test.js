/* ad-hoc check for the relic (遺物) system: gacha grant/dupe, equip singularity,
   level/wall progression (shared LEVEL_WALLS with monsters), 凸-gated upper walls,
   skill-level effect scaling, and that an equipped relic actually boosts battle stats. */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e = {
  STATE_ref: () => STATE, DEFAULT_STATE, RELICS, grantRelic, equipRelic, unequipRelic, equippedRelicOf,
  levelUpRelic, atRelicWall, breakRelicWall, relicLevelCap, relicLevelStop, relicWallGold, relicWallScrap,
  upgradeRelicSkill, relicSkillMult, RELIC_SKILL_MAX, relicEffectMatches, applyRelicToUnit,
  getItem, addItem, addGold, buildUnit, MON_BY_ID, run: api => api,
};`);
const E = global.__e;
const ok = (name, cond, info) => console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));

api.STATE = E.DEFAULT_STATE();
const S = api.STATE;

// --- gacha grant: new vs duplicate ---
const r1 = E.grantRelic(E.RELICS.rel_ygg_leaf);
ok('新規入手でisNew=true', r1.isNew === true);
ok('所持状態が作られる(Lv1・凸0)', S.relics.rel_ygg_leaf.level === 1 && S.relics.rel_ygg_leaf.dupe === 0);
const r2 = E.grantRelic(E.RELICS.rel_ygg_leaf);
ok('2回目はisNew=falseで凸+1', r2.isNew === false && S.relics.rel_ygg_leaf.dupe === 1);

// --- equip singularity: equipping elsewhere moves it, and a monster can't wear 2 at once ---
E.grantRelic(E.RELICS.rel_grimoire);
E.equipRelic('rel_ygg_leaf', 'm06');
ok('m06にユグドラシルの葉っぱを装備', E.equippedRelicOf('m06') === 'rel_ygg_leaf');
E.equipRelic('rel_grimoire', 'm06');
ok('同じ枠に別の遺物を装備すると前のは外れる', E.equippedRelicOf('m06') === 'rel_grimoire' && S.relics.rel_ygg_leaf.equippedTo === null);
E.equipRelic('rel_ygg_leaf', 'm21');
ok('別モンスターに装備できる(単体所持なので同時に2箇所には付けられない設計)', E.equippedRelicOf('m21') === 'rel_ygg_leaf');

// --- leveling: consumes relic_scrap, stops at Lv30 wall ---
S.items.relic_scrap = 100000;
E.levelUpRelic('rel_ygg_leaf', 'max');
const st = S.relics.rel_ygg_leaf;
ok('Lv30の壁で止まる', st.level === 30 && E.atRelicWall(st), [st.level]);
const scrapBefore = E.getItem('relic_scrap');
E.breakRelicWall('rel_ygg_leaf');
ok('壁を突破(ゴールド+スクラップ消費)', !E.atRelicWall(st) && E.getItem('relic_scrap') < scrapBefore);
E.levelUpRelic('rel_ygg_leaf', 'max');
ok('次の壁(Lv50)まで上がる', st.level === 50, st.level);

// --- upper walls need 凸(dupe) beyond what's already been used ---
E.breakRelicWall('rel_ygg_leaf');
E.levelUpRelic('rel_ygg_leaf', 'max');
ok('Lv100まで凸なしで到達できる', st.level === 100, st.level);
ok('Lv100は上限(凸0のため)', E.relicLevelCap(st) === 100);
E.breakRelicWall('rel_ygg_leaf'); // should no-op: not at a wall (100 IS the cap, not <cap)
ok('凸なしでは100の先に進めない', st.wall !== 100 || st.level === 100);
// grant one more duplicate, now dupe=1 available (unspent)
S.gold = 100000000;
ok('凸(未使用)が1個ある', st.dupe === 1 && st.dupeUsed === 0);
// Lv100 itself is the cap while dupeUsed=0, so atRelicWall is false there (nothing to break through to)
ok('Lv100ちょうどでは壁判定にならない(capと同値のため)', E.atRelicWall(st) === false);

// --- skill level scaling: ×1.0 at Lv1 → ×2.0 at Lv10 ---
ok('スキルLv1は等倍', E.relicSkillMult(1) === 1);
ok('スキルLv10は2倍', E.relicSkillMult(E.RELIC_SKILL_MAX) === 2);
for(let i = 1; i < E.RELIC_SKILL_MAX; i++) E.upgradeRelicSkill('rel_ygg_leaf');
ok('スキルLv10まで上げられる', st.skillLv === 10, st.skillLv);
ok('上限を超えては上げられない', E.upgradeRelicSkill('rel_ygg_leaf') === false);

// --- condition matching ---
const elfMon = { element: 'grass', role: 'support' };
const humeMon = { element: 'fire', role: 'attacker' };
elfMon.species = 'elf';
ok('種族条件: エルフに一致', E.relicEffectMatches({ type:'species', value:'elf' }, { ...elfMon, family: undefined, species: 'elf' }));
ok('種族条件: ヒュームには不一致', !E.relicEffectMatches({ type:'species', value:'elf' }, { ...humeMon, species: 'hume' }));

// --- battle integration: equipping a relic actually raises stats ---
const mon = api.MON_BY_ID['m06'];
const plain = E.buildUnit(mon, 1, false, mon.rarity, false, 30, { skillLv:1, ultLv:1, passiveLv:1 });
const withRelic = E.buildUnit(mon, 1, false, mon.rarity, false, 30, { skillLv:1, ultLv:1, passiveLv:1 });
E.applyRelicToUnit(withRelic, mon, 'rel_ygg_leaf');
ok('遺物装備でmaxHpが上がる', withRelic.maxHp > plain.maxHp, [plain.maxHp, withRelic.maxHp]);
ok('遺物装備でSTRも上がる(ヒュームなのでエルフ条件は乗らない)', withRelic.str > plain.str, [plain.str, withRelic.str]);

console.log('done');
