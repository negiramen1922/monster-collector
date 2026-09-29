/* 1戦のあいだに、通常攻撃・スキル1・スキル2・奥義がそれぞれ何回出ているかを測る。
   味方と敵の両方。スキル2はCT+1(初期CTもCT+1)で、しかも
   「空いているスキルのうち若い番号」が選ばれるので、本当に出番があるのかを見る。
   使い方: N=30 node balance/skill_use_probe.js */
process.chdir(require('path').join(__dirname, '..'));
const load = require(require('path').join(__dirname, '..', 'harness.js'));
const N = +(process.env.N || 30);
const STAGES = (process.env.STAGES || 'q4_05,q5_05,q6_05,q6_10,q7_05,q7_10').split(',');
const LV = +(process.env.LV || 250);

const api = load('game.js', s => s
  .replace('autoUlt: false,', 'autoUlt: true,')
  // 行動の種類をユニットに数えさせる
  .replace(`      u.skillCd[slot] = skillCt(u, slot) + (slot === 0 ? 0 : 1);`,
           `      u.useCount = u.useCount || {}; u.useCount['skill' + (slot + 1)] = (u.useCount['skill' + (slot + 1)] || 0) + 1;
      u.skillCd[slot] = skillCt(u, slot) + (slot === 0 ? 0 : 1);`)
  .replace(`      performAction(u, 'normal', u.normal);`,
           `      u.useCount = u.useCount || {}; u.useCount.normal = (u.useCount.normal || 0) + 1;
      performAction(u, 'normal', u.normal);`)
  .replace(`  if(ENEMY_SYNERGY) applySynergies(units);
  units.forEach(u => runGimmick(u, 'start'));
  return units;`,
           `  if(ENEMY_SYNERGY) applySynergies(units);
  units.forEach(u => runGimmick(u, 'start'));
  (global.__spawned = global.__spawned || []).push(...units);
  return units;`)
  + ';global.__e={MONSTERS,MON_BY_ID,skillCt};');
const E = global.__e;
const by = Object.fromEntries(E.MONSTERS.map(m => [m.name, m.id]));
const party = ['タイタン', '九尾の狐', 'フェンリル', 'アバドン', '雷電'].map(n => by[n]);

const sum = { ally: {}, enemy: {} };
const byRole = {};
const add = (side, u) => {
  if(side === 'ally'){
    const r = byRole[u.role] = byRole[u.role] || { units: 0 };
    r.units++; r.name = u.name;
    ['normal', 'skill1', 'skill2'].forEach(k => { r[k] = (r[k] || 0) + ((u.useCount || {})[k] || 0); });
    r.ult = (r.ult || 0) + ((u.report && u.report.ults) || 0);
    r.sp = (r.sp || 0) + (u.sp || 0);
  }
  const t = sum[side];
  t.units = (t.units || 0) + 1;
  ['normal', 'skill1', 'skill2'].forEach(k => { t[k] = (t[k] || 0) + ((u.useCount || {})[k] || 0); });
  t.ult = (t.ult || 0) + ((u.report && u.report.ults) || 0);
  t.rounds = (t.rounds || 0) + 1;
};
let rounds = 0, battles = 0, waves = 0;
for(const sid of STAGES) for(let i = 0; i < N; i++){
  global.__spawned = [];
  const b = api.run(party, sid, LV, { star: 5, skillLv: 10, ultLv: 10, passiveLv: 10 });
  rounds += (b.waveResults || []).reduce((a, w) => a + (w.rounds || 0), 0); battles++;
  waves += (b.waveResults || []).length;
  b.party.forEach(u => add('ally', u));
  (global.__spawned || []).forEach(u => add('enemy', u));
  global.__spawned = [];
}
console.log(`${STAGES.join(', ')} / 各${N}回 / 味方Lv${LV}`);
console.log(`1戦あたり 合計${(rounds / battles).toFixed(1)}ラウンド(${(waves / battles).toFixed(1)}ウェーブ・1ウェーブ${(rounds / waves).toFixed(1)}ラウンド)`);
console.log('側    1体あたりの回数   通常    スキル1  スキル2   奥義   スキル2の割合');
for(const side of ['ally', 'enemy']){
  const t = sum[side];
  if(!t.units) { console.log(side + ' : データなし'); continue; }
  const per = k => (t[k] / t.units).toFixed(2);
  const skTotal = t.skill1 + t.skill2;
  console.log((side === 'ally' ? '味方' : '敵  ').padEnd(6) + ''.padEnd(14)
    + per('normal').padStart(6) + per('skill1').padStart(9) + per('skill2').padStart(9)
    + per('ult').padStart(7) + (skTotal ? (t.skill2 / skTotal * 100).toFixed(0) + '%' : '-').padStart(10));
}
console.log('');
console.log('味方のロール別        通常    スキル1  スキル2   奥義   終了時SP');
const ROLE = { tank:'タンク', attacker:'アタッカー', shooter:'シューター', support:'サポート', trickster:'トリックスター' };
Object.entries(byRole).forEach(([role, r]) => {
  const per = k => (r[k] / r.units).toFixed(2);
  console.log(((ROLE[role] || role) + '(' + r.name + ')').padEnd(22)
    + per('normal').padStart(6) + per('skill1').padStart(9) + per('skill2').padStart(9)
    + per('ult').padStart(7) + per('sp').padStart(10));
});
