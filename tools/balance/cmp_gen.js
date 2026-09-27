const {E:E0,score}=require('./power_lib.js');
const load=require(''+require('path').join(__dirname,'..','harness.js')+'');
load('game.js',s=>s+';global.__f={MONSTER_KITS,MONSTERS,STATUS_LABEL,BUFF_LABEL,NEW_STATUS_TURNS,BURN_TURNS,POISON_TURNS,ELEM_LABEL:typeof ELEM_LABEL!=="undefined"?ELEM_LABEL:null,ROLE_LABEL:typeof ROLE_LABEL!=="undefined"?ROLE_LABEL:null};');
const F=global.__f;
const v3=require(require('path').join(__dirname,'chance_v3.json'));
const propMap={}; v3.forEach(x=>{ propMap[`${x.name}|${x.slot}|${x.skill}|${x.chance}`]=x.nc; });
const LVS=[1,10,12]; const sc=lv=>1+(lv-1)*0.05; const cap=v=>Math.min(0.8,v);
const BUD={CT2:18,CT3:22,CT4:27,CT5:32,SP80:45,SP90:50,SP100:55,SP110:62,SP120:70};
const RF={1:.85,2:.9,3:1,4:1.1,5:1.2};
const pct=v=>`${Math.round(v*1000)/10}%`.replace('.0%','%');
const FIXED_BUFF=new Set(['taunt','redirect','immune','ward','statue','foxDouble','moonLock','panic','curse']);
const LOCK=new Set(['stun','paralyze','bind','confuse','petrify','charm']);
const stTurns=(st,t)=>t|| (st==='burn'?F.BURN_TURNS: st==='poison'?F.POISON_TURNS: st==='stun'?1: F.NEW_STATUS_TURNS[st]||1);
// 提案の持続時間: 味方の数値バフ Lv5/Lv10で+1, 弱体化・やけど毒 Lv10で+1, 上限5
const durProp=(cat,t,lv)=>{ if(cat==='ally') return Math.min(5,t+(lv>=5?1:0)+(lv>=10?1:0)); if(cat==='debuff'||cat==='dot') return Math.min(5,t+(lv>=10?1:0)); return t; };
function item(label,cur,prop,note){ // cur/prop: fn(lv)->string
  const o={label,cur:LVS.map(cur),prop:LVS.map(prop)}; if(note) o.note=note; return o; }
