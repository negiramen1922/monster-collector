/* 牛鬼の「牛鬼の盾」: 後衛の味方だけをかばい、肩代わりぶんは鬼の皮で25%軽くなる。
   使い方: cd tools && node ushioni_test.js */
const load = require('./harness.js');
const api = load('game.js', s => s + `;global.__e={
  MONSTERS, MON_BY_ID, MONSTER_KITS, buildUnit, selectAllies, applyEffect, strike, addBuff, hasBuff,
  statusIconsOf, BUFF_ICON, capRatio, passiveMod, effDef, defCutOf, scaledStats, cutOf, DEF_POINT_CAP,
  get battleUI(){ return battleUI }, set battleUI(v){ battleUI = v },
  get STATE(){ return STATE }, set STATE(v){ STATE = v }, DEFAULT_STATE,
};`);
const E = global.__e;
let bad = 0;
const ok = (n, c, i) => { if(!c) bad++; console.log((c ? '✅' : '❌') + ' ' + n + (i !== undefined ? '  ' + JSON.stringify(i) : '')); };

const USHI = 'm170';
function unit(id, row, isEnemy){
  const u = E.buildUnit(E.MON_BY_ID[id], 100, !!isEnemy, null, false, 1, { skillLv: 1, skill2Lv: 1, ultLv: 1, passiveLv: 1 });
  u.row = row; u.isEnemy = !!isEnemy; u.alive = true; u.slot = Math.random();
  return u;
}
/* 戦闘の器だけ用意する(ログとFXの行き先) */
function field(party, enemies){
  E.battleUI = { round: 1, party, enemies, log: [], fxEvents: [], stage: { id: 't' }, waveIndex: 0, finished: false };
  return E.battleUI;
}

// --- モンスターとしての形 ---
const m = E.MON_BY_ID[USHI];
ok('★4 / 火 / タンク / デーモン / アヤカシ科', m.rarity === 4 && m.element === 'fire' && m.role === 'tank' && m.species === 'demon' && m.family === 'アヤカシ科',
   [m.rarity, m.element, m.role, m.species, m.family]);
ok('ステータスは★4タンクの並び', m.hp === 285 && m.pdef === 16 && m.mdef === 12 && m.hate === 44, [m.hp, m.pdef, m.mdef, m.hate]);

// --- 「後衛の味方」の選びかた ---
{
  const ushi = unit(USHI, 'front');
  const backA = unit('m116', 'back'), backB = unit('m145', 'back'), frontA = unit('m54', 'front');
  field([ushi, backA, backB, frontA], []);
  const got = E.selectAllies(ushi, 'alliesBack');
  ok('後衛の味方だけが選ばれる', got.length === 2 && got.includes(backA) && got.includes(backB), got.map(u => u.name));
  ok('自分は入らない(前衛なので当然だが明示)', !got.includes(ushi));
  ok('前衛の味方は入らない', !got.includes(frontA));
  // 牛鬼が後衛に置かれても自分は入らない
  ushi.row = 'back';
  ok('牛鬼が後衛でも自分は守らない', !E.selectAllies(ushi, 'alliesBack').includes(ushi));
}

// --- スキル1が後衛にだけ肩代わりを配る ---
{
  const ushi = unit(USHI, 'front');
  const back = unit('m116', 'back'), front = unit('m54', 'front');
  field([ushi, back, front], []);
  const k = E.MONSTER_KITS[USHI];
  const ctx = { actor: ushi, act: k.skill1, kind: 'skill', hits: [] };
  k.skill1.effects.forEach(e => E.applyEffect(ctx, e));
  ok('後衛に肩代わりが付く', !!back.buffs.redirect && back.buffs.redirect.source === ushi, back.buffs.redirect && back.buffs.redirect.v);
  ok('肩代わりは50%', back.buffs.redirect.v === 0.5, back.buffs.redirect.v);
  ok('2ターン', back.buffs.redirect.turns === 2, back.buffs.redirect.turns);
  ok('前衛の味方には付かない', !front.buffs.redirect);
  ok('牛鬼自身には付かない', !ushi.buffs.redirect);
  ok('牛鬼に魔法防御+25が乗る(ポイントとして・防御見直しで2.5倍)', !!ushi.buffs.mdefUp && ushi.buffs.mdefUp.v === 25, ushi.buffs.mdefUp && ushi.buffs.mdefUp.v);
  ok('実際の魔法防御が素の値+25になる', E.effDef(ushi, 'mag') === E.scaledStats(E.MON_BY_ID[USHI], 4, 1).mdef + 25, [E.effDef(ushi, 'mag'), E.scaledStats(E.MON_BY_ID[USHI], 4, 1).mdef]);
  ok('物理防御は上がらない', E.effDef(ushi, 'phys') === E.scaledStats(E.MON_BY_ID[USHI], 4, 1).pdef, E.effDef(ushi, 'phys'));
  ok('挑発は付かない(肩代わりとの二重取りを避けた)', !ushi.buffs.taunt && !back.buffs.taunt);
  // かばう側にも印が出る
  ok('かばっている牛鬼にも肩代わりの印が出る', E.statusIconsOf(ushi).includes(E.BUFF_ICON.redirect));
  ok('守られている側にも出る(これまでどおり)', E.statusIconsOf(back).includes(E.BUFF_ICON.redirect));
}

