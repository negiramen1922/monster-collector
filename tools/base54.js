const api=require('./harness.js')('game.js', src => process.env.POWER ? src.replace(/const ENEMY_POWER = [\d.]+;/, `const ENEMY_POWER = ${process.env.POWER};`) : src);
const PARTY={ q1:['m06','m21','m03','m14','m15'], q2:['m05','m15','m22','m57','m19'], q3:['m05','m15','m22','m57','m19'] };
const N=+(process.env.N||30); const out=[];
for(const st of api.STAGES.filter(s=>s.tier!=='tu')){
  const i=st.no-1; const ramp=(a,b)=>Math.round(a+(b-a)*i/9);
  const o= st.tier==='q1'?{skill:ramp(1,3)}: st.tier==='q2'?{star:3,skill:ramp(3,5)}:{star:4,skill:ramp(5,7)};
  let w=0; for(let k=0;k<N;k++){ const b=api.run(PARTY[st.tier], st.id, st.rec, {star:o.star, skillLv:o.skill, ultLv:o.skill, passiveLv:o.skill}); if(b.win) w++; }
  out.push(`${st.id}${st.boss?'B':''}:${Math.round(w/N*100)}`);
}
console.log('POWER', process.env.POWER||'default', out.join(' '));
