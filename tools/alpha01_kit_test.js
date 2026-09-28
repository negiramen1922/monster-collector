/* α0.1: 新キャラ30体のキットと、新しい状態異常(麻痺・石化・拘束・混乱・魅了)・
   新デバフ(命中率ダウン・恐慌・呪い・魔法防御ダウン)の回帰テスト。 */
const load=require('./harness.js');
const api=load('game.js', src => src + `;global.__f={applyStatus,strike,hitHp,healUnit,startTurn,takeTurn,performAction,applyDebuff,addBuff,cutOf,effStr,effSpd,effDef,killUnit,shieldTotal,startRound,MONSTER_KITS,ROLE_KITS,RELIC_STAT_LABEL,get b(){return battleUI}};`);
const F=global.__f;
let fails=0;
const ok=(name, cond, info)=>{ if(!cond) fails++; console.log((cond?'✅':'❌')+' '+name+(info!==undefined?'  '+JSON.stringify(info):'')); };
const NEW=[...Array(30)].map((_,i)=>'m'+(136+i));
function setup(party, nEnemies){
  api.run([], 'q1_01', 1);
  const S=api.STATE; S.owned={};
  party.forEach(id=>S.owned[id]={star:Math.max(4,api.MON_BY_ID[id].rarity),souls:0,level:30,exp:0,wall:30,skillLv:1,ultLv:1,passiveLv:1});
  S.formationKey='f2'; S.slots=api.lineupFromList(party,'f2'); S.clearedStages=api.STAGES.map(s=>s.id);
  api.startBattle('q1_01',{skipIntro:true});
  const B=F.b; B.transitioning=false; B.paused=true;
  B.enemies.forEach(e=>{ e.maxHp=e.hp=99999; e.str=60; e.pdef=0; e.mdef=0; e.alive=true; e.buffs={}; e.statuses={}; e.passive={}; });
  B.enemies.slice(nEnemies||1).forEach(e=>{ e.alive=false; });
  return B;
}
const U=(B,id)=>B.party.find(u=>u.ref===id);
const hit=(atk,t,pow,type,act)=>F.strike({actor:atk,act:Object.assign({atk:type||'phys'},act||{}),kind:'normal'}, t, {pow});

// --- データ ---
ok('新キャラ30体がMONSTERSに入っている', NEW.every(id=>api.MON_BY_ID[id]), NEW.filter(id=>!api.MON_BY_ID[id]));
ok('30体すべてに専用キット(通常・スキル1・スキル2・パッシブ・必殺技)がある',
  NEW.every(id=>{ const k=F.MONSTER_KITS[id]; return k && k.normal && k.skill1 && k.skill2 && k.passive && k.passive.name && k.ult && k.ult.sp; }),
  NEW.filter(id=>{ const k=F.MONSTER_KITS[id]; return !(k && k.normal && k.skill1 && k.skill2 && k.passive && k.ult); }));
ok('30体すべてのスキル説明がある', NEW.every(id=>{ const k=F.MONSTER_KITS[id]; return [k.skill1,k.skill2,k.passive,k.ult].every(a=>a.desc); }));
ok('立ち絵の番号がIDと一致', NEW.every(id=>api.MON_BY_ID[id].sprite===id.slice(1)));
const r=n=>api.MONSTERS.filter(m=>NEW.includes(m.id)&&m.rarity===n).length;
ok('★5が6体・★4が11体・★3が13体', r(5)===6&&r(4)===11&&r(3)===13, [r(5),r(4),r(3)]);
ok('遺物の新しいstatに表示名がある', ['cut','critDmg','normalDmg'].every(k=>F.RELIC_STAT_LABEL[k]));

// --- 麻痺・石化 ---
let B=setup(['m156','m142','m138','m150','m164']);
let e=B.enemies[0];
F.applyStatus(e,'paralyze',U(B,'m156'));
let hp0=U(B,'m156').hp; F.takeTurn(e);
ok('麻痺: 次の行動を休んで解ける', !e.statuses.paralyze && e.report.dealt===0);
F.applyStatus(e,'petrify',U(B,'m142'),2);
F.takeTurn(e);
ok('石化: 行動できず、残りターンが減る', e.statuses.petrify && e.statuses.petrify.turns===1 && e.report.dealt===0);
const rp=hit(U(B,'m156'),e,1);
ok('石化: 攻撃を受けると必ず会心になり、その場で解ける', rp.crit && !e.statuses.petrify);
e.buffs.evade={v:1,turns:9}; F.applyStatus(e,'petrify',U(B,'m142'),2);
ok('石化: 回避できない', !hit(U(B,'m156'),e,1).miss); delete e.buffs.evade;

// --- 拘束 ---
B=setup(['m156','m142','m138','m150','m164']); e=B.enemies[0];
const bound=U(B,'m156'); bound.skillCd=bound.skillCd.map(()=>5);
F.applyStatus(bound,'bind',e,2);
const before=B.enemies[0].hp; F.takeTurn(bound);
ok('拘束: スキルがCT中なら通常攻撃もできず休む', B.enemies[0].hp===before && bound.statuses.bind && bound.statuses.bind.turns===1);
bound.skillCd=bound.skillCd.map(()=>0); F.takeTurn(bound);
ok('拘束: スキルは使える', B.enemies[0].hp<before && !bound.statuses.bind);

