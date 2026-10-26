/* ハロウィンの6体のキット・星刻と、そのために足した戦闘の仕組みのテスト。
   中身の正は docs/提案資料/次回イベント案_ハロウィン.md(スキルの数値は Lv1→Lv10、パッシブは Lv1→Lv5)。
   星刻は公開時刻(HALLOWEEN_START_AT)まで出ないので、このテストでは公開ずみにして読み込む */
const load = require('./harness.js');
const api = load('game.js', s => s.replace("const HALLOWEEN_START_AT = '2026-10-27T12:00:00+09:00'", "const HALLOWEEN_START_AT = '2000-01-01T00:00:00+09:00'")
  + `;global.__t={MON_BY_ID,MONSTER_KITS,MONSTER_PERKS,RELICS,performAction,takeTurn,strike,passiveMod,addBuff,applyStatus,hasBuff,hitHp,killUnit,shieldTotal,
  skillCt,applyStatBonus,relicSkillMult,ultSpCostFor,STAGE_RULE_WHEN,priorityReady,effDef,evadeOf,get b(){return battleUI}};`);
const T = global.__t;
let fail = 0;
const ok = (c, m, v) => { console.log((c ? '✅' : '❌') + ' ' + m + (v !== undefined ? '  ' + JSON.stringify(v) : '')); if(!c) fail++; };
const realRand = Math.random;
const withRand = (v, f) => { Math.random = () => v; try { return f(); } finally { Math.random = realRand; } };
function setup(ids, opts){
  const o = opts || {};
  api.run([], 'q1_01', 1);
  const S = api.STATE; S.owned = {};
  ids.forEach(x => S.owned[x] = { star: o.star || Math.max(4, api.MON_BY_ID[x].rarity), souls: 0, level: 30, exp: 0, skillLv: o.lv || 1, skill2Lv: o.lv || 1, ultLv: o.lv || 1, passiveLv: o.pv || 1 });
  S.formationKey = 'f2'; S.slots = api.lineupFromList(ids, 'f2'); S.autoUlt = true; S.clearedStages = api.STAGES.map(s => s.id);
  api.startBattle('q1_01', { skipIntro: true });
  const B = T.b; B.transitioning = false; B.paused = true; B.queue = [];
  B.enemies.forEach(e => { e.maxHp = e.hp = 99999; e.str = 60; e.pdef = 0; e.mdef = 0; e.alive = true; e.buffs = {}; e.statuses = {}; e.passive = {}; e.shields = []; e.row = 'front'; e.element = 'none'; });
  B.enemies.slice(1).forEach(e => { e.alive = false; });
  return { B, u: B.party.find(x => x.ref === ids[0]), e: B.enemies[0] };
}
const act = (u, kind, a, slot) => withRand(0.5, () => T.performAction(u, kind, a, slot));

console.log('--- データ ---');
const exp = { m190:['ジャック・オ・ランタン',5,'fire','trickster','hume'], m191:['ミミック',4,'earth','trickster','demon'], m192:['ヴァンパイア',4,'dark','attacker','undead'],
  m193:['パンプキンヘッド',3,'fire','support','elf'], m194:['フランケン',3,'thunder','tank','undead'], m195:['黒猫',3,'dark','trickster','beast'] };
Object.entries(exp).forEach(([id, [name, r, el, role, sp]]) => { const m = T.MON_BY_ID[id];
  ok(m && m.name === name && m.rarity === r && m.element === el && m.role === role && m.species === sp && m.releaseAt === '2026-10-27T12:00:00+09:00', `${name}(★${r}・${el}・${role}・${sp}・10/27 12:00 公開)`); });
ok(Object.keys(exp).every(id => [6, 7, 8, 9, 10].every(n => T.MONSTER_PERKS[id][n])), '6体とも星刻★6〜★10がある');

console.log('--- ジャック ---');
{
  const { u, e } = setup(['m190', 'm191']);
  ok(u.skills[0].hits === 5 && u.skills[0].ct === 3 && u.ult.hits === 12, 'スキル1は5回・CT3、奥義は12回');
  const before = e.hp; act(u, 'normal', u.normal);
  ok(u.flags.lanternN === 3, '同じターンのヒットを数える(通常攻撃3回)');
  ok(Math.abs(T.passiveMod(u, 'dmgBonus', e) - 0.3) < 1e-9, '3ヒットのあとは与ダメージ+30%(1ヒットごとに+10%)');
  u.turnCount += 1;
  ok(T.passiveMod(u, 'dmgBonus', e) === 0, 'ターンが変わると1ヒット目に戻る');
}
{
  const { u } = setup(['m190', 'm191']);
  ok(T.skillCt(u, 0) === 3, '遺物なしのスキル1はCT3');
  T.applyStatBonus(u, { skill1Ct: 1 * T.relicSkillMult(1) });
  ok(T.skillCt(u, 0) === 2 && T.skillCt(u, 1) === 4, '専用遺物(遺物スキルLv1): スキル1だけCT-1');
  u.skill1CtCut = 0; T.applyStatBonus(u, { skill1Ct: 1 * T.relicSkillMult(10) });
  ok(T.skillCt(u, 0) === 1, '遺物スキルLv10: CT-2(CT1)');
  u.skill1CtCut = 0; T.applyStatBonus(u, { skill1Ct: 1 * T.relicSkillMult(9) });
  ok(T.skillCt(u, 0) === 2, '遺物スキルLv9まではCT-1');
  u.ctReduce = 1;
  ok(T.skillCt(u, 0) === 2 && T.skillCt(u, 1) === 3, 'CT短縮は重ならない(陣形のCT-1と遺物のCT-1で、スキル1はCT2のまま)');
  ok(T.RELICS.rel_devil_ember.effects.some(x => x.stat === 'skill1Ct' && x.cond.value === 'm190'), '悪魔の残り火はジャックの専用遺物');
}
{
  const { u } = setup(['m190', 'm191'], { star: 10 });
  ok(u.skills[0].hits === 6 && u.skills[1].hits === 5 && u.lanternStep === 0.17 && u.carnival, '★6 6回 / ★7 +17% / ★8 5回 / ★10 会心でヒット数+1');
  const n0 = withRand(0, () => { const B = T.b; const len = B.log.length; T.performAction(u, 'skill', u.skills[0], 0); return B.log.slice(len).join(''); });
  ok(/\+3回/.test(n0), '★10: 会心が出ると、そのスキル1のヒット数が増える(+3回まで)');
}

