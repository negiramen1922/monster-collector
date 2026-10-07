/* モモタロウイベの6体のキットと、そのために足した戦闘の仕組みのテスト。
   中身の正は docs/提案資料/次回イベント案_モモタロウ.md(スキルの数値は Lv1→Lv10、パッシブは Lv1→Lv5) */
const load = require('./harness.js');
const api = load('game.js', s => s + `;global.__t={buildUnit,MONSTERS,MON_BY_ID,MONSTER_KITS,performAction,takeTurn,strike,runPassive,passiveMod,
  addBuff,effStr,effSpd,hasBuff,kibiTarget,giveKibi,killUnit,conditionMet,releasedMonsters,ultSpCostFor,get b(){return battleUI}};`);
const T = global.__t;
let fail = 0;
const ok = (c, m, v) => { console.log((c ? '✅' : '❌') + ' ' + m + (v !== undefined ? '  ' + JSON.stringify(v) : '')); if(!c) fail++; };
const realRand = Math.random;
const withRand = (v, f) => { Math.random = () => v; try { return f(); } finally { Math.random = realRand; } };
const near = (a, b) => Math.abs(a - b) < 1e-6;
function setup(id, party, lv){
  api.run([], 'q1_01', 1);
  const S = api.STATE; S.owned = {};
  const ids = [id, ...party].slice(0, 5);
  ids.forEach(x => S.owned[x] = { star: Math.max(4, api.MON_BY_ID[x].rarity),   // ★4でスキル2が開く
    souls: 0, level: 30, exp: 0, skillLv: lv || 1, skill2Lv: lv || 1, ultLv: lv || 1, passiveLv: 1 });
  S.formationKey = 'f2'; S.slots = api.lineupFromList(ids, 'f2'); S.autoUlt = true; S.clearedStages = api.STAGES.map(s => s.id);
  api.startBattle('q1_01', { skipIntro: true });
  const B = T.b; B.transitioning = false; B.paused = true; B.queue = [];
  B.enemies.forEach(e => { e.maxHp = e.hp = 99999; e.str = 60; e.pdef = 0; e.mdef = 0; e.alive = true; e.buffs = {}; e.statuses = {}; e.passive = {}; e.shields = []; e.row = 'front'; e.element = 'none'; });
  B.enemies.slice(1).forEach(e => { e.alive = false; });
  return { B, u: B.party.find(x => x.ref === id), e: B.enemies[0] };
}
const act = (u, kind, a, slot) => withRand(0.5, () => T.performAction(u, kind, a, slot));

console.log('--- データ ---');
const M = T.MON_BY_ID;
const exp = { m171:['モモタロウ',5,'grass','attacker','hume',285,66,9,8,44], m172:['イヌ',4,'earth','attacker','beast',190,66,6,5,35],
  m173:['サル',4,'thunder','tank','beast',220,46,8,8,56], m174:['キジ',4,'wind','shooter','beast',180,58,6,6,54],
  m175:['アカオニ',3,'fire','attacker','demon',175,50,6,5,40], m176:['アオオニ',3,'water','tank','demon',255,30,14,11,34] };
Object.entries(exp).forEach(([id, e]) => {
  const m = M[id];
  ok(m && m.name === e[0] && m.rarity === e[1] && m.element === e[2] && m.role === e[3] && m.species === e[4]
    && m.hp === e[5] && m.str === e[6] && m.pdef === e[7] && m.mdef === e[8] && m.spd === e[9] && !!m.releaseAt, `${e[0]}: ★・属性・ロール・種族・ステータス・releaseAt`);
});
const SP = { m171:100, m172:80, m173:70, m174:80, m175:100, m176:70 };
Object.entries(SP).forEach(([id, sp]) => ok(T.MONSTER_KITS[id].ult.sp === sp && T.ultSpCostFor(M[id].role, sp) === sp, `${M[id].name}: 奥義SP ${sp}`));

