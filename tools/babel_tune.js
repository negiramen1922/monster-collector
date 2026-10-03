// バベル: 階ごとの「塔の敵の底上げ」(最大HP+x・STR+0.6x)を探す。
// 勝てる想定が80%以上、勝てない想定(1段上の育ち)が20%以下になる x の幅を二分探索で出し、真ん中を勧める。
// 使い方: N=10 node babel_tune.js ten [階...]
const load = require('./harness.js');
const api = load('game.js', s => s + ';global.__b={get lab(){return lab},labLoad,labHint,labStart,labIsTwo,BABEL_FLOORS,get battleUI(){return battleUI},DEFAULT_STATE,MONSTERS,BABEL_LV};');
const B = global.__b;
const N = +(process.env.N || 10);
const [tower, ...fls] = process.argv.slice(2);
api.STATE = B.DEFAULT_STATE(); api.STATE.autoUlt = true;
B.MONSTERS.forEach(m => { api.STATE.owned[m.id] = { star: m.rarity, souls: 0, level: B.BABEL_LV, skillLv: 1, ultLv: 1, passiveLv: 1 }; });
B.labLoad();
const STR = +(process.env.STR || 0.6);
function rate(f, kind, x, n){
  const fl = B.BABEL_FLOORS[tower][f - 1];
  fl.boost = { hp: x, str: x * STR };
  B.lab.tower = tower; B.lab.floor = f; B.labHint(kind);
  let w = 0;
  for(let k = 0; k < n; k++){
    let ok = true;
    for(const h of (B.labIsTwo() ? [0, 1] : [0])){ api.resetQueue(); B.labStart(h, true); api.drainQueue(); if(!B.battleUI.win){ ok = false; break; } }
    if(ok) w++;
  }
  return w / n;
}
const LO = -0.6, HI = 12;
const floors = fls.length ? fls.map(Number) : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const out = {};
for(const f of floors){
  // 勝てない想定が20%以下になる最小の x
  let a = LO, b = HI;
  if(rate(f, 'lose', HI, N) > 0.2){ out[f] = { ng: 'lose_never', loseAtHi: rate(f, 'lose', HI, N) }; console.error(tower, f, JSON.stringify(out[f])); continue; }
  if(rate(f, 'lose', LO, N) <= 0.2) b = LO;
  else for(let i = 0; i < 7; i++){ const m = (a + b) / 2; if(rate(f, 'lose', m, N) <= 0.2) b = m; else a = m; }
  const xL = b;
  // 勝てる想定が80%以上でいられる最大の x
  a = LO; b = HI;
  if(rate(f, 'win', LO, N) < 0.8){ out[f] = { ng: 'win_never', xL, winAtLo: rate(f, 'win', LO, N) }; console.error(tower, f, JSON.stringify(out[f])); continue; }
  if(rate(f, 'win', HI, N) >= 0.8) a = HI;
  else for(let i = 0; i < 7; i++){ const m = (a + b) / 2; if(rate(f, 'win', m, N) >= 0.8) a = m; else b = m; }
  const xW = a;
  if(xW < xL){ out[f] = { ng: 'gap', xL: +xL.toFixed(2), xW: +xW.toFixed(2) }; console.error(tower, f, JSON.stringify(out[f])); continue; }
  const x = +((xL + xW) / 2).toFixed(1);
  const v = { x, xL: +xL.toFixed(2), xW: +xW.toFixed(2), win: rate(f, 'win', x, 20), lose: rate(f, 'lose', x, 20) };
  out[f] = v; console.error(tower, f, JSON.stringify(v));
}
console.log(JSON.stringify({ tower, out }));
