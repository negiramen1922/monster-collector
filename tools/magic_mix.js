/* 敵の攻撃が物理か魔法かの内訳を、ステージ単位とモンスター単位で出す。
   魔法防御の遺物が効くかどうかはこの比率で決まる。
   使い方: python3 tools/extract.py してから  cd tools && node magic_mix.js [モンスターID...] */
const load = require('./harness.js');
const api = load('game.js', src => src + ';global.__e={STAGES,MONSTERS,MON_BY_ID,MONSTER_KITS,kitOf,speciesOf,ELEM_LABEL,ROLE_LABEL};');
const E = global.__e;

/* 1体あたりの「魔法寄り度」。通常攻撃・スキル1・2・必殺技を、威力×ヒット数で重みづけして
   魔法側の割合を出す。実戦の使用頻度までは見ないが、どちらの防御が効くかの目安になる。 */
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
const shareById = {};
E.MONSTERS.forEach(m => { shareById[m.id] = magShare(m); });

if(process.argv.length > 2){
  process.argv.slice(2).forEach(id => {
    const m = E.MON_BY_ID[id];
    if(!m){ console.log(id + ': いない'); return; }
    const k = E.kitOf(m);
    console.log(`${id} ${m.name} ★${m.rarity} ${E.ELEM_LABEL[m.element]}/${E.ROLE_LABEL[m.role]} 魔法${Math.round(shareById[id]*100)}%`);
    ['normal', 'skill1', 'skill2', 'ult'].forEach(n => {
      const o = k[n]; if(!o) return;
      console.log('   ' + n.padEnd(7) + (o.atk || '-').padEnd(5) + 'pow' + String(Math.round((o.pow||0)*100)).padStart(4) + '%'
        + (o.hits > 1 ? '×' + o.hits : '   ') + '  ' + (o.name || ''));
    });
  });
  process.exit(0);
}

/* ステージごと: そのステージに出る敵(全ウェーブ)の魔法寄り度を平均する */
const rows = E.STAGES.filter(s => s.waves).map(s => {
  const refs = s.waves.flat().map(e => e.ref);
  const mag = refs.reduce((a, r) => a + (shareById[r] || 0), 0) / refs.length;
  return { id: s.id, tier: s.tier || s.type, name: s.name, mag };
});
const byTier = {};
rows.forEach(r => { (byTier[r.tier] = byTier[r.tier] || []).push(r); });
console.log('=== ティアごとの魔法比率(敵の攻撃のうち魔法が占める割合) ===');
Object.keys(byTier).filter(t => !/h$/.test(t)).forEach(t => {
  const g = byTier[t];
  const avg = g.reduce((a, r) => a + r.mag, 0) / g.length;
  const hi = g.slice().sort((a, b) => b.mag - a.mag)[0];
  console.log(`${t.padEnd(6)} 平均 魔法${String(Math.round(avg*100)).padStart(3)}% / 物理${String(100-Math.round(avg*100)).padStart(3)}%   いちばん魔法寄り: ${hi.id} ${hi.name} ${Math.round(hi.mag*100)}%`);
});
console.log('\n=== q5・q6の各ステージ ===');
['q5', 'q6'].forEach(t => {
  byTier[t].forEach(r => console.log(`${r.id}  魔法${String(Math.round(r.mag*100)).padStart(3)}%  ${r.name}`));
});
console.log('\n=== 魔法寄りの既存モンスター(魔法60%以上・★3以上) ===');
E.MONSTERS.filter(m => shareById[m.id] >= 0.6 && m.rarity >= 3)
  .sort((a, b) => b.rarity - a.rarity || shareById[b.id] - shareById[a.id])
  .forEach(m => console.log(`  ${m.id} ★${m.rarity} ${m.name.padEnd(12, '　')} ${E.ELEM_LABEL[m.element]}/${E.ROLE_LABEL[m.role]}  魔法${Math.round(shareById[m.id]*100)}%`));
