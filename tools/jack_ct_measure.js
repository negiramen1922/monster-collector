/* ジャック・オ・ランタンの専用遺物でスキル1のCTが縮んだときの強さを、ほかの★5アタッカー系と比べる(2026-10-26)。
   同じ4体(タイタン・ウンディーネ・ホーリードラゴン・リヴァイアサン)に1体を足し、その1体の「1ラウンドあたりの与ダメージ」と
   パーティの中での与ダメージの割合・勝率を見る。育ちきり(★10・Lv300・スキルLv10・パッシブLv5・★5遺物 Lv200・4凸)。
   使い方: N=100 STAGE=q7_10h node tools/jack_ct_measure.js */
process.chdir(require('path').join(__dirname));
const load = require('./harness.js');
Date.now = () => new Date('2026-10-29T12:00:00+09:00').getTime();
const api = load('game.js', s => s + `;global.__m={ MONSTER_KITS, RELICS, dealHits, jackParade, lanternHits, pv, set evLab(v){ evLab = v; }, evLabStart, labBestRelic, RELIC_SKILL_MAX, RELIC_MAX_DUPE_USE, MON_BY_ID, MONSTERS, skillCt, get b(){ return battleUI; } };`);
const M = global.__m;
// VAR: 改善案を試す(測るときだけ)。relicSkill=遺物の攻撃力2つをスキル攻撃力に / defDown=スキル1が防御低下の敵に威力+50% / combo=スキル2のあと次のスキル1のヒット数+3
const VAR = process.env.VAR || '';
if(VAR.includes('relicSkill')) M.RELICS.rel_devil_ember.effects = M.RELICS.rel_devil_ember.effects.map(e => e.stat === 'atk' ? { ...e, stat: 'skillDmg' } : e);
const K = M.MONSTER_KITS.m190;
if(VAR.includes('defDown')) K.skill1 = { ...K.skill1, bonusIf: [{ cond: 'defDown', add: 0.5 }] };
// lantern10: カボチャのランタンの上がり幅 +5% → +10% / combo2: スキル2のあと次のスキル1は威力+50%
if(VAR.includes('lantern10')) K.passive = { ...K.passive, dmgBonus: u => M.lanternHits(u) * M.pv(u, (u.lanternStep || 0.05) * 2) };
if(VAR.includes('combo2')){
  K.skill2 = { ...K.skill2, run: ctx => { M.dealHits(ctx); ctx.actor.flags.trickNext = true; } };
  K.skill1 = { ...K.skill1, run: ctx => { const u = ctx.actor; if(u.flags.trickNext){ u.flags.trickNext = false; M.dealHits(ctx, { pow: ctx.act.pow * 1.5 }); } else M.jackParade(ctx); } };
}
if(VAR.includes('combo') && !VAR.includes('combo2')){
  K.skill2 = { ...K.skill2, run: ctx => { M.dealHits(ctx); ctx.actor.flags.trickNext = true; } };
  K.skill1 = { ...K.skill1, run: ctx => { const u = ctx.actor; if(u.flags.trickNext){ u.flags.trickNext = false; M.dealHits(ctx, { hits: ctx.act.hits + 3 }); } else M.jackParade(ctx); } };
}
const by = Object.fromEntries(M.MONSTERS.map(m => [m.name, m.id]));
const ALLIES = ['タイタン', 'ウンディーネ', 'ホーリードラゴン', 'リヴァイアサン'].map(n => by[n]);
const N = +(process.env.N || 100);
const STAGES = (process.env.STAGE || 'q7_10h').split(',');
const slot = (id, o) => ({ id, star: 10, lv: 300, sk: 10, pv: 5, relic: o && o.relic !== undefined ? o.relic : M.labBestRelic(M.MON_BY_ID[id], 5), rlv: 200,
  rsk: o && o.rsk || M.RELIC_SKILL_MAX, rdupe: M.RELIC_MAX_DUPE_USE });
const CASES = [
  ['ジャック 遺物なし(CT3)', slot(by['ジャック・オ・ランタン'], { relic: null })],
  ['ジャック 専用遺物 遺物スキルLv1(CT2)', slot(by['ジャック・オ・ランタン'], { relic: 'rel_devil_ember', rsk: 1 })],
  ['ジャック 専用遺物 遺物スキルLv10(CT1)', slot(by['ジャック・オ・ランタン'], { relic: 'rel_devil_ember', rsk: 10 })],
  ...(process.env.ONLYJACK ? [] : ['九尾の狐', 'バハムート', 'アバドン', 'フェンリル', 'モモタロウ', 'フレイヤ'].filter(n => by[n]).map(n => [n + '(合う★5遺物)', slot(by[n])])),
];
for(const st of STAGES) for(const [name, s] of CASES){
  let win = 0, dpr = 0, share = 0, rounds = 0, ct = 0;
  for(let i = 0; i < N; i++){
    api.STATE = api.DEFAULT_STATE(); api.STATE.autoUlt = true;
    M.evLab = { stage: st, party: [s, ...ALLIES.map(id => slot(id))], pick: null, fEl: '', fRole: '', sim: null };
    api.resetQueue(); M.evLabStart(true); for(let k = 0; k < 20 && !M.b.finished; k++) api.drainQueue();
    const b = M.b, x = b.party.find(u => u.ref === s.id), all = b.party.reduce((a, u) => a + u.report.dealt, 0);
    if(b.win) win++;
    rounds += b.round; dpr += x.report.dealt / Math.max(1, b.round); share += x.report.dealt / Math.max(1, all); ct = M.skillCt(x, 0);
  }
  console.log(`${st}  ${name.padEnd(26)} スキル1 CT${ct}  勝率${Math.round(win / N * 100)}%  平均${(rounds / N).toFixed(1)}R  1ラウンドの与ダメージ ${Math.round(dpr / N).toLocaleString()}  パーティの中の割合 ${Math.round(share / N * 100)}%`);
}
