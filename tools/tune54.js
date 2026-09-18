const load=require('./harness.js');
const api=load('game.js', src => src + `;global.__q={QUEST_LV_ADJ, buildQuestStages, STAGE_BY_ID};`);
const Q=global.__q, fs=require('fs');
const tier=process.argv[2];
const PARTY={ q1:['m06','m21','m03','m14','m15'], q2:['m05','m15','m22','m57','m19'], q3:['m05','m15','m22','m57','m19'] };
function apply(id,t){ Q.QUEST_LV_ADJ[id]=t; Object.assign(Q.STAGE_BY_ID[id], Q.buildQuestStages().find(s=>s.id===id)); }
function opts(st){ const i=st.no-1; const ramp=(a,b)=>Math.round(a+(b-a)*i/9);
  return st.tier==='q1'?{skill:ramp(1,3)}: st.tier==='q2'?{star:3,skill:ramp(3,5)}:{star:4,skill:ramp(5,7)}; }
function wr(id,N){ const st=Q.STAGE_BY_ID[id], o=opts(st); let w=0;
  for(let k=0;k<N;k++){ const b=api.run(PARTY[st.tier], id, st.rec, {star:o.star, skillLv:o.skill, ultLv:o.skill, passiveLv:o.skill}); if(b.win) w++; } return w/N; }
const out={};
const only=(process.env.ONLY||'').split(',').filter(Boolean);
for(const st of api.STAGES.filter(s=>s.tier===tier && (!only.length || only.includes(s.id)))){
  const id=st.id, goal=st.boss?0.6:0.85;
  const combos = [{}];
  const [lo0,hi0] = st.boss ? [0,25] : [Math.max(-5,1-st.rec), 5];
  const key = st.boss ? 'bossLv' : 'lv';
  let best=null;
  for(const c of combos){
    let lo=lo0, hi=hi0;
    while(lo<hi){ const mid=Math.ceil((lo+hi)/2); apply(id,{...c,[key]:mid}); if(wr(id,24)>=goal) lo=mid; else hi=mid-1; }
    apply(id,{...c,[key]:lo});
    const w=wr(id,40);
    const score=Math.abs(w-goal)*100;
    if(!best||score<best.score) best={t:{...c,[key]:lo},w,score};
  }
  apply(id,best.t);
  const w=wr(id,80);
  out[id]=best.t;
  const b=Q.STAGE_BY_ID[id].waves.flat().find(e=>e.boss);
  console.log(`${id} ${st.name} 推奨${st.rec} ${JSON.stringify(best.t)} ${b?`ボスLv${b.level}★${b.star}`:''} 勝率${Math.round(w*100)}%`);
}
fs.writeFileSync(`adj54_${tier}${only.length?'_part':''}.json`, JSON.stringify(out));
