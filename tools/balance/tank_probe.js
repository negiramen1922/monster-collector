/* タイタンの必殺技が「そもそも撃てているか」を測る。
   ※ STATE.autoUlt は既定 false なので、game.js を書き換えて true にしないと
      プレイヤー側の必殺技は1回も出ない(最初これで0回だと誤解した)。
   使い方: N=30 node balance/tank_probe.js */
process.chdir(require('path').join(__dirname, '..'));
const load = require(require('path').join(__dirname, '..', 'harness.js'));
const N = +(process.env.N || 30);
const STAGES = (process.env.STAGES || 'q6_05h,q6_08h,q6_10h,q7_03h,q7_06h,q7_09h').split(',');
const LV = +(process.env.LV || 250);

const V = [
  ['いま (SP120)',                 120, 0.30, 0.30, 0,    10],
  ['SP100に下げるだけ',              100, 0.30, 0.30, 0,    10],
  ['SP90に下げるだけ',                90, 0.30, 0.30, 0,    10],
  ['SP90 + シールド40%',             90, 0.30, 0.30, 0.40, 10],
  ['SP120のまま 被弾SP上限を20に',      120, 0.30, 0.30, 0,    20],
  ['SP90 + 被弾SP上限20 + 盾40%',     90, 0.30, 0.30, 0.40, 20],
  ['必殺技を空にする',                 120, 0,    0,    0,    10],
];
console.log(`タイタン入り5人編成 Lv${LV} ★5 スキルLv10 / ${STAGES.join(', ')} / 各${N}回`);
console.log('案'.padEnd(30) + '勝率   城壁の発動  平均ラウンド');
for (const [name, sp, rd, df, sh, hitCap] of V) {
  const api = load('game.js', s => s
    .replace('autoUlt: false,', 'autoUlt: true,')
    .replace('const SP_HIT_CAP_PER_ROUND = 10;', `const SP_HIT_CAP_PER_ROUND = ${hitCap};`)
    + ';global.__k=MONSTER_KITS;global.__m=MONSTERS;');
  const K = global.__k, M = global.__m;
  const ult = K[M.find(x => x.name === 'タイタン').id].ult;
  ult.sp = sp;
  ult.effects = rd ? [
    { redirect: rd, turns: 3, to: 'self' },
    { buff: 'pdefUp', v: df, turns: 3, to: 'self' },
    { buff: 'mdefUp', v: df, turns: 3, to: 'self' },
  ].concat(sh ? [{ shield: sh, turns: 3, to: 'self' }] : []) : [];
  const by = Object.fromEntries(M.map(m => [m.name, m.id]));
  const party = ['タイタン', '九尾の狐', 'フェンリル', 'アバドン', '雷電'].map(n => by[n]);
  let win = 0, rounds = 0, casts = 0, total = 0;
  for (const sid of STAGES) for (let i = 0; i < N; i++) {
    const b = api.run(party, sid, LV, { star: 5, skillLv: 10, ultLv: 10, passiveLv: 10 });
    if (b.win) win++;
    rounds += b.round || 0; total++;
    const txt = (b.log || []).map(l => typeof l === 'string' ? l : (l.text || l.t || '')).join('\n');
    casts += (txt.match(/タイタン[^\n]*ティターンの城壁|ティターンの城壁/g) || []).length;
  }
  console.log(name.padEnd(30) + String(Math.round(win / total * 100) + '%').padStart(5) +
    String((casts / total).toFixed(2) + '回').padStart(12) + String((rounds / total).toFixed(1)).padStart(12));
}
