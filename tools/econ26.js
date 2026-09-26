const load=require('./harness.js');
const api=load('game.js', src => src + `;global.__e={expToNext,expNeeded,levelUpMonster,breakWall,atWall,levelStop,upgradeSkillLevel,skillCostList,promoteMonster,openRandomBox,openSelectBox,craftMat,collectFacility,upgradeFacility,idleAmount,baseState,dungeonStage,grantDungeonRewards,grantStageRewards,matOpenToday,getItem,addItem,addGold,wallCost,expPotTotal,missionEntries,claimMission,STAGE_BY_ID,findStage,giveSouls,RECRUIT_CHANCE,RECRUIT_CHANCE_RARE,UNLOCK_SOULS,DUP_SOULS,get b(){return battleUI}};`);
const E=global.__e;
const ok=(name, cond, info)=>console.log((cond?'✅':'❌')+' '+name+(info!==undefined?'  '+JSON.stringify(info):''));
// クリア時の「仲間になる」抽選は乱数なので、個数を数える検証のあいだは止める
const recruitRates={...E.RECRUIT_CHANCE};
const rareRates={...E.RECRUIT_CHANCE_RARE};
const setRecruit=on=>{ Object.keys(E.RECRUIT_CHANCE).forEach(k=>{ E.RECRUIT_CHANCE[k]= on?recruitRates[k]:0; });
  Object.keys(E.RECRUIT_CHANCE_RARE).forEach(k=>{ E.RECRUIT_CHANCE_RARE[k]= on?rareRates[k]:0; }); };