const same=f=>f;
const ADD_ULT={'ミノタウロス':{mode:'all',txt:'確定・1回（対象）'},'ジャッカロープ':{mode:'all',txt:'確定・1回（最後に当たった敵）'},'キョンシー':{mode:'one',txt:'確定・1回（HPが一番高い敵）'},'キラービー':{mode:'one',txt:'確定・1回（最後に当たった敵）'}};
function actItems(m,slot,a){
  const kind=slot==='ult'?'ult':slot==='normal'?'normal':'skill';
  const scal=lv=>kind==='normal'?1:sc(lv);           // 威力
  const rscal=lv=>sc(lv);                            // 付与率・量(通常攻撃の付与はスキル1Lvで伸びる)
  const its=[];
  if(a.ct) its.push(item('CT',()=>`${a.ct}`,()=>`${a.ct}`));
  if(a.sp) its.push(item('必要SP',()=>`${a.sp}`,()=>`${a.sp}`));
  if(a.pow!=null){ const h=a.hits>1?`×${a.hits}`:''; const f=lv=>pct(a.pow*scal(lv))+h; its.push(item('威力',f,f)); }
  if(a.lifesteal){ const f=lv=>pct(cap(a.lifesteal*sc(lv))); its.push(item('吸収',f,f)); }
  const eff=(e,onHit)=>{
    const who=e.to==='foes'?'敵全体':e.to==='foe'?'敵':e.to==='self'?'自分':e.to==='allies'?'味方全体':e.to&&String(e.to).startsWith('ally')?'味方':onHit?'':'';
    const chKey=e.chance!==undefined?'chance':e.stChance!==undefined?'stChance':null;
    const labelBase=e.st?F.STATUS_LABEL[e.st]:e.debuff?F.BUFF_LABEL[e.debuff]:e.buff?F.BUFF_LABEL[e.buff]:e.followUp?'追撃':e.heal?'回復':e.shield?'シールド':e.taunt?'挑発':e.drain?'SP減少':e.dispel?'強化解除':e.steal?'強化奪取':e.redirect?'肩代わり':e.ward?'免疫':e.immune?'状態異常無効':e.cleanse||e.cleanseDebuff?'解除':e.spGain?'SP増加':e.firstStrike?'先制':'効果';
    if(chKey){ const c=e[chKey]; const scaled=onHit||chKey==='stChance';
      let pc = kind==='ult'?1: (propMap[`${m.name}|${slot}|${a.name}|${c}`] ?? c);
      its.push(item(`${labelBase}の確率`,lv=>pct(scaled?cap(c*rscal(lv)):c),()=>pct(pc), kind==='ult'&&pc!==c?'必殺技は確定':undefined)); }
    if(e.st){ const t=stTurns(e.st,e.turns); const cat=LOCK.has(e.st)?'lock':(e.st==='burn'||e.st==='poison')?'dot':'lock';
      const unit=e.st==='stun'?'回':'T';
      its.push(item(`${labelBase}${who?'（'+who+'）':''}の長さ`,()=>`${t}${unit}`,lv=>`${durProp(cat,t,lv)}${unit}`)); }
    const bkey=e.debuff||e.buff;
    if(bkey){ const down=!!e.debuff||e.to==='foes'||e.to==='foe'||/Down$|vuln|healCut/.test(bkey);
      const amt=lv=> e.flat?`${e.v}`: e.v===1&&FIXED_BUFF.has(bkey)?'—': (e.spdPct?'SPDの':'')+pct(cap(e.v*rscal(lv)));
      if(!(e.v===1&&FIXED_BUFF.has(bkey))) its.push(item(`${F.BUFF_LABEL[bkey]||bkey}${who?'（'+who+'）':''}の量`,amt,amt));
      const t=e.turns||2; const cat=FIXED_BUFF.has(bkey)?'fixed':down?'debuff':'ally';
      its.push(item(`${F.BUFF_LABEL[bkey]||bkey}の長さ`,()=>`${t}T`,lv=>`${durProp(cat,t,lv)}T`)); }
    if(e.heal){ const f=e.base==='maxHp'?()=>`最大HPの${pct(e.heal)}`:lv=>`STRの${pct(e.heal*sc(lv))}`; its.push(item(`回復${who?'（'+who+'）':''}`,f,f)); }
    if(e.shield){ const b=e.base==='maxHp'?'最大HP':e.base==='casterMaxHp'?'自分の最大HP':'STR'; const f=lv=>`${b}の${pct(e.shield*sc(lv))}`; its.push(item(`シールド${who?'（'+who+'）':''}`,f,f)); const t=e.turns||2; its.push(item('シールドの長さ',()=>`${t}T`,()=>`${t}T`)); }
    if(e.taunt) its.push(item('挑発の長さ',()=>`${e.taunt}T`,()=>`${e.taunt}T`));
    if(e.ward) its.push(item('免疫の長さ',()=>`${e.ward}T`,()=>`${e.ward}T`));
    if(e.immune) its.push(item('状態異常無効の長さ',()=>`${e.immune}T`,()=>`${e.immune}T`));
    if(e.redirect){ const t=e.turns||3; its.push(item('肩代わりの割合',()=>pct(e.redirect),()=>pct(e.redirect))); its.push(item('肩代わりの長さ',()=>`${t}T`,()=>`${t}T`)); }
    if(e.drain) its.push(item('SP減少',()=>`${e.drain}`,()=>`${e.drain}`));
    if(e.spGain) its.push(item('SP増加',()=>`${e.spGain}`,()=>`${e.spGain}`));
    if(e.followUp && !chKey) its.push(item('追撃',()=>'確定',()=>'確定'));
  };
  (a.onHit||[]).forEach(e=>eff(e,true));
  (a.effects||[]).forEach(e=>eff(e,false));
  if(a.run){ const s=a.run.toString(); const re=/sv\(\s*[\w.]+\s*,\s*([\d.]+)\s*,\s*'(\w+)'\s*\)/g; let x,i=0; const seen=new Set();
    while((x=re.exec(s))){ const v=+x[1]; if(seen.has(v)) continue; seen.add(v); i++; const pre=s.slice(Math.max(0,x.index-40),x.index); const capd=/capRatio\($/.test(pre.trim());
      const flat=/Sp\(|sp \+/.test(pre); const f=lv=>flat?`${Math.round(v*sc(lv))}`:pct(capd?cap(v*sc(lv)):v*sc(lv)); its.push(item(`説明文の数値${i}`,f,f,'Lvで伸びる数値')); }
    if(!its.some(i=>i.label.startsWith('説明文'))) its.push(item('特殊な処理',()=>'Lvで変わらない',()=>'Lvで変わらない','説明文の数値のまま'));
    const cr=/chance\(\s*([\d.]+)\s*\)/g; while((x=cr.exec(s))){ const v=+x[1]; its.push(item('特殊な確率',()=>pct(v),()=>pct(kind==='ult'?1:v),kind==='ult'?'必殺技は確定':undefined)); }
  }
  const add=slot==='ult'&&ADD_ULT[m.name];
  if(add) its.push(item('気絶（案で追加）',()=>'—',()=>add.txt,'スキルの気絶を必殺技にも'));
  let power=null;
  if((slot==='skill1'||slot==='skill2'||slot==='ult')&&!a.run){ const cost=a.ct?`CT${a.ct}`:`SP${a.sp}`; const bud=Math.round(BUD[cost]*RF[m.rarity]);
    const b=JSON.parse(JSON.stringify(a)); [...(b.onHit||[]),...(b.effects||[])].forEach(e=>{ if(e.chance!==undefined) e.chance= slot==='ult'?1:(propMap[`${m.name}|${slot}|${a.name}|${e.chance}`]??e.chance); });
    if(add){ if(add.mode==='all') b.onHit=(b.onHit||[]).concat([{st:'stun'}]); else b.effects=(b.effects||[]).concat([{st:'stun',to:'foe'}]); }
    power={cur:Math.round(score(a).p/bud*100),prop:Math.round(score(b).p/bud*100)}; }
  return {its,power};
}
const HOOK={cutBonus:'被ダメージ軽減',defBonus:'防御アップ',evadeBonus:'回避率アップ',strBonus:'STRアップ',dmgBonus:'与ダメージアップ',healBonus:'回復量アップ',critBonus:'会心率アップ',thornsBonus:'トゲ',onKill:'撃破時',onDamaged:'被弾時',onHitBy:'攻撃を受けたとき',onTurnStart:'ターン開始時',onTurnEnd:'ターン終了時',onBattleStart:'戦闘開始時',onDeath:'倒れたとき',onAllyDeath:'味方が倒れたとき',onCrit:'会心時',survive:'踏みとどまり',healRecvBonus:'受ける回復アップ',allySpdAura:'味方のSPD',statusChanceBonus:'状態異常の付与率',pierceBonus:'防御無視',critTakenCut:'被会心軽減',onHitTarget:'攻撃が当たったとき'};
function passiveItems(p){
  const its=[];
  for(const [k,fn] of Object.entries(p)){ if(typeof fn!=='function') continue; const s=fn.toString(); const re=/pv\(\s*\w+\s*,\s*([\d.]+)\s*\)/g; let x;
    while((x=re.exec(s))){ const v=+x[1]; const pre=s.slice(Math.max(0,x.index-30),x.index); const isCh=/chance\(capRatio\($/.test(pre.replace(/\s+/g,''))||k==='statusChanceBonus';
      const capd=/capRatio\($/.test(pre.replace(/\s+/g,''));
      const isPow=/pow:\s*$/.test(pre); const isFlat=v>=5;
      const disp=val=> isFlat?`${Math.round(val)}`: pct(capd?cap(val):val);
      const ev=/^(on|survive)/.test(k);
      const lab=(HOOK[k]||k)+(isCh?'の確率':isPow?'の威力':isFlat?'（SP）':ev?'の効果量':'');
      if(isCh) its.push(item(lab,lv=>disp(v*sc(lv)),()=>disp(v),'確率はLvで変えない'));
      else its.push(item(lab,lv=>disp(v*sc(lv)),lv=>disp(v*sc(lv)))); } }
  for(const [k,fn] of Object.entries(p)){ if(typeof fn!=='function') continue; const r=/chance\(\s*([\d.]+)\s*\)/g; let x; while((x=r.exec(fn.toString()))){ const v=+x[1]; its.unshift(item((HOOK[k]||k)+'の確率',()=>pct(v),()=>pct(v))); } }
  if(!its.length) its.push(item('効果',()=>'Lvで変わらない',()=>'Lvで変わらない'));
  return its;
}
const out=[];
for(const m of F.MONSTERS){ const k=F.MONSTER_KITS[m.id]; const acts=[];
  for(const slot of ['normal','skill1','skill2','ult']){ const a=k[slot]; if(!a) continue; const r=actItems(m,slot,a);
    acts.push({slot,name:a.name,desc:a.desc,run:!!a.run,items:r.its,power:r.power}); }
  acts.splice(3,0,{slot:'passive',name:k.passive.name,desc:k.passive.desc,items:passiveItems(k.passive)});
  const flags=[]; const num=v=>parseFloat(v);
  if(ADD_ULT[m.name]) flags.push({k:'add',t:'必殺技に気絶を追加'});
  acts.forEach(a=>{ if(!a.power) return; const nm=a.name;
    const healish=a.items.some(i=>/^回復|^シールド/.test(i.label));
    if(a.power.prop>=140&&!healish) flags.push({k:'over',t:`${nm}がパワー予算の${a.power.prop}%`});
    if(a.slot==='ult'&&a.power.prop-a.power.cur>=30) flags.push({k:'ultup',t:`${nm}が大きく強化（${a.power.cur}%→${a.power.prop}%）`}); });
  acts.forEach(a=>a.items.forEach(i=>{ if(/の確率$/.test(i.label)&&num(i.cur[2])-num(i.prop[2])>=20) flags.push({k:'drop',t:`${a.name}の${i.label.replace('の確率','')}がLv12で${i.cur[2]}→${i.prop[2]}`}); }));
  out.push({flags,id:m.id,name:m.name,r:m.rarity,el:m.element,role:m.role,acts}); }
require('fs').writeFileSync(require('path').join(__dirname,'cmp_data.json'),JSON.stringify(out));
let n=0,ch=0; out.forEach(m=>m.acts.forEach(a=>a.items.forEach(i=>{n++; if(i.cur.join()!==i.prop.join()) ch++;})));
console.log(out.length,'mons',n,'items',ch,'changed');
