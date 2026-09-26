/* 複数編成(編成1〜5): 移行・切り替え・編成ごとの遺物・PVPの遺物の参照先 の回帰テスト */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e = { DEFAULT_STATE, normalizeState, switchFormationSet, relicOfIn, equippedRelicOf, newRelicState, RELICS, buildDefenseSnapshot, FORMATION_SETS, syncActiveFormation, PARTY_MAX };`);
const E = global.__e;
let fails = 0;
const ok = (n, c, i) => { if(!c) fails++; console.log((c ? '✅' : '❌') + ' ' + n + (i !== undefined ? '  ' + JSON.stringify(i) : '')); };

// 以前のセーブ(formationsなし): 今のパーティは編成1に、遺物の装備はすべての編成に
api.STATE = E.DEFAULT_STATE();
let S = api.STATE;
const [r1, r2] = Object.keys(E.RELICS);
S.relics = { [r1]: E.newRelicState(), [r2]: E.newRelicState() };
S.relics[r1].equippedTo = 'm06';
S.slots = ['m06', 'm21', null, 'm03', null];
delete S.formations; delete S.formationIdx;
E.normalizeState();
ok('編成は5つ', S.formations.length === E.FORMATION_SETS && E.FORMATION_SETS === 5);
ok('今のパーティが編成1に入る', S.formationIdx === 0 && S.formations[0].slots.join() === S.slots.join());
ok('編成2〜5は空', S.formations.slice(1).every(f => f.slots.every(x => !x)));
ok('遺物の装備はどの編成にも引き継ぐ', S.formations.every(f => f.relics.m06 === r1), S.formations.map(f => f.relics));

// 編成2に切り替えて別のキャラに同じ遺物r1を付ける
E.switchFormationSet(1);
ok('編成2に切り替えるとパーティは空', S.formationIdx === 1 && S.slots.every(x => !x));
S.slots = ['m21', null, null, null, null];
S.relics[r1].equippedTo = 'm21';           // 同じ編成の中では1体にしか付かない(equipRelicと同じ動き)
S.relics[r2].equippedTo = 'm06';
E.syncActiveFormation();
ok('編成2ではr1がm21に・r2がm06に', E.equippedRelicOf('m21') === r1 && E.equippedRelicOf('m06') === r2);
ok('編成1のr1はm06のまま(別の編成なら同じ遺物を使える)', E.relicOfIn(0, 'm06') === r1 && E.relicOfIn(0, 'm21') === null);

// 編成1に戻すとパーティ・遺物とも元通り
E.switchFormationSet(0);
ok('編成1に戻すとパーティが戻る', S.slots.join() === ['m06', 'm21', null, 'm03', null].join());
ok('編成1に戻すと遺物の装備も戻る', E.equippedRelicOf('m06') === r1 && E.equippedRelicOf('m21') === null && S.relics[r2].equippedTo === null);
ok('編成2の内容は残る', S.formations[1].slots[0] === 'm21' && S.formations[1].relics.m21 === r1 && S.formations[1].relics.m06 === r2);

// 同じ編成で同じ遺物が2体に付いたデータは読み込み時に1体へ
S.formations[2].relics = { m06: r1, m21: r1 };
E.normalizeState();
ok('同じ編成で同じ遺物の重複は読み込み時に片方だけ', Object.values(S.formations[2].relics).filter(x => x === r1).length === 1);

// PVP防衛: 遺物は指定した編成のものを使う(今選んでいる編成とは別)
S.pvpDefenseSlots = ['m06', null, null, null, null];
S.pvpDefenseFormation = S.formationKey;
S.pvpDefenseRelicsFrom = 1;
let snap = E.buildDefenseSnapshot();
ok('防衛編成は編成2の遺物(m06にr2)', snap.slots[0].relic && snap.slots[0].relic.defId === r2, snap.slots[0].relic);
S.pvpDefenseRelicsFrom = 0;
snap = E.buildDefenseSnapshot();
ok('編成1を選べば編成1の遺物(m06にr1)', snap.slots[0].relic && snap.slots[0].relic.defId === r1);

// 壊れた値
S.formations = [{ slots: ['zzz', 'm06'], formationKey: 'nope', relics: { m06: 'nope' } }];
S.formationIdx = 9;
E.normalizeState();
ok('壊れた値は直る', S.formations.length === 5 && S.formationIdx === 0 && S.formations.every(f => f.slots.length === E.PARTY_MAX));

console.log(fails ? `NG ${fails}` : 'すべて通過');
process.exit(fails ? 1 : 0);
