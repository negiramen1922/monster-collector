/* 九尾「狐火の祭壇」・タイタン「巨神の遺跡」のEXステージ。
   狙い: EX1 = EXが開いた直後(★4 Lv70)でも勝てる / EX2 = 中盤の壁 / EX3 = 本気編成でも半々。

   使い方: python3 tools/extract.py してから  cd tools && node event_ex_test.js */
const load = require('./harness.js');
const api = load('game.js', s => s + `;global.__e={
  EVENTS, STAGE_BY_ID, MON_BY_ID, stageRulesOf, speciesOf, kitOf, EX_UNLOCK_TIER, EVENT_EX, EVENT_EX_RULES,
  STAGE_RULE_WHEN, MONSTER_KITS, preferredRow, shieldTotal, DEFAULT_STATE,
  get STATE(){ return STATE }, set STATE(v){ STATE = v },
};`);
const E = global.__e;
let ng = 0;
const ok = (name, cond, info) => { console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : '')); if(!cond) ng++; };
api.STATE = E.DEFAULT_STATE();
const ev = k => E.EVENTS.find(e => e.key === k);

/* ---- 1. かたち ---- */
console.log('--- 1. EXのかたち ---');
['ev_kyubi', 'ev_titan'].forEach(k => {
  const e = ev(k);
  ok(`${k}: EXが3面ある`, e.exStages.length === 3, e.exStages.length);
  ok(`  ステージ${E.EX_UNLOCK_TIER}クリアで開く`, e.exStages.every(s => s.requires === `${k}_${E.EX_UNLOCK_TIER}`));
  ok('  スタミナを使わない', e.exStages.every(s => s.stamina === 0));
  ok('  推奨Lvは 80 / 200 / 300', e.exStages.map(s => s.rec).join() === '80,200,300', e.exStages.map(s => s.rec));
  // ソウルが出るので、顔ぶれは広げすぎず絞りすぎず(docs/design/イベントステージの作り方.md)。
  // 13枠のうち、守り役を各ウェーブに置くと自然に11〜12種になる
  e.exStages.forEach(s => {
    const u = new Set(s.waves.flat().map(x => x.ref));
    ok(`  ${s.name}: 敵の種類は8〜13`, u.size >= 8 && u.size <= 13, u.size);
  });
  ok('  主役がEXのボス', e.exStages.every(s => s.waves.slice(-1)[0].some(x => x.boss && x.ref === e.pickup)));
});

