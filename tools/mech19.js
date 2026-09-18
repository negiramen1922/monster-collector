const load=require('./harness.js');
const api=load('game.js', src => src + `;global.__fn={applyStatus,addShield,strike,hitHp,healUnit,startTurn,endTurn,takeTurn,performAction,shieldTotal,effSpd,effStr,addBuff,startRound,checkBattleEnd,get b(){return battleUI}, selectFoes};`);
const F=global.__fn;
const ok=(name, cond, info)=>console.log((cond?'✅':'❌')+' '+name+(info!==undefined?'  '+JSON.stringify(info):''));
function setup(party, stage){ // start a battle and stop the loop so we can drive it by hand
  const b=api.run([], stage||'q1_01', 1); // dummy to init
  api.STATE=api.DEFAULT_STATE();
  party.forEach(id=>api.STATE.owned[id]={star:api.MON_BY_ID[id].rarity,souls:0,level:10,skillLv:1,ultLv:1,passiveLv:1});
  api.STATE.formationKey='f3'; api.STATE.slots=api.lineupFromList(party,'f3'); api.STATE.clearedStages=api.STAGES.map(s=>s.id); api.STATE.stamina=1e9; api.STATE.daily=null;
  api.startBattle(stage||'q1_01');
  const B=F.b; B.transitioning=false; B.paused=true; return B;
}
const U=(B,id)=>B.party.find(u=>u.ref===id);
// burn: 40% of applier STR, 2 turns, heal -30%, chips shields
let B=setup(['m59','m34','m73','m35','m36']);
let boar=U(B,'m59'), slime=U(B,'m34'), golem=U(B,'m73'), venom=U(B,'m35'), iron=U(B,'m36');
let e=B.enemies[0];
F.applyStatus(e,'burn',boar);
ok('やけど: 付与した側STRの40%', e.statuses.burn.dmg===Math.round(F.effStr(boar)*0.4), [e.statuses.burn.dmg, F.effStr(boar)]);
e.hp=e.maxHp; let hp0=e.hp; F.startTurn(e); F.startTurn(e); F.startTurn(e);
ok('やけど: 2ターンで消える', !e.statuses.burn && hp0-e.hp===2*Math.round(F.effStr(boar)*0.4), hp0-e.hp);
F.applyStatus(slime,'burn',e); slime.hp=50; let g=F.healUnit(slime,slime,100);
ok('やけど中は回復量-30%', g===70, g);
// shields: cap 50%, earliest-expiring first, burn chips shield, poison bypasses
golem.shields=[]; F.addShield(golem, 60, 3, golem); F.addShield(golem, 60, 1, golem); F.addShield(golem, 999, 2, golem);
ok('シールド上限は最大HPの50%', F.shieldTotal(golem)===Math.round(golem.maxHp*0.5), [F.shieldTotal(golem), golem.maxHp]);
ok('シールドは先に切れるものから並ぶ', golem.shields[0].turns===1, golem.shields.map(s=>[s.amt,s.turns]));
let before=golem.hp; F.hitHp(golem, 30, e, {dot:true});
ok('やけどダメージはシールドから削る', golem.hp===before && golem.shields[0].amt===30, golem.shields.map(s=>s.amt));
F.hitHp(golem, 20, e, {direct:true, dot:true});
ok('毒ダメージはシールドを通らない', golem.hp===before-20);
// poison: 2% of max HP per layer, max 5 layers, cap 20% of applier max HP
let tank=e; tank.maxHp=5000; tank.hp=5000; delete tank.statuses.poison;
for(let i=0;i<7;i++) F.applyStatus(tank,'poison',venom);
ok('毒は最大5層', tank.statuses.poison.layers.length===5);
let h=tank.hp; F.startTurn(tank);
ok('毒の上限(付与側の最大HP×20%×層)', h-tank.hp===Math.round(5*venom.maxHp*0.2), [h-tank.hp, 5*venom.maxHp*0.2]);
// iron slime counter & stun
iron.hp=iron.maxHp; let cnt=0; for(let i=0;i<200;i++){ const eh=e.hp=99999; e.maxHp=99999; F.strike({actor:e,act:{atk:'phys'},kind:'normal'}, iron, {pow:0.01}); if(e.hp<eh) cnt++; iron.hp=iron.maxHp; }
ok('帯電ボディ: 物理を受けると約30%で反撃', cnt>30&&cnt<95, cnt);
F.applyStatus(e,'stun',iron); let acted=B.actionCount; e.skillCd=[9]; F.takeTurn(e);
ok('気絶: 行動を1回休んで解ける', !e.statuses.stun);

