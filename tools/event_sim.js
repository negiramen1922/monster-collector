// イベント各層の勝率を測る: N=40 node event_sim.js ev_kyubi ev_fenrir ev_abaddon
const api=require('./harness.js')(process.env.GAME||'game.js');
const by=Object.fromEntries(api.MONSTERS.map(m=>[m.name,m.id]));const P=n=>n.map(x=>by[x]);
const PARTIES={
  基本B:['m05','m15','m22','m57','m19'],
  気絶:P(['ロックゴーレム','サイクロプス','イエティ','セイレーン','ノーム']),
  高レア:P(['タイタン','九尾の狐','雷電','シースライム','ケルベロス']),
};
// 層ごとのプレイヤー側の育ち具合(推奨Lvに合わせる。Lvは300まで)
const GROW=[{star:0,sk:1},{star:0,sk:2},{star:3,sk:3},{star:4,sk:4},{star:5,sk:6},{star:5,sk:7},{star:6,sk:9},{star:7,sk:10},{star:8,sk:12},{star:10,sk:12}];
const N=+(process.env.N||40); const keys=process.argv.slice(2); const out={};
for(const key of keys){ out[key]=[];
  for(let n=1;n<=10;n++){ const st=api.STAGES.find(s=>s.id===`${key}_${n}`); const g=GROW[n-1]; const row={};
    for(const [pn,party] of Object.entries(PARTIES)){ let w=0,r=0; for(let k=0;k<N;k++){ const b=api.run(party,st.id,Math.min(300,st.rec),{star:g.star||undefined,skillLv:g.sk,ultLv:g.sk,passiveLv:g.sk}); if(b.win) w++; r+=b.round||0; } row[pn]=Math.round(w/N*100); }
    out[key].push(row); console.error(key,n,JSON.stringify(row)); } }
console.log(JSON.stringify(out));
