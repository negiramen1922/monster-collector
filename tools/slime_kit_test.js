/* スライムパラダイスの新しい5体のキット・星刻と、今までの★1・★2スライム6体の星刻、そのために足した戦闘の仕組みのテスト。
   中身の正は docs/提案資料/次回イベント案_スライムパラダイス.md(スキルの数値は Lv1→Lv10、パッシブは Lv1→Lv5)。
   星刻は公開時刻(SLIME_START_AT)まで出ないので、このテストでは公開ずみにして読み込む */
const load = require('./harness.js');
const api = load('game.js', s => s.replace("const SLIME_START_AT = '2026-10-26T12:00:00+09:00'", "const SLIME_START_AT = '2000-01-01T00:00:00+09:00'")
  + `;global.__t={buildUnit,MONSTERS,MON_BY_ID,MONSTER_KITS,MONSTER_PERKS,performAction,takeTurn,strike,runPassive,passiveMod,
  addBuff,effStr,effDef,hasBuff,healUnit,hitHp,killUnit,conditionMet,shieldTotal,ultSpCostFor,applyStatus,applyDebuff,settleChibis,
  get b(){return battleUI}};`);
const T = global.__t;
let fail = 0;
const ok = (c, m, v) => { console.log((c ? '✅' : '❌') + ' ' + m + (v !== undefined ? '  ' + JSON.stringify(v) : '')); if(!c) fail++; };
const realRand = Math.random;
const withRand = (v, f) => { Math.random = () => v; try { return f(); } finally { Math.random = realRand; } };
// ids の順に並べる(先頭が試すキャラ)。star: ★(星刻を見るときは10)
function setup(ids, opts){
  const o = opts || {};
  api.run([], 'q1_01', 1);
  const S = api.STATE; S.owned = {};
  ids.forEach(x => S.owned[x] = { star: o.star || Math.max(4, api.MON_BY_ID[x].rarity), souls: 0, level: 30, exp: 0,
    skillLv: o.lv || 1, skill2Lv: o.lv || 1, ultLv: o.lv || 1, passiveLv: o.pv || 1 });
  S.formationKey = 'f2'; S.slots = api.lineupFromList(ids, 'f2'); S.autoUlt = true; S.clearedStages = api.STAGES.map(s => s.id);
  api.startBattle('q1_01', { skipIntro: true });
  const B = T.b; B.transitioning = false; B.paused = true; B.queue = [];
  B.enemies.forEach(e => { e.maxHp = e.hp = 99999; e.str = 60; e.pdef = 0; e.mdef = 0; e.alive = true; e.buffs = {}; e.statuses = {}; e.passive = {}; e.shields = []; e.row = 'front'; e.element = 'none'; });
  B.enemies.slice(1).forEach(e => { e.alive = false; });
  return { B, u: B.party.find(x => x.ref === ids[0]), e: B.enemies[0] };
}
const act = (u, kind, a, slot) => withRand(0.5, () => T.performAction(u, kind, a, slot));
const hitBy = (atk, t, type, pow) => withRand(0.5, () => T.strike({ actor: atk, act: { atk: type || 'phys' }, kind: 'normal' }, t, { pow: pow || 1 }));

console.log('--- データ ---');
const M = T.MON_BY_ID;
const exp = {
  m185:['キングスライム',4,'water','tank',320,36,12,10,26],
  m186:['アークエンジェルスライム',4,'light','shooter',185,56,5,9,46],
  m187:['アーススライム',3,'earth','tank',240,32,15,8,24],
  m188:['ウィンドスライム',3,'wind','shooter',150,46,4,7,58],
  m189:['ゴールドスライム',3,'none','tank',190,30,16,10,60],
};
Object.entries(exp).forEach(([id, [name, r, el, role, hp, str, pd, md, spd]]) => {
  const m = M[id];
  ok(m && m.name === name && m.rarity === r && m.element === el && m.role === role && m.hp === hp && m.str === str && m.pdef === pd && m.mdef === md && m.spd === spd
    && m.family === 'アモルファス科' && m.tribe === 'スライム族' && m.species === 'amorphous' && m.releaseAt === '2026-10-26T12:00:00+09:00',
    `${name}(★${r}・${el}・${role}・アモルファス科スライム族・10/26 12:00 公開)`);
});
ok(T.ultSpCostFor('tank', T.MONSTER_KITS.m185.ult.sp) === 70 && T.ultSpCostFor('shooter', T.MONSTER_KITS.m186.ult.sp) === 80 && T.MONSTER_KITS.m189.ult.sp === 40,
  '奥義の必要SP(キング70・アーク80・ゴールド40)');
