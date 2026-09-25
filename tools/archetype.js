/* 既存105体を、ロールの中の「傾向(アーキタイプ)」に機械的に分類する。
   判定はキットの実データ(tgt/hits/defIgnore/lifesteal/effects/onHit/passive)から行い、
   説明文の表記ゆれに頼りすぎないようにしている。
   使い方: python3 tools/extract.py してから  cd tools && node archetype.js
           node archetype.js --json   で分類結果をJSONで吐く */
const load = require('./harness.js');
const api = load('game.js', src => src + ';global.__e={MONSTERS,MONSTER_KITS,speciesOf};');
const E = global.__e;

const SLOTS = ['normal','skill1','skill2','ult'];

function feat(k){
  const f = { hits:0, hitSlots:0, all:0, single:0, back:0, pierce:0, lifesteal:0, crit:0,
              heal:0, healAll:0, allyBuff:0, foeDebuff:0, st:0, taunt:0, shield:0, revive:0,
              dispel:0, exec:0, sp:0, guard:0, counter:0, regen:0, maxPow:0, confuse:0 };
  SLOTS.forEach(n => {
    const o = k[n]; if(!o) return;
    const d = o.desc || '';
    if(o.hits > 1){ f.hits = Math.max(f.hits, o.hits); f.hitSlots++; }
    if(o.tgt === 'all') f.all++;
    if(o.tgt === 'single' || o.tgt === 'any') f.single++;
    if(o.tgt === 'back') f.back++;
    if(o.defIgnore || o.ignoreDef) f.pierce++;
    if(o.lifesteal) f.lifesteal++;
    if(o.critBonus) f.crit++;
    if(o.pow) f.maxPow = Math.max(f.maxPow, o.pow * (o.hits || 1));
    if(/回復|癒|吸収/.test(d)) f.heal++;
    if(/味方全体.*回復/.test(d)) f.healAll++;
    if(/復活|蘇生/.test(d)) f.revive++;
    if(/挑発/.test(d)) f.taunt++;
    if(/シールド/.test(d)) f.shield++;
    if(/解除|奪/.test(d)) f.dispel++;
    if(/肩代わり|かばう/.test(d)) f.guard++;
    if(/反撃|反射/.test(d)) f.counter++;
    if(/SP\+|SPを|SP獲得/.test(d)) f.sp++;
    if(/混乱|魅了|恐慌/.test(d)) f.confuse++;
    if(/HPが.*低いほど|HPが.*%以下の相手|HPが.*以下の敵/.test(d)) f.exec++;
    (o.effects || []).forEach(e => {
      if(e.to === 'allies' || e.to === 'ally') f.allyBuff++;
      if(e.to === 'foes' || e.to === 'foe') f.foeDebuff++;
      if(e.heal) f.heal++;
    });
    (o.onHit || []).forEach(e => { if(e.st) f.st++; if(e.debuff) f.foeDebuff++; });
  });
  const p = k.passive || {}, pd = p.desc || '';
  f.pCrit    = /会心/.test(pd) ? 1 : 0;
  f.pHeal    = /回復/.test(pd) ? 1 : 0;
  f.pCut     = /ダメージ-|被ダメージ|軽減/.test(pd) ? 1 : 0;
  f.pCounter = /反撃|反射/.test(pd) ? 1 : 0;
  f.pShield  = /シールド/.test(pd) ? 1 : 0;
  f.pRegen   = /ターン開始時.*回復|毎ターン.*回復/.test(pd) ? 1 : 0;
  f.pSurvive = /耐える|1で耐|復活/.test(pd) ? 1 : 0;
  if(p.cutBonus) f.pCut = 1;
  if(p.onEvade || /回避/.test(pd)) f.pEvade = 1;
  return f;
}

/* 各ロールの傾向。上から順に判定し、最初に当たったものを採用する(優先順位つき)。 */
const RULES = {
  attacker: [
    ['手数型',       f => f.hits >= 3 || (f.hits >= 2 && f.hitSlots >= 2)],
    ['吸収型',       f => f.lifesteal >= 2 || (f.lifesteal >= 1 && f.pHeal)],
    ['処刑型',       f => f.exec >= 1],
    ['デバフ火力型', f => f.foeDebuff + f.st >= 3],
    ['殲滅型',       f => f.all >= 2],
    ['単体高火力型', () => true],
  ],
  shooter: [
    ['貫通型',       f => f.pierce >= 1],
    ['後衛狙撃型',   f => f.back >= 1],
    ['状態異常型',   f => f.st >= 2],
    ['制圧型',       f => f.all >= 2],
    ['単体狙撃型',   () => true],
  ],
  support: [
    ['蘇生・保険型', f => f.revive >= 1 || f.pSurvive],
    ['浄化・解除型', f => f.dispel >= 1],
    ['SP供給型',     f => f.sp >= 1],
    ['全体回復型',   f => f.healAll >= 1 || (f.heal >= 2 && f.all >= 1)],
    ['妨害支援型',   f => f.foeDebuff + f.st >= 3],
    ['バフ型',       f => f.allyBuff >= 2],
    ['単体回復型',   () => true],
  ],
  tank: [
    ['自動シールド型', f => f.pShield],
    ['自己再生型',     f => !f.taunt && (f.pRegen || f.heal >= 2)],
    ['ガーディアン型', f => f.guard >= 1],
    ['カウンター型',   f => !f.taunt && (f.pCounter || f.counter >= 1)],
    ['シールド型',     f => f.shield >= 1],
    ['弱体設置型',     f => f.foeDebuff + f.st >= 3],
    ['挑発・防御型',   () => true],
  ],
  trickster: [
    ['攪乱型',       f => f.confuse >= 1],
    ['妨害型',       f => f.dispel >= 1],
    ['回避型',       f => f.pEvade],
    ['変則火力型',   () => true],
  ],
};

function classify(role, f){
  const rs = RULES[role] || [];
  for(const [name, test] of rs) if(test(f)) return name;
  return '—';
}

const out = E.MONSTERS.map(m => {
  const k = E.MONSTER_KITS[m.id];
  if(!k) return null;
  const f = feat(k);
  return { key:m.id, n:m.name, star:m.rarity, role:m.role, arch:classify(m.role, f) };
}).filter(Boolean);

if(process.argv.includes('--json')){
  console.log(JSON.stringify(out));
}else{
  const byRole = {};
  out.forEach(x => { (byRole[x.role] = byRole[x.role] || []).push(x); });
  Object.keys(byRole).forEach(role => {
    const g = byRole[role];
    console.log('\n=== ' + role + ' (' + g.length + '体) ===');
    const counts = {};
    g.forEach(x => { (counts[x.arch] = counts[x.arch] || []).push('★' + x.star + x.n); });
    (RULES[role] || []).forEach(([name]) => {
      const list = counts[name] || [];
      console.log('  ' + name.padEnd(8, '　') + String(list.length).padStart(3) + '体  ' + list.join(' / '));
    });
  });
}
