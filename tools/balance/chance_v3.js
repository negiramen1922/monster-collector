const {E,score}=require('./power_lib.js');
const rows=require('./chance_rows.json');
const RANGE={stun:[.2,.3],petrify:[.15,.25],charm:[.2,.3],bind:[.2,.3],confuse:[.25,.35],paralyze:[.3,.4],burn:[.4,.6],poison:[.4,.6],debuff:[.5,.8],followUp:[.4,.6]};
const BUD={CT2:18,CT3:22,CT4:27,CT5:32,SP80:45,SP90:50,SP100:55,SP110:62,SP120:70};
const RF={1:.85,2:.9,3:1,4:1.1,5:1.2};
const AOE=new Set(['all','frontAll','backAll']);
const r5=x=>Math.round(x*20)/20;
const byName=Object.fromEntries(E.MONSTERS.map(m=>[m.name,m]));
const out=[];
for(const x of rows){
  const m=byName[x.name]; const kit=E.MONSTER_KITS[m.id]; const a=kit[x.slot];
  let nc, rule;
  if(x.slot==='ult'){ nc=1; rule='確定'; }
  else if(x.slot==='passive'||x.slot==='normal'){ nc=x.chance; rule='固定'; }
  else { let [lo,hi]=RANGE[x.kind]; if(x.kind==='followUp'&&x.hits>1){lo=.3;hi=.4;}
    let t=AOE.has(x.tgt)?lo:Math.min(hi,Math.max(lo,x.chance));
    if(x.kind==='burn'||x.kind==='poison') t=0.5;           // やけど・毒は基本50%
    if(x.hits>1) t=x.chance;                                 // 多段はヒットごとの確率なので今のまま
    nc=r5(t); rule='固定'; }
  let before=null, after=null, ratioB=null, ratioA=null, budget=null;
  if(a && (x.slot==='skill1'||x.slot==='skill2'||x.slot==='ult')){
    const cost=a.ct?`CT${a.ct}`:`SP${a.sp}`; budget=Math.round(BUD[cost]*RF[m.rarity]);
    before=score(a).p;
    const b=JSON.parse(JSON.stringify(a));
    [...(b.onHit||[]),...(b.effects||[])].forEach(e=>{ if(e.chance!==undefined && Math.abs(e.chance-x.chance)<1e-9) e.chance=nc; });
    after=score(b).p; ratioB=Math.round(before/budget*100); ratioA=Math.round(after/budget*100);
    x.cost=cost; x.manual=!!a.run;
  }
  out.push({...x,nc,rule,before,after,budget,ratioB,ratioA});
}
require('fs').writeFileSync(require('path').join(__dirname,'chance_v3.json'),JSON.stringify(out));
for(const o of out) console.log(o.r,o.name,o.slot,o.skill,o.eff,o.tgt,Math.round((o.chance||0)*100)+'→'+(o.rule==='確定'?'確定':Math.round((o.nc||0)*100)+'%'),o.cost||'',o.before,'→',o.after,'/',o.budget,o.ratioB+'→'+o.ratioA,o.manual?'MANUAL':'');
