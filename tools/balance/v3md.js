const o=require('./chance_v3.json');
const SL={skill1:'スキル1',skill2:'スキル2',ult:'必殺技',passive:'パッシブ',normal:'通常攻撃'};
const TL={single:'単体',any:'単体',all:'全体',frontAll:'前衛全体',backAll:'後衛全体',back:'後衛単体',random:'ランダム'};
const rows=o.map(x=>{ let cur=x.chance, nc=x.nc, eff=x.eff;
  if(x.slot==='passive'){ cur=+(x.desc.match(/(\d+)%で/)||[])[1]/100; nc=cur;
    const m=x.desc.match(/%で(.+?)(\(|。|$)/); eff=(x.desc.match(/%で相手を(.+?)(にする|\(|$)/)||[])[1]||(x.desc.includes('反撃')?'反撃':x.desc.includes('毒')?'毒':x.desc.includes('STR')?'STRダウン':'ダメージ軽減'); }
  const tgt=TL[x.tgt]; const e=tgt&&x.slot!=='passive'?`${eff}（${tgt}${x.hits>1?'・各ヒット':''}）`:eff;
  const after=x.rule==='確定'?'**確定**':`${Math.round(nc*100)}%で固定`;
  const pw=x.budget?`${x.ratioB}% → ${x.ratioA}%`:'—';
  return {r:x.r, line:`| ★${x.r} | ${x.name} | ${x.skill}（${SL[x.slot]}） | ${e} | ${Math.round(cur*100)}% | ${after} | ${pw} |`};});
rows.sort((a,b)=>b.r-a.r);
console.log('| ★ | キャラ | 技 | 効果 | 今 | 見直し後 | パワー÷予算（今→後） |\n|---|---|---|---|---|---|---|\n'+rows.map(r=>r.line).join('\n'));
