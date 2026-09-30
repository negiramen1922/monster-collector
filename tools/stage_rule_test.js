/* ステージ効果(EXステージ・総力戦の特殊ルール)の検証。
   九尾・タイタンのEXのために足した4つ(whenTarget / shielded / shield / immune)と、
   「物理耐性」を書くための atk の絞り込みを見る。

   使い方: python3 tools/extract.py してから  cd tools && node stage_rule_test.js */
const load = require('./harness.js');
const api = load('game.js', s => s + `;global.__e={
  STAGE_RULE_WHEN, ruleHits, stageRulesOf, applyStageRules, stageDmgMod, stageShieldMod, stageImmune,
  addShield, applyStatus, shieldTotal, hasStatus, buildUnit, MON_BY_ID, STAGE_BY_ID, STAGES,
  get battleUI(){ return battleUI }, set battleUI(v){ battleUI = v },
  get STATE(){ return STATE }, set STATE(v){ STATE = v }, DEFAULT_STATE,
};`);
const E = global.__e;
let ng = 0;
const ok = (name, cond, info) => { console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : '')); if(!cond) ng++; };
api.STATE = E.DEFAULT_STATE();

// ルールを差した仮のステージで、ユニットを1体だけ作って調べる
function unit(id, isEnemy, rules){
  E.battleUI = { stage: { rules }, currentActor: null, party: [], enemies: [], log: [], fxEvents: [] };
  const u = E.buildUnit(E.MON_BY_ID[id], 100, isEnemy, 5, 5, 5, 5, null);
  u.isEnemy = isEnemy;
  E.applyStageRules(u, { rules }, isEnemy);
  return u;
}
const DEMON = Object.values(E.MON_BY_ID).find(m => m.rarity >= 4 && m.role !== 'tank');

/* ---- 1. 新しい when ---- */
console.log('--- 1. 新しい条件 ---');
['burned', 'poisoned', 'shielded'].forEach(k => ok(`  when: ${k} がある`, typeof E.STAGE_RULE_WHEN[k] === 'function'));
{
  const u = unit('m54', false, []);
  ok('  shielded: シールドが無いとき false', !E.STAGE_RULE_WHEN.shielded(u));
  E.addShield(u, 500, 3, null, false);
  ok('  shielded: シールドがあると true', E.STAGE_RULE_WHEN.shielded(u), E.shieldTotal(u));
  ok('  burned: やけどでないとき false', !E.STAGE_RULE_WHEN.burned(u));
  u.statuses.burn = { turns: 3, dmg: 10 };
  ok('  burned: やけどだと true', E.STAGE_RULE_WHEN.burned(u));
}

/* ---- 2. whenTarget(やけどの敵に+50%) ---- */
console.log('\n--- 2. whenTarget は「殴る相手」を見る ---');
{
  const rules = [{ side: 'ally', dmgDealt: 0.5, whenTarget: 'burned' }];
  const me = unit('m116', false, rules), foe = unit('m54', true, rules);
  ok('  相手がやけどでなければ乗らない', E.stageDmgMod(me, 'dmgDealt', foe) === 0, E.stageDmgMod(me, 'dmgDealt', foe));
  foe.statuses.burn = { turns: 3, dmg: 10 };
  ok('  相手がやけどなら+50%', E.stageDmgMod(me, 'dmgDealt', foe) === 0.5, E.stageDmgMod(me, 'dmgDealt', foe));
  ok('  自分がやけどでも関係ない', (() => { me.statuses.burn = { turns: 3, dmg: 10 }; delete foe.statuses.burn;
    return E.stageDmgMod(me, 'dmgDealt', foe) === 0; })());
  ok('  相手が渡らないときは乗らない(dmgTakenと取り違えない)', E.stageDmgMod(me, 'dmgDealt', null) === 0);
  // when(自分) との違い
  const selfRules = [{ side: 'ally', dmgDealt: 0.5, when: 'burned' }];
  const me2 = unit('m116', false, selfRules);
  me2.statuses.burn = { turns: 3, dmg: 10 };
  ok('  when は自分の状態を見る', E.stageDmgMod(me2, 'dmgDealt', unit('m54', true, selfRules)) === 0.5);
}

