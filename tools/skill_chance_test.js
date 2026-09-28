// 付与率と持続時間の見直し(α0.1.072): 付与率はスキルLvで変わらない・必殺技は確定・持続はLv5/Lv10で伸びる
const assert=require('assert');
const load=require('./harness.js');
load('game.js',s=>s+';global.__e={MONSTER_KITS,MONSTERS,grownTurns,durationBonus,statusTurns,applyRider,applyEffect,skillUpgradePreviewLines,DURATION_CAP,BURN_TURNS};');
const E=global.__e; let pass=0; const ok=(c,m)=>{assert.ok(c,m);pass++;};
const byName=Object.fromEntries(E.MONSTERS.map(m=>[m.name,m]));
const kit=n=>E.MONSTER_KITS[byName[n].id];
// 必殺技の付与はすべて確定
for(const m of E.MONSTERS){ const u=E.MONSTER_KITS[m.id].ult; [...(u.onHit||[]),...(u.effects||[])].forEach(e=>ok(e.chance===undefined&&e.stChance===undefined,`${m.name}の必殺技に確率が残っている`)); }
// やけど・毒のスキルは基本50%(多段技はヒットごとの確率なので除く)
for(const m of E.MONSTERS){ for(const s of ['skill1','skill2']){ const a=E.MONSTER_KITS[m.id][s]; if(!a||(a.hits||1)>1) continue;
  (a.onHit||[]).filter(e=>(e.st==='burn'||e.st==='poison')&&e.chance!==undefined).forEach(e=>ok(e.chance===0.5,`${m.name} ${a.name} ${e.chance}`)); } }
ok(kit('ケルベロス').skill1.onHit.find(e=>e.st==='burn').chance===0.3,'多段のやけどは今のまま');
ok(kit('メデューサ').skill1.onHit[0].chance===0.25 && kit('タイタン').skill2.onHit.find(e=>e.st==='stun').chance===0.2,'全体・石化は目安に合わせる');
// 付与率はLvで変わらない(エンジンもパッシブも)
ok(!E.applyRider.toString().includes('sv(actor, e.chance'),'applyRider');
ok(!E.applyEffect.toString().includes('sv(actor, e.stChance'),'applyEffect');
for(const m of E.MONSTERS){ const p=E.MONSTER_KITS[m.id].passive; Object.values(p).filter(v=>typeof v==='function').forEach(f=>ok(!/chance\(capRatio\(pv\(/.test(f.toString()),`${m.name}のパッシブ確率`)); }
// 必殺技に気絶を追加した4体
ok(kit('ミノタウロス').ult.onHit.some(e=>e.st==='stun'),'ミノタウロス');
ok(kit('ジャッカロープ').ult.onHit.some(e=>e.st==='stun'),'ジャッカロープ');
ok(kit('キョンシー').ult.effects.some(e=>e.st==='stun'&&e.to==='foeTopHp'),'キョンシー');
ok(kit('キラービー').ult.effects.some(e=>e.st==='stun'&&e.to==='foeLastHit'),'キラービー');
// 持続時間
const U=lv=>({skillLv:lv,ultLv:lv});
ok(E.grownTurns(U(1),'skill',2,'ally')===2 && E.grownTurns(U(5),'skill',2,'ally')===3 && E.grownTurns(U(10),'skill',2,'ally')===4,'味方バフ');
ok(E.grownTurns(U(12),'ult',4,'ally')===5,'上限5');
ok(E.grownTurns(U(12),'ult',6,'ally')===6,'もともと5超えはそのまま');
ok(E.grownTurns(U(9),'skill',2,'debuff')===2 && E.grownTurns(U(10),'skill',2,'debuff')===3,'弱体化はLv10');
ok(E.grownTurns(U(12),'skill',2,'fixed')===2 && E.grownTurns(U(12),'normal',2,'ally')===2 && E.grownTurns(U(12),'passive',2,'ally')===2,'伸びないもの');
ok(E.statusTurns(U(10),'skill',{st:'burn'})===E.BURN_TURNS+1 && E.statusTurns(U(12),'skill',{st:'stun'})===undefined && E.statusTurns(U(12),'skill',{st:'petrify',turns:2})===2,'状態異常');
// 強化プレビューに持続の行が出る(伸びるLvのときだけ)
const tr=byName['トレント']; const l4=E.skillUpgradePreviewLines(tr,'ultLv',4); const l5=E.skillUpgradePreviewLines(tr,'ultLv',5);
ok(l4.some(l=>l.unit==='ターン'&&l.before===2&&l.after===3),'Lv4→5で持続+1');
ok(!l5.some(l=>l.unit==='ターン'),'Lv5→6は持続変わらない');
console.log(`skill_chance_test: ${pass} passed`);
