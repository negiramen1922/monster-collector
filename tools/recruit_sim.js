/* クリアでモンスターが仲間になるまでの周回数を測る。
   使い方: node recruit_sim.js [ステージID…]  (省略時は代表ステージ) */
const load = require('./harness.js');
const api = load('game.js', src => src + ';global.__e={grantStageRewards,STAGE_BY_ID,MON_BY_ID,RECRUIT_CHANCE,DUP_SOULS,UNLOCK_SOULS,RARE_SPAWN_PER_WAVE,DEFAULT_STATE};');
const E = global.__e;
const TRIALS = Number(process.env.N || 400);

// そのステージの1回のクリアで「出てきた敵」を作る(レアはウェーブごとの確率で差し替え)
function spawnedOf(stage){
  const out = [];
  stage.waves.forEach(w => {
    const entries = w.map(e => ({ ...e }));
    if(stage.rares && stage.rares.length && Math.random() < E.RARE_SPAWN_PER_WAVE){
      const i = Math.floor(Math.random() * entries.length);
      entries[i] = { ref: stage.rares[Math.floor(Math.random() * stage.rares.length)], rare: true };
    }
    entries.forEach(e => {
      const m = E.MON_BY_ID[e.ref];
      out.push({ ref: e.ref, rarity: m.rarity, boss: !!e.boss, rare: !!e.rare });
    });
  });
  return out;
}

function run(stageId){
  const stage = E.STAGE_BY_ID[stageId];
  const kinds = [...new Set(stage.waves.flat().map(e => e.ref))];
  const rares = stage.rares || [];
  const watch = [...kinds, ...rares];
  const runsTo = Object.fromEntries(watch.map(id => [id, []]));
  for(let t = 0; t < TRIALS; t++){
    api.STATE = E.DEFAULT_STATE();
    api.STATE.owned = {};
    api.STATE.pendingSouls = {};
    api.STATE.clearedStages = [stageId];
    const left = new Set(watch);
    for(let n = 1; n <= 4000 && left.size; n++){
      const r = E.grantStageRewards(stage, spawnedOf(stage));
      r.souls.filter(x => x.joined).forEach(x => {
        if(left.has(x.id)){ runsTo[x.id].push(n); left.delete(x.id); }
      });
    }
  }
  const runsPerDay = 288 / stage.stamina;
  console.log(`\n■ ${stage.name} (${stageId}) ⚡${stage.stamina} ・1日あたり約${runsPerDay.toFixed(0)}周`);
  watch.forEach(id => {
    const m = E.MON_BY_ID[id];
    const arr = runsTo[id].slice().sort((a, b) => a - b);
    if(!arr.length){ console.log(`   ${m.name} ★${m.rarity}: ${TRIALS}回の試行で仲間にならず`); return; }
    const med = arr[Math.floor(arr.length / 2)];
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    const p90 = arr[Math.floor(arr.length * 0.9)];
    console.log(`   ${m.name} ★${m.rarity}${rares.includes(id) ? '(レア)' : ''}: 平均 ${avg.toFixed(0)}周 / 中央値 ${med}周 / 遅い方10% ${p90}周` +
                `  → 平均 ${(avg / runsPerDay).toFixed(1)}日`);
  });
}

const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['q1_01', 'q1_05', 'q2_01', 'q3_10'];
ids.forEach(run);
