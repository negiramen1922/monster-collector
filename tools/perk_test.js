/* 星刻特性(★6〜★10)のテスト。
   前半: PERK_RELEASE_AT(2026-10-07 12:00)より前は、今までの星刻(MONSTER_PERKS_OLD)が出る。
         中身の正は docs/design/凸ボーナス_ピックアップ4体.json
   後半: 公開後は α0.5 の星刻(16体)が出る。中身の正は docs/提案資料/星刻特性の見直し_★5.md・_★4.md。
         各段(★6〜★10)が効いていることを、1段に1つ以上たしかめる。キットの変更(バハムート・リヴァイアサン・
         タロース・グリーンマン)は時刻に関係なく入る */
const load = require('./harness.js');
const api = load('game.js', s => s.replace('autoUlt: false,', 'autoUlt: true,')
  + `;global.__t={buildUnit,MONSTERS,MON_BY_ID,MONSTER_KITS,MONSTER_PERKS,MONSTER_PERKS_OLD,PERK_RELEASE_AT,perksOf,perkCardHtml,
    hasStatus,hasBuff,effSpd,effDef,effStr,passiveMod,runPassive,strike,performAction,takeTurn,killUnit,addBuff,addShield,
    shieldTotal,applyStatus,conditionMet,addDrum,BATTLE_V2_SP_KILL,get b(){return battleUI}};`);
const T = global.__t;
let fail = 0;
const ok = (c, m, v) => { console.log((c ? '✅' : '❌') + ' ' + m + (v !== undefined ? '  ' + JSON.stringify(v) : '')); if (!c) fail++; };
const realNow = Date.now, realRand = Math.random;
const AFTER = '2026-10-07T12:00:00+09:00', BEFORE = '2026-10-07T11:59:00+09:00';
const at = iso => { Date.now = () => new Date(iso).getTime(); };
// 乱数を決めうちにして1回だけ動かす(会心・ばらつき・確率を固定する)
const withRand = (v, f) => { Math.random = () => v; try { return f(); } finally { Math.random = realRand; } };
const mk = (name, star) => {
  const m = T.MONSTERS.find(x => x.name === name);
  return T.buildUnit(m, 1, false, star, false, 100, { skillLv: 10, skill2Lv: 10, ultLv: 10, passiveLv: 10 });
};
const foe = (hpPct, st) => ({ hp: hpPct * 100, maxHp: 100, alive: true, name: '的', statuses: st || {}, buffs: {}, passive: {}, spd: 1 });

at(BEFORE);
console.log('=== 公開前(10/7 11:59): 今までの星刻 ===');
console.log('--- kit を壊していないか(★5は素のまま) ---');
const k5 = mk('九尾の狐', 5), K = T.MONSTER_KITS[k5.ref];
ok(k5.skills[1] === K.skill2, '★5はスキルが共有のまま(コピーしていない)');
ok(K.skill2.tgt === 'backAll', '★10を作っても kit の幻炎の舞は敵後衛全体のまま');

console.log('--- 九尾の狐 ---');
const k10 = mk('九尾の狐', 10);
ok(k10.foxMax === 10 && k10.foxStart === 4, '★10で狐火の上限10・初期4', { max: k10.foxMax, start: k10.foxStart });
ok(k10.foxBurn === true, '★10で狐火が必ずやけど');
ok(k10.skills[1].tgt === 'all', '★9で幻炎の舞が敵全体');
ok(K.skill2.tgt === 'backAll', 'kit 側は書き換わっていない');
const burned = foe(1, { burn: { turns: 2, dmg: 1 } });
ok(Math.abs(T.passiveMod(k10, 'dmgBonus', burned) - 0.30) < 0.001, '★6+★10 でやけど特効+30%', T.passiveMod(k10, 'dmgBonus', burned));
const k8 = mk('九尾の狐', 8);
ok(k8.foxMax === 8 && k8.foxStart === 3, '★8で上限8・初期3', { max: k8.foxMax, start: k8.foxStart });

console.log('--- タイタン ---');
const t10 = mk('タイタン', 10), t5 = mk('タイタン', 5);
t10.hp = t10.maxHp * 0.9; t5.hp = t5.maxHp * 0.9;
ok(Math.abs(T.passiveMod(t10, 'cutBonus') - 0.45) < 0.01, '★7 HP90%なら被ダメ-30%(パッシブLv5で-45%)', T.passiveMod(t10, 'cutBonus').toFixed(3));
t10.hp = t10.maxHp * 0.6;
ok(Math.abs(T.passiveMod(t10, 'cutBonus') - 0.225) < 0.01, 'HP60%なら-15%のまま(重ならない)', T.passiveMod(t10, 'cutBonus').toFixed(3));
ok(t10.wallTurns === 4 && t10.wallShare === 0.6, '★10で城壁が4ターン・肩代わり60%', { t: t10.wallTurns, s: t10.wallShare });
ok(!!t10.wallBank && t10.wallBank.cap === 0.6, '★10でSTRに変える仕組みが付く');
ok(t5.wallTurns === undefined, '★5には付かない');
ok(t10.skills[1].onHit.find(e => e.st === 'stun').chance === 0.5, '★9で岩盤砕きの気絶が50%');
ok(t5.skills[1].onHit.find(e => e.st === 'stun').chance === 0.2, '★5は20%のまま');

console.log('--- フェンリル ---');
const f10 = mk('フェンリル', 10), f5 = mk('フェンリル', 5);
ok(T.passiveMod(f10, 'spdBonus') === 10, '★6でSPD+10', T.passiveMod(f10, 'spdBonus'));
ok(T.passiveMod(f5, 'spdBonus') === 0, '★5は0');
ok(f10.skills[1].hits === 7, '★7で暴風の牙が7回', f10.skills[1].hits);
ok(f5.skills[1].hits === 5, '★5は5回', f5.skills[1].hits);
const weak = foe(0.4); weak.spd = 1;
ok(Math.abs(T.passiveMod(f10, 'dmgBonus', weak) - 0.30) < 0.001, '★6(遅い敵+10%)＋★8(HP50%以下+20%)= +30%', T.passiveMod(f10, 'dmgBonus', weak));

console.log('--- アバドン ---');
const a10 = mk('アバドン', 10), a5 = mk('アバドン', 5);
ok(a10.skills[1].hits === 9, '★9で奈落の乱撃が9ヒット');
ok(a5.skills[1].hits === 7, '★5は7ヒット');
ok(!!a10.skills[1].onHit.find(e => e.debuff === 'healCut'), '★9で回復阻害が付く');
ok(a10.ult.bonusIf[0].cond === 'halfHp', '★10で無底坑の条件がHP50%以下');
ok(a5.ult.bonusIf[0].cond === 'low30', '★5はHP30%以下');
ok(a10.ultRefund === 0.5, '★10でSPの半分が戻る');
const low = foe(0.4);
ok(Math.abs(T.passiveMod(a10, 'critBonus', low) - (0.45 + 0.10 + 0.20)) < 0.01, '★6+★8で会心率(パッシブ+45% +10% +20%)', T.passiveMod(a10, 'critBonus', low).toFixed(3));
ok(Math.abs(T.passiveMod(a10, 'critDmgBonus') - 0.30) < 0.001, '★8で会心倍率+30%');

