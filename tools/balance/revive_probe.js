/* 蘇生の価値を測る。採点式に蘇生の点を付けるための根拠(redirect_probe.js の蘇生版)。
   サポーター1体(PARTYの先頭)の奥義を差し替えて、勝率と、戦闘が終わったときに倒れている数を比べる。
   - none: 何もしない / heal1〜4: 味方全体を回復(回復量100〜400%。採点は25点×n)
   - rev20〜60: 一番先に倒れた味方1体を蘇生(HP20〜60%)。だれも倒れていなければ空振り
   - hold20〜60: 蘇生。だれも倒れていなければSPを戻す(人が撃つのを待つのに近い)
   - hp15 / hp30: 味方全体を最大HPの15%・30%回復(採点式は3.75点・7.5点と数える)
   - h2 / h2r30 / h2r60: 回復200%だけ / 回復200%＋蘇生30%・60%
   使い方: python3 extract.py のあと
     N=150 LV=200 STAGES=q6_10h node balance/revive_probe.js
   負けが「時間切れ」のステージでは回復も蘇生も差が出ない。全滅で負けるステージを選ぶこと */
process.chdir(require('path').join(__dirname,'..'));
const load=require(require('path').join(__dirname,'..','harness.js'));
const api=load('game.js',s=>s+';global.__k={MONSTER_KITS,reviveUnit,applyEffect,sideOf};');
const K=global.__k;
const N=+(process.env.N||40), LV=+(process.env.LV||200);
const STAGES=(process.env.STAGES||'q6_05h,q6_08h,q7_03h').split(',');
const PARTY=(process.env.PARTY||'ウンディーネ,ミノタウロス,ケルベロス,ベヒモス,サラマンダー').split(',');
const by=Object.fromEntries(api.MONSTERS.map(m=>[m.name,m.id]));
const SUP=by[PARTY[0]]; const ids=PARTY.map(n=>by[n]);
const orig=K.MONSTER_KITS[SUP].ult;
const V={
  none:{run:ctx=>{}},
  heal1:{run:ctx=>K.applyEffect(ctx,{to:'allies',heal:1})},
  heal2:{run:ctx=>K.applyEffect(ctx,{to:'allies',heal:2})},
  heal3:{run:ctx=>K.applyEffect(ctx,{to:'allies',heal:3})},
  heal4:{run:ctx=>K.applyEffect(ctx,{to:'allies',heal:4})},
  hold20:{run:ctx=>rev(ctx,0.2,1)}, hold30:{run:ctx=>rev(ctx,0.3,1)}, hold40:{run:ctx=>rev(ctx,0.4,1)}, hold60:{run:ctx=>rev(ctx,0.6,1)},
  h2:{run:ctx=>K.applyEffect(ctx,{to:'allies',heal:2})},
  hp15:{run:ctx=>K.applyEffect(ctx,{to:'allies',heal:0.15,base:'maxHp'})}, hp30:{run:ctx=>K.applyEffect(ctx,{to:'allies',heal:0.3,base:'maxHp'})},
  h2r30:{run:ctx=>{K.applyEffect(ctx,{to:'allies',heal:2});rev(ctx,0.3);}},
  h2r60:{run:ctx=>{K.applyEffect(ctx,{to:'allies',heal:2});rev(ctx,0.6);}},
  rev20:{run:ctx=>rev(ctx,0.2)}, rev30:{run:ctx=>rev(ctx,0.3)}, rev40:{run:ctx=>rev(ctx,0.4)}, rev60:{run:ctx=>rev(ctx,0.6)},
};
function rev(ctx,r,hold){const u=ctx.actor;const f=K.sideOf(u).filter(a=>!a.alive).sort((a,b)=>a.deathOrder-b.deathOrder)[0]; if(f) K.reviveUnit(f,r,'蘇生した'); else if(hold) u.sp=u.spCost;}
const only=(process.env.V||Object.keys(V).join(',')).split(',');
for(const k of only){
  K.MONSTER_KITS[SUP].ult={...orig,...V[k],effects:undefined,pow:undefined,atk:undefined,tgt:'allies',name:'測定:'+k};
  let w=0,t=0,dead=0,rounds=0;
  for(const sid of STAGES) for(let i=0;i<N;i++){const b=api.run(ids,sid,LV,{star:5,skillLv:10,ultLv:10,passiveLv:5});t++;if(b.win)w++;rounds+=b.round||0;dead+=(b.party||[]).filter(u=>!u.alive).length;}
  console.log(k.padEnd(7),'勝率',(w/t*100).toFixed(0).padStart(3)+'%','  終了時に倒れている数',(dead/t).toFixed(2),'  ラウンド',(rounds/t).toFixed(1));
}