/* ---- 3. atk の絞り込み(物理耐性) ---- */
console.log('\n--- 3. atk で物理だけ・魔法だけに絞れる ---');
{
  const rules = [{ side: 'enemy', dmgTaken: -0.667, atk: 'phys' }];
  const foe = unit('m54', true, rules);
  ok('  物理には乗る', E.stageDmgMod(foe, 'dmgTaken', null, 'phys') === -0.667, E.stageDmgMod(foe, 'dmgTaken', null, 'phys'));
  ok('  魔法には乗らない', E.stageDmgMod(foe, 'dmgTaken', null, 'mag') === 0, E.stageDmgMod(foe, 'dmgTaken', null, 'mag'));
  const both = unit('m54', true, [{ side: 'enemy', dmgTaken: -0.5 }]);
  ok('  atk を書かなければ両方に乗る',
     E.stageDmgMod(both, 'dmgTaken', null, 'phys') === -0.5 && E.stageDmgMod(both, 'dmgTaken', null, 'mag') === -0.5);
  const ally = unit('m116', false, rules);
  ok('  side が enemy なら味方には乗らない', E.stageDmgMod(ally, 'dmgTaken', null, 'phys') === 0);
}

/* ---- 4. シールドの量 ---- */
console.log('\n--- 4. シールドの量 ---');
{
  const plain = unit('m54', true, []);
  const got0 = E.addShield(plain, 500, 3, null, false);
  const rules = [{ side: 'enemy', shield: 1 }];
  const buffed = unit('m54', true, rules);
  const got1 = E.addShield(buffed, 500, 3, null, false);
  ok('  +1 で2倍になる', got1 === got0 * 2, [got0, got1]);
  const allyRules = unit('m54', false, rules);
  ok('  side が enemy なら味方のシールドは変わらない', E.addShield(allyRules, 500, 3, null, false) === got0);
  // 上限(最大HPの100%)は超えない
  const capped = unit('m54', true, [{ side: 'enemy', shield: 9 }]);
  E.addShield(capped, capped.maxHp, 3, null, false);
  ok('  上限(最大HPの100%)は超えない', E.shieldTotal(capped) <= capped.maxHp, [E.shieldTotal(capped), capped.maxHp]);
}

/* ---- 5. 状態異常の耐性 ---- */
console.log('\n--- 5. 状態異常の耐性 ---');
{
  const rules = [{ side: 'enemy', immune: ['stun', 'burn', 'poison'] }];
  const foe = unit('m54', true, rules), src = unit('m116', false, rules);
  ['stun', 'burn', 'poison'].forEach(stt => {
    ok(`  ${stt} がかからない`, E.applyStatus(foe, stt, src) === false && !E.hasStatus(foe, stt));
  });
  const plain = unit('m54', true, []);
  ok('  効果が無ければ今までどおりかかる', E.applyStatus(plain, 'burn', src) !== false && E.hasStatus(plain, 'burn'));
  const ally = unit('m54', false, rules);
  ok('  side が enemy なら味方にはかかる', E.applyStatus(ally, 'burn', src) !== false && E.hasStatus(ally, 'burn'));
  const one = unit('m54', true, [{ side: 'enemy', immune: ['stun'] }]);
  ok('  書いたものだけが効く', E.stageImmune(one, 'stun') && !E.stageImmune(one, 'burn'));
}

/* ---- 6. who で絞る(今までどおり) ---- */
console.log('\n--- 6. who の絞り込みは新しい効果にも効く ---');
{
  const rules = [{ side: 'ally', who: { role: 'shooter' }, stat: { str: 0.5 } }];
  const shooter = unit('m116', false, rules), tank = unit('m54', false, rules);
  const bare = unit('m116', false, []);
  ok('  シューターだけSTR+50%', Math.abs(shooter.str / bare.str - 1.5) < 0.02, [bare.str, shooter.str]);
  ok('  タンクは変わらない', tank.str === unit('m54', false, []).str);
}

console.log(ng ? `\n${ng}件 NG` : '\ndone');
if(ng) process.exitCode = 1;