setRecruit(false);
const sum=n=>{let t=0; for(let L=1;L<n;L++) t+=E.expToNext(L); return t;};
ok('経験値: Lv100まで約7,500', Math.abs(sum(100)-7526)<30, sum(100));
ok('経験値: Lv200まで約62,000', Math.abs(sum(200)-62417)<200, sum(200));
api.STATE=api.DEFAULT_STATE(); const S=api.STATE; S.clearedStages=[];
const o=S.owned.m06; // ★1 slime
S.items={exp1:2000}; S.gold=0;
E.levelUpMonster('m06','max');
ok('レベル上げ: Lv30の壁で止まる', o.level===30 && E.atWall(o), [o.level]);
E.levelUpMonster('m06',1);
ok('壁の間はレベルが上がらない', o.level===30);
E.breakWall('m06');
ok('ゴールド不足では突破できない', E.atWall(o));
S.gold=100000; E.breakWall('m06');
ok('ゴールドで突破', !E.atWall(o) && S.gold===100000-E.wallCost(30), [S.gold]);
E.levelUpMonster('m06','max');
ok('次の壁(Lv50)まで上がる', o.level===50, o.level);
for(let i=0;i<5;i++){ E.breakWall('m06'); E.levelUpMonster('m06','max'); }
ok('★1の上限はLv50', o.level===50, o.level);
const potBefore=E.expPotTotal();
S.items={exp1:5, exp2:0, exp3:3}; o.level=1; o.exp=0; o.wall=0;
E.levelUpMonster('m06',1);
ok('1レベル分なら小さいポットから使う', S.items.exp3===3 && S.items.exp1===3 && o.level===2, S.items);
S.items={exp3:1}; o.level=2; o.exp=0;
E.levelUpMonster('m06',1);
ok('小さいポットがなければ大きいポットを使い、余りは持ち越す', o.level===3 && o.exp>50, [o.level,o.exp]);
// skills
const m=api.MON_BY_ID.m06;
const list=E.skillCostList(m,'skillLv',1);
ok('スキルLv1→2: 水の欠片I×3・タンクの証I×3', JSON.stringify(list)===JSON.stringify([{key:'el_water_1',n:3},{key:'ro_tank_1',n:3}]), list);
const ult=E.skillCostList(m,'ultLv',9);
ok('必殺技Lv9→10: アモルファスの魂とタンクの証 I18/II8/III3', ult.length===6 && ult[0].key==='sp_amorphous_1' && ult[0].n===18 && ult[5].key==='ro_tank_3', ult);
ok('Lv10→11はTierIV×1', JSON.stringify(E.skillCostList(m,'passiveLv',10))===JSON.stringify([{key:'sp_amorphous_4',n:1},{key:'ro_tank_4',n:1}]));
S.items={el_water_1:3, ro_tank_1:2};
E.upgradeSkillLevel('m06','skillLv');
ok('素材が足りないと強化できない', o.skillLv===1);
E.addItem('ro_tank_1',1); E.upgradeSkillLevel('m06','skillLv');
ok('素材を使ってスキルLv2', o.skillLv===2 && E.getItem('el_water_1')===0 && E.getItem('ro_tank_1')===0);
// promotion
o.souls=10; S.gold=4000; E.promoteMonster('m06');
ok('昇格はゴールド不足だとできない', o.star===1);
S.gold=5000; E.promoteMonster('m06');
ok('昇格でゴールド5,000を消費', o.star===2 && S.gold===0 && o.souls===0);
// boxes
S.items={box_rnd_4:1, box_sel_2:1};
const got=E.openRandomBox(4);
ok('ランダムBOX TierIV: 3個', Object.values(got).reduce((a,b)=>a+b,0)===3 && Object.keys(got).every(k=>k.endsWith('_4')), got);
E.openSelectBox(2,'sp','elf');
ok('選択BOX TierII: 選んだ素材が5個', E.getItem('sp_elf_2')===5 && E.getItem('box_sel_2')===0);
// alchemy
S.items={el_fire_1:23}; S.gold=1000; S.clearedStages=['q2_01'];   // 中級を1つクリア = TierIIが落ちる段階
E.craftMat('el','fire',2,'max');
ok('錬金術: I×23 → II×4(余り3)、ゴールド200×4', E.getItem('el_fire_2')===4 && E.getItem('el_fire_1')===3 && S.gold===200, [E.getItem('el_fire_2'),E.getItem('el_fire_1'),S.gold]);
S.items={el_fire_1:23}; S.gold=1000; S.clearedStages=['q1_01'];   // まだTierIIが落ちない段階の先回りは15個→1個
E.craftMat('el','fire',2,'max');
ok('錬金術の先回り: I×23 → II×1(余り8)', E.getItem('el_fire_2')===1 && E.getItem('el_fire_1')===8, [E.getItem('el_fire_2'),E.getItem('el_fire_1')]);
// facilities
const base=E.baseState();
base.mine.at=Date.now()-48*3600e3; base.mine.carry=0;
ok('鉱山: 最大24時間分', Math.round(E.idleAmount('mine'))===24000, E.idleAmount('mine'));
S.gold=0; E.collectFacility('mine', true);
ok('鉱山の受け取り', S.gold===24000 && E.idleAmount('mine')<1);
S.clearedStages=['q1_03']; base.lab.lv=4; base.lab.at=Date.now()-10*3600e3; base.lab.carry=0; S.items={};
E.collectFacility('lab', true);
ok('研究所Lv4: 10時間でEXP1000 → TierIII×10', E.getItem('exp3')===10, S.items);
S.gold=1e6; base.mine.lv=2; E.upgradeFacility('mine');
ok('施設Lv3は「森の主」クリアまで上げられない', base.mine.lv===2);
S.clearedStages=['q1_03','q1_05','q1_10']; E.upgradeFacility('mine');
ok('施設の強化(Lv3・5万G)', base.mine.lv===3 && S.gold===1e6-50000);
// dungeons: battle + rewards
S.clearedStages=api.STAGES.map(x=>x.id);
for(const kind of ['exp','gold','rune']){
  const b=api.run(['m54','m113','m116','m68','m125'], `dg_${kind}_4`, 120);
  ok(`${kind}ダンジョンLv5: 戦闘が終わり報酬が出る`, b.finished && b.win && b.rewards && (b.rewards.gold>0 || b.rewards.items.length>0 || (b.rewards.runes||[]).length>0), b.rewards && {gold:b.rewards.gold, items:b.rewards.items.length});
}
S.runes=[]; const r=E.grantDungeonRewards(E.dungeonStage('rune',4));
ok('ルーン採掘Lv5: ルーン3個(TierⅤかⅣ)とルーンの粉(素材ダンジョンの置き換え)', r.runes.length===3 && r.runes.every(x=>x.tier===5||x.tier===4) && r.dust>=30 && r.items.length===0, r.runes.map(x=>x.tier));
// main stage: drops, boss soul cap, first clear box
const bb=api.run(['m54','m113','m116','m68','m125'], 'q1_05', 60);
const S2=api.STATE; S2.clearedStages=['tu1','tu2','tu3','q1_01','q1_02','q1_03','q1_04']; S2.daily=null; S2.items={};
const res=E.grantStageRewards(E.STAGE_BY_ID.q1_05, bb.spawned);
ok('ボスステージ初回: 選択BOX TierIIとボスのソウル', E.getItem('box_sel_2')===1 && res.souls.some(x=>x.id==='m60' && x.boss), res.souls.map(x=>x.id));
const bossOnly=bb.spawned.filter(u=>u.boss);
let souls=0; for(let i=0;i<8;i++){ const rr=E.grantStageRewards(E.STAGE_BY_ID.q1_05, bossOnly); souls+=rr.souls.reduce((a,x)=>a+x.n,0); }
ok('ボスのソウルに1日の上限はない(8回で8個)', souls===8, souls);
ok('ボスステージのドロップ(初級: TierI×4だけ・上のTierは出ない)', res.items.filter(x=>/^(el|sp|ro)_/.test(x.key)).reduce((a,x)=>a+x.n,0)===4 && res.items.every(x=>!/^(el|sp|ro)_.*_[2-4]$/.test(x.key)), res.items);