['m185', 'm186', 'm187', 'm188', 'm189', 'm06', 'm32', 'm33', 'm34', 'm35', 'm36'].forEach(id =>
  ok([6, 7, 8, 9, 10].every(n => T.MONSTER_PERKS[id] && T.MONSTER_PERKS[id][n] && T.MONSTER_PERKS[id][n].desc) && T.MONSTER_PERKS[id].from === '2000-01-01T00:00:00+09:00',
    `${M[id].name}: 星刻★6〜★10がある(from はイベント開始)`));

console.log('--- キングスライム ---');
{
  const { B, u, e } = setup(['m185', 'm186', 'm187', 'm188']);
  act(u, 'skill', u.skills[0], 0);
  const others = B.party.filter(a => a !== u);
  ok(others.every(a => a.buffs.redirect && a.buffs.redirect.v === 0.8 && a.buffs.redirect.turns === 3 && a.buffs.redirect.source === u) && !u.buffs.redirect,
    'スキル1: 自分以外の味方全体をかばう(80%・3ターン)');
  ok(Math.abs(T.shieldTotal(u) - Math.round(u.maxHp * 0.3)) <= 1, 'スキル1: 自分に最大HPの30%のシールド', [T.shieldTotal(u), u.maxHp]);
  ok(T.passiveMod(u, 'critTakenCut') === 1, 'かばっている間は会心を受けない');
  const a = others[0], before = u.hp + T.shieldTotal(u);
  hitBy(e, a);
  ok(u.hp + T.shieldTotal(u) < before, '味方が殴られると、キングが肩代わりする');
}
{
  const { B, u } = setup(['m185', 'm186', 'm187']);
  const hp = u.maxHp;
  T.killUnit(u, null);
  const chibis = B.party.filter(c => c.chibiOf === u);
  ok(!u.alive && chibis.length === 2 && chibis.every(c => c.alive && c.name === 'ちびスライム' && c.maxHp === Math.round(hp * 0.2) && c.skills.length === 0),
    '倒れると、ちびスライム2体(最大HP20%・ワザは通常攻撃だけ)に分かれる', chibis.map(c => c.maxHp));
  ok(chibis.some(c => c.slot === u.slot) && new Set(chibis.map(c => c.slot)).size === 2, 'キングのいた枠と、空いている枠に出る');
  ok(chibis.every(c => c.buffs.taunt && c.buffs.taunt.turns === 1), 'ちびは挑発を1ターン持つ');
  ok(!B.allyFell, '分かれた時点では「倒れた」に数えない');
  T.killUnit(chibis[0], null);
  ok(!B.allyFell, 'ちびが1体倒れても、まだ数えない');
  T.killUnit(chibis[1], null);
  ok(B.allyFell, 'ちびが2体とも倒れたとき、キングが倒れたことになる');
}
{
  const { B, u } = setup(['m185', 'm186', 'm187', 'm188', 'm189']);
  T.killUnit(u, null);
  ok(B.party.filter(c => c.chibiOf === u).length === 1, '空いている枠がなければ、ちびは1体だけ');
  const c = B.party.find(x => x.chibiOf === u); c.hp = 50;
  T.settleChibis(B);
  ok(u.alive && u.hp === 50 && !B.party.some(x => x.chibiOf), '戦闘が終わったら、ちびを片付け、キングは立っていたことにする(HPはちびの合計)');
}
{
  const { B, u } = setup(['m185', 'm186', 'm187'], { star: 10 });
  const sp0 = B.party.find(x => x.ref === 'm186').sp;
  T.killUnit(u, null);
  const chibis = B.party.filter(c => c.chibiOf === u);
  ok(chibis.every(c => c.buffs.taunt.turns === 2) && B.party.find(x => x.ref === 'm186').sp === sp0 + 15, '★7: ちびが出てきたとき味方全体のSP+15・ちびの挑発2ターン');
  chibis.forEach(c => T.killUnit(c, null));
  ok(u.alive && u.hp === Math.round(u.maxHp * 0.5) && !B.allyFell, '★10: ちびが2体とも倒れると、キングがHP50%で戻ってくる(倒れたことにならない)');
  T.killUnit(u, null);
  ok(!u.alive && B.allyFell && !B.party.some(c => c.chibiOf === u && c.alive), '戻ってきたあとに倒れたら、もう分かれない');
  ok(T.MONSTER_PERKS.m185[9] && u.ult.effects.some(x => x.shield && x.turns === 3 && x.shieldImmune), '★9: 奥義のシールドが3ターン・状態異常にかからない');
}

