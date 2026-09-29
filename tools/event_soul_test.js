/* イベントの主役★5のソウル(α0.3.002): 通常ステージはボスからステージ番号×2%で1個・仲間入りなし、EXは20/50/100%で1個(上限なし)。
   1体目はガチャだけ(ソウルをためても仲間にならず、ガチャで仲間にしたとき引き継ぐ)。EXはステージ3で開く。
   あわせて、延焼で倒した敵にやけどを付け直しても止まらないこと */
const load = require('./harness.js');
const api = load('game.js', s => s + ';global.__e={EVENTS,grantStageRewards,grantMonster,giveSouls,MON_BY_ID,recruitChanceOf,EX_UNLOCK_TIER,eventBossSoulRate,EX_PICKUP_SOUL_RATE,applyStatus,get battleUI(){return battleUI}};');
const E = global.__e;
let bad = 0;
const ok = (n, c, i) => { if(!c) bad++; console.log((c ? '✅' : '❌') + ' ' + n + (i !== undefined ? '  ' + JSON.stringify(i) : '')); };
const rnd = Math.random; let seq = 0; Math.random = () => ((seq = (seq * 9301 + 49297) % 233280) / 233280);

api.STATE = api.DEFAULT_STATE();
const ev = E.EVENTS.find(e => e.key === 'ev_fenrir');
const pick = ev.pickup, st10 = ev.stages[9];
ok('EXはステージ3クリアで開く', E.EX_UNLOCK_TIER === 3 && ev.exStages.every(s => s.requires === 'ev_fenrir_3'), ev.exStages.map(s => s.requires));
ok('通常ステージで主役が仲間になる確率は0', E.recruitChanceOf(E.MON_BY_ID[pick], false, st10) === 0);
const N = 4000;
for(let i = 0; i < N; i++) E.grantStageRewards(st10, [{ ref: pick, boss: true, rarity: 5 }]);
const got = api.STATE.pendingSouls[pick] || 0;
ok('ステージ10: ボスから約20%で1個', E.eventBossSoulRate(st10) === 0.2 && Math.abs(got / N - 0.2) < 0.02, got / N);
ok('難しいほど上がる(2%→20%)', ev.stages.map(E.eventBossSoulRate).join() === [2,4,6,8,10,12,14,16,18,20].map(x => x / 100).join(), ev.stages.map(E.eventBossSoulRate));
ok('EXは別枠(番号なし)', ev.exStages.every(s => E.eventBossSoulRate(s) === 0));
api.STATE.pendingSouls[pick] = 999; E.giveSouls(pick, 1);
ok('ソウルが400個をこえても仲間にならない(1体目はガチャ)', !api.STATE.owned[pick] && api.STATE.pendingSouls[pick] === 1000, api.STATE.pendingSouls[pick]);
[0, 1, 2].forEach(i => {
  api.STATE.pendingSouls[pick] = 0;
  for(let k = 0; k < 2000; k++) E.grantStageRewards(ev.exStages[i], []);
  const r = api.STATE.pendingSouls[pick] / 2000;
  ok(`EX${i + 1}: ${E.EX_PICKUP_SOUL_RATE[i] * 100}%で1個`, Math.abs(r - E.EX_PICKUP_SOUL_RATE[i]) < 0.03, r);
});
api.STATE.pendingSouls[pick] = 321;
E.grantMonster(E.MON_BY_ID[pick]);
ok('ガチャで仲間にすると、ためたソウルを引き継ぐ', api.STATE.owned[pick] && api.STATE.owned[pick].souls === 321, api.STATE.owned[pick] && api.STATE.owned[pick].souls);
ok('ほかのモンスターは今までどおりソウルで仲間になる', E.giveSouls('m95', 20).joined === true);

// 延焼で倒れた敵にやけどを付け直しても止まらない
api.STATE = api.DEFAULT_STATE();
api.run(['m06', 'm21', 'm03'], 'q1_01', 30, {});
const b = E.battleUI, foe = b.enemies[0], ally = b.party.find(Boolean);
foe.alive = true; foe.hp = 1; foe.statuses = { burn: { turns: 2, dmg: 50, source: ally } };
b.round = 99;
let err = null;
try{ E.applyStatus(foe, 'burn', ally, 3); }catch(e){ err = String(e); }
ok('延焼で倒した敵にやけどを付け直しても止まらない', !err, err);
Math.random = rnd;
console.log(bad ? `${bad}件 失敗` : 'すべて通過');
process.exitCode = bad ? 1 : 0;