/* ===================================================================== */
console.log('\n=== 公開時刻での切り替え ===');
const NEW16 = ['m116', 'm54', 'm68', 'm139', 'm31', 'm113', 'm125', 'm136', 'm137', 'm138', 'm140', 'm165', 'm53', 'm144', 'm150', 'm170'];
const OLD8 = ['m116', 'm54', 'm68', 'm139', 'm53', 'm144', 'm150', 'm170'];
ok(T.PERK_RELEASE_AT === '2026-10-07T12:00:00+09:00', 'PERK_RELEASE_AT は 10/7 12:00');
ok(NEW16.every(id => T.MONSTER_PERKS[id] && T.MONSTER_PERKS[id].from === T.PERK_RELEASE_AT && [6, 7, 8, 9, 10].every(n => T.MONSTER_PERKS[id][n])),
  '16体とも新しい表に★6〜★10があり、from が PERK_RELEASE_AT');
at(BEFORE);
ok(OLD8.every(id => T.perksOf(id, 10).length === 5 && T.perksOf(id, 10)[0].desc === T.MONSTER_PERKS_OLD[id][6].desc), '11:59: 実装ずみの8体は今までの星刻を出す');
ok(NEW16.filter(id => !OLD8.includes(id)).every(id => T.perksOf(id, 10).length === 0), '11:59: 星刻がまだない8体は出さない');
ok(T.perkCardHtml(T.MON_BY_ID.m31, 10) === '' && /幻炎の舞でも狐火\+1/.test(T.perkCardHtml(T.MON_BY_ID.m116, 10)), '11:59: 画面の星刻カードも古い表');
ok(mk('九尾の狐', 10).foxBurn === true, '11:59: 九尾★10は今までどおり狐火が必ずやけど');
at(AFTER);
ok(NEW16.every(id => T.perksOf(id, 10).length === 5 && T.perksOf(id, 10)[0].desc === T.MONSTER_PERKS[id][6].desc), '12:00: 16体とも新しい星刻');
ok(/狐火\+1 → \+2/.test(T.perkCardHtml(T.MON_BY_ID.m116, 10)) && T.perkCardHtml(T.MON_BY_ID.m31, 10) !== '', '12:00: 画面の星刻カードも新しい表');
{ const k = mk('九尾の狐', 10); ok(!k.foxBurn && k.foxBurnUlt === true, '12:00: 九尾★10は新しい星刻(狐火のやけどは奥義中だけ)'); }
ok(T.perksOf('m116', 5).length === 0 && T.perksOf('m116', 7).length === 2, '★の数だけ開く(★5は0・★7は2つ)');

console.log('\n=== キットの変更(時刻に関係なく入る) ===');
at(BEFORE);
{
  const K = T.MONSTER_KITS;
  ok(K.m136.skill1.tgt === 'frontAll' && Math.abs(K.m136.skill1.pow - 1.1) < 1e-9 && K.m136.skill1.atk === 'mag' && K.m136.skill1.ct === 4,
    'バハムート: 滅竜の炎が敵前衛全体に威力110%(魔法)・CT4');
  ok(K.m136.passive.name === '捕食' && typeof K.m136.passive.onKill === 'function' && !K.m136.passive.onDamaged, 'バハムート: パッシブが捕食');
  ok(K.m137.skill1.effects.some(e => e.taunt === 3) && K.m137.skill1.effects.some(e => e.shield === 0.35 && e.base === 'maxHp')
    && !K.m137.skill1.effects.some(e => e.buff), 'リヴァイアサン: 深海の守りが挑発3ターン＋最大HPの35%のシールド');
  ok(typeof K.m137.skill2.run === 'function' && !(K.m137.skill2.onHit || []).length, 'リヴァイアサン: 大津波は鈍化なし・シールドを上乗せ');
  ok(T.MON_BY_ID.m138.element === 'grass', 'グリーンマン: 属性が草', T.MON_BY_ID.m138.element);
  ok(T.MON_BY_ID.m140.hate === 45, 'タロース: ヘイト45', T.MON_BY_ID.m140.hate);
  ok(K.m140.skill1.effects.some(e => e.to === 'self' && e.taunt === 1), 'タロース: 巡回の一撃に挑発(1ターン)');
  ok(!K.m140.passive.onTurnStart && typeof K.m140.passive.flatBonus === 'function', 'タロース: イコルの装甲はシールドなし・物理防御を上乗せ');
}

/* ---- 戦闘の中でたしかめる ---- */
const FILL = ['m05', 'm02', 'm03'];   // 星刻のない味方(タンク・後衛のシューター・サポート)
function setup(id, star, nEnemies, extra) {
  api.run([], 'q1_01', 1);
  const S = api.STATE; S.owned = {};
  const party = [id, ...(extra || FILL)].slice(0, 5);
  party.forEach((x, i) => S.owned[x] = { star: i === 0 ? star : Math.max(4, api.MON_BY_ID[x].rarity), souls: 0, level: 30, exp: 0, wall: 30, skillLv: 1, skill2Lv: 1, ultLv: 1, passiveLv: 1 });
  S.formationKey = 'f2'; S.slots = api.lineupFromList(party, 'f2'); S.clearedStages = api.STAGES.map(s => s.id); S.autoUlt = true;
  api.startBattle('q1_01', { skipIntro: true });
  const B = T.b; B.transitioning = false; B.paused = true; B.queue = [];
  while (B.enemies.length < (nEnemies || 1)) B.enemies.push({ ...B.enemies[0], slot: B.enemies.length, flags: {}, stacks: {}, report: { dealt: 0, taken: 0, healSelf: 0, healAlly: 0, ults: 0, bestHit: 0 } });
  B.enemies.forEach(e => { e.maxHp = e.hp = 99999; e.str = 60; e.pdef = 0; e.mdef = 0; e.alive = true; e.buffs = {}; e.statuses = {}; e.passive = {}; e.shields = []; e.row = 'front'; e.element = 'none'; });
  B.enemies.slice(nEnemies || 1).forEach(e => { e.alive = false; });
  const u = B.party.find(x => x.ref === id);
  return { B, u, e: B.enemies[0], e2: B.enemies[1], ally: B.party.find(x => x !== u) };
}
const act = (u, kind, a, slot) => withRand(0.5, () => T.performAction(u, kind, a, slot));
const hitBy = (atk, t, type, a) => withRand(0.5, () => T.strike({ actor: atk, act: Object.assign({ atk: type || 'phys' }, a || {}), kind: 'normal' }, t, { pow: 1 }));
at(AFTER);

console.log('\n--- 九尾の狐 ---');
{
  let s = setup('m116', 6); const f6 = s.u.stacks.fox; act(s.u, 'skill', s.u.skills[0], 0);
  let s5 = setup('m116', 5); const f5 = s5.u.stacks.fox; act(s5.u, 'skill', s5.u.skills[0], 0);
  ok(s.u.stacks.fox - f6 === 2 && s5.u.stacks.fox - f5 === 1, '★6 狐火生成で狐火+2(★5は+1)', [s.u.stacks.fox - f6, s5.u.stacks.fox - f5]);
  s = setup('m116', 7);
  ok(s.u.stacks.fox === 3 && s.u.foxMax === 8, '★7 戦闘開始時の狐火3つ・上限8', { fox: s.u.stacks.fox, max: s.u.foxMax });
  s = setup('m116', 8, 2); s.e2.row = 'front'; const f8 = s.u.stacks.fox; act(s.u, 'skill', s.u.skills[1], 1);
  ok(s.u.skills[1].tgt === 'all' && s.e.hp < 99999 && s.e2.hp < 99999 && s.u.stacks.fox - f8 === 1, '★8 幻炎の舞が前衛にも当たり、狐火+1', s.u.stacks.fox - f8);
  s = setup('m116', 9); s.u.stacks.fox = 1; T.addBuff(s.u, 'foxDouble', 1, 3, s.u); withRand(0.5, () => T.runPassive(s.u, 'onTurnEnd'));
  s5 = setup('m116', 8); s5.u.stacks.fox = 1; T.addBuff(s5.u, 'foxDouble', 1, 3, s5.u); withRand(0.5, () => T.runPassive(s5.u, 'onTurnEnd'));
  ok(T.hasStatus(s.e, 'burn') && !T.hasStatus(s5.e, 'burn'), '★9 天狐焔舞のあいだ狐火が必ずやけど(★8は付かない)');
  s = setup('m116', 10); const b10 = T.runPassive(s.u, 'allyDmgBonus', s.ally, burned);
  ok(Math.abs(b10 - 0.2) < 1e-9 && s.u.stacks.fox === 4 && s.u.foxMax === 10, '★10 味方全体のやけど特効+20%・狐火4つ(最大10)', { b10, fox: s.u.stacks.fox });
}

