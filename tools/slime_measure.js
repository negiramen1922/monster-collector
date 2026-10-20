/* スライムパラダイス(ぷるぷる島)の EX1・EX3・HELL の簡易測定(企画の資料「作ったあとに測ること」)。
   使い方: N=30 node slime_measure.js [ex1 ex3 hell]
   - 編成の作り方は試験場(?lab=slime)と同じ(evLabBuildParty: 遺物・ステージ効果・陣形・シナジー)。ルーンは入れていない
   - 勝率・平均ラウンド(勝ったとき)・30ラウンドの時間切れ・負けたウェーブを出す */
const load = require('./harness.js');
// 開始時刻(10/26 12:00)より前だと星刻が付かないので、時計を開催中にしておく
Date.now = () => new Date('2026-10-28T12:00:00+09:00').getTime();
// EXTRA: HELL に足すステージ効果(JSON の配列)。POWER・DMG: HELL の敵の強さ(power)と 敵 与ダメージ を試しに変える(測るときだけ)
const api = load('game.js', s => s.replace("{ ex:4, hell:true, lv:300, boss:10, mob:10, sk:10,\n    rules:[...SLIME_EX3_RULES,", `{ ex:4, hell:true, lv:300, boss:10, mob:10, sk:10, power:${+(process.env.POWER || 1)},\n    rules:[...SLIME_EX3_RULES,`).replace("{ side:'enemy', dmgDealt:1.0, label:'HELL 敵 与ダメージ+100%' }]", `{ side:'enemy', dmgDealt:${+(process.env.DMG || 1)}, label:'HELL' }, ...${process.env.EXTRA || '[]'}]`) + `;global.__m={ set evLab(v){ evLab = v; }, get evLab(){ return evLab; }, evLabStart, labBestRelic, RELIC_SKILL_MAX, RELIC_MAX_DUPE_USE,
  STAGE_BY_ID, MON_BY_ID, MONSTERS, get b(){ return battleUI; } };`);
const M = global.__m;
const by = Object.fromEntries(M.MONSTERS.map(m => [m.name, m.id]));
const P = names => names.map(n => { if(!by[n]) throw new Error('no ' + n); return by[n]; });
const PARTIES = {
  // 企画の資料の「HELL の目標と測り方」の編成
  イベント組: P(['シースライム', 'キングスライム', 'アークエンジェルスライム', 'アーススライム', 'ウィンドスライム']),
  '★5中心1': P(['リヴァイアサン', 'フェンリル', 'アバドン', '九尾の狐', 'ホーリードラゴン']),
  '★5中心2': P(['タイタン', 'フェンリル', 'バハムート', '九尾の狐', 'ウンディーネ']),
  '★4中心': P(['牛鬼', 'ハティ', 'スコル', 'ウンディーネ', 'ロキ']),
};
// 育ち(指示書8章)。ルーンは入れていない(このハーネスにはルーンの仕組みがないため)
const GROW = {
  ex1:  { stage: 'ev_slime_ex1', star: 4, lv: 70, sk: 3, pv: 1, relic: 0 },
  ex3:  { stage: 'ev_slime_ex3', star: 5, lv: 250, sk: 10, pv: 3, relic: 80, rsk: 1, rdupe: 0 },
  // EX2 の育ちは資料に決まりがないので、EX1 と EX3 の間にした(私が決めた): ★5・Lv180・スキルLv6・パッシブLv2・★5遺物 Lv40
  ex2:  { stage: 'ev_slime_ex2', star: 5, lv: 180, sk: 6, pv: 2, relic: 40, rsk: 1, rdupe: 0 },
  hell: { stage: 'ev_slime_ex4', star: 10, lv: 300, sk: 10, pv: 5, relic: 200, rsk: 'max', rdupe: 'max' },
  // 参考: EX1 を Lv150 で(鬼ヶ島の測定と同じ見方)/ HELL を EX3想定の育ちで(有利な編成なら育ちきっていなくても勝てるか)
  ex1_lv150: { stage: 'ev_slime_ex1', star: 4, lv: 150, sk: 3, pv: 1, relic: 0 },
  hell_ex3grow: { stage: 'ev_slime_ex4', star: 5, lv: 250, sk: 10, pv: 3, relic: 80, rsk: 1, rdupe: 0 },
  hell_lv250s7: { stage: 'ev_slime_ex4', star: 7, lv: 250, sk: 10, pv: 3, relic: 80, rsk: 1, rdupe: 0 },
};
// 試験場と同じ形(ex1 の前回の測定と同じ: 推奨Lvの段でも測れるように lv を差し替えられる)
function slot(id, g){
  const m = M.MON_BY_ID[id];
  return { id, star: Math.max(m.rarity, g.star), lv: g.lv, sk: g.sk, pv: g.pv,
    relic: g.relic ? M.labBestRelic(m, 5) : null, rlv: g.relic || 0,
    rsk: g.rsk === 'max' ? M.RELIC_SKILL_MAX : (g.rsk || 1), rdupe: g.rdupe === 'max' ? M.RELIC_MAX_DUPE_USE : (g.rdupe || 0) };
}
function fight(stage, party, g){
  if(!api.STATE){ api.STATE = api.DEFAULT_STATE(); api.STATE.autoUlt = true; }
  M.evLab = { stage, party: party.map(id => slot(id, g)), pick: null, fEl: '', fRole: '', sim: null };
  api.resetQueue();
  M.evLabStart(true);
  api.drainQueue();
  // drainQueue は 10000 手で止まるので、終わるまで回す
  for(let i = 0; i < 20 && !M.b.finished; i++) api.drainQueue();
  const b = M.b;
  return { win: !!b.win, round: b.round, wave: b.waveIndex + 1, timeout: !b.win && b.round >= 30,
    mvp: b.party.slice().sort((x, y) => y.report.dealt - x.report.dealt)[0].name };
}
const N = +(process.env.N || 30);
// ADD: 測る段のステージ効果に足す(JSON の配列。EX1〜HELL どの段にも使える)
if(process.env.ADD) process.argv.slice(2).forEach(k => { const st = M.STAGE_BY_ID[GROW[k].stage]; st.rules = [...st.rules, ...JSON.parse(process.env.ADD)]; });
const which = process.argv.slice(2).length ? process.argv.slice(2) : ['ex1', 'ex3', 'hell'];
const only = process.env.PARTY ? process.env.PARTY.split(',') : Object.keys(PARTIES);
for(const k of which){
  const g = GROW[k];
  for(const pn of only){
    const rows = [];
    for(let i = 0; i < N; i++) rows.push(fight(g.stage, PARTIES[pn], g));
    const wins = rows.filter(r => r.win);
    const avg = a => a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : null;
    const lostAt = {};
    rows.filter(r => !r.win).forEach(r => { const key = `W${r.wave}${r.timeout ? '時間切れ' : ''}`; lostAt[key] = (lostAt[key] || 0) + 1; });
    const mvp = {};
    rows.forEach(r => { mvp[r.mvp] = (mvp[r.mvp] || 0) + 1; });
    console.log(JSON.stringify({ 段: k, 編成: pn, 勝率: Math.round(wins.length / N * 100) + '%', 勝ちの平均R: avg(wins.map(r => r.round)), 勝ちの最大R: wins.length ? Math.max(...wins.map(r => r.round)) : null,
      '12R以内': wins.filter(r => r.round <= 12).length, 負け: lostAt, MVP: mvp }));
  }
}
