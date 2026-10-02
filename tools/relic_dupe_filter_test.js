/* regression test: 遺物に「覚醒(凸)」フィルターを追加し、遺物一覧(図鑑)・遺物図鑑の
   セル・キャラの装備遺物選択(relicPicker)のどこでも、覚醒(凸)で★が上がっている時は
   その分の★も(色を変えて)見えるようにした。 */
const load = require('./harness.js');
const api = load('game.js', src => src + `;global.__e = {
  get STATE(){ return STATE }, set STATE(v){ STATE = v }, DEFAULT_STATE, RELICS,
  grantRelic, useRelicDupe, equipRelic,
  relicStarRowHtml, relicCell, matchesRelicFilter, relicFilterCount,
  openRelicPicker, renderRelicPicker, closeRelicPicker,
  RELIC_MAX_DUPE_USE, resoHave, migrateRelicReso,
};`);
const E = global.__e;
const ok = (name, cond, info) => console.log((cond ? '✅' : '❌') + ' ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));

// document.getElementById('modal-layer') needs the same tracking-stub trick used elsewhere,
// since renderRelicPicker writes into it via a fresh getElementById() call each time.
let modalHtml = '';
const modalStub = { innerHTML: '', classList: { add(){ modalHtml = modalStub.innerHTML; }, remove(){} }, querySelector: () => null };
const realGetById = global.document.getElementById;
global.document.getElementById = id => id === 'modal-layer' ? modalStub : realGetById(id);

api.STATE = E.DEFAULT_STATE();
const relicId = 'rel_flame_ember';
const def = E.RELICS[relicId];
E.grantRelic(def);
// 覚醒(凸)を2回分使えるように、共鳴石(α0.4.000から持ち物の個数)を2個かぶりで手に入れてから使う
E.grantRelic(def); E.grantRelic(def);
ok('かぶると共鳴石が1個ずつ増える(持ち物の個数)', E.resoHave(relicId) === 2, E.resoHave(relicId));
E.useRelicDupe(relicId);
E.useRelicDupe(relicId);
const st = api.STATE.relics[relicId];
ok('準備: dupeUsedが2になり、共鳴石は使ったぶん減る', st.dupeUsed === 2 && E.resoHave(relicId) === 0, [st.dupeUsed, E.resoHave(relicId)]);
E.useRelicDupe(relicId);
ok('共鳴石が無いと共鳴できない', st.dupeUsed === 2);

// --- 1. relicStarRowHtml: モンスターと同じ並べ方(白い★を5個まで、★6を超えたぶんは左から青) ---
const count = html => { const all = (html.match(/<i[^>]*>★<\/i>/g) || []); return [all.length, all.filter(x => /blue/.test(x)).length]; };
const n = def.star + st.dupeUsed;
ok('★の数は最大5個・★6を超えたぶんが青', JSON.stringify(count(E.relicStarRowHtml(def, st))) === JSON.stringify([Math.min(n, 5), Math.max(0, n - 5)]), [def.star, st.dupeUsed, count(E.relicStarRowHtml(def, st))]);
const s5 = Object.values(E.RELICS).find(d => d.star === 5);
ok('★5を4回共鳴(★9)なら青4個+白1個', JSON.stringify(count(E.relicStarRowHtml(s5, { dupeUsed: 4 }))) === '[5,4]');
const otherId = Object.keys(E.RELICS).find(id => id !== relicId);
const otherDef = E.RELICS[otherId];
ok('未共鳴の遺物は白い★が元の数だけ', JSON.stringify(count(E.relicStarRowHtml(otherDef, null))) === JSON.stringify([otherDef.star, 0]));

// --- 2. 遺物図鑑のセル(relicCell)・装備遺物選択(relicPicker)にも同じ★が出る ---
const rowHtml = E.relicStarRowHtml(def, st);
ok('遺物図鑑のセルにも同じ★が表示される', E.relicCell(relicId).includes(rowHtml));
api.STATE.owned['m06'] = { star: 5, souls: 0, level: 10, skillLv: 1, skill2Lv: 1, ultLv: 1, passiveLv: 1 };
modalHtml = '';
E.openRelicPicker('m06');
ok('装備遺物選択の一覧にも同じ★が表示される', modalHtml.includes(rowHtml));

// --- 古いセーブ(dupe - dupeUsed)からの移しかえ ---
api.STATE.relicResoV = 0; api.STATE.relicReso = {};
api.STATE.relics[relicId].dupe = 5;   // かぶり5回・使ったのは2回 → 3個
E.migrateRelicReso();
ok('古いセーブは「かぶった数 - 使った数」を共鳴石の個数に移す', E.resoHave(relicId) === 3, E.resoHave(relicId));
E.migrateRelicReso();
ok('移しかえは1回だけ', E.resoHave(relicId) === 3);

// --- 4. 「覚醒(凸)」フィルター: dupeUsedの値で絞り込める ---
ok('覚醒2の遺物はdupe:["2"]フィルターに一致する', E.matchesRelicFilter(relicId, { star: [], channel: [], dupe: ['2'] }));
ok('覚醒2の遺物はdupe:["0"]フィルター(未覚醒)には一致しない', !E.matchesRelicFilter(relicId, { star: [], channel: [], dupe: ['0'] }));
ok('未覚醒の遺物はdupe:["0"]フィルターに一致する', E.matchesRelicFilter(otherId, { star: [], channel: [], dupe: ['0'] }));
ok('dupeフィルターが空なら誰にでも一致する(フィルターなし扱い)', E.matchesRelicFilter(relicId, { star: [], channel: [], dupe: [] }));
ok('relicFilterCountがdupeの選択数も数える', E.relicFilterCount({ star: [], channel: [], dupe: ['1', '2'] }) === 2);

console.log('done');