console.log('\n--- タイタン ---');
{
  const t6 = mk('タイタン', 6), t5b = mk('タイタン', 5);
  t6.hp = t5b.hp = t6.maxHp * 0.3; t6.buffs.taunt = { v: 1, turns: 2 }; t5b.buffs.taunt = { v: 1, turns: 2 };
  ok(Math.abs(T.passiveMod(t6, 'cutBonus') - 0.10) < 1e-9 && T.passiveMod(t5b, 'cutBonus') === 0, '★6 挑発中は受けるダメージ-10%');
  const t7 = mk('タイタン', 7), t6b = mk('タイタン', 6); t7.hp = t7.maxHp; t6b.hp = t6b.maxHp;
  ok(T.passiveMod(t7, 'cutBonus') > T.passiveMod(t6b, 'cutBonus') * 1.9, '★7 HP80%以上で-15% → -30%', [T.passiveMod(t7, 'cutBonus'), T.passiveMod(t6b, 'cutBonus')]);
  const t8 = mk('タイタン', 8);
  ok(t8.skills[1].onHit.find(e => e.st === 'stun').chance === 0.5 && T.passiveMod(t8, 'dmgBonus', foe(1, { stun: {} })) === 0.3, '★8 岩盤砕きの気絶50%・気絶中の敵に+30%');
  let s = setup('m54', 9); act(s.u, 'ult', s.u.ult);
  const r = s.ally.buffs.redirect;
  ok(r && r.v === 0.6 && r.turns === 4, '★9 ティターンの城壁が4ターン・肩代わり60%', r && { v: r.v, t: r.turns });
  s = setup('m54', 10); hitBy(s.e, s.u);
  ok(Math.abs(T.passiveMod(s.u, 'strBonus') - 0.03) < 1e-9 && !!s.u.wallBank, '★10 攻撃を受けるとSTR+3%・肩代わりをSTRに蓄える', T.passiveMod(s.u, 'strBonus'));
}

console.log('\n--- フェンリル ---');
{
  const f6 = mk('フェンリル', 6), f5b = mk('フェンリル', 5);
  const fastHalf = foe(0.4); fastHalf.spd = 999;
  ok(T.conditionMet(f6.skills[0].bonusIf[0].cond, f6, fastHalf) && !T.conditionMet(f5b.skills[0].bonusIf[0].cond, f5b, fastHalf), '★6 天嵐の牙の威力アップがHP50%以下の(速い)敵にも乗る');
  let s = setup('m68', 7); s.u.skillCd = [5, 5]; s.u.flags.extraPending = true; withRand(0.5, () => T.takeTurn(s.u));
  let s6 = setup('m68', 6); s6.u.skillCd = [5, 5]; s6.u.flags.extraPending = true; withRand(0.5, () => T.takeTurn(s6.u));
  ok(s.u.skillCd.every(c => c === 3) && s6.u.skillCd.every(c => c === 4), '★7 再行動したとき残りCTが1短くなる', [s.u.skillCd, s6.u.skillCd]);
  ok(mk('フェンリル', 8).skills[1].hits === 7 && mk('フェンリル', 7).skills[1].hits === 5, '★8 暴風の牙が7回(★7は5回)');
  s = setup('m68', 9); s.e.hp = 1; s.u.sp = s.u.spCost; withRand(0.5, () => T.takeTurn(s.u));
  s6 = setup('m68', 8); s6.e.hp = 1; s6.u.sp = s6.u.spCost; withRand(0.5, () => T.takeTurn(s6.u));
  ok(!s.e.alive && s.u.sp - s6.u.sp === 30, '★9 フィンブルの大嵐で倒すとSP+30', [s.u.sp, s6.u.sp]);
  const f10b = mk('フェンリル', 10); f10b.flags.extraOn = true;
  ok(T.passiveMod(f10b, 'critBonus') >= 1 && T.passiveMod(f10b, 'dmgBonus', foe(1)) === 0.2, '★10 再行動の攻撃は必ず会心・与ダメージ+20%');
}

console.log('\n--- アバドン ---');
{
  const crits = u => { let n = 0; for (let i = 0; i < 10; i++) { const t = { ...foe(0.4), maxHp: 99999, hp: 30000, pdef: 0, mdef: 0, element: 'none', shields: [], report: { taken: 0 } }; t.row = 'front'; const r = withRand(0.9, () => T.strike({ actor: u, act: u.skills[0], kind: 'skill' }, t, { pow: 1 })); if (r && r.crit) n++; } return n; };
  const c6 = crits(setup('m139', 6).u), c5 = crits(setup('m139', 5).u);
  ok(c6 === 10 && c5 === 0, '★6 深淵の連爪はHP50%以下の敵に必ず会心', [c6, c5]);
  let s = setup('m139', 7); s.u.skillCd = [3, 3]; T.runPassive(s.u, 'onKill', s.e);
  ok(s.u.skillCd.every(c => c === 1), '★7 敵を倒したときのCT短縮が2', s.u.skillCd);
  const a8 = mk('アバドン', 8);
  ok(a8.skills[1].hits === 9 && a8.skills[1].onHit.some(e => e.debuff === 'healCut'), '★8 奈落の乱撃が9回・回復阻害');
  const a9 = mk('アバドン', 9);
  ok(a9.ult.bonusIf[0].cond === 'halfHp' && mk('アバドン', 8).ult.bonusIf[0].cond === 'low30', '★9 無底坑の条件がHP50%以下');
  const a10 = mk('アバドン', 10), a9b = mk('アバドン', 9);
  ok(a10.ultRefund === 0.5 && Math.abs(T.passiveMod(a10, 'critBonus', foe(1)) - T.passiveMod(a9b, 'critBonus', foe(1)) - 0.2) < 1e-9
    && Math.abs(T.passiveMod(a10, 'critDmgBonus') - 0.3) < 1e-9, '★10 会心率+20%・会心倍率+30%・奥義で倒すとSPの半分が戻る');
}

