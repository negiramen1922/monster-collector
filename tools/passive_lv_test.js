/* パッシブLv(α0.5)の回帰テスト: すべてのパッシブに、パッシブLvで伸びる数値が1つはあること。
   前は30個がLvを上げても何も変わらなかった(docs/提案資料/パッシブLvの区切り見直し.md)。
   使い方: cd tools && node passive_lv_test.js */
const load = require('./harness.js');
load('game.js', s => s + ';global.__e={ MONSTER_KITS, MONSTERS, MON_BY_ID, passiveScalesWithLevel, buildUnit, passiveMod, pv, effSpd, hateOf };');
const E = global.__e;
let ng = 0;
const ok = (name, cond, info) => { if(!cond){ ng++; console.log('❌ ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : '')); } };
const no = E.MONSTERS.filter(m => E.MONSTER_KITS[m.id] && !E.passiveScalesWithLevel(E.MONSTER_KITS[m.id].passive || {})).map(m => m.name);
ok('すべてのパッシブがパッシブLvで伸びる', no.length === 0, no);
const by = Object.fromEntries(E.MONSTERS.map(m => [m.name, m]));
const mk = (n, plv) => E.buildUnit(by[n], 1, false, by[n].rarity, false, 100, { passiveLv: plv });
// いくつかを実際の値で見る(Lv1 → Lv5 で1.5倍)
ok('ダークメカロイド: 被ダメ軽減 5% → 7.5%', Math.abs(E.passiveMod(mk('ダークメカロイド', 1), 'cutBonus', 'phys') - 0.05) < 1e-9 && Math.abs(E.passiveMod(mk('ダークメカロイド', 5), 'cutBonus', 'phys') - 0.075) < 1e-9);
ok('天狗: 加速の量 +10% → +15%', Math.abs(E.passiveMod(mk('天狗', 5), 'spdBuffPower') - 0.15) < 1e-9);
const d = mk('ドラウグル', 5); d.flags.survived = true;
ok('ドラウグル: 耐えたあと STR+15%(Lv5)', Math.abs(E.passiveMod(d, 'strBonus') - 0.15) < 1e-9);
console.log(ng ? `❌${ng}` : 'すべて通過');
