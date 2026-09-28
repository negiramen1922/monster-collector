/* 延焼(やけどの再付与)のテスト。
   同じ敵にやけどを付け直すと、ターン数が戻るのに加えてやけどダメージの50%が即入る。
   同じ敵に1ターン3回まで。上書きは強いほうを残す。 */
const load = require('./harness.js');
const api = load('game.js', s => s + ';global.__t={applyStatus,buildUnit,MONSTERS,SPREAD_MAX_PER_TURN,SPREAD_RATIO,BURN_STR_RATIO,effStr};');
const T = global.__t;
let fail = 0;
const ok = (c, m) => { console.log((c ? '✅' : '❌') + ' ' + m); if (!c) fail++; };

// 実戦の場を作る(battleUI が要るので run を1回通す)
const by = Object.fromEntries(api.MONSTERS.map(m => [m.name, m.id]));
const b = api.run(['九尾の狐', 'フェンリル'].map(n => by[n]), 'q1_01', 30, { star: 3, skillLv: 5, ultLv: 5, passiveLv: 5 });
const atk = b.party[0], weak = b.party[1];
const foe = (b.enemies || []).find(u => u && u.alive) || b.party[1];
foe.hp = foe.maxHp = 999999;
foe.statuses = {};

const strong = Math.round(T.effStr(atk) * T.BURN_STR_RATIO);
T.applyStatus(foe, 'burn', atk);
ok(!!foe.statuses.burn, '1回目でやけどが付く');
const dmg1 = foe.statuses.burn.dmg;

// 2回目: 延焼で即ダメージが入る
const before = foe.hp;
T.applyStatus(foe, 'burn', atk);
const dealt = before - foe.hp;
ok(dealt > 0, `2回目で延焼のダメージが入る (${dealt})`);
ok(Math.abs(dealt - Math.round(dmg1 * T.SPREAD_RATIO)) <= 1, `延焼はやけどダメージの50% (${dealt} ≒ ${Math.round(dmg1 * T.SPREAD_RATIO)})`);

// 上限: 同じ敵に1ターン3回まで
let n = 0;
for (let i = 0; i < 5; i++) { const h = foe.hp; T.applyStatus(foe, 'burn', atk); if (foe.hp < h) n++; }
ok(n === T.SPREAD_MAX_PER_TURN - 1, `1ターンの上限が${T.SPREAD_MAX_PER_TURN}回 (2回目のあと残り${n}回入った)`);

// 上書きは強いほうを残す: 弱い相手が付け直してもダメージが下がらない
foe.statuses = {}; foe.spreadRound = -1;
T.applyStatus(foe, 'burn', atk);
const keep = foe.statuses.burn.dmg;
weak.str = 1;
T.applyStatus(foe, 'burn', weak);
ok(foe.statuses.burn.dmg === keep, `弱い味方が付け直してもダメージが下がらない (${keep} のまま)`);
ok(foe.statuses.burn.turns === 2, 'ターン数は戻る');

console.log(fail ? `\n${fail}件 失敗` : '\nすべて通過');
process.exit(fail ? 1 : 0);