console.log('--- アークエンジェルスライム ---');
{
  const { B, u, e } = setup(['m186', 'm185', 'm187']);
  const low = B.party.find(x => x.ref === 'm187'); low.hp = 10;
  act(u, 'skill', u.skills[0], 0);
  const n = B.log.filter(l => l.includes('光の矢雨')).length;
  ok(u.skills[0].hits === 11, 'スキル1は11回');
  ok(low.hp === 10 + 5 * Math.round(T.effStr(u) * 0.1) || low.hp > 10, '1ヒットごとにHPの割合が一番低い味方を回復する', low.hp);
  ok(u.flags.blessN === 5, '1回の行動で5回まで', u.flags.blessN);
}
{
  const { u } = setup(['m186', 'm185'], { star: 10 });
  ok(u.skills[0].hits === 13 && u.blessTwo && u.blessCleanse, '★6: 13回 / ★7: 弱体化の解除 / ★10: 2人を回復');
}

console.log('--- アーススライム ---');
{
  const { u, e } = setup(['m187', 'm186']);
  hitBy(e, u, 'phys');
  ok(T.hasBuff(e, 'spdDown') && e.buffs.spdDown.v === 10, '物理攻撃を受けると、攻撃してきた敵に鈍化(SPD-10)');
  delete e.buffs.spdDown;
  hitBy(e, u, 'mag');
  ok(!T.hasBuff(e, 'spdDown'), '魔法攻撃では鈍化しない(★7から)');
}
{
  const { u, e } = setup(['m187', 'm186'], { star: 10 });
  hitBy(e, u, 'mag');
  ok(T.hasBuff(e, 'spdDown'), '★7: 魔法攻撃でも鈍化');
  const slowHit = (() => { const hp = u.hp; hitBy(e, u, 'phys', 2); return hp - u.hp; })();
  delete e.buffs.spdDown; u.hp = u.maxHp;
  u.passive = { ...u.passive, onHitBy: null };
  const plainHit = (() => { const hp = u.hp; hitBy(e, u, 'phys', 2); return hp - u.hp; })();
  ok(slowHit < plainHit, '★10: 鈍化状態の敵から受けるダメージ-20%', [slowHit, plainHit]);
}

console.log('--- ウィンドスライム ---');
{
  const { B, u, e } = setup(['m188', 'm186', 'm185'], { star: 10 });
  const arc = B.party.find(x => x.ref === 'm186');
  const hp = e.hp;
  act(arc, 'skill', arc.skills[1], 1);
  ok(B.log.some(l => l.includes('追い風')) && u.flags.windN === 1, '味方がスキルで攻撃すると、追い風で追撃する(★10は必ず)');
  act(arc, 'skill', arc.skills[1], 1); act(arc, 'skill', arc.skills[1], 1);
  ok(u.flags.windN === 2, '1ラウンドに2回まで');
}
{
  const { B, u, e } = setup(['m188', 'm186']);
  const arc = B.party.find(x => x.ref === 'm186');
  withRand(0.9, () => T.performAction(arc, 'skill', arc.skills[1], 1));
  ok(!u.flags.windN, '★10でなければ確率(30%)。外れたら追撃しない');
  act(arc, 'normal', arc.normal);
  ok(!u.flags.windN, '通常攻撃には乗らない');
}