// ---- クリアで仲間になる抽選 ----
setRecruit(true);
const rs=api.STATE; rs.owned={}; rs.pendingSouls={}; rs.daily=null;
const stage=E.STAGE_BY_ID.q1_01;
const kinds=[...new Set(stage.waves.flat().map(e=>e.ref))];
const spawned=stage.waves.flat().map(e=>({ ref:e.ref, rarity:api.MON_BY_ID[e.ref].rarity, boss:!!e.boss, rare:false }));
let joined=0, runs=0;
while(joined<kinds.length && runs<500){
  runs++;
  const r=E.grantStageRewards(stage, spawned);
  joined=kinds.filter(id=>api.STATE.owned[id]).length;
}
ok('クリアで★1が仲間になる(3種そろうまで50周以内)', joined===kinds.length && runs<=50, {runs, joined});
// 所持済みなら重複ぶんはソウルになる
rs.pendingSouls={};
const before=api.STATE.owned[kinds[0]].souls;
let gotSouls=false;
for(let i=0;i<60 && !gotSouls;i++){ E.grantStageRewards(stage, spawned); gotSouls=api.STATE.owned[kinds[0]].souls>before; }
ok('所持済みモンスターの重複はソウルになる', gotSouls, api.STATE.owned[kinds[0]].souls-before);
// 抽選に外れ続けても、ソウルが必要数に届けば確定で仲間になる
setRecruit(false);
rs.owned={}; rs.pendingSouls={};
const need=E.UNLOCK_SOULS[1];
const almost=E.giveSouls(kinds[0], need-1);
const last=E.giveSouls(kinds[0], 1);
ok('ソウルが必要数に届けば確定で仲間になる', !almost.joined && last.joined && !!api.STATE.owned[kinds[0]], { need, progress: almost.progress });
setRecruit(true);