console.log('\n--- シースライム ---');
{
  let s = setup('m31', 6);
  const dmgVs = (u, pdef) => { const e = s.e; e.pdef = pdef; e.hp = e.maxHp; withRand(0.9, () => T.strike({ actor: u, act: u.skills[0], kind: 'skill' }, e, { pow: 1 })); return e.maxHp - e.hp; };
  ok(dmgVs(s.u, 60) === dmgVs(s.u, 0), '★6 ウォーターシューターが物理防御を100%無視', [dmgVs(s.u, 60), dmgVs(s.u, 0)]);
  const regrows = star => { const x = setup('m31', star).u; let n = 0; for (let i = 0; i < 3; i++) { x.hp = Math.round(x.maxHp * 0.4); const h = x.hp; T.runPassive(x, 'onDamaged'); if (x.hp > h) n++; } return n; };
  ok(regrows(7) === 2 && regrows(6) === 1, '★7 流体の体の回復が2度まで(★6は1度)', [regrows(7), regrows(6)]);
  ok(mk('シースライム', 8).skills[1].onHit.find(e => e.debuff === 'strDown').chance === 0.8, '★8 激流のSTRダウンが80%');
  s = setup('m31', 9);
  const ultDmg = down => { const e = s.e; e.hp = e.maxHp; e.buffs = down ? { strDown: { v: 0.2, turns: 2 } } : {}; withRand(0.9, () => T.strike({ actor: s.u, act: s.u.ult, kind: 'ult' }, e, { pow: 1 })); return e.maxHp - e.hp; };
  const d0 = ultDmg(false), d1 = ultDmg(true);
  ok(Math.abs(d1 / d0 - 1.5) < 0.02, '★9 大海嘯がSTRダウン中の敵に威力+50%', [d0, d1]);
  s = setup('m31', 10); s.u.sp = 0; s.u.hp = Math.round(s.u.maxHp * 0.4); T.runPassive(s.u, 'onDamaged');
  ok(s.u.sp === 80 && T.passiveMod(s.u, 'dmgBonus', { ...foe(1), buffs: { strDown: { v: 0.2 } } }) === 0.2, '★10 回復したときSP+80・STRダウンの敵に+20%', s.u.sp);
}

console.log('\n--- ホーリードラゴン ---');
{
  let s = setup('m113', 6); s.ally.hp = s.ally.maxHp; act(s.u, 'skill', s.u.skills[0], 0);
  let s5 = setup('m113', 5); s5.ally.hp = s5.ally.maxHp; act(s5.u, 'skill', s5.u.skills[0], 0);
  ok(T.shieldTotal(s.ally) > 0 && T.shieldTotal(s5.ally) === 0, '★6 HPが満タンの味方には回復量の半分をシールド', T.shieldTotal(s.ally));
  s = setup('m113', 7); s.u.turnCount = 2; s.ally.statuses.poison = { turns: 3, layers: [1], source: s.e }; T.runPassive(s.u, 'onTurnEnd');
  ok(!s.ally.statuses.poison && T.hasBuff(s.ally, 'ward'), '★7 2ターンごとに状態異常を解除し、免疫を付ける');
  s = setup('m113', 8); s.ally.statuses.poison = { turns: 3, layers: [1], source: s.e }; act(s.u, 'skill', s.u.skills[1], 1);
  ok(!s.ally.statuses.poison, '★8 光竜の咆哮で味方の状態異常も解除');
  s = setup('m113', 9); s.ally.alive = false; s.ally.hp = 0; s.ally.deathOrder = 1; act(s.u, 'ult', s.u.ult);
  ok(s.ally.alive && s.ally.hp === Math.round(s.ally.maxHp * 0.7), '★9 ホーリーノヴァの蘇生がHP70%', s.ally.hp / s.ally.maxHp);
  s = setup('m113', 10); const other = s.B.party.filter(x => x !== s.u)[1];
  other.statuses.burn = { turns: 2, dmg: 1, source: s.e }; T.addBuff(other, 'strDown', 0.2, 2, s.e);
  s.ally.alive = false; s.ally.hp = 0; s.ally.deathOrder = 1; act(s.u, 'ult', s.u.ult);
  ok(!other.statuses.burn && !other.buffs.strDown && T.hasBuff(other, 'ward') && T.hasBuff(s.u, 'strUp') && T.hasBuff(s.ally, 'pdefUp') && T.hasBuff(s.ally, 'mdefUp'),
    '★10 状態異常と弱体化をすべて解除して免疫・蘇生した味方と自分を強化');
}

console.log('\n--- 雷電 ---');
{
  ok(mk('雷電', 6).skills[0].onHit.find(e => e.followUp).chance === 0.6 && mk('雷電', 5).skills[0].onHit.find(e => e.followUp).chance === 0.3, '★6 雷鼓連打の追撃が60%');
  const fu = star => { const x = setup('m125', star); hitBy(x.u, x.e, 'phys', { onHit: [{ followUp: true }] }); return x.u.stacks.drum || 0; };
  const d7 = fu(7), d6 = fu(6);
  ok(d7 === 1 && d6 === 0, '★7 追撃したときにも太鼓+1', [d7, d6]);
  const nr = star => { const x = setup('m125', star); act(x.u, 'skill', x.u.skills[1], 1); return x.u.stacks.drum || 0; };
  const n8 = nr(8), n7 = nr(7);
  ok(n8 - n7 === 2, '★8 鳴神で太鼓+2', [n8, n7]);
  let s, s6;
  s = setup('m125', 9); s.u.stacks.drum = 4; act(s.u, 'ult', s.u.ult);
  s6 = setup('m125', 8); s6.u.stacks.drum = 4; act(s6.u, 'ult', s6.u.ult);
  ok(s.u.stacks.drum === 2 && s6.u.stacks.drum === 0, '★9 轟雷のあと太鼓が半分残る', [s.u.stacks.drum, s6.u.stacks.drum]);
  s = setup('m125', 10);
  const startDrum = s.u.stacks.drum;
  s.u.sp = 0; s.u.stacks.drum = 0; T.addDrum(s.u, 5);
  ok(startDrum === 3 && s.u.sp === 30 && s.u.drumMax === 8 && s.u.ult.onHit.some(e => e.followUp), '★10 開始時に太鼓3つ・太鼓でSP(1ターン+30まで)・上限8・轟雷で追撃', { startDrum, sp: s.u.sp });
  s.u.turnCount += 1; T.addDrum(s.u, 1);
  ok(s.u.sp === 40, '★10 次の自分のターンになると、また太鼓でSPが入る', s.u.sp);
}

console.log('\n--- バハムート ---');
{
  let s = setup('m136', 5); const big = { ...s.e, str: s.u.str * 100, alive: true };
  const hp0 = Math.round(s.u.maxHp * 0.5); s.u.hp = hp0; T.runPassive(s.u, 'onKill', big);
  ok(s.u.hp > hp0 && Math.abs(T.passiveMod(s.u, 'strBonus') - 0.5) < 1e-9, '★5 捕食: 倒すとHP回復・STRを奪う(+50%まで)', { hp: s.u.hp - hp0, str: T.passiveMod(s.u, 'strBonus') });
  s = setup('m136', 6); act(s.u, 'skill', s.u.skills[0], 0);
  ok(s.u.skills[0].ct === 3 && s.e.buffs.pdefDown && s.e.buffs.pdefDown.v === 10 && s.e.buffs.mdefDown && s.e.buffs.mdefDown.v === 10, '★6 滅竜の炎がCT3・物理防御-10・魔法防御-10');
  const ks = star => { const x = setup('m136', star); x.u.sp = 0; T.runPassive(x.u, 'onKill', x.e); return x.u.sp; };
  const k7 = ks(7), k6 = ks(6);
  ok(k7 - k6 === 20, '★7 捕食で倒すとSP+20', [k7, k6]);
  const b8 = mk('バハムート', 8);
  ok(b8.skills[1].onHit.some(e => e.st === 'burn' && e.chance === 0.5) && b8.skills[1].effects.find(e => e.buff === 'strUp').turns === 5, '★8 竜王の咆哮に50%でやけど・STRアップ5ターン');
  ok(mk('バハムート', 9).ult.bonusIf.some(e => e.cond === 'burned' && e.add === 0.8), '★9 メガフレアがやけどの敵に威力+80%');
  s = setup('m136', 10); T.runPassive(s.u, 'onKill', { ...s.e, str: s.u.str * 100 });
  ok(Math.abs(T.passiveMod(s.u, 'strBonus') - 1.0) < 1e-9 && T.passiveMod(s.u, 'dmgBonus', burned) === 0.2, '★10 奪うSTRの上限+100%・やけどの敵に+20%', T.passiveMod(s.u, 'strBonus'));
}

