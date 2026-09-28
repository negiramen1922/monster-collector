/* 必殺技のSPが役割ごとにどれくらい貯まるかを測る。
   ※ STATE.autoUlt は既定 false で、プレイヤー側の必殺技は自動では出ない。
      測るときは game.js の 'autoUlt: false' を true に差し替える必要がある(これを忘れると全員0回になる)。
   使い方: N=40 node balance/sp_probe.js */
process.chdir(require('path').join(__dirname, '..'));
const load = require(require('path').join(__dirname, '..', 'harness.js'));
const N = +(process.env.N || 40);
const STAGES = (process.env.STAGES || 'q6_05h,q6_08h,q6_10h,q7_03h,q7_06h,q7_09h').split(',');
const LV = +(process.env.LV || 250);
const PARTY = (process.env.PARTY || 'タイタン,九尾の狐,フェンリル,アバドン,雷電').split(',');

const api = load('game.js', s => s.replace('autoUlt: false,', 'autoUlt: true,'));
const by = Object.fromEntries(api.MONSTERS.map(m => [m.name, m.id]));
const info = Object.fromEntries(api.MONSTERS.map(m => [m.name, m]));
const ids = PARTY.map(n => by[n]);
const acc = Object.fromEntries(PARTY.map(n => [n, { sp: 0, casts: 0, kills: 0, alive: 0 }]));
let total = 0, rounds = 0, wins = 0;
for (const sid of STAGES) for (let i = 0; i < N; i++) {
  const b = api.run(ids, sid, LV, { star: 5, skillLv: 10, ultLv: 10, passiveLv: 10 });
  if (b.win) wins++;
  rounds += b.round || 0; total++;
  for (const u of (b.party || [])) {
    const a = acc[u.name]; if (!a) continue;
    a.sp += u.sp || 0;
    if (u.alive) a.alive++;
    if (u.report) { a.casts += u.report.ults || 0; a.kills += u.report.kills || 0; }
  }
}
console.log(`${PARTY.join(' / ')}  Lv${LV} ★5 スキルLv10 / ${STAGES.length}ステージ×${N}回 = ${total}戦`);
console.log(`勝率 ${Math.round(wins/total*100)}%  平均 ${(rounds/total).toFixed(1)}ラウンド`);
console.log('キャラ'.padEnd(12) + '役割'.padEnd(11) + '必要SP  終了時の平均SP  生存率');
for (const n of PARTY) {
  const a = acc[n], m = info[n];
  console.log(n.padEnd(12) + m.role.padEnd(11) + String(api.MONSTER_KITS ? '' : '').padEnd(0) +
    String((a.sp / total).toFixed(0)).padStart(14) + String(Math.round(a.alive / total * 100) + '%').padStart(9));
}
