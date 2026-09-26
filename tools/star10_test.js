/* ★10解放: docs/design/今後やりたいこと.json の確定表どおりか、敵の★は変わらないか の回帰テスト */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e = { MAX_STAR, MAX_LEVEL, STAR_TABLE, ENEMY_STAR_CAP, STAGES, abyssStage, PROMO_GOLD, LEVEL_WALLS, expToNext, DEFAULT_STATE, normalizeState, levelCapOf, soulsToNext, promoteMonster, atWall };`);
const E = global.__e;
let fails = 0;
const ok = (n, c, i) => { if(!c) fails++; console.log((c ? '✅' : '❌') + ' ' + n + (i !== undefined ? '  ' + JSON.stringify(i) : '')); };
const T = E.STAR_TABLE;
ok('★の上限は10、Lvの上限は300', E.MAX_STAR === 10 && E.MAX_LEVEL === 300);
ok('上限Lv: ★5=150 ★6=170 ★7=200 ★8=230 ★9=260 ★10=300', [5, 6, 7, 8, 9, 10].map(s => T[s].lvCap).join() === '150,170,200,230,260,300');
ok('必要ソウル: ★5→6=300 ★6→7=500 ★7→8=500 ★8→9=500 ★9→10=1000(★10は上限)', [5, 6, 7, 8, 9].map(s => T[s].soulsToNext).join() === '300,500,500,500,1000' && T[10].soulsToNext === null);
ok('★5→★10で合計2800ソウル', [5, 6, 7, 8, 9].reduce((a, s) => a + T[s].soulsToNext, 0) === 2800);
ok('★1〜★6は据え置き', [1, 2, 3, 4, 5, 6].map(s => `${T[s].lvCap}/${T[s].soulsToNext}/${T[s].skillCap}`).join() === '50/10/10,70/50/10,100/100/10,120/200/10,150/300/10,170/500/11');
ok('★8〜★10の昇格ゴールドがある', [8, 9, 10].every(s => E.PROMO_GOLD[s] > E.PROMO_GOLD[s - 1]));
ok('Lv200→300のEXPが伸び続ける', E.expToNext(230) > E.expToNext(199) && E.expToNext(299) > E.expToNext(260));
ok('Lv230・260にも壁', E.LEVEL_WALLS.includes(230) && E.LEVEL_WALLS.includes(260));
// 敵の★は★10解放の前と同じ(上限7)
const maxEnemy = Math.max(...E.STAGES.flatMap(s => s.waves.flat().map(e => e.star || 0)));
const abyssMax = Math.max(...[60, 70, 80, 100, 200, 500].map(f => Math.max(...E.abyssStage(f).waves.flat().map(e => e.star || 0))));
ok('敵の★の上限は7のまま(ステージ・深淵回廊)', E.ENEMY_STAR_CAP === 7 && maxEnemy <= 7 && abyssMax === 7, { maxEnemy, abyssMax });
// 実際に★7→★10まで上がる
api.STATE = E.DEFAULT_STATE(); E.normalizeState();
const S = api.STATE; S.gold = 1e9; S.owned.m06 = { star: 7, souls: 5000, level: 200, exp: 0, wall: 200, skillLv: 1, skill2Lv: 1, ultLv: 1, passiveLv: 1 };
for(let i = 0; i < 5; i++) E.promoteMonster('m06');
ok('★7から★10まで昇格でき、そこで止まる', S.owned.m06.star === 10 && E.soulsToNext(S.owned.m06) === null && E.levelCapOf(S.owned.m06) === 300, S.owned.m06.star);
console.log(fails ? `NG ${fails}` : 'すべて通過');
process.exit(fails ? 1 : 0);
