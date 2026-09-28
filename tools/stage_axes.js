/* 全ステージを4軸で並べる: 敵の攻撃が魔法か物理か / 敵の防御が物理寄りか魔法寄りか。
   ダメージは raw - def の引き算なので、防御は「実数の差」で見る(比では意味が出ない)。
   使い方: python3 tools/extract.py してから  cd tools && node stage_axes.js [ティア...] */
const load = require('./harness.js');
const api = load('game.js', src => src + ';global.__e={STAGES,MON_BY_ID,kitOf};');
const E = global.__e;

function magShareOf(mon){
  const k = E.kitOf(mon);
  let mag = 0, tot = 0;
  ['normal', 'skill1', 'skill2', 'ult'].forEach(n => {
    const o = k[n]; if(!o || !o.pow) return;
    const w = o.pow * (o.hits || 1);
    tot += w;
    if(o.atk === 'mag') mag += w;
  });
  return tot ? mag / tot : 0;
}
const magBy = {};
E.STAGES.forEach(s => (s.waves || []).flat().forEach(e => {
  if(magBy[e.ref] == null) magBy[e.ref] = magShareOf(E.MON_BY_ID[e.ref]);
}));

const rows = E.STAGES.filter(s => s.waves).map(s => {
  const refs = s.waves.flat().map(e => e.ref);
  const mag = refs.reduce((a, r) => a + magBy[r], 0) / refs.length;
  /* 防御は最終ウェーブで見る。そこが一番長く殴り合う場所なので。 */
  const last = s.waves[s.waves.length - 1].map(e => E.MON_BY_ID[e.ref]);
  const p = last.reduce((a, m) => a + m.pdef, 0) / last.length;
  const md = last.reduce((a, m) => a + m.mdef, 0) / last.length;
  return { id: s.id, tier: s.tier || s.type, name: s.name, boss: !!s.boss, mag, p, md, gap: p - md };
});

const want = process.argv.slice(2);
const tiers = want.length ? want : ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7'];
tiers.forEach(t => {
  const g = rows.filter(r => r.tier === t);
  if(!g.length) return;
  console.log('\n===== ' + t + ' =====');
  g.forEach(r => console.log(
    `${r.id.padEnd(7)}${r.boss ? 'B' : ' '} 魔法攻撃${String(Math.round(r.mag * 100)).padStart(3)}%` +
    `   敵の防御 物${r.p.toFixed(1).padStart(5)} 魔${r.md.toFixed(1).padStart(5)}  差${(r.gap >= 0 ? '+' : '') + r.gap.toFixed(1)}` +
    `  ${r.name}`));
  const nb = g.filter(r => !r.boss);
  const magTop = nb.slice().sort((a, b) => b.mag - a.mag)[0];
  const phyTop = nb.slice().sort((a, b) => a.mag - b.mag)[0];
  const pdefTop = nb.slice().sort((a, b) => b.gap - a.gap)[0];
  const mdefTop = nb.slice().sort((a, b) => a.gap - b.gap)[0];
  console.log(`  → 魔法攻撃に近い: ${magTop.id}(${Math.round(magTop.mag*100)}%) / 物理攻撃に近い: ${phyTop.id}(${Math.round(phyTop.mag*100)}%)`);
  console.log(`  → 物理耐性に近い: ${pdefTop.id}(差${pdefTop.gap.toFixed(1)}) / 魔法耐性に近い: ${mdefTop.id}(差${mdefTop.gap.toFixed(1)})`);
});