/* ---- 2. ステージ効果が「効く敵」を入れているか ---- */
console.log('\n--- 2. 効果が空振りしていないこと ---');
{
  // 九尾: 「やけど状態の敵へ+50%」を活かすには、敵自身がやけどを撒くか、味方が焼ける必要がある。
  // ここでは敵に炎属性(=やけどを入れやすい相手)が多いことだけ見る
  const k = ev('ev_kyubi');
  k.exStages.forEach(s => {
    const refs = [...new Set(s.waves.flat().map(x => x.ref))];
    const fire = refs.filter(r => E.MON_BY_ID[r].element === 'fire').length;
    ok(`  ${s.name}: 敵の半分以上が炎`, fire / refs.length >= 0.5, fire + '/' + refs.length);
  });
  const rules = E.stageRulesOf(k.exStages[0]);
  ok('  九尾: やけどの敵へ+50%(whenTarget)', rules.some(r => r.whenTarget === 'burned' && r.dmgDealt === 0.5));
  ok('  九尾: デーモンの味方 HP+50%', rules.some(r => r.who && r.who.species === 'demon' && r.stat && r.stat.hp === 0.5));
  ok('  九尾: シューターの味方 STR+50%', rules.some(r => r.who && r.who.role === 'shooter' && r.stat && r.stat.str === 0.5));
  const kr = n => E.stageRulesOf(k.exStages[n - 1]);
  ok('  九尾: 敵SPD+50% はEX2から', !kr(1).some(r => r.stat && r.stat.spd === 0.5) && kr(2).some(r => r.side === 'enemy' && r.stat && r.stat.spd === 0.5));
  ok('  九尾: 敵の物理防御+40ポイントはEX3から', !kr(2).some(r => r.stat && r.stat.pdef === 40) && kr(3).some(r => r.side === 'enemy' && r.stat && r.stat.pdef === 40));
}
{
  // タイタン: 「敵のシールド効果量+100%」は、シールドを張る敵がいないと空振りする
  const t = ev('ev_titan');
  const casts = m => ['skill1', 'skill2', 'ult'].some(n => { const a = E.kitOf(m)[n]; return a && (a.effects || []).some(e => e.shield); });
  t.exStages.forEach(s => {
    const refs = [...new Set(s.waves.flat().map(x => x.ref))];
    const n = refs.filter(r => casts(E.MON_BY_ID[r])).length;
    ok(`  ${s.name}: シールドを張る敵がいる`, n >= 1, refs.filter(r => casts(E.MON_BY_ID[r])).map(r => E.MON_BY_ID[r].name));
  });
  const rules = E.stageRulesOf(t.exStages[0]);
  ok('  タイタン: シールド中の味方 与ダメ+50%', rules.some(r => r.when === 'shielded' && r.dmgDealt === 0.5));
  ok('  タイタン: ドワーフの味方 HP・STR+50%', rules.some(r => r.who && r.who.species === 'dwarf' && r.stat && r.stat.hp === 0.5 && r.stat.str === 0.5));
  const tr = n => E.stageRulesOf(t.exStages[n - 1]);
  ok('  タイタン: 状態異常が効かないのはEX2から', !tr(1).some(r => r.immune) && tr(2).some(r => r.immune && ['stun', 'burn', 'poison'].every(x => r.immune.includes(x))));
  ok('  タイタン: 敵のシールド+100%はEX3から', !tr(2).some(r => r.shield === 1) && tr(3).some(r => r.side === 'enemy' && r.shield === 1));
  ok('  タイタン: シールドが無い味方は被ダメ+50%', tr(1).some(r => r.when === 'unshielded' && r.dmgTaken === 0.5));
  // 敵にドワーフが多いと「ドワーフの味方+50%」が相手にも見えて紛らわしいので、味方向けだと分かること
  ok('  ドワーフの効果は味方だけ', rules.find(r => r.who && r.who.species === 'dwarf').side === 'ally');
}

/* ---- 3. EX3だけの追加ルール ---- */
console.log('\n--- 3. EX3だけ段差がある ---');
['ev_kyubi', 'ev_titan'].forEach(k => {
  const e = ev(k), [ex1, ex2, ex3] = e.exStages;
  ok(`  ${k}: EX2でルールが増える`, ex2.rules.length > ex1.rules.length, [ex1.rules.length, ex2.rules.length]);
  ok(`  ${k}: EX3でさらに増える`, ex3.rules.length > ex2.rules.length, [ex2.rules.length, ex3.rules.length]);
  ok(`  ${k}: 増えるぶんは全部「敵側」`,
     ex3.rules.slice(ex1.rules.length).every(r => r.side === 'enemy'),
     ex3.rules.slice(ex1.rules.length).map(r => r.label));
  ok(`  ${k}: 増えたルールに「EX2から」「EX3から」と書いてある`,
     ex3.rules.slice(ex1.rules.length).every(r => /^EX[23]から/.test(r.label || '')),
     ex3.rules.slice(ex1.rules.length).map(r => r.label));
  // 雑魚の★もEX3だけ上がる
  const mobStar = s => Math.max(...s.waves.flat().filter(x => !x.boss).map(x => x.star));
  ok(`  ${k}: EX3の雑魚は★8`, mobStar(ex3) === 8, [mobStar(ex1), mobStar(ex2), mobStar(ex3)]);
});

