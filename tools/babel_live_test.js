// バベルの本番側: 解放・初回報酬・5階(ステージ効果)と10階(特殊ステージ)。
// 使い方: node tools/babel_live_test.js
const load = require('./harness.js');
const api = load('game.js', s => s + ';global.__b={babelStage,BABEL_FLOORS,BABEL_TOWERS,babelFloorReward,babelFloorCleared,babelOpenFloor,babelLastId,babelAllowed,babelPartyProblem,BABEL_CRYSTAL,BABEL_TOWERS,BABEL_LV,BABEL_FLOORS,MONSTERS,MON_BY_ID,MON_BY_NAME,DEFAULT_STATE,startBattle,get battleUI(){return battleUI},stageUnlocked,findStage,speciesOf,BABEL_DEV};');
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
/* 仕組みの確認が目的なので、勝つまでやり直す(バベルはスタミナを使わないので本番でも同じことができる)。
   階ごとの勝率は babel_sim.js の担当。ここで1回の勝敗を見ると、たまたま負けてテストが落ちる */
function fight(id, tries){
  for(let k = 0; k < (tries || 20); k++){
    api.resetQueue();
    B.startBattle(id, { skipIntro: true });
    if(!B.battleUI) return null;   // 出撃できていない(解放されていない等)
    api.drainQueue();
    if(B.battleUI.win) return true;
  }
  return false;
}

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
ok('星結晶が50もらえる', api.STATE.crystals - before.c === B.BABEL_CRYSTAL[0], api.STATE.crystals - before.c);
ok('2階が開く', B.stageUnlocked(B.findStage('bb_order_2')) && B.babelOpenFloor('order') === 2);
const c2 = api.STATE.crystals;
ok('同じ階をもう一度勝っても報酬は出ない', fight('bb_order_1') === true && api.STATE.crystals === c2, api.STATE.crystals - c2);

console.log('\n--- 4. 5階(ステージ効果)と10階(特殊ステージ) ---');
// 5階まで進める(2〜4階をクリア扱いにする)
for(let f = 2; f <= 4; f++) api.STATE.clearedStages.push(B.babelLastId('order', f));
ok('5階に挑める', B.stageUnlocked(B.findStage('bb_order_5')));
ok('5階にはステージ効果がある', B.findStage('bb_order_5').rules.length >= 3,
   B.findStage('bb_order_5').rules.map(r => r.label));
ok('1〜4階はステージ効果なし(塔の敵の底上げだけ)',
   [1, 2, 3, 4].every(f => B.BABEL_FLOORS.order[f - 1].rules.length === 0));
ok('6〜9階もステージ効果なし',
   [6, 7, 8, 9].every(f => B.BABEL_FLOORS.order[f - 1].rules.length === 0));
const c5 = api.STATE.crystals;
put('タイタン・ブロック・グリーンマン・ノッカー・ドリュアス');
ok('5階に勝てる', fight('bb_order_5') === true);
ok('星結晶が100もらえる', api.STATE.crystals - c5 === B.BABEL_CRYSTAL[4], api.STATE.crystals - c5);
ok('ワザ素材の選択BOXももらえる', ((api.STATE.items || {}).box_sel_3 || 0) === 1, (api.STATE.items || {}).box_sel_3);

for(let f = 6; f <= 9; f++) api.STATE.clearedStages.push(B.babelLastId('order', f));
const st10 = B.findStage('bb_order_10');
const boss = st10.waves[st10.waves.length - 1].filter(u => u.boss);
ok('10階は最終WAVEにボスが1体', boss.length === 1, boss.map(u => B.MON_BY_ID[u.ref].name));
ok('10階はボスだけが大きく強化される',
   st10.rules.some(r => r.who && r.who.ref === boss[0].ref && r.stat && r.stat.hp >= 3),
   st10.rules.map(r => r.label));
ok('2パーティ戦はもう無い',
   B.BABEL_TOWERS.every(t => B.BABEL_FLOORS[t.key].every(fl => !fl.halves)));
ok('ステージIDに _0 / _1 が付かない', B.findStage('bb_order_10').id === 'bb_order_10');

console.log('\n--- 5. 報酬の形 ---');
ok('どの階も同じ(5階ごとだけ倍)', B.BABEL_CRYSTAL.filter(n => n === 50).length === 8 && B.BABEL_CRYSTAL.filter(n => n === 100).length === 2, B.BABEL_CRYSTAL);
let crys = 0;
for(const t of B.BABEL_TOWERS) for(let f = 1; f <= 10; f++) crys += B.BABEL_CRYSTAL[f - 1];
ok('3塔の星結晶は1,800', crys === 1800, crys);
ok('スタミナを使わない', B.findStage('bb_chaos_10').stamina === 0);
ok('味方もLv200(ステージの推奨Lv)', B.findStage('bb_chaos_1').rec === B.BABEL_LV);

console.log(bad ? 'NG' : 'すべて通過');
process.exit(bad ? 1 : 0);
