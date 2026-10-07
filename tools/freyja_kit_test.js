/* フレイヤイベ(豊穣の女神)の8体のキットと、そのために足した戦闘の仕組みのテスト。
   中身の正は docs/提案資料/次回イベント案_フレイヤ.md(スキルの数値は Lv1→Lv10、パッシブは Lv1→Lv5) */
const load = require('./harness.js');
const api = load('game.js', s => s + `;global.__t={buildUnit,MONSTERS,MON_BY_ID,MONSTER_KITS,performAction,takeTurn,strike,runPassive,passiveMod,
  addBuff,effStr,effSpd,effDef,hasBuff,healUnit,hitHp,killUnit,conditionMet,shieldTotal,ultSpCostFor,selectAllies,battleRank,FREYJA_START_AT,
  STAGE_RULE_WHEN,get b(){return battleUI}};`);
const T = global.__t;
let fail = 0;
const ok = (c, m, v) => { console.log((c ? '✅' : '❌') + ' ' + m + (v !== undefined ? '  ' + JSON.stringify(v) : '')); if(!c) fail++; };
const realRand = Math.random;
const withRand = (v, f) => { Math.random = () => v; try { return f(); } finally { Math.random = realRand; } };
const near = (a, b) => Math.abs(a - b) < 1e-6;
function setup(id, party, lv, pv){
  api.run([], 'q1_01', 1);
  const S = api.STATE; S.owned = {};
  const ids = [id, ...party].slice(0, 5);
  ids.forEach(x => S.owned[x] = { star: Math.max(4, api.MON_BY_ID[x].rarity),   // ★4でスキル2が開く
    souls: 0, level: 30, exp: 0, skillLv: lv || 1, skill2Lv: lv || 1, ultLv: lv || 1, passiveLv: pv || 1 });
  S.formationKey = 'f2'; S.slots = api.lineupFromList(ids, 'f2'); S.autoUlt = true; S.clearedStages = api.STAGES.map(s => s.id);
  api.startBattle('q1_01', { skipIntro: true });
  const B = T.b; B.transitioning = false; B.paused = true; B.queue = [];
  B.enemies.forEach(e => { e.maxHp = e.hp = 99999; e.str = 60; e.pdef = 0; e.mdef = 0; e.alive = true; e.buffs = {}; e.statuses = {}; e.passive = {}; e.shields = []; e.row = 'front'; e.element = 'none'; });
  B.enemies.slice(1).forEach(e => { e.alive = false; });
  return { B, u: B.party.find(x => x.ref === id), e: B.enemies[0] };
}
const act = (u, kind, a, slot) => withRand(0.5, () => T.performAction(u, kind, a, slot));
const hitBy = (atk, t, type, pow) => withRand(0.5, () => T.strike({ actor: atk, act: { atk: type || 'phys' }, kind: 'normal' }, t, { pow: pow || 1 }));

console.log('--- データ ---');
const M = T.MON_BY_ID;
const exp = {
  m177:['フレイヤ',5,'earth','support','celestia','ミスティック科',270,44,6,9,46],
  m178:['フレイ',4,'earth','attacker','elf','ミスティック科',200,62,7,7,44],
  m179:['ヒルディスヴィーニ',4,'light','tank','dwarf','ワイルド科',285,38,12,16,30],
  m180:['エインヘリャル',2,'light','attacker','undead','アンデッド科',140,40,4,5,40],
  m181:['ヒルデ',3,'light','attacker','celestia','ミスティック科',165,50,5,7,45],
  m182:['ブリュンヒルド',3,'light','tank','celestia','ミスティック科',250,30,26,0,34],   // 物理防御は企画の30を★3タンクの予算65に収まる26に
  m183:['スコグル',3,'earth','shooter','celestia','ミスティック科',150,47,5,6,50],
  m184:['ゲンドゥル',3,'dark','support','celestia','ミスティック科',160,40,5,9,44],
};
Object.entries(exp).forEach(([id, e]) => {
  const m = M[id];
  ok(m && m.name === e[0] && m.rarity === e[1] && m.element === e[2] && m.role === e[3] && m.species === e[4] && m.family === e[5]
    && m.hp === e[6] && m.str === e[7] && m.pdef === e[8] && m.mdef === e[9] && m.spd === e[10] && m.releaseAt === T.FREYJA_START_AT,
    `${e[0]}: ★・属性・ロール・種族・科・ステータス・releaseAt`);
});
const SP = { m177:80, m178:100, m179:70, m180:100, m181:100, m182:70, m183:80, m184:80 };
Object.entries(SP).forEach(([id, sp]) => ok(T.MONSTER_KITS[id].ult.sp === sp && T.ultSpCostFor(M[id].role, sp) === sp, `${M[id].name}: 奥義SP ${sp}`));
const isMag = a => !a || a.pow === undefined || a.atk === 'mag';
ok(Object.keys(SP).every(id => { const k = T.MONSTER_KITS[id]; return [k.normal, k.skill1, k.skill2, k.ult].every(isMag); }), '攻撃はみんな魔法');

