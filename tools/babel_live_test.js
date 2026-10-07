// バベルの本番側: 解放・初回報酬・2パーティ戦の流れ。
// 使い方: node tools/babel_live_test.js
const load = require('./harness.js');
const api = load('game.js', s => s + ';global.__b={babelStage,babelFloorReward,babelFloorCleared,babelOpenFloor,babelLastId,babelAllowed,babelPartyProblem,BABEL_CRYSTAL,BABEL_TOWERS,BABEL_LV,BABEL_FLOORS,MONSTERS,MON_BY_ID,MON_BY_NAME,DEFAULT_STATE,startBattle,get battleUI(){return battleUI},stageUnlocked,findStage,speciesOf,BABEL_DEV};');
const B = global.__b;
let bad = 0;
const ok = (name, cond, info) => { bad += cond ? 0 : 1; console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : '')); };

function fresh(){
  api.STATE = B.DEFAULT_STATE();
  api.STATE.autoUlt = true;
  api.STATE.clearedStages = ['tu1', 'tu2', 'tu3', 'tu4', 'tu5'];   // チュートリアル後でないと出撃できない
  // 仕組みの確認が目的なので、編成は確実に勝てる育ち(★10・スキルLv12)にする。
  // ルーンと遺物は付けないので、階ごとの勝率の確認は babel_sim.js の担当
  B.MONSTERS.forEach(m => { api.STATE.owned[m.id] = { star: 10, souls: 0, level: 200, skillLv: 12, ultLv: 12, passiveLv: 12, skill2Lv: 12 }; });
}
const put = names => { api.STATE.slots = [null, null, null, null, null, null]; names.split('・').forEach((n, i) => { api.STATE.slots[i] = B.MON_BY_NAME[n]; }); };
function fight(id){ api.resetQueue(); B.startBattle(id, { skipIntro: true }); if(!B.battleUI) return null; api.drainQueue(); return B.battleUI.win; }

fresh();
console.log('--- 1. 解放 ---');
ok('1階は最初から挑める', B.stageUnlocked(B.findStage('bb_order_1')));
ok('2階は1階をクリアするまで挑めない', !B.stageUnlocked(B.findStage('bb_order_2')));
ok('いま挑める階は1階', B.babelOpenFloor('order') === 1, B.babelOpenFloor('order'));

console.log('\n--- 2. 編成のしばり ---');
put('ヘルハウンド・グリズリー・イエティ・メリュジーヌ・シームルグ');   // 混沌側のモンスター
ok('秩序の塔に混沌の種族を入れると出撃できない', B.babelPartyProblem('order', 0).includes('使えない'), B.babelPartyProblem('order', 0));
put('シルバーナイト・オーガ・ケンタウロス・ブルーウィスプ・ミノタウロス');
ok('秩序の種族だけなら出撃できる', B.babelPartyProblem('order', 0) === '', B.babelPartyProblem('order', 0));

console.log('\n--- 3. 初回クリアの報酬と解放 ---');
const before = { c: api.STATE.crystals, exp2: (api.STATE.items || {}).exp2 || 0 };
ok('1階に勝てる', fight('bb_order_1') === true);
ok('クリアが記録される', B.babelFloorCleared('order', 1));
ok('星結晶が30もらえる', api.STATE.crystals - before.c === B.BABEL_CRYSTAL[0], api.STATE.crystals - before.c);
ok('2階が開く', B.stageUnlocked(B.findStage('bb_order_2')) && B.babelOpenFloor('order') === 2);
const c2 = api.STATE.crystals;
ok('同じ階をもう一度勝っても報酬は出ない', fight('bb_order_1') === true && api.STATE.crystals === c2, api.STATE.crystals - c2);

console.log('\n--- 4. 2パーティ戦 ---');
// 5階まで進める(2〜4階をクリア扱いにする)
for(let f = 2; f <= 4; f++) api.STATE.clearedStages.push(B.babelLastId('order', f));
ok('5階の前半は挑める', B.stageUnlocked(B.findStage('bb_order_5_0')));
ok('5階の後半は前半に勝つまで挑めない', !B.stageUnlocked(B.findStage('bb_order_5_1')));
put('ペルセウス・ユニコーン・カーバンクル・オルペウス・セラミックゴーレム');
const c5 = api.STATE.crystals;
ok('前半に勝てる', fight('bb_order_5_0') === true);
ok('前半だけでは階のクリアにならない', !B.babelFloorCleared('order', 5));
ok('前半だけでは星結晶は出ない', api.STATE.crystals === c5, api.STATE.crystals - c5);
ok('後半が開く', B.stageUnlocked(B.findStage('bb_order_5_1')));
ok('前半で出した子は後半に出せない', B.babelPartyProblem('order', 1).includes('前半で出した'), B.babelPartyProblem('order', 1));
put('ユミル・アイスゴーレム・ウンディーネ・セイレーン・マーメイド');
ok('別の5体なら後半に出せる', B.babelPartyProblem('order', 1) === '', B.babelPartyProblem('order', 1));
ok('後半に勝てる', fight('bb_order_5_1') === true);
ok('階のクリアになる', B.babelFloorCleared('order', 5));
ok('星結晶が100もらえる', api.STATE.crystals - c5 === B.BABEL_CRYSTAL[4], api.STATE.crystals - c5);
ok('ワザ素材の選択BOXももらえる', ((api.STATE.items || {}).box_sel_3 || 0) === 1, (api.STATE.items || {}).box_sel_3);

console.log('\n--- 5. 報酬の合計 ---');
let crys = 0;
for(const t of B.BABEL_TOWERS) for(let f = 1; f <= 10; f++) crys += B.BABEL_CRYSTAL[f - 1];
ok('3塔の星結晶は1,980', crys === 1980, crys);
ok('スタミナを使わない', B.findStage('bb_chaos_10_1').stamina === 0);
ok('味方もLv200(ステージの推奨Lv)', B.findStage('bb_chaos_1').rec === B.BABEL_LV);

console.log(bad ? 'NG' : 'すべて通過');
process.exit(bad ? 1 : 0);
