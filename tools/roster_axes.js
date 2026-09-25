/* 「魔法攻撃/物理攻撃」「物理耐性/魔法耐性」の4軸で、全モンスターを並べる。
   ステージ編成の材料を探すための一覧。
   耐性は同レアリティの平均と比べた比で見る(レアリティが上がれば素の値も上がるため)。
   使い方: python3 tools/extract.py してから  cd tools && node roster_axes.js [--json] */
const load = require('./harness.js');
const api = load('game.js', src => src + ';global.__e={MONSTERS,MON_BY_ID,kitOf,ELEM_LABEL,ROLE_LABEL};');
const E = global.__e;

function magShare(mon){
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
/* 同★の平均を1.0としたときの防御の高さ */
const avgBy = {};
[1, 2, 3, 4, 5].forEach(r => {
  const g = E.MONSTERS.filter(m => m.rarity === r);
  avgBy[r] = { p: g.reduce((a, m) => a + m.pdef, 0) / g.length,
               m: g.reduce((a, m) => a + m.mdef, 0) / g.length };
});
const rows = E.MONSTERS.map(m => ({
  id: m.id, n: m.name, star: m.rarity, el: E.ELEM_LABEL[m.element], role: E.ROLE_LABEL[m.role],
  mag: magShare(m), pdef: m.pdef, mdef: m.mdef,
  pr: m.pdef / avgBy[m.rarity].p, mr: m.mdef / avgBy[m.rarity].m,
}));
if(process.argv.includes('--json')){ console.log(JSON.stringify(rows)); process.exit(0); }

const line = r => `  ${r.id.padEnd(5)}★${r.star} ${r.n.padEnd(11, '　')} ${r.el}/${r.role.padEnd(6, '　')}`
  + ` 魔法${String(Math.round(r.mag * 100)).padStart(3)}%  物防${String(r.pdef).padStart(3)}(${r.pr.toFixed(2)})  魔防${String(r.mdef).padStart(3)}(${r.mr.toFixed(2)})`;

[1, 2, 3, 4, 5].forEach(star => {
  const g = rows.filter(r => r.star === star);
  console.log(`\n================ ★${star} (${g.length}体) ================`);
  console.log('-- 魔法攻撃が多い(魔法70%以上) --');
  g.filter(r => r.mag >= 0.7).sort((a, b) => b.mag - a.mag).forEach(r => console.log(line(r)));
  console.log('-- 物理攻撃だけ(魔法10%未満) --');
  const ph = g.filter(r => r.mag < 0.1).sort((a, b) => a.mag - b.mag);
  console.log('  ' + ph.length + '体: ' + ph.map(r => r.n).join(' / '));
  console.log('-- 物理耐性が高い(同★平均の1.3倍以上) --');
  g.filter(r => r.pr >= 1.3).sort((a, b) => b.pr - a.pr).forEach(r => console.log(line(r)));
  console.log('-- 魔法耐性が高い(同★平均の1.3倍以上) --');
  g.filter(r => r.mr >= 1.3).sort((a, b) => b.mr - a.mr).forEach(r => console.log(line(r)));
});