console.log('\n--- リヴァイアサン ---');
{
  let s = setup('m137', 5); act(s.u, 'skill', s.u.skills[0], 0);
  ok(T.hasBuff(s.u, 'taunt') && T.shieldTotal(s.u) >= Math.round(s.u.maxHp * 0.35) - 1, 'キット: 深海の守りで挑発と最大HPの35%のシールド', T.shieldTotal(s.u) / s.u.maxHp);
  const tide = sh => { const x = setup('m137', 5); x.u.shields = sh ? [{ amt: sh, turns: 9, skip: false, caster: x.u }] : []; act(x.u, 'skill', x.u.skills[1], 1); return { d: x.e.maxHp - x.e.hp, spd: x.e.buffs.spdDown }; };
  const t0 = tide(0), t1 = tide(1000);
  ok(t1.d - t0.d === 50 && !t0.spd, 'キット: 大津波は今のシールドの5%を上乗せ(鈍化なし)', [t0.d, t1.d]);
  s = setup('m137', 6); act(s.u, 'skill', s.u.skills[0], 0);
  ok(T.shieldTotal(s.ally) > 0, '★6 深海の守りで味方全体にもシールド', T.shieldTotal(s.ally));
  s = setup('m137', 7); const sh7 = T.shieldTotal(s.u) / s.u.maxHp; const sh6 = T.shieldTotal(setup('m137', 6).u);
  ok(sh7 >= 0.15 - 0.01 && sh6 === 0, '★7 戦闘開始時に最大HPの15%のシールド', sh7);
  s = setup('m137', 8); act(s.u, 'skill', s.u.skills[1], 1);
  ok(s.e.buffs.spdDown && s.e.buffs.spdDown.v === 10, '★8 大津波で鈍化(SPD-10)');
  s = setup('m137', 9); act(s.u, 'ult', s.u.ult);
  ok(s.ally.buffs.redirect && s.ally.buffs.redirect.turns === 4 && s.ally.buffs.redirect.v === 0.3, '★9 大海嘯の肩代わりが4ターン');
  s = setup('m137', 10); act(s.u, 'ult', s.u.ult); s.u.shields = [];
  hitBy(s.e, s.ally);
  ok(s.ally.buffs.redirect.v === 0.5 && T.shieldTotal(s.u) > 0 && T.passiveMod(s.u, 'dmgBonus', foe(1)) === 0.2, '★10 肩代わり50%・肩代わりした量の30%をシールドに・シールド中は与ダメージ+20%', T.shieldTotal(s.u));
}

console.log('\n--- グリーンマン ---');
{
  let s = setup('m138', 6); act(s.u, 'skill', s.u.skills[0], 0);
  ok(T.hasStatus(s.e, 'bind') && T.hasBuff(s.u, 'taunt'), '★6 根の呪縛で自分に挑発');
  s = setup('m138', 7); s.u.hp = s.u.maxHp; T.runPassive(s.u, 'onTurnStart');
  let s6 = setup('m138', 6); s6.u.hp = s6.u.maxHp; T.runPassive(s6.u, 'onTurnStart');
  ok(T.shieldTotal(s.u) > 0 && T.shieldTotal(s6.u) === 0, '★7 HPが満タンなら回復の代わりにシールド', T.shieldTotal(s.u));
  s = setup('m138', 8); s.ally.hp = 1; act(s.u, 'skill', s.u.skills[1], 1);
  ok(s.ally.hp - 1 === Math.round(s.u.maxHp * 0.25 * 0.5), '★8 森の抱擁の回復量の半分を、HPの割合が一番低い味方にも', s.ally.hp - 1);
  ok(mk('グリーンマン', 9).ult.bonusIf.some(e => e.cond === 'bound' && e.add === 1.0) && T.conditionMet('bound', s.u, { statuses: { bind: { turns: 1 } } }), '★9 大森林の怒りが拘束中の敵に威力+100%');
  s = setup('m138', 10); s.ally.hp = 1; T.runPassive(s.u, 'onTurnStart');
  ok(s.ally.hp > 1 && T.passiveMod(s.u, 'dmgBonus', foe(1, { bind: { turns: 1 } })) === 0.3, '★10 不滅の緑が味方全体にも届く・拘束中の敵に+30%', s.ally.hp - 1);
}

console.log('\n--- タロース ---');
{
  let s = setup('m140', 5); act(s.u, 'skill', s.u.skills[0], 0);
  ok(s.u.buffs.taunt && s.u.buffs.taunt.turns === 1, 'キット: 巡回の一撃で自分に挑発(1ターン)');
  ok(Math.abs(T.passiveMod(s.u, 'flatBonus', s.u.normal) - T.effDef(s.u, 'phys') * 0.5) < 1e-9, 'キット: 攻撃に物理防御の50%を上乗せ', T.passiveMod(s.u, 'flatBonus', s.u.normal));
  const plain = (u, f) => { const e = s.e; e.hp = e.maxHp; const pa = u.passive; if (!f) u.passive = { ...pa, flatBonus: undefined }; hitBy(u, e); u.passive = pa; return e.maxHp - e.hp; };
  ok(plain(s.u, true) - plain(s.u, false) === Math.round(T.effDef(s.u, 'phys') * 0.5), 'キット: 上乗せが実際のダメージに入る', [plain(s.u, true), plain(s.u, false)]);
  const t6 = mk('タロース', 6);
  ok(t6.skills[0].tgt === 'any' && t6.skills[0].effects.find(e => e.taunt).taunt === 2, '★6 巡回の一撃が後衛も狙え、挑発2ターン');
  const t7 = mk('タロース', 7), t6b = mk('タロース', 6);
  ok(T.effDef(t7, 'mag') === T.effDef(t7, 'phys') && T.effDef(t6b, 'mag') < T.effDef(t6b, 'phys'), '★7 魔法攻撃も物理防御で受ける', [T.effDef(t7, 'mag'), T.effDef(t6b, 'mag')]);
  const t8 = mk('タロース', 8);
  ok(Math.abs(T.passiveMod(t8, 'flatBonus', t8.skills[1]) - T.effDef(t8, 'phys')) < 1e-9 && Math.abs(T.passiveMod(t8, 'flatBonus', t8.skills[0]) - T.effDef(t8, 'phys') * 0.5) < 1e-9,
    '★8 灼熱の抱擁だけ物理防御の100%を上乗せ');
  s = setup('m140', 9); act(s.u, 'ult', s.u.ult);
  ok(T.hasBuff(s.u, 'pdefUp') && s.e.buffs.accDown && s.e.buffs.accDown.turns === 2, '★9 落雷投石の命中低下が2ターン・自分の物理防御アップ', s.e.buffs.accDown && s.e.buffs.accDown.turns);
  s = setup('m140', 10); const h0 = s.e.hp; hitBy(s.e, s.u, 'mag');
  ok(h0 - s.e.hp === Math.round(T.effDef(s.u, 'phys')), '★10 魔法で殴られても、物理防御ぶんのダメージを返す', h0 - s.e.hp);
}

