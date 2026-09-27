const api=require('./harness.js')(process.argv[2]);
const by=Object.fromEntries(api.MONSTERS.map(m=>[m.name,m.id]));const P=n=>n.map(x=>by[x]);
const PARTIES={基本A:['m06','m21','m03','m14','m15'],基本B:['m05','m15','m22','m57','m19'],気絶:P(['ロックゴーレム','サイクロプス','イエティ','セイレーン','ノーム']),やけど毒:P(['ヘルハウンド','サラマンダー','ヴェノムスライム','マグマゴーレム','アラクネ']),高レア:P(['タイタン','九尾の狐','雷電','シースライム','ケルベロス'])};
const TIER={q1:{skill:[1,3]},q2:{star:3,skill:[3,5]},q3:{star:4,skill:[5,7]},q4:{star:5,skill:[7,9]},q5:{star:6,skill:[9,10]},q6:{star:7,skill:[10,12]},q7:{star:8,skill:[12,12]}};
const res=[];
for(const spec of process.argv.slice(3)){ const [id,pn]=spec.split(':'); const st=api.STAGES.find(s=>s.id===id); const t=TIER[st.tier.replace(/h$/,'')]; const i=st.no-1; const sk=Math.round(t.skill[0]+(t.skill[1]-t.skill[0])*i/9);
  let w=0; const N=+(process.env.N||100); for(let k=0;k<N;k++){ if(api.run(PARTIES[pn],id,st.rec,{star:t.star,skillLv:sk,ultLv:sk,passiveLv:sk}).win) w++; } res.push(`${spec} ${Math.round(w/N*100)}`); }
console.log(res.join(' | '));