// --- 混乱・魅了: 攻撃が味方に向く ---
B=setup(['m156','m142','m138','m150','m164']); e=B.enemies[0];
const conf=U(B,'m156'); conf.skillCd=conf.skillCd.map(()=>9);
let turned=0;
for(let i=0;i<60;i++){ F.applyStatus(conf,'confuse',e,1); const t0=B.party.reduce((s,u)=>s+u.hp,0); F.takeTurn(conf); if(B.party.reduce((s,u)=>s+u.hp,0)<t0) turned++; B.party.forEach(u=>{u.hp=u.maxHp;}); }
ok('混乱: 攻撃がおよそ半分の確率で味方に向く', turned>15 && turned<45, turned);
let skipped=0, hurt=0;
for(let i=0;i<60;i++){ F.applyStatus(conf,'charm',e,1); const t0=B.party.reduce((s,u)=>s+u.hp,0); const eh=e.hp; F.takeTurn(conf);
  if(B.party.reduce((s,u)=>s+u.hp,0)<t0) hurt++; else if(e.hp===eh) skipped++; B.party.forEach(u=>{u.hp=u.maxHp;}); }
ok('魅了: 半分は休み、半分は味方を攻撃する(敵は殴らない)', hurt>15 && skipped>15 && hurt+skipped===60, [hurt,skipped]);

// --- デバフ ---
B=setup(['m158','m159','m149','m161','m154']); e=B.enemies[0];
const eos=U(B,'m158'); let miss=0;
F.addBuff(e,'accDown',0.5,9,eos);
for(let i=0;i<200;i++){ if(hit(e,U(B,'m149'),0.01).miss) miss++; }
ok('命中率ダウン: 攻撃側の外れる確率が上がる', miss>70 && miss<130, miss);
delete e.buffs.accDown;
const c0=F.cutOf(e,'phys'); F.addBuff(e,'curse',0.1,2,U(B,'m159'));
ok('呪い: 受けるダメージ+10%', Math.abs(F.cutOf(e,'phys')-(c0-0.1))<1e-9);
const d0=F.effDef(e,'mag'); e.mdef=100; const d1=F.effDef(e,'mag'); F.addBuff(e,'mdefDown',0.25,2,U(B,'m154'));
ok('魔法防御ダウン', Math.abs(F.effDef(e,'mag')-75)<1e-9, F.effDef(e,'mag'));
const nop=U(B,'m161');
ok('のっぺらぼう: 最初の攻撃は必ず回避', hit(e,nop,1).miss && !hit(e,nop,1,'phys',{sureHit:true}).miss);

// --- 個別キット ---
B=setup(['m141','m148','m160','m155','m137']); e=B.enemies[0];
const phx=U(B,'m141');
phx.hp=1; F.applyStatus(phx,'burn',e); F.startTurn(phx);
ok('フェニクス: やけどで倒れると灰になる', phx.alive && phx.vanished && phx.stacks.ash===1);
F.startTurn(phx);
ok('フェニクス: 次のターンにHP50%でよみがえる', phx.alive && !phx.vanished && phx.hp===Math.round(phx.maxHp*0.5));
phx.hp=1; F.hitHp(phx,99,e,{});
ok('フェニクス: やけど以外で倒れたらよみがえらない', !phx.alive);
const per=U(B,'m148'); per.skillCd=[0,9]; per.spd=1;
F.startRound(B);
ok('ペルセウス: 「必ず先制」のスキルが撃てるラウンドは一番先に動く', B.queue[0]===per);
const orp=U(B,'m160'), spi=U(B,'m155'); spi.hp=1; const eh=e.hp;
F.performAction(orp,'normal',orp.normal);
ok('オルペウス: 通常攻撃は味方の回復で、攻撃しない', spi.hp>1 && e.hp===eh);
const lev=U(B,'m137');
F.performAction(lev,'ult',lev.kit.ult);
ok('リヴァイアサン: 必殺技で味方の被ダメージを肩代わり', B.party.filter(u=>u.alive&&u!==lev).every(u=>u.buffs.redirect&&u.buffs.redirect.source===lev));
const lh=lev.hp, ph=per.hp; hit(e,per,1);
ok('肩代わり: 守られている味方のダメージの一部を代わりに受ける', lev.hp<lh);

B=setup(['m165','m146','m163','m150','m161']); e=B.enemies[0];
const death=U(B,'m165'); const s0=F.effStr(death);
F.killUnit(B.enemies[0],death);
ok('死神: 敵を倒すとSTR+10%', Math.abs(F.effStr(death)/s0-1.1)<0.02, F.effStr(death)/s0);
e=B.enemies[1]; e.alive=true;
const ae=U(B,'m146'), sp0=F.effSpd(death);
B.roundFirst=ae; B.round=1; F.startTurn(ae);
ok('アイオロス: ラウンドで一番先に動くと味方全体のSPD+5%', F.effSpd(death)>sp0, [sp0, F.effSpd(death)]);
F.addBuff(e,'strUp',0.3,3,e);
const loki=U(B,'m150'); F.performAction(loki,'skill',loki.kit.skill2,1);
ok('ロキ: 炎の悪戯で相手のバフを消す', !e.buffs.strUp);
F.addBuff(e,'pdefUp',0.3,3,e);
const nop2=U(B,'m161'); F.performAction(nop2,'skill',nop2.kit.skill2,1);
ok('のっぺらぼう: なりすましでバフを奪う', !e.buffs.pdefUp && nop2.buffs.pdefUp);

// --- 全30体で戦闘を回してもエラーが出ない ---
let errs=0, done=0;
for(let rep=0; rep<4; rep++) for(let i=0;i<NEW.length;i+=5){
  const party=NEW.slice(i,i+5);
  try{ const b=api.run(party, ['q1_05','q3_08','q5_03','q7_10'][rep], 60, {star:5,skillLv:5,ultLv:5,passiveLv:5}); if(b.finished) done++; }catch(err){ errs++; console.log(err.stack); }
}
ok('新キャラだけの編成で戦闘が最後まで進む', errs===0 && done===24, [errs, done]);
console.log(fails ? `${fails}件失敗` : 'すべて通過');
