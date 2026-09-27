// 同じ4体に1体ずつ入れ替えて、ハードの高難度ステージでの勝率と与ダメを比べる
// N=30 node slot_sim.js アバドン フェンリル バハムート 死神 九尾の狐 雷電
const api=require('./harness.js')(process.env.GAME||'game.js');
const by=Object.fromEntries(api.MONSTERS.map(m=>[m.name,m.id]));
const BASE=['タイタン','ホーリードラゴン','シースライム','ケルベロス'].map(n=>by[n]);
const STAGES=(process.env.STAGES||'q5_05h,q5_10h,q6_05h,q6_10h,q7_03h,q7_07h').split(',');
const N=+(process.env.N||30);
for(const name of process.argv.slice(2)){ const id=by[name]; let w=0,t=0,dmg=0,ults=0; const per=[];
  for(const sid of STAGES){ const st=api.STAGES.find(s=>s.id===sid); let ww=0;
    for(let k=0;k<N;k++){ const b=api.run([...BASE,id],sid,Math.min(300,st.rec),{star:8,skillLv:12,ultLv:12,passiveLv:12}); if(b.win){w++;ww++;} t++;
      const u=(b.party||b.allies||[]).find(x=>x.ref===id||x.id===id); if(u&&u.report){dmg+=u.report.dealt||0; ults+=u.report.ults||0;} }
    per.push(Math.round(ww/N*100)); }
  console.log(name.padEnd(8),'勝率',Math.round(w/t*100)+'%',per.join('/'),'与ダメ',Math.round(dmg/t),'必殺技',(ults/t).toFixed(2)); }
