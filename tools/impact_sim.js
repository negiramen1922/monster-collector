// スキル見直しの影響測定: 全メインステージ × いくつかのパーティで勝率とラウンド数を測る
// 使い方: N=30 node impact_sim.js [game.js] > out.json
const api=require('./harness.js')(process.argv[2]||'game.js');
const by=Object.fromEntries(api.MONSTERS.map(m=>[m.name,m.id]));
const P=names=>names.map(n=>{ if(!by[n]) throw new Error('no '+n); return by[n]; });
const PARTIES={
  基本A: ['m06','m21','m03','m14','m15'],
  基本B: ['m05','m15','m22','m57','m19'],
  気絶: P(['ロックゴーレム','サイクロプス','イエティ','セイレーン','ノーム']),
  やけど毒: P(['ヘルハウンド','サラマンダー','ヴェノムスライム','マグマゴーレム','アラクネ']),
  高レア: P(['タイタン','九尾の狐','雷電','シースライム','ケルベロス']),
};
const TIER={q1:{skill:[1,3]},q2:{star:3,skill:[3,5]},q3:{star:4,skill:[5,7]},q4:{star:5,skill:[7,9]},q5:{star:6,skill:[9,10]},q6:{star:7,skill:[10,12]},q7:{star:8,skill:[12,12]}};
const N=+(process.env.N||30); const out={};
for(const st of api.STAGES.filter(s=>TIER[s.tier.replace(/h$/,'')])){
  const t=TIER[st.tier.replace(/h$/,'')]; const i=st.no-1; const sk=Math.round(t.skill[0]+(t.skill[1]-t.skill[0])*i/9);
  out[st.id]={};
  for(const [pn,party] of Object.entries(PARTIES)){
    let w=0,rounds=0;
    for(let k=0;k<N;k++){ const b=api.run(party, st.id, st.rec, {star:t.star, skillLv:sk, ultLv:sk, passiveLv:sk}); if(b.win) w++; rounds+=(b.round||b.rounds||0); }
    out[st.id][pn]={w:w/N,r:rounds/N};
  }
}
console.log(JSON.stringify(out));