console.log('\n--- 死神 ---');
{
  const rk = star => { const x = setup('m165', star); x.e.hp = 1; x.u.sp = 0; act(x.u, 'skill', x.u.skills[0], 0); return x.e.alive ? -1 : x.u.sp; };
  const r6 = rk(6), r5 = rk(5);
  ok(r5 >= 0 && r6 - r5 === 15, '★6 刈り取りの一閃で倒すとSP+15', [r6, r5]);
  let s;
  const reap = star => { const y = setup('m165', star), x = y.u; for (let i = 0; i < 6; i++) T.runPassive(x, 'onKill', y.e); return x.stacks.reap; };
  ok(reap(7) === 5 && reap(6) === 3, '★7 死の宣告の重なりが5回', [reap(7), reap(6)]);
  s = setup('m165', 8, 2); s.e2.hp = 9999; act(s.u, 'skill', s.u.skills[1], 1);
  ok(s.e2.hp < 9999 && s.e.hp === 99999, '★8 魂喰らいがHPの割合が一番低い敵を狙う');
  ok(mk('死神', 9).ult.bonusIf[0].cond === 'low40' && mk('死神', 8).ult.bonusIf[0].cond === 'low30', '★9 終焉の刈り入れの条件がHP40%以下');
  s = setup('m165', 10, 2); s.e.hp = 1; s.e2.hp = 30000; s.e2.row = 'back';
  act(s.u, 'normal', s.u.normal);
  ok(!s.e.alive && s.e2.hp < 30000 && T.passiveMod(s.u, 'dmgBonus', foe(0.35)) > 0, '★10 倒したらHP40%以下の敵に刈り取りの一閃・条件が40%以下に', s.e2.hp);
  const before = s.e2.hp; s.e2.maxHp = 99999; s.e.alive = true; s.e.hp = 1; act(s.u, 'normal', s.u.normal);
  ok(s.e2.hp === before, '★10 刈り取りの一閃の割り込みは1ラウンドに1回');
}

console.log('\n--- スルト ---');
{
  ok(mk('スルト', 6).skills[0].tgt === 'all' && mk('スルト', 5).skills[0].tgt === 'frontAll', '★6 灼熱の薙ぎが敵全体');
  const lv = star => { const x = setup('m53', star); withRand(0.1, () => T.runPassive(x.u, 'onHitTarget', x.e)); return T.hasStatus(x.e, 'burn'); };
  ok(lv(7) && !lv(6), '★7 自分が攻撃した相手も30%でやけど');
  let s;
  ok(mk('スルト', 8).skills[1].effects.find(e => e.buff === 'burnOnHit').v === 0.7, '★8 巨人の怒りのやけど付与が70%');
  ok(mk('スルト', 9).ult.extraIf.hits === 2 && !mk('スルト', 8).ult.extraIf.hits, '★9 ムスペルの業火の追加攻撃が2回');
  // やけどの付け主を自分以外にする(自分がやけどにした相手へのパッシブの+10%は別に見る)
  s = setup('m53', 10, 3); s.B.enemies.slice(0, 3).forEach(e => { e.statuses.burn = { turns: 2, dmg: 1, source: s.e2 }; });
  const b1 = T.passiveMod(s.u, 'dmgBonus', s.e);
  s.e2.statuses = {};
  const b2 = T.passiveMod(s.u, 'dmgBonus', s.e);
  ok(Math.abs(b1 - 0.35) < 1e-9 && Math.abs(b2 - 0.2) < 1e-9, '★10 やけどの敵に+20%、やけどが3体以上ならさらに+15%', [b1, b2]);
}

console.log('\n--- ブロック ---');
{
  const forge = star => { const x = setup('m144', star); act(x.u, 'skill', x.u.skills[0], 0); const b = x.B.party.find(a => a !== x.u && a.row === 'back'); return b ? T.shieldTotal(b) : -1; };
  const g6 = forge(6), g5 = forge(5);
  ok(g6 > 0 && g5 === 0, '★6 鍛冶の盾で後衛の味方にもシールド', [g6, g5]);
  let s = setup('m144', 7); withRand(0.1, () => { for (let i = 0; i < 4; i++) T.runPassive(s.u, 'onHitBy', s.e); });
  ok(s.u.stacks.brace === 2, '★7 不屈の鍛冶が2回ぶん溜まる', s.u.stacks.brace);
  s = setup('m144', 8); act(s.u, 'skill', s.u.skills[1], 1);
  ok(s.e.buffs.pdefDown && s.e.buffs.pdefDown.v === 8, '★8 火花の一撃で物理防御-8');
  const hammer = (star, sh) => { const x = setup('m144', star); x.u.shields = sh ? [{ amt: sh, turns: 9, skip: false, caster: x.u }] : []; act(x.u, 'ult', x.u.ult); return x.e.maxHp - x.e.hp; };
  ok(hammer(9, 1000) - hammer(9, 0) === 1000 && hammer(8, 1000) === hammer(8, 0), '★9 神槌の一撃がシールドの量だけ強くなる');
  const b10 = mk('ブロック', 10); b10.shields = [{ amt: 10, turns: 2 }];
  ok(T.passiveMod(b10, 'dmgBonus', foe(1)) === 0.15 && T.passiveMod(b10, 'cutBonus') >= 0.15, '★10 シールド中は与ダメージ+15%・受けるダメージ-15%');
}

console.log('\n--- ロキ ---');
{
  const shape = star => { const x = setup('m150', star); T.addBuff(x.e, 'strUp', 0.3, 3, x.e); act(x.u, 'skill', x.u.skills[0], 0); return { conf: T.hasStatus(x.e, 'confuse'), buff: !!x.e.buffs.strUp }; };
  const l6 = shape(6), l5 = shape(5);
  ok(l6.conf && !l6.buff && l5.conf && l5.buff, '★6 姿変えで混乱させた敵の強化を1つ解除', [l6, l5]);
  let s;
  ok(T.passiveMod(mk('ロキ', 7), 'dmgBonus', burned) === 0.1 && !T.passiveMod(mk('ロキ', 6), 'dmgBonus', burned), '★7 状態異常の敵に+10%');
  s = setup('m150', 8); T.addBuff(s.e, 'strUp', 0.3, 3, s.e); T.addBuff(s.e, 'spdUp', 10, 3, s.e); act(s.u, 'skill', s.u.skills[1], 1);
  ok(!s.e.buffs.strUp && !s.e.buffs.spdUp, '★8 炎の悪戯で強化を2つ解除');
  ok(mk('ロキ', 9).ult.bonusIf.some(e => e.cond === 'confused' && e.add === 0.5), '★9 ラグナロクの火種が混乱中の敵に威力+50%');
  s = setup('m150', 10, 2); T.runPassive(s.u, 'onBattleStart');
  const startConf = T.hasStatus(s.e, 'confuse') && T.hasStatus(s.e2, 'confuse');
  s.e.statuses = {}; s.e2.statuses = {}; act(s.u, 'skill', s.u.skills[0], 0);
  ok(startConf && T.hasStatus(s.e, 'confuse') && T.hasStatus(s.e2, 'confuse'), '★10 戦闘開始時に敵全体を混乱・姿変えが敵全体');
}

console.log('\n--- 牛鬼 ---');
{
  let s = setup('m170', 6); s.ally.buffs.redirect = { v: 0.5, turns: 2, source: s.u };
  ok(T.passiveMod(s.u, 'cutBonus') === 0.1, '★6 かばっているあいだ受けるダメージ-10%');
  s = setup('m170', 7); s.ally.buffs.redirect = { v: 0.5, turns: 2, source: s.u };
  ok(T.runPassive(s.u, 'allyCutBonus', s.ally) === 0.1, '★7 かばっている味方の受けるダメージ-10%');
  ok(mk('牛鬼', 8).skills[1].onHit.find(e => e.st === 'burn').chance === 0.8, '★8 角裂きのやけどが80%');
  s = setup('m170', 9); act(s.u, 'skill', s.u.skills[0], 0);
  const covered = s.B.party.filter(a => a.buffs.redirect && a.buffs.redirect.source === s.u);
  covered.forEach(a => { a.shields = []; }); act(s.u, 'ult', s.u.ult);
  ok(covered.length > 0 && covered.every(a => T.shieldTotal(a) > 0), '★9 鬼哭でかばっている味方全員にシールド', covered.length);
  s = setup('m170', 10); act(s.u, 'skill', s.u.skills[0], 0);
  const all = s.B.party.filter(a => a !== s.u);
  s.u.shields = [{ amt: 10, turns: 2 }];
  ok(all.every(a => a.buffs.redirect && a.buffs.redirect.source === s.u) && !s.u.buffs.redirect && T.passiveMod(s.u, 'dmgBonus', foe(1)) === 0.15,
    '★10 牛鬼の盾が味方全体をかばう・シールド中は与ダメージ+15%');
}

