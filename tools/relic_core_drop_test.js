// 霊素の鉱脈の霊素核は確率で出る(メインクエストの素材と同じ rollDropCount)。平均が表どおりで、必ず出るわけではない
const load = require('./harness.js');
const api = load('game.js', s => s + ';global.__t={grantDungeonRewards,dungeonStage,DUNGEONS,getItem};');
const T = global.__t;
let bad = 0; const ok = (n, c, i) => { if(!c) bad++; console.log((c ? '✅' : '❌') + ' ' + n + (i !== undefined ? '  ' + JSON.stringify(i) : '')); };
api.STATE = api.DEFAULT_STATE();
const N = 4000, st = T.dungeonStage('relic', 4);
let zero = 0, prev1 = 0;
for(let k = 0; k < N; k++){ T.grantDungeonRewards(st); const now = T.getItem('relic_core_1'); if(now === prev1) zero++; prev1 = now; }
const a1 = T.getItem('relic_core_1') / N, a2 = T.getItem('relic_core_2') / N, sc = T.getItem('relic_scrap') / N;
ok('5段: 霊素核Iは平均0.6個(以前は必ず4個)', Math.abs(a1 - 0.6) < 0.05, a1.toFixed(3));
ok('5段: 霊素核IIは平均0.3個(以前は必ず2個)', Math.abs(a2 - 0.3) < 0.04, a2.toFixed(3));
ok('出ない回がある(確率)', zero > N * 0.3, zero);
ok('霊素鉱は今までどおり600個', sc === 600, sc);
const tbl = T.DUNGEONS.relic.rewards.map(r => r.chance || {});
ok('段ごとの確率', JSON.stringify(tbl) === JSON.stringify([{}, { relic_core_1: 0.2 }, { relic_core_1: 0.35 }, { relic_core_1: 0.5, relic_core_2: 0.15 }, { relic_core_1: 0.6, relic_core_2: 0.3 }]), tbl);
console.log(bad ? `${bad}件 失敗` : 'すべて通過');
