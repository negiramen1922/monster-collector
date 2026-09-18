const load=require('./harness.js');
const api=load('game.js', src => src.replace(/const RARE_SPAWN_PER_WAVE = [\d.]+;/, 'const RARE_SPAWN_PER_WAVE = 0;') +
  `;global.__d={spawnWave, waveFormationOf, setB:(v)=>{battleUI=v}, QUEST_TIERS_ACTIVE, TERRAIN, GIMMICKS, ELEM_LABEL, ROLE_LABEL, SPECIES_LABEL, MAT_FAMILIES, itemName, rankRoundLimit, TIER_LABEL, STAGE_BY_ID};`);
const D=global.__d;
const L=[];
const star=n=>'★'.repeat(n);
const reward=r=>r.type==='item'?`${D.itemName(r.key)}×${r.n}`:r.type==='gold'?`${r.n.toLocaleString()}ゴールド`:r.type==='crystal'?`結晶${r.n}`:JSON.stringify(r);
L.push('# クエスト全ステージ一覧(33ステージ)','',
'ゲームのデータから書き出した一覧です。レア出現は含めない、通常時の構成です。','',
'- **位置:** 敵の陣形で決まる前衛・後衛の並びです(「前衛1」は前衛の左から1番目)',
'- **★:** その敵の★(昇格を含む)です。モンスター本来の★と違う場合は、「★2(本来★1)」のように示します',
'- **HP・STR:** 実際の戦闘で使う値です(陣形ボーナス込み)',
'- **★3の条件:** 味方が1体も倒れず、ウェーブ数×4ラウンド以内にクリアすることです','');
L.push('## 一覧','','| No. | ステージ | 地形 | 属性 | 推奨Lv | 敵Lv | 敵の★ | ボス |','|---|---|---|---|---|---|---|---|');
for(const st of api.STAGES){
  const all=st.waves.flat(); const nb=all.filter(e=>!e.boss); const b=all.find(e=>e.boss);
  const no=st.tier==='tu'?`T${st.no}`:`${D.QUEST_TIERS_ACTIVE.find(t=>t.key===st.tier).label}${st.no}`;
  const lvs=nb.map(e=>e.level);
  L.push(`| ${no} | ${st.name} | ${D.TERRAIN[st.terrain].label} | ${D.ELEM_LABEL[st.element]} | ${st.rec} | ${Math.min(...lvs)}〜${Math.max(...lvs)} | ★${Math.min(...nb.map(e=>e.star))}〜★${Math.max(...nb.map(e=>e.star))} | ${b?`${api.MON_BY_ID[b.ref].name} Lv${b.level} ★${b.star}`:'―'} |`);
}
L.push('');
for(const tier of D.QUEST_TIERS_ACTIVE){
  L.push(`## ${tier.label}(推奨Lv${tier.lv[0]}〜${tier.lv[1]})`,'');
  for(const st of api.STAGES.filter(s=>s.tier===tier.key)){
    const no=st.tier==='tu'?`T${st.no}`:`${tier.label}${st.no}`;
    L.push(`### ${no}「${st.name}」${st.boss?'【BOSS】':''}`,'');
    L.push(`- **地形・属性:** ${D.TERRAIN[st.terrain].label}・${D.ELEM_LABEL[st.element]}属性が多い`);
    L.push(`- **推奨Lv:** ${st.rec}　**スタミナ:** ${st.stamina}　**★3の条件:** ${D.rankRoundLimit(st)}ラウンド以内`);
    if(st.gimmick) L.push(`- **ボスの仕掛け「${D.GIMMICKS[st.gimmick].name}」:** ${D.GIMMICKS[st.gimmick].desc}`);
    if(st.rares) L.push(`- **レア出現(各ウェーブ5%):** ${st.rares.map(id=>`${api.MON_BY_ID[id].name}(${star(api.MON_BY_ID[id].rarity)})`).join('、')}`);
    const first=[`結晶${st.firstClear}`, ...[...(st.bossReward||[]), ...(st.reward||[])].map(reward)];
    L.push(`- **初回クリア:** ${first.join('、')}`);
    L.push(`- **毎回の報酬:** ${st.gold.toLocaleString()}ゴールド、${Object.entries(st.pots).map(([k,n])=>`${D.itemName(k)}×${n}`).join('、')}`);
    if(st.drops){
      const tiers=st.drops.tiers.map((n,i)=>n?`Tier${D.TIER_LABEL[i+1]}×${n}`:'').filter(Boolean).join('・');
      L.push(`- **素材ドロップ(${tiers}):** ${st.drops.kinds.map(([f,k])=>D.MAT_FAMILIES[f].name(k)).join('、')}`);
    }
    L.push('');
    st.waves.forEach((w,wi)=>{
      D.setB({fxEvents:[], log:[], round:0, currentActor:null, enemies:[], party:[]});
      const f=D.waveFormationOf(st, wi);
      const units=D.spawnWave(st, wi).sort((a,b)=>(a.row===b.row?0:a.row==='front'?-1:1) || a.x-b.x);
      L.push(`**ウェーブ${wi+1}**(敵の陣形:${f.name})`,'');
      L.push('| 位置 | モンスター | ★ | Lv | 属性 | ロール | HP | STR |','|---|---|---|---|---|---|---|---|');
      const rowIdx={front:0, back:0};
      units.forEach(u=>{
        const m=api.MON_BY_ID[u.ref];
        const e=w.find(x=>x.ref===u.ref && (x.boss||false)===u.boss) || {};
        const col=++rowIdx[u.row];
        const starTxt = u.star===m.rarity ? `★${u.star}` : `★${u.star}(本来★${m.rarity})`;
        L.push(`| ${u.row==='front'?'前衛':'後衛'}${col} | ${u.boss?'👑 ':''}${m.name} | ${starTxt} | ${e.level||'?'} | ${D.ELEM_LABEL[m.element]} | ${D.ROLE_LABEL[m.role]} | ${u.maxHp.toLocaleString()} | ${u.str.toLocaleString()} |`);
      });
      L.push('');
    });
  }
}
require('fs').writeFileSync('/mnt/user-data/outputs/クエスト全ステージ一覧.md', L.join('\n'));
console.log('lines', L.length);
