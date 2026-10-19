/* キングスライム案のスキル1「かばう」と「挑発」を、同じ物差しで測る。
   ベヒモス(m60)の枠を借りて、ステータスとキットをキングスライム案に置きかえる。
   変えるのはスキル1だけ。パッシブはなし、スキル2・奥義はキングスライム案のまま(全部の案で同じ)。
   物差し: 「味方全体に被ダメージ軽減X%・3ターン」をスキル1にした案を並べ、勝率が同じになる X を採点の点に直す
   (被ダメ軽減 10%・1ターン = 2.5点、味方全体 ×2.5 → X%・3ターン = 2.5 × X/10 × 3 × 2.5)。
   使い方: N=40 LV=150 node tools/balance/king_probe.js */
process.chdir(require('path').join(__dirname, '..'));
const load = require(require('path').join(__dirname, '..', 'harness.js'));
const N = +(process.env.N || 40);
const LV = +(process.env.LV || 150);
const STAGES = (process.env.STAGES || 'q6_05h,q6_08h,q6_10h,q7_03h,q7_06h,q7_09h').split(',');
const ALLIES = (process.env.ALLIES || '九尾の狐,フェンリル,アバドン,雷電').split(',');
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const cut = x => [{ to: 'allies', buff: 'cut', v: x, turns: 3 }];
const V = [
  ['なし(自分に何もしない)', []],
  ['基準: 味方全体 被ダメ軽減10%・3T', cut(0.1)],
  ['基準: 味方全体 被ダメ軽減20%・3T', cut(0.2)],
  ['基準: 味方全体 被ダメ軽減30%・3T', cut(0.3)],
  ['基準: 味方全体 被ダメ軽減40%・3T', cut(0.4)],
  ['挑発2T', [{ to: 'self', taunt: 2 }]],
  ['挑発2T + シールド10%(前の案)', [{ to: 'self', taunt: 2 }, { to: 'self', shield: 0.1, base: 'maxHp', turns: 2 }]],
  ['かばう30%・3T', [{ to: 'allies', redirect: 0.3, turns: 3 }]],
  ['かばう40%・1T', [{ to: 'allies', redirect: 0.4, turns: 1 }]],
  ['かばう80%・1T', [{ to: 'allies', redirect: 0.8, turns: 1 }]],
  ['かばう80%・3T', [{ to: 'allies', redirect: 0.8, turns: 3 }]],
  ['前衛だけかばう80%・3T', [{ to: 'alliesFront', redirect: 0.8, turns: 3 }]],
  ['前衛だけかばう80%・3T + シールド10%', [{ to: 'alliesFront', redirect: 0.8, turns: 3 }, { to: 'self', shield: 0.1, base: 'maxHp', turns: 2 }]],
  ['後衛だけかばう80%・3T', [{ to: 'alliesBack', redirect: 0.8, turns: 3 }]],
  ['後衛だけかばう80%・3T + シールド10%', [{ to: 'alliesBack', redirect: 0.8, turns: 3 }, { to: 'self', shield: 0.1, base: 'maxHp', turns: 2 }]],
  ['1人(HPの割合が一番低い味方)をかばう80%・3T', [{ to: 'allyOther', redirect: 0.8, turns: 3 }]],
  ['全体かばう80%・3T + シールド20%・3T', [{ to: 'allies', redirect: 0.8, turns: 3 }, { to: 'self', shield: 0.2, base: 'maxHp', turns: 3 }]],
  ['全体かばう80%・3T + シールド30%・3T', [{ to: 'allies', redirect: 0.8, turns: 3 }, { to: 'self', shield: 0.3, base: 'maxHp', turns: 3 }]],
  ['全体かばう80%・3T + シールド50%・3T', [{ to: 'allies', redirect: 0.8, turns: 3 }, { to: 'self', shield: 0.5, base: 'maxHp', turns: 3 }]],
  ['全体かばう50%・3T + シールド10%', [{ to: 'allies', redirect: 0.5, turns: 3 }, { to: 'self', shield: 0.1, base: 'maxHp', turns: 2 }]],
  ['かばう80%・3T + シールド10%(今の案)', [{ to: 'allies', redirect: 0.8, turns: 3 }, { to: 'self', shield: 0.1, base: 'maxHp', turns: 2 }]],
];
const KING = { hp: +(process.env.KHP || 320), str: 36, pdef: 12, mdef: 10, spd: 26, hate: 45 };
console.log(`キングスライム案(★4) + ${ALLIES.join('・')}(★5) / Lv${LV} / スキルLv1 / ${STAGES.join(', ')} / 各${N}回`);
const rows = [];
for (const [name, effects] of V) {
  if (ONLY && !ONLY.some(o => name.includes(o))) continue;
  // alliesFront(前衛の味方・自分は入らない)は今のゲームにないので、測るときだけ足す。倒れたラウンドも記録する
  const api = load('game.js', s => s.replace('autoUlt: false,', 'autoUlt: true,')
    .replace("case 'alliesBack': return here.filter(u => u !== actor && u.row === 'back');",
             "case 'alliesBack': return here.filter(u => u !== actor && u.row === 'back');\n    case 'alliesFront': return here.filter(u => u !== actor && u.row !== 'back');")
    .replace('function killUnit(u, killer, cause){\n  u.alive = false;', 'function killUnit(u, killer, cause){\n  u.alive = false; u.deathRound = battleUI.round;')
    + ';global.__k=MONSTER_KITS;global.__m=MONSTERS;');
  const K = global.__k, M = global.__m;
  const m = M.find(x => x.id === 'm60'); Object.assign(m, KING);
  K.m60 = {
    normal: { name: '王のボディプレス', desc: '', atk: 'phys', tgt: 'single', pow: 0.8 },
    skill1: { name: '王のふところ', desc: '', ct: 3, tgt: 'self', effects },
    skill2: { name: 'ロイヤルプレス', desc: '', ct: 4, atk: 'phys', tgt: 'frontAll', pow: 1.1, onHit: [{ debuff: 'spdDown', v: 10, flat: true }] },
    passive: { name: 'なし', desc: '' },
    ult: { name: 'スライム王国', desc: '', sp: 70, tgt: 'allies', effects: [{ to: 'self', taunt: 3 }, { to: 'allies', shield: 0.1, base: 'casterMaxHp', turns: 2 }, { to: 'self', heal: 0 }] },
  };
  const by = Object.fromEntries(M.map(x => [x.name, x.id]));
  const party = ['m60', ...ALLIES.map(n => by[n])];
  let win = 0, total = 0, rounds = 0, kingAlive = 0, othersAlive = 0, kingRounds = 0, kingR3 = 0, kingR5 = 0, frontN = 0; const per = {};
  for (const sid of STAGES) { per[sid] = 0; for (let i = 0; i < N; i++) {
    const b = api.run(party, sid, LV, { star: 5, skillLv: 1, ultLv: 1, passiveLv: 1 });
    if (b.win) { win++; per[sid]++; }
    rounds += b.round || 0; total++;
    const pu = (b.party || []).filter(Boolean);
    const k = pu.find(u => u.ref === 'm60');
    if (k && k.alive) kingAlive++;
    // キングが立っていたラウンド数(最後まで立っていれば戦闘のラウンド数)。ウェーブをまたいでも battleUI.round は通しで数える
    const kr = k ? (k.alive ? (b.round || 0) : (k.deathRound || 0)) : 0;
    kingRounds += kr; if (!k || k.alive || kr > 3) kingR3++; if (!k || k.alive || kr > 5) kingR5++;
    frontN += pu.filter(u => u !== k && u.row !== 'back').length;
    othersAlive += pu.filter(u => u !== k && u.alive).length;
  } }
  const wr = win / total;
  rows.push([name, wr]);
  if (name.startsWith('なし')) console.log(`(キング以外の前衛 平均${(frontN / total).toFixed(1)}体)`);
  console.log(name.padEnd(36) + String((wr * 100).toFixed(1) + '%').padStart(7) + String((rounds / total).toFixed(1)).padStart(7) + String('キング生存' + Math.round(kingAlive / total * 100) + '%').padStart(10) + String('立っていた' + (kingRounds / total).toFixed(1) + 'R').padStart(10) + String('4R目' + Math.round(kingR3 / total * 100) + '%').padStart(8) + String('6R目' + Math.round(kingR5 / total * 100) + '%').padStart(8) + String('ほか生存' + (othersAlive / total).toFixed(2) + '体').padStart(10) + '  ' + STAGES.map(s => Math.round(per[s] / N * 100)).join('/'));
}
// 基準の線から点に直す
const ref = [[0, rows.find(r => r[0].startsWith('なし'))?.[1]], ...[10, 20, 30, 40].map(x => [x, rows.find(r => r[0].includes(`軽減${x}%`))?.[1]])].filter(r => r[1] !== undefined);
if (ref.length >= 3) {
  console.log('\n点に直す(勝率が同じになる「味方全体 被ダメ軽減X%・3T」の点 = 2.5×X/10×3×2.5)');
  for (const [name, wr] of rows) {
    if (name.startsWith('基準') || name.startsWith('なし')) continue;
    let x;
    for (let i = 0; i + 1 < ref.length; i++) {
      const [x0, w0] = ref[i], [x1, w1] = ref[i + 1];
      if ((wr - w0) * (wr - w1) <= 0 && w1 !== w0) { x = x0 + (x1 - x0) * (wr - w0) / (w1 - w0); break; }
    }
    const pts = x === undefined ? null : 2.5 * x / 10 * 3 * 2.5;
    if (name.startsWith('なし')) console.log(`(キング以外の前衛 平均${(frontN / total).toFixed(1)}体)`);
  console.log(name.padEnd(36) + (x === undefined ? (wr > ref[ref.length - 1][1] ? '基準40%より上' : '基準より下') : `軽減${x.toFixed(1)}%相当 → ${pts.toFixed(1)}点`));
  }
}
