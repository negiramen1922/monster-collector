const api=require('./harness.js')('game.js');
const PARTY={ q1:['m06','m21','m03','m14','m15'], q2:['m05','m15','m22','m57','m19'], q3:['m05','m15','m22','m57','m19'] };
const ids=process.argv.slice(2).length ? process.argv.slice(2) : api.STAGES.filter(s=>s.tier!=='tu').map(s=>s.id);
for(const id of ids){
  const st=api.STAGES.find(s=>s.id===id); const i=st.no-1; const ramp=(a,b)=>Math.round(a+(b-a)*i/9);
  const o= st.tier==='q1'?{skill:ramp(1,3)}: st.tier==='q2'?{star:3,skill:ramp(3,5)}:{star:4,skill:ramp(5,7)};
  let w=0, r=[0,0,0,0]; const N=+(process.env.N||100);
  for(let k=0;k<N;k++){ const b=api.run(PARTY[st.tier], id, st.rec, {star:o.star, skillLv:o.skill, ultLv:o.skill, passiveLv:o.skill}); if(b.win){w++; r[b.rank]++;} }
  const lv=Math.min(...st.waves.flat().filter(e=>!e.boss).map(e=>e.level));
  const boss=st.waves.flat().find(e=>e.boss);
  console.log(`${id} ${st.name} 推奨${st.rec} 敵Lv${lv}${boss?` ボスLv${boss.level}★${boss.star}`:''} 勝率${Math.round(w/N*100)}% ★3 ${Math.round(r[3]/N*100)}%`);
}