console.log('--- フレイヤ ---');
{
  let s = setup('m177', ['m178', 'm179', 'm05', 'm02']);
  const others = s.B.party.filter(a => a !== s.u);
  const low = others[2]; low.hp = Math.round(low.maxHp * 0.3);
  const hp0 = low.hp, eHp = s.e.hp;
  act(s.u, 'normal', s.u.normal);
  const heal = low.hp - hp0;
  ok(s.e.hp === eHp && heal > 0 && Math.abs(heal - Math.round(T.effStr(s.u) * 1.3)) <= 1, '通常攻撃をしない。HPの割合が一番低い味方を回復(STR×130%)', [heal, T.effStr(s.u)]);
  s = setup('m177', ['m178', 'm179', 'm05', 'm02'], 1, 5);
  const low5 = s.B.party.find(a => a !== s.u); low5.hp = 1;
  act(s.u, 'normal', s.u.normal);
  ok(Math.abs(low5.hp - 1 - Math.round(T.effStr(s.u) * 1.95)) <= 1, '回復量はパッシブLv5で195%');
  s = setup('m177', ['m178', 'm179', 'm05', 'm02']);
  const tops = s.B.party.filter(a => a !== s.u).sort((a, b) => T.effStr(b) - T.effStr(a)).slice(0, 2);
  act(s.u, 'skill', s.u.skills[0], 0);
  const got = s.B.party.filter(a => a.buffs.strUp);
  ok(got.length === 2 && tops.every(a => got.includes(a)) && !s.u.buffs.strUp && near(got[0].buffs.strUp.v, 0.3) && got[0].buffs.strUp.turns === 2,
    'スキル1: 自分以外で攻撃力が一番高い味方2人に攻撃力上昇+30%・2ターン', got.map(a => a.ref));
  s = setup('m177', ['m178', 'm179', 'm05', 'm02'], 10);
  act(s.u, 'skill', s.u.skills[0], 0);
  const g10 = s.B.party.find(a => a.buffs.strUp);
  ok(near(g10.buffs.strUp.v, 0.45) && g10.buffs.strUp.turns === 4, 'スキルLv10: +45%・4ターン');
  s = setup('m177', ['m178', 'm179', 'm05', 'm02']);
  const w = s.B.party.find(a => a !== s.u); w.hp = 1;
  act(s.u, 'skill', s.u.skills[1], 1);
  ok(w.hp > 1 && w.buffs.regen && near(w.buffs.regen.v, 0.06) && w.buffs.regen.turns === 3, 'スキル2: 回復＋継続回復(6%・3ターン)');
  s = setup('m177', ['m178', 'm179', 'm05', 'm02'], 10);
  s.B.party.forEach(a => { a.hp = a.maxHp; });
  act(s.u, 'ult', s.u.ult);
  ok(s.B.party.every(a => a.shields.length && a.shields[0].turns === 4 && Math.abs(a.shields[0].amt - Math.round(a.maxHp * 0.3)) <= 1),
    '奥義(Lv10): それぞれの最大HPの30%のシールドを4ターン', s.B.party.map(a => [a.shields[0] && a.shields[0].amt, Math.round(a.maxHp * 0.3)]));
}
console.log('--- フレイ ---');
{
  const s = setup('m178', ['m05', 'm02', 'm03']);
  ok(s.u.skills[0].nextForm(s.u) === '剣', '次の形の表示: 1回目は剣');
  act(s.u, 'skill', s.u.skills[0], 0);
  ok(T.b.fxCutIn.label.includes('勝利の剣') && T.b.log.join('').includes('勝利の剣') && !s.e.buffs.mdefDown && s.u.skills[0].nextForm(s.u) === '角', '1回目は勝利の剣(2回攻撃)。次は角');
  act(s.u, 'skill', s.u.skills[0], 0);
  ok(s.e.buffs.mdefDown && s.e.buffs.mdefDown.v === 8 && s.e.buffs.mdefDown.turns === 2 && s.u.skills[0].nextForm(s.u) === '剣', '2回目は鹿の角: 魔法防御低下-8・2ターン。次は剣');
  ok(T.MONSTER_KITS.m178.skill1.ct === 2, '剣と角: CT2');
  s.u.hp = s.u.maxHp;
  ok(near(T.passiveMod(s.u, 'dmgBonus', s.e), 0.2), '実りの神: HP満タンで与ダメージ+20%');
  s.u.hp = s.u.maxHp - 1;
  ok(T.passiveMod(s.u, 'dmgBonus', s.e) === 0, '満タンでなければ0');
  act(s.u, 'ult', s.u.ult);
  ok(s.u.buffs.strUp && near(s.u.buffs.strUp.v, 0.2) && s.e.buffs.mdefDown.v === 10, '奥義: 攻撃力上昇+20%・魔法防御低下-10');
  const s2 = setup('m178', ['m05', 'm02', 'm03']);
  ok(s2.u.skills[0].nextForm(s2.u) === '剣', '戦闘ごとに剣から始める');
}
console.log('--- ヒルディスヴィーニ ---');
{
  const s = setup('m179', ['m177', 'm05', 'm02']);
  const fr = s.B.party.find(a => a.ref === 'm177');
  const d0 = T.effDef(s.u, 'mag'), p0 = T.effDef(s.u, 'phys');
  s.u.hp = 1; T.healUnit(fr, s.u, 10);
  ok(near(T.effDef(s.u, 'mag') - d0, 4) && T.effDef(s.u, 'phys') === p0, '戦猪の守り: 回復を受けると魔法防御+4(物理は上がらない)');
  for(let i = 0; i < 10; i++){ s.u.hp = 1; T.healUnit(fr, s.u, 10); }
  ok(near(T.effDef(s.u, 'mag') - d0, 16), '上限+16', T.effDef(s.u, 'mag') - d0);
  act(s.u, 'skill', s.u.skills[0], 0);
  ok(s.u.buffs.taunt && s.u.buffs.mdefUp.v === 20 && s.u.buffs.pdefUp.v === 10, '黄金の剛毛: 挑発・魔法防御+20・物理防御+10');
  act(s.u, 'ult', s.u.ult);
  ok(s.B.party.every(a => a.buffs.cut && near(a.buffs.cut.v, 0.2)) && s.u.buffs.taunt.turns >= 3 && T.shieldTotal(s.u) > 0, '光の牙城: 味方全体に被ダメージ軽減-20%・挑発・自分にシールド');
  const s3 = setup('m179', ['m177', 'm05', 'm02']); s3.u.hp = s3.u.maxHp;
  T.healUnit(s3.B.party.find(a => a.ref === 'm177'), s3.u, 10);
  ok(!s3.u.stacks.boarDef, 'HPが満タンで回復しなかったときは数えない');
}
console.log('--- エインヘリャル ---');
{
  const s = setup('m180', ['m05', 'm02', 'm03']);
  T.b.allyFell = false;
  s.u.hp = 1; hitBy(s.e, s.u, 'phys', 50);
  ok(s.u.alive && Math.abs(s.u.hp - Math.round(s.u.maxHp * 0.3)) <= 1, '蘇る戦士: 倒れるとHP30%で復活');
  ok(T.b.allyFell === false, '自分のパッシブで復活したときは「倒れた」に数えない');
  s.u.hp = 1; hitBy(s.e, s.u, 'phys', 50);
  ok(!s.u.alive && T.b.allyFell === true, '2回目は復活しない(倒れたに数える)');
}
console.log('--- ヒルデ ---');
{
  const s = setup('m181', ['m05', 'm02', 'm03']);
  ok(T.passiveMod(s.u, 'dmgBonus', s.e) === 0, '死者を選ぶ者: HP50%より上の敵には0');
  s.e.hp = s.e.maxHp * 0.5;
  ok(near(T.passiveMod(s.u, 'dmgBonus', s.e), 0.2), 'HP50%以下の敵へ+20%');
  ok(T.MONSTER_KITS.m181.skill2.tgt === 'lowest', '選定の一閃: HPの割合が一番低い敵');
}
console.log('--- ブリュンヒルド ---');
{
  const s = setup('m182', ['m05', 'm02', 'm03']);
  ok(T.effDef(s.u, 'phys') - T.effDef(s.u, 'mag') === 65 && T.buildUnit(M.m182, 1, false, 3, false, 1).mdef === 0, '物理防御65(26×2.5)・魔法防御0(陣形のぶんを除く)', [T.effDef(s.u, 'phys'), T.effDef(s.u, 'mag')]);
  ok(T.passiveMod(s.u, 'cutBonus', 'phys') === 0, '盾の乙女: 挑発していなければ0');
  act(s.u, 'skill', s.u.skills[0], 0);
  ok(near(T.passiveMod(s.u, 'cutBonus', 'phys'), 0.1) && s.u.buffs.pdefUp.v === 16 && s.u.buffs.mdefUp.v === 16, '鎧の誓い: 挑発・物理/魔法防御+16、挑発中は被ダメージ軽減-10%');
  act(s.u, 'skill', s.u.skills[1], 1);
  ok(s.e.buffs.strDown && near(s.e.buffs.strDown.v, 0.16), '盾打ち: 攻撃力低下-16%');
}
console.log('--- スコグル ---');
{
  const s = setup('m183', ['m05', 'm02', 'm03']);
  s.e.spd = 10;
  ok(near(T.passiveMod(s.u, 'dmgBonus', s.e), 0.1), '揺るがす者: 自分より遅い敵へ+10%');
  s.e.spd = 99;
  ok(T.passiveMod(s.u, 'dmgBonus', s.e) === 0, '速い敵には0');
  T.b.log.length = 0;
  act(s.u, 'skill', s.u.skills[0], 0);
  ok(s.e.buffs.spdDown && s.e.buffs.spdDown.v === 16 && /\(4回\)/.test(T.b.log.join('')), '足枷の矢: 4回攻撃・鈍化(SPD-16)', T.b.log.slice(-2));
  T.b.log.length = 0; act(s.u, 'normal', s.u.normal);
  ok(/\(4回\)/.test(T.b.log.join('')), '魔弓: 4回攻撃');
}
console.log('--- ゲンドゥル ---');
{
  const s = setup('m184', ['m05', 'm02', 'm03']);
  act(s.u, 'skill', s.u.skills[0], 0);
  ok(s.e.buffs.strDown && near(s.e.buffs.strDown.v, 0.2) && s.e.buffs.healCut && near(s.e.buffs.healCut.v, 0.3), 'ガンド: 攻撃力低下-20%・回復阻害-30%');
  const ally = s.B.party.find(a => a !== s.u);
  ok(near(T.runPassive(s.u, 'allyDmgBonus', ally, s.e), 0.1), '杖の乙女: 攻撃力低下の敵への味方全体の与ダメージ+10%');
  s.B.party.forEach(a => { a.hp = 1; });
  act(s.u, 'ult', s.u.ult);
  ok(s.B.party.every(a => a.hp > 1), 'セイズの歌: 味方全体を回復');
}
console.log('--- ステージ効果の新しい条件 ---');
{
  const s = setup('m182', ['m05', 'm02', 'm03']);
  ok(!T.STAGE_RULE_WHEN.strDown(s.e), 'strDown: 攻撃力低下していなければ false');
  T.addBuff(s.e, 'strDown', 0.2, 2, s.u);
  ok(T.STAGE_RULE_WHEN.strDown(s.e), 'strDown: 攻撃力低下状態なら true');
  s.u.shields = [];
  ok(T.STAGE_RULE_WHEN.notShielded(s.u), 'notShielded: シールドがなければ true');
  s.u.shields = [{ amt: 5, turns: 2 }];
  ok(!T.STAGE_RULE_WHEN.notShielded(s.u), 'notShielded: シールドがあれば false');
}
console.log(fail ? `\n${fail}件 失敗` : '\nすべて通過');
process.exit(fail ? 1 : 0);
