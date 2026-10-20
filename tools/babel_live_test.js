// バベルの本番側: 解放・初回報酬・5階(ステージ効果)と10階(特殊ステージ)。均衡の塔は60階(5の倍数がボス戦)。
// 使い方: node tools/babel_live_test.js
const load = require('./harness.js');
const api = load('game.js', s => s + ';global.__b={EXPLORE_MENU,exploreMenu,nextStageOf,grantStageRewards,babelStage,BABEL_FLOORS,BABEL_TOWERS,babelFloorReward,babelFloorCleared,babelOpenFloor,babelLastId,babelAllowed,babelPartyProblem,BABEL_CRYSTAL,babelCrystal,babelFloorCount,babelStrength,BABEL_GROW,BABEL_TOWERS,BABEL_LV,BABEL_FLOORS,MONSTERS,MON_BY_ID,MON_BY_NAME,DEFAULT_STATE,startBattle,get battleUI(){return battleUI},stageUnlocked,findStage,speciesOf,BABEL_DEV};');
const B = global.__b;
// バベルは 10/20 12:00 公開。公開前は開発者(?babel=1)しか入れないので、テストでは公開ずみにする
const BABEL_ENTRY = B.EXPLORE_MENU.find(t => t.key === 'babel');
const BABEL_AT = BABEL_ENTRY.releaseAt;
BABEL_ENTRY.releaseAt = '2026-01-01T00:00:00+09:00';
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
   st10.rules.some(r => r.who && r.who.ref === boss[0].ref && r.stat && r.stat.hp >= 1),
   st10.rules.map(r => r.label));
ok('2パーティ戦はもう無い',
   B.BABEL_TOWERS.every(t => B.BABEL_FLOORS[t.key].every(fl => !fl.halves)));
ok('ステージIDに _0 / _1 が付かない', B.findStage('bb_order_10').id === 'bb_order_10');

console.log('\n--- 5. 報酬の形 ---');
ok('秩序・混沌はどの階も同じ(5階ごとだけ倍)', B.BABEL_CRYSTAL.filter(n => n === 50).length === 8 && B.BABEL_CRYSTAL.filter(n => n === 100).length === 2, B.BABEL_CRYSTAL);
const towerCrys = t => [...Array(B.babelFloorCount(t)).keys()].reduce((a, i) => a + B.babelCrystal(t, i + 1), 0);
ok('均衡の塔(60階)の星結晶は1,560', towerCrys('bal') === 1560, towerCrys('bal'));
ok('秩序・混沌の塔は600ずつ', towerCrys('order') === 600 && towerCrys('chaos') === 600, [towerCrys('order'), towerCrys('chaos')]);
ok('スタミナを使わない', B.findStage('bb_chaos_10').stamina === 0);
ok('味方もLv200(ステージの推奨Lv)', B.findStage('bb_chaos_1').rec === B.BABEL_LV);

console.log('\n--- 6. 均衡の塔(60階) ---');
fresh();
ok('均衡の塔は60階、秩序・混沌は10階', B.babelFloorCount('bal') === 60 && B.babelFloorCount('order') === 10 && B.babelFloorCount('chaos') === 10);
ok('60階まで全部ステージになり、61階は無い', [...Array(60).keys()].every(i => B.findStage('bb_bal_' + (i + 1))) && !B.findStage('bb_bal_61'));
const bossFloors = [...Array(60).keys()].map(i => i + 1).filter(f => B.BABEL_FLOORS.bal[f - 1].boss);
ok('ボス戦は5の倍数の12階', JSON.stringify(bossFloors) === JSON.stringify([5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60]), bossFloors);
const BOSSES = ['オークジェネラル', 'ミノタウロス', 'クラーケン', 'ケルベロス', 'グリフォン', 'ミスリルゴーレム', 'メデューサ', 'タロース', 'リヴァイアサン', 'バハムート', '死神', 'ホーリードラゴン'];
const bossNames = bossFloors.map(f => { const st = B.findStage('bb_bal_' + f), w = st.waves[st.waves.length - 1]; return w.filter(u => u.boss).map(u => B.MON_BY_ID[u.ref].name).join(); });
ok('ボスの並びは要件どおり(55階は死神)', JSON.stringify(bossNames) === JSON.stringify(BOSSES), bossNames);
ok('ボスの階にはステージ効果(ボスの強化のほかに1つ以上)',
   bossFloors.every(f => B.findStage('bb_bal_' + f).rules.filter(r => !/^ボス「|^塔の敵/.test(r.label)).length >= 1));
ok('ふつうの階はステージ効果なし(塔の敵の底上げだけ)',
   [...Array(60).keys()].map(i => i + 1).filter(f => f % 5).every(f => B.findStage('bb_bal_' + f).rules.every(r => /^塔の敵/.test(r.label))));
