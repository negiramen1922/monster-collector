/* フレイヤイベ(黄金のフォールクヴァング)の EX1・EX3・HELL の簡易測定(指示書8章)。
   使い方: N=30 node freyja_measure.js [ex1 ex3 hell]
   - 編成の作り方は試験場(?lab=freyja)と同じ(evLabBuildParty: 遺物・ステージ効果・陣形・シナジー)。ルーンは入れていない
   - 勝率・平均ラウンド(勝ったとき)・30ラウンドの時間切れ・最終ウェーブの敵フレイヤの回復量を出す */
const load = require('./harness.js');
// 開始時刻(10/13 12:00)より前だと星刻が付かない(試験場 ?lab= では付く)ので、時計を開催中にしておく
Date.now = () => new Date('2026-10-14T12:00:00+09:00').getTime();
const api = load('game.js', s => s + `;global.__m={ set evLab(v){ evLab = v; }, get evLab(){ return evLab; }, evLabStart, labBestRelic, RELIC_SKILL_MAX, RELIC_MAX_DUPE_USE,
  STAGE_BY_ID, MON_BY_ID, MONSTERS, get b(){ return battleUI; } };`);
const M = global.__m;
const by = Object.fromEntries(M.MONSTERS.map(m => [m.name, m.id]));
const P = names => names.map(n => { if(!by[n]) throw new Error('no ' + n); return by[n]; });
const PARTIES = {
  イベント組: P(['フレイヤ', 'フレイ', 'ヒルディスヴィーニ', 'ヒルデ', 'スコグル']),
  イベント組2: P(['フレイヤ', 'フレイ', 'ヒルディスヴィーニ', 'ブリュンヒルド', 'ゲンドゥル']),
  高レア: P(['タイタン', '九尾の狐', '雷電', 'シースライム', 'ケルベロス']),
  基本B: ['m05', 'm15', 'm22', 'm57', 'm19'],
};
// 育ち(指示書8章)。ルーンは入れていない(このハーネスにはルーンの仕組みがないため)
const GROW = {
  ex1:  { stage: 'ev_freyja_ex1', star: 4, lv: 70, sk: 3, pv: 1, relic: 0 },
  ex3:  { stage: 'ev_freyja_ex3', star: 5, lv: 250, sk: 10, pv: 3, relic: 80, rsk: 1, rdupe: 0 },
  hell: { stage: 'ev_freyja_ex4', star: 10, lv: 300, sk: 10, pv: 5, relic: 200, rsk: 'max', rdupe: 'max' },
  // 参考: EX1 を Lv150 で(鬼ヶ島の測定と同じ見方)/ HELL を EX3想定の育ちで(有利な編成なら育ちきっていなくても勝てるか)
  ex1_lv150: { stage: 'ev_freyja_ex1', star: 4, lv: 150, sk: 3, pv: 1, relic: 0 },
  hell_ex3grow: { stage: 'ev_freyja_ex4', star: 5, lv: 250, sk: 10, pv: 3, relic: 80, rsk: 1, rdupe: 0 },
  hell_lv250s7: { stage: 'ev_freyja_ex4', star: 7, lv: 250, sk: 10, pv: 3, relic: 80, rsk: 1, rdupe: 0 },
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
  const fr = b.enemies.find(e => e.ref === 'm177');
  return { win: !!b.win, round: b.round, wave: b.waveIndex + 1, timeout: !b.win && b.round >= 30,
    frHeal: fr ? fr.report.healAlly + fr.report.healSelf : 0, frAlive: !!(fr && fr.alive),
    mvp: b.party.slice().sort((x, y) => y.report.dealt - x.report.dealt)[0].name };
}
const N = +(process.env.N || 30);
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
      '12R以内': wins.filter(r => r.round <= 12).length, 負け: lostAt, 敵フレイヤの回復: avg(rows.map(r => r.frHeal)), MVP: mvp }));
  }
}