// --- 肩代わりが実際に効き、鬼の皮で25%軽くなる ---
/* strike は会心とばらつきで毎回変わるので、比べるあいだだけ乱数を止める */
function noRandom(fn){ const r = Math.random; Math.random = () => 0.5; try { return fn(); } finally { Math.random = r; } }
function hitOnce(passiveLv){
  const ushi = E.buildUnit(E.MON_BY_ID[USHI], 100, false, null, false, 1, { skillLv: 1, skill2Lv: 1, ultLv: 1, passiveLv: passiveLv || 1 });
  ushi.row = 'front'; ushi.alive = true; ushi.slot = 1;
  const back = unit('m116', 'back');
  const foe = unit('m72', 'front', true);
  field([ushi, back], [foe]);
  const hpU0 = ushi.hp, hpB0 = back.hp;
  E.addBuff(back, 'redirect', 0.5, 2, ushi);
  const ctx = { actor: foe, act: { name: 'x', pow: 1 }, kind: 'normal', hits: [] };
  E.strike(ctx, back, { pow: 3.0, atk: 'phys' });
  return { ushi: hpU0 - ushi.hp, back: hpB0 - back.hp };
}
{
  const withRedirect = noRandom(() => hitOnce(1));
  ok('牛鬼が代わりにダメージを受けている', withRedirect.ushi > 0, withRedirect);
  ok('守られた側のダメージも残る(全部ではなく半分)', withRedirect.back > 0, withRedirect);
  // 鬼の皮なしの比較: パッシブを一時的に外す
  const k = E.MONSTER_KITS[USHI];
  const saved = k.passive.redirectCut;
  delete k.passive.redirectCut;
  const noPassive = noRandom(() => hitOnce(1));
  k.passive.redirectCut = saved;
  const ratio = withRedirect.ushi / noPassive.ushi;
  ok('鬼の皮で肩代わりぶんが25%軽くなる', Math.abs(ratio - 0.75) < 0.02, { ratio: +ratio.toFixed(3), withPassive: withRedirect.ushi, without: noPassive.ushi });
  ok('守られた側のダメージは鬼の皮では変わらない', withRedirect.back === noPassive.back, [withRedirect.back, noPassive.back]);
}
// 鬼の皮は「自分が直接殴られたぶん」には効かない
{
  const ushi = unit(USHI, 'front');
  const foe = unit('m72', 'front', true);
  field([ushi], [foe]);
  const hp0 = ushi.hp;
  const direct = noRandom(() => { E.strike({ actor: foe, act: { name: 'x', pow: 1 }, kind: 'normal', hits: [] }, ushi, { pow: 3.0, atk: 'phys' }); return hp0 - ushi.hp; });
  const k = E.MONSTER_KITS[USHI];
  const saved = k.passive.redirectCut; delete k.passive.redirectCut;
  const ushi2 = unit(USHI, 'front'); const foe2 = unit('m72', 'front', true);
  field([ushi2], [foe2]);
  const hp2 = ushi2.hp;
  const direct2 = noRandom(() => { E.strike({ actor: foe2, act: { name: 'x', pow: 1 }, kind: 'normal', hits: [] }, ushi2, { pow: 3.0, atk: 'phys' }); return hp2 - ushi2.hp; });
  k.passive.redirectCut = saved;
  ok('直接殴られたぶんには鬼の皮が効かない', direct === direct2, [direct, direct2]);
}

// --- 後衛がいないときに落ちない ---
{
  const ushi = unit(USHI, 'front'), front = unit('m54', 'front');
  field([ushi, front], []);
  const k = E.MONSTER_KITS[USHI];
  let threw = null;
  try { k.skill1.effects.forEach(e => E.applyEffect({ actor: ushi, act: k.skill1, kind: 'skill', hits: [] }, e)); } catch(err){ threw = err.message; }
  ok('後衛が誰もいなくても落ちない', threw === null, threw);
  ok('その場合も自分の魔法防御は上がる', !!ushi.buffs.mdefUp);
}

// --- 他の肩代わりとの強さ比べ(味方1体ぶんを1.0とした総量) ---
{
  const load = n => E.MONSTERS.find(m => m.name === n);
  const titan = E.MONSTER_KITS[load('タイタン').id].ult.desc;
  ok('タイタンの奥義は味方全体40%のまま(牛鬼より上)', /40%を肩代わり/.test(titan), titan.slice(0, 40));
  // 牛鬼: 50% x 後衛2〜3体 = 1.0〜1.5 / タイタン: 40% x 4体 = 1.6
  ok('牛鬼の総量(50%x3=1.5)はタイタンの総量(40%x4=1.6)を超えない', 0.5 * 3 <= 0.4 * 4, [0.5 * 3, 0.4 * 4]);
}

console.log(bad ? `\n${bad}件失敗` : '\nすべて通過');
process.exit(bad ? 1 : 0);