/* ---- 4. 効果の書きかた(防御はポイント・ほかは割合) ---- */
console.log('\n--- 4. 書きかた ---');
{
  const all = ['ev_kyubi', 'ev_titan'].flatMap(k => ev(k).exStages).flatMap(s => E.stageRulesOf(s));
  ok('どのルールにも label がある(無いと画面に出ない)', all.every(r => r.label), all.filter(r => !r.label));
  const bad = all.filter(r => r.stat && ['pdef', 'mdef'].some(x => r.stat[x] !== undefined && Math.abs(r.stat[x]) < 1 && r.stat[x] !== 0));
  ok('防御はポイントで書いてある(割合が混ざっていない)', bad.length === 0, bad.map(r => r.label));
  const whens = all.filter(r => r.when || r.whenTarget);
  ok('when / whenTarget は用意されているキーだけ',
     whens.every(r => (!r.when || E.STAGE_RULE_WHEN[r.when]) && (!r.whenTarget || E.STAGE_RULE_WHEN[r.whenTarget])),
     whens.map(r => r.when || r.whenTarget));
}

console.log(ng ? `\n${ng}件 NG` : '\ndone');
if(ng) process.exitCode = 1;


/* ---- 編成の決まり(α0.3.010で決めたもの) ---- */
console.log('\n--- 編成の決まり ---');
const SHAPE = [4, 4, 5];
const guards = id => { const t = JSON.stringify(E.MONSTER_KITS[id]); return /"taunt"|"redirect"/.test(t); };
['ev_kyubi', 'ev_titan'].forEach(k => {
  const e = ev(k);
  e.exStages.forEach((st, ti) => {
    st.waves.forEach((w, wi) => {
      const where = `${k} EX${ti + 1} W${wi + 1}`;
      ok(`${where}: 4-4-5 の体数`, w.length === SHAPE[wi], w.length);
      // 配置はデータに書いてあること(ロール任せにすると前衛ゼロのウェーブができる)
      ok(`${where}: 全員の配置が書いてある`, w.every(x => x.row === 'front' || x.row === 'back'), w.map(x => x.row));
      const front = w.filter(x => x.row === 'front');
      ok(`${where}: 前衛が2体以上`, front.length >= 2, front.length);
      ok(`${where}: 前衛に挑発かかばう持ちがいる`, front.some(x => guards(x.ref)),
         front.map(x => E.MON_BY_ID[x.ref].name));
    });
    const last = st.waves[st.waves.length - 1];
    ok(`${k} EX${ti + 1}: 最終ウェーブの先頭が主役(ボス)`, last[0].boss && last[0].ref === e.pickup,
       E.MON_BY_ID[last[0].ref].name);
    ok(`${k} EX${ti + 1}: ボスは1体だけ`, st.waves.flat().filter(x => x.boss).length === 1);
  });
});

/* ---- ルールが段ごとに増える(減らない) ---- */
console.log('\n--- ルールは段ごとに増える ---');
['ev_kyubi', 'ev_titan'].forEach(k => {
  const e = ev(k);
  const labels = e.exStages.map(st => E.stageRulesOf(st).map(r => r.label));
  ok(`${k}: EX1は味方側のルールだけ`, E.stageRulesOf(e.exStages[0]).every(r => r.side !== 'enemy'),
     labels[0]);
  for(let i = 1; i < 3; i++){
    ok(`${k}: EX${i + 1}はEX${i}のルールを全部持っている`,
       labels[i - 1].every(l => labels[i].includes(l)), { 前: labels[i - 1], 後: labels[i] });
    ok(`${k}: EX${i + 1}でルールが増えている`, labels[i].length > labels[i - 1].length,
       [labels[i - 1].length, labels[i].length]);
  }
});
ok('シールドが無いときの判定がある', typeof E.STAGE_RULE_WHEN.unshielded === 'function');
ok('  シールド0なら当てはまる', E.STAGE_RULE_WHEN.unshielded({ shields: [] }) === true);
ok('巨神の遺跡に「シールドが無いあいだ 受けるダメージ+50%」がある',
   E.stageRulesOf(ev('ev_titan').exStages[0]).some(r => r.when === 'unshielded' && r.dmgTaken === 0.5));
ok('狐火の祭壇のやけどのルールは敵にも効く',
   E.stageRulesOf(ev('ev_kyubi').exStages[0]).some(r => r.whenTarget === 'burned' && r.side === 'both'));

console.log(ng ? `\n${ng}件失敗` : '\nすべて通過');
process.exit(ng ? 1 : 0);
