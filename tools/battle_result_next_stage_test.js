/* regression test: showBattleResult()'s "次のステージへ" button used to compute the next
   stage as mains[mains.indexOf(b.stage) + 1], which for a stage NOT in `mains` (any
   type other than 'main' - event, dungeon) gives indexOf === -1, so mains[-1+1] === mains[0]
   - the very first tutorial stage - wrongly sending players clearing an event/dungeon
   stage straight into the tutorial when they tapped "次のステージへ". */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e = {
  showBattleResult, get battleUI(){return battleUI},
};`);
const E = global.__e;
const ok = (name, cond, info) => console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));

// capture whatever showBattleResult() writes into #modal-layer
let lastModalHtml = '';
const origGetElementById = global.document.getElementById;
global.document.getElementById = (id) => {
  const el = origGetElementById(id);
  if(id === 'modal-layer'){
    Object.defineProperty(el, 'innerHTML', {
      set(v){ lastModalHtml = v; },
      get(){ return lastModalHtml; },
    });
  }
  return el;
};

const party = ['m06', 'm21', 'm03'];
const opts = { star: 5, skillLv: 5, ultLv: 5, passiveLv: 5 };
const HIGH_LV = 80; // overkill level so the win/lose RNG doesn't flake this test

// --- event-type stage: must NOT offer a "次のステージへ" button at all ---
// (note: "もう一度" retry always uses data-start-stage too, so check the button's own
// label text rather than the presence of data-start-stage in general.)
api.run(party, 'ev_titan_1', HIGH_LV, opts);
ok('イベントステージをクリアした', E.battleUI.win === true);
lastModalHtml = '';
E.showBattleResult('main');
ok('イベントステージ後に「次のステージへ」ボタンが出ない(チュートリアルへの誤誘導なし)', !lastModalHtml.includes('次のステージへ'));
ok('念のため tu1 への誘導が含まれていない', !lastModalHtml.includes('data-start-stage="tu1"'));

// --- dungeon-type stage: same guarantee (dungeon stages are built on demand by
// findStage(), not stored in STAGES/STAGE_BY_ID, hence the hardcoded dg_ id) ---
api.run(party, 'dg_exp_0', HIGH_LV, opts);
ok('ダンジョンステージをクリアした', E.battleUI.win === true);
lastModalHtml = '';
E.showBattleResult('main');
ok('ダンジョンステージ後も「次のステージへ」ボタンが出ない', !lastModalHtml.includes('次のステージへ'));

// --- positive case: a real main-quest stage still correctly offers its real next stage ---
api.run(party, 'q1_01', HIGH_LV, opts);
ok('メインクエストq1_01をクリアした', E.battleUI.win === true);
lastModalHtml = '';
E.showBattleResult('main');
ok('メインクエスト後は正しく次のステージ(q1_02)への誘導が出る', lastModalHtml.includes('data-start-stage="q1_02"') && lastModalHtml.includes('次のステージへ'));