console.log('\n--- 敵にも付く ---');
{
  const m = T.MON_BY_ID.m140;
  const en = T.buildUnit(m, 50, true, 7, false, 1, {});
  ok(en.magAsPhys === true && en.skills[0].tgt === 'any', '敵のタロース★7にも星刻が付く');
}

/* ---- モモタロウイベの6体(from: MOMOTARO_START_AT)。中身の正は docs/提案資料/次回イベント案_モモタロウ.md ---- */
console.log('\n=== モモタロウイベの6体 ===');
at('2026-10-12T00:00:00+09:00');
ok(mk('モモタロウ', 10).perks === undefined && mk('イヌ', 10).strUpMult === undefined, '開始時刻の前は星刻が付かない');
at('2026-10-14T00:00:00+09:00');
const BEASTS = ['m172', 'm173', 'm174', 'm166'];
console.log('--- モモタロウ ---');
{
  let s = setup('m171', 6, 1, BEASTS);
  s.B.party.forEach(a => { if(a !== s.u) a.skillCd = [2, 2]; });
  act(s.u, 'skill', s.u.skills[0], 0);
  let got = s.B.party.find(a => a.buffs.kibi);
  ok(got && got !== s.u && got.skillCd.every(c => c === 1), '★6 きびだんごを付けた味方のスキルの残りCTが1短くなる', got && got.skillCd);
  let s5 = setup('m171', 5, 1, BEASTS);
  s5.B.party.forEach(a => { if(a !== s5.u) a.skillCd = [2, 2]; });
  act(s5.u, 'skill', s5.u.skills[0], 0);
  got = s5.B.party.find(a => a.buffs.kibi);
  ok(got && got.skillCd.every(c => c === 2), '★5は短くならない');
  s = setup('m171', 7, 1, BEASTS); const d7 = T.passiveMod(s.u, 'dmgBonus', s.e);
  s5 = setup('m171', 6, 1, BEASTS); const d6 = T.passiveMod(s5.u, 'dmgBonus', s5.e);
  ok(Math.abs(d7 - 0.24) < 1e-9 && Math.abs(d6 - 0.18) < 1e-9, '★7 ビースト4体で与ダメージ+24%(★6は3体まで+18%)', [d7, d6]);
  s = setup('m171', 8, 1, BEASTS); s.e.hp = 1; s.u.skillCd[0] = 3;
  act(s.u, 'skill', s.u.skills[1], 1);
  s5 = setup('m171', 7, 1, BEASTS); s5.e.hp = 1; s5.u.skillCd[0] = 3;
  act(s5.u, 'skill', s5.u.skills[1], 1);
  ok(!s.e.alive && s.u.skillCd[0] === 0 && s5.u.skillCd[0] === 3, '★8 鬼斬り刀で倒すと、きびだんごのCTが0になる');
  const ultRun = star => {
    const r = setup('m171', star, 1, BEASTS);
    r.B.party.filter(a => a.ref === 'm172' || a.ref === 'm173').forEach(a => T.addBuff(a, 'kibi', 0.2, 3, r.u));
    act(r.u, 'ult', r.u.ult);
    const fresh = r.B.party.find(a => a.ref === 'm174');
    return { dealt: 99999 - r.e.hp, turns: fresh.buffs.kibi && fresh.buffs.kibi.turns, str: r.u.str };
  };
  const u9 = ultRun(9), u8 = ultRun(8);
  ok(u9.turns === u8.turns + 1, '★9 奥義で付けるきびだんごのターン数+1', [u8.turns, u9.turns]);
  ok(u9.dealt / u9.str > u8.dealt / u8.str * 1.35, '★9 きびだんご状態の味方2体で奥義の威力+40%', [u8.dealt, u9.dealt]);
  s = setup('m171', 10, 1, BEASTS); act(s.u, 'skill', s.u.skills[0], 0);
  got = s.B.party.find(a => a.buffs.kibi);
  ok(got && got.buffs.kibi.dmg === 0.30, '★10 ビーストのきびだんごに与ダメージ+30%', got && got.buffs.kibi.dmg);
  s = setup('m171', 10, 1, ['m140', 'm88', 'm54']); act(s.u, 'skill', s.u.skills[0], 0);
  got = s.B.party.find(a => a.buffs.kibi);
  ok(got && got.buffs.kibi.dmg === 0.20, '★10 ビースト以外は+20%', got && got.buffs.kibi.dmg);
}
console.log('--- イヌ ---');
{
  let s = setup('m172', 6, 2); s.e2.row = 'front'; s.e.hp = 90000; s.e2.hp = 30000;
  act(s.u, 'skill', s.u.skills[0], 0);
  ok(s.u.skills[0].tgt === 'lowest' && s.e2.buffs.pdefDown && s.e2.buffs.pdefDown.v === 10 && !s.e.buffs.pdefDown, '★6 食らいつきがHPの低い敵を狙い、物理防御-10');
  s = setup('m172', 7);
  T.b.actionSerial = 5; const first = T.passiveMod(s.u, 'dmgBonus', s.e, s.u.normal, 'normal');
  const again = T.passiveMod(s.u, 'dmgBonus', s.e, s.u.normal, 'normal');
  T.b.actionSerial = 6; const next = T.passiveMod(s.u, 'dmgBonus', s.e, s.u.normal, 'normal');
  ok(first === 0.5 && again === 0.5 && next === 0, '★7 戦闘で最初の攻撃(その行動の中)だけ与ダメージ+50%', [first, again, next]);
  s = setup('m172', 8); let s7 = setup('m172', 7);
  ok(s.u.skills[1].pierceIfStrUp === 0.5 && !s7.u.skills[1].pierceIfStrUp, '★8 忠犬の突撃が攻撃力上昇状態なら防御50%無視');
  s = setup('m172', 9);
  ok(s.u.ult.critIf === 'selfStrUp' && !T.MONSTER_KITS.m172.ult.critIf, '★9 鬼退治の牙が攻撃力上昇状態なら必ず会心');
  s = setup('m172', 10); s7 = setup('m172', 9);
  [s, s7].forEach(r => T.addBuff(r.u, 'strUp', 0.2, 2, r.u));
  ok(Math.abs(T.effStr(s.u) / s.u.str - 1.3) < 1e-6 && Math.abs(T.effStr(s7.u) / s7.u.str - 1.2) < 1e-6, '★10 自分に付く攻撃力上昇が1.5倍(+20% → +30%)');
}
console.log('--- サル ---');
{
  let s = setup('m173', 6); act(s.u, 'skill', s.u.skills[0], 0); const ev6 = s.u.buffs.evade.turns;
  let s5 = setup('m173', 5); act(s5.u, 'skill', s5.u.skills[0], 0);
  ok(ev6 === s5.u.buffs.evade.turns + 1, '★6 回避上昇のターン数+1', [s5.u.buffs.evade.turns, s.u.buffs.evade.turns]);
  s = setup('m173', 7); ok(s.u.counterPow === 1.0, '★7 反撃の威力100%');
  s = setup('m173', 8, 1, ['m172', 'm02', 'm03']); T.addBuff(s.e, 'critUp', 0.3, 3, s.e);
  act(s.u, 'skill', s.u.skills[1], 1);
  const inu = s.B.party.find(a => a.ref === 'm172');
  ok(!s.e.buffs.critUp && inu.buffs.critUp && !s.u.buffs.critUp, '★8 奪った強化はSTRが一番高い味方に渡る');
  s = setup('m173', 9); ['strUp', 'critUp', 'regen'].forEach(k => T.addBuff(s.e, k, 0.1, 3, s.e)); act(s.u, 'ult', s.u.ult);
  const left9 = Object.keys(s.e.buffs).length;
  s5 = setup('m173', 8); ['strUp', 'critUp', 'regen'].forEach(k => T.addBuff(s5.e, k, 0.1, 3, s5.e)); act(s5.u, 'ult', s5.u.ult);
  ok(left9 === 0 && Object.keys(s5.e.buffs).length === 2, '★9 猿知恵で強化をすべて解除(★8は1つ)', [Object.keys(s5.e.buffs)]);
  s = setup('m173', 10); s.u.stacks.dodgeCrit = 0.95;
  withRand(0.01, () => T.runPassive(s.u, 'onEvade', s.e));
  ok(s.u.stacks.dodgeCrit === 1.0 && s.e.buffs.accDown && s.e.buffs.accDown.v === 0.16, '★10 会心率の上限+100%・反撃が会心したら命中低下', s.u.stacks.dodgeCrit);
  s5 = setup('m173', 9); s5.u.stacks.dodgeCrit = 0.45; withRand(0.01, () => T.runPassive(s5.u, 'onEvade', s5.e));
  ok(s5.u.stacks.dodgeCrit === 0.5 && !s5.e.buffs.accDown, '★9 までは上限+50%・命中低下なし');
}
console.log('--- キジ ---');
{
  let s = setup('m174', 6, 2); s.e.row = 'back'; s.e2.row = 'back';
  act(s.u, 'skill', s.u.skills[0], 0);
  ok(s.e.buffs.accDown && s.e2.buffs.accDown, '★6 眼穿ちが敵後衛全体に当たる');
  s = setup('m174', 7); let s6 = setup('m174', 6);
  const ally7 = s.B.party.find(a => a !== s.u), ally6 = s6.B.party.find(a => a !== s6.u);
  ok(ally7.sp >= 20 && ally6.sp >= 10 && ally6.sp < 20, '★7 戦闘開始時の味方全体のSP+20(★6は+10)', [ally6.sp, ally7.sp]);
  s = setup('m174', 8); ok(s.u.skills[1].critIf === 'accDown', '★8 錦の矢羽が命中低下の敵に必ず会心');
  s = setup('m174', 9); s.B.party.forEach(a => { a.sp = 0; }); act(s.u, 'ult', s.u.ult);
  const al9 = s.B.party.find(a => a !== s.u);
  let s8 = setup('m174', 8); s8.B.party.forEach(a => { a.sp = 0; }); act(s8.u, 'ult', s8.u.ult);
  const al8 = s8.B.party.find(a => a !== s8.u);
  ok(s.e.buffs.accDown.turns === s8.e.buffs.accDown.turns + 1 && al9.sp >= 15 && al8.sp < 15, '★9 千羽時雨の命中低下+1ターン・撃ったあと味方全体SP+15', [s8.e.buffs.accDown.turns, s.e.buffs.accDown.turns, al9.sp]);
  s = setup('m174', 10); T.addBuff(s.e, 'accDown', 0.2, 2, s.u);
  const ally = s.B.party.find(a => a !== s.u);
  ok(Math.abs(T.runPassive(s.u, 'allyDmgBonus', ally, s.e) - 0.15) < 1e-9, '★10 命中低下の敵への味方全体の与ダメージ+15%');
}
console.log('--- アカオニ ---');
{
  let s = setup('m175', 6); ok(s.u.skills[0].ct === 2 && T.MONSTER_KITS.m175.skill1.ct === 3, '★6 金棒振りのCT2');
  s = setup('m175', 7); s.u.hp = s.u.maxHp * 0.55; const r7 = T.passiveMod(s.u, 'dmgBonus', s.e);
  let s6 = setup('m175', 6); s6.u.hp = s6.u.maxHp * 0.55;
  ok(r7 >= 0.2 && T.passiveMod(s6.u, 'dmgBonus', s6.e) === 0, '★7 激昂がHP60%以下から乗る');
  s = setup('m175', 8); act(s.u, 'skill', s.u.skills[1], 1); const t8 = s.u.buffs.strUp.turns;
  s6 = setup('m175', 7); act(s6.u, 'skill', s6.u.skills[1], 1);
  ok(t8 === s6.u.buffs.strUp.turns + 1, '★8 鬼の怒りの攻撃力上昇+1ターン');
  s = setup('m175', 9); act(s.u, 'ult', s.u.ult);
  ok(s.u.buffs.strUp && s.u.buffs.strUp.turns === 2, '★9 鬼の大暴れのあと攻撃力上昇2ターン');
  s = setup('m175', 10); const before = T.passiveMod(s.u, 'dmgBonus', s.e);
  T.killUnit(s.ally, s.e);
  ok(Math.abs(T.passiveMod(s.u, 'dmgBonus', s.e) - before - 0.3) < 1e-9, '★10 味方が倒れると与ダメージ+30%');
}
console.log('--- アオオニ ---');
{
  let s = setup('m176', 6); T.addBuff(s.u, 'taunt', 1, 2, s.u);
  ok(T.passiveMod(s.u, 'cutBonus', 'phys') === 0.15, '★6 挑発中は受けるダメージ-15%');
  s = setup('m176', 7); ok(s.u.coverMax === 2, '★7 かばえる回数が1ラウンドに2回');
  s = setup('m176', 8, 2); s.e2.row = 'front'; act(s.u, 'skill', s.u.skills[1], 1);
  ok(s.e.hp < 99999 && s.e2.hp < 99999, '★8 金棒打ちが敵前衛全体');
  s = setup('m176', 9); act(s.u, 'ult', s.u.ult);
  const weak = s.B.party.find(a => a !== s.u); weak.hp = 1; s.u.shields = []; delete s.u.buffs.taunt;
  s.B.party.forEach(a => { if(a !== s.u && a !== weak) a.alive = false; }); weak.row = 'front'; s.u.row = 'back';
  withRand(0.5, () => T.performAction(s.e, 'normal', { name: '攻撃', atk: 'phys', tgt: 'single', pow: 1 }));
  ok(weak.hp === 1 && T.shieldTotal(s.u) > 0, '★9 結界の間、かばって受けたダメージの一部がシールドになる', T.shieldTotal(s.u));
  s = setup('m176', 10); s.u.hp = 5; s.u.shields = [];
  withRand(0.5, () => T.strike({ actor: s.e, act: { atk: 'phys' }, kind: 'normal' }, s.u, { pow: 50 }));
  const allCut = s.B.party.filter(a => a.alive).every(a => a.buffs.cut && a.buffs.cut.v === 0.2);
  ok(s.u.alive && s.u.hp === 1 && allCut, '★10 1度だけHP1で耐え、味方全体に被ダメージ軽減-20%');
  s.u.hp = 5; withRand(0.5, () => T.strike({ actor: s.e, act: { atk: 'phys' }, kind: 'normal' }, s.u, { pow: 50 }));
  ok(!s.u.alive, '★10 2度目は耐えない');
}

Date.now = realNow;
console.log(fail ? `\n${fail}件 失敗` : '\nすべて通過');
process.exit(fail ? 1 : 0);
