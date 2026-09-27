process.chdir(require('path').join(__dirname,'..'));
const load=require(''+require('path').join(__dirname,'..','harness.js')+'');
const api=load('game.js',s=>s+';global.__e={MONSTER_KITS,MONSTERS,STATUS_LABEL,BUFF_LABEL};');
const E=global.__e;
// ---- パワーの係数(1点 = 単体に威力10%を当てるくらい) ----
const TF={single:1,any:1,back:1,lowestAny:1,column:1.5,random:1,frontAll:1.8,backAll:1.8,all:2.5,self:1,allies:2.5,allyLowest:1,allyGuard:1,allyTop:1,allyOther:1};
const ST={stun:[12,1],petrify:[12,2],paralyze:[8,1],bind:[10,2],confuse:[9,1],charm:[11,1],burn:[4,2],poison:[1.5,5]};  // [1ターンの点, 標準ターン]
const BD={strUp:2,strDown:2,spdUp:2,spdDown:2,pdefUp:1.5,pdefDown:1.5,mdefUp:1.5,mdefDown:1.5,critUp:1.5,evade:2,cut:2.5,vuln:2.5,accDown:2,healCut:1,regen:3,thorns:1.5,panic:2,curse:2};  // 10%・1ターンあたり
function effPts(e, tf){
  let p=0, parts=[];
  const ch=e.chance!==undefined?e.chance:1;
  if(e.st){ const [w,t0]=ST[e.st]||[5,1]; const t=e.turns||t0; p+=w*t*ch*tf; parts.push(`${E.STATUS_LABEL[e.st]}${Math.round(ch*100)}%×${t}T`); }
  const b=e.debuff||e.buff;
  if(b){ const w=BD[b]; if(w!==undefined){ const amt=e.flat?e.v/10:(e.v||0)*10; const t=e.turns||2; p+=w*amt*t*ch*tf; parts.push(`${E.BUFF_LABEL[b]}${e.flat?e.v:Math.round((e.v||0)*100)+'%'}×${t}T${ch<1?`(${Math.round(ch*100)}%)`:''}`);} else if(b==='taunt'){p+=6*(e.turns||2);} }
  if(e.heal){ p+=e.heal*10*tf; parts.push(`回復${Math.round(e.heal*100)}%`); }
  if(e.shield){ p+=e.shield*10*tf*1.2; parts.push(`シールド${Math.round(e.shield*100)}%`); }
  if(e.taunt){ p+=6*e.taunt; parts.push(`挑発${e.taunt}T`); }
  if(e.redirect){ p+=12*(e.turns||3)/3*e.redirect/0.3; parts.push('肩代わり'); }
  if(e.cleanse||e.cleanseDebuff){ p+=5*tf; parts.push('解除'); }
  if(e.ward){ p+=6; parts.push('免疫'); }
  if(e.immune){ p+=8; }
  if(e.drain){ p+=e.drain/10*2*tf; parts.push(`SP-${e.drain}`); }
  if(e.followUp){ p+=6*ch*tf; parts.push(`追撃${ch<1?Math.round(ch*100)+'%':''}`); }
  if(e.dispel){ p+=6*ch*tf; parts.push('強化解除'); }
  if(e.spGain){ p+=e.spGain/10*2*tf; }
  return [p,parts];
}
function score(a){
  const tf=TF[a.tgt]||1; let p=0, parts=[], manual=!!a.run;
  if(a.pow){ const h=a.hits||1; const d=a.pow*h*10*tf*(a.tgt==='random'?1:1); p+=d; parts.push(`威力${Math.round(a.pow*100)}%${h>1?'×'+h:''}`); }
  if(a.lifesteal) p+=a.pow*(a.hits||1)*10*tf*a.lifesteal*0.5;
  (a.onHit||[]).forEach(e=>{ const [q,pp]=effPts(e,tf*(a.hits&&e.chance!==undefined?a.hits:1)); p+=q; parts.push(...pp); });
  (a.effects||[]).forEach(e=>{ const [q,pp]=effPts(e,TF[e.to||a.tgt]||1); p+=q; parts.push(...pp); });
  if(a.bonusIf||a.extraIf||a.hitMult||a.defIgnore||a.critBonus) { p*=1.1; }
  return {p:Math.round(p), parts, manual};
}
module.exports={E,score};
