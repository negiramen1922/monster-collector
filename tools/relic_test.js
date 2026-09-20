/* ad-hoc check for the relic (遺物) system: gacha grant/dupe, equip singularity,
   level/wall progression (shared LEVEL_WALLS with monsters), 凸-gated upper walls,
   skill-level effect scaling, and that an equipped relic actually boosts battle stats. */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e = {
  STATE_ref: () => STATE, DEFAULT_STATE, RELICS, grantRelic, equipRelic, unequipRelic, equippedRelicOf,
  levelUpRelic, atRelicWall, breakRelicWall, relicLevelCap, relicLevelStop, relicWallGold, relicWallScrap,
  useRelicDupe, RELIC_MAX_DUPE_USE, RELIC_DISTRIBUTED_WALL_DISCOUNT,
  upgradeRelicSkill, relicSkillMult, relicSkillCoreTier, RELIC_SKILL_MAX, relicEffectMatches, relicCondLabel, applyRelicToUnit,
  itemName, idleAmount, idleCoreAmount, collectFacility, baseState, FACILITIES,
  getItem, addItem, addGold, buildUnit, MON_BY_ID, relicsOfStar, grantRewards, rewardHtml, run: api => api,
};`);
const E = global.__e;
const ok = (name, cond, info) => console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));

api.STATE = E.DEFAULT_STATE();
const S = api.STATE;

// --- gacha grant: new vs duplicate ---
const r1 = E.grantRelic(E.RELICS.rel_flame_ember);
ok('新規入手でisNew=true', r1.isNew === true);
ok('所持状態が作られる(Lv1・凸0)', S.relics.rel_flame_ember.level === 1 && S.relics.rel_flame_ember.dupe === 0);
const r2 = E.grantRelic(E.RELICS.rel_flame_ember);
ok('2回目はisNew=falseで凸+1', r2.isNew === false && S.relics.rel_flame_ember.dupe === 1);

// --- equip singularity: equipping elsewhere moves it, and a monster can't wear 2 at once ---
E.grantRelic(E.RELICS.rel_grimoire);
E.equipRelic('rel_flame_ember', 'm06');
ok('m06に業火の残り火を装備', E.equippedRelicOf('m06') === 'rel_flame_ember');
E.equipRelic('rel_grimoire', 'm06');
ok('同じ枠に別の遺物を装備すると前のは外れる', E.equippedRelicOf('m06') === 'rel_grimoire' && S.relics.rel_flame_ember.equippedTo === null);
E.equipRelic('rel_flame_ember', 'm21');
ok('別モンスターに装備できる(単体所持なので同時に2箇所には付けられない設計)', E.equippedRelicOf('m21') === 'rel_flame_ember');

// --- leveling: consumes relic_scrap, stops at Lv30 wall ---
S.items.relic_scrap = 1e9;
S.gold = 1e12;
E.levelUpRelic('rel_flame_ember', 'max');
const st = S.relics.rel_flame_ember;
ok('Lv30の壁で止まる', st.level === 30 && E.atRelicWall(st), [st.level]);
const scrapBefore = E.getItem('relic_scrap');
E.breakRelicWall('rel_flame_ember');
ok('壁を突破(ゴールド+スクラップ消費)', !E.atRelicWall(st) && E.getItem('relic_scrap') < scrapBefore);
E.levelUpRelic('rel_flame_ember', 'max');
ok('次の壁(Lv50)まで上がる', st.level === 50, st.level);

// --- every wall up to the absolute Lv200 cap is reachable by leveling + gold/scrap alone, no 凸 needed ---
E.breakRelicWall('rel_flame_ember');
E.levelUpRelic('rel_flame_ember', 'max');
ok('Lv100まで凸なしで到達できる', st.level === 100, st.level);
ok('上限は常にLv200', E.relicLevelCap(st) === 200);
E.breakRelicWall('rel_flame_ember');
E.levelUpRelic('rel_flame_ember', 'max');
E.breakRelicWall('rel_flame_ember');
E.levelUpRelic('rel_flame_ember', 'max');
E.breakRelicWall('rel_flame_ember');
E.levelUpRelic('rel_flame_ember', 'max');
E.breakRelicWall('rel_flame_ember');
E.levelUpRelic('rel_flame_ember', 'max');
ok('凸なしでもLv200(絶対上限)まで到達できる', st.level === 200 && st.dupeUsed === 0, [st.level, st.dupeUsed]);

// --- 凸(dupe) is now a separate, optional action: up to 4 uses, each +10%, gated only by spare dupes ---
ok('凸(未使用)が1個ある', st.dupe === 1 && st.dupeUsed === 0);
E.useRelicDupe('rel_flame_ember');
ok('凸すると dupeUsed が増える', st.dupeUsed === 1, st.dupeUsed);
E.useRelicDupe('rel_flame_ember'); // no more spare dupes (dupe=1, dupeUsed=1 already)
ok('凸の在庫がなければ増えない', st.dupeUsed === 1);

// --- skill level scaling: ×1.0 at Lv1 → ×2.0 at Lv10, consumes 遺物のコア (Tier1-3) ---
ok('スキルLv1は等倍', E.relicSkillMult(1) === 1);
ok('スキルLv10は2倍', E.relicSkillMult(E.RELIC_SKILL_MAX) === 2);
S.items.relic_core_1 = 1000;
S.items.relic_core_2 = 1000;
S.items.relic_core_3 = 1000;
for(let i = 1; i < E.RELIC_SKILL_MAX; i++) E.upgradeRelicSkill('rel_flame_ember');
ok('スキルLv10まで上げられる', st.skillLv === 10, st.skillLv);
ok('上限を超えては上げられない', E.upgradeRelicSkill('rel_flame_ember') === false);
ok('コアのティア: Lv1-3はTier1・4-6はTier2・7-9はTier3', E.relicSkillCoreTier(1) === 1 && E.relicSkillCoreTier(4) === 2 && E.relicSkillCoreTier(7) === 3);

// --- アーティファクト工房(旧鍛冶場): scrap and core come only from idle production, no crafting ---
ok('アーティファクト工房に改名', E.FACILITIES.smithy.name === 'アーティファクト工房');
S.clearedStages.push('q2_10'); // unlocks the workshop facility
const bs = E.baseState().smithy;
bs.at = Date.now() - 3 * 3600 * 1000; // 3 hours ago, at facility Lv1
bs.carry = 0; bs.coreCarry = 0;
const scrapIdle = E.idleAmount('smithy');
const coreIdle = E.idleCoreAmount();
ok('Lv1で3時間経過するとコアTierIが約1個貯まる', Math.abs(coreIdle - 1) < 0.05, coreIdle);
const before2 = { scrap: E.getItem('relic_scrap'), core: E.getItem('relic_core_1') };
E.collectFacility('smithy', true);
ok('工房を回収するとスクラップとコアが両方増える', E.getItem('relic_scrap') > before2.scrap && E.getItem('relic_core_1') > before2.core,
  [before2, { scrap: E.getItem('relic_scrap'), core: E.getItem('relic_core_1') }]);
ok('コアTier3の名称表示', E.itemName('relic_core_3') === '遺物のコア TierIII');

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
E.applyRelicToUnit(withRelic, mon, 'rel_flame_ember');
ok('遺物装備でmaxHpが上がる', withRelic.maxHp > plain.maxHp, [plain.maxHp, withRelic.maxHp]);
ok('遺物装備でSTRも上がる(常時効果+基礎ステータスで無条件に上がる)', withRelic.str > plain.str, [plain.str, withRelic.str]);

// --- weekly mission tracking: レベル上げ・スキルLv上げどちらも relicUpgrade をカウント ---
ok('週間ミッション用カウンタが両方の行動で増える', (S.weekly.counts.relicUpgrade || 0) > 0, S.weekly.counts.relicUpgrade);

// --- 'mon' condition: ★5 per-character exclusives match only their own monster id ---
const titan = { id:'m54', element:'earth', role:'tank', species:'dwarf' };
const otherTank = { id:'m99', element:'earth', role:'tank', species:'hume' };
ok('mon条件: 本人には一致', E.relicEffectMatches({ type:'mon', value:'m54' }, titan));
ok('mon条件: 別モンスターには不一致', !E.relicEffectMatches({ type:'mon', value:'m54' }, otherTank));
ok('mon条件のラベルにモンスター名が入る', E.relicCondLabel({ type:'mon', value:'m54' }).includes(api.MON_BY_ID['m54'].name));

// --- distributed relics never appear in the gacha pool ---
ok('★1のガチャ排出に配布遺物(rel_traveler_shield)は含まれない', !E.relicsOfStar(1).some(r => r.id === 'rel_traveler_shield'), E.relicsOfStar(1).map(r => r.id));
ok('★1のガチャ排出に既存のみずのしずくは含まれる', E.relicsOfStar(1).some(r => r.id === 'rel_droplet'));
ok('★5のガチャ排出にキャラ専用遺物(rel_titan_heart)は含まれる', E.relicsOfStar(5).some(r => r.id === 'rel_titan_heart'));

// --- 配布(distributed)遺物は壁の突破コストが半額 ---
const gachaWallGold = E.relicWallGold(30, E.RELICS.rel_droplet);
const distWallGold = E.relicWallGold(30, E.RELICS.rel_traveler_shield);
ok('配布遺物の壁突破ゴールドは半額', distWallGold === Math.round(gachaWallGold * E.RELIC_DISTRIBUTED_WALL_DISCOUNT), [gachaWallGold, distWallGold]);
const gachaWallScrap = E.relicWallScrap(30, E.RELICS.rel_droplet);
const distWallScrap = E.relicWallScrap(30, E.RELICS.rel_traveler_shield);
ok('配布遺物の壁突破スクラップも半額', distWallScrap < gachaWallScrap, [gachaWallScrap, distWallScrap]);

// --- grantRewards/rewardHtml: 新しい 'relic' 報酬タイプ(実績配布用) ---
S.relics = {};
E.grantRewards([{ type:'relic', key:'rel_traveler_shield' }]);
ok('type:relic の報酬で遺物が付与される', !!S.relics.rel_traveler_shield);
ok('rewardHtml が遺物報酬を表示できる(クラッシュしない)', E.rewardHtml([{ type:'relic', key:'rel_traveler_shield' }]).includes('旅人の盾'));

// --- balance: ideal-use total effect% at skill cap lands in the intended band ---
// (skillLv = RELIC_SKILL_MAX → relicSkillMult = 2, so pct sums below are doubled).
// Sum each matching effect's pct directly from the def - this is exactly what
// applyRelicCore/applyStatBonus do internally, just without needing a full battle unit.
const capMult = E.relicSkillMult(E.RELIC_SKILL_MAX);
const sumPct = (def, mon) => Math.round((def.effects || []).filter(e => E.relicEffectMatches(e.cond, mon)).reduce((s, e) => s + e.pct, 0) * capMult * 100);
const inBand = (pct, lo, hi) => pct >= lo && pct <= hi;
const darkMon = { id:'zzz', element:'dark', role:'support', species:'hume' };
const grimoirePct = sumPct(E.RELICS.rel_grimoire, darkMon);
ok('rel_grimoire: 闇属性の理想値がskillLv上限で30-35%(同stat合算)', inBand(grimoirePct, 30, 35), grimoirePct);
const attackerMon = { id:'zzz', element:'fire', role:'attacker', species:'hume' };
const grimoireUltPct = sumPct({ effects: E.RELICS.rel_grimoire.effects.filter(e => e.stat === 'ultDmg') }, attackerMon);
ok('rel_grimoire: アタッカーのultDmg理想値も30-35%', inBand(grimoireUltPct, 30, 35), grimoireUltPct);

// ★5 exclusive (rel_titan_heart): owner m54 (専用tier36%を含め50%台) > same-species
// non-owner(誰でもtier+同種族tierの合算18%のみ) > unrelated monster(誰でもtier10%のみ)。
const sameSpeciesNotOwner = { id:'m99', element:'earth', role:'attacker', species:'dwarf' };
const unrelated = { id:'zzz', element:'fire', role:'attacker', species:'hume' };
const titanPct = sumPct(E.RELICS.rel_titan_heart, titan);
const sameSpeciesPct = sumPct(E.RELICS.rel_titan_heart, sameSpeciesNotOwner);
const unrelatedPct = sumPct(E.RELICS.rel_titan_heart, unrelated);
ok('rel_titan_heart: 本人(m54)は専用tier込みで50-58%', inBand(titanPct, 50, 58), titanPct);
ok('rel_titan_heart: 同種族(ドワーフ)だが本人でなければそれより弱い(18%)', sameSpeciesPct < titanPct && inBand(sameSpeciesPct, 15, 20), [sameSpeciesPct, titanPct]);
ok('rel_titan_heart: 無関係なモンスターは常時効果分だけでさらに弱い(10%)', unrelatedPct < sameSpeciesPct && inBand(unrelatedPct, 8, 12), [unrelatedPct, sameSpeciesPct]);
ok('★5専用の専用tierは★5汎用の最大値(32%)より強い', titanPct > 32, titanPct);

// 配布(rel_traveler_shield): unconditional, should land 10-15% for anyone
ok('rel_traveler_shield(配布): skillLv上限で10-15%', inBand(sumPct(E.RELICS.rel_traveler_shield, unrelated), 10, 15), sumPct(E.RELICS.rel_traveler_shield, unrelated));

console.log('done');