console.log('--- ゴールドスライム ---');
{
  const { u, e } = setup(['m189', 'm186']);
  const P = T.MONSTER_KITS.m189.passive;
  ok(Math.abs(P.cutBonus(u, 'phys', 100, e, false) - 0.1) < 1e-9 && Math.abs(P.cutBonus(u, 'phys', 100, e, true) + 0.3) < 1e-9, '受けるダメージ-10%。会心のときは軽減がなく+30%');
}
{
  const { B, u, e } = setup(['m189', 'm186'], { star: 10 });
  ok(u.buffs.taunt && u.buffs.taunt.turns === 2, '★7: 戦闘開始時に挑発2ターン');
  ok(T.passiveMod(u, 'critTakenCut') === 1, '★6: 挑発の間は会心を受けない');
  u.hp = 5;
  T.hitHp(u, 999, e, {});
  ok(u.alive && u.hp === 1 && !B.allyFell, '★10: HPが0になる攻撃を受けてもHP1で耐える');
  T.hitHp(u, 999, e, {});
  ok(!u.alive, '★10: 1戦闘に1回だけ。耐えたあとのダメージは0にならない(2026-10-26 ユーザー決定)');
}

console.log('--- 今までのスライムの星刻(★10) ---');
{
  const { B, u, e } = setup(['m06', 'm185', 'm187'], { star: 10 });
  ok(u.skills[0].effects.some(x => x.buff === 'pdefUp' && x.v === 25), 'アクア★6: 物理防御上昇 +15 → +25');
  ok(u.passive.coverLowest, 'アクア★10: HPの割合が一番低い味方への単体攻撃をかばう');
}
{
  const { B, u } = setup(['m32', 'm185', 'm06', 'm186'], { star: 10 });
  const slimes = B.party.filter(a => a.tribe === 'スライム族');
  ok(slimes.every(a => a.buffs.regen && a.buffs.regen.v === 0.03), 'モス★10: 戦闘開始時、自分と味方のスライム族に継続回復3%');
}
{
  const { B, u, e } = setup(['m33', 'm185', 'm06'], { star: 10 });
  const king = B.party.find(x => x.ref === 'm185');
  withRand(0, () => T.strike({ actor: e, act: { atk: 'phys' }, kind: 'normal' }, king, { pow: 1 }));
  ok(e.statuses.burn, 'マグマ★10: 味方のスライム族が物理攻撃を受けたときも、やけど返し');
}
{
  const { B, u, e } = setup(['m35', 'm185'], { star: 10 });
  T.applyStatus(e, 'poison', u);
  const t0 = e.statuses.poison.turns;
  act(u, 'normal', u.normal);
  act(u, 'normal', u.normal);
  ok(e.statuses.poison.turns === t0 + 1, 'ヴェノム★10: 毒の敵に当たると、毒の残りターン+1(1ラウンドに1回)', [t0, e.statuses.poison.turns]);
}
{
  const { B, u, e } = setup(['m36', 'm185', 'm06'], { star: 10 });
  const king = B.party.find(x => x.ref === 'm185');
  const hp = e.hp;
  withRand(0, () => T.strike({ actor: e, act: { atk: 'phys' }, kind: 'normal' }, king, { pow: 1 }));
  ok(e.hp < hp, 'アイアン★10: 味方のスライム族が物理攻撃を受けたときも反撃');
}
{
  const { B, u } = setup(['m34', 'm185', 'm06', 'm186'], { star: 10 });
  B.party.forEach(a => { a.hp = Math.round(a.maxHp * 0.5); });
  B.party.find(x => x.ref === 'm06').hp = 10; B.party.find(x => x.ref === 'm186').hp = 20;
  act(u, 'skill', u.skills[0], 0);
  const healed = ['m06', 'm186'].map(id => B.party.find(x => x.ref === id));
  ok(healed.every(a => a.hp > 20) && healed.every(a => a.buffs.cut && a.buffs.cut.v === 0.1), 'ホーリー★10: 低い順に2人を回復し、スライム族に被ダメージ軽減-10%');
}

console.log(fail ? `${fail}件 失敗` : 'すべて通過');
process.exit(fail ? 1 : 0);
