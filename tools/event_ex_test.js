/* 九尾「狐火の祭壇」・タイタン「巨神の遺跡」のEXステージ。
   狙い: EX1 = EXが開いた直後(★4 Lv70)でも勝てる / EX2 = 中盤の壁 / EX3 = 本気編成でも半々。

   使い方: python3 tools/extract.py してから  cd tools && node event_ex_test.js */
const load = require('./harness.js');
const api = load('game.js', s => s + `;global.__e={
  EVENTS, STAGE_BY_ID, MON_BY_ID, stageRulesOf, speciesOf, kitOf, EX_UNLOCK_TIER, EVENT_EX, EVENT_EX_RULES,
  STAGE_RULE_WHEN, get STATE(){ return STATE }, set STATE(v){ STATE = v }, DEFAULT_STATE,
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
  // ソウルが出るので、1面に出る敵の種類は10体まで(docs/design/イベントステージの作り方.md)
  e.exStages.forEach(s => {
    const u = new Set(s.waves.flat().map(x => x.ref));
    ok(`  ${s.name}: 敵の種類は10体まで`, u.size <= 10, u.size);
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
  ok('  九尾: 敵の物理防御+40ポイント', rules.some(r => r.side === 'enemy' && r.stat && r.stat.pdef === 40));
  ok('  九尾: 敵SPD+50%', rules.some(r => r.side === 'enemy' && r.stat && r.stat.spd === 0.5));
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
  ok('  タイタン: 敵のシールド+100%', rules.some(r => r.side === 'enemy' && r.shield === 1));
  ok('  タイタン: 敵が気絶にかからない', rules.some(r => r.immune && r.immune.includes('stun')));
  ok('  タイタン: 敵がやけど・毒にかからない', rules.some(r => r.immune && r.immune.includes('burn') && r.immune.includes('poison')));
  // 敵にドワーフが多いと「ドワーフの味方+50%」が相手にも見えて紛らわしいので、味方向けだと分かること
  ok('  ドワーフの効果は味方だけ', rules.find(r => r.who && r.who.species === 'dwarf').side === 'ally');
}

/* ---- 3. EX3だけの追加ルール ---- */
console.log('\n--- 3. EX3だけ段差がある ---');
['ev_kyubi', 'ev_titan'].forEach(k => {
  const e = ev(k), [ex1, ex2, ex3] = e.exStages;
  ok(`  ${k}: EX1とEX2のルールは同じ`, JSON.stringify(ex1.rules) === JSON.stringify(ex2.rules));
  ok(`  ${k}: EX3だけルールが1つ多い`, ex3.rules.length === ex1.rules.length + 1, [ex1.rules.length, ex3.rules.length]);
  const extra = ex3.rules[ex3.rules.length - 1];
  ok(`  ${k}: 追加は敵の強化で、EX3のみと書いてある`, extra.side === 'enemy' && /EX3のみ/.test(extra.label), extra.label);
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
