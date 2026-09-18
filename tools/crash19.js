const api=require('./harness.js')('game.js');
const ids=api.MONSTERS.map(m=>m.id);
let errors=0, battles=0; const errs={};
const stages=api.STAGES.filter(s=>s.tier!=='tu').map(s=>s.id);
for(let rep=0; rep<6; rep++){
  for(const id of ids){
    const others=ids.filter(x=>x!==id).sort(()=>Math.random()-0.5).slice(0,4);
    const st=stages[(rep+ids.indexOf(id))%stages.length];
    try{ const b=api.run([id,...others], st, 30, {star:5, skillLv:5, ultLv:5, passiveLv:5}); battles++;
      if(!b.finished) { errs['unfinished '+id]=(errs['unfinished '+id]||0)+1; }
      [...b.party,...b.spawned].forEach(u=>{ if(!Number.isFinite(u.hp)) errs['NaN hp '+u.ref]=(errs['NaN hp '+u.ref]||0)+1; });
    }catch(e){ errors++; const k=(e.message||e)+' @'+id; errs[k]=(errs[k]||0)+1; }
  }
}
console.log('battles', battles, 'errors', errors); console.log(errs);
