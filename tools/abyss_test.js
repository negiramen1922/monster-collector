/* 深淵回廊(無限ダンジョン)の回帰テスト */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e = { DEFAULT_STATE, ensureAbyss, abyssStage, abyssSeasonIndex, abyssTheme, abyssFloorReward,
  abyssOnFinish, applyAbyssSnapshot, startBattle, finishBattle, get battleUI(){ return battleUI; }, formationForFrontCount, lineupFromList,
  isMeleeRole, MON_BY_ID, STAGES, useIdleItem, useStaminaItem, baseState, getItem, addItem, renderAbyssTab, stageStaminaCost, findStage,
  ACHIEVEMENTS, WEEKLY_MISSIONS, ABYSS_SEASON_DAYS, MAX_STAR };`);
const E = global.__e;
let fails = 0;
const ok = (n, c, i) => { if(!c) fails++; console.log((c ? '✅' : '❌') + ' ' + n + (i !== undefined ? '  ' + JSON.stringify(i) : '')); };

function setup(lv, star){
  api.STATE = E.DEFAULT_STATE();
  const S = api.STATE;
  const party = ['m68', 'm116', 'm54', 'm113', 'm31'];
  party.forEach(id => S.owned[id] = { star: star || 7, souls: 0, level: lv, skillLv: 10, skill2Lv: 10, ultLv: 10, passiveLv: 10 });
  const fk = E.formationForFrontCount(party.filter(id => E.isMeleeRole(E.MON_BY_ID[id].role)).length).key;
  S.formationKey = fk; S.slots = E.lineupFromList(party, fk); S.autoUlt = true;
  S.clearedStages = E.STAGES.map(s => s.id); S.stamina = 100;
  return S;
}
function fight(id){
  api.resetQueue();
  const prev = E.battleUI;
  E.startBattle(id, { skipIntro: true });
  const b = E.battleUI;
  if(!b || b === prev || b.stage.id !== id) return null;
  api.drainQueue();
  return b;
}

// --- 階の作り ---
const s1 = E.abyssStage(1), s5 = E.abyssStage(5), s48 = E.abyssStage(48), s60 = E.abyssStage(60);
ok('1階は敵Lv60・スタミナ0', s1.rec === 60 && s1.stamina === 0 && E.stageStaminaCost(s1) === 0);
ok('1階ごとに敵Lv+5、48階で300に頭打ち', E.abyssStage(2).rec === 65 && s48.rec === 295 && E.abyssStage(49).rec === 300 && s60.rec === 300);
ok('5階ごとにボス', s5.boss && s5.waves[0].some(e => e.boss) && !E.abyssStage(4).boss);
ok('50階より先は★が上がっていく', s60.waves[0][1].star > E.abyssStage(50).waves[0][1].star, [E.abyssStage(50).waves[0][1].star, s60.waves[0][1].star]);
ok('同じ期・同じ階なら敵は毎回同じ', JSON.stringify(E.abyssStage(7).waves) === JSON.stringify(E.abyssStage(7).waves));
const theme = E.abyssTheme(E.abyssSeasonIndex());
const themed = [...Array(30)].flatMap((_, i) => E.abyssStage(i + 1).waves[0]).filter(e => theme.includes(E.MON_BY_ID[e.ref].element)).length;
ok('テーマ属性(2つ)の敵が多い', theme.length === 2 && themed / (30 * 3.5) > 0.5, [theme, themed]);
ok('findStage で ab_N が引ける', E.findStage('ab_12').floor === 12);

// --- 進行・持ち越し・チェックポイント ---
let S = setup(200, 7);
E.ensureAbyss();
ok('飛び級はできない', fight('ab_3') === null);
const st0 = S.stamina, g0 = S.gold || 0;
let b = fight('ab_1');
ok('1階を突破できる(強いパーティ)', b && b.win, b && b.round);
ok('スタミナは減らない', S.stamina === st0);
ok('初回報酬が入る', (S.gold || 0) > g0 && S.abyss.claimed[1]);
ok('次は2階', S.abyss.floor === 2 && S.abyss.best === 1);
ok('HPを持ち越す記録が残る', S.abyss.snap && Object.keys(S.abyss.snap).length === 5);
// 持ち越しの反映: 1体を戦闘不能・1体をHP30%にしておく
S.abyss.snap.m54 = { hp: 0, sp: 0, alive: false };
S.abyss.snap.m68 = { hp: 0.3, sp: 50, alive: true };
api.resetQueue(); E.startBattle('ab_2', { skipIntro: true });
const titan = E.battleUI.party.find(u => u.ref === 'm54'), fen = E.battleUI.party.find(u => u.ref === 'm68');
ok('戦闘不能は持ち越される', !titan.alive);
ok('HPの割合とSPが持ち越される', Math.abs(fen.hp / fen.maxHp - 0.3) < 0.01 && fen.sp === 50, [fen.hp / fen.maxHp, fen.sp]);
api.drainQueue();
for(let f = 3; f <= 5 && S.abyss.floor === f; f++) fight('ab_' + f);
ok('5階のボスを倒すとチェックポイント・全回復', S.abyss.checkpoint === 5 && S.abyss.snap === null && S.abyss.floor === 6, [S.abyss.checkpoint, S.abyss.floor]);
const cBefore = S.crystals;
// --- 負けたらチェックポイントに戻る ---
S.abyss.floor = 9; S.abyss.snap = null;
api.resetQueue(); E.startBattle('ab_9', { skipIntro: true }); E.finishBattle(false);
ok('負けると最後のチェックポイントの次の階から', S.abyss.floor === 6 && S.abyss.snap === null);
// --- 報酬は期ごとに1回 ---
S.abyss.floor = 1; const gA = S.gold;
fight('ab_1');
ok('同じ期に同じ階を突破しても報酬は出ない', S.gold === gA && E.battleUI.abyssResult.first === false);
// --- 期のリセット ---
S.abyss.season -= 1; S.abyss.best = 12; S.abyss.bestEver = 12;
E.ensureAbyss();
ok('期が変わると1階に戻り、報酬も受け取り直せる', S.abyss.floor === 1 && Object.keys(S.abyss.claimed).length === 0 && S.abyss.checkpoint === 0);
ok('過去の最高記録は残る', S.abyss.bestEver === 12 && Object.values(S.abyss.history).includes(12));
ok('5階・25階の報酬は多め', E.abyssFloorReward(5).length > E.abyssFloorReward(4).length && E.abyssFloorReward(25).some(r => r.type === 'crystal' && r.n === 100));
ok('深淵回廊の実績とウィークリーがある', E.ACHIEVEMENTS.some(a => a.id === 'a_abyss') && E.WEEKLY_MISSIONS.some(m => m.id === 'w_abyss'));
ok('タブが描ける', E.renderAbyssTab().includes('深淵回廊'));
// --- 上級クリア前は入れない ---
S.clearedStages = ['tu1', 'tu2', 'tu3'];
ok('上級をクリアするまでは挑戦できない', fight('ab_1') === null && E.renderAbyssTab().includes('クリアすると挑戦できます'));

// --- アイテム ---
S = setup(50);
S.stamina = 10; E.addItem('stamina_60', 1);
E.useStaminaItem('stamina_60');
ok('スタミナの実でスタミナ+60', S.stamina === 70 && E.getItem('stamina_60') === 0);
E.addItem('idle_3', 1); const g1 = S.gold || 0;
const got = E.useIdleItem('idle_3');
ok('時渡りの砂・中で鉱山3時間分のゴールド(Lv1: 1000/時)', (S.gold || 0) - g1 === 3000 && got.gold === 3000, got);
ok('研究所・工房の分も入る', Object.keys(got).length >= 2, got);

// --- 難しさの目安: 強いパーティ(Lv200★7)でどこまで行けるか ---
S = setup(200, 7); E.ensureAbyss();
let reached = 0;
for(let i = 0; i < 80; i++){ const f = S.abyss.floor; const r = fight('ab_' + f); if(!r || !r.win){ break; } reached = f; }
console.log('  参考: Lv200・★7・スキルLv10のパーティで一度に到達した階 =', reached);
S = setup(100, 5); E.ensureAbyss(); reached = 0;
for(let i = 0; i < 80; i++){ const f = S.abyss.floor; const r = fight('ab_' + f); if(!r || !r.win){ break; } reached = f; }
console.log('  参考: Lv100・★5 のパーティで一度に到達した階 =', reached);
console.log(fails ? `${fails}件失敗` : 'すべて通過');