ok('ボスの階の報酬は 星結晶50＋ワザ素材BOX＋EXPポット、ふつうの階は星結晶20だけ',
   B.findStage('bb_bal_15').firstClear === 50 && B.findStage('bb_bal_15').reward.some(r => r.key === 'box_sel_3') && B.findStage('bb_bal_60').reward.some(r => r.key === 'box_sel_4')
   && B.findStage('bb_bal_16').firstClear === 20 && B.findStage('bb_bal_16').reward.length === 0);
ok('解放は1つ前の階(11階は10階、60階は59階)', B.findStage('bb_bal_11').requires === 'bb_bal_10' && B.findStage('bb_bal_60').requires === 'bb_bal_59');
ok('敵の★は51階から10(塔の中だけ★10まで)', B.findStage('bb_bal_51').waves.flat().every(u => u.star === 10) && B.findStage('bb_bal_10').waves.flat().every(u => u.star <= 7));
ok('均衡の塔は60階とも 5体×3WAVE(2026-10-19)', B.BABEL_FLOORS.bal.every(fl => fl.waves.length === 3 && fl.waves.every(w => w.split('・').length === 5)));
ok('同じ顔ぶれ(3WAVEとも同じ並び)の階が無い', new Set(B.BABEL_FLOORS.bal.map(fl => fl.waves.join('|'))).size === 60);
ok('育ちの段に「上級+」(★9・スキルLv10・ルーンⅨ・★5遺物)がある', (() => { const g = B.BABEL_GROW.find(x => x.name === '上級+'); return g && g.starMin === 9 && g.sk === 10 && g.rune === 9 && g.relic[0] === 5; })());
// 前の10階のころにクリアしたセーブ(bb_bal_1〜10)は、新しい1〜10階のクリアとして数え、11階から続きを遊べる
for(let f = 1; f <= 10; f++) api.STATE.clearedStages.push('bb_bal_' + f);
ok('前の均衡の塔10階をクリアしたセーブは11階から', B.babelOpenFloor('bal') === 11 && B.stageUnlocked(B.findStage('bb_bal_11')) && !B.stageUnlocked(B.findStage('bb_bal_12')));
const c11 = api.STATE.crystals;
put('ペガサス・ワイバーン・ゼピュロス・シームルグ・天狗');
ok('11階に勝つと星結晶20、12階が開く', fight('bb_bal_11') === true && api.STATE.crystals - c11 === 20 && B.babelOpenFloor('bal') === 12, api.STATE.crystals - c11);
for(let f = 12; f <= 59; f++) api.STATE.clearedStages.push('bb_bal_' + f);
ok('59階まで進むと60階が開く', B.babelOpenFloor('bal') === 60 && B.stageUnlocked(B.findStage('bb_bal_60')));
api.STATE.clearedStages.push('bb_bal_60');
ok('60階をクリアすると「全部クリア」(61)', B.babelOpenFloor('bal') === 61);

ok('勝ったら「次の階」(11階→12階)。負けたら無し、60階の次は無し',
   (B.nextStageOf(B.findStage('bb_bal_11'), true) || {}).id === 'bb_bal_12' && B.nextStageOf(B.findStage('bb_bal_11'), false) === null && B.nextStageOf(B.findStage('bb_bal_60'), true) === null);
// バベルではソウルも仲間入りも出ない(2026-10-19)。ボス・レアの印つきで200回まわしても0
{
  const st = B.findStage('bb_bal_15');
  const spawned = st.waves.flat().map((u, i) => ({ ...u, rarity: B.MON_BY_ID[u.ref].rarity, rare: i === 0 }));
  const owned0 = Object.keys(api.STATE.owned).length, pend0 = JSON.stringify(api.STATE.pendingSouls || {});
  let souls = 0;
  for(let i = 0; i < 200; i++) souls += B.grantStageRewards(st, spawned, []).souls.length;
  ok('バベルではソウルも仲間入りも出ない', souls === 0 && Object.keys(api.STATE.owned).length === owned0 && JSON.stringify(api.STATE.pendingSouls || {}) === pend0, souls);
}
// 公開前は探索に出ず、出撃もできない
BABEL_ENTRY.releaseAt = '2999-01-01T00:00:00+09:00';
ok('公開前はバベルが探索に出ない', !B.exploreMenu().some(t => t.key === 'babel'));
BABEL_ENTRY.releaseAt = BABEL_AT;
ok('公開は 10/20 12:00', BABEL_AT === '2026-10-20T12:00:00+09:00');
console.log(bad ? 'NG' : 'すべて通過');
process.exit(bad ? 1 : 0);
