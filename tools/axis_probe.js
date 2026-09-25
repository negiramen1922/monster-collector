/* 4軸ステージが狙いどおりかを、戦闘を回さずに直接測る。

   前に編成ごと戦わせて測ったが、属性相性(火のアタッカーが水のゴーレムに弱い等)が
   防御の差より大きく出てしまい、数字が読めなかった。ここでは同じ攻撃者・同じ威力・
   同じ属性のまま atk を phys と mag で切り替え、敵1体ごとの実ダメージを比べる。
   防御は raw - def の引き算なので、これで pdef/mdef の差だけを取り出せる。

   使い方: python3 tools/extract.py してから  cd tools && node axis_probe.js */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e={
  STAGES, STAGE_BY_ID, MON_BY_ID, buildUnit, effDef, cutOf, kitOf,
  DAMAGE_MIN_RATIO, DAMAGE_SCALE,
};`);
const E = global.__e;

/* 敵1体に、威力200%・無属性・会心なしで殴ったときの実ダメージ。
   raw を固定して atk だけ変えるので、差はそのまま pdef と mdef の差になる。 */
function dmg(unit, atk, raw){
  const def = E.effDef(unit, atk);
  const pre = Math.max(raw * E.DAMAGE_MIN_RATIO, raw - def);
  return pre * (1 - E.cutOf(unit, atk, pre));
}
/* そのステージの最終ウェーブに、推奨Lvで並ぶ敵を作る */
function foes(id){
  const s = E.STAGE_BY_ID[id];
  const sk = s.enemySkill || 1;
  return s.waves[s.waves.length - 1].map(e => {
    const u = E.buildUnit(E.MON_BY_ID[e.ref], e.level, true, e.star || null, e.boss, 1,
      { skillLv: sk, skill2Lv: sk, ultLv: sk, passiveLv: sk });
    ['hp', 'maxHp', 'str', 'pdef', 'mdef'].forEach(k => { u[k] = Math.round(u[k] * (s.power || 1)); });
    return u;
  });
}
/* 攻撃側の raw は、そのステージの敵の平均HPの40%に置く(一撃で溶けも詰まりもしない帯) */
function probe(id){
  const us = foes(id);
  const raw = us.reduce((a, u) => a + u.maxHp, 0) / us.length * 0.4;
  const p = us.reduce((a, u) => a + dmg(u, 'phys', raw), 0) / us.length;
  const m = us.reduce((a, u) => a + dmg(u, 'mag', raw), 0) / us.length;
  return { p, m, adv: (m - p) / p };   // adv が正なら魔法のほうが通る = 物理耐性ステージ
}
function magShare(id){
  const refs = E.STAGE_BY_ID[id].waves.flat().map(e => e.ref);
  let mag = 0, tot = 0;
  refs.forEach(r => {
    const k = E.kitOf(E.MON_BY_ID[r]);
    ['normal', 'skill1', 'skill2', 'ult'].forEach(n => {
      const o = k[n]; if(!o || !o.pow) return;
      const w = o.pow * (o.hits || 1);
      tot += w; if(o.atk === 'mag') mag += w;
    });
  });
  return tot ? mag / tot : 0;
}

const PLAN = [
  ['q1', { mag:'q1_09', phy:'q1_01' }],
  ['q2', { mag:'q2_06', phy:'q2_04', mdef:'q2_07' }],
  ['q3', { mag:'q3_02', phy:'q3_03', pdef:'q3_07', mdef:'q3_09' }],
  ['q4', { mag:'q4_01', phy:'q4_04', pdef:'q4_03', mdef:'q4_09' }],
  ['q5', { mag:'q5_08', phy:'q5_01', pdef:'q5_07', mdef:'q5_09' }],
  ['q6', { mag:'q6_08', phy:'q6_02', pdef:'q6_04', mdef:'q6_03' }],
  ['q7', { mag:'q7_04', phy:'q7_03', pdef:'q7_09', mdef:'q7_07' }],
];
const JA = { mag:'魔法攻撃', phy:'物理攻撃', pdef:'物理耐性', mdef:'魔法耐性' };

/* ロスター全体が魔防より物防の高いキャラに寄っているため、防御を偏らせていない
   ステージでも魔法のほうが数%多く通る。その下駄はティアごとに違うので、
   そのティアの「防御軸を指定していないステージ全部の平均」を基準にして引く。
   1ステージだけを基準にすると、そこにたまたまゴーレムが入っているかどうかで
   基準が動いてしまう。 */
function tierBase(tier, ids){
  /* 4軸に指定したステージは全部除く。指定ステージ自身を基準に混ぜると、
     偏らせた分だけ基準も動いてしまう(とくに暴風の砦のように敵の魔防が
     絶対値で低いステージは、軸と関係なく大きく振れる)。 */
  const skip = new Set([ids.mag, ids.phy, ids.pdef, ids.mdef].filter(Boolean));
  const list = E.STAGES.filter(s => s.tier === tier && !skip.has(s.id));
  return list.reduce((a, s) => a + probe(s.id).adv, 0) / list.length * 100;
}
console.log('同じ攻撃者・同じ威力で、物理と魔法のどちらがよく通るか(最終ウェーブ平均)');
console.log('正は魔法がよく通る(=物理耐性)、負は物理がよく通る(=魔法耐性)\n');
console.log('ティア ステージ              軸        敵の攻撃   素の値   正味(指定外ステージの平均を引いた値)');
PLAN.forEach(([tier, ids]) => console.log(`  ${tier} の基準(指定外ステージの平均): ${tierBase(tier, ids).toFixed(1)}%`));
console.log('');
PLAN.forEach(([tier, ids]) => {
  const base = tierBase(tier, ids);
  ['mag', 'phy', 'pdef', 'mdef'].forEach(k => {
    const id = ids[k];
    if(!id){ console.log(`${tier.padEnd(6)}${'—'.padEnd(21, ' ')}${JA[k]}    (未設置)`); return; }
    const pct = probe(id).adv * 100;
    const net = pct - base;
    let mark = '';
    if(k === 'pdef'){ const good = net >= 5; mark = good ? '  ✅ 魔法アタッカー有利' : '  ❌ 効いていない'; if(!good) process.exitCode = 1; }
    if(k === 'mdef'){ const good = net <= -5; mark = good ? '  ✅ 物理アタッカー有利' : '  ❌ 効いていない'; if(!good) process.exitCode = 1; }
    console.log(`${tier.padEnd(6)}${(id + ' ' + E.STAGE_BY_ID[id].name).padEnd(21, ' ')}${JA[k]}`
      + `  魔法${String(Math.round(magShare(id) * 100)).padStart(3)}%`
      + `  ${((pct >= 0 ? '+' : '') + pct.toFixed(1) + '%').padStart(7)}`
      + `  ${((net >= 0 ? '+' : '') + net.toFixed(1) + '%').padStart(7)}`
      + mark);
  });
  console.log('');
});