// holy dragon revive, mandragora revive once / no revive after self-KO, vanish doesn't lose
B=setup(['m113','m10','m126','m54','m118']);
let dragon=U(B,'m113'), mandra=U(B,'m10'), rabbit=U(B,'m126'), titan=U(B,'m54'), tengu=U(B,'m118');
F.hitHp(mandra, 9999, B.enemies[0], {});
ok('マンドラゴラ: 倒れると1度だけHP30%で復活', mandra.alive && mandra.hp===Math.round(mandra.maxHp*0.3), mandra.hp);
F.performAction(mandra,'ult',mandra.ult);
ok('断末魔: 自分は戦闘不能になり復活しない', !mandra.alive);
F.performAction(dragon,'ult',dragon.ult);
ok('ホーリーノヴァ: 倒れた味方をHP30%で蘇生', mandra.alive && mandra.hp===Math.round(mandra.maxHp*0.3));
B.enemies.forEach(x=>{x.alive=true;x.hp=x.maxHp;}); F.performAction(rabbit,'skill',rabbit.kit.skill2);
ok('月面跳躍: 場から消えて狙われない', rabbit.vanished && !F.selectFoes(B.enemies[0],'all').some(x=>x.unit===rabbit));
B.party.filter(u=>u!==rabbit).forEach(u=>{ u.alive=false; }); B.finished=false; F.checkBattleEnd();
ok('離脱中の味方がいれば敗北にならない', !B.finished);
B.party.forEach(u=>{ u.alive=true; u.hp=u.maxHp; }); rabbit.vanished=true; rabbit.flags.returnAct={name:'着地',atk:'phys',tgt:'single',pow:2.8};
B.enemies.forEach(x=>{x.alive=true;x.hp=x.maxHp;}); let dealt0=rabbit.report.dealt; F.startTurn(rabbit);
ok('月面跳躍: 戻ったときに攻撃', !rabbit.vanished && rabbit.report.dealt>dealt0);
// titan redirect
F.performAction(titan,'ult',titan.ult);
let tHp=titan.hp; F.strike({actor:B.enemies[0],act:{atk:'phys'},kind:'normal'}, tengu, {pow:3});
ok('ティターンの城壁: 味方のダメージの一部をタイタンが受ける', titan.hp<tHp, [tHp, titan.hp]);
// tengu first strike
B.enemies.forEach(x=>{x.alive=true;x.hp=x.maxHp;x.spd=999;}); F.performAction(tengu,'ult',tengu.ult); B.round=1; F.startRound(B);
const firstEnemyIdx=B.queue.findIndex(u=>u.isEnemy), lastAllyIdx=Math.max(...B.queue.map((u,i)=>u.isEnemy?-1:i));
ok('天狗風: 次のラウンドは味方が先に全員行動', lastAllyIdx<firstEnemyIdx, B.queue.map(u=>u.isEnemy?'E':'A').join(''));
// tengu spd buff lasts 3 (2 + passive) and self-applied buffs skip the applying turn
B.currentActor=tengu; F.performAction(tengu,'skill',tengu.skills[0]); B.currentActor=null;
ok('追い風: SPDアップは3ターン(山の主)', dragon.buffs.spdUp.turns===3 && dragon.buffs.strUp.turns===2, [dragon.buffs.spdUp.turns, dragon.buffs.strUp.turns]);

// fenrir extra action, raiden drums, kyubi fox fires, moon phases, goblin CT, evade
B=setup(['m68','m125','m116','m40','m70']);
let fen=U(B,'m68'), rai=U(B,'m125'), kyu=U(B,'m116'), sham=U(B,'m40'), jack=U(B,'m70');
B.enemies.forEach(x=>{x.hp=1;});
F.startRound(B); B.queue=B.queue.filter(x=>x!==fen); B.currentActor=fen; F.takeTurn(fen);
ok('疾風の狩人: 倒すと同じラウンドにもう一度行動', B.queue[0]===fen && fen.flags.extraThisRound);
F.performAction(rai,'skill',rai.skills[0]); F.performAction(rai,'skill',rai.skills[0]);
ok('雷鼓の鼓動: スキル2回で太鼓2', rai.stacks.drum===2);
ok('九尾: 戦闘開始時に狐火2', kyu.stacks.fox===2);
ok('部族の祈り: ゴブリン族のCT-1', sham.skillCd[0]===Math.ceil(3/2)-1, sham.skillCd);
let miss=0; for(let i=0;i<1000;i++){ const r=F.strike({actor:B.enemies[0]||fen,act:{atk:'phys'},kind:'normal'}, jack, {pow:0}); jack.hp=jack.maxHp; if(r&&r.miss) miss++; }
ok('幻の兎: 回避率約10%', miss>60&&miss<140, miss);
B=setup(['m126','m21','m03','m06','m14']); rabbit=U(B,'m126');
const phases=[]; for(let i=0;i<4;i++){ F.startTurn(rabbit); phases.push(rabbit.stacks.moon||0); }
ok('月の満ち欠け: 新月→半月→満月→新月', phases.join('')==='0120', phases);
