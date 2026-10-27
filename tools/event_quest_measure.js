/* イベントのクエスト10層の勝率を、層ごとに測る(event_sim.js と同じ育ちの決め方。2026-10-27)。
   使い方: N=100 PARTY=イベント組 node tools/event_quest_measure.js ev_slime
   - 育ちは層の推奨Lvに合わせる(Lvは推奨Lv・300まで、★とスキルLvは層ごとの表)。遺物・ルーンはなし
   - パーティ: 高レア / 基本B / 気絶(企画の資料の「作ったあとに測ること」) と、そのイベントのイベント組 */
process.chdir(require('path').join(__dirname));
Date.now = (t => () => t)(new Date('2026-10-28T12:00:00+09:00').getTime());   // 両イベントの開催中(星刻も付く)
const api = require('./harness.js')('game.js');
const by = Object.fromEntries(api.MONSTERS.map(m => [m.name, m.id])); const P = n => n.map(x => { if(!by[x]) throw new Error('no ' + x); return by[x]; });
const EVENT_PARTY = {
  ev_freyja: ['フレイヤ', 'フレイ', 'ヒルディスヴィーニ', 'ヒルデ', 'スコグル'],
  ev_momotaro: ['モモタロウ', 'イヌ', 'サル', 'キジ', 'ウンディーネ'],
  ev_slime: ['シースライム', 'キングスライム', 'アークエンジェルスライム', 'アーススライム', 'ウィンドスライム'],
  ev_halloween: ['ジャック・オ・ランタン', 'ミミック', 'ヴァンパイア', 'パンプキンヘッド', 'フランケン'],
};
const PARTIES = key => ({
  イベント組: P(EVENT_PARTY[key]),
  高レア: P(['タイタン', '九尾の狐', '雷電', 'シースライム', 'ケルベロス']),
  基本B: ['m05', 'm15', 'm22', 'm57', 'm19'],
  気絶: P(['ロックゴーレム', 'サイクロプス', 'イエティ', 'セイレーン', 'ノーム']),
});
// 層ごとのプレイヤー側の育ち(event_sim.js と同じ。スキルLvは上限10)
const GROW = [{ star: 0, sk: 1 }, { star: 0, sk: 2 }, { star: 3, sk: 3 }, { star: 4, sk: 4 }, { star: 5, sk: 6 }, { star: 5, sk: 7 }, { star: 6, sk: 9 }, { star: 7, sk: 10 }, { star: 8, sk: 10 }, { star: 10, sk: 10 }];
const N = +(process.env.N || 100);
const key = process.argv[2];
const only = process.env.PARTY ? process.env.PARTY.split(',') : Object.keys(PARTIES(key));
for(const pn of only){
  const party = PARTIES(key)[pn], rows = [];
  for(let n = 1; n <= 10; n++){
    const st = api.STAGES.find(s => s.id === `${key}_${n}`), g = GROW[n - 1];
    let w = 0, r = 0;
    for(let k = 0; k < N; k++){
      const b = api.run(party, st.id, Math.min(300, st.rec), { star: g.star || undefined, skillLv: g.sk, ultLv: g.sk, passiveLv: Math.min(5, Math.ceil(g.sk / 2)) });
      if(b.win) w++; r += b.round || 0;
    }
    rows.push(`${n}層 ${Math.round(w / N * 100)}%(${(r / N).toFixed(1)}R)`);
  }
  console.log(`${key} ${pn}: ${rows.join(' / ')}`);
}
