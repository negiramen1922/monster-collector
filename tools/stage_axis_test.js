/* 各ティアに置いた「4軸ステージ」が狙いの性質を保っているかの回帰テスト。

   軸:
     魔法攻撃 … 敵の攻撃がほぼ魔法。プレイヤーは魔法防御を積む意味が出る。
     物理攻撃 … 敵の攻撃がほぼ物理。物理防御を積む意味が出る。
     物理耐性 … 敵の物理防御が魔法防御よりはっきり高い。魔法アタッカーを連れて行く。
     魔法耐性 … その逆。物理アタッカーを連れて行く。

   ダメージは raw - def の引き算なので、耐性は比ではなく実数の差で見ている。
   q1・q2 に防御軸がないのは、★1〜★2のタンクでは差が作れず、実測でも
   編成による差が出なかったため(axis_effect_test.js 参照)。
   q1〜q3 に魔法耐性がないのは、魔防が物防より高い敵が★4のノームしかいないため。

   使い方: python3 tools/extract.py してから  cd tools && node stage_axis_test.js */
const load = require('./harness.js');
const api = load('game.js', src => src + ';global.__e={STAGE_BY_ID,MON_BY_ID,kitOf};');
const E = global.__e;
const ok = (name, cond, info) => {
  console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
  if(!cond) process.exitCode = 1;
};

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
/* 防御は最終ウェーブで見る。そこが一番長く殴り合う場所なので。 */
function defGap(id){
  const last = E.STAGE_BY_ID[id].waves.slice(-1)[0].map(e => E.MON_BY_ID[e.ref]);
  return (last.reduce((a, m) => a + m.pdef, 0) - last.reduce((a, m) => a + m.mdef, 0)) / last.length;
}

/* [ティア, 魔法攻撃, 物理攻撃, 物理耐性, 魔法耐性] — null は材料不足で未設置 */
const PLAN = [
  ['q1', 'q1_09', 'q1_01', null,    null],
  ['q2', 'q2_06', 'q2_04', null,    null],
  ['q3', 'q3_02', 'q3_03', 'q3_07', null],
  ['q4', 'q4_01', 'q4_04', 'q4_03', 'q4_09'],
  ['q5', 'q5_08', 'q5_01', 'q5_07', 'q5_09'],
  ['q6', 'q6_08', 'q6_02', 'q6_04', 'q6_03'],
  ['q7', 'q7_04', 'q7_03', 'q7_07', 'q7_09'],
];
/* q1は★1しかいないので魔法100%の敵を並べきれない。他は85%以上を要求する。 */
const MAG_MIN = { q1: 0.70 };

PLAN.forEach(([tier, mag, phy, pdef, mdef]) => {
  console.log('\n--- ' + tier + ' ---');
  const min = MAG_MIN[tier] || 0.85;
  ok(`${mag} は魔法攻撃ステージ(${Math.round(min * 100)}%以上)`, magShare(mag) >= min,
    Math.round(magShare(mag) * 100) + '%');
  ok(`${phy} は物理攻撃ステージ(魔法10%以下)`, magShare(phy) <= 0.10,
    Math.round(magShare(phy) * 100) + '%');
  if(pdef) ok(`${pdef} は物理耐性ステージ(物防-魔防 が+4以上)`, defGap(pdef) >= 4, defGap(pdef).toFixed(1));
  else console.log('   物理耐性: なし(★1〜★2のタンクでは差が作れないため)');
  if(mdef) ok(`${mdef} は魔法耐性ステージ(物防-魔防 が-3以下)`, defGap(mdef) <= -3, defGap(mdef).toFixed(1));
  else console.log('   魔法耐性: なし(魔防が物防より高い敵が★4のノームしかいないため)');
});

console.log('\n--- 軸どうしが被っていないこと ---');
PLAN.forEach(([tier, ...ids]) => {
  const used = ids.filter(Boolean);
  ok(`${tier} の各軸は別のステージ`, new Set(used).size === used.length, used);
});
/* ハードモードは通常編成から派生するので、同じ性質が伝わっているはず */
console.log('\n--- ハードモードにも同じ性質が伝わっているか ---');
PLAN.forEach(([tier, mag]) => {
  const h = mag.replace(/^(q\d)_/, '$1_') + 'h';
  ok(`${h} も魔法攻撃ステージ`, magShare(h) >= (MAG_MIN[tier] || 0.85),
    Math.round(magShare(h) * 100) + '%');
});
console.log('\ndone');