console.log('--- ミミック ---');
{
  const { u, e } = setup(['m191', 'm190']);
  ok(u.skills[0].priority && T.priorityReady(u) === 1, 'スキル1は必ず先制(戦闘の最初のラウンドは先に動く)');
  ok(Math.abs(T.passiveMod(u, 'dmgBonus', e) - 0.3) < 1e-9, '最初の行動は与ダメージ+30%');
  act(u, 'skill', u.skills[0], 0); T.takeTurn && null;
  T.performAction(u, 'normal', u.normal); u.passive.onActed(u);
  ok(T.passiveMod(u, 'dmgBonus', e) === 0, '2回目の行動からは乗らない');
  ok(e.statuses.bind && e.statuses.bind.turns === 2, '宝箱の罠で拘束2ターン');
}

console.log('--- ヴァンパイア ---');
{
  const { u, e } = setup(['m192', 'm190']);
  u.hp = u.maxHp;
  act(u, 'skill', u.skills[0], 0);
  ok(T.shieldTotal(u) > 0 && T.shieldTotal(u) <= Math.round(u.maxHp * 0.2), 'HPが満タンのときの吸収は、最大HPの20%までシールドになる', [T.shieldTotal(u), u.maxHp]);
  ok(Math.abs(T.passiveMod(u, 'dmgBonus', e) - 0.1) < 1e-9, 'シールドがある間 与ダメージ+10%');
}
{
  const { B, u, e } = setup(['m192', 'm190'], { star: 10 });
  u.hp = 3; T.hitHp(u, 9999, e, {});
  ok(u.alive && u.vanished && !B.allyFell, '★10: HPが0になる攻撃でコウモリになって消える(倒れたことにならない)');
  T.takeTurn(u);
  ok(!u.vanished && u.hp >= Math.round(u.maxHp * 0.5), '次の自分のターンにHP50%で戻る', u.hp);
}

console.log('--- パンプキンヘッド ---');
{
  const { B, u, e } = setup(['m193', 'm190']);
  const jack = B.party.find(x => x.ref === 'm190'); jack.hp = 10; jack.sp = 0;
  act(u, 'skill', u.skills[0], 0);
  ok(jack.hp > 10 && jack.sp === 10, 'スキル1: HPの割合が一番低い味方を回復し、SP+10');
  T.applyStatus(e, 'burn', u);
  ok(Math.abs(T.passiveMod(u, 'allyDmgBonus', jack, e) - 0.1) < 1e-9, 'やけど状態の敵への味方全体の与ダメージ+10%');
}

console.log('--- フランケン ---');
{
  const { u, e } = setup(['m194', 'm190']);
  for(let i = 0; i < 7; i++) withRand(0.99, () => T.strike({ actor: e, act: { atk: 'phys' }, kind: 'normal' }, u, { pow: 0.1 }));
  ok(u.stacks.charge === 5, '攻撃を受けるたびに電気(最大5つ)', u.stacks.charge);
  ok(T.passiveMod(u, 'defBonus', 'phys') === 10, '電気1つにつき物理防御+2');
  act(u, 'skill', u.skills[1], 1);
  ok(u.stacks.charge === 0, '放電で電気をすべて使う');
}

console.log('--- 黒猫 ---');
{
  const { u, e } = setup(['m195', 'm190']);
  u.sp = 0;
  withRand(0.5, () => { e.buffs.accDown = { v: 0.95, turns: 3 }; T.strike({ actor: e, act: { atk: 'phys' }, kind: 'normal' }, u, { pow: 1 }); });
  ok(u.sp === 10, '敵の攻撃が外れると自分のSP+10', u.sp);
}

console.log('--- ステージ効果の条件 ---');
{
  const { u, e } = setup(['m195', 'm190']);
  ok(!T.STAGE_RULE_WHEN.statused(e) && (T.applyStatus(e, 'burn', u), T.STAGE_RULE_WHEN.statused(e)), 'statused: 状態異常にかかっている');
  u.buffs = {}; const nb = T.STAGE_RULE_WHEN.noBuff(u);
  T.addBuff(u, 'strUp', 0.1, 2, u);
  ok(nb && !T.STAGE_RULE_WHEN.noBuff(u), 'noBuff: 強化が1つもない');
}

console.log(fail ? `${fail}件 失敗` : 'すべて通過');
process.exit(fail ? 1 : 0);