console.log('--- きびだんご ---');
{
  let s = setup('m171', ['m172', 'm05', 'm02', 'm03']);
  const inu = s.B.party.find(a => a.ref === 'm172');
  ok(T.kibiTarget(s.u) && T.kibiTarget(s.u) !== s.u, '対象に自分は入らない');
  const sp0 = inu.sp, str0 = T.effStr(inu), spd0 = T.effSpd(inu);
  act(s.u, 'skill', s.u.skills[0], 0);
  ok(inu.buffs.kibi && inu.buffs.kibi.turns === 3, 'STRが一番高い味方(イヌ)に3ターン', inu.buffs.kibi && inu.buffs.kibi.turns);
  ok(near(T.effStr(inu) / str0, 1.36) && T.effSpd(inu) - spd0 === 10 && inu.sp - sp0 === 15, 'ビースト: STR+36%・SPD+10・SP+15(スキルLv1)', [T.effStr(inu) / str0, T.effSpd(inu) - spd0, inu.sp - sp0]);
  const turns = inu.buffs.kibi.turns;
  ok(!T.giveKibi(s.u, inu, 5) && inu.buffs.kibi.turns === turns, 'すでに付いている相手には付けない(延長もしない)');
  s.B.party.forEach(a => { if(a !== s.u) T.addBuff(a, 'kibi', 0.2, 3, s.u); });
  ok(T.kibiTarget(s.u) === null && s.u.skills[0].usable(s.u) === false, '全員に付いているとスキル1は使えない');
  s.u.skillCd = [0, 0]; s.u.lastSlot = 1; s.B.currentActor = s.u;
  withRand(0.5, () => T.takeTurn(s.u)); s.B.currentActor = null;
  ok(s.u.skillCd[0] === 0 && s.u.skillCd[1] > 0, '使えないときはスキル2を使い、スキル1のCTは使わない', s.u.skillCd);
  s = setup('m171', ['m140', 'm88', 'm54'], 10);
  const tgt = T.kibiTarget(s.u), str1 = T.effStr(tgt), spd1 = T.effSpd(tgt);
  act(s.u, 'skill', s.u.skills[0], 0);
  ok(near(T.effStr(tgt) / str1, 1.3) && T.effSpd(tgt) === spd1 && tgt.buffs.kibi.turns === 5, 'ビースト以外: STR+30%のみ(スキルLv10)・5ターン', [T.effStr(tgt) / str1, tgt.buffs.kibi.turns]);
  ok(T.conditionMet('selfStrUp', tgt, s.e), 'きびだんごは攻撃力上昇状態に数える');
  s = setup('m171', ['m172', 'm173', 'm174', 'm05']);
  act(s.u, 'ult', s.u.ult);
  ok(s.B.party.filter(a => a.buffs.kibi).map(a => a.ref).sort().join() === 'm172,m173,m174', '奥義: ビースト全員にきびだんご(ビースト以外には付けない)');
  ok(near(T.passiveMod(s.u, 'dmgBonus', s.e), 0.18), 'パッシブ: ビースト3体で与ダメージ+18%');
  ok(T.MONSTER_KITS.m171.skill2.bonusIf[0].cond === 'demon' && T.conditionMet('demon', s.u, { species: 'demon' }), '鬼斬り刀: デーモン特効');
}
console.log('--- イヌ ---');
{
  const s = setup('m172', ['m05', 'm02', 'm03']);
  ok(T.passiveMod(s.u, 'dmgBonus', s.e) === 0, '一番槍: 攻撃力上昇していなければ0');
  act(s.u, 'skill', s.u.skills[0], 0);
  ok(s.u.buffs.strUp && near(s.u.buffs.strUp.v, 0.16) && near(T.passiveMod(s.u, 'dmgBonus', s.e), 0.16), '食らいつきで攻撃力上昇+16%、一番槍+16%');
  ok(T.MONSTER_KITS.m172.skill2.critIf === 'selfStrUp', '忠犬の突撃: 攻撃力上昇なら必ず会心');
  const t0 = s.u.buffs.strUp.turns; act(s.u, 'ult', s.u.ult);
  ok(s.u.buffs.strUp.turns === t0 + 2 && 99999 - s.e.hp > 0, '鬼退治の牙: 3回攻撃・強化の残りターン+2');
}
console.log('--- サル ---');
{
  const s = setup('m173', ['m05', 'm02', 'm03']);
  ok(near(T.passiveMod(s.u, 'evadeBonus'), 0.2), '身軽: 回避+20%');
  const hp0 = s.e.hp;
  withRand(0.5, () => T.runPassive(s.u, 'onEvade', s.e));
  ok(s.e.hp < hp0 && near(s.u.stacks.dodgeCrit, 0.1), '回避すると反撃し、会心率+10%');
  for(let i = 0; i < 10; i++) withRand(0.5, () => T.runPassive(s.u, 'onEvade', s.e));
  ok(near(s.u.stacks.dodgeCrit, 0.5), '会心率の上限+50%');
  T.addBuff(s.e, 'critUp', 0.3, 3, s.e);
  act(s.u, 'skill', s.u.skills[1], 1);
  ok(!s.e.buffs.critUp && s.u.buffs.critUp, 'ちょろまかし: 敵の強化を奪う');
  act(s.u, 'skill', s.u.skills[0], 0);
  ok(s.u.buffs.evade && s.u.buffs.taunt, '身かわしの構え: 回避上昇と挑発');
}
console.log('--- キジ ---');
{
  const s = setup('m174', ['m05', 'm02', 'm03']);
  ok(s.B.party.every(a => a.sp >= 10) && s.u.buffs.spdUp && s.u.buffs.spdUp.v === 10, '先触れ: 戦闘開始時に味方全体SP+10・自分にSPD+10');
  act(s.u, 'skill', s.u.skills[0], 0);
  ok(s.e.buffs.accDown && near(s.e.buffs.accDown.v, 0.2), '眼穿ち: 命中低下-20%');
  ok(T.MONSTER_KITS.m174.normal.tgt === 'back' && api.MON_BY_ID && T.b.party.find(a => a.ref === 'm174').motion === 'feather', '通常攻撃は後衛狙い・羽の演出');
}
console.log('--- アカオニ・アオオニ ---');
{
  let s = setup('m175', ['m176', 'm170', 'm02', 'm03']);
  ok(near(T.passiveMod(s.u, 'dmgBonus', s.e), 0.12), '激昂: 味方のデーモン2体で+12%');
  s.u.hp = s.u.maxHp * 0.5;
  ok(near(T.passiveMod(s.u, 'dmgBonus', s.e), 0.32), 'HP50%以下で+20%');
  s = setup('m176', ['m05', 'm02', 'm03']);
  const ao = s.u, weak = s.B.party.find(a => a !== ao);
  s.B.party.forEach(a => { if(a !== ao && a !== weak) a.alive = false; });
  weak.row = 'front'; ao.row = 'back'; weak.hp = 1;
  const aoHp = ao.hp;
  withRand(0.5, () => T.performAction(s.e, 'normal', { name: '攻撃', atk: 'phys', tgt: 'single', pow: 1 }));
  ok(weak.hp === 1 && ao.hp < aoHp, '友を想う: HPの割合が一番低い味方をかばう');
  const aoHp2 = ao.hp;
  withRand(0.5, () => T.performAction(s.e, 'normal', { name: '攻撃', atk: 'phys', tgt: 'single', pow: 1 }));
  ok(!weak.alive && ao.hp === aoHp2, '1ラウンドに1回まで');
  ok(near(T.passiveMod(ao, 'strBonus'), 0.16) && T.passiveMod(ao, 'defBonus', 'phys') === 8, '味方が倒れるとSTR+16%・物理防御+8');
  act(ao, 'skill', ao.skills[1], 1);
  ok(s.e.buffs.spdDown && s.e.buffs.spdDown.v === 10, '金棒打ち: 鈍化(SPD-10)はポイント');
  act(ao, 'ult', ao.ult);
  ok(ao.buffs.cut && near(ao.buffs.cut.v, 0.2) && ao.buffs.cut.turns === 3 && ao.buffs.taunt, '鬼の結界: 被ダメージ軽減-20%・3ターン、挑発');
}
console.log(fail ? `\n${fail}件 失敗` : '\nすべて通過');
process.exit(fail ? 1 : 0);
