const load=require('./harness.js');
const api=load('game.js', src => src + `;global.__g={runGimmick,hitHp,startRound,shieldTotal,findStage,get b(){return battleUI}};`);
const G=global.__g;
const ok=(name, cond, info)=>console.log((cond?'✅':'❌')+' '+name+(info!==undefined?'  '+JSON.stringify(info):''));
function bossBattle(id){
  api.run([], 'tu1', 1);
  const S=api.STATE; S.clearedStages=api.STAGES.map(s=>s.id);
  ['m54','m113','m116','m68','m125'].forEach(x=>S.owned[x]={star:5,souls:0,level:60,exp:0,wall:60,skillLv:1,ultLv:1,passiveLv:1});
  S.formationKey='f2'; S.slots=api.lineupFromList(['m54','m113','m116','m68','m125'],'f2');
  api.startBattle(id,{skipIntro:true});
  const B=G.b; B.transitioning=false; B.paused=true;
  // jump to the boss wave
  const st=G.findStage(id);
  B.waveIndex=st.waves.length-1;
  const f=api.STATE; 
  B.enemies=[]; 
  return B;
}
function spawnBoss(B, id){
  const st=G.findStage(id);
  const wave=st.waves[st.waves.length-1];
  // reuse the game's spawner through a fake stage containing only the boss wave
  const fake={...st, waves:[wave]};
  B.enemies=api.__spawn ? [] : [];
  return fake;
}
const load2=require('./harness.js');
const api2=load2('game.js', src => src + `;global.__h={spawnWave,runGimmick,hitHp,startRound,shieldTotal,findStage,summonEnemy,get b(){return battleUI}, set b(v){battleUI=v}};`);
const H=global.__h;
function setup(id){
  api2.run(['m54','m113','m116','m68','m125'], 'tu1', 60, {star:5});
  const B=H.b; B.finished=false; B.paused=true; B.transitioning=false;
  const st=H.findStage(id);
  B.stage={...st, waves:[st.waves[st.waves.length-1]]};
  B.waveIndex=0; B.round=0;
  B.party.forEach(u=>{u.alive=true;u.hp=u.maxHp;u.statuses={};u.buffs={};});
  B.enemies=H.spawnWave(B.stage,0);
  const boss=B.enemies.find(u=>u.boss);
  return {B, boss};
}
let {B,boss}=setup('q1_05');
ok('激昂: ボスに仕掛けが付く', boss && boss.gimmick==='enrage', boss&&boss.name);
H.hitHp(boss, Math.round(boss.maxHp*0.55), B.party[0], {});
ok('激昂: HP50%を切るとSTR・SPDアップ', boss.buffs.strUp && boss.buffs.spdUp);
({B,boss}=setup('q1_10'));
const n0=B.enemies.filter(u=>u.alive).length; boss.hp=Math.round(boss.maxHp*0.5);
B.round=2; H.startRound(B);
ok('森の再生: 3ラウンド目に回復と召喚', boss.hp>boss.maxHp*0.5 && B.enemies.filter(u=>u.alive).length===Math.min(5,n0+1), [n0, B.enemies.filter(u=>u.alive).length]);
({B,boss}=setup('q2_05'));
ok('鋼の殻: 最大HPの40%のシールド', Math.abs(H.shieldTotal(boss)-Math.round(boss.maxHp*0.4))<=1);
H.hitHp(boss, H.shieldTotal(boss)+5, B.party[0], {});
ok('鋼の殻: 壊れると気絶', !!boss.statuses.stun && boss.hp<boss.maxHp);
({B,boss}=setup('q2_10'));
B.party.forEach(u=>u.sp=50); B.round=2; H.startRound(B);
ok('呪術の儀式: 召喚とSP-20', B.party.every(u=>u.sp===30) && B.enemies.some(u=>u.summoned));
({B,boss}=setup('q3_05'));
let burned=0; for(let i=0;i<20;i++){ B.party.forEach(u=>u.statuses={}); B.round=i; H.startRound(B); burned+=B.party.filter(u=>u.statuses.burn).length; }
ok('灼熱地帯: 毎ラウンド約30%でやけど', burned>15 && burned<50, burned);
({B,boss}=setup('q3_10'));
B.round=2; H.startRound(B);
ok('吹雪: 3ラウンドごとに味方全員のSPD-10', B.party.every(u=>u.buffs.spdDown));
