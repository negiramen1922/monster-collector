/* 凸ボーナス(★6〜★10)のテスト。★5と★10でユニットの中身が変わることを確かめる。
   中身の正は docs/design/凸ボーナス_ピックアップ4体.json */
const load = require('./harness.js');
const api = load('game.js', s => s.replace('autoUlt: false,', 'autoUlt: true,')
  + ';global.__t={buildUnit,MONSTERS,MONSTER_KITS,perksOf,hasStatus,hasBuff,effSpd,passiveMod};');
const T = global.__t;
let fail = 0;
const ok = (c, m, v) => { console.log((c ? '✅' : '❌') + ' ' + m + (v !== undefined ? '  ' + JSON.stringify(v) : '')); if (!c) fail++; };
const mk = (name, star) => {
  const m = T.MONSTERS.find(x => x.name === name);
  return T.buildUnit(m, 1, false, star, false, 100, { skillLv: 10, skill2Lv: 10, ultLv: 10, passiveLv: 10 });
};
const foe = (hpPct, st) => ({ hp: hpPct * 100, maxHp: 100, alive: true, name: '的', statuses: st || {}, buffs: {}, passive: {}, spd: 1 });

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
ok(Math.abs(T.passiveMod(t10, 'cutBonus') - 0.435) < 0.01, '★7 HP90%なら被ダメ-30%(パッシブLv10で-43.5%)', T.passiveMod(t10, 'cutBonus').toFixed(3));
t10.hp = t10.maxHp * 0.6;
ok(Math.abs(T.passiveMod(t10, 'cutBonus') - 0.2175) < 0.01, 'HP60%なら-15%のまま(重ならない)', T.passiveMod(t10, 'cutBonus').toFixed(3));
ok(t10.wallTurns === 4 && t10.wallShare === 0.6, '★10で城壁が4ターン・肩代わり60%', { t: t10.wallTurns, s: t10.wallShare });
ok(!!t10.wallBank && t10.wallBank.cap === 0.6, '★10でSTRに変える仕組みが付く');
ok(t5.wallTurns === undefined, '★5には付かない');
ok(t10.skills[1].onHit.find(e => e.st === 'stun').chance === 0.5, '★9で岩盤砕きの気絶が50%');
ok(t5.skills[1].onHit.find(e => e.st === 'stun').chance === 0.2, '★5は20%のまま');

console.log('--- フェンリル ---');
const f10 = mk('フェンリル', 10), f5 = mk('フェンリル', 5);
ok(T.passiveMod(f10, 'spdBonus') === 10, '★6でSPD+10', T.passiveMod(f10, 'spdBonus'));
ok(T.passiveMod(f5, 'spdBonus') === 0, '★5は0');
ok(f10.skills[1].effects[0].turns === 4, '★7で暴風の遠吠えが4ターン');
ok(f5.skills[1].effects[0].turns === 3, '★5は3ターン');
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
ok(Math.abs(T.passiveMod(a10, 'critBonus', low) - (0.435 + 0.10 + 0.20)) < 0.01, '★6+★8で会心率(パッシブ+43.5% +10% +20%)', T.passiveMod(a10, 'critBonus', low).toFixed(3));
ok(Math.abs(T.passiveMod(a10, 'critDmgBonus') - 0.30) < 0.001, '★8で会心倍率+30%');

console.log(fail ? `\n${fail}件 失敗` : '\nすべて通過');
process.exit(fail ? 1 : 0);
