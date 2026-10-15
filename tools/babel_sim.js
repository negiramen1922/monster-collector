// バベルの各階で「勝てる想定」「勝てない想定」の勝率を出す(試験場の連続テストと同じ戦闘)
// 使い方: N=25 node babel_sim.js [bal|order|chaos ...] [階の範囲 例: 11-20 / 5,10,15]
const load = require('./harness.js');
const api = load('game.js', s => s + ';global.__b={get lab(){return lab},set lab(v){lab=v},labLoad,labHint,labStart,labIsTwo,labMvp,BABEL_FLOORS,BABEL_GROW,get battleUI(){return battleUI},DEFAULT_STATE,MONSTERS,BABEL_LV};');
const B = global.__b;
const N = +(process.env.N || 20);
const args = process.argv.slice(2);
const range = args.find(a => /^[\d,-]+$/.test(a));
const towers = args.filter(a => a !== range).length ? args.filter(a => a !== range) : ['bal', 'order', 'chaos'];
function floorsOf(t){
  const n = B.BABEL_FLOORS[t].length;
  if(!range) return [...Array(n).keys()].map(i => i + 1);
  return range.split(',').flatMap(r => { const [a, b] = r.split('-').map(Number); return [...Array((b || a) - a + 1).keys()].map(i => a + i); }).filter(f => f >= 1 && f <= n);
}
api.STATE = B.DEFAULT_STATE(); api.STATE.autoUlt = true;
B.MONSTERS.forEach(m => { api.STATE.owned[m.id] = { star: m.rarity, souls: 0, level: B.BABEL_LV, skillLv: 1, ultLv: 1, passiveLv: 1 }; });
B.labLoad();
function one(half){ api.resetQueue(); B.labStart(half, true); api.drainQueue(); const b = B.battleUI; return { win: !!b.win, wave: b.waveIndex + 1, round: b.round }; }
const out = {};
for(const t of towers){
  out[t] = [];
  for(const f of floorsOf(t)){
    const row = { floor: f, name: B.BABEL_FLOORS[t][f - 1].name };
    for(const kind of ['win', 'lose']){
      B.lab.tower = t; B.lab.floor = f; B.labHint(kind);
      let w = 0; const lost = {};
      for(let k = 0; k < N; k++){
        let ok = true;
        for(const h of (B.labIsTwo() ? [0, 1] : [0])){ const r = one(h); if(!r.win){ ok = false; const key = `${B.labIsTwo() ? (h ? '後' : '前') : ''}W${r.wave}`; lost[key] = (lost[key] || 0) + 1; break; } }
        if(ok) w++;
      }
      row[kind] = Math.round(w / N * 100);
      row[kind + 'Lost'] = lost;
    }
    out[t].push(row);
    console.error(t, f, row.name, '勝てる想定', row.win + '%', '勝てない想定', row.lose + '%', JSON.stringify(row.winLost), JSON.stringify(row.loseLost));
  }
}
console.log(JSON.stringify(out));
