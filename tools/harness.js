// shared harness for engine v3
const fs=require('fs');
const mons=fs.readFileSync(__dirname+'/mons.json','utf8');
const el=()=>({style:{setProperty(){}},offsetWidth:0,setAttribute(){},innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){},contains(){return false}},querySelector:()=>el(),addEventListener(){},scrollTop:0,scrollHeight:0,dataset:{}});
global.document={getElementById:(id)=>{ if(id==='sprite-data'||id==='icon-data'||id==='sfx-data'||id==='bgm-data')return{textContent:'{}'}; if(id==='monster-data')return{textContent:mons}; return el();},querySelectorAll:()=>[],querySelector:()=>null};
global.window={storage:{get:async()=>null,set:async()=>null},matchMedia:()=>({matches:true})};
let q=[];global.setTimeout=(f)=>{const t={f};q.push(t);return t};global.clearTimeout=(t)=>{if(t)t.f=null};
module.exports=function load(file, extra){
  let src=fs.readFileSync(file,'utf8');
  if(extra) src=extra(src);
  src+=';global.__api={get STATE(){return STATE},set STATE(v){STATE=v},startBattle,get battleUI(){return battleUI},DEFAULT_STATE,lineupFromList,formationForFrontCount,MONSTERS,MON_BY_ID,isMeleeRole,STAGES,toggleReserve};';
  eval(src);
  render=()=>{}; saveState=()=>{}; toast=()=>{};
  const api=global.__api;
  api.run=(party, stage, lv, opts)=>{
    const o=opts||{};
    api.STATE=api.DEFAULT_STATE();
    party.forEach(id=>api.STATE.owned[id]={star:o.star||api.MON_BY_ID[id].rarity,souls:0,level:lv,skillLv:o.skillLv||1,ultLv:o.ultLv||1,passiveLv:o.passiveLv||1});
    const fk=api.formationForFrontCount(Math.max(1,party.filter(id=>api.isMeleeRole(api.MON_BY_ID[id].role)).length)).key;
    api.STATE.formationKey=fk; api.STATE.slots=api.lineupFromList(party,fk); api.STATE.autoUlt=true;
    api.STATE.clearedStages=api.STAGES.map(s=>s.id); api.STATE.stamina=1e9; api.STATE.daily=null;
    q=[]; api.startBattle(stage, { skipIntro: true });
    let n=0; while(q.length&&n<10000){const t=q.shift(); if(t.f){t.f();n++;} if(api.battleUI.finished)break;}
    return api.battleUI;
  };
  return api;
};
