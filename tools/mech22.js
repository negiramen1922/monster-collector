const load=require('./harness.js');
const api=load('game.js', src => src + `;global.__fn={applyStatus,addShield,strike,hitHp,healUnit,startTurn,takeTurn,performAction,shieldTotal,addBuff,effDef,cutOf,hateOf,killUnit,get b(){return battleUI}};`);
const F=global.__fn;
const ok=(name, cond, info)=>console.log((cond?'✅':'❌')+' '+name+(info!==undefined?'  '+JSON.stringify(info):''));
function setup(party){
  api.run([], 'q1_01', 1);
  api.STATE=api.DEFAULT_STATE();
  party.forEach(id=>api.STATE.owned[id]={star:api.MON_BY_ID[id].rarity,souls:0,level:10,skillLv:1,ultLv:1,passiveLv:1});
  api.STATE.formationKey='f2'; api.STATE.slots=api.lineupFromList(party,'f2'); api.STATE.clearedStages=api.STAGES.map(s=>s.id); api.STATE.stamina=1e9; api.STATE.daily=null;
  api.startBattle('q1_01'); const B=F.b; B.transitioning=false; B.paused=true;
  B.enemies.forEach(e=>{ e.maxHp=e.hp=99999; e.str=60; e.pdef=0; e.mdef=0; });
  B.enemies.slice(1).forEach(e=>{ e.alive=false; });
  return B;
}
const U=(B,id)=>B.party.find(u=>u.ref===id);
const hit=(B,atk,t,pow,type)=>F.strike({actor:atk,act:{atk:type||'phys'},kind:'normal'}, t, {pow});
let B=setup(['m31','m08','m24','m01','m05']);
let sea=U(B,'m31'), harp=U(B,'m08'), wolf=U(B,'m24'), eater=U(B,'m01'), knight=U(B,'m05'), e=B.enemies[0];
sea.hp=Math.round(sea.maxHp*0.55); F.hitHp(sea, Math.round(sea.maxHp*0.1), e, {});
ok('シースライム: HP50%以下で1度だけ30%回復', sea.flags.regrown && sea.hp > sea.maxHp*0.5, [sea.hp, sea.maxHp]);
harp.buffs.evade={v:1,turns:9}; let eh=e.hp; for(let i=0;i<10;i++){ harp.hp=harp.maxHp; hit(B,e,harp,1); }
ok('ハルピュイア: 回避したら反撃', e.hp<eh, eh-e.hp);
delete harp.buffs.evade;
wolf.sp=0; F.performAction(wolf,'ult',wolf.ult);
ok('ワーウルフ: 必殺技(必ず会心×3)でSP+30', wolf.sp===30, wolf.sp);
B.enemies.forEach(x=>{x.alive=true; x.hp=1;}); eater.hp=50; F.performAction(eater,'normal',eater.normal);
ok('マンイーター: 倒すと最大HPの20%回復', eater.hp>50, eater.hp);
knight.hp=Math.round(knight.maxHp*0.35); F.hitHp(knight, Math.round(knight.maxHp*0.1), e, {});
ok('シルバーナイト: HP30%以下で3ターン被ダメ-30%', knight.buffs.cut && knight.buffs.cut.turns===3);

B=setup(['m09','m13','m15','m17','m19']);
let treant=U(B,'m09'), golem=U(B,'m13'), bear=U(B,'m15'), hound=U(B,'m17'), wisp=U(B,'m19'); e=B.enemies[0];
const d0=F.effDef(treant,'phys'); for(let i=0;i<12;i++) F.startTurn(treant);
ok('エルダートレント: 年輪で防御+30%まで', Math.abs(F.effDef(treant,'phys')/d0-1.3)<0.02, (F.effDef(treant,'phys')/d0).toFixed(2));
ok('ロックゴーレム: 最大HPの30%以上の一撃だけ軽減', F.cutOf(golem,'phys',golem.maxHp*0.35) > F.cutOf(golem,'phys',golem.maxHp*0.1)+0.25);
B.actionSerial=100; e.str=5; hit(B,e,bear,1); hit(B,e,bear,1); hit(B,e,bear,1);
ok('グリズリー: 連続攻撃は1回の行動で1回だけ数える', bear.stacks.rage===1, bear.stacks.rage);
B.actionSerial=101; hit(B,e,bear,1);
ok('グリズリー: 次の行動でまた数える', bear.stacks.rage===2);
F.applyStatus(e,'burn',hound); e.statuses.burn.turns=2; for(let i=0;i<4;i++) hit(B,hound,e,0.01);
ok('ヘルハウンド: やけどの残りターン延長(最大4)', e.statuses.burn.turns===4, e.statuses.burn.turns);
bear.hp=bear.maxHp; treant.hp=50; F.killUnit(golem, e);
ok('ブルーウィスプ: 味方が倒れたら全員10%回復', treant.hp>50, treant.hp);

