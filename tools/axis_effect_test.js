/* 4軸ステージが「連れて行く編成で結果が変わる」ところまで効いているかを測る。
   軸を宣言しただけでは意味がない。物理アタッカー編成と魔法アタッカー編成を同じ
   ステージにぶつけて、クリアラウンド数がどれだけ入れ替わるかを見る。
   使い方: python3 tools/extract.py してから  cd tools && node axis_effect_test.js
           N=200 node axis_effect_test.js */
const load = require('./harness.js');
const api = load('game.js', src => src + ';global.__e={STAGE_BY_ID,MON_BY_ID};');
const E = global.__e;
const N = Number(process.env.N || 100);

/* 火力役だけ差し替え、壁と回復役は共通にして比べる */
const CORE = ['m52', 'm104'];                       // ユミル(タンク) + ユニコーン(回復)
const PHYS = ['m24', 'm44', 'm23'];                 // ワーウルフ / レッドキャップ / スカーボア(全員物理)
const MAG  = ['m17', 'm50', 'm63'];                 // ヘルハウンド / サイクロプス / ボルケイノタートル(全員魔法寄り)
const UP_BY_TIER = { q2:{star:3,skillLv:3,ultLv:3,passiveLv:3}, q3:{star:3,skillLv:4,ultLv:4,passiveLv:4} };
const UP_DEFAULT = { star: 5, skillLv: 5, ultLv: 5, passiveLv: 5 };
let UP = UP_DEFAULT;

/* 各ティアで指定した4軸のステージ。lv はそのティアの推奨Lvに合わせる。 */
const ROWS = [
  ['q2', 52, { mag:'q2_06', phy:'q2_04', pdef:null, mdef:'q2_07' }],
  ['q3', 88, { mag:'q3_02', phy:'q3_03', pdef:'q3_07', mdef:'q3_09' }],
  ['q7', 280, { mag:'q7_04', phy:'q7_03', pdef:'q7_09', mdef:'q7_07' }],
];

function measure(party, stage, lv){
  let win = 0, rounds = 0, won = 0;
  for(let i = 0; i < N; i++){
    const ui = api.run(party, stage, lv, UP);
    if(ui.win){ win++; rounds += ui.round || 0; won++; }
  }
  return { wr: win / N, r: won ? rounds / won : NaN };
}

console.log('物理編成 vs 魔法編成 — クリアに要したラウンド数(各' + N + '戦)');
console.log('「差」がプラスなら魔法編成のほうが手こずる = 物理耐性が効いている\n');
/* 魔法編成のほうが素の火力が高いので、そのぶんの下駄を「物理攻撃ステージ(防御が
   偏っていない場所)」で測り、各ステージの差からそれを引いて正味の効果を出す。 */
console.log('ティア ステージ           軸        物理編成       魔法編成      差    素の差を引いた正味');
ROWS.forEach(([tier, lv, ids]) => {
  UP = UP_BY_TIER[tier] || UP_DEFAULT;
  const diffOf = id => {
    const p = measure(CORE.concat(PHYS), id, lv);
    const m = measure(CORE.concat(MAG), id, lv);
    return { p, m, d: m.r - p.r };
  };
  const base = diffOf(ids.phy).d;   // この編成差の「素の下駄」
  [['phy', '物理攻撃(基準)'], ['pdef', '物理耐性'], ['mdef', '魔法耐性'], ['mag', '魔法攻撃']].forEach(([k, ja]) => {
    const id = ids[k];
    if(!id){ console.log(`${tier.padEnd(6)}${'—'.padEnd(20, ' ')}${ja.padEnd(14, ' ')}(材料不足で未作成)`); return; }
    const r = k === 'phy' ? null : diffOf(id);
    const d = k === 'phy' ? base : r.d;
    const p = k === 'phy' ? measure(CORE.concat(PHYS), id, lv) : r.p;
    const m = k === 'phy' ? measure(CORE.concat(MAG), id, lv) : r.m;
    const net = d - base;
    console.log(`${tier.padEnd(6)}${(id + ' ' + E.STAGE_BY_ID[id].name).padEnd(20, ' ')}${ja.padEnd(14, ' ')}`
      + `${p.r.toFixed(1).padStart(5)}R/${String(Math.round(p.wr*100)).padStart(3)}% `
      + `${m.r.toFixed(1).padStart(5)}R/${String(Math.round(m.wr*100)).padStart(3)}% `
      + `${((d >= 0 ? '+' : '') + d.toFixed(2)).padStart(6)}  `
      + (k === 'phy' ? '  —' : ((net >= 0 ? '+' : '') + net.toFixed(2)).padStart(6)));
  });
  console.log('');
});