B=setup(['m20','m23','m27','m02','m03']);
let mecha=U(B,'m20'), boar=U(B,'m23'), garg=U(B,'m27'), bat=U(B,'m02'), myco=U(B,'m03'); e=B.enemies[0];
F.applyStatus(mecha,'poison',e); F.applyStatus(mecha,'stun',e); F.applyStatus(mecha,'burn',e);
ok('ダークメカロイド: 毒・気絶は無効、やけどはかかる', !mecha.statuses.poison && !mecha.statuses.stun && !!mecha.statuses.burn);
B.currentActor=null; F.addShield(e, 500, 3, e); F.performAction(mecha,'ult',mecha.ult);
ok('殲滅砲: シールドを消してから攻撃', F.shieldTotal(e)===0);
F.hitHp(boar, 99999, e, {});
ok('スカーボア: 1度だけHP1で耐えてSTR+30%', boar.alive && boar.hp===1 && boar.buffs.strUp);
// α0.1: ガーゴイルは回避型に転換(石像化 → 石翼の舞、夜の番人は回避したら反撃)
B.currentActor=garg; F.performAction(garg,'skill',garg.kit.skill2); B.currentActor=null;
ok('ガーゴイル: 石翼の舞で回避率+40%、この間は受ける物理ダメージ-10%', garg.buffs.evade && garg.buffs.evade.v>=0.4 && F.cutOf(garg,'phys')>=0.1, [garg.buffs.evade && garg.buffs.evade.v, F.cutOf(garg,'phys')]);
garg.buffs.evade={v:1,turns:9}; eh=e.hp; for(let i=0;i<5&&e.hp===eh;i++) hit(B,e,garg,1); // 反撃そのものが外れることがあるので数回
ok('ガーゴイル: 回避すると反撃する', e.hp<eh, eh-e.hp);
const front=B.party.filter(u=>u.row==='front'&&u!==bat).length;
ok('オオコウモリ: 前衛2体以上でHATE-10', front>=2 ? F.hateOf(bat)===Math.max(1,bat.hate-10) : true, [front, bat.hate, F.hateOf(bat)]);
myco.stacks.mycel=3; boar.hp=1; const g=F.healUnit(myco, boar, 100);
ok('マイコニド: エルフ3体で回復量+15%', g===115, g);

B=setup(['m04','m21','m29','m06','m14']);
let archer=U(B,'m04'), gob=U(B,'m21'), rat=U(B,'m29'); e=B.enemies[0];
eh=e.hp; F.hitHp(archer, 99999, e, {});
ok('スケルトン弓兵: 倒れたとき最後の一矢', !archer.alive && B.enemies.some(x=>x.hp<x.maxHp));
e.hp=e.maxHp; const rFull=hit(B,gob,e,1); // normal attack has no full-HP bonus; use the skill
e.hp=e.maxHp; let s1=[]; for(let i=0;i<30;i++){ e.hp=e.maxHp; const c={actor:gob,act:gob.kit.skill2,kind:'skill',hits:[],dealt:0}; F.performAction(gob,'skill',gob.kit.skill2); s1.push(e.maxHp-e.hp); }
let s2=[]; for(let i=0;i<30;i++){ e.hp=e.maxHp-1; F.performAction(gob,'skill',gob.kit.skill2); s2.push(e.maxHp-1-e.hp); }
const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
ok('ゴブリン: HP満タンの敵に不意打ち+50%', avg(s1)/avg(s2)>1.35 && avg(s1)/avg(s2)<1.65, (avg(s1)/avg(s2)).toFixed(2));
eh=e.hp; e.str=60; hit(B,e,rat,1);
ok('ニードルラット: 物理攻撃を受けるとトゲで反撃', e.hp<eh, eh-e.hp);
B.currentActor=null; F.performAction(rat,'ult',rat.ult);
const tank=U(B,'m06'); eh=e.hp; const r=hit(B,e,tank,1);
ok('針山の陣: 味方が受けた物理ダメージの25%を返す', r && Math.abs((eh-e.hp)-Math.round(r.dmg*0.25))<=1, [r&&r.dmg, eh-e.hp]);
eh=e.hp; hit(B,e,tank,1,'mag');
ok('トゲは魔法攻撃では発動しない', e.hp===eh);
